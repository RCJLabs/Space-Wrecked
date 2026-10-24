import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, reduce, saveData } from '../src/sim/root.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

test('initial state starts on the title with default settings and the given seed', () => {
  const settings = { fpsCap: 60, forgiving: false, motion: 'auto', tips: true, tipsSeen: [], sound: true, volume: 70, colors: 'standard', textSize: 100, fog: false, hand: 'right', speed: 100, confirm: 'taps', vibration: true, captions: false, reading: 'standard' };
  assert.deepEqual(initialState(42), { screen: 'title', settings, rng: 42, builds: { active: 0, slots: [] }, campaign: null });
  assert.equal(initialState(-1).rng, 0xffffffff);
});

test('the frame cap accepts 60 and 30 only', () => {
  const state = deepFreeze(initialState(1));
  const capped = reduce(state, { type: 'settings/fpsCap', value: 30 });
  assert.equal(capped.settings.fpsCap, 30);
  assert.equal(reduce(state, { type: 'settings/fpsCap', value: 45 }), state);
  assert.equal(reduce(state, { type: 'settings/fpsCap', value: 60 }), state);
});

test('restoring a save replaces settings, RNG state, saved ships and the campaign but not the screen', () => {
  const state = deepFreeze(reduce(initialState(1), { type: 'screen/show', screen: 'sandbox' }));
  const builds = { active: 0, slots: [{ name: 'Ship 1', ship: { frame: 'starter', modules: [], nextUid: 1 }, log: [] }] };
  const data = { settings: { fpsCap: 30 }, rng: 999, builds, campaign: null };
  const restored = reduce(state, { type: 'save/restore', data });
  assert.deepEqual(restored, { screen: 'sandbox', settings: { fpsCap: 30 }, rng: 999, builds, campaign: null });
  assert.notEqual(restored.settings, data.settings);
  // On a campaign's screen, a restored save goes back to the title: that
  // screen was showing the campaign before.
  const onHub = deepFreeze(reduce(initialState(1), { type: 'screen/show', screen: 'hub' }));
  assert.equal(reduce(onHub, { type: 'save/restore', data }).screen, 'title');
});

test("builds/ actions reach the saved ships; the same ship changes nothing", () => {
  const state = deepFreeze(initialState(1));
  const ship = deepFreeze({ frame: 'starter', modules: [], nextUid: 1 });
  const log = deepFreeze([]);
  const next = reduce(state, { type: 'builds/save', ship, log });
  assert.equal(next.builds.slots[0].ship, ship);
  assert.equal(reduce(next, { type: 'builds/save', ship, log }), next);
});

test('unknown actions return the same state object', () => {
  const state = deepFreeze(initialState(1));
  assert.equal(reduce(state, { type: 'nothing/here' }), state);
  assert.equal(reduce(state, { type: 'screen/show', screen: 'title' }), state);
});

test('saveData holds what a save needs and nothing else', () => {
  const state = initialState(5);
  assert.deepEqual(saveData(state), { settings: state.settings, rng: 5, builds: { active: 0, slots: [] }, campaign: null });
});
