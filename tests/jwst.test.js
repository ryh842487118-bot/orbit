import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createJWST } from '../src/universe/jwst.js';
import { specials } from '../src/universe/catalog.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { createNavigation, createCamera } = await import('../src/core/camera.js');

function fixture(realControls = false) {
  const scene = new THREE.Scene();
  const earth = { id: 'earth', cn: '地球', r: 1, position: new THREE.Vector3(45, 0, 0) };
  const jwst = createJWST(scene, earth);
  const bodies = new Map([['earth', earth], ['jwst', jwst.body]]);
  const world = { earth, jwst, bodies, station: { position: new THREE.Vector3() },
    getData: id => bodies.get(id) || specials[id],
    getPosition(id, out = new THREE.Vector3()) {
      if (id === 'galaxy') return out.set(-18000, 0, 0);
      if (id === 'solar') return out.set(0, 0, 0);
      return out.copy(bodies.get(id).position);
    },
  };
  const canvas = new EventTarget(), document = new EventTarget();
  Object.assign(canvas, { style: {}, ownerDocument: document, clientWidth: 1440, clientHeight: 900,
    getRootNode: () => document, setPointerCapture() {}, releasePointerCapture() {} });
  const actual = realControls ? createCamera({ domElement: canvas }) : null;
  const camera = actual?.camera || new THREE.PerspectiveCamera(43, 1.6, .001, 4000000);
  const controls = actual?.controls || { target: new THREE.Vector3(), enabled: true, minDistance: 1.13, maxDistance: 2000000,
    update() { camera.lookAt(this.target); } };
  controls.enablePan = false;
  const navigation = createNavigation({ camera, controls, world, onInfo() {}, onStage() {}, toast() {} });
  navigation.initialize();
  return { scene, earth, jwst, world, camera, controls, navigation, canvas, document };
}

function near(a, b) { assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`); }

test('JWST remains on the anti-solar side as Earth moves, and pause freezes its halo phase', () => {
  const { earth, jwst } = fixture();
  for (const position of [[45,0,0], [0,0,45], [-45,0,0]]) {
    earth.position.fromArray(position);
    jwst.update(1, { paused: false, speed: 20 });
    const offset = jwst.body.position.clone().sub(earth.position);
    near(offset.dot(earth.position.clone().normalize()), 7);
    assert.ok(offset.length() < 7.1);
  }
  const before = jwst.body.position.clone();
  jwst.update(100, { paused: true, speed: 20 });
  near(jwst.body.position.distanceTo(before), 0);
});

test('deployment can close, reverse mid-motion and fully reopen without altering the orbit', () => {
  const {jwst}=fixture();const position=jwst.body.position.clone();
  jwst.setDeployment(false);jwst.update(4,{paused:true});
  near(jwst.getState().progress,.5);assert.equal(jwst.getState().animating,true);
  jwst.setDeployment(true);jwst.update(5,{paused:true});
  near(jwst.getState().progress,1);assert.equal(jwst.getState().animating,false);
  near(jwst.body.group.getObjectByName('jwst-left-wing').rotation.y,0);
  jwst.setDeployment(false,{immediate:true});near(jwst.getState().progress,0);
  assert.ok(jwst.body.group.getObjectByName('jwst-left-wing').rotation.y>1);
  near(jwst.body.position.distanceTo(position),0);
});

test('JWST exterior stays upright and all four real pointer drags move its front surface with the pointer', () => {
  const pointer = (type, x, y) => Object.assign(new Event(type), {
    pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, pageX: x, pageY: y,
  });
  for (const earthPosition of [[45,0,0], [0,0,45], [-45,0,0]]) {
    for (const [dx,dy] of [[40,0],[-40,0],[0,40],[0,-40]]) {
      const { earth, jwst, camera, controls, navigation, canvas, document } = fixture(true);
      earth.position.fromArray(earthPosition); jwst.update(0);
      navigation.flyTo('jwst', { immediate: true });
      navigation.update(0, performance.now()+10, () => {});
      assert.equal(navigation.getState().focusBody, 'jwst');
      assert.deepEqual(camera.up.toArray(), [0,1,0]);
      near(new THREE.Vector3(0,1,0).applyQuaternion(jwst.body.group.quaternion).y, 1);
      camera.updateMatrixWorld();
      const top = jwst.body.position.clone().add(new THREE.Vector3(0,1,0)).project(camera);
      const center = jwst.body.position.clone().project(camera);
      assert.ok(top.y > center.y, 'model top must appear above its base');
      const point = camera.position.clone().sub(controls.target).normalize().multiplyScalar(.5).add(controls.target);
      const before = point.clone().project(camera);
      canvas.dispatchEvent(pointer('pointerdown',720,450));
      document.dispatchEvent(pointer('pointermove',720+dx,450+dy));
      document.dispatchEvent(pointer('pointerup',720+dx,450+dy));
      camera.updateMatrixWorld();
      const after = point.clone().project(camera);
      if(dx) assert.equal(Math.sign(after.x-before.x), Math.sign(dx));
      if(dy) assert.equal(Math.sign(after.y-before.y), -Math.sign(dy));
      controls.dispose();
    }
  }
});
