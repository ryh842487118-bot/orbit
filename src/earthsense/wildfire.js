import { loadEonet } from '../data/eonet.js';
import { createMarkerLayer } from './markers.js';

export const wildfire = {
  id: 'wildfire', label: '山火', color: '#ff805d', enabled: true, ttl: 15 * 60_000,
  load: options => loadEonet('wildfires', options),
  createView: () => createMarkerLayer({ color: '#ff805d', segments: 4, size: () => .85 }),
};
