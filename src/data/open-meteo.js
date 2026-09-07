import { fetchJson } from './http.js';
import { coordinates, isoTime, metric, number } from './normalize.js';

export const WEATHER_LOCATIONS = Object.freeze([-60, -30, 0, 30, 60].flatMap(lat =>
  Array.from({ length: 12 }, (_, index) => Object.freeze({ lat, lon: -180 + index * 30 }))));
export const WEATHER_COVERAGE = 'Open-Meteo 当前天气模型 · 全球 60 个规则采样点，非连续气象场；降水为来源时间间隔内的累计量。';
export const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: WEATHER_LOCATIONS.map(point => point.lat).join(','),
  longitude: WEATHER_LOCATIONS.map(point => point.lon).join(','),
  current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
  timezone: 'GMT', timeformat: 'unixtime', forecast_days: '1', cell_selection: 'nearest',
})}`;

export function weatherSummary(code) {
  if (code === 0) return '晴';
  if ([1, 2, 3].includes(code)) return ['大致晴朗', '局部多云', '阴'][code - 1];
  if ([45, 48].includes(code)) return '雾';
  if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
  if ([61, 63, 65, 66, 67].includes(code)) return '降雨';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '降雪';
  if ([80, 81, 82].includes(code)) return '阵雨';
  if ([95, 96, 99].includes(code)) return '雷暴';
  return '天气状态未知';
}

const locationName = (lat, lon) => `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`;
const nonnegative = value => { const n = number(value); return n !== null && n >= 0 ? n : null; };
const percentage = value => { const n = nonnegative(value); return n !== null && n <= 100 ? n : null; };

export function parseWeather(payload, locations = WEATHER_LOCATIONS) {
  const records = Array.isArray(payload) ? payload : payload?.current ? [payload] : null;
  if (!records || records.length !== locations.length) throw new Error('Open-Meteo 返回的采样点数量或格式不正确');
  const events = records.flatMap((record, index) => {
    const point = coordinates([record?.longitude, record?.latitude]);
    const current = record?.current;
    const time = isoTime(current?.time, true);
    if (!point || !current || !time) return [];
    const interval = nonnegative(current.interval);
    const weather = {
      temperature: number(current.temperature_2m),
      windSpeed: nonnegative(current.wind_speed_10m),
      windDirection: nonnegative(current.wind_direction_10m),
      precipitation: nonnegative(current.precipitation),
      cloudCover: percentage(current.cloud_cover),
      interval: interval > 0 ? interval : null,
      rain: nonnegative(current.rain),
      humidity: percentage(current.relative_humidity_2m),
      code: number(current.weather_code),
    };
    if (weather.windDirection > 360) weather.windDirection = null;
    const period = weather.interval ? `近 ${weather.interval / 60} 分钟` : '来源时段';
    const requested = locations[index];
    return [{
      id: `weather:${requested.lat}:${requested.lon}`, layer: 'weather',
      title: `${locationName(requested.lat, requested.lon)} · ${weatherSummary(weather.code)}`,
      lon: point[0], lat: point[1], time, source: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/en/docs',
      severity: 'unknown', description: WEATHER_COVERAGE, weather,
      metrics: [
        metric('气温', weather.temperature, '°C'), metric('10 米风速', weather.windSpeed, 'km/h'),
        metric('风向（来向）', weather.windDirection, '°', 0), metric('云量', weather.cloudCover, '%', 0),
        metric(`降水（${period}）`, weather.precipitation, 'mm'), metric(`降雨（${period}）`, weather.rain, 'mm'),
        metric('相对湿度', weather.humidity, '%', 0),
      ].filter(Boolean),
    }];
  });
  if (records.length && !events.length) throw new Error('Open-Meteo 未返回有效的采样位置和时间');
  return events;
}

export async function loadWeather(options = {}) {
  return parseWeather(await fetchJson(WEATHER_URL, { ttl: 15 * 60 * 1000, ...options, validate: parseWeather }));
}
