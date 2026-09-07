export const cycloneCloudVertex = /* glsl */`
  attribute float aLayer;
  varying vec2 vPatch;
  varying float vLayer;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vPatch = uv * 2.0 - 1.0;
    vLayer = aLayer;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

export const cycloneCloudFragment = /* glsl */`
  uniform float uTime;
  uniform float uSpin;
  uniform float uPhase;
  varying vec2 vPatch;
  varying float vLayer;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0, weight = .53;
    mat2 turn = mat2(.8, -.6, .6, .8);
    for (int octave = 0; octave < 4; octave++) {
      value += noise(p) * weight;
      p = turn * p * 2.09 + vec2(3.7, 1.9);
      weight *= .48;
    }
    return value;
  }
  vec2 rotate(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c) * p;
  }
  float band(float angle, float center, float width) {
    float distance = atan(sin(angle - center), cos(angle - center));
    return exp(-distance * distance / (width * width));
  }
  void main() {
    float radius = length(vPatch);
    if (radius > .998) discard;
    // Slow common rotation carries a different asymmetric structure for every real storm.
    vec2 p = rotate(vPatch, -uSpin * uTime * .045 - uPhase);
    p.x *= 1.0 + .12 * sin(uPhase * 2.3);
    p.y *= 1.0 - .07 * sin(uPhase * 2.3);
    float r = length(p), angle = atan(p.y, p.x);
    vec2 drift = vec2(uTime * .006, -uTime * .004);
    vec2 warp = vec2(fbm(p * 3.3 + uPhase + drift), fbm(p * 3.1 + 17.6 - drift)) - .48;
    vec2 flowing = rotate(p + warp * .06, uSpin * (1.0 - r) * .70);
    float broad = fbm(flowing * 5.0 + uPhase * 2.7);
    float detail = fbm(flowing * vec2(18.0, 16.0) + uPhase * 7.0 + vLayer * .08 + drift);
    float fine = noise(flowing * 70.0 + uPhase + drift * 1.7);
    float raggedR = r + warp.x * .13 + sin(angle * 3.0 + uPhase) * .028;
    float winding = r * (4.7 + .48 * sin(uPhase)) + .52 * log(.16 + r);
    float spiral = uSpin * angle + winding + warp.y * .64;
    float width = .29 + (1.0 - r) * .24 + .085 * sin(r * 9.0 + uPhase);
    float primary = band(spiral, 0.0, width) * (1.0 - smoothstep(.74, 1.02, raggedR));
    float secondary = band(spiral, 2.24 + .38 * sin(uPhase * 1.7), .20 + (1.0 - r) * .25)
      * (1.0 - smoothstep(.53, .88 + .05 * cos(uPhase), raggedR));
    float filament = band(spiral, 4.55 + .3 * cos(uPhase), .11 + (1.0 - r) * .13)
      * (1.0 - smoothstep(.43, .73, raggedR));
    // An irregular central overcast joins the spiral bands; no separate opaque torus.
    float core = (1.0 - smoothstep(.16, .46 + broad * .09, raggedR))
      * (.48 + broad * .53) * (.80 + .20 * sin(angle + r * 7.0 + uPhase));
    float structure = core + primary * .95 + secondary * .70 + filament * .22;
    float breakup = smoothstep(.18, .72, detail + structure * .19);
    breakup = mix(.65 + broad * .20, breakup, smoothstep(.17, .43, r));
    float wisps = smoothstep(.43, .72, detail) * (1.0 - smoothstep(.34, .80, raggedR)) * .10;
    vec2 eyeP = p - vec2(.012 * sin(uPhase), .010 * cos(uPhase * 1.3));
    float eyeR = length(eyeP * vec2(1.12, .9));
    float eye = smoothstep(.060 + broad * .016, .102 + broad * .012, eyeR);
    float outer = 1.0 - smoothstep(.87, .99, radius);
    float density = max(0.0, structure * (.24 + breakup * .82) + wisps - (1.0 - breakup) * .10);
    float alpha = min(.76, density * (vLayer < .5 ? .60 : .27)) * eye * outer;
    if (alpha < .012) discard;
    float daylight = max(dot(normalize(vWorldNormal), normalize(-vWorldPosition)), 0.0);
    float textureLight = clamp(.31 + detail * .88 + fine * .12, 0.0, 1.0);
    vec3 cloud = mix(vec3(.26, .40, .49), vec3(.91, .96, 1.0), textureLight);
    cloud *= .30 + daylight * .73;
    // Sparse internal illumination suggests convective activity without a glowing outline.
    float period = 7.0 + 2.7 * fract(uPhase * .71);
    float cycle = mod(uTime + uPhase * 3.1, period);
    float pulse = exp(-pow((cycle - .09) / .026, 2.0)) + .45 * exp(-pow((cycle - .23) / .045, 2.0));
    vec2 flashP = p - vec2(.24 * cos(uPhase * 2.0), .22 * sin(uPhase * 2.0));
    float flash = exp(-dot(flashP, flashP) * 190.0) * pulse * step(.001, uTime) * smoothstep(.3, .8, density);
    cloud += vec3(.12, .28, .38) * flash;
    gl_FragColor = vec4(cloud, alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const cycloneParticleVertex = /* glsl */`
  attribute vec4 aOrbit;
  uniform float uTime;
  uniform float uSpin;
  uniform float uPhase;
  uniform float uRadius;
  uniform float uHeightScale;
  uniform float uViewport;
  varying float vOpacity;
  varying vec2 vDirection;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  vec3 surface(float radius, float angle) {
    float arc = radius * uRadius;
    float altitude = 1.012 + (.0015 + exp(-pow((radius - .16) / .08, 2.0)) * .002) * uHeightScale;
    return vec3(sin(arc) * cos(angle), sin(arc) * sin(angle), cos(arc)) * altitude;
  }
  void main() {
    float r = .13 + fract(aOrbit.x - uTime * (.005 + aOrbit.w * .003)) * .81;
    float arm = aOrbit.z < .5 ? 0.0 : aOrbit.z < 1.5 ? 2.24 + .38 * sin(uPhase * 1.7) : 4.55 + .3 * cos(uPhase);
    float winding = r * (4.7 + .48 * sin(uPhase)) + .52 * log(.16 + r);
    float angle = uPhase + uSpin * (arm - winding + uTime * .045) + aOrbit.y;
    vec4 mv = modelViewMatrix * vec4(surface(r, angle), 1.0);
    vec4 next = projectionMatrix * modelViewMatrix * vec4(surface(r, angle + uSpin * .015), 1.0);
    gl_Position = projectionMatrix * mv;
    vDirection = normalize(next.xy / next.w - gl_Position.xy / gl_Position.w + vec2(.0000001));
    gl_PointSize = clamp((.0011 + aOrbit.w * .0006) * uViewport / max(.06, -mv.z), 1.0, 5.0);
    float reach = aOrbit.z < .5 ? .89 : aOrbit.z < 1.5 ? .75 : .58;
    vOpacity = smoothstep(.13, .24, r) * (1.0 - smoothstep(reach - .20, reach, r)) * (.075 + aOrbit.w * .075);
    #include <logdepthbuf_vertex>
  }
`;

export const cycloneParticleFragment = /* glsl */`
  varying float vOpacity;
  varying vec2 vDirection;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord - .5;
    vec2 along = vec2(dot(p, vDirection), dot(p, vec2(-vDirection.y, vDirection.x)));
    float shape = exp(-along.x * along.x * 10.0 - along.y * along.y * 85.0);
    float alpha = shape * vOpacity;
    if (alpha < .013) discard;
    gl_FragColor = vec4(vec3(.57, .79, .91), alpha);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
