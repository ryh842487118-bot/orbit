import * as THREE from 'three';
import { createJWST } from '../universe/jwst.js';
import { createVoyager } from '../universe/voyager.js';
import { clamp, smooth } from './math.js';
import { specials } from '../universe/catalog.js';
import { createPlanets } from '../universe/planets.js';
import { createGalaxy } from '../universe/galaxy.js';
import { createSimulation } from '../universe/solar-system.js';
import { createFlybys } from '../universe/flybys.js';
import { galaxyDefinitions, localGroupDefinition, deepSpaceBodyDefinitions } from '../universe/deep-space-catalog.js';
import { createNearbyGalaxies } from '../universe/nearby-galaxies.js';
import { createDeepSpaceBodies } from '../universe/deep-space-bodies.js';
import { createMotionTrajectories } from '../universe/motion-trajectories.js';
import { trajectoryAnchor, trajectoryDefinition } from '../universe/trajectory-catalog.js';

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
  const destinations = new Map([...Object.values(specials), milkyWay, localGroupDefinition, trajectoryDefinition,
    ...galaxyDefinitions].map(destination => [destination.id, destination]));
  // Keep the original solar orbits isolated from the independent distant systems.
  world.solarBodies = new Map(world.bodies);
  const simulateSolar = createSimulation({ ...world, bodies: world.solarBodies });
  world.jwst = createJWST(scene, world.earth);
  world.bodies.set('jwst', world.jwst.body);
  world.voyager = createVoyager(scene);
  world.bodies.set(world.voyager.body.id, world.voyager.body);
  world.motionTrajectories = createMotionTrajectories(scene, textures, pixels);
  world.motionTrajectories.group.position.fromArray(trajectoryAnchor);
  world.nearbyGalaxies = createNearbyGalaxies(scene, pixels, galaxyDefinitions);
  world.deepSpace = createDeepSpaceBodies(scene, textures, deepSpaceBodyDefinitions);
  for (const [id, body] of world.deepSpace.bodies) world.bodies.set(id, body);
  world.starFields = [world.galaxy, world.backgroundStars, ...world.nearbyGalaxies.starFields];
  world.getData = id => world.bodies.get(id) || destinations.get(id);
  world.getPosition = (id, out = new THREE.Vector3()) => {
    if (id === 'galaxy') return out.copy(galaxyCenter);
    if (id === 'solar') return out.set(0, 0, 0);
    if (id === 'trajectory') {
      world.motionTrajectories.getCenter(out).add(world.motionTrajectories.group.position);
      // Lift the paths above the caption and playback controls in either layout.
      out.y -= 24;
      return out;
    }
    if (id === 'iss') return out.copy(world.station.position);
    if (world.bodies.has(id)) return out.copy(world.bodies.get(id).position);
    const destination = destinations.get(id);
    return destination?.position ? out.fromArray(destination.position) : out.set(0, 0, 0);
  };
  world.update = (dt, settings) => {
    simulateSolar(dt, settings);
    world.jwst.update(dt, settings);
    world.voyager.update(dt, settings);
    world.deepSpace.update(dt, settings);
  };
  return world;
}

export function updateWorldVisibility(world, camera, controls, orbitsVisible, navigationState = {}) {
  const { galaxy, solarMarker, earth, earthSatellites, station, earthOrbitGroup, orbitGroup } = world;
  const dist = camera.position.distanceTo(controls.target);
  const trajectory = navigationState.stage === 'trajectory';
  const showSolar = !trajectory || navigationState.flight;
  world.jwst.body.group.visible = showSolar;
  world.voyager.updateVisibility(camera, { ...navigationState, orbitsVisible });
  for (const body of world.solarBodies.values()) body.group.visible = showSolar;
  const galFade = smooth(1400, 18000, dist);
  galaxy.material.uniforms.uOpacity.value = galFade * .85 * (1 - smooth(120000, 600000, dist) * .55);
  galaxy.visible = showSolar && galFade > .001;
  solarMarker.visible = showSolar && dist > 2700;
  solarMarker.material.opacity = galFade * .8;
  solarMarker.scale.setScalar(clamp(dist * .01, 60, 1200));
  const earthDistance = camera.position.distanceTo(earth.position);
  earthSatellites.visible = showSolar && earthDistance < 70;
  station.visible = showSolar && earthDistance < 150;
  earthOrbitGroup.visible = showSolar && orbitsVisible && earthDistance < 60;
  orbitGroup.visible = !trajectory && orbitsVisible && dist > 8 && dist < 11000;
  const orbitFade = smooth(8, 35, dist) * (1 - smooth(1200, 11000, dist));
  for (const line of orbitGroup.children) line.material.opacity = line.userData.baseOpacity * orbitFade;
  world.nearbyGalaxies?.update(camera, { ...navigationState, distance: dist,
    stage: trajectory && navigationState.flight ? dist > 200000 ? 'local-group' : dist > 2600 ? 'galaxy' : 'solar'
      : navigationState.stage,
  });
  world.deepSpace?.updateVisibility(camera, { ...navigationState, orbitsVisible });
  if (trajectory && !navigationState.flight) {
    for (const body of world.deepSpace.bodies.values()) body.group.visible = false;
    for (const line of world.deepSpace.orbitLines) line.visible = false;
  }
}
