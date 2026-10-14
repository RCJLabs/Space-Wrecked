// M26: what the colony screen says: the colony's power, beds and air
// against the crew, its buildings (the dark ones marked), who sleeps
// aboard, the ship's parts with what each would give or why not, the world
// and how the run went, and the act's words for what is still to come.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donate, givesOf } from '../src/sim/colony.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { colonyText, givenText, givesText, giveText } from '../src/ui/campaign/colonyText.js';
import { worldSaid } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

test('the colony as it opens: nothing built, everyone aboard, every part still on the ship', () => {
  const campaign = settled(1, { surveyFirst: true, flags: { jumps: 31, longJumps: 3, hunts: 2, huntsFaced: 1, boardingsWon: 1, boardingsLost: 0 } });
  const text = colonyText(campaign, rules);
  const { world } = campaign.colony;
  const kind = rules.worlds.kinds.get(world.kind);
  assert.equal(text.act, 'Act 3 · The colony');
  assert.equal(text.home, `${world.name} · ${kind.name}`);
  assert.deepEqual(text.needs, [
    { label: 'Power', value: '0 used of 1', ok: true },
    { label: 'Beds', value: '0 for 3', ok: false },
    { label: 'Air', value: '0 for 3', ok: false },
    { label: 'Aboard', value: '3 sleep on the ship', ok: false },
  ]);
  assert.equal(text.power, '0 from power plants, 1 spare from the landed ship');
  assert.deepEqual(text.buildings, []);
  assert.ok(text.crew.every((member) => member.aboard));
  // The parts that can go first, a row a kind, each with what it would
  // give; then the rest, a row a reason, naming every kind it holds back.
  assert.deepEqual(text.parts.map((row) => [row.name, row.count, row.ok, row.building ?? row.why]), [
    ['Weapon mount', 1, true, 'Gun emplacement'],
    ['Crew quarters', 1, true, 'Barracks'],
    ['Life support', 1, true, 'Air plant'],
    ['Bridge, Corridor ×3, Airlock, Engine ×3', null, false, 'Stays aboard: no use to the colony.'],
    ['Reactor', null, false, "The ship couldn't fly without it: power −7 (0 made, 7 used)."],
  ]);
  // A tap on a reason's row marks every part it holds back.
  assert.deepEqual(text.parts[3].uids, campaign.ship.modules.filter((m) => ['bridge', 'corridor', 'airlock', 'engine'].includes(m.type)).map((m) => m.uid));
  assert.equal(text.parts[1].gives, 'Beds 4 · power −1');
  assert.deepEqual(text.world, { title: `${world.name} · ${kind.name}`, lines: worldSaid(world, rules, true) });
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
  assert.equal(text.ahead, rules.acts.get(3).ahead);
  assert.equal(text.text, rules.colony.text);
  // Settled without a survey: the numbers all the same, and a line saying so.
  const unsurveyed = colonyText(settled(3), rules);
  assert.equal(unsurveyed.world.lines.at(-1), 'Settled without a survey: these are what the landing found.');
  // The title's Continue: the world.
  assert.equal(continueText(campaign, rules), `Act 3 · ${world.name}`);
});

test('parts given: the needs met, the buildings and what they give, and who still sleeps aboard', () => {
  let campaign = settled();
  for (const type of ['quarters', 'lifesupport', 'weapon']) campaign = donate(campaign, rules, uidOf(campaign, type)).campaign;
  const text = colonyText(campaign, rules);
  assert.deepEqual(text.needs, [
    { label: 'Power', value: '3 used of 4', ok: true },
    { label: 'Beds', value: '4 for 3', ok: true },
    { label: 'Air', value: '4 for 3', ok: true },
    { label: 'Aboard', value: 'Nobody', ok: true },
    { label: 'Defense', value: 'Guns 15, for raids to come', ok: true },
  ]);
  assert.deepEqual(text.buildings.map((b) => [b.name, b.gives, b.powered]), [
    ['Barracks', 'Beds 4 · power −1', true],
    ['Air plant', 'Air 4 · power −1', true],
    ['Gun emplacement', 'Guns 15 · power −1', true],
  ]);
  assert.ok(text.crew.every((member) => !member.aboard));
  assert.equal(text.parts.some((row) => row.ok), false, 'nothing left to give');
  // A dark building says so, and so does the power.
  const dark = { ...campaign, colony: { ...campaign.colony, buildings: [...campaign.colony.buildings, { uid: 9, type: 'shieldarray', x: 10, y: 0, rot: 0 }], nextUid: 10 } };
  const darkText = colonyText(dark, rules);
  assert.deepEqual(darkText.buildings.at(-1), { uid: 9, name: 'Shield array', gives: 'Dark: needs 4 power', powered: false });
  assert.equal(darkText.needs[0].ok, false);
  // Bunks: two beds and two breaths, so one of three sleeps aboard.
  const bunks = { ...settled(), colony: { ...campaign.colony, buildings: [{ uid: 1, type: 'bunks', x: 0, y: 0, rot: 0 }], nextUid: 2 } };
  const bunkText = colonyText(bunks, rules);
  assert.deepEqual(bunkText.needs.find((need) => need.label === 'Aboard'), { label: 'Aboard', value: '1 sleeps on the ship', ok: false });
  assert.deepEqual(bunkText.crew.map((member) => member.aboard), [false, false, true]);
});

test('what a tap on a part says, and what giving it came to', () => {
  const campaign = settled();
  const rows = colonyText(campaign, rules).parts;
  const quarters = rows.find((row) => row.type === 'quarters');
  assert.deepEqual(giveText(quarters), { ok: true, ask: 'Give?', text: "Crew quarters becomes the colony's Barracks: beds 4 · power −1. It comes off the ship. Tap again to give it.", tone: 'info' });
  const reactor = rows.find((row) => row.name === 'Reactor');
  assert.deepEqual(giveText(reactor), { ok: false, ask: null, text: "Reactor: can't be given. The ship couldn't fly without it: power −7 (0 made, 7 used).", tone: 'warn' });
  const result = donate(campaign, rules, quarters.uid);
  assert.deepEqual(givenText(result, rules), { text: 'The barracks stands at the colony: beds 4 · power −1.', tone: 'good' });
  assert.equal(givenText({ ...result, healed: 9 }, rules).text, 'The barracks stands at the colony: beds 4 · power −1. It patched the crew up: 9 hit points.');
  // Every building's numbers, as the rows say them.
  const gives = (type) => givesText(givesOf(rules.modules.get(type)));
  assert.equal(gives('reactor'), 'Power +8');
  assert.equal(gives('surgery'), 'Heals 2 · power −2');
  assert.equal(gives('largehold'), 'Stores 40');
  assert.equal(gives('pointdefense'), 'Flak 10 · power −1');
  assert.equal(gives('armory'), 'Arms the crew');
  assert.equal(gives('shieldarray'), 'Shield 25 · power −4');
});
