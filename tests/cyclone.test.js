import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCycloneLayer, cycloneRotationSign, cycloneCloudCoverage, cycloneVisualScale } from '../src/earthsense/effects/cyclone.js';
import { createCycloneGeometry } from '../src/earthsense/effects/cyclone-geometry.js';
import { CYCLONE_SCALE } from '../src/earthsense/effects/cyclone-scale.js';
import { stormTrackGeometry, createSelectedStormTrack, STORM_TRACK_STYLE } from '../src/earthsense/effects/selected-storm-track.js';
import { latLonToVector } from '../src/earth/coordinates.js';

const storm = (id = 'north', lat = 18, lon = 124) => ({ id, lat, lon, layer: 'typhoon', title: id, severity: 'medium',
  cyclone: { windSpeedKmh: 120, windBasis: 'observation' } });
const stormFrames = layer => layer.group.children.filter(child => child.name.startsWith('Cyclone:'));

test('thin cloud sheets follow the existing Earth with gentle relief and a transparent eye', () => {
  const geometry = createCycloneGeometry(.145);
  const position = geometry.attributes.position, uv = geometry.attributes.uv, vertex = new THREE.Vector3();
  let lowest = Infinity, highest = 0, eyewall = 0, outskirts = 0;
  for (let index = 0; index < position.count; index++) {
    const altitude = vertex.fromBufferAttribute(position, index).length();
    const radial = Math.hypot(uv.getX(index) * 2 - 1, uv.getY(index) * 2 - 1);
    lowest = Math.min(lowest, altitude);
    highest = Math.max(highest, altitude);
    if (Math.abs(radial - .15) < .001) eyewall = Math.max(eyewall, altitude);
    if (radial > .99) outskirts = Math.max(outskirts, altitude);
  }
  assert.ok(lowest > 1.009);
  assert.ok(highest > 1.013 && highest < 1.016, 'clouds remain close to the Earth instead of forming a tall torus');
  assert.ok(eyewall - outskirts > .0015 && eyewall - outskirts < .003, 'the eyewall retains gentle uneven vertical relief');
  assert.equal(cycloneCloudCoverage(new THREE.Vector2(.5, .5), { spin: 1, phase: 0 }), 0);
  assert.equal(cycloneCloudCoverage(new THREE.Vector2(1, .5), { spin: 1, phase: 0 }), 0);
  assert.ok(cycloneCloudCoverage(new THREE.Vector2(.6, .5), { spin: 1, phase: 0 }) > .1);
  geometry.dispose();
});

test('each cyclone adds two spherical effects and uses the proper outward hemisphere rotation', () => {
  const layer = createCycloneLayer();
  layer.setEvents([storm(), storm('south', -18, 124)]);
  const frames = stormFrames(layer);
  assert.equal(frames.length, 2);
  for (const [index, frame] of frames.entries()) {
    assert.equal(frame.children.length, 2, 'one cloud mesh and one particle draw per storm');
    const [cloud, particles] = frame.children;
    const outward = new THREE.Vector3(0, 0, 1).applyQuaternion(frame.quaternion);
    assert.ok(outward.distanceTo(latLonToVector(index ? -18 : 18, 124)) < 1e-10);
    assert.equal(cloud.material.uniforms.uSpin.value, index ? -1 : 1);
    assert.equal(particles.material.uniforms.uSpin, cloud.material.uniforms.uSpin);
    assert.equal(cloud.material.depthTest, true);
    assert.equal(particles.material.depthTest, true);
  }
  assert.equal(cycloneRotationSign(18), 1, 'positive local angles rotate counterclockwise viewed from outside');
  assert.equal(cycloneRotationSign(-18), -1);
  layer.dispose();
});

test('reduced motion freezes both cloud advection and particle circulation without flattening the storm', () => {
  const layer = createCycloneLayer();
  layer.setEvents([storm()]);
  const [cloud, particles] = stormFrames(layer)[0].children;
  layer.update(42, { scaleFactor: .15 });
  assert.equal(cloud.material.uniforms.uTime.value, 42);
  assert.equal(particles.material.uniforms.uTime.value, 42);
  const positions = cloud.geometry.attributes.position.array.slice();
  layer.update(90, { reducedMotion: true, scaleFactor: .06 });
  assert.equal(cloud.material.uniforms.uTime.value, 0);
  assert.equal(particles.material.uniforms.uTime.value, 0);
  assert.deepEqual(cloud.geometry.attributes.position.array, positions, 'zoom does not invent a different geographic cloud radius');
  layer.dispose();
});

test('clicking a cloud arm selects its real event and a far-side cyclone cannot be picked through Earth', () => {
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial());
  earth.position.set(45, 0, 0);
  earth.rotation.y = 2.9;
  const layer = createCycloneLayer();
  earth.add(layer.group);
  layer.setEvents([storm()]);
  earth.updateWorldMatrix(true, true);
  const frame = stormFrames(layer)[0], arc = cycloneVisualScale(storm()).radius * .2;
  const outward = new THREE.Vector3(Math.sin(arc), 0, Math.cos(arc));
  const target = frame.localToWorld(outward.clone().multiplyScalar(1.037));
  const worldDirection = outward.clone().transformDirection(frame.matrixWorld);
  const raycaster = new THREE.Raycaster(target.clone().addScaledVector(worldDirection, 2), worldDirection.clone().negate());
  const surfaceDistance = raycaster.intersectObject(earth, false)[0]?.distance;
  assert.ok(Number.isFinite(surfaceDistance));
  const result = layer.pick(raycaster, surfaceDistance);
  assert.equal(result?.event.id, 'north');
  assert.ok(result.distance < surfaceDistance, 'the raised cloud intersects in front of the surface');
  layer.setEvents([storm('behind-earth', -18, -56)]);
  earth.updateWorldMatrix(true, true);
  assert.equal(layer.pick(raycaster, surfaceDistance), null);
  layer.group.visible = false;
  assert.equal(layer.pick(raycaster), null);
  layer.dispose();
  earth.geometry.dispose();
  earth.material.dispose();
});

test('refreshing or disposing cyclone data releases old GPU geometry and material resources', () => {
  const layer = createCycloneLayer();
  layer.setEvents([storm()]);
  let released = 0;
  for (const effect of stormFrames(layer)[0].children) {
    effect.geometry.addEventListener('dispose', () => released++);
    effect.material.addEventListener('dispose', () => released++);
  }
  layer.setEvents([storm('updated')]);
  assert.equal(released, 4);
  assert.equal(stormFrames(layer).length, 1);
  const parent = new THREE.Group();
  parent.add(layer.group);
  layer.dispose();
  assert.equal(layer.group.parent, null);
  assert.equal(layer.group.children.length, 0);
});

test('invalid locations never generate corrupt cyclone geometry', () => {
  const layer = createCycloneLayer();
  layer.setEvents([storm(), storm('bad-latitude', NaN, 0), storm('out-of-range', 120, 0)]);
  assert.equal(stormFrames(layer).length, 1);
  layer.dispose();
});

test('cloud radius follows finite source wind continuously with explicit bounds and neutral missing data', () => {
  const withWind = windSpeedKmh => ({ cyclone: { windSpeedKmh, windBasis: 'observation' } });
  const winds = [0, 35, 80, 120, 180, 230, 280];
  const radii = winds.map(wind => cycloneVisualScale(withWind(wind)).radius);
  assert.equal(radii[0], CYCLONE_SCALE.minimum);
  assert.equal(radii.at(-1), CYCLONE_SCALE.maximum);
  assert.ok(radii.every((radius, index) => !index || radius > radii[index - 1]));
  assert.ok(radii.at(-1) > radii[1] * 2, 'weak and strong storms are visibly different');
  assert.equal(cycloneVisualScale(withWind(1000)).radius, CYCLONE_SCALE.maximum);
  assert.ok(Math.abs(cycloneVisualScale(withWind(120.01)).radius - cycloneVisualScale(withWind(120)).radius) < .00001);
  for (const value of [null, undefined, NaN, Infinity, -1, '120']) {
    assert.equal(cycloneVisualScale(withWind(value)).radius, CYCLONE_SCALE.unavailable);
    assert.equal(cycloneVisualScale(withWind(value)).windSpeedKmh, null);
  }
  assert.equal(cycloneVisualScale({ severity: 'high' }).radius, cycloneVisualScale({ severity: 'low' }).radius,
    'alert level must never stand in for wind speed');
});

const trackData = () => ({
  history: [{ lon: 170, lat: 18, time: '2026-09-06T00:00:00Z', windSpeedKmh: 100 },
    { lon: 179, lat: 18, time: '2026-09-07T00:00:00Z', windSpeedKmh: 120 }],
  forecast: [{ lon: -179, lat: 18, time: '2026-09-07T06:00:00Z', windSpeedKmh: 130 },
    { lon: -174, lat: 20, time: '2026-09-07T12:00:00Z', windSpeedKmh: 140 }],
  source: 'Official test timeline', sourceUrl: 'https://example.com/storm', issuedAt: '2026-09-07T00:00:00Z', status: 'ready',
});

test('routes are hidden by default and only the selected storm receives solid history and dashed forecast', () => {
  const layer = createCycloneLayer();
  const first = { ...storm('first'), paths: [[[0, 0], [1, 1]]] }, second = storm('second');
  layer.setEvents([first, second]);
  const selected = layer.group.getObjectByName('Selected cyclone history and forecast');
  assert.equal(selected.visible, false);
  assert.equal(selected.children.length, 0);
  let initialLines = 0;
  layer.group.traverse(object => { if (object.isLine) initialLines++; });
  assert.equal(initialLines, 0, 'legacy full-map paths are no longer drawn');
  layer.setSelected(first, trackData());
  assert.equal(selected.userData.eventId, 'first');
  assert.equal(selected.getObjectByName('History — solid').material.isLineBasicMaterial, true);
  const forecast = selected.getObjectByName('Forecast — dashed');
  assert.equal(forecast.material.isLineDashedMaterial, true);
  assert.ok(forecast.geometry.attributes.lineDistance.count > 0);
  layer.setSelected(second, { ...trackData(), forecast: [], status: 'history-only' });
  assert.equal(selected.userData.eventId, 'second');
  assert.equal(selected.getObjectByName('Forecast — dashed'), undefined);
  assert.equal(selected.userData.forecastCount, 0);
  layer.setSelected(null);
  assert.equal(selected.visible, false);
  assert.equal(selected.children.length, 0);
  layer.dispose();
});

test('track interpolation crosses the dateline by the short arc without entering Earth', () => {
  const geometry = stormTrackGeometry([{ lon: 179, lat: 18 }, { lon: -179, lat: 18 }]);
  const position = geometry.attributes.position, vertex = new THREE.Vector3();
  assert.ok(position.count > 2 && position.count < 40);
  for (let index = 0; index < position.count; index++) {
    vertex.fromBufferAttribute(position, index);
    assert.ok(Math.abs(vertex.length() - STORM_TRACK_STYLE.altitude) < 1e-6);
    assert.ok(vertex.x < -.96 && Math.abs(vertex.z) < .025, 'route remains near the antimeridian');
  }
  geometry.dispose();
  const broken = stormTrackGeometry([{ lon: 0, lat: 0 }, null, { lon: 4, lat: 3 }]);
  assert.equal(broken.attributes.position.count, 0, 'invalid samples do not silently bridge gaps');
  broken.dispose();
});

test('source route points retain timestamps and wind, remain on Earth, and respect surface occlusion', () => {
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial());
  const route = createSelectedStormTrack(), data = trackData(), selected = storm('tracked', 18, 179);
  earth.add(route.group);
  route.setData(selected, data);
  earth.updateWorldMatrix(true, true);
  const point = data.history[0], normal = latLonToVector(point.lat, point.lon);
  const raycaster = new THREE.Raycaster(normal.clone().multiplyScalar(3), normal.clone().negate());
  const surface = raycaster.intersectObject(earth, false)[0];
  const hit = route.pick(raycaster, surface.distance);
  assert.equal(hit.event.id, selected.id);
  assert.equal(hit.trackKind, 'history');
  assert.equal(hit.trackPoint.time, point.time);
  assert.equal(hit.trackPoint.windSpeedKmh, 100);
  const farRay = new THREE.Raycaster(normal.clone().multiplyScalar(-3), normal.clone());
  const frontSurface = farRay.intersectObject(earth, false)[0];
  assert.equal(route.pick(farRay, frontSurface.distance), null);
  route.dispose();
  earth.geometry.dispose(); earth.material.dispose();
});

test('a selected current observation updates only its cyclone and preserves its loaded route across feed refresh', () => {
  const layer = createCycloneLayer(), first = storm('current'), other = storm('untouched');
  layer.setEvents([first, other]);
  const [selectedFrame, otherFrame] = stormFrames(layer);
  const previousGeometry = selectedFrame.children[0].geometry, otherGeometry = otherFrame.children[0].geometry;
  const current = { ...first, cyclone: { windSpeedKmh: 230, windBasis: 'observation', validTime: '2026-09-07T00:00:00Z' } };
  layer.setSelected(current, trackData());
  assert.notEqual(selectedFrame.children[0].geometry, previousGeometry);
  assert.equal(otherFrame.children[0].geometry, otherGeometry);
  assert.equal(selectedFrame.userData.cyclone.windSpeedKmh, 230);
  assert.equal(selectedFrame.children[1].material.uniforms.uRadius.value, cycloneVisualScale(current).radius);
  layer.setEvents([first, other]);
  assert.equal(stormFrames(layer)[0].userData.cyclone.windSpeedKmh, 230);
  const route = layer.group.getObjectByName('Selected cyclone history and forecast');
  assert.equal(route.userData.eventId, 'current');
  assert.equal(route.userData.forecastCount, 2);
  layer.dispose();
});
