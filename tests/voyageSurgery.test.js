// Law 1 for surgery (M23e, tests/voyage.test.js): it heals more a jump than
// a med bay (each with the medic aboard), so the crew needs patching less.
// Patching is lumpy, a run patching nothing or ten hit points and more, so
// the check has needed more seeds each time new content moved the runs:
// seeds 1 to 30 until M33b, where surgery patched 43 and a med bay 36; 100
// seeds until M38, whose jobs moved act 1 and with it every voyage, and on
// seeds 1 to 100 surgery patched 132 and a med bay 122 (four runs patching
// 6 to 12 with surgery and none with a med bay), where on seeds 101 to 300
// surgery patched 139 and a med bay 193. So since M38 it flies 300 seeds,
// the same bar over more of them (main's before M38: 192 and 328). It has a
// file of its own, so its voyages fly beside voyage.test.js's. Since M38c
// without station jobs, as voyage.test.js flies its fitted voyages: with
// them a healer's crew, fit more often, works more, and over these 300
// surgery patched 12,475 hit points and a med bay 12,399.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shipStats } from '../src/sim/constraints.js';
import { launchedAt, voyage } from '../tools/voyage.js';
import { rules } from './battleKit.js';

const SEEDS = 300;
// As voyage.test.js flies them: each seed's act 1 test run, then the
// voyage as fitted, no refits and no station jobs, a small reactor first
// where the ship has no power to spare.
const powered = (lifted, fit) => (shipStats(lifted.campaign.ship, rules).power + fit.reduce((sum, type) => sum + rules.modules.get(type).stats.power, 0) >= 0 ? fit : ['smallreactor', ...fit]);
const lifts = Array.from({ length: SEEDS }, (_, i) => ({ seed: i + 1, lifted: launchedAt(rules, i + 1) })).filter(({ lifted }) => lifted.ok);
const fly = (fit) => lifts.map(({ seed, lifted }) => voyage(rules, seed, { refit: 'no', jobs: 'no', fit: powered(lifted, fit) }, lifted));

test('surgery patches less than a med bay over 300 voyages (Law 1)', () => {
  const surgery = fly(['smallreactor', 'surgery']);
  const medbay = fly(['medbay']);
  const patched = (voyages) => voyages.reduce((total, trip) => total + trip.tally.patchedHp, 0);
  assert.ok(lifts.length >= SEEDS - 5, `${lifts.length} of ${SEEDS} runs launched`);
  assert.ok(patched(surgery) < patched(medbay), `patched ${patched(surgery)} with surgery, ${patched(medbay)} with a med bay, over ${lifts.length} runs`);
});
