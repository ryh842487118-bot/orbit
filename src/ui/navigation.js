import { reducedMotion } from '../core/math.js';
import { bindBodyPicking } from './picking.js';
import { createDestinations } from './destinations.js';

export function bindNavigationUI({ renderer, camera, world, navigation, assets, toast, onPick }) {
  const $ = id => document.getElementById(id);
  const { flyTo, zoom } = navigation;
  let paused = reducedMotion, speed = 1, orbitsVisible = true, labelsVisible = true;
  let destinations;

  function setPaused(value) {
    paused = value;
    $('pause').innerHTML = paused
      ? '<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
    $('pause').setAttribute('aria-label', paused ? '继续天体运动' : '暂停天体运动');
    $('pause').title = paused ? '继续（空格）' : '暂停（空格）';
  }

  function updateStage(mode) {
    const { activeGalaxyId, activeSystemId } = navigation.getState();
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === mode && (mode === 'local-group'
        || (activeGalaxyId === 'galaxy' && (mode === 'galaxy' || activeSystemId === 'solar')));
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    destinations?.update();
  }

  function restoreState(settings) {
    setPaused(settings.paused);
    speed = settings.speed;
    orbitsVisible = settings.orbitsVisible;
    labelsVisible = settings.labelsVisible;
    $('speed').firstChild.textContent = speed + '×';
    $('toggle-orbits').setAttribute('aria-pressed', String(orbitsVisible));
    $('toggle-labels').setAttribute('aria-pressed', String(labelsVisible));
  }

  function updateHud() {
    const { stage, focusBody, activeGalaxyId, activeSystemId } = navigation.getState();
    updateStage(stage);
    if (stage === 'local-group') {
      $('view-caption').textContent = '本星系群';
      $('view-distance').textContent = '5 座星系 · 点击开始星际航行';
    } else if (stage === 'galaxy') {
      $('view-caption').textContent = world.getData(activeGalaxyId).cn + '全景';
      $('view-distance').textContent = '选择恒星 · 继续缩小前往星系群';
    } else if (stage === 'solar') {
      $('view-caption').textContent = activeSystemId === 'solar' ? '太阳系全景' : world.getData(activeSystemId).cn + '系统';
      $('view-distance').textContent = activeSystemId === 'solar' ? '八大行星运行轨道' : '母星与行星 · 轨道为示意';
    } else {
      const body = world.getData(focusBody);
      $('view-caption').textContent = focusBody === 'earth' ? '地球近轨' : body.cn + (focusBody === 'iss' ? '近景' : '观测');
      if (body.parentGalaxy) {
        $('view-distance').textContent = body.kind === 'star' ? '恒星表面与日冕示意'
          : body.modelStatus === 'illustration' ? '创作示意 · 未确认存在' : '已确认行星 · 表面示意';
        return;
      }
      const surface = Math.max(0, camera.position.distanceTo(world.getPosition(focusBody)) - (body.r || 1));
      const kilometers = Math.round(surface / Math.max(.001, body.r) * Number((body.diameter || '12742').replaceAll(',', '')) / 2);
      $('view-distance').textContent = focusBody === 'iss' ? '地球低轨道' : `距表面约 ${kilometers.toLocaleString('zh-CN')} km`;
    }
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('此浏览器暂不支持全屏，可使用浏览器的全屏模式');
    } catch {
      toast('全屏未开启，可使用浏览器的全屏模式');
    }
  }

  destinations = createDestinations({ world, navigation, assets });
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => flyTo(button.dataset.view));
  $('home').onclick = event => { event.preventDefault(); flyTo('earth'); };
  $('night-view').onclick = () => flyTo('earth', { night: true });
  $('station-view').onclick = () => flyTo('iss');
  $('zoom-in').onclick = () => zoom(.72);
  $('zoom-out').onclick = () => zoom(1.45);
  $('pause').onclick = () => setPaused(!paused);
  $('speed').onclick = () => {
    const speeds = [.25, 1, 5, 20];
    speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    $('speed').firstChild.textContent = speed + '×';
    toast('演示时间流速 ' + speed + '×');
  };
  $('toggle-orbits').onclick = () => {
    orbitsVisible = !orbitsVisible;
    $('toggle-orbits').setAttribute('aria-pressed', String(orbitsVisible));
  };
  $('toggle-labels').onclick = () => {
    labelsVisible = !labelsVisible;
    $('toggle-labels').setAttribute('aria-pressed', String(labelsVisible));
  };
  $('fullscreen').onclick = fullscreen;
  $('help-button').onclick = () => $('help-dialog').showModal();
  $('credits-button').onclick = () => $('credits-dialog').showModal();
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.onclick = event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    const tag = event.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target.isContentEditable) return;
    if (['BUTTON', 'A'].includes(tag) && event.code === 'Space') return;
    if (event.code === 'Space') { event.preventDefault(); setPaused(!paused); }
    if (event.key === '+' || event.key === '=') zoom(.8);
    if (event.key === '-') zoom(1.25);
    if (event.key.toLowerCase() === 'h') flyTo('earth');
    if (event.key.toLowerCase() === 'f') fullscreen();
    if (event.key.toLowerCase() === 'i') {
      document.body.classList.toggle('immersive');
      toast(document.body.classList.contains('immersive') ? '沉浸模式 · 按 I 恢复界面' : '已恢复界面');
    }
    if (event.key === '?') $('help-dialog').showModal();
  });
  bindBodyPicking({ renderer, camera, world, navigation, onPick });
  setPaused(paused);

  return { getState: () => ({ paused, speed, orbitsVisible, labelsVisible }), setPaused, restoreState, updateStage, updateHud };
}
