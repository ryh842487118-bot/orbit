import { createCycloneRouteInfo } from './cyclone-route-info.js';

const layerNames = { weather: '天气', typhoon: '台风 / 风暴', lightning: '闪电 · 模拟' };
const severityNames = { unknown: '未分级', high: '较高', medium: '中等', low: '较低', red: '红色预警', orange: '橙色预警', green: '绿色预警' };

function node(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function formatTime(value) {
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '未提供';
}

function coordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '坐标未提供';
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} / ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

/** Safe text rendering for external event feeds; this panel does not own camera or data. */
export function createEventPopup({ onFocus, onClose }) {
  const panel = node('section', 'earthsense-popup ui');
  panel.id = 'earthsense-event-popup';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'earthsense-popup-title');
  const closeButton = node('button', 'earthsense-popup-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭事件详情');
  const category = node('div', 'eyebrow');
  const title = node('h2', '');
  title.id = 'earthsense-popup-title';
  const location = node('p', 'earthsense-popup-location');
  const description = node('p', 'earthsense-popup-description');
  const metrics = node('dl', 'earthsense-popup-metrics');
  const time = node('p', 'earthsense-popup-time');
  const source = node('a', 'earthsense-popup-source');
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  const focus = node('button', 'earthsense-popup-focus', '放大查看 ↗');
  const route = createCycloneRouteInfo();
  focus.type = 'button';
  panel.append(closeButton, category, title, location, route.element, description, metrics, time, source, focus);
  document.body.append(panel);
  let current = null, previousFocus = null;

  function close(notify = false) {
    const wasOpen = !panel.hidden;
    panel.hidden = true;
    current = null;
    if (wasOpen && panel.contains(document.activeElement)) previousFocus?.focus?.({ preventScroll: true });
    if (notify && wasOpen) onClose?.();
  }
  closeButton.onclick = () => close(true);
  focus.onclick = () => { if (current) onFocus?.(current.trackPoint || current); };
  function onKey(event) {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); }
  }
  document.addEventListener('keydown', onKey);

  function show(event, focusClose = true) {
    if (!event) return close();
    if (panel.hidden) previousFocus = document.activeElement;
    current = event;
    category.textContent = `${layerNames[event.layer] || '地球事件'}${event.severity ? ' / ' + (severityNames[event.severity] || event.severity) : ''}`;
    title.textContent = event.title || '地球事件';
    const position = event.trackPoint || event;
    const positionLabel = event.trackPoint ? `${event.trackKind === 'forecast' ? '预测点' : '历史点'} · ` : '';
    location.textContent = positionLabel + coordinates(position.lat, position.lon);
    description.textContent = event.description || '';
    description.hidden = !event.description;
    metrics.replaceChildren();
    for (const metric of (event.metrics || [])) {
      metrics.append(node('dt', '', metric.label), node('dd', '', String(metric.value ?? '未提供')));
    }
    metrics.hidden = !metrics.childElementCount;
    route.update(event);
    const eventTime = event.time ?? event.timeISO;
    time.textContent = event.layer === 'lightning' && !eventTime ? '模拟演示 · 非实况观测' : `事件时间 · ${formatTime(eventTime)}`;
    let safeUrl = null;
    try { const url = new URL(event.sourceUrl); if (url.protocol === 'https:' || url.protocol === 'http:') safeUrl = url.href; } catch { /* Missing source links remain plain text. */ }
    source.textContent = `${event.source || '数据来源'}${safeUrl ? ' ↗' : ''}`;
    if (safeUrl) source.href = safeUrl;
    else source.removeAttribute('href');
    focus.disabled = !Number.isFinite(position.lat) || !Number.isFinite(position.lon);
    panel.hidden = false;
    if (focusClose) closeButton.focus({ preventScroll: true });
  }
  return { show, close, update(event) { if (!panel.hidden && event) show(event, false); }, dispose() { close(); document.removeEventListener('keydown', onKey); panel.remove(); } };
}
