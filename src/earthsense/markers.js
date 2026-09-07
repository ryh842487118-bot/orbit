import * as THREE from 'three';
import { latLonToVector } from '../earth/coordinates.js';
import { createEventPaths } from './paths.js';

/** Two instanced draw calls per layer, regardless of the number of events. */
export function createMarkerLayer({ color, size = () => 1, colorFor, segments = 32, paths = false }) {
  const group = new THREE.Group();
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1), scale = new THREE.Vector3();
  const sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  const ringGeometry = new THREE.RingGeometry(.7, 1, segments);
  const dotMaterial = new THREE.MeshBasicMaterial({ color, depthWrite: false, toneMapped: false });
  const ringMaterial = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  let events = [], dots, rings, path, currentScale = 1;

  function updateMatrices(factor) {
    currentScale = factor;
    for (let index = 0; index < events.length; index++) {
      const event = events[index], normal = latLonToVector(event.lat, event.lon);
      rotation.setFromUnitVectors(z, normal);
      const radius = size(event) * factor;
      matrix.compose(normal.clone().multiplyScalar(1.023), rotation, scale.setScalar(.009 * radius));
      dots.setMatrixAt(index, matrix);
      matrix.compose(normal.clone().multiplyScalar(1.016), rotation, scale.setScalar(.025 * radius));
      rings.setMatrixAt(index, matrix);
    }
    for (const mesh of [dots, rings]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  function releaseInstances() {
    for (const mesh of [dots, rings]) {
      if (mesh) { group.remove(mesh); mesh.dispose(); }
    }
    if (path) {
      group.remove(path);
      path.geometry.dispose();
      path.material.dispose();
      path = null;
    }
  }

  function setEvents(next) {
    releaseInstances();
    events = next;
    dots = new THREE.InstancedMesh(sphereGeometry, dotMaterial, events.length);
    rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, events.length);
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (colorFor) {
        const eventColor = new THREE.Color(colorFor(event));
        dots.setColorAt(index, eventColor);
        rings.setColorAt(index, eventColor);
      }
    }
    updateMatrices(currentScale);
    group.add(dots, rings);
    if (paths) { path = createEventPaths(events, color); group.add(path); }
  }

  function pick(raycaster, surfaceDistance = Infinity) {
    if (!group.visible || !dots) return null;
    const hit = raycaster.intersectObjects([dots, rings], false)
      .find(item => item.distance <= surfaceDistance + .002);
    return hit ? { event: events[hit.instanceId], distance: hit.distance } : null;
  }

  function update(time, { reducedMotion = false, scaleFactor = 1 } = {}) {
    if (dots && Math.abs(scaleFactor - currentScale) > .002) updateMatrices(scaleFactor);
    ringMaterial.opacity = reducedMotion ? .72 : .62 + Math.sin(time * 1.6) * .14;
  }

  function dispose() {
    releaseInstances();
    sphereGeometry.dispose(); ringGeometry.dispose(); dotMaterial.dispose(); ringMaterial.dispose();
    group.removeFromParent();
  }
  return { group, setEvents, pick, update, dispose };
}
