import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.matchMedia = () => ({ matches: false });
const { advanceObservationFraming } = await import('../src/core/renderer.js');

test('mobile observation framing traverses the 63px shift smoothly and reverses without a jump', () => {
  const camera = new THREE.PerspectiveCamera(43, 390 / 844, .001, 4000000);
  const height = 844;
  function projectFraming(value) {
    camera.setViewOffset(390, height, 0, height * THREE.MathUtils.lerp(-.045, .03, value), 390, height);
    return camera.view.offsetY;
  }
  let value = 0;
  const initialOffset = projectFraming(value);
  const first = advanceObservationFraming(value, true, 1 / 60);
  const firstOffset = projectFraming(first);
  assert.ok(firstOffset > initialOffset);
  assert.ok(firstOffset - initialOffset < 13, 'one frame must not jump the full 63px mode offset');
  assert.equal(camera.aspect, 390 / 844);
  assert.equal(camera.view.offsetX, 0);

  value = first;
  for (let frame = 1; frame < 12; frame++) value = advanceObservationFraming(value, true, 1 / 60);
  const halfwayOffset = projectFraming(value);
  const reversed = advanceObservationFraming(value, false, 1 / 60);
  const reversedOffset = projectFraming(reversed);
  assert.ok(reversedOffset < halfwayOffset, 'reversing starts from the current frame');
  assert.ok(reversedOffset > initialOffset, 'reversing does not reset to the old mode');
  assert.ok(halfwayOffset - reversedOffset < 13);

  for (const observation of [true, false]) {
    for (let frame = 0; frame < 36; frame++) value = advanceObservationFraming(value, observation, 1 / 60);
    assert.equal(value, Number(observation), 'framing settles within 0.6 seconds in either direction');
    assert.equal(projectFraming(value), height * (observation ? .03 : -.045));
  }
});

test('framing timing is stable across refresh rates and respects reduced motion', () => {
  function advanceAt(fps) {
    let value = 0;
    for (let frame = 0; frame < fps / 4; frame++) value = advanceObservationFraming(value, true, 1 / fps);
    return value;
  }
  assert.ok(Math.abs(advanceAt(60) - advanceAt(120)) < 1e-12);
  assert.equal(advanceObservationFraming(.4, true, 0), .4);
  assert.equal(advanceObservationFraming(.4, false, -1), .4);
  assert.equal(advanceObservationFraming(.4, true, 1 / 60, { reducedMotion: true }), 1);
  assert.equal(advanceObservationFraming(.4, false, 1 / 60, { reducedMotion: true }), 0);
});
