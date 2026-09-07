import * as THREE from 'three';
import { eventRandom, surfaceFrame, surfacePoint } from './weather-state.js';

export const RAIN_EFFECTS = Object.freeze({
  width: .0007, opacity: .55, tint: '#9cd9ff', baseAltitude: .003, referenceColumnHeight: .05,
});

/** Instanced camera-facing rain ribbons animate in the shader, with no per-frame allocations. */
export function createRain() {
  const group = new THREE.Group();
  group.name = 'Local weather rain';
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5, 0, 0, .5, 0, 0, -.5, 1, 0, -.5, 1, 0, .5, 0, 0, .5, 1, 0,
  ], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uWidth: { value: RAIN_EFFECTS.width },
      uColor: { value: new THREE.Color(RAIN_EFFECTS.tint) }, uOpacity: { value: RAIN_EFFECTS.opacity },
    },
    vertexShader: `
      attribute vec3 aBase; attribute vec3 aNormal; attribute vec3 aTangent; attribute vec4 aDrop;
      uniform float uTime; uniform float uWidth; varying float vAlpha; varying float vTrail;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        float phase = fract(uTime * aDrop.z + aDrop.y);
        // The bright head falls first; its trailing end never extends above the cloud base.
        float height = max(0.0, aDrop.x - aDrop.w) * (1.0 - phase);
        vec3 direction = normalize(aNormal + aTangent * .28);
        vec3 local = aBase + aNormal * height + aTangent * (height * .28);
        local += direction * position.y * aDrop.w;
        vec4 world = modelMatrix * vec4(local, 1.0);
        vec3 worldDirection = normalize(mat3(modelMatrix) * direction);
        vec3 side = cross(worldDirection, normalize(cameraPosition - world.xyz));
        side = length(side) > .02 ? normalize(side) : normalize(mat3(modelMatrix) * aTangent);
        world.xyz += side * position.x * uWidth;
        vTrail = position.y; vAlpha = sin(phase * 3.14159);
        gl_Position = projectionMatrix * viewMatrix * world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vTrail; varying float vAlpha;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, (1.0 - vTrail * .7) * vAlpha * uOpacity);
        #include <logdepthbuf_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  group.add(mesh);

  function setEvents(appearances) {
    geometry.dispose();
    const bases = [], normals = [], tangents = [], drops = [];
    for (const { event, drops: count, altitude, rainSpread, rainSpeed, rainLength } of appearances) {
      const frame = surfaceFrame(event);
      const columnHeight = Math.max(.004, altitude - RAIN_EFFECTS.baseAltitude);
      for (let drop = 0; drop < count; drop++) {
        const angle = eventRandom(event, 700 + drop) * Math.PI * 2;
        const spread = Math.sqrt(eventRandom(event, 800 + drop)) * rainSpread;
        const base = surfacePoint(frame, Math.cos(angle) * spread, Math.sin(angle) * spread, RAIN_EFFECTS.baseAltitude);
        bases.push(...base.toArray()); normals.push(...base.clone().normalize().toArray()); tangents.push(...frame.east.toArray());
        // Scale the former tall rain trails into the available shallow atmosphere.
        const trailLength = Math.min(columnHeight * .55,
          rainLength * columnHeight / RAIN_EFFECTS.referenceColumnHeight * (.8 + eventRandom(event, 1000 + drop) * .4));
        drops.push(columnHeight, eventRandom(event, 900 + drop), rainSpeed, trailLength);
      }
    }
    geometry.setAttribute('aBase', new THREE.InstancedBufferAttribute(new Float32Array(bases), 3));
    geometry.setAttribute('aNormal', new THREE.InstancedBufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('aTangent', new THREE.InstancedBufferAttribute(new Float32Array(tangents), 3));
    geometry.setAttribute('aDrop', new THREE.InstancedBufferAttribute(new Float32Array(drops), 4));
    geometry.instanceCount = drops.length / 4;
    group.userData.drops = geometry.instanceCount;
    group.visible = geometry.instanceCount > 0;
  }

  return {
    group, setEvents,
    update(time, { reducedMotion = false } = {}) { material.uniforms.uTime.value = reducedMotion ? 0 : time; },
    dispose() { geometry.dispose(); material.dispose(); group.removeFromParent(); },
  };
}
