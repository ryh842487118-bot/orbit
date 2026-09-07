import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mobile } from './math.js';

export function renderPixelRatio({ width, height, pixelRatio, compact }) {
  const requested = Math.min(Math.max(pixelRatio, 1.5), compact ? 2 : 2.5);
  return Math.min(requested, Math.max(1, Math.sqrt(6000000 / (width * height))));
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

  function resize(world, earthObservation = false) {
    const w = innerWidth, h = innerHeight;
    const pixels = renderPixelRatio({ width: w, height: h, pixelRatio: devicePixelRatio,
      compact: mobile(), earthObservation });
    renderer.setPixelRatio(pixels);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Leave the lower phone screen available for the EarthSense observation sheet.
    const mobileOffset = earthObservation ? h * .03 : -h * .045;
    camera.setViewOffset(w, h, mobile() ? 0 : -w * .105, mobile() ? mobileOffset : 0, w, h);
    camera.updateProjectionMatrix();
    composer.setPixelRatio(pixels);
    composer.setSize(w, h);
    for (const stars of [world?.galaxy, world?.backgroundStars]) {
      if (stars) stars.material.uniforms.uRatio.value = pixels;
    }
    return pixels;
  }
  return { composer, resize };
}
