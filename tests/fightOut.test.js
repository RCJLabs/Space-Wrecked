// Fights played on past 40 rounds (src/sim/fightOut.js): both sides press
// on, and a long shot gives way to a step nearer (M39: under 25% to hit,
// where since M32 only a shot under 10% did).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction } from '../src/sim/ai.js';
import { createBattle } from '../src/sim/battle.js';
import { LONG_SHOT, playOn } from '../src/sim/fightOut.js';
import { stepsFrom } from '../src/sim/moves.js';
import { shotOdds } from '../src/sim/odds.js';
import { pressAction } from '../src/sim/press.js';
import { openMap, put, rules } from './battleKit.js';

test('past 40 rounds a long shot, under 25% to hit, gives way to a step nearer; before then it is taken', () => {
  assert.equal(LONG_SHOT, 25);
  // An engineer and a pirate, each in half cover, across a 12-tile room.
  const map = put(put(openMap(12, 3), 10, 1, 'half cover'), 1, 1, 'half cover');
  const { battle } = createBattle({ map, units: [{ kind: 'engineer', x: 0, y: 1 }, { kind: 'pirate', x: 11, y: 1 }], seed: 3 }, rules);
  const [engineer, pirate] = battle.units;
  const odds = shotOdds(battle, engineer, pirate, rules).hit;
  assert.ok(odds >= 10 && odds < LONG_SHOT, `a ${odds}% shot`);
  const first = (round) => playOn({ ...battle, round }, rules, { crew: pressAction, enemy: aiAction }, { maxRounds: round }).actions[0];
  assert.deepEqual(first(39), { type: 'shoot', unit: engineer.id, target: pirate.id });
  const step = first(41);
  assert.equal(step.type, 'move');
  const away = stepsFrom(battle, [[pirate.x, pirate.y]], rules);
  assert.ok(away.get(step.to.join(',')) < away.get(`${engineer.x},${engineer.y}`), `a step nearer, to ${step.to}`);
});
