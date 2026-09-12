import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { specials } from '../src/universe/catalog.js';
import { destinationContext } from '../src/ui/destinations.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation } = await import('../src/core/camera.js');
const { createVoyager } = await import('../src/universe/voyager.js');

function near(actual, expected, message, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

function fixture(context, width = 1440, height = 900) {
  const previousSize = [globalThis.innerWidth, globalThis.innerHeight];
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  context.after(() => {
    [globalThis.innerWidth, globalThis.innerHeight] = previousSize;
  });
  const scene = new THREE.Scene();
  const earth = { id: 'earth', cn: '地球', r: 1, position: new THREE.Vector3(45, 0, 0) };
  const voyager = createVoyager(scene);
  context.after(() => voyager.dispose());
  const milkyWay = { ...specials.galaxy, kind: 'galaxy', radius: 30000, viewDistance: 68000,
    position: [-18000, 0, 0] };
  const foreignGalaxy = { id: 'foreign-galaxy', cn: '另一星系', kind: 'galaxy', r: 40000,
    radius: 40000, viewDistance: 90000, position: [300000, 0, 0] };
  const foreignStar = { id: 'foreign-star', cn: '另一恒星', kind: 'star', r: 5,
    parentGalaxy: foreignGalaxy.id, position: new THREE.Vector3(310000, 0, 0) };
  const jwst = { id: 'jwst', cn: '韦布望远镜', kind: 'observatory', r: 1,
    position: new THREE.Vector3(52, 0, 0) };
  const bodies = new Map([earth, voyager.body, jwst, foreignStar].map(body => [body.id, body]));
  const destinations = new Map([...Object.values(specials), milkyWay, foreignGalaxy]
    .map(body => [body.id, body]));
  const world = { scene, earth, voyager, bodies, galaxyDefinitions: [milkyWay, foreignGalaxy],
    station: { position: new THREE.Vector3() },
    getData: id => bodies.get(id) || destinations.get(id),
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'solar') return out.set(0, 0, 0);
      if (bodies.has(id)) return out.copy(bodies.get(id).position);
      return out.fromArray(destinations.get(id).position);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, width / height, .001, 4000000);
  const controls = { target: new THREE.Vector3(), enabled: true, minDistance: 1.13,
    maxDistance: 2000000, update() { camera.lookAt(this.target); } };
  const info = [];
  const navigation = createNavigation({ camera, controls, world,
    onInfo: id => info.push(id), onStage() {}, toast() {} });
  navigation.initialize();
  function arrive(id) {
    navigation.flyTo(id, { immediate: true });
    navigation.update(0, performance.now() + 2, () => {});
    navigation.updateStage();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  }
  return { scene, earth, voyager, world, camera, controls, navigation, info, arrive };
}

test('Voyager fits the desktop and portrait view and keeps its close-up centered', async context => {
  for (const [name, width, height] of [['desktop', 1440, 900], ['portrait', 390, 844]]) {
    await context.test(name, t => {
      const { voyager, camera, controls, navigation, arrive } = fixture(t, width, height);
      arrive('voyager-1');
      const state = navigation.getState();
      assert.equal(state.selected, 'voyager-1');
      assert.equal(state.focusBody, 'voyager-1');
      assert.equal(state.displayedId, 'voyager-1');
      assert.equal(state.stage, 'earth');
      assert.equal(state.activeGalaxyId, 'galaxy');
      assert.equal(state.activeSystemId, 'solar');
      assert.equal(state.flight, false);
      assert.equal(controls.enabled, true);
      near(controls.target.distanceTo(voyager.body.position), 0, 'arrival center');

      const vertex = new THREE.Vector3();
      let vertices = 0;
      for (const mesh of voyager.body.pickMeshes) {
        const position = mesh.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).project(camera);
          assert.ok(Math.abs(vertex.x) < .9 && Math.abs(vertex.y) < .9,
            `${mesh.name || mesh.type} should retain a visible margin around its entire geometry`);
          assert.ok(vertex.z > -1 && vertex.z < 1, 'model geometry stays inside the camera clipping planes');
          vertices++;
        }
      }
      assert.ok(vertices > 100, 'framing checks the complete assembled probe');
      const cameraBefore = camera.position.clone();
      for (let i = 0; i < 90; i++) navigation.update(1 / 60, performance.now() + i, () => {});
      navigation.updateStage();
      near(controls.target.distanceTo(voyager.body.position), 0, 'close-up must not drift toward the Sun');
      near(camera.position.distanceTo(cameraBefore), 0, 'stationary probe keeps a stationary camera');
      assert.equal(navigation.getState().displayedId, 'voyager-1');
    });
  }
});

test('Voyager uses its viewing direction, follows displacement and limits inward zoom outside the model', context => {
  const { voyager, camera, controls, navigation, arrive } = fixture(context);
  arrive('voyager-1');
  const intendedDirection = new THREE.Vector3(...voyager.body.viewDirection).normalize();
  near(camera.position.clone().sub(controls.target).normalize().distanceTo(intendedDirection), 0,
    'spacecraft view direction takes priority over its galaxy parent');
  const offset = camera.position.clone().sub(voyager.body.position);
  const movement = new THREE.Vector3(12, -3, 7);
  navigation.update(1 / 60, performance.now(), () => voyager.body.position.add(movement));
  near(controls.target.distanceTo(voyager.body.position), 0, 'target follows probe displacement');
  near(camera.position.clone().sub(voyager.body.position).distanceTo(offset), 0,
    'camera follows the same displacement');

  assert.ok(controls.minDistance > voyager.body.r, 'minimum zoom stays beyond the probe radius');
  assert.ok(controls.minDistance < navigation.getState().distance, 'close-up still allows inward zoom');
  navigation.zoom(.000001);
  navigation.update(1 / 60, performance.now(), () => {});
  near(camera.position.distanceTo(voyager.body.position), controls.minDistance, 'inward zoom safety limit');
  assert.equal(navigation.getState().activeSystemId, 'solar');
});

test('Solar and Milky Way overviews remain reachable from Voyager and preserve the solar parent context', context => {
  const { voyager, world, navigation, controls, arrive } = fixture(context);
  for (const [id, stage] of [['solar', 'solar'], ['galaxy', 'galaxy']]) {
    arrive('voyager-1');
    arrive(id);
    let state = navigation.getState();
    assert.equal(state.selected, id);
    assert.equal(state.displayedId, id);
    assert.equal(state.stage, stage);
    assert.equal(state.activeGalaxyId, 'galaxy');
    assert.equal(state.activeSystemId, 'solar');
    near(controls.target.distanceTo(world.getPosition(id)), 0, id + ' overview center');
    for (let i = 0; i < 10; i++) navigation.update(1 / 60, performance.now() + i, () => {});
    near(controls.target.distanceTo(world.getPosition(id)), 0, id + ' overview remains centered');
    // The existing solar navigation retains the last visited body as the
    // zoom-in destination while its overview remains centered on the Sun.
    navigation.zoom(8.8 / navigation.getState().distance);
    for (let i = 0; i < 4; i++) navigation.update(1, performance.now() + i, () => {});
    navigation.updateStage();
    state = navigation.getState();
    assert.equal(state.focusBody, 'voyager-1');
    assert.equal(state.displayedId, 'voyager-1');
    near(controls.target.distanceTo(voyager.body.position), 0, 'zoom returns to the previous solar destination', 1e-6);
  }
});

test('Voyager is offered in solar and Milky Way destinations without becoming a foreign system member', context => {
  const { world, navigation, arrive } = fixture(context);
  const ids = () => destinationContext(navigation.getState(), world).items.map(body => body.id);
  for (const id of ['earth', 'voyager-1', 'solar', 'galaxy']) {
    arrive(id);
    assert.equal(ids().filter(item => item === 'voyager-1').length, 1, `${id} offers exactly one Voyager entry`);
    if (id !== 'galaxy') assert.ok(ids().includes('jwst'), 'existing JWST destination remains available');
  }
  arrive('foreign-galaxy');
  assert.equal(navigation.getState().activeSystemId, 'foreign-star');
  assert.deepEqual(ids(), ['foreign-star']);
  arrive('voyager-1');
  assert.equal(navigation.getState().activeGalaxyId, 'galaxy');
  assert.equal(navigation.getState().activeSystemId, 'solar');
  assert.equal(destinationContext(navigation.getState(), world).key, 'solar');
  assert.ok(!ids().includes('foreign-star'));
});
