import { fetchJson } from './http.js';
import { safeUrl } from './normalize.js';
import { gdacsEpisodeUrl, gdacsTimelineResource, parseGdacsTimeline } from './gdacs-track.js';

export async function loadCycloneTrack(event, options = {}) {
  if (options.signal?.aborted) throw new DOMException('数据请求已取消', 'AbortError');
  const detailsUrl = gdacsEpisodeUrl(event);
  if (!detailsUrl) {
    if (event?.source === 'NASA EONET' && Array.isArray(event.trackData?.history)) return event.trackData;
    return { history: [], forecast: [], current: null, source: event?.source || '公开来源',
      sourceUrl: safeUrl(event?.sourceUrl), issuedAt: null, status: 'unavailable',
      message: '当前来源未提供可加载的官方路径。' };
  }
  const requestOptions = { ttl: 15 * 60 * 1000, ...options };
  const details = await fetchJson(detailsUrl, { ...requestOptions,
    validate: payload => gdacsTimelineResource(payload, event) });
  const resource = gdacsTimelineResource(details, event);
  const sourceUrl = safeUrl(details.properties.url?.report) || safeUrl(event.sourceUrl);
  if (!resource) return { history: [], forecast: [], current: null,
    source: 'GDACS', sourceUrl, issuedAt: null, status: 'unavailable',
    message: 'GDACS 该次公告未提供官方路径数据。' };
  const metadata = { eventId: event.gdacs.eventId, source: `GDACS / ${resource.source}`,
    sourceUrl, dataUrl: resource.url };
  const payload = await fetchJson(resource.url, { ...requestOptions,
    validate: value => parseGdacsTimeline(value, metadata) });
  return parseGdacsTimeline(payload, metadata);
}
