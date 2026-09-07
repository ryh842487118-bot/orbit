import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchJson } from '../src/data/http.js';
import { coordinates, isoTime, linePaths, safeUrl } from '../src/data/normalize.js';
import { loadWeather, parseWeather, WEATHER_LOCATIONS, WEATHER_URL } from '../src/data/open-meteo.js';
import { loadEarthquakes, parseEarthquakes } from '../src/data/usgs.js';
import { loadEonet, parseEonet } from '../src/data/eonet.js';
import { loadGdacs, parseGdacs } from '../src/data/gdacs.js';

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const response = value => ({ ok: true, status: 200, json: async () => value });
const clone = value => JSON.parse(JSON.stringify(value));
const abortingFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
  const abort = () => reject(new DOMException('Aborted', 'AbortError'));
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
});

test('coordinate, URL, and time validation never coerces missing observations to zero', () => {
  assert.deepEqual(coordinates([0, 0]), [0, 0]);
  for (const invalid of [[null, 0], [false, 0], [181, 0], [0, -91], [Infinity, 0], []]) {
    assert.equal(coordinates(invalid), null);
  }
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'http://example.com', 'https://x:y@example.com']) {
    assert.equal(safeUrl(url), null);
  }
  assert.equal(safeUrl('https://example.com/event'), 'https://example.com/event');
  assert.equal(isoTime(1788714000, true), isoTime(1788714000000));
  assert.equal(isoTime('2026-09-04T12:00:00'), '2026-09-04T12:00:00.000Z');
  for (const date of [null, '', false, NaN, '2026-02-30T12:00:00Z', '2026-09-04T25:00:00Z']) {
    assert.equal(isoTime(date), null);
  }
});

test('real Open-Meteo batch retains accumulation interval, units, and nullable measurements', async () => {
  const data = await fixture('weather');
  const locations = [{ lat: 31.23, lon: 121.47 }, { lat: 51.51, lon: -0.13 }];
  const events = parseWeather(data, locations);
  assert.equal(events.length, 2);
  assert.equal(events[0].weather.interval, 900);
  assert.equal(events[0].weather.temperature, data[0].current.temperature_2m);
  assert.equal(events[0].time, new Date(data[0].current.time * 1000).toISOString());
  assert.ok(events[0].metrics.some(item => item.label === '降水（近 15 分钟）' && item.value.endsWith('mm')));
  data[0].current.temperature_2m = null;
  data[0].current.wind_speed_10m = null;
  data[0].current.cloud_cover = 150;
  const missing = parseWeather(data, locations)[0];
  assert.equal(missing.weather.temperature, null);
  assert.equal(missing.weather.windSpeed, null);
  assert.equal(missing.weather.cloudCover, null);
  assert.ok(!missing.metrics.some(item => item.label === '气温'));
  assert.throws(() => parseWeather([], locations), /采样点/);
});

test('weather requests one shared global 60-point batch', async () => {
  const sample = (await fixture('weather'))[0];
  let calls = 0;
  const fetchImpl = async url => {
    calls++;
    assert.equal(url, WEATHER_URL);
    const params = new URL(url).searchParams;
    assert.equal(params.get('latitude').split(',').length, 60);
    assert.equal(params.get('cell_selection'), 'nearest');
    return response(WEATHER_LOCATIONS.map(point => ({ ...sample, latitude: point.lat, longitude: point.lon })));
  };
  const [first, second] = await Promise.all([loadWeather({ fetchImpl }), loadWeather({ fetchImpl })]);
  assert.equal(calls, 1);
  assert.equal(first.length, 60);
  assert.equal(new Set(second.map(event => event.id)).size, 60);
  assert.ok(first.every(event => event.source === 'Open-Meteo' && event.layer === 'weather'));
});

test('USGS preserves real source times, drops malformed coordinates, and deduplicates latest revisions', async () => {
  const data = await fixture('usgs');
  const original = data.features[0], newer = clone(original), invalid = clone(original);
  newer.properties.time += 1000;
  newer.properties.mag = null;
  newer.properties.url = 'javascript:alert(1)';
  newer.properties.title = '<img src=x onerror=alert(1)>';
  invalid.id = 'invalid';
  invalid.geometry.coordinates = [null, 30];
  data.features.push(newer, invalid);
  const events = parseEarthquakes(data), event = events.find(item => item.id === `usgs:${original.id}`);
  assert.equal(events.length, 3);
  assert.equal(event.time, new Date(newer.properties.time).toISOString());
  assert.ok(!event.metrics.some(item => item.label.startsWith('震级')));
  assert.equal(event.sourceUrl, 'https://earthquake.usgs.gov/earthquakes/map/');
  // Titles remain inert plain text; UI must render them with textContent.
  assert.equal(event.title, '<img src=x onerror=alert(1)>');
  assert.throws(() => parseEarthquakes({ features: [] }), /格式/);
  assert.deepEqual(parseEarthquakes({ type: 'FeatureCollection', features: [] }), []);
});

test('EONET empty flood feed is valid, and independently requested categories retain their events', async () => {
  for (const category of ['volcanoes', 'wildfires', 'floods', 'severeStorms']) {
    const data = await fixture(`eonet-${category}`), events = parseEonet(data, category);
    assert.equal(events.length, data.events.length);
    assert.ok(events.every(event => event.source === 'NASA EONET' && event.severity === 'unknown'));
  }
  assert.throws(() => parseEonet({}, 'floods'), /格式/);
  assert.throws(() => parseEonet({ events: [] }, 'unknown'), /类别/);
});

test('EONET storm observations sort chronologically; polygons handle the antimeridian', async () => {
  const data = await fixture('eonet-severeStorms');
  const event = data.events[0];
  event.geometry.reverse();
  const storm = parseEonet({ events: [event] }, 'severeStorms')[0];
  assert.equal(storm.track.length, event.geometry.length);
  assert.deepEqual(storm.track[0], event.geometry.at(-1).coordinates);
  const area = clone(event);
  area.categories = [{ id: 'floods' }];
  area.sources = [{ url: 'javascript:alert(1)' }];
  area.link = 'https://eonet.gsfc.nasa.gov/';
  area.geometry = [{ date: '2026-09-05T12:00:00Z', type: 'Polygon', coordinates: [[[179, 10], [-179, 10], [-179, 12], [179, 12], [179, 10]]] }];
  const flood = parseEonet({ events: [area] }, 'floods')[0];
  assert.ok(Math.abs(flood.lon) > 179.9);
  assert.ok(flood.lat > 10 && flood.lat < 12.1);
  assert.match(flood.description, /示意中心/);
  assert.equal(flood.sourceUrl, area.link);
  area.closed = '2026-09-06T00:00:00Z';
  assert.deepEqual(parseEonet({ events: [area] }, 'floods'), []);
});

test('GDACS counts centroids only and keeps disjoint track segments separate', async () => {
  const data = await fixture('gdacs');
  const before = parseGdacs(data);
  assert.equal(before.length, 1);
  assert.ok(before[0].paths.length > 1);
  const line = data.features.find(feature => feature.geometry.type === 'LineString');
  data.features.push(clone(line));
  const older = clone(data.features[0]);
  older.properties.episodeid = 0;
  older.properties.datemodified = '2020-01-01T00:00:00';
  data.features.push(older);
  const events = parseGdacs(data);
  assert.equal(events.length, 1);
  assert.equal(events[0].paths.length, before[0].paths.length);
  assert.equal(events[0].track, undefined);
  assert.ok(events[0].paths.every(path => path.length === 2));
  assert.ok(events[0].time.endsWith('Z'));
  assert.equal(parseGdacs(await fixture('gdacs-flood'), 'FL')[0].layer, 'flood');
  assert.deepEqual(linePaths({ type: 'LineString', coordinates: [[0, 0], [1, 1], [null, 2], [4, 4], [5, 5]] }),
    [[[0, 0], [1, 1]], [[4, 4], [5, 5]]]);
});

test('all adapters propagate transport failures instead of fabricating empty event arrays', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  for (const load of [() => loadWeather({ fetchImpl }), () => loadEarthquakes({ fetchImpl }),
    () => loadEonet('volcanoes', { fetchImpl }), () => loadGdacs('TC', { fetchImpl })]) {
    await assert.rejects(load, error => error.name === 'HttpError' && error.status === 503);
  }
});

test('HTTP shares in-flight work, caches success, and force refresh bypasses that cache', async () => {
  let calls = 0;
  const fetchImpl = async () => response({ version: ++calls });
  const options = { fetchImpl, ttl: 60000 };
  const [first, second] = await Promise.all([fetchJson('https://example.com/feed', options), fetchJson('https://example.com/feed', options)]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  await fetchJson('https://example.com/feed', options);
  assert.equal(calls, 1);
  await fetchJson('https://example.com/feed', { ...options, force: true });
  assert.equal(calls, 2);
});

test('aborting one HTTP subscriber preserves another subscriber and cleans up fully cancelled work', async () => {
  let resolveFetch, upstreamSignal;
  const fetchImpl = (_url, { signal }) => new Promise(resolve => { resolveFetch = resolve; upstreamSignal = signal; });
  const controller = new AbortController();
  const first = fetchJson('https://example.com/shared', { fetchImpl, signal: controller.signal });
  const second = fetchJson('https://example.com/shared', { fetchImpl });
  await Promise.resolve();
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(upstreamSignal.aborted, false);
  resolveFetch(response({ available: true }));
  assert.deepEqual(await second, { available: true });
  const cancelled = new AbortController();
  const pending = fetchJson('https://example.com/cancel', { fetchImpl: abortingFetch, signal: cancelled.signal });
  cancelled.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('HTTP times out and never caches failed responses or invalid JSON', async () => {
  await assert.rejects(fetchJson('https://example.com/slow', { fetchImpl: abortingFetch, timeoutMs: 5 }), { name: 'TimeoutError' });
  let calls = 0;
  const fetchImpl = async () => { if (++calls === 1) throw new Error('offline'); return response({ recovered: true }); };
  await assert.rejects(fetchJson('https://example.com/retry', { fetchImpl, ttl: 60000 }), /offline/);
  assert.deepEqual(await fetchJson('https://example.com/retry', { fetchImpl, ttl: 60000 }), { recovered: true });
  assert.equal(calls, 2);
  await assert.rejects(fetchJson('https://example.com/json', {
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }),
  }), SyntaxError);
});

test('HTTP cache expires and adapter schema failures are retried on the next request', async () => {
  let calls = 0;
  const fetchImpl = async () => response({ count: ++calls });
  await fetchJson('https://example.com/expiry', { fetchImpl, ttl: 1 });
  await new Promise(resolve => setTimeout(resolve, 5));
  await fetchJson('https://example.com/expiry', { fetchImpl, ttl: 1 });
  assert.equal(calls, 2);
  let malformed = true;
  const schemaFetch = async () => response(malformed ? { error: 'invalid feed' } : { type: 'FeatureCollection', features: [] });
  await assert.rejects(loadEarthquakes({ fetchImpl: schemaFetch }), /格式/);
  malformed = false;
  assert.deepEqual(await loadEarthquakes({ fetchImpl: schemaFetch }), []);
});
