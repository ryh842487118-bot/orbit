import { loadEarthquakes } from '../data/usgs.js';
import { createMarkerLayer } from './markers.js';

export const earthquake = {
  id: 'earthquake', label: '地震', color: '#ffb578', enabled: true, ttl: 5 * 60_000,
  load: loadEarthquakes,
  createView: () => createMarkerLayer({
    color: '#ffb578', size: event => event.severity === 'high' ? 1.6 : event.severity === 'medium' ? 1.2 : .8,
  }),
};
