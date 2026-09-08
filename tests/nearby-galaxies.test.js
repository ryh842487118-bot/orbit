import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.innerWidth = 1440;

// The renderer only needs a canvas while creating its shared glow texture.
const previousDocument = globalThis.document;
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {},
    }),
  }),
};
const { createNearbyGalaxies } = await import('../src/universe/nearby-galaxies.js');
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;

const definitions = [
  { id: 'm32', shape: 'elliptical', profile: 'compact', axisRatio: .76, radius: 2400, position: [0, 0, 0] },
  { id: 'm110', shape: 'elliptical', profile: 'diffuse', axisRatio: .55, radius: 6200, position: [16000, 0, 0] },
  { id: 'ngc6822', shape: 'irregular', radius: 4600, position: [-16000, 0, 0] },
];

function fixture(context, catalog = definitions) {
  const scene = new THREE.Scene();
  const rendering = createNearbyGalaxies(scene, 1, catalog);
  context.after(() => rendering.dispose());
  return { scene, rendering };
}

function fieldStatistics(entry, count = entry.points.geometry.attributes.position.count) {
  const { definition, points } = entry;
  const positions = points.geometry.attributes.position.array;
  const colors = points.geometry.attributes.aColor.array;
  let central = 0, warm = 0, blue = 0, xx = 0, yy = 0, zz = 0;
  for (let index = 0; index < count * 3; index += 3) {
    const x = positions[index] / definition.radius;
    const y = positions[index + 1] / definition.radius;
    const z = positions[index + 2] / definition.radius;
    const axis = definition.axisRatio || 1;
    if (Math.hypot(x, y / (axis * .78), z / axis) < .18) central++;
    if (colors[index] > colors[index + 2]) warm++;
    if (colors[index + 2] > colors[index]) blue++;
    xx += x * x;
    yy += y * y;
    zz += z * z;
  }
  return { central: central / count, warm: warm / count, blue: blue / count,
    depth: Math.sqrt(yy / xx), axis: Math.sqrt(zz / xx) };
}

test('elliptical galaxies have warm spheroids with distinct compact and diffuse profiles', context => {
  const { rendering } = fixture(context);
  const compact = fieldStatistics(rendering.galaxies.get('m32'));
  const diffuse = fieldStatistics(rendering.galaxies.get('m110'));
  assert.ok(compact.central > .45, 'M32 retains a dense central population');
  assert.ok(diffuse.central < .15, 'M110 retains its broad weak-core profile');
  for (const [id, stats, axis] of [['m32', compact, .76], ['m110', diffuse, .55]]) {
    assert.equal(stats.warm, 1, `${id} has an old warm stellar population`);
    assert.ok(Math.abs(stats.axis - axis) < .035, `${id} has the intended oval envelope`);
    assert.ok(stats.depth > .35, `${id} is a spheroid, not a thin barred disk`);
    assert.equal(rendering.galaxies.get(id).group.children.filter(child => child.isSprite).length, 1,
      `${id} has no blue star-forming knot glows`);
  }
  const irregular = fieldStatistics(rendering.galaxies.get('ngc6822'));
  assert.ok(irregular.blue > .8, 'the irregular dwarf retains its young blue associations');
  assert.ok(irregular.central < .1, 'the irregular dwarf has no dense central bar');
});

test('adding galaxies and changing screen size preserve the existing seeded stellar populations', context => {
  const originalWidth = globalThis.innerWidth;
  context.after(() => { globalThis.innerWidth = originalWidth; });
  globalThis.innerWidth = 1440;
  const full = fixture(context).rendering;
  const reordered = fixture(context, [...definitions].reverse()).rendering;
  for (const definition of definitions) {
    const original = full.galaxies.get(definition.id).points.geometry.attributes;
    const other = reordered.galaxies.get(definition.id).points.geometry.attributes;
    for (const name of ['position', 'aColor', 'aSize']) {
      assert.ok(original[name].array.every((value, index) => value === other[name].array[index]),
        `${definition.id} ${name} remains independent of catalog order`);
    }
  }
  globalThis.innerWidth = 390;
  const compact = fixture(context).rendering;
  for (const definition of definitions) {
    const original = full.galaxies.get(definition.id).points.geometry.attributes;
    const reduced = compact.galaxies.get(definition.id).points.geometry.attributes;
    assert.ok(reduced.position.count < original.position.count, `${definition.id} reduces mobile geometry`);
    for (const name of ['position', 'aColor', 'aSize']) {
      assert.ok(reduced[name].array.every((value, index) => value === original[name].array[index]),
        `${definition.id} ${name} retains the same mobile subset`);
    }
  }
});

test('galaxy LOD reuses buffers and preserves the central profile while changing visibility', context => {
  const { rendering } = fixture(context);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 1000000);
  const entry = rendering.galaxies.get('m32');
  const geometry = entry.points.geometry;
  const positions = geometry.attributes.position.array;
  rendering.update(camera, { stage: 'local-group', activeGalaxyId: 'm32' });
  assert.equal(entry.group.visible, true);
  assert.ok(geometry.drawRange.count < geometry.attributes.position.count);
  const distantCount = geometry.drawRange.count;
  assert.ok(Math.abs(fieldStatistics(entry, distantCount).central - fieldStatistics(entry).central) < .035,
    'reducing LOD keeps the compact nucleus and envelope in the same proportion');
  camera.position.set(0, 0, 6000);
  rendering.update(camera, { stage: 'galaxy', activeGalaxyId: 'm32', distance: 6000 });
  assert.ok(geometry.drawRange.count > distantCount);
  assert.equal(entry.points.geometry, geometry);
  assert.equal(geometry.attributes.position.array, positions);
  assert.ok(Number.isFinite(entry.points.material.uniforms.uOpacity.value));
  rendering.update(camera, { stage: 'solar', activeGalaxyId: 'm32' });
  assert.ok([...rendering.galaxies.values()].every(galaxy => !galaxy.group.visible));
});

test('disposing every morphology releases owned resources once and preserves the shared glow texture', context => {
  const { scene, rendering } = fixture(context);
  const resources = new Map();
  const texture = rendering.galaxies.get('m32').halo.material.map;
  let textureDisposals = 0;
  const trackTexture = () => textureDisposals++;
  texture.addEventListener('dispose', trackTexture);
  context.after(() => texture.removeEventListener('dispose', trackTexture));
  scene.traverse(object => {
    // Sprite geometry is shared by Three.js; this layer only owns point buffers
    // and its individual materials.
    for (const resource of [object.isPoints ? object.geometry : null, object.material].filter(Boolean)) {
      resources.set(resource, 0);
      resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
    }
  });
  rendering.dispose();
  rendering.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok([...resources.values()].every(count => count === 1));
  assert.equal(textureDisposals, 0);
});
