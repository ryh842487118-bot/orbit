import * as THREE from 'three';
import { clamp, mobile } from '../core/math.js';

/** DOM labels projected from the existing scene, including body occlusion. */
export function createLabels({ camera, controls, world, onSelect }) {
  const { bodies, earth, station, getData, getPosition } = world;
  const labels = [], projected = new THREE.Vector3(), occlusionRay = new THREE.Vector3();

  function add(id, name, stationLabel = false) {
    const element = document.createElement('button');
    element.className = 'celestial-label' + (stationLabel ? ' station' : '');
    element.innerHTML = '<i></i><span></span>';
    element.querySelector('span').textContent = name;
    element.title = '前往' + name;
    element.tabIndex = -1;
    element.onclick = () => onSelect(id);
    document.getElementById('labels').appendChild(element);
    labels.push({ id, element });
  }

  for (const body of bodies.values()) add(body.id, body.cn);
  add('iss', 'ISS · 国际空间站', true);
  add('solar', '太阳系 · 你在这里');

  function update({ labelsVisible, selected }) {
    const distance = camera.position.distanceTo(controls.target), viewW = innerWidth, viewH = innerHeight;
    for (const item of labels) {
      const body = getData(item.id);
      let show = labelsVisible;
      if (item.id === 'solar') show = show && distance > 2800;
      else if (item.id === 'iss') show = show && camera.position.distanceTo(station.position) < 11;
      else if (item.id === 'moon') show = show && camera.position.distanceTo(earth.position) < 55 && selected !== 'iss';
      else show = show && distance < 1400 && camera.position.distanceTo(body.position) < 1400 && item.id !== selected;
      if (!show) {
        item.element.style.opacity = '0';
        item.element.style.pointerEvents = 'none';
        continue;
      }
      const position = getPosition(item.id);
      projected.copy(position).project(camera);
      const px = (projected.x * .5 + .5) * viewW, py = (-projected.y * .5 + .5) * viewH;
      show = projected.z > -1 && projected.z < 1 && px > 18 && px < viewW - 65 && py > 115 && py < viewH - 180;
      if (show && item.id !== 'solar') {
        const toPosition = position.clone().sub(camera.position), length = toPosition.length();
        toPosition.normalize();
        for (const other of bodies.values()) {
          if (other.id === item.id) continue;
          occlusionRay.copy(other.position).sub(camera.position);
          const along = occlusionRay.dot(toPosition);
          if (along > 0 && along < length && occlusionRay.lengthSq() - along * along < other.r * other.r * .99) {
            show = false;
            break;
          }
        }
      }
      // Leave the information column clear on desktop.
      if (!mobile() && px < 340 && py > 145 && py < innerHeight - 215) show = false;
      item.element.style.opacity = show ? '1' : '0';
      item.element.style.pointerEvents = show ? 'auto' : 'none';
      if (show) {
        const radius = item.id === 'solar' ? 4 : (body.r || .13) / Math.max(.1, camera.position.distanceTo(position)) * innerHeight / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * .5;
        item.element.style.transform = `translate(${Math.round(px + clamp(radius, 5, 110) + 8)}px,${Math.round(py - 5)}px)`;
      }
    }
  }

  return { update };
}
