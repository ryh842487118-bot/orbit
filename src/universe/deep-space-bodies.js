import * as THREE from 'three';
import { createBlackHole } from './black-holes.js';

const TAU = Math.PI * 2;

// These surfaces are procedural illustrations. They do not use photographs of
// Solar System planets to suggest resolved observations of distant worlds.
const surfaceVertex = `
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vSurface = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const noiseFunctions = `
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1, 0, 0)), f.x),
          mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), f.x),
          mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float turbulence(vec3 p) {
    return noise3(p) * 0.58 + noise3(p * 2.07 + 13.7) * 0.28
      + noise3(p * 4.11 - 7.3) * 0.14;
  }
`;

const starFragment = `
  uniform vec3 uColor, uHotColor;
  uniform float uTime, uSeed, uCells, uEmission;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    vec3 drift = vec3(uTime * 0.015, -uTime * 0.008, uSeed);
    float convection = turbulence(p * 5.0 + drift * 0.4);
    vec3 warped = p * uCells + convection * 2.5 + drift;
    float cells = noise3(warped);
    float grains = noise3(warped * 3.7 + 8.3);
    // Smooth dark seams and bright cell interiors, with larger convection
    // structures on red supergiants than on compact blue and gold stars.
    float seams = smoothstep(0.28, 0.58, cells);
    float granular = mix(0.42, 1.10, seams) + (grains - 0.5) * 0.20;
    float hotRegions = smoothstep(0.48, 0.82, convection);
    vec3 surface = mix(uColor, uHotColor, 0.15 + hotRegions * 0.48);
    float mu = clamp(dot(normalize(vWorldNormal),
      normalize(cameraPosition - vWorldPosition)), 0.0, 1.0);
    float limb = 0.42 + 0.58 * sqrt(mu);
    vec3 emitted = surface * granular * limb * uEmission;
    gl_FragColor = vec4(max(emitted, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const planetFragment = `
  uniform vec3 uColor, uBandColor, uLightDirection, uLightColor;
  uniform float uTime, uSeed, uIce;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    float weather = turbulence(p * 7.0 + vec3(uSeed, uTime * 0.008, 0.0));
    float fine = noise3(p * 43.0 + weather * 1.2 + uSeed);
    float latitude = p.y + (weather - 0.5) * mix(0.070, 0.020, uIce);
    float bands = sin(latitude * mix(55.0, 29.0, uIce) + uSeed);
    float narrowBands = sin(latitude * 143.0 + fine * 1.3) * 0.12;
    float cloudBelt = smoothstep(-0.50, 0.60, bands + narrowBands);
    vec3 surface = mix(uColor, uBandColor, cloudBelt * mix(0.82, 0.42, uIce));
    surface *= 0.90 + weather * 0.17 + fine * 0.12;

    // One local oval cloud vortex, expressed on the sphere without a UV seam.
    // Its placement and palette are artistic, not claimed observations.
    float longitude = atan(p.z, abs(p.x) + abs(p.z) < 0.00001 ? 0.00001 : p.x);
    float stormLongitude = sin(longitude - uSeed * 0.73);
    float facingStorm = smoothstep(0.0, 0.35, cos(longitude - uSeed * 0.73));
    vec2 storm = vec2(stormLongitude * 6.0, (p.y + 0.23) * 15.0);
    float stormRadius = length(storm);
    float vortex = (1.0 - smoothstep(0.50, 1.0, stormRadius)) * facingStorm;
    float stormAngle = atan(storm.y,
      abs(storm.x) + abs(storm.y) < 0.00001 ? 0.00001 : storm.x);
    float spiral = 0.5 + 0.5 * sin(stormRadius * 23.0
      - stormAngle * 2.0 + weather * 4.0);
    vec3 stormColor = mix(uBandColor * 0.70, uColor * 1.20, spiral);
    surface = mix(surface, stormColor, vortex * mix(0.85, 0.48, uIce));

    vec3 n = normalize(vWorldNormal), viewDir = normalize(cameraPosition - vWorldPosition);
    float sunlight = dot(n, normalize(uLightDirection));
    float diffuse = max(sunlight, 0.0);
    // Each planet is lit by its own host. No scene-wide lights are introduced.
    vec3 illumination = vec3(0.012) + uLightColor * pow(diffuse, 0.82) * 1.28;
    float rim = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 4.0);
    vec3 haze = mix(uColor, vec3(0.55, 0.76, 0.94), 0.45)
      * rim * smoothstep(-0.16, 0.45, sunlight) * 0.25;
    gl_FragColor = vec4(max(surface * illumination + haze, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphereFragment = `
  uniform vec3 uColor, uLightDirection;
  uniform float uStrength, uStar, uTime;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec3 n = normalize(vWorldNormal), v = normalize(cameraPosition - vWorldPosition);
    float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.1);
    float sunward = smoothstep(-0.24, 0.62, dot(n, normalize(uLightDirection)));
    float light = mix(0.06 + sunward * 0.94, 1.0, uStar);
    float wisps = 0.9 + 0.1 * sin(vSurface.y * 31.0 + vSurface.x * 19.0 + uTime * 0.12);
    gl_FragColor = vec4(uColor * mix(1.1, 1.7, uStar),
      clamp(rim * uStrength * light * mix(1.0, wisps, uStar), 0.0, 1.0));
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Terrestrial palettes are imagined compositions, not resolved exoplanet maps.
// Work in sphere coordinates so terrain and clouds have no longitude seam.
const terrestrialFragment = `
  uniform vec3 uColor, uLightDirection, uLightColor;
  uniform float uTime, uSeed, uTerrain;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    vec3 offset = vec3(uSeed, uSeed * 0.37, -uSeed * 0.61);
    float continental = turbulence(p * 3.8 + offset);
    float relief = turbulence(p * 17.0 + offset + continental * 2.5);
    float grains = noise3(p * 94.0 + offset);
    float ridges = 1.0 - abs(noise3(p * 29.0 + offset) * 2.0 - 1.0);
    float land = smoothstep(0.47, 0.55, continental);
    float polar = smoothstep(0.67, 0.94, abs(p.y) + (relief - 0.5) * 0.27);
    float water = 0.0;
    vec3 surface;
    if (uTerrain < 1.5) {
      vec3 stone = mix(uColor * 0.34, uColor * 1.1 + vec3(0.1, 0.08, 0.06), relief);
      float basins = smoothstep(0.37, 0.54, continental);
      surface = stone * (0.61 + basins * 0.52) * (0.81 + grains * 0.26);
      surface *= 1.0 - pow(ridges, 14.0) * 0.16;
      surface = mix(surface, vec3(0.54, 0.57, 0.58), polar * 0.30);
    } else if (uTerrain < 2.5) {
      vec3 ocean = mix(uColor * 0.22, uColor * 0.78, smoothstep(0.30, 0.49, continental));
      vec3 rock = mix(vec3(0.12, 0.18, 0.15), vec3(0.51, 0.44, 0.31), relief);
      rock *= 0.83 + grains * 0.25;
      surface = mix(ocean, rock, land);
      surface = mix(surface, vec3(0.77, 0.84, 0.83), polar);
      water = (1.0 - land) * (1.0 - polar);
    } else {
      vec3 ice = mix(uColor * 0.46, vec3(0.81, 0.88, 0.88), relief * 0.7 + polar * 0.3);
      float fractures = pow(ridges, 19.0) * (0.45 + continental * 0.55);
      surface = ice * (0.84 + grains * 0.15) * (1.0 - fractures * 0.31);
      surface = mix(surface, uColor * 0.25, (1.0 - land) * 0.24);
    }

    vec3 cloudPoint = p * 6.5 + vec3(uTime * 0.007, 0.0, -uTime * 0.004) + offset;
    float cloudNoise = turbulence(cloudPoint + turbulence(cloudPoint * 0.7) * 1.8);
    float clouds = smoothstep(0.54, 0.73, cloudNoise) * (uTerrain < 1.5 ? 0.12 : 0.8);
    surface = mix(surface, vec3(0.85, 0.88, 0.87), clouds);
    vec3 n = normalize(vWorldNormal), light = normalize(uLightDirection);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float sunlight = dot(n, light), diffuse = max(sunlight, 0.0);
    vec3 illumination = vec3(0.012) + uLightColor * pow(diffuse, 0.82) * 1.28;
    float rim = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 4.0);
    vec3 haze = mix(uColor, vec3(0.55, 0.76, 0.94), 0.58)
      * rim * smoothstep(-0.16, 0.45, sunlight) * (uTerrain < 1.5 ? 0.08 : 0.25);
    vec3 halfDirection = normalize(light + viewDir + vec3(0.00001));
    float glint = pow(max(dot(n, halfDirection), 0.0), 65.0) * water * (1.0 - clouds) * diffuse;
    gl_FragColor = vec4(max(surface * illumination + haze + uLightColor * glint * 0.30, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function seedFromId(id) {
  let value = 2166136261;
  for (const character of id) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

function haloTexture() {
  const width = 64, pixels = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const radius = Math.hypot((x + 0.5) / width * 2 - 1, (y + 0.5) / width * 2 - 1);
      const alpha = Math.exp(-radius * radius * 7.5) * (1 - THREE.MathUtils.smoothstep(radius, 0.72, 1));
      const index = (y * width + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, width);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeSurface(definition, seed) {
  const star = definition.kind === 'star';
  const red = definition.surfaceStyle === 'red-star';
  const blue = definition.surfaceStyle === 'blue-star';
  const ice = definition.surfaceStyle === 'ice-giant';
  const terrain = ['rocky-world', 'temperate-world', 'ice-world'].indexOf(definition.surfaceStyle) + 1;
  const color = new THREE.Color(definition.color ?? (star ? 0xffb36a : 0xc99f73));
  const uniforms = {
    uColor: { value: color }, uTime: { value: 0 }, uSeed: { value: seed * 19.7 },
  };
  if (star) {
    Object.assign(uniforms, {
      uHotColor: { value: new THREE.Color(blue ? 0xe5f2ff : red ? 0xffc275 : 0xffe9b4) },
      uCells: { value: red ? 19 : blue ? 52 : 38 },
      uEmission: { value: blue ? 1.65 : red ? 2.0 : 2.15 },
    });
  } else {
    Object.assign(uniforms, {
      uBandColor: { value: color.clone().lerp(new THREE.Color(ice ? 0xd7f5f5 : 0x613b27), ice ? 0.48 : 0.54) },
      uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
      uLightColor: { value: new THREE.Color(0xffffff) }, uIce: { value: Number(ice) },
      uTerrain: { value: terrain },
    });
  }
  return new THREE.ShaderMaterial({ uniforms, vertexShader: surfaceVertex,
    fragmentShader: star ? starFragment : terrain ? terrestrialFragment : planetFragment });
}

/** Independent, illustrative stellar systems for destinations beyond the Sun. */
export function createDeepSpaceBodies(scene, textures, definitions = []) {
  // Keep the constructor compatible with createPlanets without importing or
  // allocating any observational surface textures for these distant bodies.
  void textures;
  const root = new THREE.Group();
  root.name = 'deep-space-bodies';
  const bodies = new Map(), orbitLines = [], systems = [], blackHoleModels = new Map();
  const sphere = new THREE.SphereGeometry(1, 80, 48), haloMap = haloTexture();
  const ringPoints = Array.from({ length: 160 }, (_, index) => {
    const angle = index / 160 * TAU;
    return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  });
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
  const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let time = 0, disposed = false;
  scene.add(root);

  for (const definition of definitions) {
    if (definition.kind === 'black-hole') {
      const model = createBlackHole(definition);
      const { group, mesh, accretionDisk, photonRing, lensedArcs, pickMeshes, visualRadius } = model;
      if (Array.isArray(definition.position)) group.position.fromArray(definition.position);
      else if (definition.position?.isVector3) group.position.copy(definition.position);
      else if (definition.position) group.position.set(definition.position.x, definition.position.y, definition.position.z);
      root.add(group);
      bodies.set(definition.id, {
        ...definition, visualRadius, renderPreview: model.renderPreview, position: group.position,
        group, mesh, accretionDisk, photonRing, lensedArcs, pickMeshes,
      });
      blackHoleModels.set(definition.id, model);
      continue;
    }
    if (definition.kind !== 'star' && definition.kind !== 'planet') continue;
    const seed = seedFromId(definition.id), group = new THREE.Group();
    group.name = definition.id;
    const material = makeSurface(definition, seed), mesh = new THREE.Mesh(sphere, material);
    mesh.name = `${definition.id}-surface`;
    mesh.scale.setScalar(definition.r);
    mesh.rotation.set(0, seed * TAU, definition.axialTilt ?? (definition.kind === 'planet' ? 0.10 + seed * 0.24 : 0));
    mesh.userData.bodyId = definition.id;
    group.add(mesh);
    root.add(group);
    const body = { ...definition, position: group.position, group, mesh };
    if (Array.isArray(definition.position)) group.position.fromArray(definition.position);
    else if (definition.position?.isVector3) group.position.copy(definition.position);
    else if (definition.position) group.position.set(definition.position.x, definition.position.y, definition.position.z);
    bodies.set(body.id, body);

    const star = definition.kind === 'star';
    const blueStar = star && definition.surfaceStyle === 'blue-star';
    const atmosphere = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(definition.color) }, uStrength: { value: blueStar ? 0.32 : star ? 0.45 : 0.48 },
        uStar: { value: Number(star) }, uTime: { value: 0 },
        uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: surfaceVertex, fragmentShader: atmosphereFragment,
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    atmosphere.name = `${definition.id}-${star ? 'corona' : 'atmosphere'}`;
    atmosphere.scale.setScalar(definition.r * (blueStar ? 1.03 : star ? 1.065 : 1.035));
    group.add(atmosphere);
    body.atmosphere = atmosphere;

    if (star) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloMap, color: definition.color, transparent: true,
        opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      halo.name = `${definition.id}-halo`;
      halo.scale.setScalar(definition.r * 5.1);
      group.add(halo);
      body.halo = halo;
    }
  }

  // A second pass accepts catalogs in either order and initializes every
  // orbit before the first camera flight or label projection.
  for (const body of bodies.values()) {
    if (body.kind !== 'planet') continue;
    const host = bodies.get(body.parentStarId ?? body.parentId);
    if (!host || host.kind !== 'star') {
      body.group.visible = body.mesh.visible = false;
      continue;
    }
    const seed = seedFromId(body.id), inclination = body.orbitalInclination ?? 0.06 + seed * 0.15;
    const radius = body.orbitRadius ?? host.r * 7;
    const line = new THREE.LineLoop(orbitGeometry, new THREE.LineBasicMaterial({
      color: body.color, transparent: true, opacity: 0.15, depthWrite: false,
    }));
    line.name = `${body.id}-orbit`;
    line.rotation.x = inclination;
    line.scale.setScalar(radius);
    line.userData.bodyId = body.id;
    line.userData.parentStarId = host.id;
    line.userData.baseOpacity = 0.15;
    line.visible = false;
    root.add(line);
    orbitLines.push(line);
    const lightColor = host.mesh.material.uniforms.uColor.value.clone()
      .lerp(new THREE.Color(0xffffff), 0.72);
    body.mesh.material.uniforms.uLightColor.value.copy(lightColor);
    systems.push({ body, host, line, radius, inclination,
      period: Math.max(1, body.orbitalPeriod ?? 100), phase: body.phase ?? seed * TAU });
  }

  function updatePositions() {
    for (const system of systems) {
      const { body, host, line, radius, inclination, period, phase } = system;
      const angle = phase + (time % period) / period * TAU;
      body.position.set(Math.cos(angle) * radius,
        -Math.sin(angle) * radius * Math.sin(inclination),
        Math.sin(angle) * radius * Math.cos(inclination)).add(host.position);
      line.position.copy(host.position);
      const direction = body.mesh.material.uniforms.uLightDirection.value;
      direction.subVectors(host.position, body.position).normalize();
      body.atmosphere.material.uniforms.uLightDirection.value.copy(direction);
    }
  }

  function update(dt, { paused = false, speed = 1 } = {}) {
    if (disposed) return;
    const step = !paused && !motionPreference?.matches && Number.isFinite(dt) && Number.isFinite(speed)
      ? Math.max(0, dt) * Math.max(0, speed) : 0;
    time += step;
    for (const body of bodies.values()) {
      if (body.kind === 'black-hole') {
        blackHoleModels.get(body.id).update(time);
        continue;
      }
      if (step > 0) body.mesh.rotation.y += step * (body.kind === 'star' ? 0.012 : 0.036);
      body.mesh.material.uniforms.uTime.value = time;
      body.atmosphere.material.uniforms.uTime.value = time;
    }
    updatePositions();
  }

  function updateVisibility(camera, { focusBody = null, activeGalaxyId = null, stage = null, orbitsVisible = true } = {}) {
    if (disposed) return;
    const focus = typeof focusBody === 'string' ? bodies.get(focusBody) : focusBody;
    const focusId = focus?.id ?? (typeof focusBody === 'string' ? focusBody : null);
    const focusedHost = focus?.kind === 'planet' ? focus.parentStarId ?? focus.parentId : focusId;
    const overview = stage === 'universe' || stage === 'local-group';
    for (const body of bodies.values()) {
      const distance = camera.position.distanceTo(body.position);
      const inSystem = body.id === focusedHost || (body.parentStarId ?? body.parentId) === focusedHost;
      const inGalaxy = !activeGalaxyId || body.parentGalaxy === activeGalaxyId;
      const threshold = body.r * (body.kind === 'black-hole' ? 1200 : body.kind === 'star' ? 900 : 260);
      const visible = body.id === focusId || (distance < threshold && (inGalaxy || inSystem));
      body.group.visible = body.mesh.visible = visible;
      if (body.kind === 'black-hole') {
        if (visible) blackHoleModels.get(body.id).updateCamera(camera);
        continue;
      }
      body.atmosphere.visible = visible && distance < body.r * 95;
      if (body.halo) {
        body.halo.material.opacity = (overview ? 0.14 : 0.22)
          * THREE.MathUtils.smoothstep(distance / body.r, 1.3, 3.0);
      }
    }
    for (const { body, host, line, radius } of systems) {
      const distance = camera.position.distanceTo(host.position);
      line.visible = orbitsVisible && distance < radius * 9
        && (!activeGalaxyId || host.parentGalaxy === activeGalaxyId || host.id === focusedHost);
      line.material.opacity = (body.id === focusId ? 0.23 : 0.13)
        * (1 - THREE.MathUtils.smoothstep(distance, radius * 5, radius * 9));
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    for (const model of blackHoleModels.values()) model.dispose();
    sphere.dispose();
    orbitGeometry.dispose();
    haloMap.dispose();
    root.traverse(object => object.material?.dispose());
  }

  updatePositions();
  return { bodies, orbitLines, update, updateVisibility, dispose };
}
