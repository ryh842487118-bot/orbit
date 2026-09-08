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

test('lensed bands follow the projected disk axis while orbiting above, below and along the disk', context => {
  const model = createBlackHole(definition);
  context.after(() => model.dispose());
  const parent = new THREE.Group();
  parent.position.set(120, -30, 250);
  parent.rotation.set(.3, -.45, .18);
  parent.add(model.group);
  parent.updateMatrixWorld(true);
  const center = model.group.getWorldPosition(new THREE.Vector3());
  const orientation = model.accretionDisk.getWorldQuaternion(new THREE.Quaternion());
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation);
  const camera = new THREE.PerspectiveCamera(43, 1.6, .01, 4000000);
  for (const view of [[.45, .065, 1], [-1, -.04, .5], [0, 1, 0], [1, 0, 0]]) {
    const direction = new THREE.Vector3(...view).normalize().applyQuaternion(orientation);
    camera.position.copy(center).addScaledVector(direction, definition.r * 14);
    camera.lookAt(center);
    model.updateCamera(camera);
    const axis = model.lensedArcs.material.uniforms.uDiskAxis.value;
    assert.ok(axis.toArray().every(Number.isFinite), 'projection stays finite at a face-on view');
    assert.ok(Math.abs(axis.length() - 1) < 1e-7, 'the projected disk axis remains normalized');
    assert.ok(axis.distanceTo(model.photonRing.material.uniforms.uDiskAxis.value) < 1e-7,
      'the thin foreground edge stays aligned with the lensed wings');
    const tangent = new THREE.Vector3().crossVectors(normal, direction);
    if (tangent.lengthSq() > 1e-8) {
      tangent.normalize();
      const cameraRotation = camera.getWorldQuaternion(new THREE.Quaternion());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRotation);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraRotation);
      const expected = new THREE.Vector2(tangent.dot(right), tangent.dot(up)).normalize();
      assert.ok(Math.abs(expected.dot(axis)) > .999999, 'lensed wings follow the real disk orientation');
    }
    const inclination = model.lensedArcs.material.uniforms.uInclination.value;
    assert.ok(Math.abs(inclination - (1 - Math.abs(direction.dot(normal)))) < 1e-7);
  }
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

test('portrait rendering updates the lens for its own camera and restores exploration even on failure', () => {
  const model = createBlackHole(definition);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(100, 70, 300); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  model.update(12);
  const quaternion = model.lensedArcs.quaternion.clone();
  const view = model.accretionDisk.material.uniforms.uViewDirection.value.clone();
  const axis = model.lensedArcs.material.uniforms.uDiskAxis.value.clone();
  try {
    assert.throws(() => model.renderPreview(camera, 28, () => {
      assert.equal(model.accretionDisk.material.uniforms.uTime.value, 28);
      assert(!model.lensedArcs.quaternion.equals(quaternion));
      throw new Error('render failure');
    }), /render failure/);
    assert.equal(model.accretionDisk.material.uniforms.uTime.value, 12);
    assert(model.lensedArcs.quaternion.equals(quaternion));
    assert(model.accretionDisk.material.uniforms.uViewDirection.value.equals(view));
    assert(model.lensedArcs.material.uniforms.uDiskAxis.value.equals(axis));
  } finally { model.dispose(); }
});
