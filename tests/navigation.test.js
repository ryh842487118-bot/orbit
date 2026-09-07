import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { data, specials } from '../src/universe/catalog.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation } = await import('../src/core/camera.js');

function fixture() {
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
    getData: id => bodies.get(id) || specials[id],
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'galaxy') return out.set(-18000, 0, 0);
      if (id === 'solar') return out.set(0, 0, 0);
      return out.copy(id === 'iss' ? station.position : bodies.get(id).position);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, 1.6, .001, 350000);
  const controls = { target: new THREE.Vector3(), minDistance: 1.13, maxDistance: 180000, enabled: true, update() {} };
  const info = [], stages = [], toasts = [];
  const navigation = createNavigation({ camera, controls, world, onInfo: id => info.push(id), onStage: stage => stages.push(stage), toast: text => toasts.push(text) });
  navigation.initialize();
  return { camera, controls, world, navigation, info, stages, toasts };
}

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, received ${actual}`);
}

test('every original destination completes an immediate flight at its original distance', async context => {
  for (const id of [...data.map(body => body.id), 'iss', 'solar', 'galaxy']) {
    await context.test(id, () => {
      const { navigation, controls, world, info } = fixture();
      navigation.flyTo(id, { immediate: true });
      assert.equal(navigation.getState().flight, true);
      assert.equal(controls.enabled, false);
      navigation.update(0, performance.now() + 2, () => {});
      navigation.updateStage();
      const expected = id === 'galaxy' ? 68000 : id === 'solar' ? 650 : id === 'iss' ? .88
        : world.getData(id).r * (id === 'saturn' ? 8.6 : id === 'sun' ? 5.5 : 4.65);
      near(navigation.getState().distance, expected, id + ' arrival distance');
      near(controls.target.distanceTo(world.getPosition(id)), 0, id + ' arrival target');
      assert.equal(navigation.getState().selected, id);
      assert.equal(navigation.getState().displayedId, id);
      assert.equal(navigation.getState().flight, false);
      assert.equal(controls.enabled, true);
      assert.equal(info.at(-1), id);
    });
  }
});

test('frame update calls the simulation once and follows orbital displacement exactly', () => {
  const { navigation, controls, camera, world } = fixture();
  const beforeCamera = camera.position.clone(), beforeTarget = controls.target.clone();
  const movement = new THREE.Vector3(.4, -.02, .15);
  let calls = 0;
  navigation.update(.025, performance.now(), dt => {
    calls++;
    assert.equal(dt, .025);
    world.earth.position.add(movement);
  });
  assert.equal(calls, 1);
  near(camera.position.distanceTo(beforeCamera.add(movement)), 0, 'camera orbital following');
  near(controls.target.distanceTo(beforeTarget.add(movement)), 0, 'target orbital following');
  const pausedCamera = camera.position.clone(), pausedTarget = controls.target.clone();
  navigation.update(.025, performance.now(), () => { calls++; });
  assert.equal(calls, 2);
  near(camera.position.distanceTo(pausedCamera), 0, 'paused camera');
  near(controls.target.distanceTo(pausedTarget), 0, 'paused target');
});

test('zoom clamps to control limits and interrupts an active flight', () => {
  const { navigation, controls } = fixture();
  navigation.flyTo('galaxy');
  navigation.zoom(.000001);
  near(navigation.getState().distance, controls.minDistance, 'minimum zoom');
  assert.equal(navigation.getState().flight, false);
  assert.equal(controls.enabled, true);
  navigation.zoom(1e20);
  near(navigation.getState().distance, controls.maxDistance, 'maximum zoom');
});

test('cancelFlight restores controls and preserves the current camera', () => {
  const { navigation, camera, controls } = fixture();
  navigation.flyTo('mars');
  const before = camera.position.clone();
  navigation.cancelFlight();
  assert.equal(navigation.getState().flight, false);
  assert.equal(controls.enabled, true);
  near(camera.position.distanceTo(before), 0, 'cancelled flight camera');
});

test('an unknown destination leaves navigation and camera state unchanged', () => {
  const { navigation, camera, controls, info } = fixture();
  const before = navigation.getState(), beforeCamera = camera.position.clone(), beforeTarget = controls.target.clone();
  navigation.flyTo('unknown');
  assert.deepEqual(navigation.getState(), before);
  near(camera.position.distanceTo(beforeCamera), 0, 'unknown destination camera');
  near(controls.target.distanceTo(beforeTarget), 0, 'unknown destination target');
  assert.deepEqual(info, []);
});

test('snapshot restores the original view, selection and control limits after Earth focus', () => {
  const { navigation, camera, controls, info, stages } = fixture();
  navigation.flyTo('saturn', { immediate: true });
  navigation.update(0, performance.now() + 2, () => {});
  navigation.updateStage();
  const original = navigation.getState(), saved = navigation.snapshot();
  navigation.focusEarth({ lat: 31.23, lon: 121.47 });
  navigation.update(0, performance.now() + 1900, () => {});
  navigation.restore(saved);
  assert.deepEqual(navigation.getState(), original);
  assert.deepEqual(camera.position.toArray(), saved.camera.position);
  assert.deepEqual(controls.target.toArray(), saved.camera.target);
  assert.equal(controls.minDistance, saved.camera.minDistance);
  assert.equal(controls.maxDistance, saved.camera.maxDistance);
  assert.equal(controls.enabled, saved.camera.enabled);
  assert.equal(info.at(-1), 'saturn');
  assert.equal(stages.at(-1), saved.lastMode);
});

test('restoring an interrupted flight preserves its remaining duration across a mode pause', context => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { navigation, camera, controls } = fixture();
  navigation.flyTo('galaxy');
  now += 650;
  navigation.update(0, now, () => {});
  const saved = navigation.snapshot();
  assert.equal(saved.flight.elapsed, 650);
  assert.equal(saved.flight.remaining, 1950);
  navigation.focusEarth({ lat: 0, lon: 0 });
  now += 10000;
  navigation.update(0, now, () => {});
  navigation.restore(saved);
  assert.deepEqual(camera.position.toArray(), saved.camera.position);
  assert.deepEqual(controls.target.toArray(), saved.camera.target);
  assert.equal(navigation.snapshot().flight.remaining, 1950);
  assert.equal(controls.enabled, false);
  now += 1949;
  navigation.update(0, now, () => {});
  assert.equal(navigation.getState().flight, true);
  now += 1;
  navigation.update(0, now, () => {});
  assert.equal(navigation.getState().flight, false);
  near(navigation.getState().distance, 68000, 'restored galaxy arrival');
});

test('Earth geographic focus follows texture coordinates and the existing mesh rotation', async context => {
  for (const [label, lat, lon, rotation, expected] of [
    ['Greenwich', 0, 0, 0, [1, 0, 0]],
    ['90° east', 0, 90, 0, [0, 0, -1]],
    ['north pole', 90, 0, 0, [0, 1, 0]],
    ['rotated Greenwich', 0, 0, Math.PI / 2, [0, 0, -1]],
  ]) {
    await context.test(label, () => {
      const { navigation, world, camera, controls } = fixture();
      world.earth.mesh.rotation.y = rotation;
      assert.equal(navigation.focusEarth({ lat, lon, distance: 1.13 }), true);
      navigation.update(0, performance.now() + 1900, () => {});
      const outward = camera.position.clone().sub(world.earth.position).normalize();
      near(outward.distanceTo(new THREE.Vector3(...expected)), 0, label + ' surface direction');
      near(camera.position.distanceTo(world.earth.position), 1.13, 'Earth focus distance');
      near(controls.target.distanceTo(world.earth.position), 0, 'Earth focus target');
      assert.equal(navigation.getState().focusBody, 'earth');
    });
  }
});

test('Earth focus clamps the requested distance and rejects invalid coordinates', () => {
  const { navigation } = fixture();
  assert.equal(navigation.focusEarth({ lat: NaN, lon: 0 }), false);
  assert.equal(navigation.getState().flight, false);
  navigation.focusEarth({ lat: 0, lon: 0, distance: .5 });
  navigation.update(0, performance.now() + 1900, () => {});
  near(navigation.getState().distance, 1.13, 'surface zoom safety limit');
});
