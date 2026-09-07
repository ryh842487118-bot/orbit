export function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coordinates(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = number(value[0]), lat = number(value[1]);
  return lon !== null && lat !== null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
}

export function text(value, fallback = '', limit = 700) {
  return typeof value === 'string' && value.trim()
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, limit)
    : fallback;
}

export function isoTime(value, seconds = false) {
  if (value === null || value === undefined || value === '') return null;
  let time;
  if (typeof value === 'number') time = Number.isFinite(value) ? value * (seconds ? 1000 : 1) : NaN;
  else if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
    if (!match) return null;
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    if (+month < 1 || +month > 12 || +day < 1 || +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate()
      || +hour > 23 || +minute > 59 || +second > 59) return null;
    // GDACS supplies UTC report times without an explicit offset.
    time = Date.parse(value.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(value) ? `${value}Z` : value);
  }
  return Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? new Date(time).toISOString() : null;
}

export function safeUrl(value, fallback = null) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Invalid source links are omitted; feed failures still propagate. */ }
  return fallback;
}

export function metric(label, value, unit = '', digits = 1) {
  const numeric = number(value);
  return numeric === null ? null : {
    label, value: `${numeric.toLocaleString('zh-CN', { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`,
  };
}

export function uniqueEvents(events) {
  const byId = new Map();
  for (const event of events) {
    if (!byId.has(event.id) || event.time > byId.get(event.id).time) byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => b.time.localeCompare(a.time));
}

export function featureCollection(payload, source) {
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw new Error(`${source} 返回了无法识别的数据格式`);
  }
  return payload.features;
}

export function severityFromAlert(alert) {
  return { red: 'high', orange: 'medium', yellow: 'medium', green: 'low' }[text(alert).toLowerCase()] || 'unknown';
}

export function geometryCenter(geometry) {
  if (geometry?.type === 'Point') return coordinates(geometry.coordinates);
  if (geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates?.[0])) return null;
  const points = geometry.coordinates[0].map(coordinates).filter(Boolean);
  if (points.length < 3) return null;
  if (points[points.length - 1].join(',') === points[0].join(',')) points.pop();
  if (points.length < 3) return null;
  // Spherical averaging keeps an antimeridian polygon near the antimeridian.
  let x = 0, y = 0, z = 0;
  for (const [lon, lat] of points) {
    const lambda = lon * Math.PI / 180, phi = lat * Math.PI / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  return Math.hypot(x, y, z) < 1e-10 ? points[0]
    : [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI];
}

export function linePaths(geometry) {
  const lines = geometry?.type === 'LineString' ? [geometry.coordinates]
    : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
  const paths = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!Array.isArray(line)) continue;
    let path = [];
    for (const point of line) {
      const valid = coordinates(point);
      if (valid) path.push(valid);
      else { if (path.length > 1) paths.push(path); path = []; }
    }
    if (path.length > 1) paths.push(path);
  }
  return paths;
}
