import * as THREE from 'three';
import { loadWeather } from '../data/open-meteo.js';
import { createWeatherView } from './effects/weather-view.js';
import { weatherAppearance } from './effects/weather-state.js';

export function temperatureColor(event) {
  const temperature = event.weather?.temperature;
  if (!Number.isFinite(temperature)) return '#a6bacb';
  return new THREE.Color('#64b8ff').lerp(new THREE.Color('#ffd08b'), THREE.MathUtils.clamp((temperature + 15) / 55, 0, 1));
}

export const weather = {
  id: 'weather', label: '天气', color: '#83bded', enabled: true, ttl: 15 * 60_000,
  load: async options => (await loadWeather(options)).map(event => {
    const appearance = weatherAppearance(event);
    return {
    ...event,
    description: `${event.description} 云团轮廓、雨丝与雷暴电弧为依据采样天气生成的示意效果，不是卫星云图或逐次闪电观测。`,
    metrics: [...event.metrics, ...(appearance.rainRate === null ? [] : [{ label: '时段平均雨率', value: `${appearance.rainRate.toFixed(2)} mm/h` }]),
      ...(appearance.thunder ? [{ label: '雷暴光效周期（示意）', value: `约 ${appearance.flashPeriod.toFixed(1)} 秒，不代表实况雷击频率` }] : [])],
    };
  }),
  createView: () => createWeatherView({ colorFor: temperatureColor }),
};
