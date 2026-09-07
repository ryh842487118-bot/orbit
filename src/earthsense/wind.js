import * as THREE from 'three';
import { latLonToVector } from '../earth/coordinates.js';
import { loadWeather } from '../data/open-meteo.js';

export function createWindLayer() {
  const group = new THREE.Group();
  const lineGeometry = new THREE.BufferGeometry();
  const particleGeometry = new THREE.BufferGeometry();
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x93ecdc, transparent: true, opacity: .5, depthWrite: false });
  const particleMaterial = new THREE.PointsMaterial({ color: 0xd7fff4, size: .009, transparent: true, opacity: .9, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(lines, particles);
  let streams = [], owners = [], particlePositions;
  const point = new THREE.Vector3();

  function at(stream, fraction, out = new THREE.Vector3()) {
    const angle = stream.arc * fraction;
    return out.copy(stream.normal).multiplyScalar(Math.cos(angle))
      .addScaledVector(stream.tangent, Math.sin(angle)).multiplyScalar(1.025);
  }

  function setEvents(events) {
    streams = events.filter(event => Number.isFinite(event.weather?.windSpeed) && Number.isFinite(event.weather?.windDirection))
      .map(event => {
        const lat = THREE.MathUtils.degToRad(event.lat), lon = THREE.MathUtils.degToRad(event.lon);
        const bearing = THREE.MathUtils.degToRad(event.weather.windDirection);
        const north = new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
        const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon));
        // Meteorological bearings describe where wind comes FROM.
        const tangent = north.multiplyScalar(-Math.cos(bearing)).addScaledVector(east, -Math.sin(bearing));
        return { event, normal: latLonToVector(event.lat, event.lon), tangent, arc: .04 + Math.min(event.weather.windSpeed / 400, .18) };
      });
    const positions = [];
    owners = [];
    for (const stream of streams) {
      for (let segment = 0; segment < 10; segment++) {
        positions.push(...at(stream, segment / 10).toArray(), ...at(stream, (segment + 1) / 10).toArray());
        owners.push(stream.event);
      }
      const end = at(stream, 1), back = at(stream, .83);
      const side = new THREE.Vector3().crossVectors(stream.normal, stream.tangent).multiplyScalar(.008);
      for (const sign of [-1, 1]) {
        positions.push(...end.toArray(), ...back.clone().addScaledVector(side, sign).normalize().multiplyScalar(1.025).toArray());
        owners.push(stream.event);
      }
    }
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    lineGeometry.computeBoundingSphere();
    particlePositions = new Float32Array(streams.length * 3 * 3);
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
    particles.frustumCulled = false;
    update(0);
  }

  function update(time, { reducedMotion = false } = {}) {
    if (!particlePositions) return;
    streams.forEach((stream, index) => {
      for (let particle = 0; particle < 3; particle++) {
        const phase = reducedMotion ? 0 : time * (.035 + stream.event.weather.windSpeed * .0015);
        at(stream, (phase + particle / 3) % 1, point).toArray(particlePositions, (index * 3 + particle) * 3);
      }
    });
    particleGeometry.attributes.position.needsUpdate = true;
  }

  function pick(raycaster, surfaceDistance = Infinity) {
    const previous = raycaster.params.Line.threshold;
    raycaster.params.Line.threshold = .008;
    const hit = raycaster.intersectObject(lines, false).find(item => item.distance <= surfaceDistance + .002);
    raycaster.params.Line.threshold = previous;
    return hit ? { event: owners[Math.floor(hit.index / 2)], distance: hit.distance } : null;
  }
  return {
    group, setEvents, update, pick,
    dispose() { lineGeometry.dispose(); particleGeometry.dispose(); lineMaterial.dispose(); particleMaterial.dispose(); group.removeFromParent(); },
  };
}

export const wind = {
  id: 'wind', label: '风场', color: '#93ecdc', enabled: false, ttl: 15 * 60_000,
  load: async options => (await loadWeather(options)).map(event => ({ ...event, id: event.id + '-wind', layer: 'wind', title: '风场 · ' + event.title })),
  createView: createWindLayer,
};
