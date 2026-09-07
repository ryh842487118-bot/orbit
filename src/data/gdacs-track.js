import { coordinates, isoTime, number, safeUrl, text } from './normalize.js';
import { windSpeedKmh } from './cyclone-wind.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const truth = value => value === true || String(value).toLowerCase() === 'true';
const falsity = value => value === false || String(value).toLowerCase() === 'false';

// The GDACS timeline uses "DD Mon YYYY HH:mm" in UTC. Parse explicitly so
// browser locale/timezone cannot shift observed or forecast positions.
export function gdacsTrackTime(value) {
  const match = text(value).match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return isoTime(value);
  const [, day, monthName, year, hour, minute] = match;
  const month = MONTHS.findIndex(item => item.toLowerCase() === monthName.toLowerCase()) + 1;
  if (!month) return null;
  return isoTime(`${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}T${hour}:${minute}:00Z`);
}

export function gdacsEpisodeUrl(event) {
  const id = number(event?.gdacs?.eventId), episode = number(event?.gdacs?.episodeId);
  return Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(episode) && episode > 0
    ? `https://www.gdacs.org/gdacsapi/api/events/getepisodedata?eventtype=TC&eventid=${id}&episodeid=${episode}` : null;
}

export function gdacsTimelineResource(payload, event) {
  const props = payload?.properties;
  if (payload?.type !== 'Feature' || props?.eventtype !== 'TC'
    || number(props.eventid) !== number(event?.gdacs?.eventId)
    || number(props.episodeid) !== number(event?.gdacs?.episodeId)) {
    throw new Error('GDACS 返回了不匹配的台风公告');
  }
  const resources = (Array.isArray(props.impacts) ? props.impacts : []).flatMap(item => {
    const safe = safeUrl(item?.resource?.timeline);
    if (!safe) return [];
    const url = new URL(safe);
    if (url.origin !== 'https://www.gdacs.org'
      || url.pathname.toLowerCase() !== '/gdacsapi/api/export/gettimeline'
      || !/^\d+$/.test(url.searchParams.get('id') || '')) return [];
    return [{ url: safe, source: text(item.source, text(props.source, 'GDACS')) }];
  });
  return resources.find(item => item.source === props.source) || resources[0] || null;
}

export function parseGdacsTimeline(payload, { eventId, source, sourceUrl, dataUrl } = {}) {
  if (!Array.isArray(payload?.channel?.item)) throw new Error('GDACS 返回了无法识别的台风路径格式');
  const history = new Map(), forecast = new Map(), currentPoints = [];
  for (const item of payload.channel.item) {
    if (eventId != null && String(item?.storm_id) !== String(eventId)) continue;
    const position = coordinates([item?.longitude, item?.latitude]);
    const time = gdacsTrackTime(item?.advisory_datetime);
    const observed = truth(item?.actual), predicted = falsity(item?.actual);
    if (!position || !time || (!observed && !predicted)) continue;
    const point = { lon: position[0], lat: position[1], time, validTime: time,
      windSpeedKmh: windSpeedKmh(item.wind_speed, 'm/s'),
      source, sourceUrl, advisoryNumber: text(item.advisory_number) };
    const key = `${observed ? '' : point.advisoryNumber}:${time}:${point.lon}:${point.lat}`;
    (observed ? history : forecast).set(key, point);
    if (observed && truth(item.current)) currentPoints.push(point);
  }
  const chronological = points => [...points].sort((a, b) => a.time.localeCompare(b.time));
  const current = chronological(currentPoints).at(-1) || null;
  // A timeline is cumulative. Only the current advisory's explicit forecast
  // rows belong to its forecast. Without that explicit anchor, old forecast
  // rows cannot safely be attributed to this issue; keep observations only.
  const hasForecastAnchor = Boolean(current?.advisoryNumber);
  const predictions = hasForecastAnchor ? chronological(forecast.values()).filter(point =>
    point.time > current.time && point.advisoryNumber === current.advisoryNumber) : [];
  const observations = chronological(history.values());
  return { history: observations, forecast: predictions, current, source, sourceUrl, dataUrl,
    issuedAt: current?.time || null,
    status: predictions.length ? 'ready' : observations.length ? 'history-only' : 'unavailable',
    message: predictions.length ? '预测路径来自该次官方公告；有效时间以各预测点标注为准。'
      : forecast.size && !hasForecastAnchor ? '该次公告缺少明确的当前观测点或公告编号，暂不展示预测路径。'
      : observations.length ? '该次官方公告未提供预测路径。' : '该次官方公告未提供可用的路径点。' };
}
