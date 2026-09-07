import * as THREE from 'three';
import { eventRandom, surfaceFrame, surfacePoint } from './weather-state.js';

export const LIGHTNING_EFFECTS = Object.freeze({ coreWidth: .00065, haloWidth: .0028, segments: 9, branches: 3 });

// Two brief local strokes per cycle. Never modulate the whole scene or the screen.
export const stormFlashGLSL = `
float stormFlash(float time, float phase, float period) {
  float t = mod(time + phase * max(period, 4.0), max(period, 4.0));
  return max(1.0 - smoothstep(0.025, 0.11, abs(t - 0.12)),
             (1.0 - smoothstep(0.018, 0.065, abs(t - 0.30))) * 0.75);
}`;

export function createLightningBolts() {
  const group = new THREE.Group();
  group.name = 'Local branched lightning';
  const geometry = new THREE.BufferGeometry();
  const uniforms = { uTime: { value: 0 }, uReducedMotion: { value: 0 } };
  const vertexShader = `
    attribute vec2 aStorm; varying vec2 vStorm;
    attribute vec3 aOther; attribute float aSide; attribute float aAcross; attribute float aPhase;
    uniform float uWidth; varying float vPhase; varying float vAcross;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec3 other = (modelMatrix * vec4(aOther, 1.0)).xyz;
      vec3 along = normalize(other - world.xyz);
      vec3 view = normalize(cameraPosition - world.xyz);
      vec3 side = cross(along, view);
      float sideLength = length(side);
      side = sideLength > .001 ? side / sideLength : vec3(1.0, 0.0, 0.0);
      world.xyz += side * aSide * uWidth;
      vPhase = aPhase; vAcross = aAcross; vStorm = aStorm;
      gl_Position = projectionMatrix * viewMatrix * world;
      #include <logdepthbuf_vertex>
    }`;
  const fragmentShader = `
    uniform float uTime; uniform float uReducedMotion; uniform vec3 uColor;
    varying vec2 vStorm; uniform float uOpacity; varying float vPhase; varying float vAcross;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    ${stormFlashGLSL}
    void main() {
      float pulse = (uReducedMotion > .5 ? .46 : stormFlash(uTime, vPhase, vStorm.x)) * vStorm.y;
      if (pulse < .02) discard;
      float softEdge = exp(-vAcross * vAcross * 3.8) * (1.0 - smoothstep(.65, 1.0, abs(vAcross)));
      gl_FragColor = vec4(uColor * (1.0 + pulse * 1.6), uOpacity * pulse * softEdge);
      #include <logdepthbuf_fragment>
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function material(width, color, opacity) {
    return new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uWidth: { value: width }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
  }
  const halo = new THREE.Mesh(geometry, material(LIGHTNING_EFFECTS.haloWidth, '#668fff', .38));
  const core = new THREE.Mesh(geometry, material(LIGHTNING_EFFECTS.coreWidth, '#dcefff', 1));
  halo.renderOrder = 6;
  core.renderOrder = 7;
  halo.frustumCulled = core.frustumCulled = false;
  group.add(halo, core);

  function setEvents(appearances) {
    geometry.dispose();
    const positions = [], others = [], sides = [], across = [], phases = [], stormParameters = [];
    let currentStorm;
    let strikes = 0, cloudTopArcs = 0;
    function segment(a, b, phase) {
      // Opposite signs at the segment end account for the reversed aOther direction.
      for (const [point, other, side, edge] of [[a, b, -1, -1], [a, b, 1, 1], [b, a, 1, -1], [b, a, 1, -1], [a, b, 1, 1], [b, a, -1, 1]]) {
        positions.push(...point.toArray()); others.push(...other.toArray()); sides.push(side); across.push(edge); phases.push(phase); stormParameters.push(currentStorm.flashPeriod, currentStorm.flashIntensity);
      }
    }
    for (const appearance of appearances.filter(item => item.thunder)) {
      currentStorm = appearance;
      const { event, altitude, radius } = appearance, frame = surfaceFrame(event);
      const phase = eventRandom(event, 200);
      // Cloud-top branching remains visible from an overhead Earth view.
      const crown = [], direction = eventRandom(event, 1400) * Math.PI * 2;
      for (let index = 0; index <= 18; index++) {
        const t = index / 18;
        const acrossCloud = (t - .5) * radius * 1.25;
        const jitter = Math.sin(t * 2.2 + .7) * radius * .13 + (eventRandom(event, 1500 + index) - .5) * .024;
        const east = acrossCloud * Math.cos(direction) - jitter * Math.sin(direction);
        const north = acrossCloud * Math.sin(direction) + jitter * Math.cos(direction);
        const point = surfacePoint(frame, east, north, altitude + .002 + Math.sin(Math.PI * t) * .002);
        crown.push(point);
        if (index) segment(crown[index - 1], point, phase);
      }
      for (let branch = 0; branch < 4; branch++) {
        const start = crown[3 + branch * 4];
        let previous = start;
        const length = radius * (.23 + eventRandom(event, 1550 + branch) * .38);
        const angle = direction + (branch % 2 ? 1 : -1) * (.55 + eventRandom(event, 1560 + branch) * .9);
        const steps = 3 + Math.floor(eventRandom(event, 1570 + branch) * 4);
        for (let step = 1; step <= steps; step++) {
          const t = step / steps, jag = (eventRandom(event, 1600 + branch * 8 + step) - .5) * .009;
          const point = start.clone().addScaledVector(frame.north, Math.sin(angle) * length * t + Math.cos(angle) * jag)
            .addScaledVector(frame.east, Math.cos(angle) * length * t - Math.sin(angle) * jag);
          point.setLength(1 + altitude + .003);
          segment(previous, point, phase);
          previous = point;
        }
      }
      cloudTopArcs++;
      for (let strike = 0; strike < 2; strike++) {
        const ox = (eventRandom(event, 210 + strike) - .5) * radius;
        const oy = (eventRandom(event, 220 + strike) - .5) * radius;
        const path = [];
        for (let index = 0; index <= LIGHTNING_EFFECTS.segments; index++) {
          const t = index / LIGHTNING_EFFECTS.segments;
          const jag = Math.sin(Math.PI * t) * .011;
          path.push(surfacePoint(frame, ox + (eventRandom(event, 300 + strike * 30 + index) - .5) * jag * 2,
            oy + (eventRandom(event, 400 + strike * 30 + index) - .5) * jag * 2,
            THREE.MathUtils.lerp(altitude + .001, .003, t)));
          if (index) segment(path[index - 1], path[index], phase);
        }
        for (let branch = 0; branch < LIGHTNING_EFFECTS.branches; branch++) {
          const start = path[2 + branch * 2];
          let previous = start;
          const angle = eventRandom(event, 500 + branch + strike * 5) * Math.PI * 2;
          const length = .016 + eventRandom(event, 550 + branch + strike * 5) * .022;
          const steps = 3 + Math.floor(eventRandom(event, 560 + branch + strike * 5) * 3);
          for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            const point = start.clone().addScaledVector(frame.east, Math.cos(angle) * length * t)
              .addScaledVector(frame.north, Math.sin(angle) * length * t)
              .addScaledVector(frame.normal, -length * .9 * t);
            if (step < steps) point.addScaledVector(frame.east, (eventRandom(event, 600 + step + branch * 10) - .5) * .007);
            if (point.length() < 1.003) point.setLength(1.003);
            segment(previous, point, phase);
            previous = point;
          }
        }
        strikes++;
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aOther', new THREE.Float32BufferAttribute(others, 3));
    geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
    geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    geometry.setAttribute('aStorm', new THREE.Float32BufferAttribute(stormParameters, 2));
    geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.computeBoundingSphere();
    group.visible = strikes > 0;
    group.userData.strikes = strikes;
    group.userData.cloudTopArcs = cloudTopArcs;
  }

  return {
    group, setEvents,
    update(time, { reducedMotion = false } = {}) {
      uniforms.uTime.value = reducedMotion ? 0 : time;
      uniforms.uReducedMotion.value = Number(reducedMotion);
    },
    dispose() { geometry.dispose(); halo.material.dispose(); core.material.dispose(); group.removeFromParent(); },
  };
}
