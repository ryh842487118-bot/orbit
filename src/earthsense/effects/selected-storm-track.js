import * as THREE from 'three';
import { latLonToVector } from '../../earth/coordinates.js';

export const STORM_TRACK_STYLE = Object.freeze({ history: '#8ef0d0', forecast: '#ffc08a', altitude: 1.023 });
const validPoint = point => Number.isFinite(point?.lon) && Number.isFinite(point?.lat)
  && Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90;

/** Short spherical segments preserve the dateline and keep long routes above the surface. */
export function stormTrackGeometry(points, altitude = STORM_TRACK_STYLE.altitude) {
  const positions = [];
  for (let index = 1; index < points.length; index++) {
    if (!validPoint(points[index - 1]) || !validPoint(points[index])) continue;
    const from = latLonToVector(points[index - 1].lat, points[index - 1].lon);
    const to = latLonToVector(points[index].lat, points[index].lon);
    if (from.dot(to) < -.98) continue;
    const count = Math.max(1, Math.ceil(from.angleTo(to) / .008));
    let previous = from.clone().multiplyScalar(altitude);
    for (let step = 1; step <= count; step++) {
      const next = from.clone().lerp(to, step / count).normalize().multiplyScalar(altitude);
      positions.push(...previous.toArray(), ...next.toArray());
      previous = next;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Only the explicitly selected storm owns a route. Forecasts are never synthesized. */
export function createSelectedStormTrack() {
  const group = new THREE.Group();
  group.name = 'Selected cyclone history and forecast';
  group.visible = false;
  const pointGeometry = new THREE.SphereGeometry(1, 8, 6);
  const pointMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false });
  const historyMaterial = new THREE.LineBasicMaterial({ color: STORM_TRACK_STYLE.history, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
  const forecastMaterial = new THREE.LineDashedMaterial({ color: STORM_TRACK_STYLE.forecast, transparent: true, opacity: .98,
    dashSize: .010, gapSize: .006, depthWrite: false, toneMapped: false });
  const routes = [], points = [];
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  let selected = null, visualScale = 1;

  function clear() {
    for (const route of routes) { route.geometry.dispose(); group.remove(route); }
    for (const mesh of points) { mesh.dispose(); group.remove(mesh); }
    routes.length = points.length = 0;
  }

  function updatePointMatrices(mesh) {
    const records = mesh.userData.trackPoints;
    records.forEach((record, index) => {
      const latest = mesh.userData.trackKind === 'history' && index === records.length - 1;
      matrix.compose(latLonToVector(record.lat, record.lon, 1.027), rotation,
        scale.setScalar(.0055 * (latest ? 1.35 : 1) * Math.max(.12, visualScale)));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  function addPoints(records, kind) {
    const valid = records.filter(validPoint);
    if (!valid.length) return;
    const mesh = new THREE.InstancedMesh(pointGeometry, pointMaterial, valid.length);
    mesh.name = kind === 'history' ? 'Observed track positions' : 'Forecast track positions';
    mesh.userData.trackPoints = valid;
    mesh.userData.trackKind = kind;
    mesh.renderOrder = 12;
    const color = new THREE.Color(STORM_TRACK_STYLE[kind]);
    valid.forEach((_, index) => mesh.setColorAt(index, color.clone().multiplyScalar(kind === 'history'
      ? .6 + index / Math.max(1, valid.length - 1) * .4 : 1)));
    updatePointMatrices(mesh);
    points.push(mesh);
    group.add(mesh);
  }

  function addRoute(records, kind) {
    const geometry = stormTrackGeometry(records);
    if (!geometry.attributes.position.count) { geometry.dispose(); return; }
    const line = new THREE.LineSegments(geometry, kind === 'history' ? historyMaterial : forecastMaterial);
    line.name = kind === 'history' ? 'History — solid' : 'Forecast — dashed';
    line.userData.trackKind = kind;
    line.renderOrder = 11;
    if (kind === 'forecast') line.computeLineDistances();
    routes.push(line);
    group.add(line);
  }

  function setData(event, data) {
    clear();
    selected = event || null;
    const history = Array.isArray(data?.history) ? data.history : [];
    const forecast = Array.isArray(data?.forecast) ? data.forecast : [];
    group.userData = { eventId: event?.id || null, source: data?.source || null, sourceUrl: data?.sourceUrl || null,
      issuedAt: data?.issuedAt || null, status: data?.status || 'unavailable',
      historyCount: history.filter(validPoint).length, forecastCount: forecast.filter(validPoint).length };
    group.visible = Boolean(event && (group.userData.historyCount || group.userData.forecastCount));
    if (!event) return;
    addRoute(history, 'history');
    // The last actual observation connects to the first supplied forecast; no extrapolated point is added.
    const latest = history.filter(validPoint).at(-1);
    addRoute(latest && forecast.length ? [latest, ...forecast] : forecast, 'forecast');
    addPoints(history, 'history');
    addPoints(forecast, 'forecast');
  }

  function update(_time, { scaleFactor = 1 } = {}) {
    const next = THREE.MathUtils.clamp(scaleFactor, .06, 1);
    if (Math.abs(next - visualScale) < .002) return;
    visualScale = next;
    forecastMaterial.dashSize = .010 * Math.max(.12, visualScale);
    forecastMaterial.gapSize = .006 * Math.max(.12, visualScale);
    for (const mesh of points) updatePointMatrices(mesh);
  }

  function pick(raycaster, surfaceDistance = Infinity) {
    if (!group.visible || !selected) return null;
    const pointHit = raycaster.intersectObjects(points, false).find(hit => hit.distance <= surfaceDistance + .002);
    if (pointHit) return { event: selected, distance: pointHit.distance,
      trackKind: pointHit.object.userData.trackKind, trackPoint: pointHit.object.userData.trackPoints[pointHit.instanceId] };
    const previous = raycaster.params.Line.threshold;
    let hit;
    try {
      raycaster.params.Line.threshold = .004 * Math.max(.15, visualScale);
      hit = raycaster.intersectObjects(routes, false).find(item => item.distance <= surfaceDistance + .002);
    } finally { raycaster.params.Line.threshold = previous; }
    return hit ? { event: selected, distance: hit.distance, trackKind: hit.object.userData.trackKind } : null;
  }

  function dispose() {
    clear();
    pointGeometry.dispose(); pointMaterial.dispose(); historyMaterial.dispose(); forecastMaterial.dispose();
    group.removeFromParent();
  }
  return { group, setData, update, pick, dispose };
}
