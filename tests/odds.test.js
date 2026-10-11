import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forgivingBonus, rangeBand, shotOdds } from '../src/sim/odds.js';
import { field, openMap, put, rules } from './battleKit.js';

const b = rules.balance;
const unit = (side, x, y, extra = {}) => ({ side, x, y, aim: 70, defense: 0, weapon: 'rifle', ...extra });
const battleOn = (map, extra = {}) => ({ ...field(map), misses: { crew: 0, enemy: 0 }, options: { forgiving: false }, ...extra });
const sum = (parts) => parts.reduce((total, part) => total + part.value, 0);

test('range bands are straight-line distances: close, then mid, then long', () => {
  const band = (to) => rangeBand([0, 0], to, b);
  assert.equal(b.closeRange, 3);
  assert.equal(b.midRange, 7);
  assert.deepEqual([[3, 0], [2, 2], [3, 1], [7, 0], [5, 5], [7, 1]].map(band), ['close', 'close', 'mid', 'mid', 'long', 'long']);
});

test('in the open: aim plus the weapon at range, and the target is flanked', () => {
  const odds = shotOdds(battleOn(openMap(9, 3)), unit('crew', 0, 1), unit('enemy', 5, 1), rules);
  assert.equal(odds.band, 'mid');
  assert.deepEqual(odds.hitParts, [{ why: 'aim', value: 70 }, { why: 'weapon', band: 'mid', value: 10 }]);
  assert.equal(odds.hit, 80);
  assert.equal(odds.flanked, true);
  assert.deepEqual(odds.critParts, [{ why: 'weapon', value: 10 }, { why: 'flanked', value: b.flankCrit }]);
  assert.equal(odds.crit, 10 + b.flankCrit);
});

test('cover, defense and overwatch each take their part off', () => {
  // A crate west of the target, (4, 1), facing the shooter.
  const map = put(openMap(9, 3), 4, 1, 'half cover');
  const half = shotOdds(battleOn(map), unit('crew', 0, 1), unit('enemy', 5, 1, { defense: 5 }), rules, { overwatch: true });
  assert.deepEqual(half.hitParts, [
    { why: 'aim', value: 70 },
    { why: 'weapon', band: 'mid', value: 10 },
    { why: 'cover', cover: 'half', value: -b.halfCover },
    { why: 'defense', value: -5 },
    { why: 'overwatch', value: -b.overwatchPenalty },
  ]);
  assert.equal(half.hit, 70 + 10 - 20 - 5 - 15);
  assert.equal(half.flanked, false);
  assert.deepEqual(half.critParts, [{ why: 'weapon', value: 10 }], 'no flanking bonus in cover');
  const full = shotOdds(battleOn(put(openMap(9, 3), 4, 1, 'full cover')), unit('crew', 0, 1), unit('enemy', 5, 1), rules);
  assert.equal(full.cover, 'full');
  assert.equal(full.hit, 70 + 10 - b.fullCover);
});

test('the weapon changes the odds with the range', () => {
  const at = (weapon, x) => shotOdds(battleOn(openMap(12, 1)), unit('crew', 0, 0, { weapon }), unit('enemy', x, 0), rules).hit;
  assert.deepEqual([2, 5, 9].map((x) => at('shotgun', x)), [70 + 20, 70 - 5, 70 - 30]);
  assert.deepEqual([2, 5, 9].map((x) => at('pistol', x)), [70 + 15, 70, 70 - 15]);
});

test('the chance is the sum of its parts, kept within 0 to 100', () => {
  const sure = shotOdds(battleOn(openMap(4, 1)), unit('crew', 0, 0, { aim: 100, weapon: 'shotgun' }), unit('enemy', 1, 0), rules);
  assert.equal(sum(sure.hitParts), 120);
  assert.equal(sure.hit, 100);
  const hopeless = shotOdds(battleOn(put(openMap(12, 1), 9, 0, 'full cover')), unit('crew', 0, 0, { aim: 0, weapon: 'shotgun' }), unit('enemy', 10, 0), rules);
  assert.equal(sum(hopeless.hitParts), 0 - 30 - 40);
  assert.equal(hopeless.hit, 0);
});

test('forgiving odds: on, the crew gains a step per miss in a row, up to the most; enemies never', () => {
  const on = (misses) => ({ options: { forgiving: true }, misses: { crew: misses, enemy: misses } });
  assert.deepEqual([0, 1, 2, 3, 9].map((n) => forgivingBonus(on(n), 'crew', b)), [0, 10, 20, 30, 30]);
  assert.equal(forgivingBonus(on(3), 'enemy', b), 0);
  assert.equal(forgivingBonus({ options: { forgiving: false }, misses: { crew: 3 } }, 'crew', b), 0);
  const odds = shotOdds(battleOn(openMap(9, 3), on(2)), unit('crew', 0, 1), unit('enemy', 5, 1), rules);
  assert.deepEqual(odds.hitParts.at(-1), { why: 'forgiving', value: 20 });
  assert.equal(odds.hit, 100, 'shown with the bonus in it: 80 + 20');
});
