import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mobile, reducedMotion } from './math.js';

export function renderPixelRatio({ width, height, pixelRatio, compact }) {
  const requested = Math.min(Math.max(pixelRatio, 1.5), compact ? 2 : 2.5);
  return Math.min(requested, Math.max(1, Math.sqrt(6000000 / (width * height))));
}

/** Frame-rate-independent framing, settling within roughly 0.58 seconds. */
export function advanceObservationFraming(current, earthObservation, dt, { reducedMotion = false } = {}) {
  const target = earthObservation ? 1 : 0;
  if (reducedMotion) return target;
  const seconds = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const next = current + (target - current) * (1 - Math.exp(-seconds * 12));
  return Math.abs(target - next) < .001 ? target : next;
}

export function createRenderer(container, onContextLost) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: false, logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x03070d);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    onContextLost();
  });
  return renderer;
}

export function createPipeline(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .42, .65, 1.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Sampling quality and the original bloom are shared by both modes.
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.samples = Math.min(2, renderer.capabilities.maxSamples);
  }

  let observationFraming = 0;
  let width = innerWidth, height = innerHeight, compact = mobile();

  function applyFraming() {
    camera.aspect = width / height;
    // Leave room for the observation sheet without jumping the shared globe.
    const offsetY = height * THREE.MathUtils.lerp(-.045, .03, observationFraming);
    camera.setViewOffset(width, height, compact ? 0 : -width * .105,
      compact ? offsetY : 0, width, height);
  }

  function updateFraming(earthObservation, dt) {
    const next = advanceObservationFraming(observationFraming, earthObservation, dt, { reducedMotion });
    if (next !== observationFraming) {
      observationFraming = next;
      if (compact) applyFraming();
    }
    return observationFraming;
  }

  function resize(world) {
    const w = innerWidth, h = innerHeight;
    width = w;
    height = h;
    compact = mobile();
    const pixels = renderPixelRatio({ width: w, height: h, pixelRatio: devicePixelRatio,
      compact });
    renderer.setPixelRatio(pixels);
    renderer.setSize(w, h);
    applyFraming();
    composer.setPixelRatio(pixels);
    composer.setSize(w, h);
    for (const stars of world?.starFields || [world?.galaxy, world?.backgroundStars]) {
      if (stars) stars.material.uniforms.uRatio.value = pixels;
    }
    world?.motionTrajectories?.resize(pixels);
    return pixels;
  }
  return { composer, resize, updateFraming };
}
