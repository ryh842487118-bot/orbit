import * as THREE from 'three';
import { latLonToVector } from '../../earth/coordinates.js';
import { createMarkerLayer } from '../markers.js';
import { createCycloneGeometry, createCycloneParticles, cycloneSeed } from './cyclone-geometry.js';
import { cycloneCloudVertex, cycloneCloudFragment, cycloneParticleVertex, cycloneParticleFragment } from './cyclone-shaders.js';
import { cycloneVisualScale } from './cyclone-scale.js';
import { createSelectedStormTrack } from './selected-storm-track.js';
import { cycloneCloudCoverage } from './cyclone-cloud-field.js';

export const cycloneRotationSign = latitude => latitude < 0 ? -1 : 1;
export { cycloneVisualScale } from './cyclone-scale.js';
export { cycloneCloudCoverage } from './cyclone-cloud-field.js';

/** Each real storm gets two draw calls: layered spherical clouds and advecting tracers. */
export function createCycloneLayer() {
  const group = new THREE.Group();
  group.name = 'Cyclone cloud systems';
  const anchors = createMarkerLayer({ color: '#a9dfe9', size: () => .32 });
  anchors.group.name = 'Cyclone event anchors';
  anchors.group.visible = false;
  const selectedTrack = createSelectedStormTrack();
  group.add(anchors.group, selectedTrack.group);
  const z = new THREE.Vector3(0, 0, 1);
  let storms = [], time = 0, selectedEvent = null, selectedTrackData = null;

  function releaseClouds() {
    for (const storm of storms) {
      for (const object of [storm.cloud, storm.particles]) {
        object.geometry.dispose();
        object.material.dispose();
      }
      storm.frame.removeFromParent();
    }
    storms = [];
  }

  function setEvents(events) {
    releaseClouds();
    const valid = events.filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lon)
      && Math.abs(event.lat) <= 90 && Math.abs(event.lon) <= 180);
    anchors.setEvents(valid);
    const compact = globalThis.innerWidth <= 600;
    for (const event of valid) {
      const { radius, rotationRate, windSpeedKmh, windBasis } = cycloneVisualScale(event);
      const seed = cycloneSeed(event.id), phase = seed * Math.PI * 2;
      const spin = cycloneRotationSign(event.lat);
      const shared = { uTime: { value: time * rotationRate }, uSpin: { value: spin }, uPhase: { value: phase } };
      const cloud = new THREE.Mesh(
        createCycloneGeometry(radius, compact ? 16 : 20, compact ? 64 : 80, phase),
        new THREE.ShaderMaterial({
          uniforms: shared, vertexShader: cycloneCloudVertex, fragmentShader: cycloneCloudFragment,
          transparent: true, depthWrite: false, depthTest: true,
        }),
      );
      cloud.name = 'Thin asymmetric spiral cloud sheets';
      const particles = new THREE.Points(
        createCycloneParticles(radius, seed, compact ? 72 : 120),
        new THREE.ShaderMaterial({
          uniforms: { ...shared, uRadius: { value: radius }, uHeightScale: { value: THREE.MathUtils.clamp(radius / .145, .45, 1.25) },
            uViewport: { value: (globalThis.innerHeight || 900) * 1.5 } },
          vertexShader: cycloneParticleVertex, fragmentShader: cycloneParticleFragment,
          transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
        }),
      );
      particles.name = 'Cyclonic inflow tracers';
      const frame = new THREE.Group();
      frame.name = `Cyclone: ${event.title || event.id}`;
      frame.userData.cyclone = { radius, windSpeedKmh, windBasis, rotationRate };
      frame.quaternion.setFromUnitVectors(z, latLonToVector(event.lat, event.lon));
      frame.add(cloud, particles);
      group.add(frame);
      storms.push({ event, frame, cloud, particles, spin, phase, rotationRate, radius, compact });
    }
    if (selectedEvent) {
      const refreshed = valid.find(event => event.id === selectedEvent.id);
      if (refreshed) selectedEvent = { ...refreshed, cyclone: selectedEvent.cyclone || refreshed.cyclone };
      updateSelectedIntensity(selectedEvent);
      selectedTrack.setData(selectedEvent, selectedTrackData);
    }
  }

  function updateSelectedIntensity(event) {
    const storm = storms.find(item => item.event.id === event?.id);
    if (!storm) return;
    const visual = cycloneVisualScale(event);
    if (Math.abs(storm.radius - visual.radius) > .000001) {
      const old = storm.cloud.geometry;
      storm.cloud.geometry = createCycloneGeometry(visual.radius, storm.compact ? 16 : 20, storm.compact ? 64 : 80, storm.phase);
      old.dispose();
      storm.particles.material.uniforms.uRadius.value = visual.radius;
      storm.particles.material.uniforms.uHeightScale.value = THREE.MathUtils.clamp(visual.radius / .145, .45, 1.25);
      storm.particles.geometry.boundingSphere.radius = visual.radius + .025;
    }
    storm.radius = visual.radius;
    storm.rotationRate = visual.rotationRate;
    storm.event = event;
    storm.frame.userData.cyclone = visual;
    storm.cloud.material.uniforms.uTime.value = time * visual.rotationRate;
  }

  function setSelected(event, trackData = event?.trackData) {
    selectedEvent = event || null;
    selectedTrackData = trackData || null;
    updateSelectedIntensity(selectedEvent);
    selectedTrack.setData(selectedEvent, selectedTrackData);
  }

  function update(seconds, { reducedMotion = false, scaleFactor = 1 } = {}) {
    time = reducedMotion ? 0 : seconds;
    anchors.update(seconds, { reducedMotion, scaleFactor });
    selectedTrack.update(seconds, { scaleFactor });
    for (const storm of storms) {
      storm.cloud.material.uniforms.uTime.value = time * storm.rotationRate;
      storm.particles.material.uniforms.uViewport.value = (globalThis.innerHeight || 900) * Math.min(globalThis.devicePixelRatio || 1, 1.8) * 1.5;
    }
  }

  function pick(raycaster, surfaceDistance = Infinity) {
    if (!group.visible) return null;
    const candidates = [];
    const track = selectedTrack.pick(raycaster, surfaceDistance);
    if (track) candidates.push(track);
    const anchor = anchors.pick(raycaster, surfaceDistance);
    if (anchor) candidates.push(anchor);
    for (const storm of storms) {
      const hit = raycaster.intersectObject(storm.cloud, false).find(intersection =>
        intersection.distance <= surfaceDistance + .002
        && cycloneCloudCoverage(intersection.uv, { spin: storm.spin, phase: storm.phase, time: time * storm.rotationRate }) > .035);
      if (hit) candidates.push({ event: storm.event, distance: hit.distance });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function dispose() {
    releaseClouds();
    anchors.dispose();
    selectedTrack.dispose();
    group.removeFromParent();
  }
  return { group, setEvents, setSelected, update, pick, dispose,
    diagnostics: () => ({ storms: storms.map(storm => ({ id: storm.event.id, ...storm.frame.userData.cyclone })),
      track: { ...selectedTrack.group.userData, visible: selectedTrack.group.visible } }),
  };
}
