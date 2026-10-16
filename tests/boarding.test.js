// M22's balance guard, through the harness behind `node tools/sim.js
// --boardings` (tools/boarding.js): the squad at full health, played by the
// AI, beats a pirate cutter's crew at least 40% of the time, at home and
// aboard her. Seeded, so every run is the same.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBattle } from '../src/sim/battle.js';
import { runBoardings, sealedIn } from '../tools/boarding.js';
import { openMap, put, rules } from './battleKit.js';

test("the start crew beats a cutter's crew at least 40% of the time, either way", () => {
  const rows = runBoardings(rules, { fights: 100 });
  const cutter = rows.filter((row) => row.preset === 'cutter');
  assert.deepEqual(cutter.map((row) => row.dir).sort(), ['them', 'you']);
  for (const row of cutter) assert.ok(row.won >= 0.4 * row.fights, `${row.label}: ${row.won} of ${row.fights}`);
  // Every hostile preset with a party has both rows, and every fight ends.
  assert.equal(rows.length, 2 * [...rules.ships.values()].filter((preset) => preset.tactics && preset.party).length);
  assert.ok(rows.every((row) => row.stalled <= 2), rows.map((row) => `${row.label}: ${row.stalled} stalled`).join('; '));
});

// M32: a fight no one can end. The fallen fill the only way between the
// medic's nook and the pirate round the corner: the medic can pass them
// but stops nowhere with the pirate in sight, and the pirate can't pass the
// crew's fallen (moves.js). The test player's trips stop at such a fight
// (tools/voyage.js); a player would be held there (ROADMAP §9).
test('a fight is sealed in when no one standing can reach a tile with an enemy in sight', () => {
  const map = openMap(3, 4);
  for (const [x, y] of [[2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 3]]) put(map, x, y, 'hull');
  const units = [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 1 }, { kind: 'engineer', x: 1, y: 2 }, { kind: 'pilot', x: 1, y: 3 }, { kind: 'pirate', x: 2, y: 3 }];
  const { battle } = createBattle({ map, units, seed: 1 }, rules);
  for (const fallen of battle.units.filter((u) => ['c2', 'c3', 'c4'].includes(u.id))) Object.assign(fallen, { status: 'out', hp: 0 });
  assert.equal(sealedIn(battle, rules), true);
  // With the pilot dead, not lying at the foot, the medic can stand there.
  battle.units.find((u) => u.id === 'c4').status = 'dead';
  assert.equal(sealedIn(battle, rules), false);
});
