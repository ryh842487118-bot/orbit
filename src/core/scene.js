import * as THREE from 'three';
import { clamp, smooth } from './math.js';
import { specials } from '../universe/catalog.js';
import { createPlanets } from '../universe/planets.js';
import { createGalaxy } from '../universe/galaxy.js';
import { createSimulation } from '../universe/solar-system.js';
import { createFlybys } from '../universe/flybys.js';
import { galaxyDefinitions, localGroupDefinition, deepSpaceBodyDefinitions } from '../universe/deep-space-catalog.js';
import { createNearbyGalaxies } from '../universe/nearby-galaxies.js';
import { createDeepSpaceBodies } from '../universe/deep-space-bodies.js';

export function createWorld(scene, textures, pixels) {
  const galaxyCenter = new THREE.Vector3(-18000, 0, 0);
  const world = {
    ...createPlanets(scene, textures),
    ...createGalaxy(scene, pixels, galaxyCenter),
    galaxyCenter,
    flybys: createFlybys(scene),
  };
  const milkyWay = { ...specials.galaxy, kind: 'galaxy', radius: 30000, viewDistance: 68000,
    position: galaxyCenter.toArray(), parentId: 'local-group', color: 0xa4cce9, modelStatus: 'confirmed' };
  world.galaxyDefinitions = [milkyWay, ...galaxyDefinitions];
  const destinations = new Map([...Object.values(specials), milkyWay, localGroupDefinition,
    ...galaxyDefinitions].map(destination => [destination.id, destination]));
  // Keep the original solar orbits isolated from the independent distant systems.
  const simulateSolar = createSimulation({ ...world, bodies: new Map(world.bodies) });
  world.nearbyGalaxies = createNearbyGalaxies(scene, pixels, galaxyDefinitions);
  world.deepSpace = createDeepSpaceBodies(scene, textures, deepSpaceBodyDefinitions);
  for (const [id, body] of world.deepSpace.bodies) world.bodies.set(id, body);
  world.starFields = [world.galaxy, world.backgroundStars, ...world.nearbyGalaxies.starFields];
  world.getData = id => world.bodies.get(id) || destinations.get(id);
  world.getPosition = (id, out = new THREE.Vector3()) => {
    if (id === 'galaxy') return out.copy(galaxyCenter);
    if (id === 'solar') return out.set(0, 0, 0);
    if (id === 'iss') return out.copy(world.station.position);
    if (world.bodies.has(id)) return out.copy(world.bodies.get(id).position);
    const destination = destinations.get(id);
    return destination?.position ? out.fromArray(destination.position) : out.set(0, 0, 0);
  };
  world.update = (dt, settings) => {
    simulateSolar(dt, settings);
    world.deepSpace.update(dt, settings);
  };
  return world;
}

export function updateWorldVisibility(world, camera, controls, orbitsVisible, navigationState = {}) {
  const { galaxy, solarMarker, earth, earthSatellites, station, earthOrbitGroup, orbitGroup } = world;
  const dist = camera.position.distanceTo(controls.target);
  const galFade = smooth(1400, 18000, dist);
  galaxy.material.uniforms.uOpacity.value = galFade * .85 * (1 - smooth(120000, 600000, dist) * .55);
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
  world.nearbyGalaxies?.update(camera, { ...navigationState, distance: dist });
  world.deepSpace?.updateVisibility(camera, { ...navigationState, orbitsVisible });
}
