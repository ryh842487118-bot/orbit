const statusLabels = {
  idle: '待载入', loading: '连接中', success: '已更新', ready: '已更新', live: '已更新',
  error: '暂不可用', stale: '缓存', partial: '部分来源不可用', simulated: '模拟', empty: '暂无事件',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clockTime(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '尚未更新';
}

/** DOM-only observation controls. Data loading and scene visibility belong to EarthSense. */
export function createEarthSensePanel({ layers, onModeChange, onToggle, onRefresh, onSelect, onReturnEarth }) {
  const switcher = element('nav', 'earthsense-mode-switch ui');
  switcher.id = 'earthsense-mode-switch';
  switcher.setAttribute('aria-label', '探索模式');
  const modeButtons = ['universe', 'earthsense'].map((mode, index) => {
    const button = element('button', '', index ? '感知地球' : '宇宙漫游');
    button.type = 'button';
    button.dataset.mode = mode;
    button.setAttribute('aria-pressed', String(!index));
    button.onclick = () => onModeChange(mode);
    switcher.append(button);
    return button;
  });
  const panel = element('aside', 'earthsense-panel ui');
  panel.id = 'earthsense-panel';
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  panel.setAttribute('aria-label', '感知地球图层与事件');
  const eyebrow = element('div', 'eyebrow', '+ EARTHSENSE');
  const titleRow = element('div', 'earthsense-title-row');
  const title = element('h1', '', '感知地球');
  const refresh = element('button', 'earthsense-refresh', '↻');
  refresh.type = 'button';
  refresh.id = 'earthsense-refresh';
  refresh.setAttribute('aria-label', '刷新地球数据');
  refresh.title = '刷新公开数据';
  refresh.onclick = () => onRefresh();
  titleRow.append(title, refresh);
  const subtitle = element('p', 'earthsense-intro', '循着地球的脉动，看见正在发生的世界。');
  const layersElement = element('div', 'earthsense-layers');
  layersElement.setAttribute('aria-label', '独立图层开关');
  const layerControls = new Map();
  let currentState = { layers: {}, events: [] };
  for (const layer of layers) {
    const button = element('button', 'earthsense-layer');
    button.type = 'button';
    button.dataset.layer = layer.id;
    button.style.setProperty('--layer-color', typeof layer.color === 'number' ? `#${layer.color.toString(16).padStart(6, '0')}` : layer.color);
    button.setAttribute('aria-pressed', 'false');
    const dot = element('i', 'earthsense-layer-dot');
    dot.setAttribute('aria-hidden', 'true');
    const label = element('span', 'earthsense-layer-name', layer.label);
    const count = element('span', 'earthsense-layer-count', '—');
    button.append(dot, label, count);
    button.onclick = () => onToggle(layer.id, !currentState.layers[layer.id]?.enabled);
    layerControls.set(layer.id, { button, count, layer });
    layersElement.append(button);
  }
  const sampling = element('p', 'earthsense-sampling', '天气为采样点数据 · 闪电为模拟演示');
  const returnNotice = element('div', 'earthsense-return');
  const returnText = element('p', '', '地球图层已收起，回到地球近景继续观察。');
  const returnButton = element('button', '', '返回地球 ↗');
  returnButton.type = 'button';
  returnButton.onclick = () => onReturnEarth();
  returnNotice.append(returnText, returnButton);
  const eventSection = element('details', 'earthsense-events-section');
  eventSection.open = !matchMedia('(max-width: 600px)').matches;
  const summary = element('summary', 'earthsense-events-heading');
  const eventHeading = element('span', '', '观测点与事件');
  const eventCount = element('span', 'earthsense-total', '0');
  summary.append(eventHeading, eventCount);
  const events = element('div', 'earthsense-events');
  events.setAttribute('aria-label', '已开启图层的事件');
  const search = element('input', 'earthsense-search');
  search.type = 'search';
  search.placeholder = '搜索事件、图层或来源';
  search.setAttribute('aria-label', '搜索地球事件');
  search.autocomplete = 'off';
  search.maxLength = 150;
  search.oninput = () => renderEvents(currentState);
  const empty = element('p', 'earthsense-empty');
  const listNote = element('p', 'earthsense-list-note');
  eventSection.append(summary, search, events, empty, listNote);
  const updateStatus = element('p', 'earthsense-update-status');
  updateStatus.setAttribute('role', 'status');
  const tagline = element('p', 'earthsense-tagline', 'Explore the Universe. Sense the Earth.');
  panel.append(eyebrow, titleRow, subtitle, layersElement, sampling, returnNotice, eventSection, updateStatus, tagline);
  document.body.append(switcher, panel);
  const gestureHint = document.querySelector('.gesture-hint span:last-child');
  const liveLabel = document.querySelector('.live');
  const originalGesture = gestureHint?.textContent;
  const originalLiveNodes = liveLabel ? [...liveLabel.childNodes].map(child => child.cloneNode(true)) : [];
  const universeControls = [...document.querySelectorAll('.info-panel, .planet-dock, .time-control, .layer-toggles')]
    .map(node => ({ node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') }));
  let displayedMode = null;
  let listSignature = '';

  function restoreUniverseControls() {
    for (const { node, inert, ariaHidden } of universeControls) {
      node.inert = inert;
      if (ariaHidden === null) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', ariaHidden);
    }
  }

  function renderEvents(state) {
    const query = search.value.trim().toLocaleLowerCase();
    const order = { typhoon: 0, lightning: 1, weather: 2 };
    const enabledEvents = (state.events || []).filter(event => state.layers[event.layer]?.enabled)
      .sort((a, b) => (order[a.layer] ?? 3) - (order[b.layer] ?? 3));
    const visibleEvents = enabledEvents.filter(event => !query || [event.title, event.layer, event.source, layerControls.get(event.layer)?.layer.label].join(' ').toLocaleLowerCase().includes(query));
    const activeLayers = Object.values(state.layers).filter(info => info.enabled);
    const unavailable = activeLayers.length > 0 && activeLayers.every(info => ['error', 'stale', 'partial'].includes(info.status));
    const signature = JSON.stringify([visibleEvents.map(event => [event.id, event.title, event.time, event.severity]), state.loading, query, unavailable]);
    if (signature === listSignature) return;
    listSignature = signature;
    eventCount.textContent = query ? `${visibleEvents.length} / ${enabledEvents.length}` : String(visibleEvents.length);
    events.replaceChildren();
    for (const event of visibleEvents.slice(0, 50)) {
      const row = element('button', 'earthsense-event');
      row.type = 'button';
      row.dataset.eventId = event.id;
      row.title = event.title;
      const layer = layerControls.get(event.layer)?.layer;
      const meta = element('span', 'earthsense-event-meta', `${layer?.label || event.layer} · ${event.source || '公开数据'}`);
      const name = element('span', 'earthsense-event-name', event.title || '未命名事件');
      const arrow = element('span', 'earthsense-event-arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      row.append(meta, name, arrow);
      row.onclick = () => onSelect(event);
      events.append(row);
    }
    empty.hidden = visibleEvents.length > 0;
    empty.textContent = state.loading ? '正在连接公开数据源…' : unavailable && !enabledEvents.length ? '当前数据暂不可用，请刷新重试。' : query ? '没有匹配的事件。可更换关键词或开启其他图层。' : '当前开启的图层暂无事件。可以开启其他图层，或稍后刷新。';
    listNote.hidden = visibleEvents.length <= 50;
    listNote.textContent = '列出前 50 条 · 其余事件可在地球上点击查看';
  }

  function update(state) {
    currentState = { ...state, layers: state.layers || {}, events: state.events || [] };
    document.body.classList.toggle('earthsense-active', !!state.active);
    if (displayedMode !== !!state.active) {
      displayedMode = !!state.active;
      const outgoing = state.active ? universeControls.map(({ node }) => node) : [panel];
      if (outgoing.some(node => node.contains(document.activeElement))) {
        modeButtons.find(button => (button.dataset.mode === 'earthsense') === !!state.active)
          ?.focus({ preventScroll: true });
      }
      // Keep both trees mounted so CSS can reverse a transition immediately.
      // Inactive trees stop receiving pointer and keyboard input at once.
      panel.inert = !state.active;
      panel.setAttribute('aria-hidden', String(!state.active));
      if (state.active) for (const { node } of universeControls) {
        node.inert = true;
        node.setAttribute('aria-hidden', 'true');
      }
      else restoreUniverseControls();
      if (gestureHint) gestureHint.textContent = state.active ? '点击地球事件' : originalGesture;
      if (liveLabel) {
        liveLabel.replaceChildren(...originalLiveNodes.map(child => child.cloneNode(true)));
        if (state.active) liveLabel.replaceChildren(element('i'), document.createTextNode('地表观测'));
      }
    }
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.mode === 'earthsense') === !!state.active)));
    if (!state.active) return;
    returnNotice.hidden = state.visible !== false;
    panel.classList.toggle('earthsense-away', state.visible === false);
    refresh.disabled = !!state.loading;
    for (const [id, { button, count, layer }] of layerControls) {
      const info = currentState.layers[id] || {};
      button.setAttribute('aria-pressed', String(!!info.enabled));
      const status = statusLabels[info.status] || info.status || '待载入';
      count.textContent = info.status === 'loading' ? '…' : info.status === 'error' && !info.count ? '!' : String(info.count ?? '—');
      button.classList.toggle('has-error', ['error', 'stale', 'partial'].includes(info.status));
      button.title = `${layer.label} · ${status}${info.error ? ' · ' + info.error : ''}`;
      button.setAttribute('aria-label', `${layer.label}${id === 'lightning' ? '（模拟）' : ''}：${info.enabled ? '已开启' : '已关闭'}，${status}，${info.count ?? 0} 个点位`);
    }
    const failures = Object.entries(currentState.layers).filter(([, info]) => info.enabled && ['error', 'stale', 'partial'].includes(info.status));
    updateStatus.textContent = state.loading ? '正在同步公开数据…' : failures.length ? `${failures.length} 个图层数据不完整或使用缓存 · 可刷新重试` : `更新于 ${clockTime(state.updatedAt)} · 点击云层或列表查看`;
    renderEvents(currentState);
  }
  return { update, dispose() {
    panel.remove(); switcher.remove(); document.body.classList.remove('earthsense-active');
    restoreUniverseControls();
    if (gestureHint) gestureHint.textContent = originalGesture;
    liveLabel?.replaceChildren(...originalLiveNodes);
  } };
}
