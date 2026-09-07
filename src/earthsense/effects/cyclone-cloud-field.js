import { MathUtils } from 'three';

const smooth = (a, b, x) => MathUtils.smoothstep(x, a, b);
const fract = value => value - Math.floor(value);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return MathUtils.lerp(MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}
function fbm(x, y) {
  let value = 0, weight = .53;
  for (let octave = 0; octave < 4; octave++) {
    value += noise(x, y) * weight;
    [x, y] = [(.8 * x + .6 * y) * 2.09 + 3.7, (-.6 * x + .8 * y) * 2.09 + 1.9];
    weight *= .48;
  }
  return value;
}
function rotate(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}
function band(angle, center, width) {
  const distance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-distance * distance / (width * width));
}

/** Match the GPU cloud envelope so the clear eye and gaps remain transparent to picking. */
export function cycloneCloudCoverage(uv, { spin, phase, time = 0 }) {
  const x = uv.x * 2 - 1, y = uv.y * 2 - 1, radius = Math.hypot(x, y);
  if (radius > .998) return 0;
  let [px, py] = rotate(x, y, -spin * time * .045 - phase);
  px *= 1 + .12 * Math.sin(phase * 2.3);
  py *= 1 - .07 * Math.sin(phase * 2.3);
  const r = Math.hypot(px, py), angle = Math.atan2(py, px);
  const dx = time * .006, dy = -time * .004;
  const wx = fbm(px * 3.3 + phase + dx, py * 3.3 + phase + dy) - .48;
  const wy = fbm(px * 3.1 + 17.6 - dx, py * 3.1 + 17.6 - dy) - .48;
  const [flowX, flowY] = rotate(px + wx * .06, py + wy * .06, spin * (1 - r) * .70);
  const broad = fbm(flowX * 5 + phase * 2.7, flowY * 5 + phase * 2.7);
  const detail = fbm(flowX * 18 + phase * 7 + dx, flowY * 16 + phase * 7 + dy);
  const raggedR = r + wx * .13 + Math.sin(angle * 3 + phase) * .028;
  const spiral = spin * angle + r * (4.7 + .48 * Math.sin(phase)) + .52 * Math.log(.16 + r) + wy * .64;
  const primary = band(spiral, 0, .29 + (1 - r) * .24 + .085 * Math.sin(r * 9 + phase))
    * (1 - smooth(.74, 1.02, raggedR));
  const secondary = band(spiral, 2.24 + .38 * Math.sin(phase * 1.7), .20 + (1 - r) * .25)
    * (1 - smooth(.53, .88 + .05 * Math.cos(phase), raggedR));
  const filament = band(spiral, 4.55 + .3 * Math.cos(phase), .11 + (1 - r) * .13)
    * (1 - smooth(.43, .73, raggedR));
  const core = (1 - smooth(.16, .46 + broad * .09, raggedR)) * (.48 + broad * .53)
    * (.80 + .20 * Math.sin(angle + r * 7 + phase));
  const structure = core + primary * .95 + secondary * .70 + filament * .22;
  const breakup = MathUtils.lerp(.65 + broad * .20, smooth(.18, .72, detail + structure * .19), smooth(.17, .43, r));
  const wisps = smooth(.43, .72, detail) * (1 - smooth(.34, .80, raggedR)) * .10;
  const eyeR = Math.hypot((px - .012 * Math.sin(phase)) * 1.12, (py - .010 * Math.cos(phase * 1.3)) * .9);
  const eye = smooth(.060 + broad * .016, .102 + broad * .012, eyeR);
  const density = Math.max(0, structure * (.24 + breakup * .82) + wisps - (1 - breakup) * .10);
  return Math.min(.76, density * .60) * eye * (1 - smooth(.87, .99, radius));
}
