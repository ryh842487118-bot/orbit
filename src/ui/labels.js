import * as THREE from 'three';
import { clamp, mobile } from '../core/math.js';

/** DOM labels projected from the existing scene, including body occlusion. */
export function createLabels({ camera, controls, world, onSelect }) {
  const { bodies, earth, station, getData, getPosition } = world;
  const labels = [], occupied = [];
  const projected = new THREE.Vector3(), occlusionRay = new THREE.Vector3(), toPosition = new THREE.Vector3();
  const galaxies = new Map((world.galaxyDefinitions || []).map(definition => [definition.id, definition]));

  function add(id, name, type = 'body') {
    const element = document.createElement('button');
    element.className = 'celestial-label' + (type === 'station' ? ' station' : type === 'galaxy' ? ' galaxy-label' : '');
    element.dataset.bodyId = id;
    element.innerHTML = '<i></i><span></span>';
    element.querySelector('span').textContent = name;
    element.title = '前往' + name;
    element.tabIndex = -1;
    element.onclick = () => onSelect(id);
    document.getElementById('labels').appendChild(element);
    labels.push({ id, name, type, element });
  }

  for (const body of bodies.values()) if (!body.parentGalaxy) add(body.id, body.cn);
  add('iss', 'ISS · 国际空间站', 'station');
  add('solar', '太阳系 · 你在这里');
  for (const body of bodies.values()) if (body.parentGalaxy) add(body.id, body.cn);
  for (const galaxy of galaxies.values()) add(galaxy.id, galaxy.cn, 'galaxy');

  function isVisible(object) {
    for (let node = object; node; node = node.parent) if (node.visible === false) return false;
    return true;
  }

  function update({ labelsVisible, satellitesVisible = true, selected, stage, activeGalaxyId, activeSystemId, galaxyViewDistance: framedGalaxyDistance }) {
    const distance = camera.position.distanceTo(controls.target), viewW = innerWidth, viewH = innerHeight;
    const compact = mobile();
    const selectedData = getData(selected);
    const galaxyId = activeGalaxyId || selectedData?.parentGalaxy
      || (selectedData?.kind === 'galaxy' ? selected : 'galaxy');
    const systemId = activeSystemId || selectedData?.parentStarId
      || (selectedData?.kind === 'star' ? selected : 'solar');
    const mode = stage || (distance > 200000 ? 'local-group' : distance > 2600 ? 'galaxy' : distance > 28 ? 'solar' : 'earth');
    const solarSystem = galaxyId === 'galaxy' && systemId === 'solar' && mode !== 'local-group';
    const galaxyViewDistance = framedGalaxyDistance || galaxies.get(galaxyId)?.viewDistance || 68000;
    occupied.length = 0;
    for (const item of labels) {
      const body = getData(item.id);
      let show = labelsVisible;
      const deepLabel = item.type === 'galaxy' || Boolean(body?.parentGalaxy);
      if (item.type === 'galaxy') {
        show = show && (mode === 'local-group' || (mode === 'galaxy' && distance > 90000 && item.id !== galaxyId));
      } else if (body?.parentGalaxy && (body.kind === 'star' || body.kind === 'black-hole')) {
        const inGalaxy = mode === 'galaxy' && distance < galaxyViewDistance * 1.7;
        const inSystem = mode !== 'local-group' && item.id === systemId
          && camera.position.distanceTo(body.position) < Math.max(1200, body.r * 100);
        show = show && body.parentGalaxy === galaxyId && (inGalaxy || inSystem) && item.id !== selected;
      } else if (body?.parentGalaxy && body.kind === 'planet') {
        show = show && body.parentGalaxy === galaxyId && body.parentStarId === systemId
          && (mode === 'earth' || mode === 'solar') && item.id !== selected
          && camera.position.distanceTo(body.position) < Math.max(1400, (body.orbitRadius || 0) * 9);
      } else if (item.id === 'solar') show = show && galaxyId === 'galaxy' && mode === 'galaxy' && distance > 2800;
      else if (item.id === 'iss') show = show && satellitesVisible && isVisible(station) && solarSystem && camera.position.distanceTo(station.position) < 11;
      else if (item.id === 'moon') show = show && solarSystem && camera.position.distanceTo(earth.position) < 55 && selected !== 'iss';
      else show = show && solarSystem && distance < 1400 && camera.position.distanceTo(body.position) < 1400 && item.id !== selected;
      if (!show) {
        item.element.style.opacity = '0';
        item.element.style.pointerEvents = 'none';
        continue;
      }
      const position = getPosition(item.id);
      projected.copy(position).project(camera);
      const px = (projected.x * .5 + .5) * viewW, py = (-projected.y * .5 + .5) * viewH;
      const rightMargin = item.type === 'galaxy' ? 18 : 65;
      show = projected.z > -1 && projected.z < 1 && px > 18 && px < viewW - rightMargin && py > 115 && py < viewH - 180;
      if (show && item.id !== 'solar' && item.type !== 'galaxy') {
        toPosition.copy(position).sub(camera.position);
        const length = toPosition.length();
        toPosition.normalize();
        for (const other of bodies.values()) {
          if (other.id === item.id || !isVisible(other.mesh) || !isVisible(other.group)) continue;
          occlusionRay.copy(other.position).sub(camera.position);
          const along = occlusionRay.dot(toPosition);
          if (along > 0 && along < length && occlusionRay.lengthSq() - along * along < other.r * other.r * .99) {
            show = false;
            break;
          }
        }
      }
      // Leave the information column clear on desktop.
      if (!compact && px < 340 && py > 145 && py < innerHeight - 215) show = false;
      const radius = item.id === 'solar' || item.type === 'galaxy' ? 4
        : (body.r || .13) / Math.max(.1, camera.position.distanceTo(position))
          * innerHeight / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * .5;
      let x = Math.round(px + clamp(radius, 5, 110) + 8);
      const y = Math.round(py - 5);
      // Estimate the compact text box without a layout read on each animation frame.
      const fontSize = compact ? 9 : 11;
      const width = [...item.name].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? fontSize : fontSize * .64) + 1, 28);
      const besideScale = item.type === 'galaxy' && compact && py > viewH * .4 - 20 && py < viewH - 180;
      const rightEdge = viewW - (besideScale ? 88 : 20);
      if (item.type === 'galaxy') {
        const flip = x + width + 4 >= rightEdge;
        if (flip) x = Math.round(Math.max(22, Math.min(px - width - 12, rightEdge - width - 8)));
        // Keep the marker beside its galaxy when the text opens to the left.
        item.element.style.flexDirection = flip ? 'row-reverse' : '';
      }
      const box = { left: x - 4, top: y - 4, right: x + width + 4, bottom: y + 23 };
      if (show && deepLabel) {
        show = box.right < rightEdge && !occupied.some(other => box.left < other.right && box.right > other.left
          && box.top < other.bottom && box.bottom > other.top);
      }
      item.element.style.opacity = show ? '1' : '0';
      item.element.style.pointerEvents = show ? 'auto' : 'none';
      if (show) {
        item.element.style.transform = `translate(${x}px,${y}px)`;
        occupied.push(box);
      }
    }
  }

  return { update };
}
