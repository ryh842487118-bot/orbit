import * as THREE from 'three';

// An explorable illustration: the shadow and disk have real 3D geometry; the
// photon ring and faint bent-light arcs suggest lensing without ray tracing.
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
    gl_FragColor = vec4(color * brightness * (0.72 + heat * 1.05), alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const photonFragment = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    float radius = length(vLocal.xy);
    float core = exp(-pow((radius - 1.065) / 0.018, 2.0));
    float glow = exp(-pow((radius - 1.075) / 0.065, 2.0)) * 0.32;
    // Keep the shadow entirely black; the light lives outside its silhouette.
    float mask = smoothstep(1.005, 1.025, radius);
    float angle = atan(vLocal.y, vLocal.x);
    float uneven = 0.85 + 0.15 * sin(angle - uTime * 0.045);
    float alpha = (core * 0.93 + glow) * mask * uneven;
    if (alpha < 0.002) discard;
    vec3 color = mix(uColor, vec3(1.0, 0.94, 0.82), core * 0.78);
    gl_FragColor = vec4(color * (1.15 + core * 0.8), alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const lensFragment = `
  uniform vec3 uColor;
  uniform float uTime, uInclination;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = vLocal.xy;
    float ellipse = length(vec2(p.x, p.y * 1.45));
    float arc = exp(-pow((ellipse - 1.79) / 0.035, 2.0));
    float haze = exp(-pow((ellipse - 1.81) / 0.13, 2.0)) * 0.19;
    float upper = smoothstep(0.08, 0.62, p.y);
    float lower = smoothstep(0.08, 0.52, -p.y) * 0.22;
    float angle = atan(p.y, p.x);
    float streams = 0.75 + 0.25 * sin(angle * 13.0 - uTime * 0.1);
    float alpha = (arc + haze) * (upper + lower) * streams * uInclination * 0.27;
    // A face-on disk needs almost no lens arc; edge-on views reveal more.
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.77, 0.43), 0.35) * 1.3, alpha);
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
    }));
  photonRing.name = `${definition.id}-photon-ring`;
  photonRing.scale.setScalar(radius);
  photonRing.renderOrder = 2;
  group.add(photonRing);

  const lensedArcs = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4),
    illustrationMaterial(lensFragment, {
      uTime: { value: 0 }, uColor: { value: color.clone() }, uInclination: { value: 0.6 },
    }));
  lensedArcs.name = `${definition.id}-lensed-light-illustration`;
  lensedArcs.scale.setScalar(radius);
  lensedArcs.renderOrder = 2;
  group.add(lensedArcs);
  group.traverse(object => { object.userData.bodyId = definition.id; });

  const inverseDisk = new THREE.Matrix4(), worldCamera = new THREE.Vector3();
  const cameraQuaternion = new THREE.Quaternion(), parentQuaternion = new THREE.Quaternion();
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
    camera.getWorldQuaternion(cameraQuaternion);
    group.getWorldQuaternion(parentQuaternion).invert();
    photonRing.quaternion.copy(parentQuaternion).multiply(cameraQuaternion);
    lensedArcs.quaternion.copy(photonRing.quaternion);
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
    update, updateCamera, dispose,
  };
}
