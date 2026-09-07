import { loadEonet } from '../data/eonet.js';
import { loadGdacs } from '../data/gdacs.js';
import { combineSources } from './sources.js';
import { createCycloneLayer } from './effects/cyclone.js';

function stormName(title) {
  return title.toLowerCase().replace(/tropical|cyclone|hurricane|typhoon|storm|\d{4}|[^a-z]/g, '');
}

export async function loadStorms(options) {
  const result = await combineSources([
    ['GDACS', () => loadGdacs('TC', options)],
    ['NASA EONET', () => loadEonet('severeStorms', options)],
  ]);
  const gdacs = result.events.filter(event => event.source === 'GDACS');
  result.events = result.events.filter(event => event.source === 'GDACS' || !gdacs.some(other => {
    const name = stormName(event.title), otherName = stormName(other.title);
    return name.length > 2 && otherName.length > 2 && (name.includes(otherName) || otherName.includes(name));
  }));
  result.events = result.events.map(event => ({ ...event,
    description: `${event.description || ''} 气旋云带、风眼与动画按事件位置生成，用于示意；不表示卫星实况云图或官方风圈范围。`,
  }));
  return result;
}

export const typhoon = {
  id: 'typhoon', label: '台风', color: '#c2a5fb', enabled: true, ttl: 15 * 60_000,
  load: loadStorms,
  createView: createCycloneLayer,
};
