import * as THREE from 'three';
import { clamp, smooth } from './math.js';
import { specials } from '../universe/catalog.js';
import { createPlanets } from '../universe/planets.js';
import { createGalaxy } from '../universe/galaxy.js';
import { createSimulation } from '../universe/solar-system.js';

export function createWorld(scene, textures, pixels) {
  const galaxyCenter = new THREE.Vector3(-18000, 0, 0);
  const world = {
    ...createPlanets(scene, textures),
    ...createGalaxy(scene, pixels, galaxyCenter),
    galaxyCenter,
  };
  world.getData = id => world.bodies.get(id) || specials[id];
  world.getPosition = (id, out = new THREE.Vector3()) => {
    if (id === 'galaxy') return out.copy(galaxyCenter);
    if (id === 'solar') return out.set(0, 0, 0);
    if (id === 'iss') return out.copy(world.station.position);
    return out.copy(world.bodies.get(id).position);
  };
  world.update = createSimulation(world);
  return world;
}

export function updateWorldVisibility(world, camera, controls, orbitsVisible) {
  const { galaxy, solarMarker, earth, earthSatellites, station, earthOrbitGroup, orbitGroup } = world;
  const dist = camera.position.distanceTo(controls.target);
  const galFade = smooth(1400, 18000, dist);
  galaxy.material.uniforms.uOpacity.value = galFade * .85;
  galaxy.visible = galFade > .001;
  solarMarker.visible = dist > 2700;
  solarMarker.material.opacity = galFade * .8;
  solarMarker.scale.setScalar(clamp(dist * .01, 60, 1200));
  const earthDistance = camera.position.distanceTo(earth.position);
  earthSatellites.visible = earthDistance < 70;
  station.visible = earthDistance < 150;
  earthOrbitGroup.visible = orbitsVisible && earthDistance < 60;
  orbitGroup.visible = orbitsVisible && dist > 8 && dist < 11000;
  const orbitFade = smooth(8, 35, dist) * (1 - smooth(1200, 11000, dist));
  for (const line of orbitGroup.children) line.material.opacity = line.userData.baseOpacity * orbitFade;
}
