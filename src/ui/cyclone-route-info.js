const clock = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '未提供';
};

/** Show the source forecast's dates and provenance alongside its two distinct line styles. */
export function createCycloneRouteInfo() {
  const element = document.createElement('section');
  element.className = 'earthsense-route-info';
  element.setAttribute('aria-label', '台风路径与风力');

  function line(text, className = '') {
    const item = document.createElement('p');
    item.className = className;
    item.textContent = text;
    element.append(item);
    return item;
  }

  function update(event) {
    element.hidden = event.layer !== 'typhoon';
    element.replaceChildren();
    if (element.hidden) return;
    const wind = event.cyclone;
    if (Number.isFinite(wind?.windSpeedKmh)) {
      const current = wind.windBasis === 'observation';
      line(`${current ? '来源观测风速' : '来源事件最大风速'} · ${wind.windSpeedKmh.toFixed(1)} km/h`, 'earthsense-route-wind');
      if (current && wind.validTime) line(`风力记录 · ${clock(wind.validTime)}`);
    } else line('来源未提供风速 · 云系采用默认示意大小');

    const data = event.trackData;
    const history = data?.history || [], forecast = data?.forecast || [];
    const legend = document.createElement('div');
    legend.className = 'earthsense-route-legend';
    for (const [kind, name, points] of [['history', '历史路径', history], ['forecast', '预测路径', forecast]]) {
      const item = document.createElement('span');
      item.className = `earthsense-route-${kind}`;
      item.textContent = `${name} ${points.length}`;
      legend.append(item);
    }
    element.append(legend);
    if (!data || data.status === 'loading') line('正在获取来源路径与预测…', 'earthsense-route-status');
    else if (data.status === 'error') line(data.message || '路径暂不可用，重新选择此台风可重试。', 'earthsense-route-status');
    else if (!forecast.length) line(data.message || '来源暂无可用预测路径。', 'earthsense-route-status');
    if (data?.issuedAt) line(`预报时次 · ${clock(data.issuedAt)}`);
    if (forecast.length) {
      const last = forecast.at(-1);
      line(`预测至 · ${clock(last.time || last.validTime)}`);
      if (Date.parse(last.time || last.validTime) < Date.now()) line('该次预报已到期 · 显示来源保留的路径', 'earthsense-route-status');
    }
    if (event.trackPoint) {
      const point = event.trackPoint;
      line(`${event.trackKind === 'forecast' ? '预测点' : '历史点'} · ${clock(point.time || point.validTime)}`,
        'earthsense-route-point');
      if (Number.isFinite(point.windSpeedKmh)) line(`该点风速 · ${point.windSpeedKmh.toFixed(1)} km/h`);
    }
    if (data?.source) {
      const link = document.createElement('a');
      link.textContent = `路径来源 · ${data.source}`;
      try {
        const url = new URL(data.sourceUrl);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        }
      } catch { /* A missing source link remains text. */ }
      element.append(link);
    }
  }

  return { element, update };
}
