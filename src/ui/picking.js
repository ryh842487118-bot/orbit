import * as THREE from 'three';

/** Distinguish a click from drag or pinch before picking a scene body. */
export function bindBodyPicking({ renderer, camera, world, navigation, onPick }) {
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), touches = new Set();
  const galaxySphere = new THREE.Sphere(), galaxyCenter = new THREE.Vector3(), intersection = new THREE.Vector3();
  let press = null, multiTouch = false;

  function isVisible(object) {
    for (let node = object; node; node = node.parent) if (node.visible === false) return false;
    return true;
  }

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
    // The motion view owns its model; the exploration bodies behind it are
    // never destinations, including while the arrival flight is in progress.
    if (navigation.getState().stage === 'trajectory') return;
    // THREE.Raycaster does not respect visibility, including hidden ancestors.
    const meshes = [...world.bodies.values()].filter(body => body.mesh
      && isVisible(body.mesh) && isVisible(body.group)).map(body => body.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    let destination = hits[0]?.object.userData.bodyId;
    let nearest = hits[0]?.distance ?? Infinity;
    const state = navigation.getState();
    if (state.stage === 'local-group' || state.stage === 'galaxy') {
      for (const definition of world.galaxyDefinitions || []) {
        if (world.getPosition) galaxyCenter.copy(world.getPosition(definition.id));
        else if (Array.isArray(definition.position)) galaxyCenter.fromArray(definition.position);
        else galaxyCenter.copy(definition.position);
        const cameraDistance = camera.position.distanceTo(galaxyCenter);
        const focusDistance = Number.isFinite(state.distance) ? state.distance : cameraDistance;
        // Leave the galaxy's interior available for its stars and systems.
        if (cameraDistance < definition.radius * 1.1
          || (definition.id === state.activeGalaxyId && state.stage === 'galaxy'
            && focusDistance < definition.viewDistance * 1.7)) continue;
        galaxySphere.set(galaxyCenter, definition.radius * .75);
        if (!raycaster.ray.intersectSphere(galaxySphere, intersection)) continue;
        const hitDistance = camera.position.distanceTo(intersection);
        if (hitDistance < nearest) {
          nearest = hitDistance;
          destination = definition.id;
        }
      }
    }
    if (destination) navigation.flyTo(destination);
  });

  renderer.domElement.addEventListener('pointercancel', event => {
    touches.delete(event.pointerId);
    press = null;
  });
  renderer.domElement.addEventListener('wheel', () => {
    if (navigation.getState().flight) navigation.cancelFlight();
  }, { passive: true, capture: true });
}
