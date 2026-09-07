import * as THREE from "three";
import { random, TAU } from "../core/math.js";
import { makeOrbit } from "./orbits.js";
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cylinder(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
  m.rotation.z = Math.PI / 2;
  return m;
}
function createSatellites(scene, earthOrbitGroup, earthSatellites) {
  const satellites = [];
  let station;
  const metal = new THREE.MeshStandardMaterial({ color: 13093840, roughness: 0.45, metalness: 0.65 });
  const foil = new THREE.MeshStandardMaterial({ color: 14662770, roughness: 0.5, metalness: 0.6 });
  const panel = new THREE.MeshStandardMaterial({ color: 2313849, roughness: 0.32, metalness: 0.52, emissive: 1059151, emissiveIntensity: 0.3 });
  for (let i = 0; i < 32; i++) {
    const g = new THREE.Group(), r = 1.16 + random() * 0.6;
    g.add(box(0.026, 0.027, 0.023, i % 3 ? metal : foil));
    g.add(box(0.075, 2e-3, 0.034, panel, -0.053));
    g.add(box(0.075, 2e-3, 0.034, panel, 0.053));
    g.add(box(0.135, 3e-3, 4e-3, metal));
    earthSatellites.add(g);
    const inclination = 0.25 + random() * 2.5, ascending = random() * TAU, phase = random() * TAU;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(inclination, ascending, 0));
    satellites.push({ group: g, r, quat, phase, velocity: (0.1 + random() * 0.1) * (i % 3 === 0 ? -1 : 1) });
    if (i < 7) {
      const path = makeOrbit(r, 6331322, 0.12);
      path.quaternion.copy(quat);
      earthOrbitGroup.add(path);
    }
  }
  station = new THREE.Group();
  const truss = box(0.44, 0.013, 0.013, metal);
  station.add(truss);
  station.add(cylinder(0.021, 0.2, metal));
  const main = cylinder(0.027, 0.105, metal);
  main.rotation.y = Math.PI / 2;
  main.position.z = 0.038;
  station.add(main);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.116;
    for (const z of [-0.1, 0.1]) {
      const p = box(0.085, 3e-3, 0.135, panel, x, 0, z);
      station.add(p);
      for (let s = 0; s < 6; s++) station.add(box(8e-4, 4e-3, 0.135, metal, x - 0.038 + s * 0.015, 0, z));
    }
    station.add(box(7e-3, 7e-3, 0.35, metal, x));
  }
  station.add(box(0.035, 0.027, 0.055, foil, 0.11, 0.016, 0.02));
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 5866140, metalness: 0.75, roughness: 0.15 }));
  cupola.position.set(-0.015, 0.027, 0.065);
  station.add(cupola);
  station.rotation.set(0.22, 0.35, 0.18);
  scene.add(station);
  const stationOrbit = makeOrbit(1.33, 8968650, 0.3, 0.55);
  earthOrbitGroup.add(stationOrbit);
  return { station, satellites };
}
export {
  createSatellites
};
