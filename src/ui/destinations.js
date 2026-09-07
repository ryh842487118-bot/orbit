import { data } from '../universe/catalog.js';

/** Choose the destinations appropriate to the current exploration hierarchy. */
export function destinationContext(state, world) {
  const selected = world.getData(state.selected);
  if (state.stage === 'local-group' || (state.flight && selected?.kind === 'group')) {
    return { key: 'local-group', title: '本星系群', items: world.galaxyDefinitions,
      overviewId: 'galaxy', overviewLabel: '回银河系' };
  }
  if (state.activeGalaxyId !== 'galaxy') {
    return { key: state.activeGalaxyId, title: world.getData(state.activeGalaxyId).cn,
      items: [...world.bodies.values()].filter(body => body.parentGalaxy === state.activeGalaxyId),
      overviewId: state.activeGalaxyId, overviewLabel: '星系全景' };
  }
  if (state.stage === 'galaxy' || state.activeSystemId !== 'solar') {
    return { key: 'galaxy', title: '银河目的地',
      items: [world.getData('solar'), ...[...world.bodies.values()].filter(body => body.parentGalaxy === 'galaxy')],
      overviewId: 'galaxy', overviewLabel: '银河全景' };
  }
  return { key: 'solar', title: '太阳系', items: data, overviewId: 'solar', overviewLabel: '全景' };
}

function thumbnail(body, assets) {
  if (body.texture && assets[body.texture]) {
    const image = document.createElement('img');
    image.src = assets[body.texture];
    image.alt = '';
    return image;
  }
  const image = document.createElement('span');
  image.className = 'destination-art ' + (body.kind || (body.id === 'solar' ? 'star' : 'galaxy'));
  image.setAttribute('aria-hidden', 'true');
  image.style.setProperty('--body-color', '#' + (body.color ?? 0x9fd9ee).toString(16).padStart(6, '0'));
  if (body.shape === 'irregular') image.classList.add('irregular');
  return image;
}

export function createDestinations({ world, navigation, assets }) {
  const $ = id => document.getElementById(id);
  let currentKey;
  let context;
  $('overview').onclick = () => navigation.flyTo(context.overviewId);
  $('galaxy-return').onclick = () => navigation.flyTo(navigation.getState().activeGalaxyId);
  $('group-return').onclick = () => navigation.flyTo('local-group');
  $('system-overview').onclick = () => {
    const { activeSystemId } = navigation.getState();
    if (activeSystemId === 'solar') return navigation.flyTo('solar');
    const host = world.getData(activeSystemId);
    const orbits = [...world.bodies.values()].filter(body => body.parentStarId === activeSystemId);
    const extent = Math.max(host.r * 9, ...orbits.map(body => body.orbitRadius + body.r));
    navigation.flyTo(activeSystemId, { distance: extent * 3.3 });
  };

  function update() {
    const state = navigation.getState();
    context = destinationContext(state, world);
    if (context.key !== currentKey) {
      currentKey = context.key;
      const buttons = context.items.map(body => {
        const button = document.createElement('button');
        button.className = 'planet-button';
        button.dataset.id = body.id;
        button.title = '前往' + body.cn;
        const name = document.createElement('span');
        name.className = 'destination-name';
        name.textContent = body.cn;
        button.append(thumbnail(body, assets), name);
        if (body.modelStatus === 'illustration' || body.modelStatus === 'candidate') {
          const badge = document.createElement('small');
          badge.className = 'destination-status';
          badge.textContent = body.modelStatus === 'illustration' ? '示意' : '候选';
          button.append(badge);
        }
        button.onclick = () => navigation.flyTo(body.id);
        return button;
      });
      $('planet-list').replaceChildren(...buttons);
      $('planet-list').scrollLeft = 0;
      $('dock-context').textContent = context.title;
      $('overview').title = context.overviewLabel;
      $('overview').querySelector('span').textContent = context.overviewLabel;
      document.querySelector('.planet-dock').classList.toggle('deep-space-dock', context.key !== 'solar');
    }
    for (const button of $('planet-list').children) {
      const active = button.dataset.id === state.selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const deep = state.activeGalaxyId !== 'galaxy' || state.activeSystemId !== 'solar' || state.stage === 'galaxy';
    $('deep-space-actions').hidden = !deep || state.stage === 'local-group';
    $('galaxy-return').hidden = state.stage === 'galaxy';
    $('galaxy-return').textContent = '↖ ' + world.getData(state.activeGalaxyId).cn;
    $('system-overview').hidden = state.stage === 'galaxy' || state.activeSystemId === 'solar';
  }
  update();
  return { update };
}
