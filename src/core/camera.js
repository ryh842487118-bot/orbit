import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, smooth, mobile, reducedMotion } from './math.js';
import { snapshotCamera, restoreCamera, snapshotFlight, restoreFlight } from './camera-state.js';
import { earthSurfaceDirection } from './geographic-focus.js';

const MAX_DISTANCE = 2000000;

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
  let flight = null, lastMode = 'earth';

  function destinationDistance(id) {
    const destination = getData(id);
    if (destination.kind === 'group') return destination.viewDistance * (mobile() ? 1.65 : 1);
    if (destination.kind === 'galaxy') return destination.viewDistance * (mobile() ? 1.25 : 1);
    if (id === 'galaxy') return 68000;
    if (id === 'solar') return 650;
    if (id === 'iss') return .88;
    const screenFit = mobile() ? (destination.parentGalaxy ? 1.7 : 1.19) : 1;
    return destination.r * (id === 'saturn' ? 8.6 : id === 'sun' || destination.kind === 'star' ? 5.5 : 4.65) * screenFit;
  }

  function destinationDirection(id, night = false) {
    const destination = getData(id);
    if (destination.kind === 'group') return new THREE.Vector3(.12, .8, 1.65).normalize();
    if (destination.kind === 'galaxy') return new THREE.Vector3(.16, 1.3, 1.7).normalize();
    if (destination.parentStarId) {
      const towardStar = getPosition(destination.parentStarId).sub(getPosition(id)).normalize();
      const tangent = new THREE.Vector3().crossVectors(towardStar, new THREE.Vector3(0, 1, 0));
      return towardStar.addScaledVector(tangent, .5).add(new THREE.Vector3(0, .42, 0)).normalize();
    }
    if (destination.parentGalaxy) return new THREE.Vector3(.45, .38, 1).normalize();
    if (id === 'galaxy') return new THREE.Vector3(.14, 1.2, 1.55).normalize();
    if (id === 'solar') return new THREE.Vector3(.18, 1.15, 1.45).normalize();
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
    selected = id;
    if (id === 'galaxy' || id === 'solar') {
      if (activeGalaxyId !== 'galaxy' || activeSystemId !== 'solar') focusBody = 'earth';
      activeGalaxyId = 'galaxy';
      activeSystemId = 'solar';
    } else if (destination.kind === 'galaxy') {
      activeGalaxyId = id;
      const firstStar = [...bodies.values()].find(body => body.parentGalaxy === id && body.kind === 'star');
      if (firstStar) focusBody = activeSystemId = firstStar.id;
    } else if (bodies.has(id) || id === 'iss') {
      focusBody = id;
      activeGalaxyId = destination.parentGalaxy || 'galaxy';
      activeSystemId = destination.parentStarId || (destination.kind === 'star' ? id : 'solar');
    }
    updateInfo(id);
    controls.minDistance = focusBody === 'iss' ? .20 : getData(focusBody).r * 1.13;
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

  function trackingCenter(distance) {
    const body = getData(focusBody), target = getPosition(focusBody);
    const leave = smooth(Math.max(body.r * 9, 8), Math.max(body.r * 25, 75), distance);
    target.lerp(activeSystemId === 'solar' ? zero : getPosition(activeSystemId), leave);
    const galaxyBlendEnd = Math.min(30000, (getData(activeGalaxyId).viewDistance || 68000) * .7);
    target.lerp(activeGalaxyId === 'galaxy' ? galaxyCenter : getPosition(activeGalaxyId), smooth(1800, galaxyBlendEnd, distance));
    if (getData('local-group')) target.lerp(getPosition('local-group'), smooth(150000, 500000, distance));
    return target;
  }

  function updateTracking(dt) {
    const distance = camera.position.distanceTo(controls.target), body = getData(focusBody);
    temp.copy(trackingCenter(distance)).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 8));
    controls.target.add(temp);
    camera.position.add(temp);
    controls.minDistance = focusBody === 'iss' ? .20 : body.r * 1.13;
    controls.update();
    keepOutsideBodies();
  }

  function cancelFlight() {
    flight = null;
    controls.enabled = true;
  }

  function zoom(factor) {
    if (flight) cancelFlight();
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  function stage() {
    const distance = camera.position.distanceTo(controls.target);
    if (getData('local-group') && distance > 200000) return 'local-group';
    return distance > 2600 ? 'galaxy' : distance > Math.max(28, getData(focusBody).r * 10) ? 'solar' : 'earth';
  }

  function updateStage() {
    const mode = stage();
    if (mode !== lastMode) {
      lastMode = mode;
      onStage(mode);
      if (mode === 'galaxy') toast(`进入${getData(activeGalaxyId).cn} · 继续缩小可探索星系群`);
      if (mode === 'local-group') toast('进入本星系群 · 点击星系继续远行');
    }
    if (!flight) {
      const infoId = mode === 'earth' ? focusBody : mode === 'solar' ? activeSystemId
        : mode === 'galaxy' ? activeGalaxyId : 'local-group';
      if (displayedId !== infoId) updateInfo(infoId);
      selected = infoId;
    }
  }

  function update(dt, now, updateBodies) {
    // Follow orbital motion exactly, including at 20×; smooth only exploration scale changes.
    const distance = camera.position.distanceTo(controls.target), before = flight ? null : trackingCenter(distance);
    updateBodies(dt);
    if (flight) updateFlight(now);
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
    return {
      selected, focusBody, displayedId, lastMode,
      activeGalaxyId, activeSystemId,
      camera: snapshotCamera(camera, controls), flight: snapshotFlight(flight, performance.now()),
    };
  }

  function restore(saved) {
    selected = saved.selected;
    focusBody = saved.focusBody;
    displayedId = saved.displayedId;
    lastMode = saved.lastMode;
    activeGalaxyId = saved.activeGalaxyId || 'galaxy';
    activeSystemId = saved.activeSystemId || 'solar';
    flight = restoreFlight(saved.flight, performance.now());
    restoreCamera(camera, controls, saved.camera);
    onInfo(displayedId);
    onStage(lastMode);
  }

  return {
    initialize, flyTo, zoom, cancelFlight, trackingCenter, stage, update, updateStage, focusEarth, snapshot, restore,
    getState: () => ({ selected, focusBody, displayedId, activeGalaxyId, activeSystemId,
      flight: !!flight, stage: stage(), distance: camera.position.distanceTo(controls.target) }),
  };
}
