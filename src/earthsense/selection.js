/** One selected event owns its lazy route request; late responses never reopen a closed popup. */
export function createEventSelection({ loadTrack, onChange, now = Date.now }) {
  const cache = new Map();
  let event = null, request = null, revision = 0;
  const keyFor = value => `${value.id}:${value.gdacs?.episodeId ?? ''}:${value.time ?? ''}`;

  function withTrack(value, trackData) {
    const current = trackData.current;
    const wind = current?.windSpeedKmh;
    return { ...value, trackData,
      ...(Number.isFinite(wind) && wind >= 0 ? {
        cyclone: { ...value.cyclone, windSpeedKmh: wind, windBasis: 'observation', validTime: current.time },
      } : {}),
    };
  }

  function cancel() { revision++; request?.abort(); request = null; }

  function clear() {
    cancel();
    event = null;
    onChange(null, false);
  }

  async function select(value) {
    cancel();
    if (!value) { clear(); return; }
    if (value.layer !== 'typhoon') {
      event = value;
      onChange(event, true);
      return;
    }
    const key = keyFor(value), cached = cache.get(key);
    if (cached && now() - cached.time < 15 * 60_000) {
      event = withTrack(value, cached.data);
      onChange(event, true);
      return;
    }
    event = withTrack(value, { ...value.trackData, status: 'loading',
      history: value.trackData?.history || [], forecast: value.trackData?.forecast || [],
    });
    onChange(event, true);
    request = new AbortController();
    const controller = request, version = revision;
    try {
      const data = await loadTrack(value, { signal: controller.signal });
      if (controller.signal.aborted || version !== revision) return;
      cache.set(key, { data, time: now() });
      event = withTrack(value, data);
      onChange(event, false);
    } catch (error) {
      if (controller.signal.aborted || version !== revision) return;
      event = withTrack(value, { ...event.trackData, status: 'error',
        message: error?.message || '路径暂时无法加载，请重新选择此台风重试。',
      });
      onChange(event, false);
    } finally {
      if (request === controller) request = null;
    }
  }

  return { select, clear, getEvent: () => event, dispose() { clear(); cache.clear(); } };
}
