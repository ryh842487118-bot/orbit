import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventSelection } from '../src/earthsense/selection.js';
const storm = id => ({ id, layer: 'typhoon', time: '2026-09-07T00:00:00Z', cyclone: { windSpeedKmh: 200, windBasis: 'event-maximum' } });
const track = { status: 'ready', history: [{ lat: 10, lon: 110, time: '2026-09-06T00:00:00Z' }], forecast: [{ lat: 11, lon: 111, time: '2026-09-08T00:00:00Z' }], current: { windSpeedKmh: 130, time: '2026-09-07T00:00:00Z' } };

test('only selecting a cyclone loads a route; current observed wind replaces the event maximum', async () => {
  let calls = 0;
  const updates = [];
  const selection = createEventSelection({ loadTrack: async () => { calls++; return track; }, onChange: (event, initial) => updates.push({ event, initial }) });
  await selection.select({ id: 'clear', layer: 'weather' });
  assert.equal(calls, 0);
  const sourceEvent = storm('one');
  await selection.select(sourceEvent);
  assert.equal(updates.at(-2).event.trackData.status, 'loading');
  assert.equal(updates.at(-1).initial, false);
  assert.equal(selection.getEvent().cyclone.windSpeedKmh, 130);
  assert.equal(selection.getEvent().cyclone.windBasis, 'observation');
  assert.equal(sourceEvent.cyclone.windSpeedKmh, 200, 'feed records are never mutated');
  selection.clear();
  await selection.select(sourceEvent);
  assert.equal(calls, 1, 'reopening a fresh route reuses the source result');
  selection.dispose();
});

test('switching selection or closing the popup aborts the old request and ignores late route results', async () => {
  const requests = [], updates = [];
  const selection = createEventSelection({ loadTrack: (event, { signal }) => new Promise(resolve => requests.push({ event, signal, resolve })), onChange: event => updates.push(event) });
  const first = selection.select(storm('one'));
  const second = selection.select(storm('two'));
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve(track); await first;
  assert.equal(selection.getEvent().id, 'two');
  selection.clear();
  assert.equal(requests[1].signal.aborted, true);
  const before = updates.length;
  requests[1].resolve(track); await second;
  assert.equal(updates.length, before);
  assert.equal(selection.getEvent(), null);
  selection.dispose();
});

test('route errors keep known history visible and a reselect retries instead of inventing a forecast', async () => {
  let calls = 0;
  const selection = createEventSelection({ loadTrack: async () => { calls++; throw new Error('source unavailable'); }, onChange() {} });
  const event = { ...storm('one'), trackData: { status: 'history-only', history: track.history, forecast: [] } };
  await selection.select(event);
  assert.equal(selection.getEvent().trackData.status, 'error');
  assert.deepEqual(selection.getEvent().trackData.history, track.history);
  assert.deepEqual(selection.getEvent().trackData.forecast, []);
  await selection.select(event);
  assert.equal(calls, 2);
  selection.dispose();
});

test('a new advisory or expired cache loads the new route', async () => {
  let calls = 0, time = 0;
  const selection = createEventSelection({ loadTrack: async () => { calls++; return track; }, onChange() {}, now: () => time });
  await selection.select({ ...storm('one'), gdacs: { episodeId: 1 } });
  await selection.select({ ...storm('one'), gdacs: { episodeId: 2 } });
  assert.equal(calls, 2);
  time = 15 * 60_000 + 1;
  await selection.select({ ...storm('one'), gdacs: { episodeId: 2 } });
  assert.equal(calls, 3);
  selection.dispose();
});
