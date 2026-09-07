import * as THREE from "three";
import { data } from "./catalog.js";
import { TAU, random } from "../core/math.js";
import { earthMaterial, addSunlight } from "../earth/lighting.js";
import { atmosphere } from "../earth/atmosphere.js";
import { addEarthLayers } from "../earth/earth.js";
import { glow } from "../core/glow.js";
import { makeOrbit } from "./orbits.js";
import { createSatellites } from "./satellites.js";
function createPlanets(scene, textures) {
  const bodies = /* @__PURE__ */ new Map(), unitSphere = new THREE.SphereGeometry(1, 96, 64);
  const orbitGroup = new THREE.Group(), earthOrbitGroup = new THREE.Group(), earthSatellites = new THREE.Group();
  let earth, clouds, sun;
  scene.add(orbitGroup, earthOrbitGroup, earthSatellites);
  addSunlight(scene);
  for (const d of data) {
    const group = new THREE.Group();
    scene.add(group);
    const mat = d.id === "earth" ? earthMaterial(textures) : new THREE.MeshPhongMaterial({ map: textures[d.texture], shininess: d.id === "sun" ? 0 : 8, specular: 1514531 });
    if (d.id === "sun") {
      mat.emissiveMap = textures.sun;
      mat.emissive = new THREE.Color(16759906);
      mat.emissiveIntensity = 2.4;
      mat.color.set(0);
    }
    const mesh = new THREE.Mesh(unitSphere, mat);
    mesh.scale.setScalar(d.r);
    mesh.rotation.y = d.id === "earth" ? 2.9 : random() * TAU;
    group.add(mesh);
    mesh.userData.bodyId = d.id;
    const body = { ...d, group, mesh, position: group.position };
    bodies.set(d.id, body);
    if (d.orbit && d.id !== "moon") {
      const ring = makeOrbit(d.orbit, d.color, d.id === "earth" ? 0.33 : 0.2, d.id === "mercury" ? 0.075 : 0.015);
      ring.userData.baseOpacity = ring.material.opacity;
      orbitGroup.add(ring);
    }
    if (d.id === "earth") {
      earth = body;
      const layers = addEarthLayers(body, unitSphere, textures);
      clouds = layers.clouds;
      body.atmosphere = layers.atmosphere;
    }
    if (d.id === "venus") atmosphere(group, unitSphere, d.r, 14198890, 0.35);
    if (d.id === "mars") atmosphere(group, unitSphere, d.r, 15249559, 0.14);
    if (d.id === "uranus" || d.id === "neptune") atmosphere(group, unitSphere, d.r, d.color, 0.45);
    if (d.id === "sun") {
      sun = body;
      group.add(glow(16756290, 43, 0.45));
      group.add(glow(16765840, 24, 0.55));
    }
    if (d.id === "saturn") {
      const ringGeo = new THREE.RingGeometry(d.r * 1.22, d.r * 2.3, 180, 1);
      const uv = ringGeo.attributes.uv, p = ringGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const rad = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (rad - d.r * 1.22) / (d.r * 1.08), 0.5);
      }
      uv.needsUpdate = true;
      const ringMat = new THREE.MeshPhongMaterial({ map: textures["saturn-rings"], side: THREE.DoubleSide, transparent: true, opacity: 0.97, depthWrite: false, shininess: 0 });
      const rings = new THREE.Mesh(ringGeo, ringMat);
      rings.rotation.x = -Math.PI / 2;
      const tilted = new THREE.Group();
      tilted.rotation.z = 0.466;
      mesh.rotation.z = 0.466;
      tilted.add(rings);
      group.add(tilted);
      body.rings = rings;
    }
    if (d.id === "uranus") mesh.rotation.z = 1.7;
  }
  const moonOrbit = makeOrbit(3.9, 7572387, 0.21, 0.07);
  earthOrbitGroup.add(moonOrbit);
  const { station, satellites } = createSatellites(scene, earthOrbitGroup, earthSatellites);
  return { bodies, earth, clouds, sun, station, satellites, orbitGroup, earthOrbitGroup, earthSatellites };
}
export {
  createPlanets
};
