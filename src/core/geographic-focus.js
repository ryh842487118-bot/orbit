import { latLonToVector } from '../earth/coordinates.js';

/** Match the existing Earth equirectangular texture: Greenwich +X, 90° E −Z. */
export function earthSurfaceDirection(earth, { lat, lon }) {
  const surface = latLonToVector(lat, lon);
  earth.mesh.updateWorldMatrix(true, false);
  return earth.mesh.localToWorld(surface).sub(earth.position).normalize();
}
