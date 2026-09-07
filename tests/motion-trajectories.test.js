import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createMotionTrajectories, sampleTrajectoryPosition, trajectoryBounds,
  TRAJECTORY_DEFINITIONS, TRAJECTORY_FORWARD, TRAJECTORY_HISTORY_SECONDS, TRAJECTORY_SAMPLE_COUNT,
} from '../src/universe/motion-trajectories.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 390;
globalThis.innerHeight = 844;

function near(actual, expected, label, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: expected ${expected}, received ${actual}`);
}

function fixture(context, textures = {}) {
  const scene = new THREE.Scene();
  const rendering = createMotionTrajectories(scene, textures, 2);
  context.after(() => rendering.dispose());
  return { scene, rendering };
}

function headState(rendering) {
  return TRAJECTORY_DEFINITIONS.map(definition => {
    const mesh = rendering.group.getObjectByName(`trajectory-body-${definition.id}`);
    return { id: definition.id, position: mesh.position.toArray(), rotation: mesh.rotation.toArray() };
  });
}

test('the moving solar window combines past orbital position with past Galactic displacement', () => {
  const forward = new THREE.Vector3(...TRAJECTORY_FORWARD), age = 19.5, time = 37;
  assert.ok(forward.x > 0 && Math.hypot(forward.y, forward.z) > 0,
    'travel passes obliquely through the planetary disk');
  for (const definition of TRAJECTORY_DEFINITIONS) {
    const solar = sampleTrajectoryPosition(definition, time, age, 'solar');
    const galactic = sampleTrajectoryPosition(definition, time, age, 'galactic');
    near(galactic.distanceTo(solar.clone().addScaledVector(forward, -age)), 0, `${definition.id} frame conversion`);
    near(solar.length(), definition.orbitRadius, `${definition.id} orbital radius`);
    const present = sampleTrajectoryPosition(definition, time, 0, 'galactic');
    near(present.distanceTo(sampleTrajectoryPosition(definition, time, 0, 'solar')), 0,
      `${definition.id} current position is frame-independent`);
    if (definition.period) {
      near(solar.distanceTo(sampleTrajectoryPosition(definition, time, age + definition.period, 'solar')), 0,
        `${definition.id} closes one orbit in the solar frame`);
    } else {
      near(present.length(), 0, 'the present Sun stays at the window origin');
      near(galactic.length(), age * forward.length(), 'the Sun leaves a straight history');
    }
  }
  const earth = TRAJECTORY_DEFINITIONS.find(body => body.id === 'earth');
  assert.equal(TRAJECTORY_HISTORY_SECONDS.short, earth.period * 2);
  assert.equal(TRAJECTORY_HISTORY_SECONDS.long, earth.period * 4);
});

test('prefilled history fits the documented bounds in both frames and both length settings', context => {
  const { rendering } = fixture(context);
  assert.equal(rendering.getState().time, 0);
  assert.equal(rendering.group.visible, false);
  assert.equal(rendering.getState().bodies.length, 9);
  for (const definition of TRAJECTORY_DEFINITIONS) {
    const trail = rendering.group.getObjectByName(`trajectory-trail-${definition.id}`);
    const ages = trail.geometry.attributes.aAge;
    assert.equal(ages.getX(0), 0);
    assert.equal(ages.getX(ages.count - 1), 1);
    assert.equal(trail.material.uniforms.uHistory.value, 48, 'complete history exists before playback starts');
  }
  for (const frame of ['galactic', 'solar']) {
    for (const length of ['short', 'long']) {
      const bounds = trajectoryBounds(frame, length);
      assert.ok(bounds.size[0] <= 600 && bounds.size[1] <= 350 && bounds.size[2] <= 350);
      for (const definition of TRAJECTORY_DEFINITIONS) {
        for (const time of [0, 17, 91]) {
          for (let sample = 0; sample <= 64; sample++) {
            const age = sample / 64 * TRAJECTORY_HISTORY_SECONDS[length];
            const position = sampleTrajectoryPosition(definition, time, age, frame).toArray();
            assert.ok(position.every((value, axis) => value >= bounds.min[axis] && value <= bounds.max[axis]),
              `${definition.id} remains bounded in ${frame}/${length}`);
          }
        }
      }
    }
  }
});

test('inactive and paused playback freeze the demonstration, and all supported speeds advance one clock', context => {
  const { rendering } = fixture(context);
  const initial = headState(rendering);
  rendering.update(10, { active: false, speed: 20 });
  assert.equal(rendering.getState().time, 0);
  assert.equal(rendering.group.visible, false);
  assert.deepEqual(headState(rendering), initial);
  let elapsed = 0;
  for (const speed of [.25, 1, 5, 20]) {
    rendering.update(.5, { active: true, speed });
    elapsed += .5 * speed;
    near(rendering.getState().time, elapsed, `${speed}× clock`);
    for (const definition of TRAJECTORY_DEFINITIONS) {
      const mesh = rendering.group.getObjectByName(`trajectory-body-${definition.id}`);
      near(mesh.position.distanceTo(sampleTrajectoryPosition(definition, elapsed)), 0, `${definition.id} follows playback`);
    }
  }
  const beforePause = headState(rendering);
  rendering.update(15, { active: true, paused: true, speed: 20 });
  assert.equal(rendering.group.visible, true);
  assert.equal(rendering.getState().time, elapsed);
  assert.deepEqual(headState(rendering), beforePause);
  rendering.update(15, { active: false, speed: 20 });
  assert.equal(rendering.group.visible, false);
  assert.equal(rendering.getState().time, elapsed);
  assert.deepEqual(headState(rendering), beforePause);
});

test('reference and history changes animate for 0.4 seconds while paused without moving current bodies', context => {
  const { rendering } = fixture(context);
  rendering.update(3, { active: true });
  const before = headState(rendering), initialCenter = rendering.getCenter().clone();
  const trail = rendering.group.getObjectByName('trajectory-trail-earth');
  assert.equal(rendering.setReferenceFrame('solar'), true);
  assert.equal(rendering.setTrailLength('long'), true);
  assert.equal(rendering.getState().referenceFrame, 'solar');
  assert.equal(rendering.getState().trailLength, 'long');
  assert.equal(rendering.getState().transitioning, true);
  assert.equal(trail.material.uniforms.uGalactic.value, 1, 'the line does not rearrange in the setter');
  assert.equal(trail.material.uniforms.uHistory.value, 48);
  assert.deepEqual(rendering.getCenter().toArray(), initialCenter.toArray());
  rendering.update(.2, { active: true, paused: true, speed: 20 });
  near(trail.material.uniforms.uGalactic.value, .5, 'halfway frame blend');
  near(trail.material.uniforms.uHistory.value, 72, 'halfway history length');
  assert.equal(rendering.getState().time, 3, 'UI transitions do not advance simulation');
  assert.deepEqual(headState(rendering), before);
  const out = new THREE.Vector3();
  assert.equal(rendering.getCenter(out), out, 'caller-owned center storage can be reused every frame');
  near(out.distanceTo(new THREE.Vector3(...rendering.getState().center)), 0, 'lightweight and full state centers agree');
  rendering.update(.2, { active: true, paused: true, speed: .25 });
  assert.equal(rendering.getState().transitioning, false);
  assert.equal(trail.material.uniforms.uGalactic.value, 0);
  assert.equal(trail.material.uniforms.uHistory.value, 96);
  assert.equal(rendering.group.getObjectByName('trajectory-trail-sun').visible, false);
  assert.deepEqual(headState(rendering), before);
  near(rendering.getCenter().length(), 0, 'solar frame centers on the Sun');

  rendering.setReferenceFrame('galactic');
  rendering.update(.2, { active: true, paused: true });
  const halfway = trail.material.uniforms.uGalactic.value;
  rendering.setReferenceFrame('solar');
  assert.equal(trail.material.uniforms.uGalactic.value, halfway, 'reversing preserves the current frame');
  rendering.update(.1, { active: true, paused: true });
  assert.ok(trail.material.uniforms.uGalactic.value > 0 && trail.material.uniforms.uGalactic.value < halfway);
});

test('reduced motion freezes playback and completes frame changes immediately', context => {
  context.mock.method(globalThis, 'matchMedia', () => ({ matches: true }));
  const { rendering } = fixture(context);
  const initial = headState(rendering);
  rendering.update(20, { active: true, speed: 20 });
  assert.equal(rendering.getState().time, 0);
  assert.deepEqual(headState(rendering), initial);
  rendering.setReferenceFrame('solar');
  rendering.setTrailLength('long');
  const state = rendering.getState();
  assert.equal(state.reducedMotion, true);
  assert.equal(state.transitioning, false);
  assert.equal(state.galacticMix, 0);
  assert.equal(state.renderedHistorySeconds, 96);
  assert.deepEqual(headState(rendering), initial);
});

test('display translation and rotation preserve local host lighting without scene-wide lights', context => {
  const { rendering, scene } = fixture(context);
  rendering.group.position.set(0, 6000, 0);
  rendering.group.rotation.set(.3, -.4, .2);
  rendering.update(.4, { active: true });
  scene.updateMatrixWorld(true);
  assert.deepEqual(rendering.group.position.toArray(), [0, 6000, 0]);
  const sun = rendering.group.getWorldPosition(new THREE.Vector3());
  for (const definition of TRAJECTORY_DEFINITIONS.filter(body => body.id !== 'sun')) {
    const mesh = rendering.group.getObjectByName(`trajectory-body-${definition.id}`);
    const expectedLight = sun.clone().sub(mesh.getWorldPosition(new THREE.Vector3())).normalize()
      .applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()).invert());
    near(expectedLight.distanceTo(mesh.material.uniforms.uLightDirection.value), 0, `${definition.id} local host lighting`);
  }
  scene.traverse(object => assert.equal(Boolean(object.isLight), false));
});

test('long-running playback and setting changes retain fixed shared trail buffers', context => {
  const { rendering } = fixture(context);
  const trail = rendering.group.getObjectByName('trajectory-trail-earth'), geometry = trail.geometry;
  const buffers = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, attribute.array]));
  const indices = geometry.index.array;
  for (let frame = 0; frame < 300; frame++) {
    if (frame === 50) rendering.setTrailLength('long');
    if (frame === 150) rendering.setReferenceFrame('solar');
    rendering.update(1 / 60, { active: true, speed: 20 });
  }
  for (const definition of TRAJECTORY_DEFINITIONS) {
    assert.equal(rendering.group.getObjectByName(`trajectory-trail-${definition.id}`).geometry, geometry);
  }
  for (const [name, buffer] of Object.entries(buffers)) assert.equal(geometry.attributes[name].array, buffer);
  assert.equal(geometry.index.array, indices);
  assert.equal(geometry.attributes.position.count, TRAJECTORY_SAMPLE_COUNT * 2);
  assert.equal(geometry.index.count, (TRAJECTORY_SAMPLE_COUNT - 1) * 6);
  assert.ok(geometry.boundingSphere.radius < 300);
  rendering.resize(1.5);
  assert.equal(trail.material.uniforms.uPixelRatio.value, 1.5);
  assert.deepEqual(trail.material.uniforms.uResolution.value.toArray(), [390 * 1.5, 844 * 1.5]);
});

test('invalid inputs do not advance the clock or change valid display settings', context => {
  const { rendering } = fixture(context);
  assert.equal(rendering.setReferenceFrame('unknown'), false);
  assert.equal(rendering.setTrailLength('__proto__'), false);
  assert.equal(rendering.getState().referenceFrame, 'galactic');
  assert.equal(rendering.getState().trailLength, 'short');
  for (const [dt, speed] of [[NaN, 1], [-1, 1], [1, -1], [1, Infinity], [Infinity, 1]]) {
    rendering.update(dt, { active: true, speed });
    assert.equal(rendering.getState().time, 0);
  }
  rendering.resize(NaN);
  assert.equal(rendering.getState().pixelRatio, 2);
  assert.throws(() => sampleTrajectoryPosition(null, 0), RangeError);
  assert.throws(() => sampleTrajectoryPosition(TRAJECTORY_DEFINITIONS[0], 0, -1), RangeError);
  assert.throws(() => sampleTrajectoryPosition(TRAJECTORY_DEFINITIONS[0], NaN), RangeError);
  assert.throws(() => sampleTrajectoryPosition(TRAJECTORY_DEFINITIONS[0], 0, 1, 'unknown'), RangeError);
  assert.throws(() => trajectoryBounds('galactic', 'unknown'), RangeError);
});

test('disposal releases owned buffers, maps and materials exactly once while retaining borrowed textures', () => {
  const scene = new THREE.Scene();
  const textures = Object.fromEntries(TRAJECTORY_DEFINITIONS.slice(1)
    .map(body => [body.texture, new THREE.Texture()]));
  textures['saturn-rings'] = new THREE.Texture();
  const borrowed = new Set(Object.values(textures)), borrowedCounts = new Map([...borrowed].map(texture => [texture, 0]));
  for (const texture of borrowed) texture.addEventListener('dispose', () => borrowedCounts.set(texture, borrowedCounts.get(texture) + 1));
  const rendering = createMotionTrajectories(scene, textures, 1), owned = new Set();
  rendering.group.traverse(object => {
    // THREE.Sprite owns a global shared quad, outside this module's resources.
    if (object.geometry && !object.isSprite) owned.add(object.geometry);
    if (!object.material) return;
    owned.add(object.material);
    if (object.material.map && !borrowed.has(object.material.map)) owned.add(object.material.map);
    for (const uniform of Object.values(object.material.uniforms || {})) {
      if (uniform.value?.isTexture && !borrowed.has(uniform.value)) owned.add(uniform.value);
    }
  });
  const counts = new Map([...owned].map(resource => [resource, 0]));
  for (const resource of owned) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  rendering.dispose();
  rendering.dispose();
  assert.equal(scene.children.length, 0);
  for (const count of counts.values()) assert.equal(count, 1);
  for (const count of borrowedCounts.values()) assert.equal(count, 0);
  rendering.update(1, { active: true });
  assert.equal(rendering.group.visible, false);
});
