import * as THREE from 'three';
import { createRenderer, createPipeline } from './core/renderer.js';
import { createCamera, createNavigation } from './core/camera.js';
import { createWorld, updateWorldVisibility } from './core/scene.js';
import { loadTextures } from './core/textures.js';
import { visitPing } from './core/telemetry.js';
import { data } from './universe/catalog.js';
import { createInfoPanel } from './ui/info-panel.js';
import { createLabels } from './ui/labels.js';
import { bindNavigationUI } from './ui/navigation.js';
import { toast, fail } from './ui/feedback.js';
import { createEarthSense } from './earthsense/index.js';
import { createEarthDetail } from './earth/detail.js';
import { mobile } from './core/math.js';

export async function startOrbit() {
  let renderer;
  window.addEventListener('error', event => {
    console.error(event.error || event.message);
    if (!renderer) fail('加载出现问题。请使用支持 WebGL 2 的新版 Chrome、Edge 或 Safari 打开此文件。');
  });
  visitPing();
  try {
    renderer = createRenderer(document.getElementById('universe'), () =>
      fail('图形上下文已丢失。请关闭占用显卡的页面后，重新加载星空。'));
    const scene = new THREE.Scene();
    const { camera, controls } = createCamera(renderer);
    const { composer, resize, updateFraming } = createPipeline(renderer, scene, camera);
    const pixels = resize();
    const assets = window.ORBIT_ASSETS;
    const textures = await loadTextures(assets, fraction => {
      document.getElementById('load-progress').style.width = `${fraction * 90}%`;
    });
    const world = createWorld(scene, textures, pixels);
    const earthDetail = createEarthDetail({ world, renderer, assets, compact: mobile() });
    const info = createInfoPanel({ getData: world.getData });
    let ui, earthsense;
    const navigation = createNavigation({
      camera, controls, world, onInfo: info.update, toast,
      onStage: mode => ui?.updateStage(mode),
    });
    const labels = createLabels({ camera, controls, world, onSelect: navigation.flyTo });
    ui = bindNavigationUI({ renderer, camera, world, navigation, assets, toast,
      onPick: (raycaster, event) => earthsense?.pick(raycaster, event) || false,
    });
    world.update(0, ui.getState());
    navigation.initialize();
    earthsense = createEarthSense({ world, camera, controls, navigation, ui });
    resize(world);
    document.getElementById('load-progress').style.width = '100%';
    document.getElementById('load-text').textContent = '欢迎回到地球';
    await renderer.compileAsync(scene, camera);
    composer.render();
    void earthDetail.prepare();
    document.getElementById('loading').classList.add('done');
    setTimeout(() => document.getElementById('loading')?.remove(), 900);

    let hidden = false, lastFrameTime = performance.now(), uiTick = 0, observingEarth = false;
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min((now - lastFrameTime) / 1000, .05);
      lastFrameTime = now;
      if (hidden) return;
      const settings = ui.getState();
      const navigationState = navigation.getState();
      const navigating = navigationState.flight;
      // Keep the entire astronomical simulation intact while observing the surface.
      navigation.update(dt, now, () => world.update(dt, {
        ...settings, paused: earthsense.active || navigationState.returning || settings.paused,
      }));
      world.backgroundStars.position.copy(camera.position);
      world.flybys.update(dt, camera, {
        paused: settings.paused, enabled: !earthsense.active, navigating,
      });
      updateWorldVisibility(world, camera, controls, settings.orbitsVisible, navigation.getState());
      navigation.updateStage();
      earthsense.update(now / 1000, { scaleFactor: THREE.MathUtils.clamp(
        (camera.position.distanceTo(world.earth.position) - 1) / 3.65, .06, 1,
      ) });
      if (observingEarth !== earthsense.visible) {
        observingEarth = earthsense.visible;
        earthDetail.setObservation(observingEarth);
      }
      updateFraming(observingEarth, dt);
      if (earthsense.visible) {
        world.earthSatellites.visible = false;
        world.station.visible = false;
        world.earthOrbitGroup.visible = false;
        world.orbitGroup.visible = false;
      }
      if (++uiTick % 2 === 0) labels.update({ ...settings, ...navigation.getState(),
        labelsVisible: settings.labelsVisible && !earthsense.visible,
      });
      if (uiTick % 10 === 0) {
        ui.updateHud();
        if (earthsense.visible) {
          const detail = earthDetail.getState();
          document.getElementById('view-caption').textContent = detail.status === 'ready'
            ? `EARTHSENSE · ${detail.textureWidth / 1024}K 地表` : 'EARTHSENSE · 地表观测';
        } else if (navigation.getState().focusBody === 'earth' && navigation.getState().stage === 'earth'
          && earthDetail.getState().status === 'ready') {
          document.getElementById('view-caption').textContent += ` · ${earthDetail.getState().textureWidth / 1024}K 地表`;
        }
      }
      composer.render();
    }
    addEventListener('resize', () => resize(world));
    document.addEventListener('visibilitychange', () => {
      hidden = document.hidden;
      lastFrameTime = performance.now();
    });
    requestAnimationFrame(animate);
    window.ORBIT = {
      version: '1.5.0',
      getState: () => ({
        ...navigation.getState(), ...ui.getState(),
        planetCount: data.filter(d => d.orbit && d.id !== 'moon').length,
        satelliteCount: world.satellites.length,
        galaxyStars: world.galaxy.geometry.attributes.position.count,
        galaxyCount: world.galaxyDefinitions.length, deepSpaceBodyCount: world.deepSpace.bodies.size,
        flybys: world.flybys.getState(),
        drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        mode: earthsense.active ? 'earthsense' : 'universe',
        earthDetail: earthDetail.getState(), pixelRatio: renderer.getPixelRatio(),
      }),
      goTo: navigation.flyTo, zoom: navigation.zoom, setPaused: ui.setPaused,
      setMode: earthsense.setMode,
      earthsense: { getState: earthsense.diagnostics, setLayer: earthsense.toggleLayer },
      destinations: () => [...world.galaxyDefinitions, ...world.deepSpace.bodies.values()].map(body => ({
        id: body.id, name: body.cn, kind: body.kind, parentGalaxy: body.parentGalaxy,
        parentStarId: body.parentStarId, modelStatus: body.modelStatus,
      })),
    };
  } catch (error) {
    console.error(error);
    fail('无法初始化三维场景。请确认浏览器已开启硬件加速，或使用新版 Chrome、Edge、Safari 重试。');
  }
}
