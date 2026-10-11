import assert from 'node:assert/strict';
import { test } from 'node:test';
import { int, isState, next, percent, pick, seedFrom, shuffle } from '../src/core/rng.js';

// The classic closure form of mulberry32, as published.
function reference(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function values(state, count) {
  const out = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = next(s);
    out.push(r.value);
    s = r.state;
  }
  return out;
}

test('next matches the reference mulberry32', () => {
  for (const seed of [0, 1, 12345, 0x80000000, 0xffffffff]) {
    const ref = reference(seed);
    let s = seed;
    for (let i = 0; i < 1000; i++) {
      const r = next(s);
      assert.equal(r.value, ref());
      s = r.state;
    }
  }
});

test('the sequence for seed 12345 is pinned', () => {
  // Saves and golden replays depend on this exact sequence. If this fails,
  // the RNG changed and every saved game would reroll.
  assert.deepEqual(values(12345, 5), [
    0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061,
  ]);
});

test('same seed gives the same sequence, a different seed does not', () => {
  assert.deepEqual(values(777, 50), values(777, 50));
  assert.notDeepEqual(values(777, 50), values(778, 50));
});

test('next is pure: the same state always gives the same result', () => {
  assert.deepEqual(next(42), next(42));
});

test('state is a plain uint32 that survives JSON and resumes exactly', () => {
  let s = seedFrom('resume');
  for (let i = 0; i < 10; i++) s = next(s).state;
  const restored = JSON.parse(JSON.stringify({ rng: s })).rng;
  assert.ok(isState(restored));
  assert.deepEqual(values(restored, 20), values(s, 20));
});

test('every state stays a uint32', () => {
  let s = 0xffffffff;
  for (let i = 0; i < 10000; i++) {
    s = next(s).state;
    assert.ok(isState(s), `state ${s} at step ${i}`);
  }
  assert.equal(isState(-1), false);
  assert.equal(isState(2 ** 32), false);
  assert.equal(isState(1.5), false);
  assert.equal(isState('1'), false);
});

test('seedFrom is stable for strings and wraps numbers to uint32', () => {
  assert.equal(seedFrom('title'), 2297765444);
  assert.notEqual(seedFrom('a'), seedFrom('b'));
  assert.equal(seedFrom(-1), 0xffffffff);
  assert.equal(seedFrom(2 ** 32 + 5), 5);
  assert.throws(() => seedFrom(Number.NaN), RangeError);
  assert.throws(() => seedFrom({}), TypeError);
});

test('int covers [min, max] inclusive and nothing else', () => {
  let s = 7;
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const r = int(s, -2, 3);
    s = r.state;
    assert.ok(Number.isInteger(r.value) && r.value >= -2 && r.value <= 3, `got ${r.value}`);
    seen.add(r.value);
  }
  assert.equal(seen.size, 6);
  assert.equal(int(5, 4, 4).value, 4);
});

test('int rejects bad ranges', () => {
  assert.throws(() => int(1, 5, 1), RangeError);
  assert.throws(() => int(1, 0, 1.5), RangeError);
  assert.throws(() => int(1, Number.NaN, 3), RangeError);
});

test('percent: 0 never succeeds, 100 always does, and roll < chance decides', () => {
  let s = 99;
  for (let i = 0; i < 1000; i++) {
    assert.equal(percent(s, 0).value, false);
    assert.equal(percent(s, 100).value, true);
    const r = percent(s, 65);
    assert.ok(Number.isInteger(r.roll) && r.roll >= 0 && r.roll <= 99);
    assert.equal(r.value, r.roll < 65);
    s = r.state;
  }
});

test('percent succeeds at the stated rate', () => {
  let s = seedFrom('rate');
  let hits = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const r = percent(s, 65);
    s = r.state;
    if (r.value) hits += 1;
  }
  assert.ok(Math.abs(hits / n - 0.65) < 0.015, `rate was ${hits / n}`);
});

test('percent rejects chances that could not be shown exactly', () => {
  assert.throws(() => percent(1, -1), RangeError);
  assert.throws(() => percent(1, 101), RangeError);
  assert.throws(() => percent(1, 33.5), RangeError);
});

test('pick returns every element over time and rejects empty lists', () => {
  const list = ['a', 'b', 'c', 'd'];
  let s = 3;
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = pick(s, list);
    s = r.state;
    assert.ok(list.includes(r.value));
    seen.add(r.value);
  }
  assert.equal(seen.size, list.length);
  assert.throws(() => pick(1, []), RangeError);
});

test('shuffle returns a permutation, leaves the input alone, and is deterministic', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = list.slice();
  const a = shuffle(11, list);
  assert.deepEqual(list, copy);
  assert.deepEqual([...a.value].sort((x, y) => x - y), copy);
  assert.deepEqual(shuffle(11, list), a);
  assert.notDeepEqual(shuffle(12, list).value, a.value);
  assert.deepEqual(shuffle(5, []).value, []);
  assert.deepEqual(shuffle(5, ['x']).value, ['x']);
});
