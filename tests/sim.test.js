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
  assert.deepEqual(initialState(42), { screen: 'title', settings: { fpsCap: 60 }, rng: 42 });
  assert.equal(initialState(-1).rng, 0xffffffff);
});

test('the frame cap accepts 60 and 30 only', () => {
  const state = deepFreeze(initialState(1));
  const capped = reduce(state, { type: 'settings/fpsCap', value: 30 });
  assert.equal(capped.settings.fpsCap, 30);
  assert.equal(reduce(state, { type: 'settings/fpsCap', value: 45 }), state);
  assert.equal(reduce(state, { type: 'settings/fpsCap', value: 60 }), state);
});

test('restoring a save replaces settings and RNG state but not the screen', () => {
  const state = deepFreeze(reduce(initialState(1), { type: 'screen/show', screen: 'sandbox' }));
  const data = { settings: { fpsCap: 30 }, rng: 999 };
  const restored = reduce(state, { type: 'save/restore', data });
  assert.deepEqual(restored, { screen: 'sandbox', settings: { fpsCap: 30 }, rng: 999 });
  assert.notEqual(restored.settings, data.settings);
});

test('unknown actions return the same state object', () => {
  const state = deepFreeze(initialState(1));
  assert.equal(reduce(state, { type: 'nothing/here' }), state);
  assert.equal(reduce(state, { type: 'screen/show', screen: 'title' }), state);
});

test('saveData holds what a save needs and nothing else', () => {
  const state = initialState(5);
  assert.deepEqual(saveData(state), { settings: { fpsCap: 60 }, rng: 5 });
});
