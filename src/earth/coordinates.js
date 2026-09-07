import * as THREE from 'three';

// SphereGeometry's equirectangular UVs: Greenwich is +X, 90° east is -Z.
// Keep overlays in the Earth mesh's local space so texture and data rotate together.
export function latLonToVector(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(lat);
  const theta = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    -radius * Math.cos(phi) * Math.sin(theta),
  );
}

export function vectorToLatLon(vector) {
  const direction = vector.clone().normalize();
  return {
    lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))),
    lon: THREE.MathUtils.radToDeg(Math.atan2(-direction.z, direction.x)),
  };
}
