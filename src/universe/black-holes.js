import * as THREE from 'three';

// An explorable illustration, not a relativistic ray tracer. A continuous
// lens field joins the bent disk above/below the shadow to its thin side wings.
// The underlying sphere and disk retain real geometry for orbiting and picking.
const vertexShader = `
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const diskFragment = `
  uniform vec3 uColor, uViewDirection;
  uniform float uTime, uSeed, uOuterRadius;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 p = vLocal.xz;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float flow = angle - uTime * 0.48 / pow(radius, 1.5) + uSeed;
    vec2 advected = vec2(cos(flow), sin(flow)) * radius;
    float turbulence = noise(advected * 7.0) * 0.55
      + noise(advected * 19.0) * 0.30 + noise(advected * 51.0) * 0.15;
    float filaments = 0.5 + 0.5 * sin(radius * 78.0
      + sin(flow * 7.0) * 0.8 + turbulence * 5.0);
    float wisps = 0.5 + 0.5 * sin(radius * 29.0 - flow * 5.0 + turbulence * 2.0);
    float heat = pow(clamp(1.0 - (radius - 1.24) / (uOuterRadius - 1.24), 0.0, 1.0), 1.35);
    vec3 outerColor = mix(vec3(0.25, 0.036, 0.008), uColor * 0.24, 0.38);
    vec3 innerColor = mix(uColor, vec3(1.0, 0.88, 0.65), heat * 0.70);
    vec3 color = mix(outerColor, innerColor, heat);
    vec3 tangent = normalize(vec3(-p.y, 0.0, p.x));
    float approach = dot(tangent, normalize(uViewDirection));
    float brightness = (0.48 + filaments * 0.46 + wisps * 0.22 + turbulence * 0.32)
      * (1.0 + approach * 0.38);
    float edge = smoothstep(1.24, 1.39, radius)
      * (1.0 - smoothstep(uOuterRadius * 0.79, uOuterRadius, radius));
    float alpha = edge * (0.52 + heat * 0.43);
    // Near the disk plane, the lens field below renders the whole visible disk
    // together. Rendering the physical front half too would fill the shadow
    // with a broad orange ellipse. Steeper views reveal the physical disk.
    float physicalDisk = smoothstep(0.16, 0.55, abs(uViewDirection.y));
    gl_FragColor = vec4(min(color * brightness * (0.62 + heat * 0.62), vec3(1.1)),
      alpha * physicalDisk);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const photonFragment = `
  uniform vec3 uColor;
  uniform vec2 uDiskAxis;
  uniform float uTime, uInclination;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = vec2(dot(vLocal.xy, uDiskAxis),
      dot(vLocal.xy, vec2(-uDiskAxis.y, uDiskAxis.x)));
    // Only this hairline foreground image is allowed across the dark center.
    // Its width stays sub-percent of the shadow, with pixel antialiasing.
    float width = max(0.005, fwidth(p.y) * 0.48);
    float line = exp(-pow(p.y / width, 2.0));
    float ends = 1.0 - smoothstep(1.025, 1.15, abs(p.x));
    float lensStrength = 1.0 - smoothstep(0.16, 0.38, 1.0 - uInclination);
    float detail = 0.88 + 0.12 * sin(p.x * 21.0 - uTime * 0.1);
    float alpha = line * ends * lensStrength * detail * 0.83;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.83, 0.58), 0.85), alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const lensFragment = `
  uniform vec3 uColor;
  uniform vec2 uDiskAxis;
  uniform float uTime, uInclination, uOuterRadius, uSeed;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float smoothUnion(float a, float b, float softness) {
    float h = clamp(0.5 + 0.5 * (b - a) / softness, 0.0, 1.0);
    return mix(b, a, h) - softness * h * (1.0 - h);
  }
  void main() {
    vec2 p = vec2(dot(vLocal.xy, uDiskAxis),
      dot(vLocal.xy, vec2(-uDiskAxis.y, uDiskAxis.x)));
    float radius = length(p);
    // No transparent orange wash or procedural glow is drawn inside the
    // shadow. The separate, very thin foreground disk is its only crossing.
    if (radius < 1.005) discard;
    float faceOn = 1.0 - uInclination;
    float lensStrength = 1.0 - smoothstep(0.22, 0.55, faceOn);
    if (lensStrength < 0.002 || abs(p.x) > uOuterRadius * 0.98) discard;
    float opening = max(0.009, faceOn * mix(0.22, 1.0, smoothstep(0.12, 0.55, faceOn)));
    vec2 axes = vec2(uOuterRadius, max(0.035, uOuterRadius * opening));
    float ellipseRadius = length(p / axes);
    float ellipseGradient = length(p / (axes * axes));
    float diskDistance = ellipseRadius * (ellipseRadius - 1.0) / max(ellipseGradient, 0.001);
    float shadowDistance = radius - 1.065;
    // One smooth signed field produces both the upper/lower bending and the
    // narrow wings. The necks are continuous rather than overlapping circles.
    float field = smoothUnion(shadowDistance, diskDistance, 0.22);
    // Most of the enclosing camera plane is empty sky; skip its noise work.
    if (field > 0.72) discard;
    float width = mix(0.170, 0.023, smoothstep(0.85, 1.85, abs(p.x)));
    float layer = field / width;
    float angle = atan(p.y, p.x);
    float flow = angle - uTime * 0.08 / max(1.0, radius) + uSeed;
    vec2 advected = vec2(cos(flow), sin(flow)) * radius;
    float turbulence = noise(advected * 5.0) * 0.52 + noise(advected * 17.0) * 0.32
      + noise(advected * 43.0) * 0.16;
    float warpedLayer = layer + (turbulence - 0.5) * 0.28
      + sin(flow * 3.0 + layer * 1.8) * 0.085;
    float stream = pow(0.5 + 0.5 * sin(warpedLayer * 18.0
      + turbulence * 5.0 + sin(flow * 7.0) * 0.8), 0.72);
    float fine = 0.5 + 0.5 * sin(warpedLayer * 43.0 + turbulence * 8.0);
    float envelope = exp(-pow((layer - 0.32) / 1.03, 2.0));
    float layers = envelope * (0.52 + stream * 0.36 + fine * 0.12);

    // Uncompress the wings into disk coordinates: their interior shows
    // differential rotation and curled filaments, not two parallel outlines.
    vec2 diskPoint = vec2(p.x, p.y / opening);
    float diskRadius = max(1.0, length(diskPoint));
    float diskFlow = atan(diskPoint.y, diskPoint.x)
      - uTime * 0.32 / pow(diskRadius, 1.5) + uSeed;
    vec2 diskAdvection = vec2(cos(diskFlow), sin(diskFlow)) * diskRadius;
    float diskNoise = noise(diskAdvection * 5.0) * 0.65 + noise(diskAdvection * 19.0) * 0.35;
    float diskFilaments = 0.5 + 0.5 * sin(diskRadius * 25.0
      + diskNoise * 7.0 + sin(diskFlow * 5.0) * 1.4);
    float diskInterior = (1.0 - smoothstep(0.95, 1.01, ellipseRadius))
      * smoothstep(1.08, 1.50, abs(p.x)) * (0.18 + diskFilaments * 0.39 + diskNoise * 0.12);
    float haloWidth = mix(0.25, 0.045, smoothstep(0.85, 1.90, abs(p.x)));
    float halo = exp(-pow(max(field, 0.0) / haloWidth, 2.0))
      * smoothstep(0.1, 0.65, layer) * 0.15;
    float outerFade = 1.0 - smoothstep(uOuterRadius * 0.70, uOuterRadius * 0.98, abs(p.x));
    float shadowMask = smoothstep(1.005, 1.035, radius);
    float asymmetry = mix(0.77, 1.0, smoothstep(-0.3, 0.3, p.y))
      * (0.93 + 0.07 * sin(flow));
    float bandAlpha = min(0.98, layers + diskInterior) * asymmetry;
    float alpha = min(0.99, bandAlpha + halo) * lensStrength * outerFade * shadowMask;
    if (alpha < 0.002) discard;
    float heat = clamp(1.0 - (layer + 0.25) / 2.5, 0.0, 1.0);
    vec3 orange = mix(vec3(0.39, 0.072, 0.012), vec3(1.08, 0.56, 0.18), heat);
    float hotStrand = pow(clamp(heat * 0.55 + stream * 0.45, 0.0, 1.0), 1.3);
    vec3 color = mix(orange, vec3(1.12, 0.98, 0.77), hotStrand * 0.81);
    color = mix(color, color * mix(vec3(1.0), uColor, 0.25), 0.25);
    color = (color * bandAlpha + vec3(0.85, 0.28, 0.065) * halo)
      / max(bandAlpha + halo, 0.001);
    // Local soft edges provide the glow. Bounded energy keeps postprocessing
    // bloom from bleaching the layered filaments or washing the shadow brown.
    gl_FragColor = vec4(color, alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function illustrationMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    forceSinglePass: true,
  });
}

/** Owns one black-hole illustration and all of its GPU resources. */
export function createBlackHole(definition) {
  const radius = definition.r;
  const outerRadius = Math.max(2.0, definition.diskOuterRadius ?? 4.5);
  const color = new THREE.Color(definition.color ?? 0xffaa56);
  const group = new THREE.Group();
  group.name = definition.id;
  group.userData.bodyId = definition.id;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 72, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  mesh.name = `${definition.id}-shadow`;
  group.add(mesh);

  const diskGeometry = new THREE.RingGeometry(1.24, outerRadius, 180, 32);
  diskGeometry.rotateX(-Math.PI / 2);
  const seed = [...definition.id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  const accretionDisk = new THREE.Mesh(diskGeometry, illustrationMaterial(diskFragment, {
    uTime: { value: 0 }, uSeed: { value: seed / 4294967296 * Math.PI * 2 },
    uColor: { value: color.clone() }, uOuterRadius: { value: outerRadius },
    uViewDirection: { value: new THREE.Vector3(0.45, 0.38, 1).normalize() },
  }));
  accretionDisk.name = `${definition.id}-accretion-disk`;
  accretionDisk.scale.setScalar(radius);
  accretionDisk.rotation.fromArray(definition.diskTilt ?? [0.12, 0, -0.22]);
  accretionDisk.renderOrder = 1;
  group.add(accretionDisk);

  const photonRing = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5),
    illustrationMaterial(photonFragment, {
      uTime: { value: 0 }, uColor: { value: color.clone() },
      uDiskAxis: { value: new THREE.Vector2(1, 0) }, uInclination: { value: 0.94 },
    }));
  photonRing.name = `${definition.id}-foreground-photon-image`;
  photonRing.scale.setScalar(radius);
  photonRing.material.depthTest = false;
  photonRing.renderOrder = 3;
  group.add(photonRing);

  const lensedArcs = new THREE.Mesh(new THREE.PlaneGeometry((outerRadius + 0.4) * 2, (outerRadius + 0.4) * 2),
    illustrationMaterial(lensFragment, {
      uTime: { value: 0 }, uColor: { value: color.clone() }, uInclination: { value: 0.94 },
      uDiskAxis: { value: new THREE.Vector2(1, 0) }, uOuterRadius: { value: outerRadius },
      uSeed: { value: seed / 4294967296 * Math.PI * 2 },
    }));
  lensedArcs.name = `${definition.id}-lensed-light-illustration`;
  lensedArcs.scale.setScalar(radius);
  lensedArcs.renderOrder = 2;
  group.add(lensedArcs);
  group.traverse(object => { object.userData.bodyId = definition.id; });

  const inverseDisk = new THREE.Matrix4(), worldCamera = new THREE.Vector3();
  const cameraQuaternion = new THREE.Quaternion(), parentQuaternion = new THREE.Quaternion();
  const cameraInverse = new THREE.Quaternion(), diskNormal = new THREE.Vector3();
  let disposed = false;

  function update(time) {
    if (disposed || !Number.isFinite(time)) return;
    for (const object of [accretionDisk, photonRing, lensedArcs]) {
      object.material.uniforms.uTime.value = time;
    }
  }

  function updateCamera(camera) {
    if (disposed) return;
    group.updateWorldMatrix(true, true);
    camera.getWorldPosition(worldCamera);
    inverseDisk.copy(accretionDisk.matrixWorld).invert();
    const direction = accretionDisk.material.uniforms.uViewDirection.value;
    direction.copy(worldCamera).applyMatrix4(inverseDisk).normalize();
    lensedArcs.material.uniforms.uInclination.value = 1 - Math.abs(direction.y);
    photonRing.material.uniforms.uInclination.value = 1 - Math.abs(direction.y);
    camera.getWorldQuaternion(cameraQuaternion);
    cameraInverse.copy(cameraQuaternion).invert();
    diskNormal.set(0, 1, 0).transformDirection(accretionDisk.matrixWorld).applyQuaternion(cameraInverse);
    const axis = lensedArcs.material.uniforms.uDiskAxis.value;
    // The intersection of the disk and image planes is the projected major
    // axis. Keep a stable axis at the pole, where the view becomes circular.
    if (Math.hypot(diskNormal.x, diskNormal.y) > 0.0001) {
      axis.set(diskNormal.y, -diskNormal.x).normalize();
    }
    photonRing.material.uniforms.uDiskAxis.value.copy(axis);
    group.getWorldQuaternion(parentQuaternion).invert();
    photonRing.quaternion.copy(parentQuaternion).multiply(cameraQuaternion);
    lensedArcs.quaternion.copy(photonRing.quaternion);
  }

  // The portrait borrows this model without changing the exploration animation or lens orientation.
  function renderPreview(camera, time, render) {
    const objects = [accretionDisk, photonRing, lensedArcs];
    const saved = objects.map(object => ({
      quaternion: object.quaternion.clone(),
      uniforms: Object.fromEntries(Object.entries(object.material.uniforms).map(([key, uniform]) =>
        [key, uniform.value?.clone ? uniform.value.clone() : uniform.value])),
    }));
    try { update(time); updateCamera(camera); return render(); }
    finally {
      objects.forEach((object, index) => {
        object.quaternion.copy(saved[index].quaternion);
        for (const [key, value] of Object.entries(saved[index].uniforms)) {
          const uniform = object.material.uniforms[key];
          if (uniform.value?.copy) uniform.value.copy(value); else uniform.value = value;
        }
      });
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const object of [mesh, accretionDisk, photonRing, lensedArcs]) {
      object.geometry.dispose();
      object.material.dispose();
    }
  }

  return {
    group, mesh, accretionDisk, photonRing, lensedArcs,
    // Billboard planes contain transparent pixels. Pick only actual surfaces.
    pickMeshes: [mesh, accretionDisk], visualRadius: radius * outerRadius,
    update, updateCamera, renderPreview, dispose,
  };
}
