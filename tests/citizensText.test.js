// M38f's words: the colony screen's citizens, a farm or a mine a citizen
// works, the day's words with the citizens eating and coming and going; a
// colony's news while the ship was away, as the colony screen's hint, a
// landing's report, a trip's leg and the chart's colony panels; Defend and
// the raid's hints with colonists; a colonist's card and name in a fight;
// the captive who settles at a job's end; and the words carried from the
// screen that flew to the one that opens.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { colonyStats } from '../src/sim/colony.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { flyOut } from '../src/sim/expeditions.js';
import { faceRaid } from '../src/sim/raids.js';
import { settle } from '../src/sim/settle.js';
import { stationBoard, takeStationJob } from '../src/sim/stationJobs.js';
import { voyageHome, voyageOut } from '../src/sim/voyage.js';
import { carry, takeCarried } from '../src/ui/campaign/carried.js';
import { otherColonies } from '../src/ui/campaign/colonyListText.js';
import { colonyText, dayReport, dayText } from '../src/ui/campaign/colonyText.js';
import { settledLine } from '../src/ui/campaign/jobText.js';
import { newsLine, newsSaid, newsText, newsTone } from '../src/ui/campaign/newsText.js';
import { defendText, raidHint } from '../src/ui/campaign/raidText.js';
import { legReport } from '../src/ui/campaign/tripText.js';
import { colonyPanelText, voyageReport, whoThere } from '../src/ui/campaign/voyageText.js';
import { unitText } from '../src/ui/fight/hints.js';
import { shortNames } from '../src/ui/names.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const pursuer = rules.backgrounds.get('miner').pursuer;
const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const ROOMY = [['farm', 4, 0], ['mine', 7, 0], ['farm', 10, 0], ['solar', 13, 0], ['shelter', 4, 4], ['shelter', 7, 4], ['shelter', 10, 4]];

// As tests/citizens.test.js has it: the kit's colony with room for three
// citizens past its crew of three, two farms and a mine, and citizens.
function roomy(citizens = 0, extra = []) {
  const base = settled();
  const buildings = [...ROOMY, ...extra].map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...base, colony: { ...base.colony, buildings, nextUid: buildings.length + 1, citizens, places: [rock] } };
}

// The ship out on a trip from the colony with the squad.
function onTrip(campaign, squad) {
  return { ...campaign, colony: { ...campaign.colony, places: [], trip: { place: rock, squad, done: false, result: null, leg: null } } };
}

// The colony on day 2 with a raid's lander down that day.
function down(campaign) {
  return { ...campaign, colony: { ...campaign.colony, day: 2, raid: { found: 1, lands: 2 } } };
}

const citizensRow = (campaign) => colonyText(campaign, rules).needs.find((row) => row.label === 'Citizens');

test('the colony screen: its citizens, the beds they take, the days to the next or why none comes; a farm or a mine a citizen works says so', () => {
  assert.deepEqual(citizensRow(roomy()), { label: 'Citizens', value: 'None · the first in 5 days', ok: true });
  const two = { ...roomy(2), colony: { ...roomy(2).colony, growth: 2 } };
  assert.deepEqual(citizensRow(two), { label: 'Citizens', value: '2 in 2 beds · the next in 3 days', ok: true });
  assert.deepEqual(citizensRow(roomy(3)), { label: 'Citizens', value: '3 in 3 beds · none comes: no bed and air free', ok: true });
  // Five: two without a bed.
  assert.equal(citizensRow(roomy(5)).value, '5 in 3 beds · none comes: no bed and air free');
  assert.equal(citizensRow(roomy(0, [['shelter', 4, 8], ['shelter', 7, 8]])).value, 'None · none comes while a building is dark');
  assert.equal(citizensRow(onTrip(roomy(), [1, 2, 3])).value, 'None · none comes with nobody there');
  assert.deepEqual(citizensRow({ ...roomy(2), supplies: 0 }), { label: 'Citizens', value: '2 in 2 beds · short of food: one leaves tonight', ok: false });
  assert.equal(citizensRow({ ...roomy(), supplies: 0 }).value, 'None · none comes while food is short');
  // Worked, one to each in the order built.
  const buildings = colonyText(roomy(2), rules).buildings.filter((b) => b.name === 'Farm' || b.name === 'Mine');
  assert.deepEqual(buildings.map((b) => b.gives), ['Food +2 a day · a citizen works it', 'Materials +4 a day · a citizen works it', 'Food +1 a day']);
});

test("the day's words: the crew and the citizens eat, one comes or one leaves; with none, as before", () => {
  const none = dayText(dayPlan(roomy(), rules));
  assert.match(none.text, /; the crew eats 3 and rests\. /);
  const two = roomy(2);
  assert.match(dayText(dayPlan(two, rules)).text, /; the crew and 2 citizens eat 5, and the crew rests\. /);
  // The day that brings one.
  const ready = { ...two, colony: { ...two.colony, growth: rules.balance.citizenDays - 1 } };
  assert.match(dayText(dayPlan(ready, rules)).text, / A citizen comes: 3 then\. Tap again for day 2\.$/);
  const came = nextDay(ready, rules);
  assert.match(dayReport(came, rules).text, /the crew and 2 citizens ate 5, and the crew rested.* A citizen came: 3 now\.$/);
  // A hungry day: one leaves.
  const hungry = { ...two, supplies: 0 };
  assert.match(dayText(dayPlan(hungry, rules)).text, /; the crew and 2 citizens need 5 and go hungry, the crew losing \d+ hit points each\. .* Short of food, a citizen leaves: 1 then\./);
  assert.match(dayReport(nextDay(hungry, rules), rules).text, /short of food, the crew and 2 citizens went hungry.* Short of food, a citizen left: 1 now\.$/);
});

test("a colony's news in words: the raids fought out without the ship, and who came, settled and left", () => {
  assert.equal(newsText({ news: [] }, roomy(), rules), null);
  const fought = { day: 34, kind: 'raid', won: true, landed: 4, fell: 1, food: 0, materials: 0, part: null };
  const colony = { citizens: 3, news: [fought] };
  // The Done when's own words.
  assert.deepEqual(newsText(colony, roomy(), rules), { text: `While the ship was away, ${pursuer.name}'s raiders were fought off on day 34; 1 colonist fell.`, tone: 'warn' });
  const lost = { ...fought, day: 40, won: false, fell: 2, food: 13, materials: 10, part: 'shield' };
  assert.equal(newsSaid([lost], colony, roomy(), rules), `${pursuer.name}'s raiders won on day 40 and took 13 food, 10 materials and the ${rules.modules.get('shield').name}; 2 colonists fell`);
  const stopped = { ...fought, day: 41, landed: 0, fell: 0 };
  assert.equal(newsSaid([stopped], colony, roomy(), rules), `the guns stopped every one of ${pursuer.name}'s raiders on day 41`);
  const people = [{ day: 2, kind: 'grew', citizens: 1 }, { day: 7, kind: 'grew', citizens: 2 }, { day: 9, kind: 'settled', citizens: 3 }, { day: 12, kind: 'left', citizens: 2 }];
  assert.equal(newsSaid(people, { citizens: 2 }, roomy(), rules), '2 citizens came, a freed captive settled and one left, short of food: 2 now');
  assert.deepEqual([newsTone([fought]), newsTone([stopped]), newsTone([lost]), newsTone(people), newsTone(people.slice(0, 3))], ['warn', 'good', 'bad', 'warn', 'good']);
  // The last of it, short, for the chart's panels.
  assert.deepEqual([newsLine({ news: [fought] }), newsLine({ news: [lost] }), newsLine({ news: [stopped] }), newsLine({ news: people }), newsLine({ news: [] })], ['Raid fought off, day 34 · 1 fell', 'Raid lost, day 40 · 2 fell', 'Raid stopped landing, day 41', 'A citizen left, day 12', null]);
});

test('the news where it shows: the colony screen once landed, till a day passes; a trip leg; a landing; the chart panels', () => {
  // A trip out with a raid fought out at home on the way.
  const base = roomy(2);
  const coming = { ...base, heat: 30, colony: { ...base.colony, raid: { found: 1, lands: 2 } } };
  const out = flyOut(coming, rules, 0, [1]);
  assert.ok(out.ok, out.error);
  const leg = legReport(out, 'out', coming, rules);
  assert.match(leg.text, new RegExp(` At the colony, ${pursuer.name}'s raiders (were fought off|won) on day 2.*\\. The squad is at The Anvil\\.$`), leg.text);
  // The colony screen's news, while there is some.
  const news = colonyText(out.campaign, rules).news;
  assert.match(news.text, /^While the ship was away, /);
  assert.equal(colonyText(base, rules).news, null);
  // Out on a voyage, the colony's panel on the chart: who is home with the
  // citizens, and the news.
  const flown = voyageOut({ ...base, supplies: 30 }, rules, [1, 2]).campaign;
  const panel = colonyPanelText(flown, rules);
  assert.deepEqual(panel.rows.find(([label]) => label === 'Home'), ['Home', 'Lark and 2 citizens']);
  assert.equal(panel.rows.find(([label]) => label === 'News'), undefined, 'no news yet');
  const told = { ...flown, colony: { ...flown.colony, citizens: 3, news: [{ day: 3, kind: 'grew', citizens: 3 }] } };
  assert.deepEqual(colonyPanelText(told, rules).rows.at(-1), ['News', 'A citizen came, day 3']);
  // Landed home: the landing's words, and the news after them.
  const home = voyageHome(told, rules);
  assert.ok(home.landed);
  assert.match(voyageReport(home, told, rules).text, /^Home at Copperhill after 1 day: .* While the ship was away, a citizen came: 3 now\.$/);
  assert.deepEqual([whoThere([], 0), whoThere([], 1), whoThere(base.crew.slice(0, 1), 2)], ['Nobody', '1 citizen', 'Fen and 2 citizens']);
});

test("another colony's panel counts its citizens and gives its last news", () => {
  // A second colony settled on a voyage, the first left with its citizens.
  const out = voyageOut({ ...roomy(2), supplies: 30 }, rules, [1, 2]).campaign;
  const world = out.run.sector.nodes.find((node) => node.type === 'world');
  const there = { ...out, run: { ...out.run, at: world.id, seen: [...new Set([...out.run.seen, world.id])] } };
  const two = settle(there, rules).campaign;
  const [first] = otherColonies(two, rules);
  assert.deepEqual(first.rows.find(([label]) => label === 'There'), ['There', 'Lark and 2 citizens']);
  const told = { ...two, colonies: two.colonies.map((colony) => ({ ...colony, news: [{ day: 5, kind: 'raid', won: false, landed: 4, fell: 1, food: 3, materials: 2, part: null }] })) };
  const [after] = otherColonies(told, rules);
  assert.deepEqual(after.rows.at(-1), ['News', 'Raid lost, day 5 · 1 fell']);
  assert.match(after.detail, /Lark and 2 citizens there · .* · raid lost, day 5 · 1 fell$/);
});

test("Defend and the raid's hints count the colonists beside the crew, and say a fallen one is lost", () => {
  const at = down(roomy(3));
  const ask = defendText(at, rules).ask;
  assert.match(ask, / 3 at home and 3 colonists fight whoever lands of 4 \(/);
  assert.match(ask, / A colonist who falls is lost to the colony\. Tap again to defend\.$/);
  assert.match(raidHint(at, rules).text, /then whoever is home and 3 colonists fights the rest\.$/);
  // Citizens alone at home, the crew out on a trip with the ship.
  const alone = onTrip(at, [1, 2, 3]);
  assert.match(defendText(alone, rules).ask, / 3 colonists at home fight whoever lands of 4 /);
  assert.match(raidHint(alone, rules).text, /then 3 colonists fight the rest\.$/);
  // None: as before.
  assert.doesNotMatch(defendText(down(roomy()), rules).ask, /colonist/);
});

test("a colonist in the fight: their card says what they are, and the crew bar keeps their numbers", () => {
  let faced = null;
  for (let n = 1; n <= 50 && !faced; n++) {
    const tried = faceRaid({ ...down(roomy(2)), rng: seedFrom(n) }, rules);
    if (tried.fight) faced = tried;
  }
  assert.ok(faced);
  const colonist = faced.campaign.fight.battle.units.find((unit) => unit.citizen);
  const card = unitText(colonist, rules, faced.campaign.fight.battle);
  assert.equal(card.title, `Colonist 1 ${colonist.id}`);
  assert.match(card.lines[0], /^Colonist · 6\/6 hit points · /);
  assert.equal(card.lines[1], 'A citizen of the colony, under your orders: if they fall, the colony loses them, unless they are stabilized.');
  const names = faced.campaign.fight.battle.units.filter((unit) => unit.side === 'crew').map((unit) => unit.name);
  assert.deepEqual(shortNames(names).slice(-2), ['Col. 1', 'Col. 2']);
  assert.deepEqual(shortNames(['Bot 1', 'Bot 2']), ['Bot 1', 'Bot 2'], 'a short word whole');
  assert.deepEqual(shortNames(['Fen Lindqvist', 'Colonist 1']), ['Fen', 'Colonist']);
  assert.deepEqual(shortNames(['Fen Lindqvist', 'Fen Arno']), ['Fen L.', 'Fen A.'], 'as before');
});

test("a rescue on a voyage: the job's end says the captive settles at the colony, or nothing when they go their way", () => {
  const out = voyageOut({ ...roomy(), supplies: 30 }, rules, [1, 2]).campaign;
  const station = out.run.sector.nodes.filter((node) => node.type === 'station').map((node) => ({ ...out, run: { ...out.run, at: node.id, seen: [...new Set([...out.run.seen, node.id])], docked: false, jobbed: [] } }))
    .find((campaign) => stationBoard(campaign, rules).some((offer) => rules.contracts.jobs.get(offer.contract)?.mission === 'rescue'));
  assert.ok(station, "the kit's voyage has a rescue posted");
  const index = stationBoard(station, rules).findIndex((offer) => rules.contracts.jobs.get(offer.contract)?.mission === 'rescue');
  const taken = takeStationJob(station, rules, index).campaign;
  const ward = taken.fight.battle.units.find((unit) => unit.ward);
  assert.equal(settledLine({ ...taken.fight.battle, winner: 'crew' }, taken, rules), `${ward.name} settles at Copperhill: 1 citizen there now.`);
  assert.equal(settledLine({ ...taken.fight.battle, winner: 'enemy' }, taken, rules), null);
  const full = { ...taken, colony: { ...taken.colony, citizens: colonyStats(taken, rules).citizens.free } };
  assert.equal(settledLine({ ...taken.fight.battle, winner: 'crew' }, full, rules), null);
});

test('words carried from the screen that flew to the next: taken once', () => {
  assert.equal(takeCarried(), null);
  carry({ text: 'Home at Copperhill after 1 day.', tone: 'good' });
  assert.deepEqual(takeCarried(), { text: 'Home at Copperhill after 1 day.', tone: 'good' });
  assert.equal(takeCarried(), null);
  carry(null);
  assert.equal(takeCarried(), null);
});
