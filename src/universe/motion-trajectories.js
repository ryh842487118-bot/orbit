import * as THREE from 'three';
import { data } from './catalog.js';

const TAU = Math.PI * 2;

// All distances, sizes and periods below are deliberately compressed display
// parameters. This local straight-line frame illustrates relative motion; it
// is not a to-scale ephemeris or a model of the Sun's full Galactic orbit.
export const TRAJECTORY_FORWARD = Object.freeze([3.5, .7, 1.35]);
export const TRAJECTORY_HISTORY_SECONDS = Object.freeze({ short: 48, long: 96 });
export const TRAJECTORY_SAMPLE_COUNT = 769;

const displayParameters = {
  sun:     { orbitRadius: 0,  period: 0,  r: 6.8,  color: 0xffcf78 },
  mercury: { orbitRadius: 15, period: 10, r: 1.25, color: 0xaebdce },
  venus:   { orbitRadius: 24, period: 16, r: 1.75, color: 0xe7c477 },
  earth:   { orbitRadius: 33, period: 24, r: 1.85, color: 0x5ac8fa },
  mars:    { orbitRadius: 42, period: 32, r: 1.45, color: 0xf17d64 },
  jupiter: { orbitRadius: 54, period: 42, r: 3.8,  color: 0xd9ac87 },
  saturn:  { orbitRadius: 65, period: 56, r: 3.25, color: 0xf1d293 },
  uranus:  { orbitRadius: 75, period: 72, r: 2.5,  color: 0x75ddcf },
  neptune: { orbitRadius: 85, period: 90, r: 2.4,  color: 0x809dff },
};

export const TRAJECTORY_DEFINITIONS = Object.freeze(data
  .filter(body => Object.hasOwn(displayParameters, body.id))
  .map(body => Object.freeze({
    id: body.id, cn: body.cn, en: body.en, texture: body.texture,
    phase: body.phase ?? 0, inclination: body.id === 'mercury' ? .075 : .018,
    ...displayParameters[body.id],
  })));

function validFrame(frame) {
  return frame === 'galactic' || frame === 'solar';
}

/** Past position expressed in the moving window whose present Sun is at zero. */
export function sampleTrajectoryPosition(definition, time, age = 0, referenceFrame = 'galactic', out = new THREE.Vector3()) {
  if (!definition || ![definition.orbitRadius, definition.period, definition.phase, definition.inclination].every(Number.isFinite)
    || definition.orbitRadius < 0 || definition.period < 0
    || !Number.isFinite(time) || !Number.isFinite(age) || age < 0 || !validFrame(referenceFrame)) {
    throw new RangeError('A trajectory sample requires a body, finite time, nonnegative age and a valid reference frame.');
  }
  const angle = definition.period > 0
    ? definition.phase + ((time - age) % definition.period) / definition.period * TAU : 0;
  const sine = Math.sin(angle), radius = definition.orbitRadius;
  // The disk lies mostly in YZ. Forward motion has components both through
  // the disk and along it, so the display does not imply a perpendicular tow.
  out.set(radius * sine * Math.sin(definition.inclination),
    radius * Math.cos(angle), radius * sine * Math.cos(definition.inclination));
  if (referenceFrame === 'galactic') {
    out.x -= age * TRAJECTORY_FORWARD[0];
    out.y -= age * TRAJECTORY_FORWARD[1];
    out.z -= age * TRAJECTORY_FORWARD[2];
  }
  return out;
}

/** Conservative local bounds include the enlarged bodies, Saturn's rings and Sun halo. */
export function trajectoryBounds(referenceFrame = 'galactic', trailLength = 'short') {
  if (!validFrame(referenceFrame) || !Object.hasOwn(TRAJECTORY_HISTORY_SECONDS, trailLength)) {
    throw new RangeError('Unknown trajectory reference frame or trail length.');
  }
  const duration = referenceFrame === 'galactic' ? TRAJECTORY_HISTORY_SECONDS[trailLength] : 0;
  return boundsForDuration(duration);
}

function boundsForDuration(duration) {
  const padding = [20, 95, 95];
  const min = padding.map((extent, axis) => -extent - TRAJECTORY_FORWARD[axis] * duration);
  const max = [...padding];
  return { min, max, size: min.map((value, axis) => max[axis] - value),
    center: min.map((value, axis) => (value + max[axis]) / 2) };
}

const trailVertex = `
  attribute float aAge, aSide;
  uniform float uAngle, uAngularSpeed, uRadius, uInclination, uHistory, uGalactic;
  uniform float uPixelRatio, uHalfWidth;
  uniform vec2 uResolution;
  uniform vec3 uForward;
  varying float vAge, vSide;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  vec3 historyPosition(float fraction) {
    float age = fraction * uHistory;
    float angle = uAngle - age * uAngularSpeed;
    return vec3(uRadius * sin(angle) * sin(uInclination),
      uRadius * cos(angle), uRadius * sin(angle) * cos(uInclination))
      - uForward * age * uGalactic;
  }
  void main() {
    vAge = aAge;
    vSide = aSide;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(historyPosition(aAge), 1.0);
    vec4 next = projectionMatrix * modelViewMatrix
      * vec4(historyPosition(aAge + 1.0 / ${TRAJECTORY_SAMPLE_COUNT - 1}.0), 1.0);
    vec2 direction = (next.xy / max(abs(next.w), 0.0001)
      - projected.xy / max(abs(projected.w), 0.0001)) * uResolution;
    float magnitude = length(direction);
    direction = magnitude > 0.00001 ? direction / magnitude : vec2(1.0, 0.0);
    vec2 perpendicular = vec2(-direction.y, direction.x);
    projected.xy += perpendicular * aSide * uHalfWidth * uPixelRatio
      * 2.0 / uResolution * projected.w;
    gl_Position = projected;
    #include <logdepthbuf_vertex>
  }
`;

const trailFragment = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge, vSide;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    float recent = clamp(1.0 - vAge, 0.0, 1.0);
    float feather = exp(-vSide * vSide * 5.2);
    float fade = pow(recent, 0.75);
    vec3 color = uColor * (1.45 + pow(recent, 5.0) * 0.35);
    gl_FragColor = vec4(color, feather * fade * uOpacity);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const bodyVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const bodyFragment = `
  uniform sampler2D uMap;
  uniform vec3 uColor, uLightDirection;
  uniform float uHasMap, uEmissive, uTwoSided;
  varying vec2 vUv;
  varying vec3 vNormal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec4 texel = texture2D(uMap, vUv);
    vec3 surface = mix(uColor, texel.rgb, uHasMap);
    float light = dot(normalize(vNormal), normalize(uLightDirection));
    light = mix(max(light, 0.0), abs(light), uTwoSided);
    vec3 lit = surface * (0.17 + light * 1.08);
    vec3 color = mix(lit, surface * vec3(2.3, 1.9, 1.5), uEmissive);
    gl_FragColor = vec4(max(color, vec3(0.0)), mix(1.0, texel.a, uHasMap));
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createHaloTexture() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const alpha = Math.exp(-radius * radius * 7)
        * (1 - THREE.MathUtils.smoothstep(radius, .75, 1));
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createTrailGeometry() {
  const positions = new Float32Array(TRAJECTORY_SAMPLE_COUNT * 2 * 3);
  const ages = new Float32Array(TRAJECTORY_SAMPLE_COUNT * 2);
  const sides = new Float32Array(TRAJECTORY_SAMPLE_COUNT * 2);
  const indices = new Uint16Array((TRAJECTORY_SAMPLE_COUNT - 1) * 6);
  for (let sample = 0; sample < TRAJECTORY_SAMPLE_COUNT; sample++) {
    const age = sample / (TRAJECTORY_SAMPLE_COUNT - 1), vertex = sample * 2;
    ages[vertex] = ages[vertex + 1] = age;
    sides[vertex] = -1;
    sides[vertex + 1] = 1;
    if (sample < TRAJECTORY_SAMPLE_COUNT - 1) {
      indices.set([vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3], sample * 6);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  // The shader generates the entire trail in a fixed buffer. This static bound
  // covers either frame and both history lengths without per-frame CPU uploads.
  const bounds = trajectoryBounds('galactic', 'long');
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  return geometry;
}

/** An isolated moving-window demonstration; never reads or updates world.bodies. */
export function createMotionTrajectories(scene, textures = {}, pixels = 1) {
  const group = new THREE.Group();
  group.name = 'motion-trajectories';
  group.visible = false;
  scene.add(group);
  const sphere = new THREE.SphereGeometry(1, 36, 24), trailGeometry = createTrailGeometry();
  const haloMap = createHaloTexture();
  const fallbackMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  fallbackMap.needsUpdate = true;
  const ownedMaterials = [], extras = [], entries = [];
  const inverseRotation = new THREE.Quaternion();
  const surfaceTextures = textures ?? {};
  const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let time = 0, active = false, paused = false, referenceFrame = 'galactic', trailLength = 'short';
  let pixelRatio = 1, disposed = false;
  let galacticMix = 1, renderedHistory = TRAJECTORY_HISTORY_SECONDS.short, historyTransition = null;

  function surfaceMaterial(definition, texture, { rings = false } = {}) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture || fallbackMap }, uHasMap: { value: texture ? 1 : 0 },
        uColor: { value: new THREE.Color(definition.color) },
        uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
        uEmissive: { value: definition.id === 'sun' ? 1 : 0 },
        uTwoSided: { value: rings ? 1 : 0 },
      }, vertexShader: bodyVertex, fragmentShader: bodyFragment,
      side: rings ? THREE.DoubleSide : THREE.FrontSide,
      transparent: rings, depthWrite: !rings, forceSinglePass: true,
    });
    ownedMaterials.push(material);
    return material;
  }

  for (const definition of TRAJECTORY_DEFINITIONS) {
    const material = surfaceMaterial(definition, surfaceTextures[definition.texture]);
    const mesh = new THREE.Mesh(sphere, material);
    mesh.name = `trajectory-body-${definition.id}`;
    mesh.userData.trajectoryBodyId = definition.id;
    mesh.scale.setScalar(definition.r);
    mesh.rotation.z = definition.id === 'saturn' ? .466 : definition.id === 'uranus' ? 1.7 : .08;
    group.add(mesh);

    const haloMaterial = new THREE.SpriteMaterial({
      map: haloMap, color: definition.color, transparent: true,
      opacity: definition.id === 'sun' ? .5 : .1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ownedMaterials.push(haloMaterial);
    const halo = new THREE.Sprite(haloMaterial);
    halo.name = `trajectory-halo-${definition.id}`;
    halo.scale.setScalar(definition.r * (definition.id === 'sun' ? 4.8 : 3.3));
    group.add(halo);

    const trailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uAngle: { value: definition.phase }, uAngularSpeed: { value: definition.period ? TAU / definition.period : 0 },
        uRadius: { value: definition.orbitRadius }, uInclination: { value: definition.inclination },
        uHistory: { value: TRAJECTORY_HISTORY_SECONDS.short }, uGalactic: { value: 1 },
        uForward: { value: new THREE.Vector3(...TRAJECTORY_FORWARD) },
        uColor: { value: new THREE.Color(definition.color) },
        uOpacity: { value: definition.id === 'sun' ? .8 : .9 },
        uHalfWidth: { value: definition.id === 'sun' ? 2.2 : 1.7 },
        uPixelRatio: { value: pixels }, uResolution: { value: new THREE.Vector2(1, 1) },
      }, vertexShader: trailVertex, fragmentShader: trailFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, forceSinglePass: true,
    });
    ownedMaterials.push(trailMaterial);
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.name = `trajectory-trail-${definition.id}`;
    trail.userData.trajectoryBodyId = definition.id;
    group.add(trail);
    const entry = { definition, mesh, halo, trail, material, trailMaterial };

    if (definition.id === 'saturn') {
      const geometry = new THREE.RingGeometry(1.25, 2.1, 96, 1);
      const positions = geometry.attributes.position, uv = geometry.attributes.uv;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const radius = Math.hypot(positions.getX(vertex), positions.getY(vertex));
        uv.setXY(vertex, (radius - 1.25) / .85, .5);
      }
      geometry.rotateX(-Math.PI / 2);
      extras.push(geometry);
      const ringMaterial = surfaceMaterial(definition, surfaceTextures['saturn-rings'], { rings: true });
      const rings = new THREE.Mesh(geometry, ringMaterial);
      rings.name = 'trajectory-saturn-rings';
      mesh.add(rings);
      entry.ringMaterial = ringMaterial;
    }
    entries.push(entry);
  }

  function updateCurrentPositions() {
    for (const { definition, mesh, halo, material, ringMaterial, trailMaterial } of entries) {
      sampleTrajectoryPosition(definition, time, 0, referenceFrame, mesh.position);
      mesh.rotation.y = time * (definition.id === 'sun' ? .06 : .15) + definition.phase;
      halo.position.copy(mesh.position);
      const direction = material.uniforms.uLightDirection.value;
      if (definition.id === 'sun') direction.set(1, 0, 0);
      else {
        // Both the normal and this host direction live in the body's own
        // coordinates. Moving or rotating the entire group cannot alter light.
        inverseRotation.copy(mesh.quaternion).invert();
        direction.copy(mesh.position).negate().normalize().applyQuaternion(inverseRotation);
      }
      ringMaterial?.uniforms.uLightDirection.value.copy(direction);
      trailMaterial.uniforms.uAngle.value = definition.phase
        + (definition.period ? (time % definition.period) / definition.period * TAU : 0);
    }
  }

  function updateHistory() {
    for (const { definition, trail, trailMaterial } of entries) {
      trail.visible = galacticMix > 0 || definition.orbitRadius > 0;
      trailMaterial.uniforms.uHistory.value = renderedHistory;
      trailMaterial.uniforms.uGalactic.value = galacticMix;
      // Repeated loops occupy the same path in the solar frame. Normalize
      // their additive contribution instead of washing out the inner orbits.
      const repeated = definition.period ? Math.max(1, renderedHistory / definition.period) : 1;
      const compensation = THREE.MathUtils.lerp(1 / repeated, 1, galacticMix);
      trailMaterial.uniforms.uOpacity.value = definition.id === 'sun'
        ? .8 * galacticMix : .9 * compensation;
    }
  }

  function beginHistoryTransition() {
    if (motionPreference?.matches) {
      galacticMix = Number(referenceFrame === 'galactic');
      renderedHistory = TRAJECTORY_HISTORY_SECONDS[trailLength];
      historyTransition = null;
      updateHistory();
      return;
    }
    if (galacticMix === Number(referenceFrame === 'galactic')
      && renderedHistory === TRAJECTORY_HISTORY_SECONDS[trailLength]) {
      historyTransition = null;
      return;
    }
    historyTransition = { galacticMix, renderedHistory, elapsed: 0 };
  }

  function updateHistoryTransition(dt) {
    if (!historyTransition) return;
    historyTransition.elapsed += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const progress = motionPreference?.matches ? 1 : Math.min(1, historyTransition.elapsed / .4);
    const eased = THREE.MathUtils.smoothstep(progress, 0, 1);
    galacticMix = THREE.MathUtils.lerp(historyTransition.galacticMix, Number(referenceFrame === 'galactic'), eased);
    renderedHistory = THREE.MathUtils.lerp(historyTransition.renderedHistory, TRAJECTORY_HISTORY_SECONDS[trailLength], eased);
    if (progress === 1) historyTransition = null;
    updateHistory();
  }

  function update(dt, { paused: shouldPause = false, speed = 1, active: shouldShow = false } = {}) {
    if (disposed) return;
    active = Boolean(shouldShow);
    paused = Boolean(shouldPause);
    group.visible = active;
    if (!active) return;
    // Changing the explanatory frame is a UI transition, not simulated time:
    // it remains available while playback is paused and ignores its speed.
    updateHistoryTransition(dt);
    if (paused || motionPreference?.matches) return;
    const step = Number.isFinite(dt) && Number.isFinite(speed) && dt > 0 && speed > 0 ? dt * speed : 0;
    if (!Number.isFinite(step) || step <= 0) return;
    time += step;
    updateCurrentPositions();
  }

  function setReferenceFrame(next) {
    if (disposed || !validFrame(next)) return false;
    if (referenceFrame === next) return true;
    referenceFrame = next;
    beginHistoryTransition();
    return true;
  }

  function setTrailLength(next) {
    if (disposed || !Object.hasOwn(TRAJECTORY_HISTORY_SECONDS, next)) return false;
    if (trailLength === next) return true;
    trailLength = next;
    beginHistoryTransition();
    return true;
  }

  function resize(nextPixels) {
    if (disposed) return;
    if (Number.isFinite(nextPixels) && nextPixels > 0) pixelRatio = nextPixels;
    const width = Math.max(1, globalThis.innerWidth || 1440), height = Math.max(1, globalThis.innerHeight || 900);
    for (const { trailMaterial } of entries) {
      trailMaterial.uniforms.uPixelRatio.value = pixelRatio;
      trailMaterial.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    }
  }

  function getCenter(out = new THREE.Vector3()) {
    return out.fromArray(TRAJECTORY_FORWARD).multiplyScalar(-renderedHistory * galacticMix * .5);
  }

  function getState() {
    const bounds = boundsForDuration(renderedHistory * galacticMix);
    return { time, active, paused, referenceFrame, trailLength,
      historySeconds: TRAJECTORY_HISTORY_SECONDS[trailLength], sampleCount: TRAJECTORY_SAMPLE_COUNT,
      renderedHistorySeconds: renderedHistory, galacticMix, transitioning: Boolean(historyTransition),
      pixelRatio, reducedMotion: Boolean(motionPreference?.matches), forward: [...TRAJECTORY_FORWARD],
      center: [...bounds.center], bounds,
      bodies: entries.map(({ definition, mesh }) => ({ id: definition.id, cn: definition.cn,
        color: definition.color, orbitRadius: definition.orbitRadius, period: definition.period,
        r: definition.r, position: mesh.position.toArray() })),
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    group.visible = false;
    group.removeFromParent();
    sphere.dispose();
    trailGeometry.dispose();
    haloMap.dispose();
    fallbackMap.dispose();
    extras.forEach(geometry => geometry.dispose());
    ownedMaterials.forEach(material => material.dispose());
    // Original texture maps are borrowed from the universe and stay alive.
  }

  updateCurrentPositions();
  resize(pixels);
  return { group, update, setReferenceFrame, setTrailLength, getState, getCenter, resize, dispose };
}
