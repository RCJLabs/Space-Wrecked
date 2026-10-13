// M22's balance guard, through the harness behind `node tools/sim.js
// --boardings` (tools/boarding.js): the squad at full health, played by the
// AI, beats a pirate cutter's crew at least 40% of the time, at home and
// aboard her. Seeded, so every run is the same.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runBoardings } from '../tools/boarding.js';
import { rules } from './battleKit.js';

test("the start crew beats a cutter's crew at least 40% of the time, either way", () => {
  const rows = runBoardings(rules, { fights: 100 });
  const cutter = rows.filter((row) => row.preset === 'cutter');
  assert.deepEqual(cutter.map((row) => row.dir).sort(), ['them', 'you']);
  for (const row of cutter) assert.ok(row.won >= 0.4 * row.fights, `${row.label}: ${row.won} of ${row.fights}`);
  // Every hostile preset with a party has both rows, and every fight ends.
  assert.equal(rows.length, 2 * [...rules.ships.values()].filter((preset) => preset.tactics && preset.party).length);
  assert.ok(rows.every((row) => row.stalled <= 2), rows.map((row) => `${row.label}: ${row.stalled} stalled`).join('; '));
});
