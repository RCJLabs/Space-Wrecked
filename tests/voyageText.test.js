// M38d: the words for voyages from the colony: who Fly out picks first, its
// plan, the colony's panel on the chart while the ship is away, Fly home's
// plan, what flying out and home came to, and the chart's words out in the
// systems past the colony's: where it is, the lander coming and down, and
// a flight home a lander stopped. From M38f a lander coming down while the
// ship is away is fought out there: the landing tells it, and a flight
// stopped is a save's from before.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crewRoom } from '../src/sim/crew.js';
import { leaveSector } from '../src/sim/travel.js';
import { voyageHome, voyageOut, voyagePlan } from '../src/sim/voyage.js';
import { continueText, heatText } from '../src/ui/campaign/hubText.js';
import { jumpText, sectorText } from '../src/ui/campaign/sectorText.js';
import { colonyPanelText, firstVoyagers, homeText, landerComing, outText, voyageReport } from '../src/ui/campaign/voyageText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

// The kit's colony with a storehouse standing and its stores full.
const base = settled(1);
const home = { ...base, supplies: 50, colony: { ...base.colony, buildings: [{ uid: 1, type: 'cargo', x: 10, y: 4, rot: 0 }], nextUid: 2 } };
const flown = voyageOut(home, rules, [1, 2]);
const away = flown.campaign;
// The colony with the raid's lander coming down on day `lands`.
const landing = (campaign, lands) => ({ ...campaign, colony: { ...campaign.colony, raid: { found: campaign.colony.day - 1, lands } } });

test('Fly out picks the healthiest that fit aboard first, leaving one at home', () => {
  assert.deepEqual(firstVoyagers(home, rules), [1, 2]);
  const hurt = { ...home, crew: home.crew.map((member) => (member.id === 1 ? { ...member, hp: 1 } : member)) };
  assert.deepEqual(firstVoyagers(hurt, rules), [2, 3], 'the hurt stay home');
  const alone = { ...home, crew: home.crew.slice(0, 1) };
  assert.deepEqual(firstVoyagers(alone, rules), [1], 'one alone goes');
});

test("Fly out's plan: who goes and who stays, the food split, the jump, the checks, and its ask", () => {
  const words = outText(voyagePlan(home, rules, [1, 2]), home, rules);
  assert.deepEqual(words, {
    title: 'Voyage from Copperhill',
    lines: [
      'Aboard: Fen Lindqvist and Quill Petrov · Lark Ibarra stays at Copperhill',
      'Food 50: the holds take 30, enough for 15 jumps; the storehouses keep 20 of 20',
      'Into a system nobody has charted: 2 supplies, heat +2 to 14',
      // The kit's crew sleeps aboard the landed ship: whoever stays has no
      // bed or air without it.
      'Lark Ibarra has no bed and air at Copperhill: no rest while the ship is away',
      'Every flight check passes with 2 aboard.',
    ],
    bad: 0,
    ok: true,
    ask: "Fly out with Fen Lindqvist and Quill Petrov, Lark Ibarra at home: the holds take 30 food, 15 jumps' worth, and the colony keeps 20. Tap again to fly.",
    why: null,
  });
  // With a shelter standing for them, no such line.
  const sheltered = { ...home, colony: { ...home.colony, buildings: [...home.colony.buildings, { uid: 2, type: 'shelter', x: 4, y: 4, rot: 0 }, { uid: 3, type: 'solar', x: 4, y: 8, rot: 0 }], nextUid: 4 } };
  const roofed = voyagePlan(sheltered, rules, [1, 2]);
  assert.deepEqual(roofed.rough, [], 'a shelter beds and breathes for the one at home');
  assert.ok(!outText(roofed, sheltered, rules).lines.some((line) => line.includes('no bed and air')));
  // More aboard than the ship beds and breathes for: the failing checks are
  // the plan's last lines, counted as bad, and nothing before them is.
  const room = crewRoom(home.ship, rules);
  const crowd = { ...home, crew: [...home.crew, ...Array.from({ length: room + 1 - home.crew.length }, (_, i) => ({ ...home.crew[2], id: 10 + i, name: `Spare ${i}` }))] };
  const crowded = outText(voyagePlan(crowd, rules, crowd.crew.map((member) => member.id)), crowd, rules);
  assert.equal(crowded.ok, false);
  assert.ok(crowded.bad >= 1);
  assert.ok(crowded.lines.slice(-crowded.bad).every((line) => !/^(Aboard|Food|Into)/.test(line)), crowded.lines.join(' / '));
  assert.ok(crowded.lines.slice(0, -crowded.bad).every((line) => /^(Aboard|Food|Into|The mines'|No storehouse)|no bed and air/.test(line)), crowded.lines.join(' / '));
  // Without a storehouse, the first tap says what spoils; the materials
  // stay, and nothing says they are lost (M38d's fix).
  const bare = { ...home, colony: { ...home.colony, buildings: [], nextUid: 1 } };
  const lost = outText(voyagePlan(bare, rules, [1, 2, 3]), bare, rules);
  assert.equal(lost.lines[0], 'Aboard: Fen Lindqvist, Quill Petrov and Lark Ibarra · Nobody stays at Copperhill');
  assert.equal(lost.lines[1], 'Food 50: the holds take 30, enough for 10 jumps; the storehouses keep 0 of 0, 20 spoil');
  assert.match(lost.lines[2], /^Into a system nobody has charted: /);
  assert.ok(!lost.lines.some((line) => /materials/.test(line)));
  assert.match(lost.ask, /: the holds take 30 food, 10 jumps' worth, and the colony keeps 0; 20 food spoils\. Tap again to fly\.$/);
  // A mine at home: what it digs while the ship is away keeps up to the
  // storehouse's room, and with none it is lost.
  const mine = (campaign) => ({ ...campaign, colony: { ...campaign.colony, buildings: [...campaign.colony.buildings, { uid: 9, type: 'mine', x: 4, y: 8, rot: 0 }], nextUid: 10 } });
  const dug = voyagePlan(mine(home), rules, [1, 2]).materials.dug;
  assert.equal(outText(voyagePlan(mine(home), rules, [1, 2]), mine(home), rules).lines[2], `The mines' ${dug} a day keeps up to the storehouses' 20 while the ship is away`);
  assert.equal(outText(voyagePlan(mine(bare), rules, [1, 2]), mine(bare), rules).lines[2], `No storehouse: the mines' ${dug} a day is lost while the ship is away`);
  // An empty larder: the first jump goes hungry, and both taps say so.
  const empty = { ...home, supplies: 0 };
  const starved = outText(voyagePlan(empty, rules, [1, 2]), empty, rules);
  assert.match(starved.lines[2], / · the crew goes hungry, \d+ hit points? each$/);
  assert.match(starved.ask, /; the first jump goes hungry\. Tap again to fly\.$/);
  // Nobody picked: why not.
  assert.deepEqual(outText(voyagePlan(home, rules, []), home, rules), { title: 'Voyage', lines: [], bad: 0, ok: false, ask: null, why: 'Pick who goes: one or more.' });
});

test("the colony's panel on the chart while the ship is away: its day, its food, who is home and the raid", () => {
  assert.equal(colonyPanelText(home, rules), null, 'none with the ship home');
  const panel = colonyPanelText(away, rules);
  assert.equal(panel.title, 'Colony · Copperhill');
  assert.deepEqual(panel.rows.slice(0, 3), [['Day', '2'], ['Food', '19 of 20'], ['Home', 'Lark']]);
  assert.equal(panel.rows[3][0], 'Found');
  assert.equal(panel.tone, 'info');
  const coming = colonyPanelText(landing(away, away.colony.day + 2), rules);
  assert.deepEqual(coming.rows[3], ['Raid', 'Lander in 2 days']);
  assert.equal(coming.tone, 'bad');
  assert.deepEqual(colonyPanelText(landing(away, away.colony.day), rules).rows[3], ['Raid', 'Lander down: defend']);
});

test("Fly home's plan, and what flying out and home came to", () => {
  assert.deepEqual(homeText(away, rules), {
    ok: true,
    label: 'Fly home',
    ask: 'Fly home to Copperhill: 1 day, eating 2 supplies aboard (28 → 26), heat +2. Landed, the stores are one: 44 food of 50. Tap again to fly.',
    why: null,
  });
  const down = landing(away, away.colony.day);
  assert.deepEqual(homeText(down, rules), { ok: false, label: 'Fly home', ask: null, why: "Con-Reg Recovery's lander is down at Copperhill: face the raid first." });
  assert.deepEqual(voyageReport(flown, home, rules), { text: `Into ${away.run.sector.name}, a system nobody has charted. A day passes at Copperhill with each jump.`, tone: 'good' });
  const back = voyageHome(away, rules);
  assert.deepEqual(voyageReport(back, away, rules), { text: `Home at Copperhill after 1 day: the crew and the stores are one again, ${back.campaign.supplies} food.`, tone: 'good' });
  // A lander coming down on the way home is fought out without the ship
  // (M38f): the landing says what came of it.
  const far = leaveSector({ ...away, run: { ...away.run, at: away.run.sector.exit, seen: [...away.run.seen, away.run.sector.exit] } }, rules).campaign;
  const through = voyageHome(landing(far, far.colony.day + 1), rules);
  assert.equal(through.landed, true);
  const said = voyageReport(through, far, rules);
  assert.match(said.text, new RegExp(`^Home at Copperhill after 2 days: the crew and the stores are one again, ${through.campaign.supplies} food\\. While the ship was away, Con-Reg Recovery's raiders (were fought off|won) on day ${far.colony.day + 1}`), said.text);
  assert.equal(said.tone, through.campaign.colony.news[0].won ? 'good' : 'bad');
});

test("the chart out in the systems past the colony's: where it is, the colony, Fly home, Defend, and the hints", () => {
  const text = sectorText(away, rules);
  assert.equal(text.where, `System 1 out · ${away.run.sector.name}`);
  assert.equal(text.colony.title, 'Colony · Copperhill');
  assert.equal(text.home.label, 'Fly home');
  assert.equal(text.defend, null);
  assert.equal(text.settle, null, 'a voyage passes worlds; settling another is to come');
  // The way in and the jump point say a system's words, not a sector's
  // (M38d's fix).
  assert.equal(away.run.at, away.run.sector.start);
  assert.equal(text.here.text, rules.worlds.voyage.text);
  assert.equal(jumpText(away, rules, away.run.sector.exit).node.text, rules.worlds.voyage.exit);
  assert.doesNotMatch(`${text.here.text} ${rules.worlds.voyage.exit}`, /sector/);
  // So does the transponder swap at a station out there.
  const station = { ...away, credits: 500, heat: 30, run: { ...away.run, at: away.run.sector.nodes.find((node) => node.type === 'station').id } };
  assert.match(sectorText(station, rules).swap.text, /clean transponder, once a system:/);
  // The hunters' words for heat, not the colony's.
  assert.equal(heatText(away, rules).line, heatText({ ...away, act: 2, colony: null }, rules).line);
  assert.notEqual(heatText(home, rules).line, heatText(away, rules).line);
  assert.equal(continueText(away, rules), `Act 3 · ${away.run.sector.name}, out from Copperhill`);
  // A lander coming, then down.
  const coming = landing(away, away.colony.day + 2);
  assert.deepEqual(landerComing(coming, rules), { text: 'Con-Reg Recovery found Copperhill: their lander comes down in 2 days. Fly home now (1 day) to meet it, or those at home fight it without the ship.', tone: 'warn' });
  assert.deepEqual(sectorText(coming, rules).hint, landerComing(coming, rules));
  // Too far out to meet it (M38d's fix: the player jumped on after the
  // warning): the hint says so.
  const farOut = { ...coming, colony: { ...coming.colony, voyage: { ...coming.colony.voyage, out: 4, at: 4 } } };
  assert.equal(landerComing(farOut, rules).text, 'Con-Reg Recovery found Copperhill: their lander comes down in 2 days. Flying home takes 4 days, too long to meet it: those at home fight it without the ship.');
  // M38f: the ship must land the day before, as on its day it is fought
  // out; its colonists fight beside those at home.
  const soon = landing(away, away.colony.day + 1);
  assert.match(landerComing(soon, rules).text, /in 1 day\. Flying home takes 1 day, too long to meet it: those at home fight it without the ship\.$/);
  const peopled = { ...coming, colony: { ...coming.colony, citizens: 3 } };
  assert.match(landerComing(peopled, rules).text, /or those at home and 3 colonists fight it without the ship\.$/);
  const alone = { ...peopled, colony: { ...peopled.colony, voyage: { ...peopled.colony.voyage, home: { ...peopled.colony.voyage.home, crew: [] } } } };
  assert.match(landerComing(alone, rules).text, /or its 3 colonists fight it without the ship\.$/);
  const down = landing(away, away.colony.day);
  const held = sectorText(down, rules);
  assert.ok(held.defend.ok);
  assert.match(held.defend.ask, /1 at home fight whoever lands/);
  assert.equal(held.hint.tone, 'bad');
  assert.match(held.hint.text, /Tap Defend/);
  assert.equal(held.home.ok, false);
  // A flight home a lander stopped, in a save from before, once it is
  // faced: Fly on.
  const far = leaveSector({ ...away, run: { ...away.run, at: away.run.sector.exit, seen: [...away.run.seen, away.run.sector.exit] } }, rules).campaign;
  const faced = { ...far, colony: { ...far.colony, voyage: { ...far.colony.voyage, homing: 1, at: 1 } } };
  const homing = sectorText(faced, rules);
  assert.equal(homing.home.label, 'Fly on');
  assert.ok(homing.home.ok);
  assert.match(homing.home.ask, /^Fly on home to Copperhill: 1 day/);
  assert.deepEqual(homing.hint, { tone: 'warn', text: 'On the way home to Copperhill, 1 day still to fly: tap Fly on.' });
});
