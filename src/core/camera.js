import { TRAJECTORY_VIEW_DIRECTION } from '../universe/trajectory-catalog.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, smooth, mobile, reducedMotion } from './math.js';
import { snapshotCamera, restoreCamera, snapshotFlight, restoreFlight } from './camera-state.js';
import { earthSurfaceDirection } from './geographic-focus.js';

const MAX_DISTANCE = 3000000;

export function createCamera(renderer) {
  const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .001, 4000000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.zoomSpeed = 1.65;
  controls.rotateSpeed = .5;
  controls.minDistance = 1.13;
  controls.maxDistance = MAX_DISTANCE;
  controls.maxPolarAngle = Math.PI - .02;
  controls.minPolarAngle = .02;
  return { camera, controls };
}

/** Camera flight and scale tracking. Scene construction and DOM updates stay outside. */
export function createNavigation({ camera, controls, world, onInfo, onStage, toast }) {
  const { bodies, earth, station, getData, getPosition } = world;
  const zero = new THREE.Vector3();
  const galaxyCenter = getPosition('galaxy');
  const temp = new THREE.Vector3(), collisionOffset = new THREE.Vector3();
  let selected = 'earth', focusBody = 'earth', displayedId = 'earth';
  let activeGalaxyId = 'galaxy', activeSystemId = 'solar';
  let trajectoryView = false;
  let flight = null, returnFlight = null, lastMode = 'earth';

  function destinationDistance(id) {
    const destination = getData(id);
    if (destination.kind === 'trajectory') return destination.viewDistance * (mobile() ? 1.7 : 1);
    if (destination.kind === 'group') {
      let distance = destination.viewDistance * (mobile() ? 1.65 : 1);
      const direction = new THREE.Vector3(.12, .8, 1.65).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (const galaxy of world.galaxyDefinitions || []) {
        const relative = getPosition(galaxy.id).sub(getPosition(id));
        const radius = galaxy.radius * 1.15;
        const fit = relative.dot(direction) + Math.max(
          (Math.abs(relative.dot(right)) + radius) / (vertical * camera.aspect),
          (Math.abs(relative.dot(up)) + radius) / vertical);
        distance = Math.max(distance, fit * 1.04);
      }
      return distance;
    }
    if (destination.kind === 'galaxy') {
      if (!mobile()) return destination.viewDistance;
      const fit = destination.radius * 1.12
        / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
      return Math.max(destination.viewDistance * 1.25, fit);
    }
    if (id === 'galaxy') return 68000;
    if (id === 'solar') return 650;
    if (id === 'iss') return .88;
    if (id === 'jwst') return mobile() ? 5.3 : 4.1;
    const screenFit = mobile() ? (destination.parentGalaxy ? 1.7 : 1.19) : 1;
    if (destination.kind === 'spacecraft') {
      const fit = destination.r * 1.12
        / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
      return Math.max((destination.viewDistance || destination.r * 5.5) * screenFit, fit);
    }
    if (destination.kind === 'black-hole') {
      const radius = destination.visualRadius || destination.r * (destination.diskOuterRadius || 4.5);
      const fit = radius * 1.12 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
      return Math.max((destination.viewDistance || radius * 3.3) * screenFit, fit);
    }
    return destination.r * (id === 'saturn' ? 8.6 : id === 'sun' || destination.kind === 'star' ? 5.5 : 4.65) * screenFit;
  }

  function destinationDirection(id, night = false) {
    const destination = getData(id);
    if (destination.kind === 'trajectory') return new THREE.Vector3(...TRAJECTORY_VIEW_DIRECTION).normalize();
    if (destination.kind === 'group') return new THREE.Vector3(.12, .8, 1.65).normalize();
    if (destination.kind === 'galaxy') {
      if (destination.profile === 'lenticular' || destination.profile === 'dust-lane') {
        return new THREE.Vector3(.16, .14, 1.7)
          .applyEuler(new THREE.Euler(...(destination.tilt || [0, 0, 0]))).normalize();
      }
      return new THREE.Vector3(.16, 1.3, 1.7).normalize();
    }
    if (destination.kind === 'spacecraft' && destination.viewDirection) {
      return new THREE.Vector3(...destination.viewDirection).normalize();
    }
    if (destination.kind === 'black-hole') {
      // A nearly edge-on approach reveals the thin foreground disk and the
      // upper/lower bands of bent light around the central shadow.
      return new THREE.Vector3(.45, .065, 1).applyEuler(
        new THREE.Euler(...(destination.diskTilt || [0.12, 0, -0.22])),
      ).normalize();
    }
    if (destination.parentStarId) {
      const towardStar = getPosition(destination.parentStarId).sub(getPosition(id)).normalize();
      const tangent = new THREE.Vector3().crossVectors(towardStar, new THREE.Vector3(0, 1, 0));
      return towardStar.addScaledVector(tangent, .5).add(new THREE.Vector3(0, .42, 0)).normalize();
    }
    if (destination.parentGalaxy) return new THREE.Vector3(.45, .38, 1).normalize();
    if (id === 'galaxy') return new THREE.Vector3(.14, 1.2, 1.55).normalize();
    if (id === 'solar') return new THREE.Vector3(.18, 1.15, 1.45).normalize();
    if (id === 'jwst') return new THREE.Vector3(.85, .72, 1.65).applyQuaternion(world.jwst.body.group.quaternion).normalize();
    if (id === 'iss') {
      const outward = station.position.clone().sub(earth.position).normalize();
      const tangent = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0)).normalize();
      return outward.addScaledVector(tangent, .35).add(new THREE.Vector3(0, .15, 0)).normalize();
    }
    const position = getPosition(id);
    if (id === 'earth') return night
      ? position.normalize().multiplyScalar(1.1).add(new THREE.Vector3(0, .14, .3)).normalize()
      : new THREE.Vector3(2.1, .95, 3.8).normalize();
    return position.normalize().negate().multiplyScalar(.9).add(new THREE.Vector3(.3, .48, 1.15)).normalize();
  }

  function updateInfo(id) {
    displayedId = id;
    onInfo(id);
  }

  function flyTo(id, { night = false, immediate = false, earthFocus = null, distance } = {}) {
    const destination = getData(id);
    if (!destination) return;
    returnFlight = null;
    selected = id;
    trajectoryView = destination.kind === 'trajectory';
    if (trajectoryView) {
      focusBody = 'earth';
      activeGalaxyId = 'galaxy';
      activeSystemId = 'solar';
    } else if (id === 'galaxy' || id === 'solar') {
      if (activeGalaxyId !== 'galaxy' || activeSystemId !== 'solar') focusBody = 'earth';
      activeGalaxyId = 'galaxy';
      activeSystemId = 'solar';
    } else if (destination.kind === 'galaxy') {
      activeGalaxyId = id;
      const firstStar = [...bodies.values()].find(body => body.parentGalaxy === id && body.kind === 'star');
      const firstBody = firstStar || [...bodies.values()].find(body => body.parentGalaxy === id);
      // Galaxies without individually catalogued stars still own their focus.
      // Otherwise zooming in would drift back to the previously visited system.
      focusBody = activeSystemId = firstBody?.id || id;
    } else if (bodies.has(id) || id === 'iss') {
      focusBody = id;
      activeGalaxyId = destination.parentGalaxy || 'galaxy';
      activeSystemId = destination.parentSystemId || destination.parentStarId
        || (destination.kind === 'star' || destination.kind === 'black-hole' ? id : 'solar');
    }
    updateInfo(id);
    // Destination limits apply after arrival; applying them now would clamp the
    // starting view (for example Earth at 4.65 → trajectories at minimum 60).
    controls.minDistance = .001;
    controls.maxDistance = MAX_DISTANCE;
    const startOffset = camera.position.clone().sub(controls.target);
    flight = {
      id, night, start: performance.now(), duration: immediate || reducedMotion ? 1
        : id === 'galaxy' ? 2600 : destination.kind === 'group' || destination.kind === 'galaxy' ? 3200 : 1800,
      startTarget: controls.target.clone(), startDir: startOffset.clone().normalize(), startDist: startOffset.length(),
      endDist: distance ?? destinationDistance(id),
      endDir: earthFocus ? earthSurfaceDirection(earth, earthFocus) : destinationDirection(id, night), earthFocus,
    };
    controls.enabled = false;
    controls.update();
    if (night) toast('正在飞向地球夜侧');
    else if (id === 'iss') toast('正在接近国际空间站');
  }

  function keepOutsideBodies() {
    let corrected = false;
    for (const body of bodies.values()) {
      collisionOffset.copy(camera.position).sub(body.position);
      const min = body.r * 1.018;
      if (collisionOffset.lengthSq() < min * min) {
        if (collisionOffset.lengthSq() < .000001) collisionOffset.set(0, 0, 1);
        camera.position.copy(body.position).add(collisionOffset.setLength(min));
        corrected = true;
      }
    }
    if (corrected) camera.lookAt(controls.target);
  }

  function updateFlight(now) {
    const current = flight;
    if (!current) return;
    const t = clamp((now - current.start) / current.duration, 0, 1), eased = t * t * (3 - 2 * t);
    controls.target.lerpVectors(current.startTarget, getPosition(current.id), eased);
    current.endDir.copy(current.earthFocus ? earthSurfaceDirection(earth, current.earthFocus) : destinationDirection(current.id, current.night));
    const direction = temp.lerpVectors(current.startDir, current.endDir, eased);
    if (direction.lengthSq() < .000001) direction.copy(current.endDir);
    direction.normalize();
    const distance = Math.exp(THREE.MathUtils.lerp(Math.log(current.startDist), Math.log(current.endDist), eased));
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    keepOutsideBodies();
    controls.update();
    if (t >= 1) cancelFlight();
  }

  function updateReturnFlight(now) {
    const current = returnFlight;
    const t = clamp((now - current.start) / current.duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    controls.target.lerpVectors(current.startTarget, current.endTarget, eased);
    const direction = temp.lerpVectors(current.startDir, current.endDir, eased);
    if (direction.lengthSq() < .000001) direction.copy(current.endDir);
    direction.normalize();
    const distance = Math.exp(THREE.MathUtils.lerp(Math.log(current.startDist), Math.log(current.endDist), eased));
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    camera.zoom = THREE.MathUtils.lerp(current.startZoom, current.saved.camera.zoom, eased);
    camera.updateProjectionMatrix();
    controls.update();
    keepOutsideBodies();
    if (t >= 1) restore(current.saved);
  }

  function groupTransitionStart() {
    // A portrait panorama needs more camera distance. Keep its full galaxy
    // framed before starting the next transition out to the Local Group.
    return Math.max(150000, mobile() ? destinationDistance(activeGalaxyId) * 1.2 : 0);
  }

  function trackingCenter(distance) {
    if (trajectoryView) return getPosition('trajectory');
    const body = getData(focusBody), target = getPosition(focusBody);
    const closeView = body.kind === 'spacecraft' ? destinationDistance(focusBody) * 1.25 : 0;
    const leave = smooth(Math.max(body.r * 9, 8, closeView), Math.max(body.r * 25, 75, closeView * 2), distance);
    target.lerp(activeSystemId === 'solar' ? zero : getPosition(activeSystemId), leave);
    const galaxyBlendEnd = Math.min(30000, (getData(activeGalaxyId).viewDistance || 68000) * .7);
    target.lerp(activeGalaxyId === 'galaxy' ? galaxyCenter : getPosition(activeGalaxyId), smooth(1800, galaxyBlendEnd, distance));
    if (getData('local-group')) {
      const start = groupTransitionStart();
      target.lerp(getPosition('local-group'), smooth(start, Math.max(500000, start * 2.4), distance));
    }
    return target;
  }

  function updateTracking(dt) {
    const distance = camera.position.distanceTo(controls.target), body = getData(focusBody);
    temp.copy(trackingCenter(distance)).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 8));
    controls.target.add(temp);
    camera.position.add(temp);
    controls.minDistance = trajectoryView ? 60 : focusBody === 'iss' ? .20
      : body.r * (body.kind === 'black-hole' ? 2.8 : 1.13);
    controls.maxDistance = trajectoryView ? 2400 : MAX_DISTANCE;
    controls.update();
    keepOutsideBodies();
  }

  function cancelFlight() {
    flight = null;
    returnFlight = null;
    controls.enabled = true;
    const body = getData(focusBody);
    controls.minDistance = trajectoryView ? 60 : focusBody === 'iss' ? .20
      : body.r * (body.kind === 'black-hole' ? 2.8 : 1.13);
    controls.maxDistance = trajectoryView ? 2400 : MAX_DISTANCE;
  }

  function zoom(factor) {
    if (flight || returnFlight) cancelFlight();
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  function stage() {
    if (trajectoryView) return 'trajectory';
    const distance = camera.position.distanceTo(controls.target);
    if (getData('local-group') && distance > groupTransitionStart() * 4 / 3) return 'local-group';
    const focus = getData(focusBody);
    if (focus.kind === 'galaxy') return 'galaxy';
    if (focus.kind === 'black-hole') return distance > 2600 ? 'galaxy' : 'earth';
    return distance > 2600 ? 'galaxy' : distance > Math.max(28, getData(focusBody).r * 10) ? 'solar' : 'earth';
  }

  function updateStage() {
    const mode = stage();
    if (mode !== lastMode) {
      lastMode = mode;
      onStage(mode);
      if (mode === 'galaxy') toast(`进入${getData(activeGalaxyId).cn} · 继续缩小可打开星系图鉴`);
      if (mode === 'local-group') toast('打开星系图鉴 · 点击星系继续远行');
    }
    if (!flight && !returnFlight) {
      const infoId = mode === 'trajectory' ? 'trajectory' : mode === 'earth' ? focusBody : mode === 'solar' ? activeSystemId
        : mode === 'galaxy' ? activeGalaxyId : 'local-group';
      if (displayedId !== infoId) updateInfo(infoId);
      selected = infoId;
    }
  }

  function update(dt, now, updateBodies) {
    // Follow orbital motion exactly, including at 20×; smooth only exploration scale changes.
    const distance = camera.position.distanceTo(controls.target), before = flight || returnFlight ? null : trackingCenter(distance);
    updateBodies(dt);
    if (returnFlight) updateReturnFlight(now);
    else if (flight) updateFlight(now);
    else {
      const motion = trackingCenter(distance).sub(before);
      controls.target.add(motion);
      camera.position.add(motion);
      updateTracking(dt);
    }
  }

  function initialize() {
    controls.target.copy(earth.position);
    camera.position.copy(earth.position).addScaledVector(destinationDirection('earth'), destinationDistance('earth'));
    controls.update();
  }

  function focusEarth({ lat, lon, distance = 2.0 }) {
    if (![lat, lon, distance].every(Number.isFinite)) return false;
    flyTo('earth', { earthFocus: { lat: clamp(lat, -90, 90), lon }, distance: clamp(distance, 1.13, 28) });
    return true;
  }

  function snapshot() {
    // A second mode switch during the return still preserves the original trip.
    if (returnFlight) return returnFlight.saved;
    return {
      selected, focusBody, displayedId, lastMode,
      activeGalaxyId, activeSystemId, trajectoryView,
      camera: snapshotCamera(camera, controls), flight: snapshotFlight(flight, performance.now()),
    };
  }

  function restore(saved, { animate = false } = {}) {
    const startCamera = animate && !reducedMotion ? snapshotCamera(camera, controls) : null;
    selected = saved.selected;
    focusBody = saved.focusBody;
    displayedId = saved.displayedId;
    lastMode = saved.lastMode;
    activeGalaxyId = saved.activeGalaxyId || 'galaxy';
    activeSystemId = saved.activeSystemId || 'solar';
    trajectoryView = saved.trajectoryView || false;
    flight = null;
    returnFlight = null;
    if (startCamera) {
      const startTarget = new THREE.Vector3().fromArray(startCamera.target);
      const endTarget = new THREE.Vector3().fromArray(saved.camera.target);
      const startOffset = new THREE.Vector3().fromArray(startCamera.position).sub(startTarget);
      const endOffset = new THREE.Vector3().fromArray(saved.camera.position).sub(endTarget);
      // Drain drag damping without changing the view visible at the mode click.
      restoreCamera(camera, controls, startCamera);
      returnFlight = { saved, start: performance.now(),
        duration: startTarget.distanceTo(endTarget) > 10000 || Math.max(startOffset.length(), endOffset.length()) > 2600 ? 2200 : 1000,
        startTarget, endTarget, startDir: startOffset.clone().normalize(), endDir: endOffset.clone().normalize(),
        startDist: Math.max(.001, startOffset.length()), endDist: Math.max(.001, endOffset.length()),
        startZoom: startCamera.zoom,
      };
      controls.minDistance = .001;
      controls.maxDistance = MAX_DISTANCE;
      controls.enabled = false;
    } else {
      flight = restoreFlight(saved.flight, performance.now());
      restoreCamera(camera, controls, saved.camera);
    }
    onInfo(displayedId);
    onStage(lastMode);
  }

  return {
    initialize, flyTo, zoom, cancelFlight, trackingCenter, stage, update, updateStage, focusEarth, snapshot, restore,
    getState: () => ({ selected, focusBody, displayedId, activeGalaxyId, activeSystemId, trajectoryView,
      flight: !!flight || !!returnFlight, returning: !!returnFlight,
      stage: stage(), distance: camera.position.distanceTo(controls.target),
      galaxyViewDistance: destinationDistance(activeGalaxyId) }),
  };
}
