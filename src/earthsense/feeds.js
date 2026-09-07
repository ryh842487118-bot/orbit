/** Provider requests and freshness are independent of Three.js and the UI. */
export function createFeedStore(definitions, onChange, { now = Date.now } = {}) {
  const records = new Map(definitions.map(layer => [layer.id, {
    enabled: layer.enabled, status: 'idle', events: [], updatedAt: null, error: '', nextRefresh: 0,
  }]));
  const pending = new Map();
  let active = false, timer;

  function snapshot() {
    return Object.fromEntries([...records].map(([id, record]) => [id, {
      enabled: record.enabled, status: record.status, count: record.events.length,
      updatedAt: record.updatedAt, error: record.error,
    }]));
  }

  async function refreshLayer(definition, force) {
    const record = records.get(definition.id);
    if (!active || !record.enabled || pending.has(definition.id) || (!force && now() < record.nextRefresh)) return;
    const controller = new AbortController();
    pending.set(definition.id, controller);
    record.status = 'loading';
    onChange();
    try {
      const result = await definition.load({ signal: controller.signal, force });
      if (controller.signal.aborted || pending.get(definition.id) !== controller) return;
      const events = Array.isArray(result) ? result : result.events;
      if (!Array.isArray(events)) throw new Error('数据格式不可识别');
      record.events = events;
      record.error = Array.isArray(result) ? '' : result.warning || '';
      record.updatedAt = now();
      record.status = record.error ? 'partial' : events.length ? 'ready' : 'empty';
      record.nextRefresh = now() + (record.error ? 60_000 : definition.ttl);
    } catch (error) {
      if (controller.signal.aborted) return;
      record.error = error?.message || '数据源暂不可用';
      record.status = record.updatedAt ? 'stale' : 'error';
      record.nextRefresh = now() + 60_000;
    } finally {
      if (pending.get(definition.id) === controller) {
        pending.delete(definition.id);
        onChange();
      }
    }
  }

  function refresh(force = false) {
    return Promise.all(definitions.map(definition => refreshLayer(definition, force)));
  }

  function cancel(id) {
    const controller = pending.get(id);
    if (!controller) return;
    pending.delete(id);
    controller.abort();
    const record = records.get(id);
    record.status = record.updatedAt ? (record.error ? 'stale' : record.events.length ? 'ready' : 'empty') : 'idle';
  }

  function setActive(value) {
    if (active === value) return;
    active = value;
    clearInterval(timer);
    if (active) {
      void refresh();
      timer = setInterval(() => { if (!globalThis.document?.hidden) void refresh(); }, 60_000);
    } else {
      for (const id of [...pending.keys()]) cancel(id);
    }
    onChange();
  }

  function setEnabled(id, enabled) {
    const record = records.get(id), definition = definitions.find(layer => layer.id === id);
    if (!record) return;
    record.enabled = Boolean(enabled);
    if (!enabled) cancel(id);
    else void refreshLayer(definition, false);
    onChange();
  }

  return {
    setActive, setEnabled, refresh, snapshot,
    events: id => records.get(id)?.events || [],
    visibleEvents: () => [...records.values()].filter(record => record.enabled).flatMap(record => record.events),
    dispose() { setActive(false); },
  };
}
