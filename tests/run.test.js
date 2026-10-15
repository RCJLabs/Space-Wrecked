import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyCommand } from '../src/sim/builder.js';
import { newCampaign, partsNeeded, shipChecklist } from '../src/sim/campaign.js';
import { canLaunch } from '../src/sim/constraints.js';
import { fitPart, manyRuns, PACE, runToLaunch } from '../tools/run.js';
import { rules } from './battleKit.js';

const TOOL = fileURLToPath(new URL('../tools/run.js', import.meta.url));

test("what the checklist still needs: the miner's start asks for three engines, as each brings its own mass", () => {
  const campaign = newCampaign(rules, 1);
  assert.deepEqual(partsNeeded(campaign, rules), { engine: 3, quarters: 1, lifesupport: 1 });
  let { ship } = campaign;
  for (const command of [{ op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }]) ship = applyCommand(ship, rules, command).ship;
  assert.deepEqual(partsNeeded({ ...campaign, ship }, rules), { engine: 3 });
});

test('fitting a part: where the rules allow it and the ship stays whole, or nowhere', () => {
  let { ship } = newCampaign(rules, 1);
  for (let n = 0; n < 3; n++) {
    const fitted = fitPart(ship, rules, 'engine');
    assert.ok(fitted, `engine ${n + 1} fits`);
    assert.equal(fitted.ship.modules.length, ship.modules.length + 1);
    ship = fitted.ship;
  }
  for (const type of ['quarters', 'lifesupport']) ship = fitPart(ship, rules, type).ship;
  assert.ok(canLaunch(shipChecklist({ ...newCampaign(rules, 1), ship }, rules)), 'three engines, quarters and life support: ready');
  assert.equal(fitPart(ship, rules, 'teleporter'), null);
});

// M16's Done when: a test run reaches launch in under an hour. Ten runs,
// the test player as tools/run.js plays it; the time is estimated at the
// pace Gate 2 was passed on (8 to 12 s an order).
test('a test run reaches launch in under an hour, and act 1 is not over too soon', () => {
  assert.deepEqual(PACE.order, [8, 12]);
  const runs = [];
  for (let seed = 1; seed <= 10; seed++) runs.push(runToLaunch(rules, seed));
  for (const [i, run] of runs.entries()) {
    assert.ok(run.launched, `seed ${i + 1}: ${run.lines.at(-1)}`);
    assert.ok(run.minutes[0] < 60, `seed ${i + 1}: ${run.minutes[0]} minutes at the quick pace`);
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
  assert.ok(median(runs.map((run) => run.minutes[1])) < 60, `the median run at the slow pace: ${median(runs.map((run) => run.minutes[1]))} minutes`);
  assert.ok(median(runs.map((run) => run.jobs)) >= 5, `the median run takes ${median(runs.map((run) => run.jobs))} jobs`);
});

// M30: each background's start launches as the miner's does, in about as
// long: every run reaches launch, and at the slow pace the median run is
// within 10 minutes of the miner's (ROADMAP.md M30; tools/run.js --runs 50
// --background measures it over 50 seeds).
test("from each background's start, every test run reaches launch, in about the miner's time (M30)", () => {
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
  const slow = {};
  for (const background of rules.backgrounds.keys()) {
    const runs = Array.from({ length: 10 }, (_, i) => runToLaunch(rules, i + 1, { background }));
    for (const [i, run] of runs.entries()) assert.ok(run.launched, `${background} seed ${i + 1}: ${run.lines.at(-1)}`);
    assert.match(runs[0].lines[0], new RegExp(rules.backgrounds.get(background).name.toLowerCase()));
    slow[background] = median(runs.map((run) => run.minutes[1]));
  }
  for (const background of ['deserter', 'smuggler']) assert.ok(Math.abs(slow[background] - slow.miner) <= 10, `${background}: ${slow[background]} minutes against the miner's ${slow.miner}`);
  assert.throws(() => runToLaunch(rules, 1, { background: 'pilot' }), /--background is one of miner, deserter, smuggler/);
});

test('the run tool prints a run, and runs summed up, from the command line', () => {
  assert.match(execFileSync(process.execPath, [TOOL, '--seed', '1'], { encoding: 'utf8' }), /Ready to launch after \d+ jobs/);
  const summed = manyRuns(rules, 2);
  assert.match(summed.lines[0], /2 runs, seeds 1 to 2: 2 ready to launch\./);
  assert.throws(() => runToLaunch(rules, 1, { heat: 'sometimes' }), /--heat is one of raids, hunters, never/);
});
