// M28: the words for trips from the colony: the places within reach, a
// trip's plan, where the squad is and what is there, each leg's report,
// a place's boarding, and the colony while the ship is away.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donate } from '../src/sim/colony.js';
import { boardPlace, chooseAtPlace, endPlaceFight, flyHome, flyOut, tripPlan, withPlaces } from '../src/sim/expeditions.js';
import { boardingObjective, boardingOutcome } from '../src/ui/campaign/boardingText.js';
import { colonyText } from '../src/ui/campaign/colonyText.js';
import { awayText, legReport, placesText, planText, squadRows } from '../src/ui/campaign/tripText.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const hulk = { kind: 'hulk', name: 'Long Haul', days: 1, event: null, held: true, seed: 7 };
const listing = (campaign, places) => ({ ...campaign, colony: { ...campaign.colony, places } });

test("the places within reach: each one's name, kind and days, the system's worlds by their own kind", () => {
  const listed = withPlaces(settled(), rules);
  assert.deepEqual(placesText(listed, rules).map((row) => [row.index, row.name, row.line]), [
    [0, 'Ironbark', 'Ice world · 3 days away'],
    [1, 'The Anvil', 'Ore rock · 2 days away'],
    [2, 'Second Chance', 'Jungle world · 2 days away'],
  ]);
  assert.equal(placesText(listed, rules)[1].about, rules.expeditions.kinds.get('rock').text);
  assert.equal(placesText(listing(settled(), [hulk]), rules)[0].line, 'Derelict · 1 day away · squatters aboard');
});

test("a trip's plan: the days, the food, the flight checks with the squad aboard, and Fly out's ask, or why not", () => {
  const listed = listing(settled(), [rock, hulk]);
  const ok = planText(tripPlan(listed, rules, 0, [1, 2, 3]), listed, rules);
  assert.deepEqual(ok, {
    title: 'The Anvil',
    lines: ['Ore rock · 2 days there, 2 back', 'The days eat 12 food: 27 → 15', 'Every flight check passes with 3 aboard.'],
    ok: true,
    ask: 'Fly out to The Anvil with Fen Lindqvist, Quill Petrov and Lark Ibarra: 4 days away, the colony on its own power. Tap again to fly.',
    why: null,
  });
  const given = donate(listed, rules, uidOf(listed, 'lifesupport')).campaign;
  const refused = planText(tripPlan(given, rules, 0, [1, 2, 3]), given, rules);
  assert.deepEqual([refused.ok, refused.ask, refused.lines[2], refused.why], [
    false,
    null,
    'Life support 0 of 3 crew: add Life support (+4 crew)',
    "The ship can't fly with 3 aboard: life support 0 of 3 crew. Refit to put life support aboard.",
  ]);
  assert.equal(planText(tripPlan(listed, rules, 0, []), listed, rules).why, 'Pick someone to go.');
  // The squad picker: everyone, ticked when they go.
  assert.deepEqual(squadRows(listed, rules, [2]).map((row) => [row.name, row.about, row.hp, row.max, row.going]), [
    ['Fen Lindqvist', 'Marine', 10, 10, false],
    ['Quill Petrov', 'Engineer', 8, 8, true],
    ['Lark Ibarra', 'Medic', 8, 8, false],
  ]);
});

test('away: the place, its event and choices with their odds, what came of it, and Fly home; each leg reported', () => {
  const listed = listing(settled(), [rock]);
  const out = flyOut(listed, rules, 0, [1]);
  assert.deepEqual(legReport(out, 'out', listed, rules), {
    text: "2 days out: everyone ate 6. With no bed and air at the colony, Quill Petrov and Lark Ibarra didn't rest. The squad is at The Anvil.",
    tone: 'good',
  });
  const there = awayText(out.campaign, rules);
  assert.deepEqual([there.title, there.where, there.squad, there.held, there.result], ['The Anvil', 'Ore rock · 2 days from home', 'Fen Lindqvist', null, null]);
  assert.deepEqual(there.event.choices.map((choice) => [choice.label, choice.odds, choice.ask]), [
    ['Dig deep', '75% · 25%', 'Dig deep: 75%: +12 materials. 25%: +6 materials, someone hurt (3 hit points). Tap again to choose.'],
    ['Skim the face', '', 'Skim the face: +5 materials. Tap again to choose.'],
    ['Leave it', '', 'Leave it: Nothing. Tap again to choose.'],
  ]);
  assert.deepEqual(there.home, { ok: false, ask: null, why: 'Decide first: Rich seam.' });
  const chose = chooseAtPlace(out.campaign, rules, 'skim').campaign;
  const done = awayText(chose, rules);
  assert.deepEqual([done.event, done.result], [null, { title: 'Rich seam: Skim the face', text: 'What comes away easily, and nobody under it. +5 materials.' }]);
  assert.deepEqual(done.home, { ok: true, ask: 'Fly home: 2 days back, the days eating 6 food (21 → 15). Tap again to fly.', why: null });
  assert.deepEqual(legReport(flyHome(chose, rules), 'home', chose, rules), {
    text: "2 days back: everyone ate 6. With no bed and air at the colony, Quill Petrov and Lark Ibarra didn't rest. The ship is home. It brought 5 materials.",
    tone: 'good',
  });
  assert.equal(awayText(listed, rules), null);
  // The colony while the ship is away: on its own power, who is away and
  // who goes without.
  const text = colonyText(out.campaign, rules);
  assert.equal(text.home, 'Copperhill · Desert world · Day 3 · the ship away');
  assert.deepEqual(text.needs.find((need) => need.label === 'Away'), { label: 'Away', value: '1 on the trip, 2 home without a bed', ok: false });
  assert.deepEqual([text.power, text.stores], ['0 from power plants; the ship is away', "30 each, in the ship's holds"]);
  assert.deepEqual(text.crew.map((row) => [row.away, row.rough, row.aboard]), [[true, false, false], [false, true, false], [false, true, false]]);
  assert.match(colonyText(listed, rules).ahead, /Still to come in v0\.4/);
});

test("a held derelict: who holds her, what a win brings, Board her's ask; the fight's words; and what it came to", () => {
  const out = flyOut(listing(settled(), [hulk]), rules, 0, [1, 2, 3]).campaign;
  const held = awayText(out, rules);
  assert.deepEqual(held.held, {
    lines: ['Squatters hold her: Scavver ×2, Hired heavy.', 'Win: strip 2 of her parts, and 4 to 8 materials.', 'Lose: the squad comes back hurt, with nothing. Or fly home and leave her be.'],
    ask: 'Board Long Haul: the squad against the squatters, aboard her. Tap again to board.',
  });
  assert.equal(held.home.ok, true);
  const fight = boardPlace(out, rules).campaign;
  const { battle } = fight.fight;
  assert.deepEqual(boardingObjective(battle, fight), { title: 'Aboard Long Haul', progress: '3 squatters left', done: false, deadline: null });
  const salvage = fight.fight.boarding.salvage;
  const names = salvage.parts.map((type) => rules.modules.get(type).name);
  assert.equal(boardingOutcome({ ...battle, winner: 'crew' }, fight, rules).title, 'Long Haul is yours');
  assert.match(boardingOutcome({ ...battle, winner: 'crew' }, fight, rules).text, new RegExp(`^Stripped: an? ${names[0]}, an? ${names[1]}\\. Materials: ${salvage.materials}, as far as the stores take them\\.$`));
  assert.deepEqual(boardingOutcome({ ...battle, winner: 'enemy' }, fight, rules), { tone: 'bad', title: 'Beaten back', text: 'The squad falls back to the ship, hurt. Nothing taken.' });
  const won = endPlaceFight({ ...fight, fight: { ...fight.fight, battle: { ...battle, winner: 'crew' } } }, rules);
  assert.equal(awayText(won, rules).result.title, 'Boarded and won');
  assert.match(awayText(won, rules).result.text, new RegExp(`^The squad took .+ and ${salvage.materials} materials\\.$`));
  const lost = endPlaceFight({ ...fight, fight: { ...fight.fight, battle: { ...battle, winner: 'enemy' } } }, rules);
  assert.deepEqual(awayText(lost, rules).result, { title: 'Beaten back', text: 'The squad came back aboard hurt, with nothing.' });
});
