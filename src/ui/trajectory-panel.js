import { TRAJECTORY_DEFINITIONS } from '../universe/motion-trajectories.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Controls for the shared Sun/planet trajectory view; no separate simulation. */
export function createTrajectoryPanel({ world, navigation }) {
  const panel = element('section', 'trajectory-panel');
  panel.id = 'trajectory-panel';
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  panel.setAttribute('aria-label', '运动轨迹设置');
  const controls = element('div', 'trajectory-controls');

  function segment(label, options, onChange) {
    const group = element('div', 'trajectory-segment');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const buttons = options.map(([value, text, description]) => {
      const button = element('button', '', text);
      button.type = 'button';
      button.dataset.value = value;
      button.title = description;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        onChange(value);
        update();
      };
      group.append(button);
      return button;
    });
    controls.append(group);
    return buttons;
  }

  const referenceButtons = segment('轨迹参照系', [
    ['galactic', '银河参照', '同时观察太阳系的整体运动与行星公转'],
    ['solar', '太阳参照', '跟随太阳，比较八大行星的公转'],
  ], value => world.motionTrajectories?.setReferenceFrame(value));
  const lengthButtons = segment('轨迹显示长度', [
    ['short', '短轨迹', '保留较短的运动轨迹，让画面更清晰'],
    ['long', '长轨迹', '展开更长的一段运动过程'],
  ], value => world.motionTrajectories?.setTrailLength(value));

  const actions = element('div', 'trajectory-actions');
  const reset = element('button', '', '重置视角');
  reset.type = 'button';
  reset.title = '回到运动轨迹全景';
  reset.onclick = () => navigation.flyTo('trajectory');
  const back = element('button', 'trajectory-back', '返回太阳系 ↗');
  back.type = 'button';
  back.onclick = () => navigation.flyTo('solar');
  actions.append(reset, back);
  controls.append(actions);

  const legend = element('div', 'trajectory-legend');
  legend.setAttribute('aria-label', '八大行星轨迹颜色');
  for (const body of TRAJECTORY_DEFINITIONS.filter(body => body.id !== 'sun')) {
    const item = element('span', 'trajectory-legend-item');
    const swatch = element('i');
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.setProperty('--trajectory-color', `#${body.color.toString(16).padStart(6, '0')}`);
    item.append(swatch, element('span', '', body.cn));
    legend.append(item);
  }

  const note = element('div', 'trajectory-note');
  const intro = element('p', 'trajectory-intro', '公转与太阳系整体运动叠加 · 时间与距离压缩示意');
  const explanation = element('details', 'trajectory-explanation');
  const summary = element('summary', '', '说明');
  const content = element('div', 'trajectory-explanation-content');
  content.append(element('p', '', '银河参照叠加太阳系的整体运动；太阳参照跟随太阳，方便比较行星公转。暂停与时间倍速沿用上方控制。'));
  const source = element('a', '', 'NASA · 太阳的轨道与运动 ↗');
  source.href = 'https://science.nasa.gov/sun/facts/';
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.setAttribute('aria-label', 'NASA：太阳的轨道与运动（新标签页）');
  content.append(source);
  explanation.append(summary, content);
  note.append(intro, explanation);
  panel.append(controls, legend, note);

  const footer = document.querySelector('.bottom-ui');
  if (footer) footer.append(panel);
  else {
    panel.classList.add('trajectory-panel-floating');
    document.body.append(panel);
  }
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && explanation.open) {
      explanation.open = false;
      summary.focus({ preventScroll: true });
      event.stopPropagation();
    }
  });

  const orbitControls = ['toggle-orbits', 'toggle-labels'].map(id => document.getElementById(id))
    .filter(Boolean).map(node => ({ node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') }));
  function restoreOrbitControls() {
    for (const { node, inert, ariaHidden } of orbitControls) {
      node.inert = inert;
      if (ariaHidden === null) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', ariaHidden);
    }
  }

  let lastActive = null, lastVisible = null, disposed = false;
  function update() {
    if (disposed) return;
    const active = navigation.getState().stage === 'trajectory';
    const observingEarth = document.body.classList.contains('earthsense-active');
    const visible = active && !observingEarth;
    document.body.classList.toggle('trajectory-active', active);
    if (active !== lastActive) {
      lastActive = active;
      if (active) {
        if (orbitControls.some(({ node }) => node.contains(document.activeElement))) {
          document.getElementById('toggle-trajectories')?.focus({ preventScroll: true });
        }
        for (const { node } of orbitControls) {
          node.inert = true;
          node.setAttribute('aria-hidden', 'true');
        }
      } else restoreOrbitControls();
    }
    if (visible !== lastVisible) {
      lastVisible = visible;
      if (!visible && panel.contains(document.activeElement)) {
        const focusTarget = observingEarth
          ? document.querySelector('[data-mode="earthsense"]')
          : document.getElementById('toggle-trajectories');
        focusTarget?.focus({ preventScroll: true });
      }
      panel.inert = !visible;
      panel.setAttribute('aria-hidden', String(!visible));
      if (!visible) explanation.open = false;
    }
    if (!visible) return;
    const controller = world.motionTrajectories;
    const state = controller?.getState() || {};
    for (const button of referenceButtons) {
      button.disabled = !controller;
      button.setAttribute('aria-pressed', String(button.dataset.value === (state.referenceFrame || 'galactic')));
    }
    for (const button of lengthButtons) {
      button.disabled = !controller;
      button.setAttribute('aria-pressed', String(button.dataset.value === (state.trailLength || 'short')));
    }
  }

  update();
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      panel.remove();
      document.body.classList.remove('trajectory-active');
      restoreOrbitControls();
    },
  };
}
