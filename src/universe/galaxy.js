import * as THREE from "three";
import { random, gaussian, TAU, clamp, mobile } from "../core/math.js";
import { pointCloud } from "../core/point-cloud.js";
import { glow } from "../core/glow.js";
function createGalaxy(scene, pixels, galaxyCenter) {
  let backgroundStars, galaxy, solarMarker;
  const pos = [], cols = [], sizes = [];
  for (let i = 0; i < (mobile() ? 4500 : 8e3); i++) {
    const a = random() * TAU, z = random() * 2 - 1, r = Math.sqrt(1 - z * z);
    pos.push(r * Math.cos(a) * 11e4, z * 11e4, r * Math.sin(a) * 11e4);
    const c = new THREE.Color().setHSL(0.53 + random() * 0.17, 0.08 + random() * 0.3, 0.5 + random() * 0.42);
    cols.push(c.r, c.g, c.b);
    sizes.push((random() < 0.035 ? 3 : 1) * (random() * 1.25 + 0.65));
  }
  backgroundStars = pointCloud(pos, cols, sizes, 0, 0.9, pixels);
  backgroundStars.frustumCulled = false;
  scene.add(backgroundStars);
  const gp = [], gc = [], gs = [];
  const num = mobile() ? 36e3 : 65e3;
  for (let i = 0; i < num; i++) {
    const bulge = i < num * 0.19;
    let x, z, y, r;
    if (bulge) {
      r = Math.pow(random(), 1.3) * 4200;
      const a = random() * TAU;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = gaussian() * 950 * (1 - r / 5e3);
    } else {
      r = 1500 + Math.pow(random(), 0.68) * 27e3;
      const arm = Math.floor(random() * 4);
      const a = arm * Math.PI / 2 + Math.log(r / 1600) * 1.8 + gaussian() * 0.16;
      x = Math.cos(a) * r + gaussian() * 480;
      z = Math.sin(a) * r + gaussian() * 480;
      y = gaussian() * (100 + r * 0.012);
    }
    gp.push(x, y, z);
    const mix = clamp(r / 25e3, 0, 1);
    const c = new THREE.Color(16767144).lerp(new THREE.Color(8960236), mix);
    if (random() > 0.85) c.set(14411775);
    const power = 0.65 + random() * 1.4;
    gc.push(c.r * power, c.g * power, c.b * power);
    gs.push((bulge ? 3 : 2) + random() * 3.5);
  }
  galaxy = pointCloud(gp, gc, gs, 24e3, 0, pixels);
  galaxy.position.copy(galaxyCenter);
  galaxy.rotation.x = 0.13;
  scene.add(galaxy);
  solarMarker = glow(10944495, 650, 0.7);
  scene.add(solarMarker);
  return { galaxy, backgroundStars, solarMarker };
}
export {
  createGalaxy
};
