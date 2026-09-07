import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bindBodyPicking } from '../src/ui/picking.js';

globalThis.innerWidth = 1000;
globalThis.innerHeight = 800;

function setup(onPick) {
  const canvas = new EventTarget(), selected = [];
  const camera = new THREE.PerspectiveCamera(43, 1.25, .001, 100);
  camera.updateMatrixWorld();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  earth.position.z = -5;
  earth.userData.bodyId = 'earth';
  earth.updateMatrixWorld();
  bindBodyPicking({
    renderer: { domElement: canvas }, camera,
    world: { bodies: new Map([['earth', { mesh: earth }]]) },
    navigation: { getState: () => ({ flight: false }), flyTo: id => selected.push(id), cancelFlight() {} },
    onPick,
  });
  function pointer(type, values = {}) {
    const event = new Event(type);
    Object.assign(event, { pointerId: 1, clientX: 501, clientY: 399, ...values });
    canvas.dispatchEvent(event);
  }
  return { pointer, selected };
}

test('a handled overlay click skips the underlying Earth navigation', () => {
  let picked = 0;
  const { pointer, selected } = setup((raycaster, event) => {
    picked++;
    assert.ok(raycaster instanceof THREE.Raycaster);
    assert.equal(event.type, 'pointerup');
    return true;
  });
  pointer('pointerdown');
  pointer('pointerup');
  assert.equal(picked, 1);
  assert.deepEqual(selected, []);
});

test('an unhandled overlay click retains original celestial body navigation', () => {
  const { pointer, selected } = setup(() => false);
  pointer('pointerdown');
  pointer('pointerup');
  assert.deepEqual(selected, ['earth']);
});

test('drag and pinch gestures never select an overlay or celestial body', () => {
  let picked = 0;
  const { pointer, selected } = setup(() => { picked++; return true; });
  pointer('pointerdown');
  pointer('pointerup', { clientX: 520 });
  pointer('pointerdown');
  pointer('pointerdown', { pointerId: 2 });
  pointer('pointerup', { pointerId: 2 });
  pointer('pointerup');
  assert.equal(picked, 0);
  assert.deepEqual(selected, []);
});
