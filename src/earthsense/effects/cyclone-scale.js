import { MathUtils } from 'three';

// Visual cloud extent responds to reported km/h. It is not an official wind radius.
export const CYCLONE_SCALE = Object.freeze({ minimum: .055, maximum: .18, unavailable: .075, maximumWindKmh: 280 });

export function cycloneVisualScale(event) {
  const wind = event?.cyclone?.windSpeedKmh;
  const available = Number.isFinite(wind) && wind >= 0;
  const strength = available ? MathUtils.clamp(wind / CYCLONE_SCALE.maximumWindKmh, 0, 1) : null;
  return {
    radius: available ? MathUtils.lerp(CYCLONE_SCALE.minimum, CYCLONE_SCALE.maximum, strength) : CYCLONE_SCALE.unavailable,
    rotationRate: available ? .7 + strength * .7 : .8,
    windSpeedKmh: available ? wind : null,
    windBasis: available ? event.cyclone.windBasis || 'unavailable' : 'unavailable',
  };
}
