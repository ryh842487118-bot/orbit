import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBlackHole } from '../src/universe/black-holes.js';
import { createDeepSpaceBodies } from '../src/universe/deep-space-bodies.js';

const definition = {
  id: 'test-black-hole', kind: 'black-hole', parentId: 'test-galaxy',
  parentGalaxy: 'test-galaxy', position: [240000, 35000, -180000],
  r: 30, diskOuterRadius: 4.5, diskTilt: [0.12, 0.07, -0.24], color: 0xffaa56,
};

function fixture(context, preference = { matches: false }) {
  context.mock.method(globalThis, 'matchMedia', () => preference);
  const scene = new THREE.Scene();
  const rendering = createDeepSpaceBodies(scene, null, [definition]);
  const body = rendering.bodies.get(definition.id);
  context.after(() => rendering.dispose());
  return { scene, rendering, body };
}

globalThis.matchMedia ??= () => ({ matches: false });

function animationTimes(body) {
  return [body.accretionDisk, body.photonRing, body.lensedArcs]
    .map(object => object.material.uniforms.uTime.value);
}

test('black-hole shadows and disks provide accurate pick geometry with an open disk center', context => {
  const model = createBlackHole({ ...definition, diskTilt: [0, 0, 0] });
  context.after(() => model.dispose());
  model.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 300), new THREE.Vector3(0, 0, -1));
  const shadowHit = ray.intersectObjects(model.pickMeshes, false)[0];
  assert.equal(shadowHit.object, model.mesh);
  assert.equal(shadowHit.object.userData.bodyId, definition.id);
  assert.ok(Math.abs(shadowHit.distance - 270) < 0.001);

  ray.set(new THREE.Vector3(90, 300, 0), new THREE.Vector3(0, -1, 0));
  const diskHit = ray.intersectObjects(model.pickMeshes, false)[0];
  assert.equal(diskHit.object, model.accretionDisk);
  assert.equal(diskHit.object.userData.bodyId, definition.id);
  assert.ok(Math.abs(diskHit.distance - 300) < 0.001);

  ray.set(new THREE.Vector3(0, 300, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(model.accretionDisk, false).length, 0,
    'the disk must not cover the shadow with a rectangular pick target');
  assert.ok(!model.pickMeshes.includes(model.photonRing));
  assert.ok(!model.pickMeshes.includes(model.lensedArcs));
  assert.equal(model.visualRadius, 135);
  assert.deepEqual(model.mesh.material.color.toArray(), [0, 0, 0]);
  assert.equal(model.mesh.material.transparent, false);
  assert.equal(model.mesh.material.depthWrite, true);
});

test('black-hole surfaces share the body position and obey speed, pause and invalid time inputs', context => {
  const { body, rendering } = fixture(context);
  assert.equal(body.position, body.group.position);
  assert.deepEqual(body.position.toArray(), definition.position);
  assert.equal(body.group.parent.name, 'deep-space-bodies');
  assert.equal(body.atmosphere, undefined);
  const position = body.position.toArray();
  const tilt = body.accretionDisk.rotation.toArray();
  rendering.update(2, { speed: 3 });
  assert.deepEqual(animationTimes(body), [6, 6, 6]);
  rendering.update(5, { speed: 20, paused: true });
  rendering.update(5, { speed: 0 });
  rendering.update(-2, { speed: 1 });
  rendering.update(2, { speed: -1 });
  rendering.update(Number.NaN);
  rendering.update(1, { speed: Infinity });
  assert.deepEqual(animationTimes(body), [6, 6, 6]);
  assert.deepEqual(body.position.toArray(), position);
  assert.deepEqual(body.accretionDisk.rotation.toArray(), tilt);
  rendering.update(0.5, { speed: 2 });
  assert.deepEqual(animationTimes(body), [7, 7, 7]);
});

test('a changing reduced-motion preference freezes and resumes black-hole animation', context => {
  const preference = { matches: true };
  const { body, rendering } = fixture(context, preference);
  rendering.update(10, { speed: 20 });
  assert.deepEqual(animationTimes(body), [0, 0, 0]);
  preference.matches = false;
  rendering.update(0.5, { speed: 2 });
  assert.deepEqual(animationTimes(body), [1, 1, 1]);
  preference.matches = true;
  rendering.update(10);
  assert.deepEqual(animationTimes(body), [1, 1, 1]);
});

test('black-hole visibility respects galaxy context and keeps the selected destination visible', context => {
  const { body, rendering } = fixture(context);
  const camera = new THREE.PerspectiveCamera(43, 1.6, 0.01, 4000000);
  camera.position.copy(body.position).add(new THREE.Vector3(150, 100, 360));
  camera.lookAt(body.position);
  rendering.updateVisibility(camera, { activeGalaxyId: 'test-galaxy' });
  assert.equal(body.group.visible, true);
  assert.equal(body.mesh.visible, true);
  const cameraRotation = camera.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(body.photonRing.getWorldQuaternion(new THREE.Quaternion()).angleTo(cameraRotation) < 1e-7);
  assert.ok(body.lensedArcs.getWorldQuaternion(new THREE.Quaternion()).angleTo(cameraRotation) < 1e-7);
  assert.ok(Math.abs(body.accretionDisk.material.uniforms.uViewDirection.value.length() - 1) < 1e-7);
  const inclination = body.lensedArcs.material.uniforms.uInclination.value;
  assert.ok(inclination >= 0 && inclination <= 1);

  rendering.updateVisibility(camera, { activeGalaxyId: 'another-galaxy' });
  assert.equal(body.group.visible, false);
  assert.equal(body.mesh.visible, false);
  rendering.updateVisibility(camera, { activeGalaxyId: 'another-galaxy', focusBody: body.id });
  assert.equal(body.group.visible, true);
  camera.position.z += body.r * 1300;
  rendering.updateVisibility(camera, { activeGalaxyId: 'test-galaxy', stage: 'local-group' });
  assert.equal(body.group.visible, false);
});

test('black-hole billboards remain camera-aligned under a transformed parent', context => {
  const model = createBlackHole(definition);
  context.after(() => model.dispose());
  const parent = new THREE.Group();
  parent.position.set(100, 200, -80);
  parent.rotation.set(0.25, 0.7, -0.12);
  parent.add(model.group);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(250, 340, 500);
  camera.lookAt(parent.position);
  model.updateCamera(camera);
  const rotation = camera.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(model.photonRing.getWorldQuaternion(new THREE.Quaternion()).angleTo(rotation) < 1e-7);
});

test('disposing deep-space black holes frees each owned resource once and ends updates', () => {
  const scene = new THREE.Scene();
  const rendering = createDeepSpaceBodies(scene, null, [definition]);
  const body = rendering.bodies.get(definition.id);
  const counts = new Map();
  body.group.traverse(object => {
    for (const resource of [object.geometry, object.material]) {
      if (!resource || counts.has(resource)) continue;
      counts.set(resource, 0);
      resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
    }
  });
  assert.equal(counts.size, 8);
  rendering.update(2);
  rendering.dispose();
  rendering.dispose();
  rendering.update(10);
  assert.equal(scene.getObjectByName('deep-space-bodies'), undefined);
  assert.equal(body.group.parent, null);
  assert.deepEqual(animationTimes(body), [2, 2, 2]);
  for (const count of counts.values()) assert.equal(count, 1);
});
