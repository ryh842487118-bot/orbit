import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { data, specials } from '../src/universe/catalog.js';
import { galaxyDefinitions, localGroupDefinition, deepSpaceBodyDefinitions } from '../src/universe/deep-space-catalog.js';
import { createDeepSpaceBodies } from '../src/universe/deep-space-bodies.js';
import { createEarthSession } from '../src/earthsense/session.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation } = await import('../src/core/camera.js');

const milkyWay = {
  ...specials.galaxy, kind: 'galaxy', radius: 30000, viewDistance: 68000,
  position: [-18000, 0, 0], parentId: 'local-group',
};
const galaxies = [milkyWay, ...galaxyDefinitions];
const destinations = new Map([
  ...Object.values(specials), ...galaxies, localGroupDefinition,
].map(definition => [definition.id, definition]));

function near(actual, expected, message, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

function fixture(context) {
  const scene = new THREE.Scene();
  const deepSpace = createDeepSpaceBodies(scene, null, deepSpaceBodyDefinitions);
  context.after(() => deepSpace.dispose());
  const bodies = new Map(data.map(definition => [definition.id, {
    ...definition,
    position: new THREE.Vector3(
      Math.cos(definition.phase || 0) * definition.orbit,
      0,
      Math.sin(definition.phase || 0) * definition.orbit,
    ),
  }]));
  const earth = bodies.get('earth');
  earth.group = new THREE.Group();
  earth.group.position.copy(earth.position);
  earth.position = earth.group.position;
  earth.mesh = new THREE.Object3D();
  earth.group.add(earth.mesh);
  bodies.get('moon').position.add(earth.position);
  for (const [id, body] of deepSpace.bodies) bodies.set(id, body);
  const station = { position: earth.position.clone().add(new THREE.Vector3(-.9, .5, .9)) };
  const world = {
    bodies, earth, station, deepSpace, galaxyDefinitions: galaxies,
    getData: id => bodies.get(id) || destinations.get(id),
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'solar') return out.set(0, 0, 0);
      if (id === 'iss') return out.copy(station.position);
      if (bodies.has(id)) return out.copy(bodies.get(id).position);
      return out.fromArray(destinations.get(id).position);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, 1.6, .001, 4000000);
  const controls = {
    target: new THREE.Vector3(), minDistance: 1.13, maxDistance: 2000000,
    enabled: true, update() {},
  };
  const info = [], stages = [];
  const navigation = createNavigation({
    camera, controls, world,
    onInfo: id => info.push(id), onStage: stage => stages.push(stage), toast() {},
  });
  navigation.initialize();
  function arrive(id) {
    navigation.flyTo(id, { immediate: true });
    navigation.update(0, performance.now() + 2, () => {});
    navigation.updateStage();
  }
  function setDistance(distance) {
    navigation.zoom(distance / navigation.getState().distance);
    navigation.update(1, performance.now() + 2, () => {});
    navigation.updateStage();
  }
  return { scene, world, camera, controls, navigation, info, stages, arrive, setDistance };
}

test('deep-space catalog has unique identities, complete parent chains and honest planet status', () => {
  const all = [...data, ...Object.values(specials), ...galaxyDefinitions,
    localGroupDefinition, ...deepSpaceBodyDefinitions];
  const ids = all.map(definition => definition.id);
  assert.equal(new Set(ids).size, ids.length);
  const lookup = new Map([...all, milkyWay].map(definition => [definition.id, definition]));
  for (const definition of [...galaxyDefinitions, localGroupDefinition, ...deepSpaceBodyDefinitions]) {
    assert.equal(definition.position.length, 3, definition.id);
    assert.ok(definition.position.every(Number.isFinite), definition.id);
    assert.ok(definition.r > 0, definition.id);
    assert.equal(new URL(definition.sourceUrl).protocol, 'https:');
    assert.ok(['confirmed', 'candidate', 'illustration'].includes(definition.modelStatus));
    const ancestors = new Set([definition.id]);
    let current = definition;
    while (current.parentId) {
      assert.ok(lookup.has(current.parentId), `${current.id} parent exists`);
      assert.ok(!ancestors.has(current.parentId), `${definition.id} has no parent cycle`);
      ancestors.add(current.parentId);
      current = lookup.get(current.parentId);
    }
  }
  const planets = deepSpaceBodyDefinitions.filter(body => body.kind === 'planet');
  assert.deepEqual(planets.filter(body => body.modelStatus === 'confirmed').map(body => body.id).sort(),
    ['hr8799-b', 'hr8799-c', 'hr8799-d', 'hr8799-e']);
  for (const planet of planets) {
    const host = lookup.get(planet.parentStarId);
    assert.equal(host.kind, 'star');
    assert.equal(planet.parentId, host.id);
    assert.equal(planet.parentGalaxy, host.parentGalaxy);
    if (planet.parentGalaxy !== 'galaxy') {
      assert.equal(planet.modelStatus, 'illustration');
      assert.match(planet.cn, /示意/);
      assert.match(planet.type, /虚构/);
      assert.match(planet.desc, /虚构/);
      assert.match(planet.sourceLabel, /虚构示意/);
    }
  }
  for (const galaxy of galaxies) {
    assert.ok(deepSpaceBodyDefinitions.some(body => body.kind === 'star' && body.parentGalaxy === galaxy.id));
    assert.ok(planets.some(body => body.parentGalaxy === galaxy.id));
  }
});

test('every new destination completes a flight at its real scene position and expected context', async context => {
  for (const definition of [...galaxies, localGroupDefinition, ...deepSpaceBodyDefinitions]) {
    await context.test(definition.id, t => {
      const { navigation, controls, world, info, arrive } = fixture(t);
      arrive(definition.id);
      const state = navigation.getState();
      const distance = definition.kind === 'group' || definition.kind === 'galaxy'
        ? definition.viewDistance : definition.r * (definition.kind === 'star' ? 5.5 : 4.65);
      near(state.distance, distance, 'arrival distance');
      near(controls.target.distanceTo(world.getPosition(definition.id)), 0, 'arrival target');
      assert.equal(state.selected, definition.id);
      assert.equal(state.displayedId, definition.id);
      assert.equal(state.flight, false);
      assert.equal(controls.enabled, true);
      assert.equal(info.at(-1), definition.id);
      if (definition.kind === 'group') assert.equal(state.stage, 'local-group');
      else if (definition.kind === 'galaxy') {
        assert.equal(state.activeGalaxyId, definition.id);
        assert.equal(state.stage, 'galaxy');
      } else {
        assert.equal(state.activeGalaxyId, definition.parentGalaxy);
        assert.equal(state.activeSystemId,
          definition.kind === 'star' ? definition.id : definition.parentStarId);
        assert.equal(state.focusBody, definition.id);
      }
    });
  }
});

test('foreign galaxy overviews stay centered while their independent planetary systems move', async context => {
  for (const galaxy of galaxyDefinitions) {
    await context.test(galaxy.id, t => {
      const { navigation, camera, controls, world, arrive } = fixture(t);
      arrive(galaxy.id);
      const originalCamera = camera.position.clone();
      for (let frame = 0; frame < 120; frame++) {
        navigation.update(1 / 60, performance.now() + frame, dt => world.deepSpace.update(dt, { speed: 20 }));
        navigation.updateStage();
      }
      near(controls.target.distanceTo(world.getPosition(galaxy.id)), 0, 'overview center remains fixed');
      near(camera.position.distanceTo(originalCamera), 0, 'overview camera remains fixed');
      assert.equal(navigation.getState().displayedId, galaxy.id);
    });
  }
});

test('close views follow each moving foreign planet without slipping at 1× and 20×', async context => {
  const planets = deepSpaceBodyDefinitions.filter(body => body.kind === 'planet' && body.parentGalaxy !== 'galaxy');
  for (const planet of planets) {
    for (const speed of [1, 20]) {
      await context.test(`${planet.id} at ${speed}×`, t => {
        const { navigation, camera, controls, world, arrive } = fixture(t);
        arrive(planet.id);
        const body = world.bodies.get(planet.id);
        const original = body.position.clone();
        const viewOffset = camera.position.clone().sub(body.position);
        let calls = 0;
        for (let frame = 0; frame < 90; frame++) {
          navigation.update(1 / 60, performance.now() + frame, dt => {
            calls++;
            world.deepSpace.update(dt, { speed });
          });
          near(controls.target.distanceTo(body.position), 0, 'target follows the current planet position');
          near(camera.position.clone().sub(body.position).distanceTo(viewOffset), 0, 'camera follows the same displacement');
        }
        assert.equal(calls, 90);
        assert.ok(body.position.distanceTo(original) > 1, 'planet really moved during the test');
        const stopped = camera.position.clone();
        navigation.update(.5, performance.now() + 2000, dt => world.deepSpace.update(dt, { paused: true, speed }));
        near(camera.position.distanceTo(stopped), 0, 'pausing stops the tracked view');
      });
    }
  }
});

test('zoom changes context from a foreign planet through its star and galaxy to the Local Group', context => {
  const { navigation, world, info, arrive, setDistance } = fixture(context);
  const planet = world.bodies.get('andromeda-giant-demo');
  arrive(planet.id);
  assert.equal(navigation.getState().displayedId, planet.id);
  setDistance(500);
  assert.equal(navigation.getState().displayedId, planet.parentStarId);
  assert.equal(navigation.getState().stage, 'solar');
  setDistance(40000);
  assert.equal(navigation.getState().displayedId, planet.parentGalaxy);
  assert.equal(navigation.getState().activeGalaxyId, planet.parentGalaxy);
  assert.equal(navigation.getState().stage, 'galaxy');
  setDistance(820000);
  assert.equal(navigation.getState().displayedId, 'local-group');
  assert.equal(navigation.getState().stage, 'local-group');
  assert.deepEqual(info.slice(-4), [planet.id, planet.parentStarId, planet.parentGalaxy, 'local-group']);
});

test('returning from another galaxy restores solar and Earth navigation context', context => {
  const { navigation, controls, world, arrive } = fixture(context);
  arrive('smc-giant-demo');
  arrive('solar');
  let state = navigation.getState();
  assert.equal(state.activeGalaxyId, 'galaxy');
  assert.equal(state.activeSystemId, 'solar');
  assert.equal(state.displayedId, 'solar');
  near(controls.target.length(), 0, 'solar center');
  near(state.distance, 650, 'solar distance');
  arrive('earth');
  state = navigation.getState();
  assert.equal(state.focusBody, 'earth');
  assert.equal(state.activeGalaxyId, 'galaxy');
  assert.equal(state.activeSystemId, 'solar');
  near(controls.target.distanceTo(world.earth.position), 0, 'Earth target');
  near(state.distance, 4.65, 'Earth distance');
});

test('returning from a Milky Way star to the Solar System makes zooming in focus Earth', async context => {
  for (const id of ['hr8799', 'betelgeuse']) {
    await context.test(id, t => {
      const { navigation, controls, world, arrive, setDistance } = fixture(t);
      arrive(id);
      assert.equal(navigation.getState().activeGalaxyId, 'galaxy');
      assert.equal(navigation.getState().focusBody, id);
      arrive('solar');
      assert.equal(navigation.getState().activeSystemId, 'solar');
      assert.equal(navigation.getState().focusBody, 'earth');

      // Zoom through the normal scale transition; no explicit Earth flight
      // should be required to stop following the previous distant star.
      setDistance(4.65);
      for (let frame = 0; frame < 3; frame++) {
        navigation.update(1, performance.now() + frame, () => {});
      }
      navigation.updateStage();
      const state = navigation.getState();
      assert.equal(state.focusBody, 'earth');
      assert.equal(state.displayedId, 'earth');
      assert.equal(state.selected, 'earth');
      assert.equal(state.activeSystemId, 'solar');
      near(controls.target.distanceTo(world.earth.position), 0, 'zoom settles on Earth');
    });
  }
});

test('every new giant planet opens on its host-lit hemisphere at opposite orbital phases', async context => {
  for (const definition of deepSpaceBodyDefinitions.filter(body => body.kind === 'planet')) {
    await context.test(definition.id, t => {
      const { camera, world, arrive } = fixture(t);
      const planet = world.bodies.get(definition.id), host = world.bodies.get(planet.parentStarId);
      for (const phase of ['initial', 'opposite']) {
        if (phase === 'opposite') world.deepSpace.update(planet.orbitalPeriod / 2, { speed: 1 });
        arrive(planet.id);
        const viewDirection = camera.position.clone().sub(planet.position).normalize();
        const lightDirection = host.position.clone().sub(planet.position).normalize();
        const alignment = viewDirection.dot(lightDirection);
        assert.ok(alignment > 0.5,
          `${planet.id} ${phase} phase should show the illuminated hemisphere; alignment was ${alignment}`);
      }
    });
  }
});

test('EarthSense restores a foreign system and settings after borrowing the camera', context => {
  const { navigation, controls, camera, arrive } = fixture(context);
  arrive('triangulum-giant-demo');
  let settings = { paused: false, speed: 20, orbitsVisible: false, labelsVisible: true };
  const ui = { getState: () => ({ ...settings }), restoreState: value => { settings = { ...value }; } };
  const saved = navigation.snapshot(), savedSettings = ui.getState();
  assert.equal(saved.activeGalaxyId, 'triangulum');
  assert.equal(saved.activeSystemId, 'romano-star');
  const session = createEarthSession(navigation, ui);
  session.enter();
  assert.equal(navigation.getState().activeGalaxyId, 'galaxy');
  ui.restoreState({ paused: true, speed: .25, orbitsVisible: true, labelsVisible: false });
  navigation.update(0, performance.now() + 10000, () => {});
  session.leave();
  assert.deepEqual(navigation.snapshot(), saved);
  assert.deepEqual(ui.getState(), savedSettings);
  assert.deepEqual(camera.position.toArray(), saved.camera.position);
  assert.deepEqual(controls.target.toArray(), saved.camera.target);
});

test('EarthSense resumes an interrupted intergalactic flight with its remaining duration', context => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { navigation, world, controls } = fixture(context);
  navigation.flyTo('andromeda');
  now += 600;
  navigation.update(0, now, () => {});
  const saved = navigation.snapshot();
  const ui = { getState: () => ({ paused: false }), restoreState() {} };
  const session = createEarthSession(navigation, ui);
  session.enter();
  now += 10000;
  navigation.update(0, now, () => {});
  session.leave();
  assert.deepEqual(navigation.snapshot(), saved);
  assert.equal(navigation.getState().activeGalaxyId, 'andromeda');
  now += saved.flight.remaining;
  navigation.update(0, now, () => {});
  navigation.updateStage();
  assert.equal(navigation.getState().flight, false);
  assert.equal(navigation.getState().displayedId, 'andromeda');
  near(controls.target.distanceTo(world.getPosition('andromeda')), 0, 'resumed arrival');
});

test('rendered planets initialize around their own hosts and keep host-relative lighting as they orbit', context => {
  const { world } = fixture(context);
  for (const body of world.deepSpace.bodies.values()) {
    assert.ok(body.mesh.isMesh);
    assert.equal(body.mesh.userData.bodyId, body.id);
    if (body.kind !== 'planet') continue;
    const host = world.bodies.get(body.parentStarId);
    near(body.position.distanceTo(host.position), body.orbitRadius, `${body.id} initial orbital radius`);
    near(body.mesh.material.uniforms.uLightDirection.value.distanceTo(
      host.position.clone().sub(body.position).normalize()), 0, `${body.id} light points to host`);
  }
  world.deepSpace.update(3, { speed: 20 });
  for (const body of world.deepSpace.bodies.values()) {
    if (body.kind !== 'planet') continue;
    const host = world.bodies.get(body.parentStarId);
    near(body.position.distanceTo(host.position), body.orbitRadius, `${body.id} updated orbital radius`);
    near(body.mesh.material.uniforms.uLightDirection.value.distanceTo(
      host.position.clone().sub(body.position).normalize()), 0, `${body.id} updated host lighting`);
  }
});

test('pause freezes deep-space orbit, rotation and surface animation together', context => {
  const { world } = fixture(context);
  world.deepSpace.update(1, { speed: 20 });
  const before = [...world.deepSpace.bodies.values()].map(body => ({
    id: body.id, position: body.position.toArray(), rotation: body.mesh.rotation.toArray(),
    surfaceTime: body.mesh.material.uniforms.uTime.value,
    atmosphereTime: body.atmosphere.material.uniforms.uTime.value,
  }));
  world.deepSpace.update(5, { paused: true, speed: 20 });
  for (const saved of before) {
    const body = world.bodies.get(saved.id);
    assert.deepEqual(body.position.toArray(), saved.position);
    assert.deepEqual(body.mesh.rotation.toArray(), saved.rotation);
    assert.equal(body.mesh.material.uniforms.uTime.value, saved.surfaceTime);
    assert.equal(body.atmosphere.material.uniforms.uTime.value, saved.atmosphereTime);
  }
});

test('reduced-motion preference freezes new body animation', context => {
  context.mock.method(globalThis, 'matchMedia', () => ({ matches: true }));
  const { world } = fixture(context);
  const body = world.bodies.get('lmc-giant-demo');
  const position = body.position.toArray(), rotation = body.mesh.rotation.toArray();
  world.deepSpace.update(5, { speed: 20 });
  assert.deepEqual(body.position.toArray(), position);
  assert.deepEqual(body.mesh.rotation.toArray(), rotation);
  assert.equal(body.mesh.material.uniforms.uTime.value, 0);
});

test('deep-space visibility shows the focused system and respects the orbit toggle', context => {
  const { navigation, camera, world, arrive } = fixture(context);
  arrive('andromeda-giant-demo');
  world.deepSpace.updateVisibility(camera, { ...navigation.getState(), orbitsVisible: true });
  const planet = world.bodies.get('andromeda-giant-demo');
  assert.equal(planet.group.visible, true);
  assert.equal(planet.mesh.visible, true);
  assert.equal(planet.atmosphere.visible, true);
  assert.equal(world.bodies.get('af-and').group.visible, true);
  assert.equal(world.bodies.get('smc-giant-demo').group.visible, false);
  const orbit = world.deepSpace.orbitLines.find(line => line.userData.bodyId === planet.id);
  assert.equal(orbit.visible, true);
  world.deepSpace.updateVisibility(camera, { ...navigation.getState(), orbitsVisible: false });
  assert.ok(world.deepSpace.orbitLines.every(line => !line.visible));
  arrive('local-group');
  world.deepSpace.updateVisibility(camera, { ...navigation.getState(), orbitsVisible: true });
  assert.ok(world.deepSpace.orbitLines.every(line => !line.visible));
});

test('disposing deep-space rendering releases shared geometry, textures and materials once', () => {
  const scene = new THREE.Scene();
  const rendering = createDeepSpaceBodies(scene, null, deepSpaceBodyDefinitions);
  const root = scene.getObjectByName('deep-space-bodies');
  const firstStar = [...rendering.bodies.values()].find(body => body.kind === 'star');
  const owned = new Set([
    firstStar.mesh.geometry, rendering.orbitLines[0].geometry, firstStar.halo.material.map,
  ]);
  root.traverse(object => { if (object.material) owned.add(object.material); });
  const counts = new Map([...owned].map(resource => [resource, 0]));
  for (const resource of owned) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  rendering.dispose();
  assert.equal(scene.getObjectByName('deep-space-bodies'), undefined);
  for (const count of counts.values()) assert.equal(count, 1);
});
