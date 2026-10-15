// M26: what the colony screen says: the colony's power, beds and air
// against the crew, its buildings (the dark ones marked), who sleeps
// aboard, the ship's parts with what each would give or why not, the world
// and how the run went, and the act's words for what is still to come.
// M27: the day, food and materials against the stores, what can be built,
// a ghost's words, taking a building down, and the day's report.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donate, givesOf } from '../src/sim/colony.js';
import { build, buildPlan, movePlan, takeDown, takeDownPlan } from '../src/sim/colonyBuild.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { buildingInfo, builtText, colonyText, dayReport, dayText, givenText, givesText, giveText, makesText, placeText, takeDownText, takenText, whyNotText } from '../src/ui/campaign/colonyText.js';
import { worldSaid } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

test('the colony as it opens: nothing built, everyone aboard, every part still on the ship', () => {
  const campaign = settled(1, { surveyFirst: true, flags: { jumps: 31, longJumps: 3, hunts: 2, huntsFaced: 1, boardingsWon: 1, boardingsLost: 0 } });
  const text = colonyText(campaign, rules);
  const { world } = campaign.colony;
  const kind = rules.worlds.kinds.get(world.kind);
  assert.equal(text.act, 'Act 3 · The colony');
  assert.equal(text.home, `${world.name} · ${kind.name} · Day 1`);
  assert.deepEqual(text.needs, [
    { label: 'Power', value: '0 used of 1', ok: true },
    { label: 'Beds', value: '0 for 3', ok: false },
    { label: 'Air', value: '0 for 3', ok: false },
    { label: 'Aboard', value: '3 sleep on the ship', ok: false },
    // The survey ate a day's food.
    { label: 'Food', value: '24 of 30 · +0, eats 3', ok: true },
    { label: 'Materials', value: '20 of 30 · +0 a day', ok: true },
    // M29: heat under rumors, so the pursuer can't find the colony.
    { label: 'Found', value: 'No odds under heat 25', ok: true },
  ]);
  assert.equal(text.stores, "30 each, in the landed ship's holds");
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
    { label: 'Food', value: '27 of 30 · +0, eats 3', ok: true },
    { label: 'Materials', value: '20 of 30 · +0 a day', ok: true },
    // M29: what fires at a raid's lander as it comes down.
    { label: 'Defense', value: '1 shot at a lander', ok: true },
    { label: 'Found', value: 'No odds under heat 25', ok: true },
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
  // Since M28 an infirmary opening heals nobody, so giving a part never
  // says so.
  assert.deepEqual(givenText(result, rules), { text: 'The barracks stands at the colony: beds 4 · power −1.', tone: 'good' });
  // Every building's numbers, as the rows say them.
  const gives = (type) => givesText(givesOf(rules.modules.get(type)));
  assert.equal(gives('reactor'), 'Power +8');
  assert.equal(gives('surgery'), 'Heals 2 · power −2');
  assert.equal(gives('largehold'), 'Stores 40');
  assert.equal(gives('pointdefense'), 'Flak 10 · power −1');
  assert.equal(gives('armory'), 'Arms the crew');
  assert.equal(gives('shieldarray'), 'Shield 25 · power −4');
});

test("the day, food and materials against the stores, and what can be built: farms and mines, the hold's spare parts, the ship's parts", () => {
  const landed = { ...settled(), parts: { quarters: 1, cargo: 1, corridor: 2, engine: 1 } };
  let campaign = build(landed, rules, { build: 'mine' }).campaign;
  campaign = build(campaign, rules, { part: 'cargo' }).campaign;
  const text = colonyText(campaign, rules);
  assert.equal(text.day, 1);
  assert.deepEqual(text.needs.filter((need) => ['Food', 'Materials'].includes(need.label)), [
    { label: 'Food', value: '27 of 50 · +0, eats 3', ok: true },
    { label: 'Materials', value: '10 of 50 · +2 a day', ok: true },
  ]);
  assert.equal(text.stores, "50 each, 30 in the landed ship's holds and 20 in storehouses");
  assert.deepEqual(text.buildings.map((b) => [b.name, b.gives]), [['Mine', 'Materials +2 a day'], ['Storehouse', 'Stores 20']]);
  // A solar array and a shelter (M28) give rather than make.
  assert.deepEqual(text.builds, [
    { what: { build: 'farm' }, id: 'farm', name: 'Farm', cost: 10, makes: 'Food +1 a day here', ok: true, why: null },
    { what: { build: 'mine' }, id: 'mine', name: 'Mine', cost: 10, makes: 'Materials +2 a day here', ok: true, why: null },
    { what: { build: 'solar' }, id: 'solar', name: 'Solar array', cost: 15, makes: 'Power +3', ok: false, why: 'A solar array takes 15 materials, and the stores have 10.' },
    { what: { build: 'shelter' }, id: 'shelter', name: 'Shelter', cost: 10, makes: 'Beds 2 · air 2 · power −1', ok: true, why: null },
  ]);
  // The hold: a row a kind that can be set down, then a row a reason.
  assert.deepEqual(text.hold.map((row) => [row.name, row.count, row.ok, row.building ?? row.why]), [
    ['Crew quarters', 1, true, 'Barracks'],
    ['Corridor ×2, Engine', null, false, 'Stays aboard: no use to the colony.'],
  ]);
  assert.deepEqual(text.hold[0].what, { part: 'quarters' });
  assert.equal(text.hold[0].gives, 'Beds 4 · power −1');
  // Out of materials: why not.
  const broke = colonyText({ ...campaign, colony: { ...campaign.colony, materials: 4 } }, rules);
  assert.deepEqual(broke.builds.map((row) => [row.ok, row.why]), [
    [false, 'A farm takes 10 materials, and the stores have 4.'],
    [false, 'A mine takes 10 materials, and the stores have 4.'],
    [false, 'A solar array takes 15 materials, and the stores have 4.'],
    [false, 'A shelter takes 10 materials, and the stores have 4.'],
  ]);
  assert.deepEqual(whyNotText(broke.builds[0], 'built'), { text: "Farm: can't be built. A farm takes 10 materials, and the stores have 4.", tone: 'warn' });
  assert.equal(whyNotText(text.hold[1], 'set down').text, "Corridor ×2, Engine: can't be set down. Stays aboard: no use to the colony.");
  // Short of food tomorrow: the line says so.
  const hungry = colonyText({ ...campaign, supplies: 2 }, rules);
  assert.deepEqual(hungry.needs.find((need) => need.label === 'Food'), { label: 'Food', value: '2 of 50 · +0, eats 3', ok: false });
  assert.equal(makesText({ food: 5 }), 'Food +5 a day');
});

test("a ghost's words, what building and taking down came to, and the building looked at", () => {
  const campaign = { ...settled(), parts: { quarters: 1 } };
  assert.deepEqual(placeText(buildPlan(campaign, rules, { build: 'farm' }, { x: 4, y: 4, rot: 0 })), {
    ok: true,
    text: 'A farm here, for 10 materials: food +1 a day. Tap it again to build it, or tap the grid to put it somewhere else.',
    tone: 'info',
  });
  assert.equal(placeText(buildPlan(campaign, rules, { part: 'quarters' })).text, 'The barracks here, from the hold: beds 4 · power −1. Tap it again to set it down, or tap the grid to put it somewhere else.');
  assert.equal(placeText(buildPlan(campaign, rules, { uid: uidOf(campaign, 'lifesupport') })).text, 'The air plant here: air 4 · power −1. It comes off the ship. Tap it again to give it, or tap the grid to put it somewhere else.');
  assert.deepEqual(placeText(buildPlan(campaign, rules, { build: 'farm' }, { x: 19, y: 0, rot: 0 })), { ok: false, text: "The farm would stand past the edge of the colony's grid. Tap the grid where it can go.", tone: 'warn' });
  const farm = build(campaign, rules, { build: 'farm' }, { x: 4, y: 4, rot: 0 });
  assert.deepEqual(builtText(farm), { text: 'The farm stands at the colony: food +1 a day. 10 materials left.', tone: 'good' });
  const barracks = build(farm.campaign, rules, { part: 'quarters' });
  assert.deepEqual(builtText(barracks), { text: 'The barracks stands at the colony: beds 4 · power −1.', tone: 'good' });
  const [farmUid, barracksUid] = barracks.campaign.colony.buildings.map((b) => b.uid);
  assert.equal(placeText(movePlan(barracks.campaign, rules, barracksUid, { x: 10, y: 0, rot: 0 }), { moving: true }).text, 'The barracks here: tap it again to move it, or tap the grid to put it somewhere else.');
  // Taking down: what comes back, what goes dark.
  assert.deepEqual(takeDownText(takeDownPlan(barracks.campaign, rules, barracksUid)), { text: 'Take the barracks down? Its part goes back into the hold. Tap again to take it down.', tone: 'info' });
  assert.equal(takeDownText(takeDownPlan(barracks.campaign, rules, farmUid)).text, 'Take the farm down? Its 10 materials come back. Tap again to take it down.');
  const full = { ...barracks.campaign, colony: { ...barracks.campaign.colony, materials: 26 } };
  assert.equal(takeDownText(takeDownPlan(full, rules, farmUid)).text, 'Take the farm down? Its 10 materials come back, and the stores take 4. Tap again to take it down.');
  assert.deepEqual(takeDownText({ name: 'Power plant', back: { part: 'reactor' }, darkens: ['Barracks', 'Air plant'] }), { text: 'Take the power plant down? Its part goes back into the hold. The barracks and air plant go dark. Tap again to take it down.', tone: 'warn' });
  assert.deepEqual(takenText(takeDown(barracks.campaign, rules, barracksUid)), { text: 'The barracks came down: its part is in the hold.', tone: 'good' });
  assert.deepEqual(takenText(takeDown(full, rules, farmUid)), { text: 'The farm came down: 4 materials back.', tone: 'good' });
  // The building looked at.
  const row = colonyText(barracks.campaign, rules).buildings[0];
  assert.deepEqual(buildingInfo(row), { text: 'Farm: food +1 a day. Move or turn it, or take it down.', tone: 'info' });
  assert.equal(buildingInfo({ name: 'Shield array', gives: 'Dark: needs 4 power', powered: false }).tone, 'warn');
});

test("Next day's two taps: what the day will bring, then the day's report, fed or hungry", () => {
  let campaign = settled();
  campaign = build(campaign, rules, { build: 'farm' }).campaign;
  campaign = build(campaign, rules, { build: 'mine' }).campaign;
  const plan = dayPlan(campaign, rules);
  assert.deepEqual(dayText(plan), { text: 'Day 1 ends: the farms grow 1 food and the mines dig 2 materials; the crew eats 3 and rests. Food 27 → 25, materials 0 → 2. Tap again for day 2.', tone: 'info' });
  const hurt = { ...campaign, crew: campaign.crew.map((member) => ({ ...member, hp: 4 })) };
  assert.deepEqual(dayReport(nextDay(hurt, rules)), { text: 'Day 2. The farms grew 1 food and the mines dug 2 materials; the crew ate 3 and rested, healing 9 hit points. Food 25, materials 2.', tone: 'good' });
  const starving = { ...hurt, supplies: 1 };
  assert.deepEqual(dayText(dayPlan(starving, rules)), { text: 'Day 1 ends: the farms grow 1 food and the mines dig 2 materials; the crew needs 3 and goes hungry, losing 2 hit points each. Food 1 → 0, materials 0 → 2. Tap again for day 2.', tone: 'warn' });
  assert.deepEqual(dayReport(nextDay(starving, rules)), { text: 'Day 2. The farms grew 1 food and the mines dug 2 materials; short of food, the crew went hungry: 6 hit points lost. Food 0, materials 2.', tone: 'bad' });
  // Nothing made, and the stores full.
  const full = { ...settled(), supplies: 35 };
  assert.equal(dayText(dayPlan(full, rules)).text, 'Day 1 ends: nothing grows; the crew eats 3 and rests. Food 35 → 30, materials 20 → 20. The stores are full: 2 food will be lost. Tap again for day 2.');
  assert.equal(dayReport(nextDay(full, rules)).text, 'Day 2. Nothing grew; the crew ate 3 and rested. Food 30, materials 20. The stores are full: 2 food lost.');
});
