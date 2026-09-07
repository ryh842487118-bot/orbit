import * as THREE from 'three';
import { eventRandom, surfaceFrame, surfacePoint } from './weather-state.js';
import { cloudSheetVertex, cloudSheetFragment } from './cloud-sheet-shaders.js';
import { createCloudNoise } from './cloud-noise.js';

export const CLOUD_EFFECTS = Object.freeze({ opacity: .54, sheetsPerLocation: 3, segments: 20, flashStrength: .52 });

/** Thin curved cloud banks share one draw call and keep their true CPU geometry for picking. */
export function createStormClouds() {
  const group = new THREE.Group();
  group.name = 'Procedural weather clouds';
  const noise = createCloudNoise();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uReducedMotion: { value: 0 },
      uOpacity: { value: CLOUD_EFFECTS.opacity }, uFlashStrength: { value: CLOUD_EFFECTS.flashStrength },
      uNoise: { value: noise },
    },
    vertexShader: cloudSheetVertex, fragmentShader: cloudSheetFragment,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.renderOrder = 3;
  mesh.name = 'Cloud sheet patches';
  group.add(mesh);
  let owners = [];

  function setEvents(appearances) {
    const positions = [], uvs = [], attributes = [], storms = [], seeds = [], indices = [];
    owners = [];
    const point = new THREE.Vector3(), segments = CLOUD_EFFECTS.segments;
    for (const appearance of appearances.filter(item => item.puffs > 0)) {
      const { event, radius, altitude, coverage, darkness, thunder } = appearance;
      const frame = surfaceFrame(event), phase = eventRandom(event, 200);
      const rotation = eventRandom(event, 2) * Math.PI * 2;
      for (let sheet = 0; sheet < CLOUD_EFFECTS.sheetsPerLocation; sheet++) {
        const orientation = rotation + (eventRandom(event, 3 + sheet) - .5) * .65;
        const cosine = Math.cos(orientation), sine = Math.sin(orientation);
        const width = radius * (sheet === 0 ? 1.9 : 1.25 + eventRandom(event, 10 + sheet) * .85);
        const height = radius * (sheet === 0 ? 1.2 : .60 + eventRandom(event, 20 + sheet) * .45);
        const offsetX = sheet === 0 ? 0 : (eventRandom(event, 30 + sheet) - .5) * radius * 1.45;
        const offsetY = sheet === 0 ? 0 : (sheet === 1 ? -1 : 1) * radius * .36;
        const seed = eventRandom(event, 40 + sheet) * 100;
        const start = positions.length / 3;
        for (let y = 0; y <= segments; y++) {
          for (let x = 0; x <= segments; x++) {
            const u = x / segments, v = y / segments;
            const px = (u * 2 - 1) * width + offsetX;
            const py = (v * 2 - 1) * height + offsetY;
            surfacePoint(frame, px * cosine - py * sine, px * sine + py * cosine,
              altitude + sheet * .0007 + .001 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI), point);
            positions.push(...point.toArray()); uvs.push(u, v);
            attributes.push(coverage, darkness, phase, Number(thunder));
            storms.push(appearance.flashPeriod || 18, appearance.flashIntensity);
            seeds.push(seed, sheet);
            if (x < segments && y < segments) {
              const a = start + y * (segments + 1) + x, b = a + 1, c = a + segments + 1, d = c + 1;
              indices.push(a, b, d, a, d, c);
            }
          }
        }
        owners.push(event);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aCloud', new THREE.Float32BufferAttribute(attributes, 4));
    geometry.setAttribute('aStorm', new THREE.Float32BufferAttribute(storms, 2));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    mesh.geometry.dispose(); mesh.geometry = geometry;
    mesh.visible = owners.length > 0;
    group.userData.sheets = owners.length;
    group.userData.locations = owners.length / CLOUD_EFFECTS.sheetsPerLocation;
  }

  return {
    group, setEvents,
    update(time, { reducedMotion = false } = {}) {
      material.uniforms.uTime.value = reducedMotion ? 0 : time;
      material.uniforms.uReducedMotion.value = Number(reducedMotion);
    },
    pick(raycaster, surfaceDistance = Infinity) {
      if (!group.visible || !mesh.visible) return null;
      const hit = raycaster.intersectObject(mesh, false).find(item => {
        if (item.distance > surfaceDistance + .002) return false;
        // Wispy transparent borders are not large invisible click targets.
        const x = item.uv.x * 2 - 1, y = item.uv.y * 2 - 1;
        return x * x + y * y < .52;
      });
      const triangles = CLOUD_EFFECTS.segments ** 2 * 2;
      return hit ? { event: owners[Math.floor(hit.faceIndex / triangles)], distance: hit.distance } : null;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); noise.dispose(); group.removeFromParent(); },
  };
}
