import { fetchJson } from './http.js';
import { coordinates, featureCollection, isoTime, metric, number, safeUrl, severityFromAlert, text, uniqueEvents } from './normalize.js';

export const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
export const USGS_COVERAGE = 'USGS 最近 24 小时公开地震目录；震级与位置可能随来源审核更新。';

export function parseEarthquakes(payload) {
  const features = featureCollection(payload, 'USGS');
  const events = features.flatMap(feature => {
    const props = feature?.properties;
    const point = feature?.geometry?.type === 'Point' ? coordinates(feature.geometry.coordinates) : null;
    const time = isoTime(props?.time);
    const id = text(feature?.id);
    if (!props || !point || !time || !id || (props.type && props.type !== 'earthquake')) return [];
    const magnitude = number(props.mag), depth = number(feature.geometry.coordinates[2]);
    const alertSeverity = severityFromAlert(props.alert);
    return [{
      id: `usgs:${id}`, layer: 'earthquake', title: text(props.title, text(props.place, '地震事件')),
      lon: point[0], lat: point[1], time, source: 'USGS',
      sourceUrl: safeUrl(props.url, 'https://earthquake.usgs.gov/earthquakes/map/'),
      severity: alertSeverity !== 'unknown' ? alertSeverity : magnitude === null ? 'unknown'
        : magnitude >= 6 ? 'high' : magnitude >= 4 ? 'medium' : 'low',
      description: `${text(props.place)}${props.place ? '。' : ''}${USGS_COVERAGE}`,
      metrics: [
        metric(`震级${props.magType ? `（${text(props.magType)}）` : ''}`, magnitude), metric('震源深度', depth, 'km'),
        props.status ? { label: '目录状态', value: props.status === 'reviewed' ? '已审核' : props.status === 'automatic' ? '自动测定' : text(props.status) } : null,
        props.alert ? { label: 'USGS 影响评估', value: text(props.alert) } : null,
      ].filter(Boolean),
    }];
  });
  return uniqueEvents(events);
}

export async function loadEarthquakes(options = {}) {
  return parseEarthquakes(await fetchJson(USGS_URL, { ttl: 5 * 60 * 1000, ...options, validate: parseEarthquakes }));
}
