// The fight's labels (src/render/fightLabels.js): a unit's word is never
// under its tile's hit chance (M57); the badge rises clear of it, and
// stays where it was over a unit with no word.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintFightLabels } from '../src/render/fightLabels.js';

const deg = Math.PI / 180;
const CAM = { yaw: 0, pitch: 60 * deg, distance: 40, pivot: [5, 3], scale: 48, x: 450, y: 180 };

// A context that keeps where each text was drawn: { text: y }.
function recorder() {
  const texts = {};
  const noop = () => {};
  const ctx = {
    save: noop, restore: noop, fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, roundRect: noop, arc: noop,
    measureText: (text) => ({ width: text.length * 7 }),
    fillText: (text, x, y) => {
      texts[text] = y;
    },
  };
  return { ctx, texts };
}

const unit = (extra) => ({ at: [3.5, 4.5], status: 'active', hp: 5, maxHp: 5, color: '#f00', ...extra });

test("a pinned enemy's word sits clear under its hit chance, not behind it", () => {
  const { ctx, texts } = recorder();
  paintFightLabels(ctx, CAM, { width: 900, height: 360 }, { units: [unit({ suppressed: true })], badges: [{ at: [3, 4], text: '70%' }] });
  assert.ok('PINNED' in texts && '70%' in texts);
  // The badge is 18 px tall about its middle; the word's box 12 px about its
  // own: the badge's foot is above the word's top.
  assert.ok(texts['70%'] + 9 <= texts.PINNED - 6, `badge at ${texts['70%']}, word at ${texts.PINNED}`);
});

test('over a unit with no word, or on another tile, the badge stays where it was', () => {
  const plain = recorder();
  paintFightLabels(plain.ctx, CAM, { width: 900, height: 360 }, { units: [unit({})], badges: [{ at: [3, 4], text: '70%' }] });
  const alone = recorder();
  paintFightLabels(alone.ctx, CAM, { width: 900, height: 360 }, { units: [], badges: [{ at: [3, 4], text: '70%' }] });
  assert.equal(plain.texts['70%'], alone.texts['70%']);
  const elsewhere = recorder();
  paintFightLabels(elsewhere.ctx, CAM, { width: 900, height: 360 }, { units: [unit({ suppressed: true, at: [6.5, 2.5] })], badges: [{ at: [3, 4], text: '70%' }] });
  assert.equal(elsewhere.texts['70%'], alone.texts['70%']);
});
