import * as THREE from "three";
import { data } from "../universe/catalog.js";
async function loadTextures(assets, onProgress) {
  const textures = {};
  const loader = new THREE.TextureLoader();
  const keys = [.../* @__PURE__ */ new Set([...data.map((d) => d.texture), "earth-night", "earth-clouds", "saturn-rings"])];
  let count = 0;
  await Promise.all(keys.map(async (name) => {
    const t = await loader.loadAsync(assets[name]);
    t.colorSpace = name === "earth-clouds" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 8;
    textures[name] = t;
    onProgress(++count / keys.length);
  }));
  return textures;
}
export {
  loadTextures
};
