import * as THREE from 'three';

/** Bound the native 8K source to the device's texture/memory budget. */
export function detailTextureWidth({ maxTextureSize = 8192, compact = false, deviceMemory = 8 } = {}) {
  const preferred = compact || deviceMemory <= 4 ? 4096 : 8192;
  const limit = Math.min(preferred, maxTextureSize);
  return 2 ** Math.floor(Math.log2(Math.max(1, limit)));
}

export async function loadDetailTextures(assets, renderer, width) {
  const loader = new THREE.TextureLoader();
  const loaded = [];
  try {
    for (const name of ['earth-day-8k', 'earth-night-8k']) {
      if (!assets[name]) throw new Error('高清地球纹理不可用');
      const texture = await loader.loadAsync(assets[name]);
      loaded.push(texture);
      // Downsample only the GPU upload for phones; preserve original source files.
      if (texture.image.width > width) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = width / 2;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法准备高清地球纹理');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
        texture.image = canvas;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      // Upload one map at a time instead of stalling the first detailed render.
      renderer.initTexture(texture);
    }
    return { day: loaded[0], night: loaded[1], width: loaded[0].image.width };
  } catch (error) {
    loaded.forEach(texture => texture.dispose());
    throw error;
  }
}
