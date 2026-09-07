import * as THREE from 'three';

/** Distinguish a click from drag or pinch before picking a scene body. */
export function bindBodyPicking({ renderer, camera, world, navigation, onPick }) {
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), touches = new Set();
  let press = null, multiTouch = false;

  renderer.domElement.addEventListener('pointerdown', event => {
    touches.add(event.pointerId);
    if (touches.size > 1) {
      multiTouch = true;
      press = null;
    } else {
      multiTouch = false;
      press = { x: event.clientX, y: event.clientY, t: performance.now() };
    }
    if (navigation.getState().flight) navigation.cancelFlight();
  }, { capture: true });

  renderer.domElement.addEventListener('pointerup', event => {
    touches.delete(event.pointerId);
    if (!press || multiTouch || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5 || performance.now() - press.t > 450) return;
    press = null;
    pointer.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (onPick?.(raycaster, event)) return;
    const hits = raycaster.intersectObjects([...world.bodies.values()].map(body => body.mesh));
    if (hits.length) navigation.flyTo(hits[0].object.userData.bodyId);
  });

  renderer.domElement.addEventListener('pointercancel', event => {
    touches.delete(event.pointerId);
    press = null;
  });
  renderer.domElement.addEventListener('wheel', () => {
    if (navigation.getState().flight) navigation.cancelFlight();
  }, { passive: true, capture: true });
}
