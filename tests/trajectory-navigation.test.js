import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { data, specials } from '../src/universe/catalog.js';
import { trajectoryDefinition } from '../src/universe/trajectory-catalog.js';
import { createEarthSession } from '../src/earthsense/session.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation } = await import('../src/core/camera.js');

function near(actual, expected, message, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

function fixture(context) {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const bodies = new Map(data.map(body => [body.id, {
    ...body,
    position: new THREE.Vector3(
      Math.cos(body.phase || 0) * body.orbit,
      0,
      Math.sin(body.phase || 0) * body.orbit,
    ),
  }]));
  const earth = bodies.get('earth');
  earth.group = new THREE.Group();
  earth.group.position.copy(earth.position);
  earth.position = earth.group.position;
  earth.mesh = new THREE.Object3D();
  earth.group.add(earth.mesh);
  bodies.get('moon').position.add(earth.position);
  const station = { position: earth.position.clone().add(new THREE.Vector3(-.9, .5, .9)) };
  const world = {
    bodies, earth, station,
    getData: id => bodies.get(id) || (id === 'trajectory' ? trajectoryDefinition : specials[id]),
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'galaxy') return out.set(-18000, 0, 0);
      if (id === 'solar') return out.set(0, 0, 0);
      if (id === 'trajectory') return out.fromArray(trajectoryDefinition.position);
      return out.copy(id === 'iss' ? station.position : bodies.get(id).position);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, 1.6, .001, 4000000);
  // Real OrbitControls without a DOM connection still applies its radius limits.
  // A no-op update fixture would miss camera jumps caused by changing those limits.
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 1.13;
  controls.maxDistance = 2000000;
  controls.minPolarAngle = .02;
  controls.maxPolarAngle = Math.PI - .02;
  const info = [], stages = [];
  const navigation = createNavigation({
    camera, controls, world,
    onInfo: id => info.push(id), onStage: value => stages.push(value), toast() {},
  });
  navigation.initialize();
  function advance(milliseconds, updateBodies = () => {}) {
    now += milliseconds;
    navigation.update(Math.min(milliseconds / 1000, .05), now, updateBodies);
    navigation.updateStage();
  }
  function arrive(id) {
    navigation.flyTo(id, { immediate: true });
    advance(2);
  }
  let settings = { paused: false, speed: 20, orbitsVisible: true, labelsVisible: false };
  const ui = {
    getState: () => ({ ...settings }),
    restoreState: next => { settings = { ...next }; },
  };
  return { camera, controls, world, navigation, ui, info, stages, advance, arrive };
}

function assertSavedView(navigation, camera, controls, saved) {
  const actual = navigation.snapshot();
  for (const field of ['selected', 'focusBody', 'displayedId', 'lastMode',
    'activeGalaxyId', 'activeSystemId', 'trajectoryView']) {
    assert.equal(actual[field], saved[field], field);
  }
  near(camera.position.distanceTo(new THREE.Vector3(...saved.camera.position)), 0, 'saved camera position');
  near(controls.target.distanceTo(new THREE.Vector3(...saved.camera.target)), 0, 'saved camera target');
  near(camera.quaternion.angleTo(new THREE.Quaternion(...saved.camera.quaternion)), 0, 'saved camera orientation');
  assert.equal(controls.minDistance, saved.camera.minDistance);
  assert.equal(controls.maxDistance, saved.camera.maxDistance);
  assert.equal(controls.enabled, saved.camera.enabled);
  assert.deepEqual(actual.flight, saved.flight);
}

test('trajectory destination defines a separate model scene with a stable overview', () => {
  assert.equal(trajectoryDefinition.id, 'trajectory');
  assert.equal(trajectoryDefinition.kind, 'trajectory');
  assert.deepEqual(trajectoryDefinition.position, [-150, 5970, -60]);
  assert.equal(trajectoryDefinition.viewDistance, 600);
  assert.ok(trajectoryDefinition.r > 0);
});

test('entering trajectories from Earth or a wide galaxy view does not clamp the camera at the click', async context => {
  for (const origin of ['earth', 'galaxy']) {
    await context.test(origin, t => {
      const { navigation, camera, controls, arrive, advance } = fixture(t);
      arrive(origin);
      const beforeCamera = camera.position.clone(), beforeTarget = controls.target.clone();
      navigation.flyTo('trajectory');
      near(camera.position.distanceTo(beforeCamera), 0, 'entry click preserves the camera');
      near(controls.target.distanceTo(beforeTarget), 0, 'entry click preserves the target');
      assert.equal(navigation.getState().trajectoryView, true);
      assert.equal(navigation.getState().flight, true);
      assert.equal(navigation.getState().stage, 'trajectory');
      assert.equal(controls.enabled, false);
      advance(300);
      assert.ok(camera.position.distanceTo(beforeCamera) > 1, 'flight moves after time advances');
      assert.equal(navigation.getState().flight, true, 'ordinary flight has an intermediate view');
      advance(10000);
      near(navigation.getState().distance, 600, 'arrival overview distance');
      assert.equal(navigation.getState().flight, false);
    });
  }
});

test('trajectory arrival keeps its own selection, stage, fixed target and exploration limits', context => {
  const { navigation, controls, world, info, stages, arrive, advance } = fixture(context);
  arrive('trajectory');
  const state = navigation.getState();
  assert.equal(state.trajectoryView, true);
  assert.equal(state.selected, 'trajectory');
  assert.equal(state.displayedId, 'trajectory');
  assert.equal(state.stage, 'trajectory');
  assert.equal(state.flight, false);
  assert.equal(controls.enabled, true);
  assert.equal(controls.minDistance, 60);
  assert.equal(controls.maxDistance, 2400);
  assert.equal(info.at(-1), 'trajectory');
  assert.equal(stages.at(-1), 'trajectory');
  near(controls.target.distanceTo(world.getPosition('trajectory')), 0, 'trajectory center');
  advance(1000);
  assert.equal(navigation.getState().displayedId, 'trajectory', 'stage update must not fall back to Solar System info');
});

test('solar orbital motion cannot pull a trajectory view back toward Earth', context => {
  const { navigation, camera, controls, world, arrive, advance } = fixture(context);
  arrive('trajectory');
  const before = camera.position.clone(), center = world.getPosition('trajectory');
  let calls = 0;
  for (let frame = 0; frame < 120; frame++) {
    advance(1000 / 60, dt => {
      calls++;
      world.earth.position.add(new THREE.Vector3(dt * 120, 0, dt * -35));
    });
    near(controls.target.distanceTo(center), 0, 'target remains at the model scene');
    near(camera.position.distanceTo(before), 0, 'camera ignores the moving Earth');
  }
  assert.equal(calls, 120, 'the navigation still runs the simulation exactly once per frame');
  assert.equal(navigation.getState().trajectoryView, true);
});

test('trajectory zoom and rotation preserve the mode and enforce its limits', context => {
  const { navigation, camera, controls, world, arrive, advance } = fixture(context);
  arrive('trajectory');
  navigation.zoom(.000001);
  advance(16);
  near(navigation.getState().distance, 60, 'minimum trajectory distance');
  assert.equal(navigation.getState().stage, 'trajectory');
  navigation.zoom(1e20);
  advance(16);
  near(navigation.getState().distance, 2400, 'maximum trajectory distance');
  assert.equal(navigation.getState().stage, 'trajectory');
  const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), .7);
  camera.position.copy(controls.target).add(offset);
  controls.update();
  const rotated = camera.position.clone();
  advance(500);
  near(camera.position.distanceTo(rotated), 0, 'user rotation remains intact');
  near(controls.target.distanceTo(world.getPosition('trajectory')), 0, 'zoom and rotation keep the model center');
  assert.equal(navigation.getState().displayedId, 'trajectory');
});

test('zoom interrupts an incoming trajectory flight while retaining trajectory navigation', context => {
  const { navigation, controls, advance } = fixture(context);
  navigation.flyTo('trajectory');
  advance(400);
  navigation.zoom(1.2);
  advance(16);
  assert.equal(navigation.getState().flight, false);
  assert.equal(navigation.getState().trajectoryView, true);
  assert.equal(navigation.getState().stage, 'trajectory');
  assert.equal(controls.enabled, true);
  assert.equal(controls.minDistance, 60);
  assert.equal(controls.maxDistance, 2400);
});

test('choosing any ordinary destination exits the trajectory view without a click-time teleport', async context => {
  for (const id of ['solar', 'earth', 'mars', 'galaxy', 'iss']) {
    await context.test(id, t => {
      const { navigation, camera, controls, world, arrive, advance } = fixture(t);
      arrive('trajectory');
      const before = camera.position.clone(), target = controls.target.clone();
      navigation.flyTo(id);
      assert.equal(navigation.getState().trajectoryView, false);
      near(camera.position.distanceTo(before), 0, 'exit click preserves the camera');
      near(controls.target.distanceTo(target), 0, 'exit click preserves the target');
      advance(10000);
      assert.equal(navigation.getState().selected, id);
      assert.equal(navigation.getState().displayedId, id);
      assert.notEqual(navigation.getState().stage, 'trajectory');
      near(controls.target.distanceTo(world.getPosition(id)), 0, 'ordinary arrival target');
      assert.equal(controls.maxDistance, 3000000);
      if (id === 'solar') near(navigation.getState().distance, 650, 'solar overview');
      if (id === 'earth') near(navigation.getState().distance, 4.65, 'Earth view');
    });
  }
});

test('unknown destinations preserve the active trajectory view', context => {
  const { navigation, camera, controls, arrive } = fixture(context);
  arrive('trajectory');
  const saved = navigation.snapshot();
  navigation.flyTo('missing-destination');
  assertSavedView(navigation, camera, controls, saved);
});

test('instant snapshot restoration recovers trajectory context, camera and zoom limits', context => {
  const { navigation, camera, controls, arrive } = fixture(context);
  arrive('trajectory');
  navigation.zoom(1.35);
  const saved = navigation.snapshot();
  assert.equal(saved.trajectoryView, true);
  arrive('earth');
  assert.equal(navigation.snapshot().trajectoryView, false);
  navigation.restore(saved);
  assertSavedView(navigation, camera, controls, saved);
  assert.equal(navigation.getState().stage, 'trajectory');
});

test('animated snapshot restoration returns to trajectories through a continuous intermediate view', context => {
  const { navigation, camera, controls, arrive, advance } = fixture(context);
  arrive('trajectory');
  const saved = navigation.snapshot();
  arrive('earth');
  const earthView = camera.position.clone(), earthTarget = controls.target.clone();
  navigation.restore(saved, { animate: true });
  near(camera.position.distanceTo(earthView), 0, 'return starts from visible camera');
  near(controls.target.distanceTo(earthTarget), 0, 'return starts from visible target');
  assert.equal(navigation.getState().returning, true);
  advance(300);
  assert.ok(camera.position.distanceTo(earthView) > 1, 'return advances');
  assert.ok(camera.position.distanceTo(new THREE.Vector3(...saved.camera.position)) > 1, 'return has an intermediate view');
  advance(10000);
  assert.equal(navigation.getState().returning, false);
  assertSavedView(navigation, camera, controls, saved);
});

test('EarthSense round trip restores the trajectory view and original playback settings', context => {
  const { navigation, camera, controls, ui, arrive, advance } = fixture(context);
  arrive('trajectory');
  navigation.zoom(1.6);
  const saved = navigation.snapshot(), settings = ui.getState();
  const session = createEarthSession(navigation, ui);
  session.enter();
  assert.equal(navigation.getState().trajectoryView, false);
  advance(10000);
  ui.restoreState({ paused: true, speed: .25, orbitsVisible: false, labelsVisible: true });
  const earthView = camera.position.clone();
  session.leave();
  near(camera.position.distanceTo(earthView), 0, 'EarthSense exit has no camera jump');
  assert.equal(navigation.getState().returning, true);
  advance(10000);
  assert.deepEqual(ui.getState(), settings);
  assertSavedView(navigation, camera, controls, saved);
  assert.equal(navigation.getState().trajectoryView, true);
});

test('EarthSense preserves an interrupted incoming trajectory flight and its remaining duration', context => {
  const { navigation, camera, controls, ui, advance } = fixture(context);
  navigation.flyTo('trajectory');
  advance(300);
  const saved = navigation.snapshot();
  assert.equal(saved.trajectoryView, true);
  assert.equal(saved.flight.id, 'trajectory');
  assert.ok(saved.flight.remaining > 0);
  const session = createEarthSession(navigation, ui);
  session.enter();
  advance(10000);
  session.leave();
  advance(10000);
  assertSavedView(navigation, camera, controls, saved);
  assert.equal(navigation.getState().flight, true);
  advance(saved.flight.remaining - 1);
  assert.equal(navigation.getState().flight, true);
  advance(1);
  assert.equal(navigation.getState().flight, false);
  assert.equal(navigation.getState().trajectoryView, true);
  near(navigation.getState().distance, 600, 'resumed trajectory arrival');
  assert.equal(controls.minDistance, 60);
  assert.equal(controls.maxDistance, 2400);
});

test('rapid EarthSense reversal during return preserves the original trajectory view', context => {
  const { navigation, camera, controls, ui, arrive, advance } = fixture(context);
  arrive('trajectory');
  const saved = navigation.snapshot();
  const session = createEarthSession(navigation, ui);
  session.enter();
  advance(10000);
  session.leave();
  advance(300);
  const halfway = camera.position.clone(), target = controls.target.clone();
  assert.equal(navigation.getState().returning, true);
  session.enter();
  near(camera.position.distanceTo(halfway), 0, 'reversal preserves the visible camera');
  near(controls.target.distanceTo(target), 0, 'reversal preserves the visible target');
  assert.equal(navigation.getState().trajectoryView, false);
  advance(10000);
  session.leave();
  advance(10000);
  assertSavedView(navigation, camera, controls, saved);
  assert.equal(navigation.getState().trajectoryView, true);
});

test('choosing the Solar System during a trajectory return cancels that return permanently', context => {
  const { navigation, camera, controls, ui, arrive, advance } = fixture(context);
  arrive('trajectory');
  const session = createEarthSession(navigation, ui);
  session.enter();
  advance(10000);
  session.leave();
  advance(300);
  const before = camera.position.clone();
  navigation.flyTo('solar');
  near(camera.position.distanceTo(before), 0, 'new destination begins continuously');
  assert.equal(navigation.getState().returning, false);
  assert.equal(navigation.getState().trajectoryView, false);
  advance(10000);
  near(controls.target.length(), 0, 'Solar System remains the final target');
  assert.equal(navigation.getState().displayedId, 'solar');
  advance(1000);
  assert.equal(navigation.getState().trajectoryView, false);
});
