import * as THREE from "three";
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = () => innerWidth <= 600;
let randomSeed = 20260906;
function random() {
  randomSeed = Math.imul(randomSeed, 1664525) + 1013904223 | 0;
  return (randomSeed >>> 0) / 4294967296;
}
function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.max(1e-6, random()))) * Math.cos(TAU * random());
}
export {
  TAU,
  clamp,
  gaussian,
  mobile,
  random,
  reducedMotion,
  smooth
};
