import * as THREE from 'three';
import { latLonToVector } from '../earth/coordinates.js';

/** Separate source segments stay separate; interpolate on the sphere across the dateline. */
export function createEventPaths(events, color) {
  const positions = [];
  for (const event of events) {
    const paths = [...(event.paths || []), ...(event.track?.length ? [event.track] : [])];
    for (const path of paths) {
      for (let index = 1; index < path.length; index++) {
        const [lon1, lat1] = path[index - 1], [lon2, lat2] = path[index];
        if (![lon1,lat1,lon2,lat2].every(Number.isFinite)) continue;
        const from = latLonToVector(lat1, lon1), to = latLonToVector(lat2, lon2);
        const steps = Math.max(1, Math.ceil(from.angleTo(to) / .015));
        // Implausible source jumps should not draw a line through the globe.
        if (from.dot(to) < -.98) continue;
        let previous = from.clone().multiplyScalar(1.018);
        for (let part = 1; part <= steps; part++) {
          const next = from.clone().lerp(to, part / steps).normalize().multiplyScalar(1.018);
          positions.push(...previous.toArray(), ...next.toArray());
          previous = next;
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: .5, depthWrite: false,
  }));
}
