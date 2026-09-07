import * as THREE from "three";
import { TAU } from "../core/math.js";
function createSimulation(world) {
  const { bodies, earth, clouds, station, satellites, earthOrbitGroup, earthSatellites } = world;
  let simTime = 0;
  const temp = new THREE.Vector3();
  return function update(dt, { paused, speed }) {
    if (!paused) simTime += dt * speed;
    for (const b of bodies.values()) {
      if (b.id === "moon") continue;
      if (b.orbit) {
        const a2 = (b.phase || 0) + simTime * TAU / b.period * 0.55;
        const inclination = b.id === "mercury" ? 0.075 : 0.015;
        b.position.set(Math.cos(a2) * b.orbit, Math.sin(a2) * b.orbit * Math.sin(inclination), Math.sin(a2) * b.orbit * Math.cos(inclination));
      }
      if (!paused) b.mesh.rotation.y += dt * speed * (b.id === "sun" ? 0.015 : b.id === "earth" ? 0.035 : 0.025);
    }
    const moon = bodies.get("moon"), ma = moon.phase + simTime * 0.12;
    moon.position.copy(earth.position).add(temp.set(Math.cos(ma) * 3.9, Math.sin(ma) * 3.9 * Math.sin(0.07), Math.sin(ma) * 3.9 * Math.cos(0.07)));
    earthOrbitGroup.position.copy(earth.position);
    earthSatellites.position.copy(earth.position);
    if (!paused) clouds.rotation.y += dt * speed * 0.04;
    const a = simTime * 0.16 + 2.35;
    station.position.copy(earth.position).add(temp.set(Math.cos(a) * 1.33, Math.sin(a) * 1.33 * Math.sin(0.55), Math.sin(a) * 1.33 * Math.cos(0.55)));
    if (!paused) station.rotation.y += dt * speed * 0.016;
    for (const sat of satellites) {
      const a2 = sat.phase + simTime * sat.velocity;
      sat.group.position.set(Math.cos(a2) * sat.r, 0, Math.sin(a2) * sat.r).applyQuaternion(sat.quat);
      sat.group.quaternion.copy(sat.quat);
      sat.group.rotateY(-a2);
    }
  };
}
export {
  createSimulation
};
