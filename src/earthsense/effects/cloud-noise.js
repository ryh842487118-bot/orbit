import * as THREE from 'three';

/** A tiny repeating noise field avoids hundreds of trigonometric hashes per cloud pixel. */
export function createCloudNoise() {
  const size = 256, values = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    values[y * size + x] = Math.round((hash - Math.floor(hash)) * 255);
  }
  const texture = new THREE.DataTexture(values, size, size, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
