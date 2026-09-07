import * as THREE from 'three';

export function snapshotCamera(camera, controls) {
  return {
    position: camera.position.toArray(), target: controls.target.toArray(),
    quaternion: camera.quaternion.toArray(), up: camera.up.toArray(), zoom: camera.zoom,
    minDistance: controls.minDistance, maxDistance: controls.maxDistance, enabled: controls.enabled,
  };
}

export function restoreCamera(camera, controls, saved) {
  // Drain pending drag damping before restoring a different exploration view.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
  camera.position.fromArray(saved.position);
  camera.quaternion.fromArray(saved.quaternion);
  camera.up.fromArray(saved.up);
  camera.zoom = saved.zoom;
  camera.updateProjectionMatrix();
  controls.target.fromArray(saved.target);
  controls.minDistance = saved.minDistance;
  controls.maxDistance = saved.maxDistance;
  controls.enabled = saved.enabled;
  controls.update();
}

export function snapshotFlight(flight, now) {
  if (!flight) return null;
  const elapsed = Math.max(0, Math.min(flight.duration, now - flight.start));
  return {
    id: flight.id, night: flight.night, duration: flight.duration,
    elapsed, remaining: flight.duration - elapsed,
    startTarget: flight.startTarget.toArray(), startDir: flight.startDir.toArray(), endDir: flight.endDir.toArray(),
    startDist: flight.startDist, endDist: flight.endDist,
    earthFocus: flight.earthFocus ? { ...flight.earthFocus } : null,
  };
}

export function restoreFlight(saved, now) {
  if (!saved) return null;
  return {
    id: saved.id, night: saved.night, duration: saved.duration, start: now - saved.elapsed,
    startTarget: new THREE.Vector3().fromArray(saved.startTarget),
    startDir: new THREE.Vector3().fromArray(saved.startDir), endDir: new THREE.Vector3().fromArray(saved.endDir),
    startDist: saved.startDist, endDist: saved.endDist,
    earthFocus: saved.earthFocus ? { ...saved.earthFocus } : null,
  };
}
