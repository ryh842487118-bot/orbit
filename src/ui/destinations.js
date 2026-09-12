import { data } from '../universe/catalog.js';

/** Match common name and catalog-number formatting without changing the list. */
export function filterDestinations(items, query = '') {
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\-‐‑–—·]/g, '');
  const needle = normalize(query);
  return needle ? items.filter(body => [body.cn, body.en, body.id, body.index]
    .some(value => normalize(value).includes(needle))) : items;
}

/** Choose the destinations appropriate to the current exploration hierarchy. */
export function destinationContext(state, world) {
  const selected = world.getData(state.selected);
  if (state.stage === 'local-group' || (state.flight && selected?.kind === 'group')) {
    return { key: 'local-group', title: world.getData('local-group').cn, items: world.galaxyDefinitions,
      overviewId: 'galaxy', overviewLabel: '回银河系' };
  }
  if (state.activeGalaxyId !== 'galaxy') {
    const galaxy = world.getData(state.activeGalaxyId);
    const members = [...world.bodies.values()].filter(body => body.parentGalaxy === state.activeGalaxyId);
    return { key: state.activeGalaxyId, title: world.getData(state.activeGalaxyId).cn,
      items: members.length ? members : [galaxy],
      overviewId: state.activeGalaxyId, overviewLabel: '星系全景' };
  }
  if (state.stage === 'galaxy' || state.activeSystemId !== 'solar') {
    const members = [...world.bodies.values()].filter(body => body.parentGalaxy === 'galaxy');
    return { key: 'galaxy', title: '银河目的地',
      items: [world.getData('solar'), ...members.filter(body => body.kind === 'spacecraft'),
        ...members.filter(body => body.kind === 'planet'),
        ...members.filter(body => body.kind !== 'spacecraft' && body.kind !== 'planet')],
      overviewId: 'galaxy', overviewLabel: '银河全景' };
  }
  return { key: 'solar', title: '太阳系', items: [...data, world.getData('jwst'), world.getData('voyager-1')].filter(Boolean), overviewId: 'solar', overviewLabel: '全景' };
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
  if (body.surfaceStyle) image.classList.add(body.surfaceStyle);
  if (body.kind === 'galaxy' && body.profile) image.classList.add(body.profile);
  image.setAttribute('aria-hidden', 'true');
  image.style.setProperty('--body-color', '#' + (body.color ?? 0x9fd9ee).toString(16).padStart(6, '0'));
  if (body.shape === 'irregular' || body.shape === 'elliptical') image.classList.add(body.shape);
  return image;
}

export function createDestinations({ world, navigation, assets }) {
  const $ = id => document.getElementById(id);
  let currentKey;
  let context;
  const search = $('destination-search');
  search.addEventListener('input', renderItems);
  $('overview').onclick = () => navigation.flyTo(context.overviewId);
  $('galaxy-return').onclick = () => navigation.flyTo(navigation.getState().activeGalaxyId);
  $('group-return').onclick = () => navigation.flyTo('local-group');
  $('system-overview').onclick = () => {
    const { activeSystemId } = navigation.getState();
    if (activeSystemId === 'solar') return navigation.flyTo('solar');
    const host = world.getData(activeSystemId);
    if (host?.kind !== 'star') return;
    const orbits = [...world.bodies.values()].filter(body => body.parentStarId === activeSystemId);
    const extent = Math.max(host.r * 9, ...orbits.map(body => body.orbitRadius + body.r));
    navigation.flyTo(activeSystemId, { distance: extent * 3.3 });
  };

  function renderItems() {
    const state = navigation.getState();
    const buttons = filterDestinations(context.items, search.value).map(body => {
      const button = document.createElement('button');
      button.className = 'planet-button';
      button.dataset.id = body.id;
      button.title = '前往' + body.cn;
      const name = document.createElement('span');
      name.className = 'destination-name';
      name.textContent = body.id === 'jwst' ? '韦布 JWST' : body.cn;
      button.append(thumbnail(body, assets), name);
      if (body.modelStatus === 'illustration' || body.modelStatus === 'candidate') {
        const badge = document.createElement('small');
        badge.className = 'destination-status';
        badge.textContent = body.modelStatus === 'illustration' ? '示意' : '候选';
        button.append(badge);
      }
      button.onclick = () => navigation.flyTo(body.id);
      const active = body.id === state.selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      return button;
    });
    if (!buttons.length) {
      const empty = document.createElement('p');
      empty.className = 'destination-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = '没有匹配的天体，试试其他名称或编号';
      buttons.push(empty);
    }
    $('planet-list').replaceChildren(...buttons);
    $('planet-list').scrollLeft = 0;
  }

  function update() {
    const state = navigation.getState();
    context = destinationContext(state, world);
    if (context.key !== currentKey) {
      currentKey = context.key;
      search.value = '';
      renderItems();
      $('dock-context').textContent = context.title;
      $('overview').title = context.overviewLabel;
      $('overview').querySelector('span').textContent = context.overviewLabel;
      document.querySelector('.planet-dock').classList.toggle('deep-space-dock', context.key !== 'solar');
    }
    for (const button of $('planet-list').querySelectorAll('button')) {
      const active = button.dataset.id === state.selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const deep = state.activeGalaxyId !== 'galaxy' || state.activeSystemId !== 'solar' || state.stage === 'galaxy';
    $('deep-space-actions').hidden = !deep || state.stage === 'local-group';
    $('galaxy-return').hidden = state.stage === 'galaxy';
    $('galaxy-return').textContent = '↖ ' + world.getData(state.activeGalaxyId).cn;
    $('system-overview').hidden = state.stage === 'galaxy'
      || world.getData(state.activeSystemId)?.kind !== 'star'
      || ![...world.bodies.values()].some(body => body.parentStarId === state.activeSystemId);
  }
  update();
  return { update };
}
