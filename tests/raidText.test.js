// M29: the words for raids on the colony: heat with the pursuer's words for
// it at the colony, the day's odds of being found, a raid coming and its
// days, the colony's defenses, Defend's first tap, the landing's report,
// the raid fight's line and opening words, and how it ended; and a trip's
// leg a raid stopped, with Fly on.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { flyOn, flyOut } from '../src/sim/expeditions.js';
import { faceRaid, raidTake, settleRaid } from '../src/sim/raids.js';
import { colonyText, dayReport, dayText } from '../src/ui/campaign/colonyText.js';
import { heatText } from '../src/ui/campaign/hubText.js';
import { colonyRaidObjective, colonyRaidOutcome, defendText, defenseRow, landingNotice, landingReport, raidHint, raidStatus, takenText } from '../src/ui/campaign/raidText.js';
import { awayText, legReport } from '../src/ui/campaign/tripText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const pursuer = rules.backgrounds.get('miner').pursuer;
const words = pursuer.colony;
const party = 'Recovery agent ×2, Hired heavy, Company guard';
const far = { kind: 'rock', name: 'Old Red', days: 3, event: 'rich-seam', held: false, seed: 12 };

// The colony with these buildings standing: [type, x, y], in that order.
function withBuildings(campaign, list) {
  const buildings = list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

// The colony at this heat, its world this far from the lanes, with these
// places listed.
function at(campaign, { heat = campaign.heat, lanes = campaign.colony.world.lanes, places = campaign.colony.places } = {}) {
  return { ...campaign, heat, colony: { ...campaign.colony, places, world: { ...campaign.colony.world, lanes } } };
}

// The raid found on day `found`, landing on day `lands`.
function coming(campaign, found, lands) {
  return { ...campaign, colony: { ...campaign.colony, raid: { found, lands } } };
}

// The colony a day on, with the raid's lander down today.
function down(campaign) {
  const day = Math.max(2, campaign.colony.day);
  return { ...campaign, colony: { ...campaign.colony, day, raid: { found: day - 1, lands: day } } };
}

// The first seed's faceRaid that matches `pick`, from the campaign.
function facedWhere(campaign, pick, tries = 400) {
  for (let n = 1; n <= tries; n++) {
    const faced = faceRaid({ ...campaign, rng: seedFrom(n) }, rules);
    if (faced.ok && pick(faced)) return faced;
  }
  return null;
}

test("heat at the colony: the run's levels with the pursuer's words for the colony; the day's odds of being found, by heat and the lanes; a raid coming and its days", () => {
  const base = settled();
  for (const [heat, level, name] of [[10, 'calm', 'Calm'], [30, 'rumors', 'Rumors'], [50, 'hunters', 'Hunters'], [75, 'taskForce', 'Task force'], [100, 'cornered', 'Cornered']]) {
    const text = heatText({ ...base, heat }, rules);
    assert.deepEqual([text.value, text.level, text.name, text.line], [heat, level, name, words.levels[level]], level);
  }
  assert.deepEqual(colonyText(at(base, { heat: 50 }), rules).heat, heatText(at(base, { heat: 50 }), rules));
  // Quiet under rumors; then the day's odds, by how far the colony lies
  // from the lanes.
  assert.deepEqual(raidStatus(at(base, { heat: 10 }), rules), { label: 'Found', value: 'No odds under heat 25', ok: true, state: 'quiet', line: words.levels.calm });
  const odds = (lanes) => raidStatus(at(base, { heat: 50, lanes }), rules);
  assert.deepEqual([odds(1).value, odds(2).value, odds(3).value], ['9% a day · near the lanes', '6% a day · off the lanes', '3% a day · far from the lanes']);
  assert.deepEqual([odds(1).state, odds(1).ok, odds(1).line], ['odds', true, words.levels.hunters]);
  // Found: the lander's days, counted down, then down.
  const found = coming(at(base, { heat: 50 }), 1, 4);
  assert.deepEqual(raidStatus(found, rules), { label: 'Raid', value: 'Lander in 3 days', ok: false, state: 'coming', line: words.found });
  assert.equal(raidStatus({ ...found, colony: { ...found.colony, day: 3 } }, rules).value, 'Lander in 1 day');
  assert.deepEqual(raidStatus(down(found), rules), { label: 'Raid', value: 'Lander down: defend', ok: false, state: 'down', line: words.landing });
  // The colony's needs end with the raid's line.
  assert.deepEqual(colonyText(found, rules).needs.at(-1), { label: 'Raid', value: 'Lander in 3 days', ok: false });
  assert.deepEqual(colonyText(at(base, { heat: 50, lanes: 2 }), rules).needs.at(-1), { label: 'Found', value: '6% a day · off the lanes', ok: true });
  // The hint warns while one is coming, and says when the ship is away.
  assert.deepEqual(raidHint(found, rules), { text: `${words.found} It lands in 3 days: set down guns, a shield and an armory from the hold.`, tone: 'warn' });
  assert.equal(raidHint(at(base, { heat: 50 }), rules), null);
  // The act's words say what is still to come.
  assert.match(colonyText(base, rules).ahead, /^All of v0\.4 is here, sound included\. Still to come in v1\.0: /);
});

test("the day: Next day's first tap gives the odds of the colony being found tonight, and the report says when it was, with the roll", () => {
  const base = at(settled(), { heat: 50, lanes: 2 });
  const ask = dayText(dayPlan(base, rules)).text;
  assert.match(ask, / 6% the colony is found tonight\. Tap again for day 2\.$/);
  assert.doesNotMatch(dayText(dayPlan(at(base, { heat: 10 }), rules)).text, /found tonight/);
  // A day it is found, and one it isn't.
  let foundDay = null;
  let quietDay = null;
  for (let n = 1; n <= 200 && !(foundDay && quietDay); n++) {
    const result = nextDay({ ...at(base, { heat: 100, lanes: 1 }), rng: seedFrom(n) }, rules);
    if (result.found) foundDay ??= result;
    else quietDay ??= result;
  }
  assert.ok(foundDay && quietDay);
  const report = dayReport(foundDay, rules);
  assert.equal(report.tone, 'bad');
  assert.ok(report.text.endsWith(` ${words.found} Rolled ${foundDay.roll}, under the 23%: the lander comes down in 3 days.`), report.text);
  assert.ok(report.text.startsWith(dayReport(quietDay, rules).text.slice(0, 6)));
  assert.doesNotMatch(dayReport(quietDay, rules).text, /Rolled|lander/);
  // While it is coming, each day's report counts its days; the day it
  // lands, the report ends with the raid's hint.
  const found = foundDay.campaign;
  const next = nextDay(found, rules);
  assert.equal(dayReport(next, rules).tone, 'warn');
  assert.ok(dayReport(next, rules).text.endsWith(' The lander comes down in 2 days.'));
  const landed = nextDay(nextDay(next.campaign, rules).campaign, rules);
  assert.deepEqual(dayReport(landed, rules), { text: `${dayReport(landed).text} ${raidHint(landed.campaign, rules).text}`, tone: 'bad' });
  assert.match(dayReport(landed, rules).text, /Tap Defend: the guns fire as it comes down, then whoever is home fights the rest\.$/);
});

test("the defenses: what fires at a lander and what the defenders gain, and None with a raid coming and nothing to stop it", () => {
  const base = at(settled(), { heat: 70 });
  assert.equal(defenseRow(base, rules), null);
  assert.deepEqual(defenseRow(coming(base, 1, 4), rules), { label: 'Defense', value: 'None: nothing fires at a lander', ok: false });
  const armed = withBuildings(base, [['reactor', 6, 0], ['weapon', 0, 0], ['pointdefense', 2, 0], ['cannon', 0, 3], ['shield', 0, 6], ['armory', 3, 6]]);
  assert.deepEqual(defenseRow(armed, rules), { label: 'Defense', value: '4 shots at a lander · +1 armor · +10 aim', ok: true });
  assert.deepEqual(defenseRow(withBuildings(base, [['armory', 3, 6]]), rules), { label: 'Defense', value: 'Nothing fires at a lander · +10 aim', ok: true });
  assert.deepEqual(defenseRow(withBuildings(base, [['weapon', 0, 0]]), rules), { label: 'Defense', value: '1 shot at a lander', ok: true });
  // In the colony's needs, before the raid's line.
  assert.deepEqual(colonyText(armed, rules).needs.slice(-2).map((need) => need.label), ['Defense', 'Found']);
});

test("Defend: the first tap says what fires at the lander, at what odds, and who fights; the landing's report; the fight's line, opening words and end", () => {
  const base = withBuildings(at(settled(), { heat: 70 }), [['reactor', 6, 0], ['weapon', 0, 0], ['cannon', 0, 3], ['shield', 0, 6]]);
  const ready = down(base);
  // The marine at home calls the shots (M32): 60%, not landingHit's 50.
  const marine = ready.crew.find((member) => member.job === 'marine').name;
  assert.deepEqual(defendText(base, rules), { ok: false, ask: null, why: 'No lander is down at the colony.' });
  assert.deepEqual(defendText(ready, rules), {
    ok: true,
    ask: `The gun emplacement and the cannon emplacement (2 shots) fire at the lander as it comes down, 60% a shot with ${marine} the marine calling them, each hit a raider fewer. 3 at home fight whoever lands of 4 (${party}); the shield gives +1 armor. Tap again to defend.`,
    why: null,
  });
  assert.equal(defendText(down(at(settled(), { heat: 70 })), rules).ask, `Nothing at the colony fires at the lander. 3 at home fight whoever lands of 4 (${party}). Tap again to defend.`);
  assert.deepEqual(raidHint(ready, rules), { text: `${words.landing} Tap Defend: the guns fire as it comes down, then whoever is home fights the rest.`, tone: 'bad' });
  assert.deepEqual(colonyText(ready, rules).needs.at(-1), { label: 'Raid', value: 'Lander down: defend', ok: false });

  // One hit: three land, and the fight is on.
  const fought = facedWhere(ready, (faced) => faced.fight && faced.landing.hits === 1);
  assert.ok(fought);
  assert.deepEqual(landingReport(fought, ready, rules), { text: '3 shots at the lander, 1 hit. 3 raiders land: hold them off.', tone: 'warn' });
  const { fight } = fought.campaign;
  assert.deepEqual(colonyRaidObjective(fight.battle, fight, rules), { title: 'Raid', progress: '3 raiders left · 1 stopped landing', done: false, deadline: null });
  assert.deepEqual(landingNotice(fight.battle, fight, fought.campaign, rules), { tone: 'warn', text: '3 shots at the lander, 1 hit. 3 raiders landed: hold them off.' });
  // None stopped: the line says only who is left.
  const missed = facedWhere(ready, (faced) => faced.fight && faced.landing.hits === 0);
  assert.deepEqual(colonyRaidObjective(missed.campaign.fight.battle, missed.campaign.fight, rules).progress, '4 raiders left');
  assert.equal(landingNotice(missed.campaign.fight.battle, missed.campaign.fight, missed.campaign, rules).text, '3 shots at the lander, 0 hits. 4 raiders landed: hold them off.');
  // How it ended: the pursuer's words won, what was taken lost; heat falls
  // to heatAfterRaid either way.
  const end = (winner) => ({ ...fight.battle, winner });
  assert.deepEqual(colonyRaidOutcome(end('crew'), fought.campaign, rules), { tone: 'good', title: 'Raid beaten', text: `${words.faced} Heat falls to 40.` });
  const take = raidTake(fought.campaign, rules);
  assert.deepEqual(colonyRaidOutcome(end('enemy'), fought.campaign, rules), { tone: 'bad', title: 'Raid lost', text: `They took ${take.food} food, ${take.materials} materials and the Corridor. Heat falls to 40.` });
  assert.equal(takenText(null, rules), 'nothing: there was nothing to take');
  assert.equal(takenText({ food: 0, materials: 3, part: null }, rules), '3 materials');

  // Every raider stopped as they land: beaten without a fight.
  const guns = down(withBuildings(at(settled(), { heat: 70 }), [['reactor', 8, 0], ['weapon', 0, 0], ['weapon', 2, 0], ['weapon', 4, 0], ['weapon', 6, 0], ['cannon', 0, 3], ['cannon', 3, 3]]));
  const beaten = facedWhere(guns, (faced) => !faced.fight);
  assert.ok(beaten);
  assert.deepEqual(landingReport(beaten, guns, rules), { text: `8 shots at the lander, ${beaten.landing.hits} hits. Every raider stopped before they landed: the raid is beaten. Heat falls to 40.`, tone: 'good' });
});

test("while the ship is away: the leg a raid stopped, the hint and Defend with nobody home, Fly on's ask once it is faced, and each leg's report", () => {
  const base = at(settled(), { heat: 30, places: [far] });
  const found = coming(base, 1, 2);
  const out = flyOut(found, rules, 0, [1]);
  assert.equal(out.stopped, true);
  const report = legReport(out, 'out', found, rules);
  assert.equal(report.tone, 'bad');
  assert.ok(report.text.startsWith('1 day out: '), report.text);
  assert.ok(report.text.endsWith(" Con-Reg Recovery's lander is down at the colony: the ship waits, 2 days still to fly, while those at home face it."), report.text);
  const away = awayText(out.campaign, rules);
  assert.deepEqual([away.leg, away.on, away.event, away.held, away.home.ok], [
    { dir: 'out', left: 2, line: 'On the way out, 2 days still to fly' },
    { ok: false, ask: null, why: "Con-Reg Recovery's lander is down: face the raid first." },
    null,
    null,
    false,
  ]);
  // Faced and won: Fly on says the days still to fly and what they eat.
  const faced = settleRaid(out.campaign, rules, true).campaign;
  const on = awayText(faced, rules).on;
  assert.equal(on.ok, true);
  assert.match(on.ask, /^Fly on to Old Red: 2 days still to fly, the days eating \d+ food \(\d+ → \d+\)\. Tap again to fly\.$/);
  const flown = flyOn(faced, rules);
  assert.ok(legReport(flown, flown.dir, faced, rules).text.endsWith(' The squad is at Old Red.'));
  // A raid coming with the ship away, and with nobody home.
  const warned = coming(base, 1, 6);
  assert.match(raidHint(flyOut(warned, rules, 0, [1]).campaign, rules).text, / The ship is away: whoever is home will fight\.$/);
  const empty = flyOut(found, rules, 0, [1, 2, 3]).campaign;
  assert.deepEqual(raidHint(empty, rules), { text: `${words.landing} Tap Defend: the guns fire as it comes down, nobody is home to fight the rest.`, tone: 'bad' });
  assert.equal(defendText(empty, rules).ask, `Nothing at the colony fires at the lander. Nobody is home: whoever lands of 4 (${party}) takes what they like. Tap again to defend.`);
  const lost = faceRaid(empty, rules);
  // Heat as the trip left it (30, the trip's, a day's fall): under
  // heatAfterRaid, so it stays.
  assert.equal(lost.campaign.heat, empty.heat);
  assert.deepEqual(landingReport(lost, empty, rules), { text: `Nothing fired at the lander. Nobody home to stop 4: they took ${takenText(lost.taken, rules)}. Heat stays at ${empty.heat}.`, tone: 'bad' });
  assert.equal(colonyRaidOutcome({ winner: 'crew' }, { ...empty, heat: 12 }, rules).text, `${words.faced} Heat stays at 12.`);
});
