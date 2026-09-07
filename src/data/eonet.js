import { fetchJson } from './http.js';
import { cycloneWind, windSpeedKmh } from './cyclone-wind.js';
import { coordinates, geometryCenter, isoTime, metric, safeUrl, text, uniqueEvents } from './normalize.js';

const CATEGORIES = {
  volcanoes: { layer: 'volcano', label: '火山' }, wildfires: { layer: 'wildfire', label: '山火' },
  floods: { layer: 'flood', label: '洪水' }, severeStorms: { layer: 'typhoon', label: '风暴' },
};
const ALIASES = { volcano: 'volcanoes', wildfire: 'wildfires', flood: 'floods', typhoon: 'severeStorms' };
export const EONET_LIMIT = 100;
export const EONET_COVERAGE = 'NASA EONET 每类最多 100 项公开未关闭事件；事件时间为最近一次来源记录，未关闭不代表刚刚发生。';

function categoryId(category) {
  const id = ALIASES[category] || category;
  if (!CATEGORIES[id]) throw new Error(`不支持的 EONET 类别：${category}`);
  return id;
}

export function eonetUrl(category) {
  return `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=${categoryId(category)}&limit=${EONET_LIMIT}`;
}

export function parseEonet(payload, category) {
  const categoryKey = categoryId(category), config = CATEGORIES[categoryKey];
  if (!Array.isArray(payload?.events)) throw new Error('NASA EONET 返回了无法识别的数据格式');
  return uniqueEvents(payload.events.flatMap(event => {
    const id = text(event?.id);
    if (!id || event.closed || !Array.isArray(event.categories)
      || !event.categories.some(item => item?.id === categoryKey) || !Array.isArray(event.geometry)) return [];
    const observations = event.geometry.flatMap(geometry => {
      const point = geometryCenter(geometry), time = isoTime(geometry?.date);
      return point && time ? [{ point, time, geometry }] : [];
    }).sort((a, b) => a.time.localeCompare(b.time));
    const latest = observations[observations.length - 1];
    if (!latest) return [];
    const sourceUrls = Array.isArray(event.sources) ? event.sources.map(source => safeUrl(source?.url)) : [];
    const track = observations.filter(item => item.geometry.type === 'Point').map(item => coordinates(item.geometry.coordinates));
    const rangeNote = latest.geometry.type === 'Polygon' ? '标记位置为来源范围的示意中心。' : '';
    const sourceUrl = sourceUrls.find(Boolean) || safeUrl(event.link, 'https://eonet.gsfc.nasa.gov/');
    const cyclone = cycloneWind(latest.geometry.magnitudeValue, latest.geometry.magnitudeUnit, 'observation', latest.time);
    const history = observations.filter(item => item.geometry.type === 'Point').map(item => ({
      lon: item.point[0], lat: item.point[1], time: item.time, validTime: item.time,
      windSpeedKmh: windSpeedKmh(item.geometry.magnitudeValue, item.geometry.magnitudeUnit),
      source: 'NASA EONET', sourceUrl,
    }));
    return [{
      id: `eonet:${id}`, layer: config.layer, title: text(event.title, `${config.label}事件`),
      lon: latest.point[0], lat: latest.point[1], time: latest.time, source: 'NASA EONET',
      sourceUrl,
      severity: 'unknown',
      description: `${text(event.description)}${event.description ? ' ' : ''}${rangeNote}${EONET_COVERAGE}`,
      metrics: [
        { label: '事件类别', value: config.label }, { label: '来源状态', value: '未关闭' },
        config.layer === 'typhoon' ? metric('最近记录风速', cyclone.windSpeedKmh, 'km/h')
          : metric('来源记录规模', latest.geometry.magnitudeValue, text(latest.geometry.magnitudeUnit)),
      ].filter(Boolean),
      ...(config.layer === 'typhoon' ? { cyclone, trackData: {
        history, forecast: [], source: 'NASA EONET', sourceUrl, issuedAt: null,
        status: history.length ? 'history-only' : 'unavailable',
        message: 'NASA EONET 提供历史位置记录，未提供官方预测路径。',
      } } : {}),
      ...(config.layer === 'typhoon' && track.length > 1 ? { track } : {}),
    }];
  }));
}

export async function loadEonet(category, options = {}) {
  return parseEonet(await fetchJson(eonetUrl(category), {
    ttl: 15 * 60 * 1000, ...options, validate: payload => parseEonet(payload, category),
  }), category);
}
