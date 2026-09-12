import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { data, specials } from '../src/universe/catalog.js';
import { galaxyDefinitions, localGroupDefinition, deepSpaceBodyDefinitions } from '../src/universe/deep-space-catalog.js';
import { observedGalaxyDefinitions } from '../src/universe/observed-galaxies.js';
import { observedStarDefinitions } from '../src/universe/observed-stars.js';
import { destinationContext, filterDestinations } from '../src/ui/destinations.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation } = await import('../src/core/camera.js');

const milkyWay = { ...specials.galaxy, kind: 'galaxy', parentId: 'local-group',
  radius: 30000, viewDistance: 68000, position: [-18000, 0, 0] };
const allGalaxies = [milkyWay, ...galaxyDefinitions];
const allDestinations = new Map([...Object.values(specials), ...allGalaxies, localGroupDefinition]
  .map(definition => [definition.id, definition]));

function near(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

function fixture(context, width = 1440, height = 900) {
  const previousSize = [globalThis.innerWidth, globalThis.innerHeight];
  [globalThis.innerWidth, globalThis.innerHeight] = [width, height];
  context.after(() => { [globalThis.innerWidth, globalThis.innerHeight] = previousSize; });
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const bodies = new Map(data.map(definition => [definition.id, { ...definition,
    position: new THREE.Vector3(Math.cos(definition.phase || 0) * definition.orbit, 0,
      Math.sin(definition.phase || 0) * definition.orbit) }]));
  for (const definition of deepSpaceBodyDefinitions) {
    bodies.set(definition.id, { ...definition, position: new THREE.Vector3(...definition.position) });
  }
  const earth = bodies.get('earth');
  bodies.get('moon').position.add(earth.position);
  const station = { position: earth.position.clone().add(new THREE.Vector3(-.9, .5, .9)) };
  const world = { bodies, earth, station, galaxyDefinitions: allGalaxies,
    getData: id => bodies.get(id) || allDestinations.get(id),
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'solar') return out.set(0, 0, 0);
      if (id === 'iss') return out.copy(station.position);
      return bodies.has(id) ? out.copy(bodies.get(id).position) : out.fromArray(allDestinations.get(id).position);
    },
  };
  const camera = new THREE.PerspectiveCamera(43, width / height, .001, 4000000);
  // Exercise real radius clamping and camera orientation without browser input.
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 1.13;
  controls.maxDistance = 3000000;
  controls.minPolarAngle = .02;
  controls.maxPolarAngle = Math.PI - .02;
  const info = [];
  const navigation = createNavigation({ camera, controls, world,
    onInfo: id => info.push(id), onStage() {}, toast() {} });
  navigation.initialize();
  function advance(milliseconds = 1000 / 60) {
    now += milliseconds;
    navigation.update(Math.min(milliseconds / 1000, .05), now, () => {});
    navigation.updateStage();
    camera.updateMatrixWorld(true);
  }
  function arrive(id) {
    navigation.flyTo(id);
    advance(3300);
  }
  return { world, camera, controls, navigation, info, advance, arrive };
}

test('observed destinations selected from their own dock open complete confirmed entries', context => {
  const { world, controls, navigation, info, arrive } = fixture(context);
  assert.equal(observedGalaxyDefinitions.length, 6);
  assert.equal(observedStarDefinitions.length, 8);
  for (const definition of [...observedGalaxyDefinitions, ...observedStarDefinitions]) {
    arrive(definition.kind === 'galaxy' ? 'local-group' : 'galaxy');
    const dock = destinationContext(navigation.getState(), world);
    const entry = filterDestinations(dock.items, definition.id).find(body => body.id === definition.id);
    assert.ok(entry, `${definition.id} is selectable from its own context`);
    assert.equal(entry.modelStatus, 'confirmed');
    for (const field of ['cn', 'en', 'index', 'type', 'stat1', 'diameter', 'stat2', 'value2', 'desc', 'sourceLabel', 'appearance']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `${entry.id} has ${field}`);
    }
    assert.equal(typeof entry.unit1, 'string');
    assert.equal(typeof entry.unit2, 'string');
    assert.equal(new URL(entry.sourceUrl).protocol, 'https:');
    assert.equal(entry.parentId, entry.kind === 'galaxy' ? 'local-group' : 'galaxy');
    if (entry.kind === 'star') assert.equal(entry.parentGalaxy, 'galaxy');
    let ancestor = entry;
    const ancestors = new Set([entry.id]);
    while (ancestor.parentId) {
      assert.ok(!ancestors.has(ancestor.parentId), `${entry.id} has no cycle`);
      ancestor = world.getData(ancestor.parentId);
      assert.ok(ancestor, `${entry.id} has a resolvable parent`);
      ancestors.add(ancestor.id);
    }
    arrive(entry.id);
    const state = navigation.getState();
    assert.equal(state.flight, false);
    assert.equal(controls.enabled, true);
    assert.equal(state.selected, entry.id);
    assert.equal(state.displayedId, entry.id);
    assert.equal(info.at(-1), entry.id);
    near(controls.target.distanceTo(world.getPosition(entry.id)), 0, `${entry.id} arrival center`);
    assert.equal(state.activeGalaxyId, entry.kind === 'galaxy' ? entry.id : 'galaxy');
  }
});

test('atlas fits every complete galaxy and remains stationary with real OrbitControls', async context => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 740]]) {
    await context.test(`${width} × ${height}`, t => {
      const { world, camera, controls, navigation, advance, arrive } = fixture(t, width, height);
      arrive('m87');
      arrive('local-group');
      const arrival = camera.position.clone();
      const distance = navigation.getState().distance;
      assert.ok(distance < controls.maxDistance, 'the atlas fits before the maximum orbit radius');
      const assertFraming = () => {
        const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
        for (const galaxy of allGalaxies) {
          const center = world.getPosition(galaxy.id);
          for (const [index, plane] of frustum.planes.entries()) {
            assert.ok(plane.distanceToPoint(center) >= galaxy.radius,
              `${galaxy.id} full radius clears frustum plane ${index}`);
          }
        }
      };
      assertFraming();
      for (let frame = 0; frame < 90; frame++) advance();
      near(camera.position.distanceTo(arrival), 0, 'no post-flight orbit clamp or drift');
      near(navigation.getState().distance, distance, 'overview distance remains stable');
      near(controls.target.distanceTo(world.getPosition('local-group')), 0, 'atlas keeps its center');
      assert.equal(navigation.getState().stage, 'local-group');
      assert.equal(navigation.getState().displayedId, 'local-group');
      assertFraming();
    });
  }
});

test('new empty galaxies keep their own center after leaving a foreign planetary system', context => {
  const { world, camera, controls, navigation, advance, arrive } = fixture(context);
  for (const galaxy of observedGalaxyDefinitions) {
    arrive('andromeda-giant-demo');
    arrive(galaxy.id);
    const arrival = camera.position.clone();
    for (let frame = 0; frame < 90; frame++) advance();
    near(camera.position.distanceTo(arrival), 0, `${galaxy.id} panorama remains stationary`);
    navigation.zoom(600 / navigation.getState().distance);
    for (let frame = 0; frame < 90; frame++) advance();
    const state = navigation.getState();
    assert.equal(state.focusBody, galaxy.id);
    assert.equal(state.activeSystemId, galaxy.id);
    assert.equal(state.activeGalaxyId, galaxy.id);
    assert.equal(state.displayedId, galaxy.id);
    near(controls.target.distanceTo(world.getPosition(galaxy.id)), 0, `${galaxy.id} zoom remains centered`);
    assert.deepEqual(destinationContext(state, world).items.map(body => body.id), [galaxy.id]);
  }
});

test('dusty galaxy arrivals expose the dust band from a low latitude of the tilted disk', context => {
  const { camera, controls, arrive } = fixture(context);
  for (const id of ['sombrero', 'centaurus-a']) {
    const galaxy = observedGalaxyDefinitions.find(body => body.id === id);
    arrive(id);
    const diskNormal = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...galaxy.tilt));
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    const latitude = THREE.MathUtils.radToDeg(Math.asin(Math.abs(viewDirection.dot(diskNormal))));
    assert.ok(latitude > 2 && latitude < 10, `${id} disk latitude ${latitude}° reveals its dust band`);
  }
});

test('destination search tolerates names and catalog formatting while staying inside the current context', context => {
  const { world, navigation, arrive } = fixture(context);
  arrive('galaxy');
  const milkyWayItems = destinationContext(navigation.getState(), world).items;
  const originalStars = milkyWayItems.slice();
  for (const query of ['北极', 'POLARIS', 'ｐｏｌａｒｉｓ']) {
    assert.deepEqual(filterDestinations(milkyWayItems, query).map(body => body.id), ['polaris']);
  }
  for (const query of ['barnard-star', 'BARNARD STAR', 'ｂａｒｎａｒｄ－ｓｔａｒ', 'GJ 699']) {
    assert.deepEqual(filterDestinations(milkyWayItems, query).map(body => body.id), ['barnard-star']);
  }
  assert.deepEqual(filterDestinations(milkyWayItems, 'M87'), [], 'galaxy search cannot leak into the Milky Way dock');
  assert.deepEqual(filterDestinations(milkyWayItems, '不存在的天体'), []);
  assert.deepEqual(filterDestinations(milkyWayItems, ''), originalStars, 'clearing restores original order');
  assert.deepEqual(milkyWayItems, originalStars, 'search does not mutate input items');

  arrive('local-group');
  const atlasItems = destinationContext(navigation.getState(), world).items;
  const originalAtlas = atlasItems.slice();
  for (const query of ['M87', 'M 87', 'ｍ　８７', 'M-87']) {
    assert.deepEqual(filterDestinations(atlasItems, query).map(body => body.id), ['m87']);
  }
  for (const query of ['NGC 5128', 'ｎｇｃ　５１２８', 'centaurus-a', 'CENTAURUS A']) {
    assert.deepEqual(filterDestinations(atlasItems, query).map(body => body.id), ['centaurus-a']);
  }
  assert.deepEqual(filterDestinations(atlasItems, '北极'), [], 'star search cannot leak into the atlas');
  assert.deepEqual(filterDestinations(atlasItems, '  '), originalAtlas, 'blank search restores the atlas');
  assert.deepEqual(atlasItems, originalAtlas, 'catalog ordering remains untouched');
});
