import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEonet } from '../src/data/eonet.js';
import { parseGdacs } from '../src/data/gdacs.js';
import { cycloneWind, windSpeedKmh } from '../src/data/cyclone-wind.js';
import { gdacsEpisodeUrl, gdacsTimelineResource, gdacsTrackTime, parseGdacsTimeline } from '../src/data/gdacs-track.js';
import { loadCycloneTrack } from '../src/data/cyclone-track.js';

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const response = value => ({ ok: true, status: 200, json: async () => value });
const event = id => ({ id: `gdacs:TC:${id}`, layer: 'typhoon', source: 'GDACS',
  gdacs: { eventId: id, episodeId: 18 }, sourceUrl: `https://www.gdacs.org/report.aspx?eventid=${id}&episodeid=18&eventtype=TC` });

test('cyclone winds preserve measurement units and distinguish observation from event maximum', async () => {
  assert.equal(windSpeedKmh(80, 'kts'), 148.16);
  assert.equal(windSpeedKmh('20.576', 'm/s'), 74.0736);
  assert.equal(windSpeedKmh(100, 'km/h'), 100);
  for (const value of [null, '', false, -1, 9999]) assert.equal(windSpeedKmh(value, 'kts'), null);
  assert.equal(windSpeedKmh(40, 'unknown'), null);
  assert.equal(cycloneWind(100, 'km/h', 'event-maximum', '2026-09-01T00:00:00Z').validTime, null);
  const gdacs = parseGdacs(await fixture('gdacs'))[0];
  assert.equal(gdacs.cyclone.windBasis, 'event-maximum');
  assert.ok(gdacs.cyclone.windSpeedKmh > 0);
  const eonet = parseEonet(await fixture('eonet-severeStorms'), 'severeStorms')[0];
  assert.equal(eonet.cyclone.windSpeedKmh, 148.16);
  assert.equal(eonet.cyclone.windBasis, 'observation');
  assert.equal(eonet.cyclone.validTime, '2026-09-06T00:00:00.000Z');
  assert.equal(eonet.trackData.history.length, 20);
  assert.equal(eonet.trackData.forecast.length, 0);
  assert.equal(eonet.trackData.status, 'history-only');
  assert.equal(eonet.trackData.history.at(-1).windSpeedKmh, 148.16);
  assert.ok(eonet.metrics.some(item => item.label === '最近记录风速' && item.value.includes('km/h')));
});

test('GDACS advisory timestamps use UTC and reject impossible calendar dates', () => {
  assert.equal(gdacsTrackTime('01 Sep 2026 09:00'), '2026-09-01T09:00:00.000Z');
  assert.equal(gdacsTrackTime('31 Dec 2026 18:00'), '2026-12-31T18:00:00.000Z');
  assert.equal(gdacsTrackTime('01 Jan 2027 06:00'), '2027-01-01T06:00:00.000Z');
  for (const value of ['31 Feb 2026 06:00', '01 Sep 2026 25:00', '01 Xxx 2026 06:00', null]) {
    assert.equal(gdacsTrackTime(value), null);
  }
});

test('real NOAA and JTWC advisories split official forecasts from observations and retain point validity times', async () => {
  for (const [name, eventId, expectedForecast] of [['noaa', 1001317, 8], ['jtwc', 1001318, 7]]) {
    const data = await fixture(`gdacs-${name}-timeline`);
    const result = parseGdacsTimeline(data, { eventId, source: `GDACS / ${name.toUpperCase()}` });
    assert.equal(result.history.length, 18);
    assert.equal(result.forecast.length, expectedForecast);
    assert.equal(result.status, 'ready');
    assert.equal(result.issuedAt, result.current.time);
    assert.ok(result.forecast.every(point => point.time > result.current.time && point.validTime === point.time));
    const rawCurrent = data.channel.item.find(item => item.current === 'true');
    assert.equal(result.current.windSpeedKmh, +rawCurrent.wind_speed * 3.6);
    assert.equal(result.current.lat, +rawCurrent.latitude);
    assert.equal(result.current.lon, +rawCurrent.longitude);
    assert.equal(result.source, `GDACS / ${name.toUpperCase()}`);
  }
});

test('malformed, unknown-status, foreign-storm and outdated-advisory points do not become forecasts', async () => {
  const data = await fixture('gdacs-noaa-timeline'), original = data.channel.item.at(-1);
  data.channel.item.push({ ...original, advisory_datetime: '11 Sep 2026 12:00', advisory_number: '17' },
    { ...original, longitude: null }, { ...original, latitude: 91 },
    { ...original, advisory_datetime: '31 Feb 2026 12:00' },
    { ...original, advisory_datetime: '12 Sep 2026 12:00', actual: 'unknown' },
    { ...original, advisory_datetime: '13 Sep 2026 12:00', storm_id: '1009999' }, original);
  const result = parseGdacsTimeline(data, { eventId: 1001317 });
  assert.equal(result.forecast.length, 8);
  assert.equal(result.history.length, 18);
  const noCurrent = structuredClone(data);
  noCurrent.channel.item.forEach(item => { item.current = 'false'; });
  assert.equal(parseGdacsTimeline(noCurrent, { eventId: 1001317 }).current, null);
  assert.equal(parseGdacsTimeline(noCurrent, { eventId: 1001317 }).issuedAt, null);
  assert.deepEqual(parseGdacsTimeline(noCurrent, { eventId: 1001317 }).forecast, []);
  assert.equal(parseGdacsTimeline(noCurrent, { eventId: 1001317 }).status, 'history-only');
  assert.match(parseGdacsTimeline(noCurrent, { eventId: 1001317 }).message, /缺少明确/);
  assert.throws(() => parseGdacsTimeline({ events: [] }), /格式/);
});

test('multiple advisory forecasts require an explicit current observation and matching advisory number', async () => {
  const data = await fixture('gdacs-noaa-timeline');
  const original = data.channel.item.at(-1);
  data.channel.item.push({ ...original, advisory_number: '17', advisory_datetime: '11 Sep 2026 12:00' },
    { ...original, advisory_number: '19', advisory_datetime: '12 Sep 2026 12:00' },
    { ...original, advisory_number: '17' });
  const valid = parseGdacsTimeline(data, { eventId: 1001317 });
  assert.equal(valid.forecast.length, 8);
  assert.ok(valid.forecast.every(point => point.advisoryNumber === '18'));
  // Removing the current marker must not expose forecasts from any advisory,
  // even when all points are later than the last historical observation.
  data.channel.item.forEach(item => { item.current = 'false'; });
  const missing = parseGdacsTimeline(data, { eventId: 1001317 });
  assert.equal(missing.history.length, 18);
  assert.deepEqual(missing.forecast, []);
  assert.equal(missing.issuedAt, null);
  const observed = data.channel.item.find(item => item.actual === 'True' && item.advisory_number === '18');
  observed.current = 'true';
  observed.advisory_number = '';
  assert.deepEqual(parseGdacsTimeline(data, { eventId: 1001317 }).forecast, []);
});

test('historical-only advisories never produce extrapolated points, including long after their report time', async () => {
  const data = await fixture('gdacs-noaa-timeline');
  data.channel.item = data.channel.item.filter(item => item.actual === 'True');
  const result = parseGdacsTimeline(data, { eventId: 1001317 });
  assert.equal(result.status, 'history-only');
  assert.deepEqual(result.forecast, []);
  assert.match(result.message, /未提供预测/);
  const empty = parseGdacsTimeline({ channel: { item: [] } });
  assert.equal(empty.status, 'unavailable');
  assert.equal(empty.current, null);
});

test('lazy loader follows only the selected episode and official published timeline URL with caching', async () => {
  const details = await fixture('gdacs-noaa-detail'), timeline = await fixture('gdacs-noaa-timeline');
  const selected = event(1001317), urls = [];
  const fetchImpl = async (url, options) => {
    urls.push(url);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.mode, 'cors');
    return response(url.includes('getepisodedata') ? details : timeline);
  };
  const [a, b] = await Promise.all([loadCycloneTrack(selected, { fetchImpl }), loadCycloneTrack(selected, { fetchImpl })]);
  assert.deepEqual(a, b);
  assert.deepEqual(urls, [gdacsEpisodeUrl(selected), 'https://www.gdacs.org/gdacsapi/api/export/gettimeline?id=793141']);
  assert.equal(a.source, 'GDACS / NOAA');
  assert.equal(a.issuedAt, '2026-09-05T15:00:00.000Z');
  await loadCycloneTrack(selected, { fetchImpl });
  assert.equal(urls.length, 2);
  await loadCycloneTrack(selected, { fetchImpl, force: true });
  assert.equal(urls.length, 4);
});

test('missing published timelines are explicit and untrusted URLs or mismatched episodes are not fetched', async () => {
  const selected = event(1001317), details = await fixture('gdacs-noaa-detail');
  for (const url of ['https://example.com/track.json', 'javascript:alert(1)', 'https://www.gdacs.org/other?id=3']) {
    details.properties.impacts[0].resource.timeline = url;
    let calls = 0;
    const result = await loadCycloneTrack(selected, { fetchImpl: async () => { calls++; return response(details); } });
    assert.equal(calls, 1);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.forecast, []);
  }
  details.properties.episodeid = 17;
  assert.throws(() => gdacsTimelineResource(details, selected), /不匹配/);
  assert.equal(gdacsEpisodeUrl({ gdacs: { eventId: '1&foo=3', episodeId: 18 } }), null);
  const eonet = parseEonet(await fixture('eonet-severeStorms'), 'severeStorms')[0];
  const result = await loadCycloneTrack(eonet, { fetchImpl: () => assert.fail('EONET does not publish a forecast endpoint') });
  assert.equal(result.status, 'history-only');
});

test('lazy loader propagates transport failures and aborts rather than disguising them as no forecast', async () => {
  const selected = event(1001317);
  await assert.rejects(loadCycloneTrack(selected, { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    error => error.name === 'HttpError' && error.status === 503);
  const controller = new AbortController();
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  const pending = loadCycloneTrack(selected, { signal: controller.signal, fetchImpl });
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(loadCycloneTrack(selected, { signal: controller.signal, fetchImpl }), { name: 'AbortError' });
});
