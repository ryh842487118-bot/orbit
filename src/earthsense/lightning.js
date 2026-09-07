import { createWeatherView } from './effects/weather-view.js';
import { weatherAppearance } from './effects/weather-state.js';

// Replace this provider with a licensed lightning feed when one is available.
// These locations demonstrate interaction only and never represent observed strikes.
export async function loadSimulatedLightning() {
  const rates = [.6, 4, 16, 1.5, 8, 32], intervals = [900, 3600, 1800, 3600, 900, 1800];
  const labels = ['小雨', '中雨', '大雨', '小雨', '中雨', '大雨'];
  return [[-3, 24], [-4, -61], [3, 108], [24, -83], [9, 13], [15, 100]].map(([lat, lon], index) => {
    const interval = intervals[index], amount = rates[index] * interval / 3600;
    const event = {
      id: `simulated-lightning-${index}`, layer: 'lightning', title: `模拟闪电 · ${labels[index]}示意`, lat, lon,
      time: null, source: '模拟数据', sourceUrl: null, severity: 'unknown', simulated: true,
      weather: { rain: amount, precipitation: amount, interval, code: 95, cloudCover: 100 },
      description: '云团、降雨、云内辉光与分叉闪电为模拟天气效果，不代表此处正在发生雷暴。实时数据接口已预留。',
    };
    const appearance = weatherAppearance(event, true);
    event.metrics = [
      { label: '数据类型', value: '模拟 · 非实况' },
      { label: '模拟降雨强度', value: `${labels[index]}示意` },
      { label: '模拟雨率', value: `${appearance.rainRate.toFixed(1)} mm/h` },
      { label: '模拟累计雨量', value: `${amount.toFixed(2)} mm / ${interval / 60} 分钟` },
      { label: '闪现示意节奏', value: `约每 ${appearance.flashPeriod.toFixed(1)} 秒一组光效（非实况雷击频率）` },
    ];
    return event;
  });
}

export const lightning = {
  id: 'lightning', label: '闪电', color: '#f3e7a1', enabled: true, ttl: Infinity,
  load: loadSimulatedLightning,
  createView: () => createWeatherView({ simulatedStorm: true }),
};
