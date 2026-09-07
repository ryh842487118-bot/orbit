import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFeedStore } from '../src/earthsense/feeds.js';
import { createEarthSession } from '../src/earthsense/session.js';
import { createMarkerLayer } from '../src/earthsense/markers.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
const { createNavigation } = await import('../src/core/camera.js');
const { createEarthSense } = await import('../src/earthsense/index.js');
const settle = () => new Promise(resolve => setImmediate(resolve));
const event = id => ({ id, layer: 'test', title: id, lat: 0, lon: 0 });

function definition(load, options = {}) {
  return { id: 'test', enabled: true, ttl: 300000, load, ...options };
}

test('disabled EarthSense makes no requests, including explicit refresh and layer toggles', async context => {
  let calls = 0;
  const store = createFeedStore([definition(async () => { calls++; return []; })], () => {});
  context.after(() => store.dispose());
  await store.refresh(true);
  store.setEnabled('test', false);
  store.setEnabled('test', true);
  await settle();
  assert.equal(calls, 0);
  assert.equal(store.snapshot().test.status, 'idle');
});

test('layer switches and mode changes reuse fresh data, then refresh expired data', async context => {
  let calls = 0, time = 1000;
  const store = createFeedStore([definition(async () => { calls++; return [event('current')]; })], () => {}, { now: () => time });
  context.after(() => store.dispose());
  store.setActive(true);
  await settle();
  assert.equal(calls, 1);
  assert.equal(store.snapshot().test.status, 'ready');
  store.setEnabled('test', false);
  assert.deepEqual(store.visibleEvents(), []);
  store.setEnabled('test', true);
  await settle();
  assert.equal(calls, 1);
  store.setActive(false);
  store.setActive(true);
  await settle();
  assert.equal(calls, 1);
  store.setActive(false);
  time += 300001;
  await store.refresh(true);
  assert.equal(calls, 1);
  store.setActive(true);
  await settle();
  assert.equal(calls, 2);
});

test('disable and abort races cannot replace data from a newer request', async context => {
  const requests = [];
  const store = createFeedStore([definition(({ signal }) => new Promise((resolve, reject) => {
    requests.push({ signal, resolve, reject });
  }))], () => {});
  context.after(() => store.dispose());
  store.setActive(true);
  assert.equal(requests.length, 1);
  store.setEnabled('test', false);
  assert.equal(requests[0].signal.aborted, true);
  store.setEnabled('test', true);
  assert.equal(requests.length, 2);
  requests[1].resolve([event('new')]);
  await settle();
  requests[0].resolve([event('late-aborted')]);
  await settle();
  assert.equal(store.events('test')[0].id, 'new');
  const refreshing = store.refresh(true);
  store.setActive(false);
  assert.equal(requests[2].signal.aborted, true);
  requests[2].reject(new Error('late abort rejection'));
  await refreshing;
  assert.equal(store.events('test')[0].id, 'new');
  assert.equal(store.snapshot().test.status, 'ready');
});

test('a failed refresh retains the last successful events and their timestamp', async context => {
  let fail = false, time = 1000;
  const store = createFeedStore([definition(async () => {
    if (fail) throw new Error('provider unavailable');
    return [event('last-success')];
  })], () => {}, { now: () => time });
  context.after(() => store.dispose());
  store.setActive(true);
  await settle();
  const previous = store.events('test');
  fail = true;
  time += 1000;
  await store.refresh(true);
  assert.equal(store.events('test'), previous);
  assert.deepEqual(store.snapshot().test, {
    enabled: true, status: 'stale', count: 1, updatedAt: 1000, error: 'provider unavailable',
  });
});

test('empty, failed and partially successful providers remain distinguishable', async context => {
  const store = createFeedStore([
    definition(async () => [], { id: 'empty' }),
    definition(async () => { throw new Error('offline'); }, { id: 'failed' }),
    definition(async () => ({ events: [event('known')], warning: 'second source unavailable' }), { id: 'partial' }),
  ], () => {});
  context.after(() => store.dispose());
  store.setActive(true);
  await settle();
  const state = store.snapshot();
  assert.equal(state.empty.status, 'empty');
  assert.equal(state.failed.status, 'error');
  assert.equal(state.partial.status, 'partial');
  assert.equal(state.partial.count, 1);
  assert.equal(state.partial.error, 'second source unavailable');
});

function navigationFixture() {
  const group = new THREE.Group();
  group.position.x = 45;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial());
  group.add(mesh);
  const earth = { id: 'earth', r: 1, position: group.position, group, mesh };
  const world = {
    earth, bodies: new Map([['earth', earth]]), station: { position: new THREE.Vector3(46, 0, 0) },
    getData: id => id === 'earth' ? earth : ['solar', 'galaxy'].includes(id) ? { id, r: 1 } : undefined,
    getPosition(id, target = new THREE.Vector3()) {
      return id === 'earth' ? target.copy(earth.position) : id === 'galaxy' ? target.set(-18000, 0, 0) : target.set(0, 0, 0);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, 1.6, .001, 350000);
  const controls = { target: new THREE.Vector3(), minDistance: 1.13, maxDistance: 180000, enabled: true, update() {} };
  const navigation = createNavigation({ camera, controls, world, onInfo() {}, onStage() {}, toast() {} });
  navigation.initialize();
  let settings = { paused: false, speed: 20, orbitsVisible: false, labelsVisible: false };
  const ui = { getState: () => ({ ...settings }), restoreState: next => { settings = { ...next }; } };
  return { navigation, controls, camera, world, ui };
}

test('mode sessions restore the universe settings, camera and remaining flight unchanged', context => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { navigation, ui } = navigationFixture();
  navigation.flyTo('galaxy');
  now += 650;
  navigation.update(0, now, () => {});
  const originalView = navigation.snapshot(), originalSettings = ui.getState();
  const session = createEarthSession(navigation, ui);
  session.enter();
  assert.equal(session.active, true);
  session.enter();
  ui.restoreState({ paused: true, speed: .25, orbitsVisible: true, labelsVisible: true });
  now += 10000;
  navigation.update(0, now, () => {});
  session.leave();
  assert.equal(session.active, false);
  assert.deepEqual(ui.getState(), originalSettings);
  assert.deepEqual(navigation.snapshot(), originalView);
  session.leave();
  assert.deepEqual(navigation.snapshot(), originalView);
});

test('surface markers share the Earth transform and cannot be picked through the globe', () => {
  const { world } = navigationFixture();
  const earth = world.earth.mesh;
  earth.rotation.y = .4;
  const layer = createMarkerLayer({ color: '#ffb578' });
  earth.add(layer.group);
  assert.equal(layer.group.parent, earth);
  layer.setEvents([event('front'), { ...event('back'), lon: 180 }]);
  earth.updateWorldMatrix(true, true);
  const origin = earth.localToWorld(new THREE.Vector3(3, .003, .003));
  const direction = new THREE.Vector3(-1, 0, 0).transformDirection(earth.matrixWorld);
  const raycaster = new THREE.Raycaster(origin, direction);
  const surface = raycaster.intersectObject(earth, false)[0];
  assert.ok(surface, 'the existing Earth mesh is the occluder');
  assert.equal(layer.pick(raycaster, surface.distance)?.event.id, 'front');
  layer.setEvents([{ ...event('back'), lon: 180 }]);
  earth.updateWorldMatrix(true, true);
  assert.equal(layer.pick(raycaster, surface.distance), null);
  layer.group.visible = false;
  assert.equal(layer.pick(raycaster), null);
  layer.dispose();
  assert.equal(layer.group.parent, null);
});

function earthSenseFixture(context, load) {
  const previousDocument = globalThis.document;
  globalThis.document = { body: { classList: { toggle() {} } }, hidden: false };
  context.after(() => { globalThis.document = previousDocument; });
  const fixture = navigationFixture();
  const shown = [];
  let allocations = 0, panelState, panelActions;
  const sense = createEarthSense({
    ...fixture,
    layerDefinitions: [definition(load, { createView: () => {
      allocations++;
      return createMarkerLayer({ color: '#ffb578' });
    } })],
    createPanel: actions => { panelActions = actions; return { update: state => { panelState = state; }, dispose() {} }; },
    createPopup: () => ({ show: selected => shown.push(selected), close() {}, dispose() {} }),
  });
  context.after(() => sense.dispose());
  return { ...fixture, sense, shown, allocations: () => allocations, panelState: () => panelState, panelActions: () => panelActions };
}

test('EarthSense uses the existing Earth and only allocates visible layers near that Earth', async context => {
  let requests = 0;
  const { sense, world, navigation, allocations, panelState } = earthSenseFixture(context, async () => {
    requests++;
    return [event('one')];
  });
  const root = world.earth.mesh.getObjectByName('EarthSense surface layers');
  assert.equal(root.parent, world.earth.mesh);
  assert.equal(root.visible, false);
  assert.equal(requests, 0);
  assert.equal(allocations(), 0);
  sense.setMode('earthsense');
  await settle();
  assert.equal(requests, 1);
  assert.equal(allocations(), 0, 'data loading alone must not allocate surface layers');
  sense.update(1);
  assert.equal(root.visible, true);
  assert.equal(allocations(), 1);
  assert.equal(panelState().visible, true);
  navigation.flyTo('galaxy', { immediate: true });
  navigation.update(0, performance.now() + 2, () => {});
  sense.update(2);
  assert.equal(root.visible, false);
  assert.equal(sense.pick(new THREE.Raycaster()), false);
  sense.setMode('universe');
  assert.equal(sense.active, false);
  assert.equal(root.visible, false);
  sense.toggleLayer('test', false);
  sense.toggleLayer('test', true);
  await settle();
  assert.equal(requests, 1);
  sense.setMode('earthsense');
  await settle();
  sense.update(3);
  assert.equal(requests, 1, 're-entering uses the fresh cached response');
  assert.equal(allocations(), 1, 're-entering reuses the same surface layer');
});

test('late responses from a previous mode session cannot expose or overwrite current layers', async context => {
  const requests = [];
  const { sense, world } = earthSenseFixture(context, ({ signal }) => new Promise(resolve => requests.push({ signal, resolve })));
  sense.setMode('earthsense');
  sense.setMode('universe');
  assert.equal(requests[0].signal.aborted, true);
  sense.setMode('earthsense');
  requests[1].resolve([event('current-session')]);
  await settle();
  sense.update(1);
  requests[0].resolve([event('old-session')]);
  await settle();
  assert.deepEqual(sense.getState().events.map(item => item.id), ['current-session']);
  sense.setMode('universe');
  assert.equal(world.earth.mesh.getObjectByName('EarthSense surface layers').visible, false);
  assert.equal(sense.visible, false);
});

test('controller picking opens a visible event but never a far-side event through Earth', async context => {
  let records = [{ ...event('back'), lon: 180 }];
  const { sense, world, camera, controls, shown, panelActions } = earthSenseFixture(context, async () => records);
  sense.setMode('earthsense');
  await settle();
  const earth = world.earth.mesh;
  earth.updateWorldMatrix(true, true);
  camera.position.copy(earth.localToWorld(new THREE.Vector3(3, .003, .003)));
  controls.target.copy(world.earth.position);
  sense.update(1);
  earth.updateWorldMatrix(true, true);
  const raycaster = new THREE.Raycaster(camera.position.clone(), new THREE.Vector3(-1, 0, 0));
  assert.equal(sense.pick(raycaster), true, 'a click on empty Earth is handled without restarting a flight');
  assert.equal(shown.length, 0, 'the far-side event is occluded');
  records = [event('front')];
  panelActions().onRefresh();
  await settle();
  assert.equal(sense.pick(raycaster), true);
  assert.equal(shown.at(-1).id, 'front');
  sense.setMode('universe');
  assert.equal(sense.pick(raycaster), false);
});
