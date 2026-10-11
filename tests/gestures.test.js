import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecognizer, LONG_PRESS, SLOP } from '../src/ui/gestures.js';

// A recognizer that records every handler call as [name, ...args].
function recorder(overrides = {}) {
  const calls = [];
  const names = ['tap', 'longPress', 'dragStart', 'dragMove', 'dragEnd', 'dragCancel', 'pinchStart', 'pinchMove', 'pinchEnd'];
  const handlers = Object.fromEntries(
    names.map((name) => [
      name,
      (...args) => {
        calls.push([name, ...args]);
        return overrides[name]?.(...args);
      },
    ]),
  );
  return { r: createRecognizer(handlers), calls };
}
const names = (calls) => calls.map((c) => c[0]);

test('a small wobble is still a tap, at the point first touched', () => {
  const { r, calls } = recorder();
  r.down(1, 100, 100, 0);
  r.move(1, 100 + SLOP - 2, 104);
  r.up(1, 100 + SLOP - 1, 105);
  assert.deepEqual(calls, [['tap', 100, 100]]);
  assert.equal(r.mode, 'idle');
});

test('moving past the slop is a drag, and lifting ends it without a tap', () => {
  const { r, calls } = recorder();
  r.down(1, 100, 100, 0);
  r.move(1, 115, 100);
  r.move(1, 140, 120);
  r.up(1, 150, 120);
  assert.deepEqual(calls, [
    ['dragStart', 100, 100, 115, 100],
    ['dragMove', 115, 100],
    ['dragMove', 140, 120],
    ['dragEnd', 150, 120],
  ]);
});

test('holding still is a long press, and no tap follows it', () => {
  const { r, calls } = recorder();
  r.down(1, 50, 60, 1000);
  r.hold(1000 + LONG_PRESS - 1);
  assert.deepEqual(calls, [], 'too early');
  r.hold(1000 + LONG_PRESS);
  r.move(1, 80, 60); // moving after a long press does nothing
  r.up(1, 80, 60);
  assert.deepEqual(calls, [['longPress', 50, 60]]);
});

test('a finger that already started dragging never becomes a long press', () => {
  const { r, calls } = recorder();
  r.down(1, 0, 0, 0);
  r.move(1, 30, 0);
  r.hold(LONG_PRESS + 100);
  assert.deepEqual(names(calls), ['dragStart', 'dragMove']);
});

test('a second finger cancels a drag and pinches; nothing else happens until all fingers lift', () => {
  const { r, calls } = recorder();
  r.down(1, 100, 100, 0);
  r.move(1, 130, 100);
  r.down(2, 230, 100, 50);
  r.move(2, 250, 100);
  r.up(2, 250, 100);
  r.move(1, 300, 300); // the finger left over does nothing
  r.up(1, 300, 300);
  assert.deepEqual(calls, [
    ['dragStart', 100, 100, 130, 100],
    ['dragMove', 130, 100],
    ['dragCancel'],
    ['pinchStart', { x: 180, y: 100, spread: 100 }],
    ['pinchMove', { x: 190, y: 100, spread: 120 }],
    ['pinchEnd'],
  ]);
  assert.equal(r.mode, 'idle');
  r.down(3, 10, 10, 900);
  r.up(3, 10, 10);
  assert.deepEqual(calls.at(-1), ['tap', 10, 10], 'the next gesture works normally');
});

test('two fingers landing together are a pinch, never a tap', () => {
  const { r, calls } = recorder();
  r.down(1, 100, 100, 0);
  r.down(2, 200, 100, 5);
  r.up(1, 100, 100);
  r.up(2, 200, 100);
  assert.deepEqual(names(calls), ['pinchStart', 'pinchEnd']);
});

test('a refused drag is ignored until the finger lifts', () => {
  const { r, calls } = recorder({ dragStart: () => false });
  r.down(1, 0, 0, 0);
  r.move(1, 0, 40);
  r.move(1, 0, 80);
  r.up(1, 0, 80);
  assert.deepEqual(names(calls), ['dragStart']);
  assert.equal(r.mode, 'idle');
});

test('a cancelled pointer ends its gesture without effect', () => {
  const { r, calls } = recorder();
  r.down(1, 0, 0, 0);
  r.cancel(1);
  r.up(1, 0, 0);
  assert.deepEqual(calls, [], 'no tap after a cancel');
  r.down(2, 0, 0, 10);
  r.move(2, 50, 0);
  r.cancel(2);
  assert.deepEqual(names(calls), ['dragStart', 'dragMove', 'dragCancel']);
  assert.equal(r.mode, 'idle');
});
