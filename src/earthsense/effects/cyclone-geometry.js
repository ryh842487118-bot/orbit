import * as THREE from 'three';

/** Thin curved cloud sheets follow the Earth; the eye has modest, uneven vertical relief. */
export function createCycloneGeometry(radius, radialSegments = 20, angularSegments = 80, phase = 0) {
  const positions = [], uvs = [], layers = [], indices = [];
  const heightScale = THREE.MathUtils.clamp(radius / .145, .45, 1.25);
  for (let layer = 0; layer < 2; layer++) {
    const offset = positions.length / 3;
    for (let ring = 0; ring <= radialSegments; ring++) {
      const r = ring / radialSegments, arc = radius * r;
      const eyeWall = Math.exp(-(((r - .16) / .08) ** 2));
      for (let segment = 0; segment <= angularSegments; segment++) {
        const angle = segment / angularSegments * Math.PI * 2;
        const relief = eyeWall * (.0021 + layer * .0006) * (.76 + Math.sin(angle * 2 + phase) * .18)
          + Math.sin(angle * 3 + r * 8 + phase) * .0003 * r;
        const altitude = 1.010 + (layer * .0015 + relief) * heightScale;
        positions.push(Math.sin(arc) * Math.cos(angle) * altitude, Math.sin(arc) * Math.sin(angle) * altitude, Math.cos(arc) * altitude);
        uvs.push(.5 + Math.cos(angle) * r * .5, .5 + Math.sin(angle) * r * .5);
        layers.push(layer);
        if (ring < radialSegments && segment < angularSegments) {
          const a = offset + ring * (angularSegments + 1) + segment;
          const b = a + angularSegments + 1;
          indices.push(a, b, b + 1, a, b + 1, a + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function cycloneSeed(id) {
  let seed = 2166136261;
  for (const letter of String(id)) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619);
  return (seed >>> 0) / 4294967296;
}

export function createCycloneParticles(radius, seed, count = 120) {
  const positions = [], orbits = [];
  let value = Math.round(seed * 4294967295) >>> 0;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  for (let index = 0; index < count; index++) {
    const radial = random(), scatter = (random() - .5) * .34, arm = index % 3, size = random();
    orbits.push(radial, scatter, arm, size);
    // The vertex shader moves these particles along the same unequal main cloud bands.
    positions.push(0, 0, 1.014);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aOrbit', new THREE.Float32BufferAttribute(orbits, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 1.014), radius + .025);
  return geometry;
}
