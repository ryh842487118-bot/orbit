import { number, text } from './normalize.js';

// EONET reports sustained wind in kts; GDACS list maxima use km/h and
// its advisory timeline uses m/s. Unknown units must never become km/h.
export function windSpeedKmh(value, unit) {
  const speed = number(value);
  const factor = { 'km/h': 1, kmh: 1, kph: 1, 'm/s': 3.6, ms: 3.6,
    kt: 1.852, kts: 1.852, knot: 1.852, knots: 1.852, mph: 1.609344 }[
    text(unit).toLowerCase().replace(/\s/g, '')];
  if (speed === null || speed < 0 || !factor) return null;
  const converted = speed * factor;
  return converted <= 500 ? converted : null;
}

export function cycloneWind(value, unit, windBasis, validTime = null) {
  const speed = windSpeedKmh(value, unit);
  return { windSpeedKmh: speed, windBasis: speed === null ? 'unavailable' : windBasis,
    validTime: speed === null || windBasis !== 'observation' ? null : validTime };
}
