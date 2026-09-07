import { stormFlashGLSL } from './lightning-bolts.js';

export const cloudSheetVertex = /* glsl */`
  attribute vec4 aCloud; attribute vec2 aStorm; attribute vec2 aSeed;
  varying vec4 vCloud; varying vec2 vStorm; varying vec2 vSeed; varying vec2 vPatch;
  varying vec3 vWorldPosition; varying vec3 vWorldNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vCloud = aCloud; vStorm = aStorm; vSeed = aSeed; vPatch = uv * 2.0 - 1.0;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

export const cloudSheetFragment = /* glsl */`
  uniform float uTime; uniform float uReducedMotion; uniform float uOpacity; uniform float uFlashStrength;
  uniform sampler2D uNoise;
  varying vec4 vCloud; varying vec2 vStorm; varying vec2 vSeed; varying vec2 vPatch;
  varying vec3 vWorldPosition; varying vec3 vWorldNormal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return texture2D(uNoise, (i + f + .5) / 256.0).r;
  }
  float fbm(vec2 p) {
    float value = 0.0, amplitude = .53;
    for (int octave = 0; octave < 5; octave++) {
      value += noise(p) * amplitude;
      p = mat2(.86, -.5, .5, .86) * p * 2.07 + vec2(4.1, 2.7);
      amplitude *= .48;
    }
    return value;
  }
  ${stormFlashGLSL}
  void main() {
    vec2 p = vPatch;
    // The boundary dissolves into vapor well before the curved mesh ends.
    float boundary = 1.0 - smoothstep(.90, .99, max(abs(p.x), abs(p.y)));
    if (boundary < .002) discard;
    vec2 travel = vec2(uTime * .018, uTime * .004);
    vec2 q = p * vec2(3.1, 3.6) + vec2(vSeed.x, vSeed.x * .37) - travel;
    vec2 warp = vec2(fbm(q * .7), fbm(q * .7 + 7.3)) - .48;
    float broad = fbm(q + warp * 2.8);
    float fine = fbm(q * 3.9 + warp * 3.2);
    float filaments = fbm(q * vec2(1.5, 2.6) + warp * 3.0);
    float bend = sin(p.x * 3.0 + vSeed.x) * .22;
    vec2 outline = p + warp * .68 + vec2(0.0, bend);
    float raggedRadius = length(outline * vec2(.87, 1.12)) + (broad - .48) * .70 + (fine - .48) * .16;
    float edge = (1.0 - smoothstep(.28, .89, raggedRadius)) * boundary;
    float density = smoothstep(.35, .72, broad * .56 + fine * .27 + filaments * .17);
    density *= edge * (.42 + vCloud.x * .58);
    float alpha = (1.0 - exp(-density * 2.8)) * uOpacity * (vSeed.y < .5 ? 1.0 : .64);
    if (alpha < .006) discard;
    vec3 normal = normalize(vWorldNormal);
    float sun = dot(normal, normalize(-vWorldPosition));
    float daylight = smoothstep(-.16, .3, sun);
    // Texture relief shades cloud density rather than drawing inflated white balls.
    float relief = clamp(.52 + (fine - .42) * .85 + filaments * .18, .25, .9);
    vec3 lit = mix(vec3(.43, .53, .62), vec3(.88, .94, .98), relief);
    lit *= 1.0 - vCloud.y * .32;
    vec3 color = mix(vec3(.028, .051, .082), lit * (.35 + max(sun, 0.0) * .85), daylight);
    float pulse = vCloud.w * vStorm.y * (uReducedMotion > .5 ? .05 : stormFlash(uTime, vCloud.z, vStorm.x));
    float withinCloud = exp(-dot(p * vec2(1.0, 1.5), p * vec2(1.0, 1.5)) * 3.0);
    color += vec3(.16, .37, .72) * pulse * uFlashStrength * withinCloud;
    gl_FragColor = vec4(color, alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
