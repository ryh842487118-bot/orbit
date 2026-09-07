import * as THREE from "three";
import { TAU } from "../core/math.js";
function makeOrbit(radius, color = 6650253, opacity = 0.26, tilt = 0) {
  const points = [];
  for (let i = 0; i <= 256; i++) {
    const a = i / 256 * TAU;
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * Math.sin(tilt), Math.sin(a) * radius * Math.cos(tilt)));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}
export {
  makeOrbit
};
