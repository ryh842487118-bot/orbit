import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEarthDetail } from '../src/earth/detail.js';
import { detailTextureWidth } from '../src/earth/detail-textures.js';
import { earthMaterial } from '../src/earth/lighting.js';

globalThis.matchMedia = () => ({ matches: false });
const { renderPixelRatio } = await import('../src/core/renderer.js');

function fixture(load) {
  const geometry = new THREE.SphereGeometry(1, 8, 8);
  const day = new THREE.Texture(), night = new THREE.Texture();
  const material = earthMaterial({ 'earth-day': day, 'earth-night': night });
  const clouds = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ opacity: .64 }));
  const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: { uStrength: { value: 1.1 } } }));
  const world = { earth: { mesh: new THREE.Mesh(geometry, material), atmosphere }, clouds };
  const controller = createEarthDetail({ world, renderer: { capabilities: { maxTextureSize: 8192 } }, assets: {}, load });
  return { controller, world, geometry, material, day, night };
}

test('detail maps honor texture limits and the phone memory budget', () => {
  assert.equal(detailTextureWidth(), 8192);
  assert.equal(detailTextureWidth({ compact: true }), 4096);
  assert.equal(detailTextureWidth({ deviceMemory: 4 }), 4096);
  assert.equal(detailTextureWidth({ maxTextureSize: 2048 }), 2048);
  assert.equal(detailTextureWidth({ maxTextureSize: 3000 }), 2048);
});

test('both modes use equal sampling quality within the shared pixel budget', () => {
  const desktop = { width: 1440, height: 900, pixelRatio: 1, compact: false };
  assert.equal(renderPixelRatio(desktop), 1.5);
  assert.equal(renderPixelRatio({ ...desktop, earthObservation: true }), renderPixelRatio(desktop));
  assert.equal(renderPixelRatio({ ...desktop, compact: true, pixelRatio: 3 }), 2);
  const ratio = renderPixelRatio({ ...desktop, width: 2560, height: 1440, pixelRatio: 2 });
  assert.ok(2560 * 1440 * ratio ** 2 <= 6000001);
});

test('universe and observation share the same detailed mesh and unchanged day/night lighting', async () => {
  let calls = 0;
  const detail = { day: new THREE.Texture(), night: new THREE.Texture(), width: 8192 };
  const { controller, world, geometry, material, day, night } = fixture(async () => { calls++; return detail; });
  const originalMesh = world.earth.mesh, originalShader = material.fragmentShader;
  assert.equal(calls, 0);
  await controller.prepare();
  assert.equal(world.earth.mesh, originalMesh);
  const sharedGeometry = world.earth.mesh.geometry;
  assert.notEqual(sharedGeometry, geometry);
  assert.equal(material.uniforms.uDay.value, detail.day, 'universe loads detail without entering observation');
  for (const observation of [true, false, true, false]) {
    controller.setObservation(observation);
    assert.equal(controller.getState().textureWidth, 8192);
    assert.equal(material.uniforms.uDay.value, detail.day);
    assert.equal(world.earth.mesh.geometry, sharedGeometry);
    assert.equal(material.fragmentShader, originalShader);
    assert.deepEqual(Object.keys(material.uniforms).sort(), ['uDay', 'uNight']);
    assert.equal(world.earth.atmosphere.material.uniforms.uStrength.value, 1.1);
    assert.equal(world.clouds.material.opacity, .64);
    assert.equal(world.clouds.visible, !observation, 'decorative cloud map never contradicts sampled clear weather');
  }
  await controller.prepare();
  assert.equal(calls, 1);
  controller.dispose();
  assert.equal(world.earth.mesh.geometry, geometry);
  assert.equal(material.uniforms.uDay.value, day);
  assert.equal(material.uniforms.uNight.value, night);
});

test('loading across a mode change installs detail without changing lighting or observation clouds', async () => {
  let resolve;
  const { controller, material, world } = fixture(() => new Promise(done => { resolve = done; }));
  const shader = material.fragmentShader;
  controller.prepare();
  controller.setObservation(true);
  const detail = { day: new THREE.Texture(), night: new THREE.Texture(), width: 8192 };
  resolve(detail);
  await controller.ready();
  assert.equal(material.uniforms.uDay.value, detail.day);
  assert.equal(material.fragmentShader, shader);
  assert.equal(world.clouds.visible, false);
  controller.setObservation(false);
  assert.equal(material.uniforms.uDay.value, detail.day);
  assert.equal(world.clouds.visible, true);
  controller.dispose();
});

test('missing detail maps leave both modes usable on the original texture', async () => {
  const { controller, material, day } = fixture(async () => { throw new Error('unavailable'); });
  await controller.prepare();
  for (const observation of [true, false]) {
    controller.setObservation(observation);
    assert.equal(controller.getState().status, 'fallback');
    assert.equal(material.uniforms.uDay.value, day);
    assert.equal(controller.getState().textureWidth, 2048);
  }
  controller.dispose();
});

test('disposing during load releases late GPU maps without changing the Earth', async () => {
  let resolve, disposals = 0;
  const { controller, material, day } = fixture(() => new Promise(done => { resolve = done; }));
  controller.prepare();
  controller.dispose();
  const lateDay = new THREE.Texture(), lateNight = new THREE.Texture();
  lateDay.addEventListener('dispose', () => disposals++);
  lateNight.addEventListener('dispose', () => disposals++);
  resolve({ day: lateDay, night: lateNight, width: 8192 });
  await controller.ready();
  assert.equal(disposals, 2);
  assert.equal(material.uniforms.uDay.value, day);
});
