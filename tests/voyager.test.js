import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVoyager, voyagerDefinition } from '../src/universe/voyager.js';

function fixture() {
  const scene = new THREE.Scene(), voyager = createVoyager(scene);
  const camera = new THREE.PerspectiveCamera(43, 1.6, 0.001, 4000000);
  camera.position.copy(voyager.body.position).addScaledVector(
    new THREE.Vector3(...voyager.body.viewDirection).normalize(), voyager.body.viewDistance);
  camera.lookAt(voyager.body.position); camera.updateMatrixWorld(true);
  return { scene, voyager, camera };
}

test('Voyager has a complete local spacecraft silhouette that fits its navigation radius', () => {
  const { voyager } = fixture();
  assert.equal(voyager.body.kind, 'spacecraft');
  assert.equal(voyager.body.parentSystemId, 'solar');
  for (const name of ['voyager-high-gain-antenna', 'voyager-ten-sided-bus',
    'voyager-magnetometer-boom', 'voyager-radioisotope-power', 'voyager-science-boom', 'voyager-golden-record']) {
    assert.ok(voyager.body.group.getObjectByName(name), `missing ${name}`);
  }
  const point = new THREE.Vector3();
  for (const mesh of voyager.body.pickMeshes) {
    assert.equal(mesh.userData.bodyId, 'voyager-1');
    const positions = mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).sub(voyager.body.position);
      assert.ok(point.length() <= voyager.body.r, `${mesh.name} extends outside navigation radius`);
    }
    assert.equal(mesh.material.map, null, 'model should not need remote textures or a DOM');
  }
  assert.equal(voyagerDefinition.modelStatus, 'confirmed');
  assert.match(voyagerDefinition.modelNote, /不代表实时/);
  voyager.dispose();
});

test('Voyager is ray-pickable from its default framing and its illustrative path is excluded', () => {
  const { voyager, camera } = fixture();
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(), camera);
  const hits = raycaster.intersectObjects(voyager.body.pickMeshes, false);
  assert.ok(hits.length > 0, 'framing center should hit the dish or spacecraft bus');
  assert.equal(hits[0].object.userData.bodyId, voyager.body.id);
  assert.ok(!voyager.body.pickMeshes.includes(voyager.trajectory));
  voyager.dispose();
});

test('Voyager and its path respect nearby visibility, galaxy isolation, and the orbit switch', () => {
  const { voyager, camera } = fixture();
  voyager.updateVisibility(camera, { stage: 'solar', activeGalaxyId: 'galaxy' });
  assert.equal(voyager.body.group.visible, true); assert.equal(voyager.trajectory.visible, true);
  voyager.updateVisibility(camera, { focusBody: voyager.body, orbitsVisible: false });
  assert.equal(voyager.body.group.visible, true); assert.equal(voyager.trajectory.visible, false);
  for (const options of [{ stage: 'trajectory' }, { stage: 'local-group' }, { stage: 'universe' }, { activeGalaxyId: 'andromeda' }]) {
    voyager.updateVisibility(camera, { ...options, focusBody: 'voyager-1' });
    assert.equal(voyager.body.group.visible, false); assert.equal(voyager.body.mesh.visible, false);
    assert.equal(voyager.trajectory.visible, false);
  }
  camera.position.set(100000, 0, 0);
  voyager.updateVisibility(camera); assert.equal(voyager.body.group.visible, false);
  voyager.updateVisibility(camera, { focusBody: 'voyager-1' }); assert.equal(voyager.body.group.visible, true);
  voyager.dispose();
});

test('Voyager renders one pickable marker without local lights at solar-system distances', () => {
  const { voyager, camera } = fixture();
  const visibleParts = () => {
    const meshes = [], lights = [];
    voyager.body.group.traverseVisible(object => {
      if (object.isMesh) meshes.push(object);
      if (object.isLight) lights.push(object);
    });
    return { meshes, lights };
  };
  voyager.updateVisibility(camera, { stage: 'solar', activeGalaxyId: 'galaxy' });
  assert.ok(visibleParts().meshes.length > 100);
  assert.equal(visibleParts().lights.length, 2);
  camera.position.copy(voyager.body.position).add(new THREE.Vector3(0, 0, 600));
  camera.lookAt(voyager.body.position); camera.updateMatrixWorld(true);
  voyager.updateVisibility(camera, { stage: 'solar', activeGalaxyId: 'galaxy' });
  const { meshes, lights } = visibleParts();
  assert.equal(voyager.body.group.visible, true, 'labels should remain available');
  assert.equal(meshes.length, 1, 'distant model needs only one mesh draw call');
  assert.equal(meshes[0].name, 'voyager-distant-marker'); assert.equal(lights.length, 0);
  assert.ok(voyager.body.pickMeshes.includes(meshes[0]));
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(), camera);
  assert.equal(raycaster.intersectObjects(meshes, false)[0].object.userData.bodyId, 'voyager-1');
  meshes[0].geometry.computeBoundingSphere();
  assert.ok(meshes[0].geometry.boundingSphere.radius * meshes[0].scale.x <= voyager.body.r);
  camera.position.copy(voyager.body.position).add(new THREE.Vector3(0, 0, 8.8));
  voyager.updateVisibility(camera, { focusBody: 'voyager-1' });
  assert.ok(visibleParts().meshes.length > 100); assert.equal(visibleParts().lights.length, 2);
  assert.equal(meshes[0].visible, false);
  voyager.dispose();
});

test('Voyager never invents orbital motion and repeated disposal releases every shared resource once', () => {
  const { scene, voyager, camera } = fixture();
  const position = voyager.body.position.clone(), attitude = voyager.body.group.quaternion.clone();
  for (const settings of [{ paused: true, speed: 200 }, { paused: false, speed: 200 }, { reducedMotion: true }]) {
    voyager.update(10000, settings);
    assert.ok(voyager.body.position.equals(position)); assert.ok(voyager.body.group.quaternion.equals(attitude));
  }
  const resources = new Map();
  for (const root of [voyager.body.group, voyager.trajectory]) root.traverse(object => {
    for (const resource of [object.geometry, object.material].flat().filter(Boolean)) resources.set(resource, 0);
  });
  for (const resource of resources.keys()) resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
  voyager.dispose(); voyager.dispose();
  assert.equal(scene.children.length, 0);
  for (const count of resources.values()) assert.equal(count, 1);
  voyager.updateVisibility(camera, { focusBody: 'voyager-1' }); voyager.update(1);
  assert.equal(voyager.body.group.visible, false); assert.equal(voyager.body.mesh.visible, false);
});
