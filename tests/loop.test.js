// M62: the frame cap holds, 60 or 30 frames a second (the battery setting),
// on a 60, 90 or 120 Hz screen, with the frames drawn evenly apart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLoop } from '../src/render/loop.js';

// Runs the loop for `seconds` on a screen refreshing at `hz`: the times of
// the frames it drew.
function run(cap, hz, seconds = 3, jitter = 0) {
  let queued = null;
  globalThis.requestAnimationFrame = (fn) => { queued = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { queued = null; };
  const drawn = [];
  const loop = createLoop({ frame: (now) => drawn.push(now), getCap: () => cap });
  loop.start();
  for (let i = 1; i <= hz * seconds && queued; i++) {
    const fn = queued;
    queued = null;
    fn((i * 1000) / hz + (i % 2 ? jitter : -jitter));
  }
  loop.stop();
  return drawn;
}

test('the cap holds on 60, 90 and 120 Hz screens', () => {
  for (const hz of [60, 90, 120]) {
    for (const cap of [60, 30]) {
      const drawn = run(cap, hz);
      const rate = (drawn.length - 1) / ((drawn.at(-1) - drawn[0]) / 1000);
      assert.ok(Math.abs(rate - Math.min(cap, hz)) <= 2, `${hz} Hz at cap ${cap}: ${rate.toFixed(1)} a second`);
    }
  }
});

test('at 30 the frames come evenly: every other one on a 60 Hz screen, every fourth at 120', () => {
  for (const [hz, every] of [[60, 2], [120, 4]]) {
    const drawn = run(30, hz);
    const gaps = drawn.slice(1).map((t, i) => Math.round(((t - drawn[i]) * hz) / 1000));
    assert.ok(gaps.slice(2).every((g) => g === every), `${hz} Hz: gaps of ${[...new Set(gaps)].join(', ')} frames`);
  }
});

test('a screen that jitters (each frame 0.8 ms early or late) still gets its cap', () => {
  for (const cap of [60, 30]) {
    const drawn = run(cap, 60, 3, 0.8);
    const rate = (drawn.length - 1) / ((drawn.at(-1) - drawn[0]) / 1000);
    assert.ok(Math.abs(rate - cap) <= 2, `cap ${cap}: ${rate.toFixed(1)} a second`);
  }
});
