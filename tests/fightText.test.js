import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBattle } from '../src/sim/battle.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { shotOdds } from '../src/sim/odds.js';
import { chipFor, hintFor, oddsText, stateText } from '../src/ui/fight/hints.js';
import { openMap, put, rules } from './battleKit.js';

const number = (text) => Number(text.replace('−', '-'));

test("the odds card's rows add up to the chance shown, which is the one rolled against", () => {
  // A marine at mid range from a pirate behind a crate, then point blank
  // with the forgiving setting on after misses: the sum passes 100.
  const map = put(openMap(9, 3), 6, 1, 'half cover');
  const { battle } = createBattle({ map, units: [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 1 }], seed: 1 }, rules);
  const [marine, pirate] = battle.units;
  const odds = shotOdds(battle, marine, pirate, rules);
  const text = oddsText(marine, pirate, odds, rules);
  assert.deepEqual(text.rows, [["Marine's aim", '70'], ['Rifle, mid range', '+10'], ['Half cover', '−20']]);
  assert.equal(text.rows.reduce((sum, [, value]) => sum + number(value), 0), text.hit);
  assert.equal(text.hit, 60);
  assert.equal(text.note, null);
  assert.equal(text.crit, 'Crit 10% (10)');
  assert.equal(text.damage, 'Damage 3–5, +2 on a crit');

  const engineer = { ...marine, name: 'Engineer', aim: rules.jobs.get('engineer').aim, weapon: 'shotgun' };
  const close = { ...battle, options: { forgiving: true }, misses: { crew: 3, enemy: 0 }, units: [engineer, { ...pirate, x: 2, y: 1 }] };
  const sure = oddsText(engineer, close.units[1], shotOdds(close, engineer, close.units[1], rules), rules);
  assert.equal(sure.hit, 100);
  assert.equal(sure.rows.at(-1)[0], 'Forgiving odds');
  assert.equal(sure.note, `${sure.rows.reduce((sum, [, value]) => sum + number(value), 0)} in all, kept to 100.`);
  assert.match(sure.crit, /flanked \+30/);
});

test("a crew member's state in a few words", () => {
  const unit = { status: 'active', ap: 2, ammo: 1, overwatch: false, bleed: 0 };
  assert.equal(stateText(unit), '2 AP · 1 shot');
  assert.equal(stateText({ ...unit, overwatch: true }), 'Overwatch');
  assert.equal(stateText({ ...unit, status: 'down', bleed: 1 }), 'Down · 1 turn');
  assert.equal(stateText({ ...unit, status: 'stable' }), 'Stable');
  assert.equal(stateText({ ...unit, status: 'out' }), 'Out of the fight');
});

test('the hint says what a tap does next, and the chip whose turn it is', () => {
  const { battle, events } = createBattle({ map: openMap(9, 3), units: [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 1 }], seed: 1 }, rules);
  let fight = createFight(battle, rules, events);
  assert.equal(hintFor(fight, ordersFor(fight, rules)).text, 'Marine: tap a tile to move, or an enemy to shoot.');
  fight = reduceFight(fight, { type: 'fight/tap', x: 2, y: 1 }, rules);
  assert.deepEqual(hintFor(fight, ordersFor(fight, rules)), { tone: 'good', text: 'Move here: 1 action. Tap the tile again to go.' });
  fight = reduceFight(fight, { type: 'fight/tap', x: 6, y: 0 }, rules);
  assert.equal(hintFor(fight, ordersFor(fight, rules)).tone, 'warn', 'a dash');
  fight = reduceFight(fight, { type: 'fight/aim' }, rules);
  assert.equal(hintFor(fight, ordersFor(fight, rules)).text, `${fight.preview.odds.hit}% to hit Pirate e1. Tap Fire, or the target again.`);
  assert.deepEqual(chipFor(battle), { tone: 'info', text: 'Round 1 · Your turn' });
  assert.deepEqual(chipFor({ ...battle, winner: 'enemy' }), { tone: 'bad', text: 'Round 1 · Boarders win' });
});
