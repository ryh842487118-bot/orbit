import { loadEonet } from '../data/eonet.js';
import { loadGdacs } from '../data/gdacs.js';
import { combineSources } from './sources.js';
import { createMarkerLayer } from './markers.js';

export const flood = {
  id: 'flood', label: '洪水', color: '#74bcff', enabled: true, ttl: 15 * 60_000,
  load: options => combineSources([['NASA EONET', () => loadEonet('floods', options)], ['GDACS', () => loadGdacs('FL', options)]]),
  createView: () => createMarkerLayer({ color: '#74bcff', segments: 6, size: () => 1.25 }),
};
