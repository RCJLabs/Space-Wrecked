import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { launch } from '../src/sim/launch.js';
import { settle } from '../src/sim/settle.js';
import { survey } from '../src/sim/survey.js';
import { beginRun, leaveSector } from '../src/sim/travel.js';
import { continueText, hangarText } from '../src/ui/campaign/hubText.js';
import { landingText, launchText, stubText } from '../src/ui/campaign/launchText.js';
import { worldSaid } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

test('a ship ready to launch: the hangar says so, and Launch asks before it ends the act', () => {
  const text = hangarText(readyToLaunch(), rules);
  assert.equal(text.goal.ready, true);
  assert.deepEqual(text.hint, { tone: 'good', text: 'Every flight check passes. Tap Launch to lift off and end act 1.' });
  assert.deepEqual(text.launch, { ok: true, ask: 'Lift off and end act 1? The job board and the shop stay behind. Tap Launch again.' });
  assert.equal(hangarText(withBoard(newCampaign(rules, 5), rules), rules).launch.ok, false);
});

test('with a raid at the door, a ready ship can still lift off from under it', () => {
  const text = hangarText(readyToLaunch({ heat: 80 }), rules);
  assert.ok(text.raid);
  assert.equal(text.launch.ok, true);
  assert.deepEqual(text.hint, {
    tone: 'bad',
    text: 'Con-Reg Recovery is at the hangar door with a court order and a lot of friends. Launch, and leave them an empty hangar.',
  });
});

test("the launch: the act it leaves, the background's words, and the raid left behind", () => {
  const words = rules.backgrounds.get('miner').launch;
  assert.deepEqual(launchText(launch(readyToLaunch(), rules).campaign, rules), { from: 'Act 1 · Homeworld', to: 'Act 2 · The run', line: words.text, escaped: null });
  assert.equal(launchText(launch(readyToLaunch({ heat: 80 }), rules).campaign, rules).escaped, words.escaped);
});

// M25: a world settled in the system past the charts, the ship at world
// `id`, surveyed first or not.
function settled(id, { surveyFirst = false, flags = {} } = {}) {
  const run = beginRun(launch(readyToLaunch({ heat: 10 }), rules).campaign, rules).campaign;
  const { sector } = run.run;
  // At the last sector's jump point, the sectors before it crossed.
  const sectors = rules.acts.get(2).sectors;
  const past = rules.sectors.names.sectors.filter((name) => name !== sector.name).slice(0, sectors - 1);
  const exit = { ...run, flags: { ...run.flags, ...flags }, run: { ...run.run, sector: { ...sector, index: sectors }, at: sector.exit, seen: [...run.run.seen, sector.exit], past } };
  const system = leaveSector(exit, rules).campaign;
  let there = { ...system, run: { ...system.run, at: id, seen: [...system.run.seen, id] } };
  if (surveyFirst) there = survey(there, rules).campaign;
  return settle(there, rules).campaign;
}

test('the landing: the world settled, its kind\'s words, and the act it begins', () => {
  const campaign = settled(2);
  const { world } = campaign.colony;
  const kind = rules.worlds.kinds.get(world.kind);
  assert.deepEqual(landingText(campaign, rules), { world: `${world.name} · ${kind.name}`, to: 'Act 3 · The colony', line: kind.landing });
});

test("the stub: act 3 with its words, how the run went, the world settled, and the crew", () => {
  const campaign = settled(1, { surveyFirst: true, flags: { jumps: 31, longJumps: 3, hunts: 2, huntsFaced: 1, boardingsWon: 1, boardingsLost: 0 } });
  const text = stubText(campaign, rules);
  const { world } = campaign.colony;
  const kind = rules.worlds.kinds.get(world.kind);
  assert.equal(text.act, 'Act 3 · The colony');
  assert.equal(text.home, `The colony · ${world.name}`);
  assert.equal(text.text, rules.acts.get(3).stub);
  assert.deepEqual(text.record, {
    title: 'Act 2 · The run',
    lines: [
      ['Sectors', `${rules.acts.get(2).sectors} crossed`],
      ['Jumps', '32, 3 long'],
      ['Hunters', '2 met, 1 faced'],
      ['Boardings', '1 won, 0 lost'],
      ['Credits', '140'],
      ['Parts on hand', 'Corridor ×2'],
      ['Heat', `${campaign.heat} · Calm`],
    ],
  });
  assert.deepEqual(text.world, { title: `${world.name} · ${kind.name}`, lines: worldSaid(world, rules, true), surveyed: true });
  assert.deepEqual(text.crew.map((member) => member.name), campaign.crew.map((member) => member.name));
  // Settled without a survey: the numbers all the same, and a line saying so.
  const unsurveyed = stubText(settled(3), rules);
  assert.equal(unsurveyed.world.surveyed, false);
  assert.equal(unsurveyed.world.lines.at(-1), 'Settled without a survey: these are what the landing found.');
  assert.deepEqual(unsurveyed.record.lines.slice(1, 4), [['Jumps', '1'], ['Hunters', 'None met'], ['Boardings', 'None']]);
  // The title's Continue: the world.
  assert.equal(continueText(campaign, rules), `Act 3 · ${world.name}`);
});
