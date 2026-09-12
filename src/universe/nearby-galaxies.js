import * as THREE from 'three';
import { pointCloud } from '../core/point-cloud.js';
import { glow } from '../core/glow.js';

const TAU = Math.PI * 2;
const smooth = THREE.MathUtils.smoothstep;

// Each galaxy owns its random sequence; adding one never changes the existing sky.
function galaxyRandom(id) {
  let seed = 2166136261;
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-7, random()))) * Math.cos(TAU * random());
}

function spiralKnots(definition) {
  const arms = definition.arms || 2;
  const twist = definition.armTwist ?? (definition.id === 'andromeda' ? 2.05 : 1.5);
  return Array.from({ length: 6 }, (_, index) => {
    const r = .34 + (index % 3) * .21;
    const angle = (index % arms) * TAU / arms + Math.log(r / .12) * twist;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, size: .018 + (index % 3) * .007 };
  });
}

function cloudKnots(definition) {
  if (definition.profile === 'cigar') return [
    { x: -.34, z: .015, size: .07 },
    { x: .25, z: -.025, size: .055 },
    { x: .02, z: .015, size: .09 },
  ];
  if (definition.id === 'lmc') return [
    { x: -.5, z: -.15, size: .11 },
    { x: .48, z: .22, size: .095 },
    { x: .1, z: -.38, size: .15 },
    { x: -.26, z: .32, size: .17 },
  ];
  if (definition.id === 'smc') return [
    { x: -.3, z: -.16, size: .22 },
    { x: .2, z: .12, size: .16 },
    { x: .6, z: .3, size: .12 },
  ];
  // Irregular dwarfs are loose, asymmetric star associations, with no imposed
  // Magellanic bar. Keep this sequence independent from the stellar particles.
  const random = galaxyRandom(`${definition.id}-associations`);
  return Array.from({ length: 5 }, (_, index) => {
    const angle = index * TAU / 5 + (random() - .5) * .9;
    const radius = .25 + random() * .43;
    return {
      x: Math.cos(angle) * radius + .08,
      z: Math.sin(angle) * radius * .7,
      size: .06 + random() * .075,
    };
  });
}

function createField(definition, pixels, compact) {
  const random = galaxyRandom(definition.id);
  const spiral = definition.shape === 'spiral';
  const elliptical = definition.shape === 'elliptical';
  const compactElliptical = elliptical
    && (definition.profile || (definition.id === 'm32' ? 'compact' : 'diffuse')) === 'compact';
  const giant = elliptical && definition.profile === 'giant';
  const dustLane = elliptical && definition.profile === 'dust-lane';
  const lenticular = spiral && definition.profile === 'lenticular';
  const cigar = definition.profile === 'cigar';
  const axisRatio = THREE.MathUtils.clamp(definition.axisRatio ?? (compactElliptical ? .76 : .55), .35, 1);
  const andromeda = definition.id === 'andromeda';
  const largeCloud = definition.id === 'lmc';
  const magellanic = largeCloud || definition.id === 'smc';
  const count = compact
    ? (andromeda ? 6800 : spiral ? 5500 : elliptical ? (compactElliptical ? 4200 : 3500)
      : largeCloud ? 4600 : magellanic ? 4000 : 2400)
    : (andromeda ? 18000 : spiral ? 15000 : elliptical ? (compactElliptical ? 11000 : 9000)
      : largeCloud ? 12000 : magellanic ? 10000 : 6200);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const knots = elliptical || lenticular ? [] : spiral ? spiralKnots(definition) : cloudKnots(definition);
  const warm = new THREE.Color(elliptical ? (compactElliptical || giant ? 0xffe5be : 0xe6d7bd)
    : andromeda ? 0xffd9a2 : 0xeacb9e);
  const blue = new THREE.Color(andromeda ? 0x97bdeb : 0x8ac7f5);
  const pink = new THREE.Color(0xed91bd);
  const white = new THREE.Color(elliptical ? 0xfff4e5 : 0xe8efff);
  const color = new THREE.Color();
  const radius = definition.radius;

  // Populations are interleaved from the outset, so every LOD contains the bulge,
  // outer arms, and star-forming regions instead of dropping an entire component.
  for (let index = 0; index < count; index++) {
    const population = random();
    let x, y, z, r, isCore = false, isKnot = false, isOutflow = false, dust = 1;
    if (cigar) {
      // An elongated, clumpy starburst with sparse red lobes along its short
      // axis. These particles suggest the observed outflow, not a flow model.
      if (population < .085) {
        const height = .12 + Math.pow(random(), .8) * .7;
        x = gaussian(random) * (.035 + height * .16);
        z = (random() < .5 ? -1 : 1) * height;
        y = gaussian(random) * .025;
        r = Math.hypot(x, z);
        isOutflow = true;
        dust = .44 * (1 - height * .55);
      } else if (population < .45) {
        const knot = knots[Math.floor(random() * knots.length)];
        x = knot.x + gaussian(random) * knot.size;
        z = knot.z + gaussian(random) * knot.size * .7;
        y = gaussian(random) * .035;
        r = Math.hypot(x, z);
        isKnot = true;
        isCore = true;
      } else {
        x = (random() * 2 - 1) * .94;
        z = gaussian(random) * (.035 + .065 * (1 - Math.abs(x)));
        y = gaussian(random) * .045;
        r = Math.hypot(x, z);
        dust = Math.abs(z + .025 * Math.sin(x * 12)) < .018 ? .17 : .8;
      }
    } else if (lenticular) {
      // A broad, almost edge-on disk and large old bulge. Dimming the midplane
      // leaves a visible dust lane without adding an opaque billboard in 3D.
      isCore = population < (definition.bulgeFraction ?? .52);
      if (isCore) {
        r = Math.pow(random(), 1.18) * .55;
        const azimuth = random() * TAU;
        const height = random() * 2 - 1;
        const equatorial = Math.sqrt(1 - height * height);
        x = Math.cos(azimuth) * equatorial * r;
        z = Math.sin(azimuth) * equatorial * r;
        y = height * r * .72;
        dust = Math.abs(y) < .028 ? .035 : 1;
      } else {
        r = .18 + Math.pow(random(), .72) * .82;
        const angle = random() * TAU;
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        y = gaussian(random) * .018;
        dust = Math.abs(y) < .009 ? .08 : .8;
      }
    } else if (elliptical) {
      // A spheroid of old stars: M32 has a strong central concentration, whereas
      // diffuse dwarfs have a broad, weakly peaked envelope. No disk or H-II knots.
      isCore = population < (compactElliptical ? .4 : giant ? .32 : dustLane ? .23 : .035);
      r = isCore
        ? Math.pow(random(), 1.55) * (compactElliptical ? .14 : giant || dustLane ? .23 : .18)
        : Math.pow(random(), compactElliptical ? 1.1 : giant ? .86 : dustLane ? .8 : .57) * .96;
      const azimuth = random() * TAU;
      const height = random() * 2 - 1;
      const equatorial = Math.sqrt(1 - height * height);
      x = Math.cos(azimuth) * equatorial * r;
      z = Math.sin(azimuth) * equatorial * r * axisRatio;
      y = height * r * axisRatio * (giant ? 1 : .78);
      dust = compactElliptical ? .9 : giant ? .94 : dustLane ? .82 : .62;
      if (dustLane && Math.abs(y) < .043 + Math.abs(x) * .035) dust *= .035;
    } else if (spiral) {
      const bulgeFraction = definition.bulgeFraction ?? (andromeda ? .26 : .075);
      if (population < bulgeFraction) {
        r = Math.pow(random(), 1.4) * (andromeda ? .24 : .13);
        const angle = random() * TAU;
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        y = gaussian(random) * (andromeda ? .047 : .022) * (1 - r / .3);
        isCore = true;
      } else if (population > (andromeda ? .955 : .9)) {
        const knot = knots[Math.floor(random() * knots.length)];
        x = knot.x + gaussian(random) * knot.size;
        z = knot.z + gaussian(random) * knot.size;
        y = gaussian(random) * .008;
        r = Math.hypot(x, z);
        isKnot = true;
      } else {
        r = .1 + Math.pow(random(), .69) * .9;
        const arm = Math.floor(random() * (definition.arms || 2));
        const armAngle = arm * TAU / (definition.arms || 2)
          + Math.log(r / .12) * (definition.armTwist ?? (andromeda ? 2.05 : 1.5));
        const armOffset = gaussian(random) * (definition.armSpread ?? (andromeda ? .115 : .22));
        const inArm = population > (andromeda ? .48 : .39);
        const angle = inArm ? armAngle + armOffset : random() * TAU;
        x = Math.cos(angle) * r + gaussian(random) * .009;
        z = Math.sin(angle) * r + gaussian(random) * .009;
        y = gaussian(random) * (.004 + r * .012);
        // A dim inner edge beside each luminous arm gives the disk dust lanes.
        if (inArm && armOffset < -.035 && armOffset > -.115) dust = andromeda ? .2 : .48;
        if (!inArm) dust *= .65;
      }
    } else if (magellanic && population < (largeCloud ? .43 : .2)) {
      x = (random() - .5) * (largeCloud ? 1.48 : 1.05);
      z = gaussian(random) * .075 + x * (largeCloud ? .1 : .28);
      y = gaussian(random) * .035;
      r = Math.hypot(x, z);
      isCore = true;
    } else if (population < (magellanic ? (largeCloud ? .77 : .79) : .56)) {
      const knot = knots[Math.floor(random() * knots.length)];
      x = knot.x + gaussian(random) * knot.size;
      z = knot.z + gaussian(random) * knot.size * .74;
      y = gaussian(random) * knot.size * (magellanic ? .4 : .62);
      r = Math.hypot(x, z);
      isKnot = true;
    } else {
      r = Math.sqrt(random());
      const angle = random() * TAU;
      x = Math.cos(angle) * r * .88 + Math.sin(angle * 2) * .13;
      z = Math.sin(angle) * r * .58 + x * .2;
      y = gaussian(random) * .055;
      dust = magellanic ? .63 : .42;
    }
    positions[index * 3] = x * radius;
    positions[index * 3 + 1] = y * radius;
    positions[index * 3 + 2] = z * radius;
    color.copy(elliptical || lenticular || isCore ? warm : blue);
    if (elliptical) color.lerp(white, isCore ? .42 : .18 + r * .28);
    else if (!isCore && !isKnot) color.lerp(warm, Math.max(0, .42 - r * .7));
    if (isKnot && random() < (andromeda ? .22 : magellanic || spiral ? .4 : .12)) color.copy(pink);
    if (random() < .16) color.lerp(white, .75);
    if (isOutflow) color.setHex(0xff5772);
    const intensity = (.58 + random() * .94) * dust;
    colors[index * 3] = color.r * intensity;
    colors[index * 3 + 1] = color.g * intensity;
    colors[index * 3 + 2] = color.b * intensity;
    sizes[index] = (elliptical ? (isCore ? 1.65 : 1.05) : isKnot ? 2.15 : isCore ? 1.85 : 1.25)
      + random() * (elliptical ? 1.05 : 1.4);
  }
  const points = pointCloud(positions, colors, sizes, radius * 3.6, 0, pixels);
  points.name = `${definition.id}-stars`;
  points.geometry.computeBoundingSphere();
  return { points, knots, count };
}

/** Procedural neighboring galaxies, with one persistent star buffer per galaxy. */
export function createNearbyGalaxies(scene, pixels, definitions) {
  const galaxies = new Map();
  const starFields = [];
  const compact = (globalThis.innerWidth ?? 1024) <= 600;
  const records = [];
  let disposed = false;

  for (const definition of definitions) {
    const group = new THREE.Group();
    group.name = `nearby-${definition.id}`;
    group.position.fromArray(definition.position);
    group.rotation.fromArray(definition.tilt || [0, 0, 0]);
    group.visible = false;
    const { points, knots, count } = createField(definition, pixels, compact);
    const spiral = definition.shape === 'spiral';
    const elliptical = definition.shape === 'elliptical';
    const compactElliptical = elliptical
      && (definition.profile || (definition.id === 'm32' ? 'compact' : 'diffuse')) === 'compact';
    const giant = elliptical && definition.profile === 'giant';
    const dusty = definition.profile === 'dust-lane' || definition.profile === 'lenticular';
    const cigar = definition.profile === 'cigar';
    const andromeda = definition.id === 'andromeda';
    const irregular = !spiral && !elliptical && definition.id !== 'lmc' && definition.id !== 'smc';
    const halo = glow(elliptical ? 0xffe3be : andromeda ? 0xffd6a0 : definition.color || 0xa2c8ef,
      definition.radius * (elliptical ? (compactElliptical ? .42 : giant ? .68 : .6)
        : andromeda ? .56 : cigar ? .18 : .25), 0);
    halo.name = `${definition.id}-core-glow`;
    const accents = [halo];
    const accentOpacities = [dusty ? .015 : elliptical ? (compactElliptical ? .25 : giant ? .22 : .035)
      : andromeda ? .31 : spiral ? .14 : cigar ? .065 : irregular ? .025 : .09];
    group.add(points, halo);
    // Only a couple of low-opacity glows: the stars carry the galaxy's shape.
    if (!andromeda) {
      for (const knot of knots.slice(0, 2)) {
        const accent = glow(cigar ? 0xff9baf : spiral ? 0xc897d9 : 0x8eb8ed,
          definition.radius * (spiral ? .14 : cigar ? .15 : irregular ? .2 : .32), 0);
        accent.position.set(knot.x * definition.radius, 0, knot.z * definition.radius);
        group.add(accent);
        accents.push(accent);
        accentOpacities.push(spiral ? .1 : cigar ? .07 : irregular ? .045 : .075);
      }
    }
    scene.add(group);
    const entry = { definition, group, points, halo };
    galaxies.set(definition.id, entry);
    starFields.push(points);
    records.push({ ...entry, accents, accentOpacities, count });
  }

  function update(camera, { stage, activeGalaxyId, distance } = {}) {
    if (disposed) return;
    const visible = stage === 'galaxy' || stage === 'local-group';
    for (const record of records) {
      const { definition, group, points, count, accents, accentOpacities } = record;
      group.visible = visible;
      if (!visible) continue;
      const cameraDistance = camera.position.distanceTo(group.position);
      const radius = definition.radius;
      const active = activeGalaxyId === definition.id;
      const focusDistance = Number.isFinite(distance) ? distance : cameraDistance;
      const focusFade = active ? smooth(focusDistance, radius * .00012, radius * .025) : 1;
      const insideFade = .18 + .82 * smooth(cameraDistance, radius * .1, radius * 1.15);
      // Perspective softens when entering the disk, rather than letting nearby
      // unresolved stars inflate to the point shader's maximum diameter.
      points.material.uniforms.uPerspective.value = Math.min(radius * 3.6,
        Math.max(radius * .025, cameraDistance * .95));
      const lod = THREE.MathUtils.clamp(radius * 14 / Math.max(cameraDistance, 1), .42, 1);
      points.geometry.setDrawRange(0, Math.ceil(count * lod));
      const opacity = focusFade * insideFade * (stage === 'local-group' || active ? .92 : .74);
      points.material.uniforms.uOpacity.value = opacity / Math.sqrt(lod);
      const glowFade = opacity * smooth(cameraDistance, radius * .18, radius * 1.25);
      for (let index = 0; index < accents.length; index++) {
        accents[index].material.opacity = glowFade * accentOpacities[index];
      }
      group.visible = opacity > .001;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const { group, points, accents } of records) {
      scene.remove(group);
      points.geometry.dispose();
      points.material.dispose();
      // glow() owns its shared texture; disposing only these sprite materials
      // preserves the texture used by the rest of the universe.
      for (const accent of accents) accent.material.dispose();
    }
  }

  return { galaxies, starFields, update, dispose };
}
