import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weather, temperatureColor } from '../src/earthsense/weather.js';
import { lightning, loadSimulatedLightning } from '../src/earthsense/lightning.js';
import { WEATHER_EFFECTS, weatherAppearance, appearancesFor, rainRatePerHour } from '../src/earthsense/effects/weather-state.js';
import { createStormClouds } from '../src/earthsense/effects/storm-clouds.js';
import { createRain, RAIN_EFFECTS } from '../src/earthsense/effects/rain.js';
import { createLightningBolts } from '../src/earthsense/effects/lightning-bolts.js';

const at = (id, conditions, lat = 0, lon = 0) => ({ id, layer: 'weather', lat, lon, weather: conditions });
const objectsWithGeometry = root => { const result = []; root.traverse(object => { if (object.geometry) result.push(object); }); return result; };
const cloudMeshes = root => objectsWithGeometry(root.getObjectByName('Procedural weather clouds'));
const geometrySnapshot = root => objectsWithGeometry(root).map(object => ({
  attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, value]) => [name, [...value.array]])),
  index: object.geometry.index ? [...object.geometry.index.array] : null,
  instances: object.instanceMatrix ? [...object.instanceMatrix.array] : null,
}));

test('weather effects distinguish sunshine, clouds, rain and snow using source values', () => {
  const sun = weatherAppearance(at('sun', { code: 0, cloudCover: 0, precipitation: 0, rain: 0 }));
  assert.equal(sun.puffs, 0);
  assert.equal(sun.drops, 0);
  assert.equal(sun.thunder, false);
  const cloudy = weatherAppearance(at('cloud', { code: 2, cloudCover: 65 }));
  assert.ok(cloudy.puffs > 0);
  assert.equal(cloudy.drops, 0);
  assert.equal(cloudy.thunder, false);
  const rain = weatherAppearance(at('rain', { code: 63, precipitation: 2.1, rain: 2.1, cloudCover: 100 }));
  assert.ok(rain.puffs > cloudy.puffs);
  assert.ok(rain.drops > 0);
  assert.equal(rain.thunder, false);
  const snow = weatherAppearance(at('snow', { code: 75, precipitation: 3, rain: 0, cloudCover: 100 }));
  assert.equal(snow.drops, 0, 'solid precipitation is never silently rendered as rain');
  assert.equal(snow.thunder, false);
  assert.equal(weatherAppearance(at('unknown', {})).puffs, 0);
});

test('only WMO thunderstorm codes produce lightning in the real weather layer', () => {
  for (const code of [0, 1, 2, 3, 45, 51, 61, 65, 71, 80, 82, null]) {
    assert.equal(weatherAppearance(at(String(code), { code, cloudCover: 100, rain: 15 })).thunder, false);
  }
  for (const code of [95, 96, 99]) {
    const appearance = weatherAppearance(at(String(code), { code }));
    assert.equal(appearance.thunder, true);
    assert.ok(appearance.puffs > 0);
  }
});

test('the weather view has a fixed GPU budget and clears every effect on data replacement', () => {
  const view = weather.createView();
  const events = Array.from({ length: 80 }, (_, index) => at(String(index), { code: 99, rain: 60, interval: 3600 }, index % 120 - 60, index * 4 - 160));
  view.setEvents(events);
  assert.equal(weather.enabled, true);
  assert.equal(view.group.userData.locations, WEATHER_EFFECTS.maxLocations);
  assert.equal(objectsWithGeometry(view.group).length, 6, 'cloud/rain/lightning batches do not add per-event draw calls');
  assert.equal(cloudMeshes(view.group).length, 1, 'all weather locations share one cloud geometry batch');
  assert.equal(view.group.getObjectByName('Local weather rain').userData.drops, 60 * WEATHER_EFFECTS.maxRainDrops);
  assert.equal(view.group.getObjectByName('Local branched lightning').userData.strikes, 120);
  assert.equal(view.group.getObjectByName('Local branched lightning').userData.cloudTopArcs, 60);
  const cloudMesh = cloudMeshes(view.group)[0];
  const arcs = view.group.getObjectByName('Local branched lightning').children;
  assert.ok(arcs.every(arc => arc.renderOrder > cloudMesh.renderOrder && arc.material.depthTest), 'electric arcs composite above clouds while respecting the Earth depth buffer');
  view.setEvents([]);
  assert.ok(cloudMeshes(view.group).every(mesh => !mesh.visible || mesh.count === 0 || mesh.geometry.getAttribute('position').count === 0));
  assert.equal(view.group.getObjectByName('Local weather rain').visible, false);
  assert.equal(view.group.getObjectByName('Local branched lightning').visible, false);
  view.dispose();
});

test('clear and mainly clear codes show no clouds despite contradictory cloud or past rain fields', () => {
  const clear = weatherAppearance(at('clear', { code: 0, cloudCover: 100, rain: 3, precipitation: 3, interval: 900 }));
  assert.equal(clear.puffs, 0);
  assert.equal(clear.drops, 0);
  assert.equal(clear.flashPeriod, null);
  assert.equal(clear.thunder, false);
  assert.equal(clear.rainRate, 12, 'source accumulation remains available without inventing current rain');
  const mostly = weatherAppearance(at('mostly', { code: 1, cloudCover: 100, rain: 0, interval: 900 }));
  assert.equal(mostly.puffs, 0);
  assert.equal(mostly.drops, 0);
  assert.equal(mostly.flashPeriod, null);
});

test('equivalent rain rates across 15-minute and hourly windows drive identical effects', () => {
  const quarter = weatherAppearance(at('same', { code: 95, rain: 2, precipitation: 2, interval: 900 }));
  const hour = weatherAppearance(at('same', { code: 95, rain: 8, precipitation: 8, interval: 3600 }));
  assert.equal(quarter.rainRate, 8);
  for (const field of ['rainIntensity', 'drops', 'rainSpeed', 'rainLength', 'rainSpread', 'flashPeriod', 'flashIntensity']) {
    assert.equal(quarter[field], hour[field], field);
  }
  for (const interval of [null, undefined, 0, -1, NaN]) assert.equal(rainRatePerHour({ rain: 2, interval }), null);
  assert.equal(rainRatePerHour({ interval: 900 }), null);
});

test('reported zero rain produces dry low-frequency thunder and ordinary rain never creates lightning', () => {
  const dry = weatherAppearance(at('dry', { code: 95, cloudCover: 90, rain: 0, precipitation: 0, interval: 900 }));
  assert.equal(dry.rainRate, 0);
  assert.equal(dry.drops, 0);
  assert.equal(dry.flashPeriod, WEATHER_EFFECTS.maxFlashPeriod);
  assert.equal(dry.flashIntensity, .25);
  const ordinary = weatherAppearance(at('wet', { code: 65, cloudCover: 100, rain: 40, interval: 900 }));
  assert.ok(ordinary.drops > 0);
  assert.equal(ordinary.flashPeriod, null);
  assert.equal(ordinary.flashIntensity, 0);
});

test('rain density, speed, length, footprint and lightning intensity increase with rate and remain capped', () => {
  const states = [.1, 2, 10, 30, 50, 10000].map(rate => weatherAppearance(at('rate', { code: 95, rain: rate, interval: 3600 })));
  for (let index = 1; index < states.length; index++) {
    const before = states[index - 1], after = states[index];
    for (const field of ['drops', 'rainSpeed', 'rainLength', 'rainSpread', 'flashIntensity']) assert.ok(after[field] >= before[field], field);
    assert.ok(after.flashPeriod <= before.flashPeriod);
    assert.ok(after.flashPeriod >= WEATHER_EFFECTS.minFlashPeriod);
    assert.ok(after.flashIntensity <= 1 && after.drops <= WEATHER_EFFECTS.maxRainDrops);
  }
  assert.equal(states.at(-1).flashPeriod, 4);
  assert.equal(states.at(-1).flashIntensity, 1);
});

test('rain trails and lightning fit the shallow cloud layer while retaining rain-rate differences', () => {
  const rain = createRain(), bolts = createLightningBolts();
  const point = new THREE.Vector3();
  for (const [code, altitude] of [[65, .012], [95, .02]]) {
    let previousTrail = 0;
    for (const rate of [.1, 2, 10, 50]) {
      const appearance = { ...weatherAppearance(at('shallow', { code, rain: rate, interval: 3600 })), altitude };
      rain.setEvents([appearance]);
      const geometry = rain.group.children[0].geometry;
      const bases = geometry.getAttribute('aBase'), drops = geometry.getAttribute('aDrop');
      for (let index = 0; index < drops.count; index++) {
        const baseAltitude = point.fromBufferAttribute(bases, index).length() - 1;
        const columnHeight = drops.getX(index), trailLength = drops.getW(index);
        assert.ok(Math.abs(baseAltitude - RAIN_EFFECTS.baseAltitude) < .000001);
        assert.ok(baseAltitude + columnHeight <= altitude + .000001, 'rain column stops at the cloud base');
        assert.ok(trailLength > 0 && trailLength <= columnHeight * .551, 'rain trail leaves room to fall within the cloud column');
      }
      assert.ok(drops.getW(0) >= previousTrail, 'increased source rain rate retains a longer visible trail');
      previousTrail = drops.getW(0);
      if (code === 95) {
        bolts.setEvents([appearance]);
        const positions = bolts.group.children[0].geometry.getAttribute('position');
        const heights = Array.from({ length: positions.count }, (_, index) => point.fromBufferAttribute(positions, index).length() - 1);
        assert.ok(heights.every(height => height >= .003 - .000001 && height <= altitude + .004 + .000001), 'all electric arcs stay between the surface and cloud top');
        assert.ok(heights.some(height => height > altitude), 'cloud-top branches remain visible above the cloud layer');
        assert.ok(heights.some(height => height < .004), 'cloud-to-ground strokes still reach the surface');
      }
    }
  }
  rain.dispose(); bolts.dispose();
});

test('simulated rain regimes are explicit and cloud/arc GPU timing parameters stay synchronized', async () => {
  const events = await loadSimulatedLightning(), appearances = appearancesFor(events, true);
  assert.deepEqual(appearances.map(item => item.rainRate), [.6, 4, 16, 1.5, 8, 32]);
  assert.equal(new Set(appearances.map(item => item.flashPeriod)).size, events.length);
  assert.ok(events.every(event => event.metrics.some(metric => metric.label === '模拟雨率') && event.metrics.some(metric => metric.value.includes('非实况雷击频率'))));
  const view = lightning.createView();
  for (const event of events) {
    view.setEvents([event]);
    const cloudGeometry = cloudMeshes(view.group)[0].geometry;
    const cloud = cloudGeometry.getAttribute('aStorm').array;
    const arc = view.group.getObjectByName('Local branched lightning').children[0].geometry.getAttribute('aStorm').array;
    assert.deepEqual([...cloud.slice(0, 2)], [...arc.slice(0, 2)]);
    assert.ok(cloud.every((value, index) => value === arc[index % 2]));
    assert.ok(arc.every((value, index) => value === cloud[index % 2]));
    const cloudParameters = cloudGeometry.getAttribute('aCloud');
    const arcPhases = view.group.getObjectByName('Local branched lightning').children[0].geometry.getAttribute('aPhase').array;
    assert.ok(arcPhases.every(value => value === cloudParameters.getZ(0)), 'cloud light and branched arcs flash in the same event phase');
  }
  view.dispose();
});

test('weather cloud positions are deterministic and follow the existing rotating Earth', () => {
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial());
  earth.position.set(45, 0, 0);
  earth.rotation.set(.15, .7, 0);
  const clouds = createStormClouds();
  earth.add(clouds.group);
  const front = at('front', { code: 3, cloudCover: 100 });
  clouds.setEvents(appearancesFor([front]));
  const geometry = geometrySnapshot(clouds.group);
  clouds.setEvents(appearancesFor([front]));
  assert.deepEqual(geometrySnapshot(clouds.group), geometry);
  earth.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(earth.localToWorld(new THREE.Vector3(3, 0, 0)), new THREE.Vector3(-1, 0, 0).transformDirection(earth.matrixWorld));
  const surface = ray.intersectObject(earth, false)[0];
  assert.ok(surface);
  assert.equal(clouds.pick(ray, surface.distance)?.event.id, 'front');
  clouds.setEvents(appearancesFor([at('back', { code: 95 }, 0, 180)]));
  earth.updateWorldMatrix(true, true);
  assert.equal(clouds.pick(ray, surface.distance), null, 'a cloud on the far side cannot be selected through the Earth');
  clouds.group.visible = false;
  assert.equal(clouds.pick(ray), null);
  clouds.dispose();
  earth.geometry.dispose(); earth.material.dispose();
});

test('reduced motion freezes noise, rain and lightning while keeping static storm geometry', async () => {
  const view = lightning.createView();
  const events = await loadSimulatedLightning();
  assert.equal(events.length, 6);
  assert.ok(events.every(event => event.simulated && event.time === null && event.source === '模拟数据'));
  view.setEvents(events);
  assert.equal(view.group.userData.thunderstorms, 6);
  assert.ok(cloudMeshes(view.group).some(mesh => mesh.visible && mesh.geometry.getAttribute('position').count > 0));
  view.update(3, { reducedMotion: true });
  const uniforms = objectsWithGeometry(view.group).filter(object => object.material.uniforms).map(object => object.material.uniforms);
  assert.ok(uniforms.every(uniform => uniform.uTime.value === 0));
  assert.equal(uniforms.filter(uniform => uniform.uReducedMotion).every(uniform => uniform.uReducedMotion.value === 1), true);
  view.update(60, { reducedMotion: true });
  assert.ok(uniforms.every(uniform => uniform.uTime.value === 0));
  view.update(61, { reducedMotion: false });
  assert.ok(uniforms.every(uniform => uniform.uTime.value === 61));
  assert.ok(view.group.getObjectByName('Local branched lightning').visible, 'static electric arcs remain visible under reduced motion');
  view.dispose();
});

test('temperature anchors retain per-location color and all resources are disposed', () => {
  const view = weather.createView(), parent = new THREE.Group();
  parent.add(view.group);
  view.setEvents([at('cold', { code: 3, cloudCover: 100, temperature: -15 }), at('hot', { code: 0, temperature: 40 }, 30, 60)]);
  const anchor = view.group.children[0].children[0], color = new THREE.Color();
  anchor.getColorAt(0, color);
  const expected = new THREE.Color(temperatureColor(at('cold', { temperature: -15 })));
  for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(color[channel] - expected[channel]) < .0001);
  const geometries = new Set(), materials = new Set();
  for (const object of objectsWithGeometry(view.group)) { geometries.add(object.geometry); materials.add(object.material); }
  let disposedGeometry = 0, disposedMaterial = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometry++));
  materials.forEach(material => material.addEventListener('dispose', () => disposedMaterial++));
  view.dispose();
  assert.equal(view.group.parent, null);
  assert.equal(disposedGeometry, geometries.size);
  assert.equal(disposedMaterial, materials.size);
});
