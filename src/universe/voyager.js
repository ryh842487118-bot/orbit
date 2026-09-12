import * as THREE from 'three';

export const voyagerDefinition = {
  id: 'voyager-1', cn: '旅行者 1 号', en: 'VOYAGER 1', index: 'V1', kind: 'spacecraft',
  parentGalaxy: 'galaxy', parentId: 'solar', parentSystemId: 'solar',
  type: '星际空间 / 深空探测器', r: 1.5, visualRadius: 1.5, color: 0xe3c58b,
  viewDistance: 8.8, viewDirection: [1.3, 0.55, 1.6],
  stat1: '发射日期', diameter: '1977', unit1: '09.05',
  stat2: '越过日球层顶', value2: '2012', unit2: '08.25',
  desc: '白色天线遥望地球，金唱片保存着地球的声音。旅行者 1 号在 1977 年启程，飞掠木星与土星后，于 2012 年 8 月 25 日越过日球层顶，进入星际空间。',
  sourceUrl: 'https://science.nasa.gov/mission/voyager/voyager-1/',
  sourceLabel: 'NASA · 旅行者 1 号',
  modelStatus: 'confirmed',
  modelNote: '结构与位置为展示示意；淡色弧线为简化出发路径，不代表实时星历、距离或姿态。',
};

// Paraboloid opens along +Z, with a recessed center and a shallow raised rim.
function antennaGeometry() {
  const positions = [], indices = [], segments = 72, rings = 22;
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings * 0.62;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), 0.19 * (radius / 0.62) ** 2);
      if (ring < rings && segment < segments) {
        const a = ring * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** A locally generated display model, with fixed illustrative position and attitude. */
export function createVoyager(scene) {
  const group = new THREE.Group(); group.name = 'voyager-1';
  group.position.set(-320, 180, -470); scene.add(group);
  const assembly = new THREE.Group(); assembly.name = 'voyager-assembly';
  assembly.scale.setScalar(0.75); group.add(assembly);
  const pickMeshes = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: 0.44,
    metalness: 0.14, emissive: 0xdcd6c9, emissiveIntensity: 0.18, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xdab05b, roughness: 0.42,
    metalness: 0.65, emissive: 0x98712c, emissiveIntensity: 0.3 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb3bcc2, roughness: 0.38,
    metalness: 0.6, emissive: 0x697782, emissiveIntensity: 0.2 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.58,
    metalness: 0.25, emissive: 0x202a38, emissiveIntensity: 0.24 });
  const recordGold = new THREE.MeshStandardMaterial({ color: 0xf1c56a, roughness: 0.36,
    metalness: 0.65, emissive: 0x9c6a18, emissiveIntensity: 0.42 });

  // These short-range fill lights illuminate only the display model nearby.
  const key = new THREE.PointLight(0xffeed8, 2.4, 7, 0); key.position.set(1.3, 2.2, 3); group.add(key);
  const fill = new THREE.PointLight(0xbbd6ff, 1.6, 6, 0); fill.position.set(-2, 0.5, -1); group.add(fill);
  // One eight-face marker replaces the entire assembly at solar-system scale.
  // Basic material remains visible without adding lights to a distant scene.
  const markerGeometry = new THREE.OctahedronGeometry(1, 0), markerColors = [];
  const markerPositions = markerGeometry.getAttribute('position');
  const paleGold = new THREE.Color(0xd7b16c), ivory = new THREE.Color(0xfff6dc);
  for (let index = 0; index < markerPositions.count; index++) {
    markerColors.push(...paleGold.clone().lerp(ivory, (markerPositions.getY(index) + 1) / 2).toArray());
  }
  markerGeometry.setAttribute('color', new THREE.Float32BufferAttribute(markerColors, 3));
  const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  marker.name = 'voyager-distant-marker'; marker.userData.bodyId = 'voyager-1';
  marker.scale.setScalar(0.15); marker.visible = false; group.add(marker); pickMeshes.push(marker);
  function add(geometry, material, position = [0, 0, 0], name = '', parent = assembly) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(position); mesh.name = name; mesh.userData.bodyId = 'voyager-1';
    parent.add(mesh); pickMeshes.push(mesh); return mesh;
  }
  function rod(from, to, radius = 0.009, material = silver, name = '', parent = assembly) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(start);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material, [0, 0, 0], name, parent);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  const dish = add(antennaGeometry(), white, [0, 0, 0], 'voyager-high-gain-antenna');
  add(new THREE.TorusGeometry(0.62, 0.009, 6, 72), silver, [0, 0, 0.19], 'voyager-antenna-rim');
  const bus = add(new THREE.CylinderGeometry(0.29, 0.29, 0.26, 10), gold,
    [0, 0, -0.23], 'voyager-ten-sided-bus'); bus.rotation.x = Math.PI / 2;
  const base = add(new THREE.CylinderGeometry(0.3, 0.3, 0.018, 10), graphite, [0, 0, -0.365]);
  base.rotation.x = Math.PI / 2;
  for (let index = 0; index < 10; index++) {
    const angle = index / 10 * Math.PI * 2;
    const panel = add(new THREE.BoxGeometry(0.12, 0.013, 0.17), index % 3 ? gold : graphite,
      [Math.sin(angle) * 0.288, Math.cos(angle) * 0.288, -0.24]);
    panel.rotation.z = -angle;
  }
  // Reflector supports, feed housing and rear radial dish ribs.
  for (let index = 0; index < 3; index++) {
    const angle = index / 3 * Math.PI * 2 + Math.PI / 2;
    rod([Math.cos(angle) * 0.49, Math.sin(angle) * 0.49, 0.12], [0, 0, 0.46], 0.009, graphite);
  }
  const feed = add(new THREE.CylinderGeometry(0.045, 0.066, 0.10, 16), white, [0, 0, 0.48], 'voyager-antenna-feed');
  feed.rotation.x = Math.PI / 2;
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    rod([Math.cos(angle) * 0.20, Math.sin(angle) * 0.20, -0.08],
      [Math.cos(angle) * 0.595, Math.sin(angle) * 0.595, 0.158], 0.005, silver);
  }

  // A narrow triangular lattice carries the magnetometers away from the bus.
  const magnetometer = new THREE.Group(); magnetometer.name = 'voyager-magnetometer-boom'; assembly.add(magnetometer);
  const boomStart = new THREE.Vector3(-0.19, -0.16, -0.29), boomEnd = new THREE.Vector3(-1.76, -0.76, -0.34);
  const boomAxis = boomEnd.clone().sub(boomStart).normalize();
  const cross = new THREE.Vector3(0, 0, 1).cross(boomAxis).normalize();
  const other = boomAxis.clone().cross(cross).normalize();
  const ring = (fraction, corner) => boomStart.clone().lerp(boomEnd, fraction)
    .addScaledVector(cross, Math.cos(corner / 3 * Math.PI * 2) * 0.025)
    .addScaledVector(other, Math.sin(corner / 3 * Math.PI * 2) * 0.025);
  for (let section = 0; section < 13; section++) {
    for (let corner = 0; corner < 3; corner++) {
      const a = ring(section / 13, corner), b = ring((section + 1) / 13, corner);
      rod(a.toArray(), b.toArray(), 0.0035, silver, '', magnetometer);
      rod(a.toArray(), ring((section + 1) / 13, (corner + 1) % 3).toArray(), 0.0023, silver, '', magnetometer);
    }
  }
  for (const fraction of [0.58, 1]) {
    add(new THREE.BoxGeometry(0.063, 0.058, 0.056), graphite,
      boomStart.clone().lerp(boomEnd, fraction).toArray(), 'voyager-magnetometer-sensor', magnetometer);
  }

  // Three finned RTGs arranged end-to-end along a separate deployed arm.
  const rtg = new THREE.Group(); rtg.name = 'voyager-radioisotope-power'; assembly.add(rtg);
  const powerStart = new THREE.Vector3(-0.24, 0.15, -0.25), powerEnd = new THREE.Vector3(-0.94, 0.80, -0.33);
  const powerAxis = powerEnd.clone().sub(powerStart).normalize();
  rod(powerStart.toArray(), powerEnd.toArray(), 0.024, silver, 'voyager-rtg-arm', rtg);
  for (let index = 0; index < 3; index++) {
    const position = powerStart.clone().lerp(powerEnd, 0.50 + index * 0.205);
    const generator = new THREE.Group(); generator.position.copy(position);
    generator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), powerAxis); rtg.add(generator);
    add(new THREE.CylinderGeometry(0.071, 0.071, 0.165, 12), graphite, [0, 0, 0], `voyager-rtg-${index + 1}`, generator);
    for (let fin = 0; fin < 8; fin++) {
      const angle = fin / 8 * Math.PI * 2;
      const panel = add(new THREE.BoxGeometry(0.052, 0.152, 0.008), silver,
        [Math.cos(angle) * 0.083, 0, Math.sin(angle) * 0.083], '', generator);
      panel.rotation.y = -angle;
    }
  }

  // The opposite truss carries the instrument scan platform and camera barrels.
  const science = new THREE.Group(); science.name = 'voyager-science-boom'; assembly.add(science);
  for (const y of [-0.10, 0.10]) {
    rod([0.23, y, -0.25], [1.08, y + 0.18, -0.27], 0.012, silver, '', science);
  }
  for (let segment = 0; segment < 6; segment++) {
    const x = 0.25 + segment * 0.135, y = (x - 0.23) / 0.85 * 0.18;
    rod([x, y - 0.10, -0.25], [x + 0.135, y + 0.129, -0.27], 0.006, silver, '', science);
  }
  add(new THREE.BoxGeometry(0.29, 0.23, 0.16), gold, [1.16, 0.18, -0.27], 'voyager-scan-platform', science);
  for (const [x, y, radius] of [[1.08, 0.25, 0.07], [1.24, 0.25, 0.048], [1.16, 0.10, 0.06]]) {
    const camera = add(new THREE.CylinderGeometry(radius, radius, 0.20, 16), graphite, [x, y, -0.09], '', science);
    camera.rotation.x = Math.PI / 2;
    add(new THREE.CircleGeometry(radius * 0.8, 16), silver, [x, y, 0.011], '', science);
  }

  // Golden Record cover is on the side of the bus; engraved rings are illustrative.
  const record = new THREE.Group(); record.name = 'voyager-golden-record';
  record.position.set(0.276, -0.035, -0.24); record.rotation.y = Math.PI / 2; assembly.add(record);
  const cover = add(new THREE.CylinderGeometry(0.117, 0.117, 0.014, 48), recordGold, [0, 0, 0], 'voyager-record-cover', record);
  cover.rotation.x = Math.PI / 2;
  for (const radius of [0.026, 0.036, 0.089, 0.101]) {
    add(new THREE.TorusGeometry(radius, 0.0014, 4, 40), graphite, [0, 0, 0.008], '', record);
  }
  for (let index = 0; index < 9; index++) {
    const angle = index * 2.399;
    rod([-0.035, -0.02, 0.009], [-0.035 + Math.cos(angle) * 0.045, -0.02 + Math.sin(angle) * 0.044, 0.009],
      0.0014, graphite, '', record);
  }
  // Long, thin plasma-wave antennae add the characteristic wire silhouette.
  rod([-0.05, -0.18, -0.3], [0.27, -1.35, -0.37], 0.0025, silver, 'voyager-plasma-wave-antenna-1');
  rod([0.09, -0.17, -0.3], [0.96, -0.94, -0.37], 0.0025, silver, 'voyager-plasma-wave-antenna-2');

  // Fixed composition coordinates are intentionally unrelated to dated ephemerides.
  const journey = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(56, 2, -25),
    new THREE.Vector3(-74, 15, -127), new THREE.Vector3(-212, 91, -286), group.position.clone(),
  ]);
  const trajectory = new THREE.Line(new THREE.BufferGeometry().setFromPoints(journey.getPoints(160)),
    new THREE.LineDashedMaterial({ color: 0xdcc294, transparent: true, opacity: 0.18,
      dashSize: 5, gapSize: 4, depthWrite: false }));
  trajectory.name = 'voyager-illustrative-trajectory'; trajectory.computeLineDistances();
  trajectory.userData.illustrative = true; trajectory.visible = false; scene.add(trajectory);
  const body = { ...voyagerDefinition, group, mesh: dish, pickMeshes, position: group.position };
  let disposed = false;
  // Fixed attitude is deliberate: Voyager is three-axis stabilized, not a spinning planet.
  function update(_dt, _settings = {}) { if (!disposed) group.updateMatrixWorld(true); }
  function updateVisibility(camera, { focusBody = null, activeGalaxyId = null, stage = null, orbitsVisible = true } = {}) {
    if (disposed) return;
    const focusId = typeof focusBody === 'string' ? focusBody : focusBody?.id;
    const focused = focusId === body.id;
    const inGalaxy = !activeGalaxyId || activeGalaxyId === 'galaxy';
    const localStage = !['trajectory', 'universe', 'local-group'].includes(stage);
    const distance = camera.position.distanceTo(body.position);
    group.visible = inGalaxy && localStage && (focused || distance < 2200);
    const detailed = distance <= 110;
    assembly.visible = dish.visible = key.visible = fill.visible = group.visible && detailed;
    marker.visible = group.visible && !detailed;
    marker.scale.setScalar(THREE.MathUtils.clamp(distance * 0.0012, 0.15, 1));
    marker.updateMatrixWorld(true);
    trajectory.visible = group.visible && orbitsVisible && (focused || distance < 1600);
    trajectory.material.opacity = focused ? 0.16 : 0.12;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; group.visible = assembly.visible = dish.visible = marker.visible = trajectory.visible = false;
    key.visible = fill.visible = false;
    group.removeFromParent(); trajectory.removeFromParent();
    const geometries = new Set(), materials = new Set();
    for (const root of [group, trajectory]) root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat()) if (material) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
  update(0);
  return { body, trajectory, update, updateVisibility, dispose };
}
