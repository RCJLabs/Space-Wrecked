// M38e's words: every other colony as the chart and the colony screen list
// it, Fly to from the chart and from the colony screen, what a flight came
// to, Settle here on a voyage and a second colony's landing, a lander down
// or coming at another colony, and Continue on a flight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { endColonyRaid, faceRaid } from '../src/sim/raids.js';
import { settle, settlePlan } from '../src/sim/settle.js';
import { flyFrom, flyTo, voyageOut } from '../src/sim/voyage.js';
import { flightFromText, flightReport, flyToText, ordinal, otherColonies, settleOnVoyage } from '../src/ui/campaign/colonyListText.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { landingText } from '../src/ui/campaign/launchText.js';
import { defendText, landingReport, raidHint } from '../src/ui/campaign/raidText.js';
import { sectorText } from '../src/ui/campaign/sectorText.js';
import { colonyPanelText, homeText, landerComing } from '../src/ui/campaign/voyageText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

// As colonies.test.js has them: the first colony with a storehouse, a
// voyage with two aboard, and the voyage's world settled.
function withStore(campaign) {
  const { colony } = campaign;
  return { ...campaign, colony: { ...colony, buildings: [...colony.buildings, { uid: colony.nextUid, type: 'cargo', x: 10, y: 4, rot: 0 }], nextUid: colony.nextUid + 1 } };
}
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])], docked: false, jobbed: [] } });
const home = withStore({ ...settled(1), supplies: 50 });
const ids = home.crew.map((member) => member.id);
const first = (campaign) => campaign.crew.map((member) => member.name.split(' ')[0]);
const away = voyageOut(home, rules, ids.slice(0, 2)).campaign;
const atWorld = at(away, away.run.sector.nodes.find((node) => node.type === 'world').id);
const two = settle(atWorld, rules).campaign;
const [lark] = first({ crew: home.crew.slice(2) });
// The first colony's raid's lander coming down on day `lands` (down now
// by default).
const raidAtFirst = (campaign, lands) => ({ ...campaign, colonies: campaign.colonies.map((colony) => ({ ...colony, raid: { found: Math.max(1, colony.day - 1), lands: lands ?? colony.day } })) });

test('Settle here on a voyage says a colony more, who lands and what the colony flown from keeps; the landing says which', () => {
  const plan = settlePlan(atWorld, rules);
  const said = settleOnVoyage(atWorld, plan, rules);
  assert.equal(said, `Found the crew's second colony on ${plan.world.name}: the ship lands with ${first(atWorld).join(' and ')}, a landing's 20 materials and nothing built yet. ${home.colony.world.name} keeps ${lark} and its food. Not surveyed: what it is worth, you find out on the ground. Tap again to settle.`);
  assert.equal(sectorText(atWorld, rules).settle.text, said);
  assert.equal(settleOnVoyage(home, plan, rules), null, 'not on a voyage');
  assert.deepEqual([ordinal(1), ordinal(2), ordinal(12)], ['first', 'second', 'twelfth']);
  assert.equal(landingText(two, rules).to, "A new colony · The crew's second");
  assert.equal(landingText(home, rules).to, 'Act 3 · The colony');
  assert.equal(continueText(two, rules), `Act 3 · ${plan.world.name}`);
});

test('every other colony listed: the flight there, its day, food, who is there and its raid', () => {
  const [other] = otherColonies(two, rules);
  assert.deepEqual([other.id, other.name, other.title, other.days], [1, home.colony.world.name, `Colony · ${home.colony.world.name}`, 1]);
  const kept = two.colonies[0];
  assert.deepEqual(other.rows.slice(0, 4), [['Flight', '1 day'], ['Day', String(kept.day)], ['Food', `${kept.keep.food} of 20`], ['There', lark]]);
  assert.equal(other.rows[4][0], 'Found');
  assert.equal(other.tone, 'info');
  assert.equal(other.detail, `A day's flight · day ${kept.day} · food ${kept.keep.food} · ${lark} there · ${other.rows[4][1].charAt(0).toLowerCase()}${other.rows[4][1].slice(1)}`);
  // A raid coming there turns it bad, and says when.
  const coming = otherColonies(raidAtFirst(two, kept.day + 2), rules)[0];
  assert.deepEqual([coming.rows[4], coming.tone], [['Raid', 'Lander in 2 days'], 'bad']);
  // The one flown from is the chart's colony panel, with its flight home.
  const out = voyageOut(two, rules, ids.slice(0, 2)).campaign;
  assert.deepEqual(colonyPanelText(out, rules).rows.at(-1), ['Flight', '1 day']);
  assert.deepEqual(otherColonies(out, rules).map((colony) => [colony.id, colony.days]), [[1, 2]]);
  assert.deepEqual(sectorText(out, rules).colonies.map((colony) => colony.fly.ok), [true]);
  assert.deepEqual(sectorText(two.colony.voyage ? two : away, rules).colonies, [], 'none but the one flown from');
});

test('Fly to from the chart and from the colony screen: days, supplies, heat and the stores landed, and what it came to', () => {
  const out = voyageOut(two, rules, ids.slice(0, 2)).campaign;
  const fly = flyToText(out, rules, 1);
  assert.equal(fly.ok, true);
  assert.match(fly.ask, new RegExp(`^Fly to ${home.colony.world.name}: 2 days, eating 4 supplies aboard \\(\\d+ → \\d+\\), heat \\+2, no hunters\\. Landed, the stores are one: \\d+ food of \\d+\\. ${two.colony.world.name} keeps its food\\. Tap again to fly\\.$`));
  const landed = flyTo(out, rules, 1);
  assert.equal(flightReport(landed, out, rules).text, `Landed at ${home.colony.world.name} after 2 days: the ship's crew and stores join those there, ${landed.campaign.supplies} food. ${two.colony.world.name} keeps its own.`);
  // From the colony screen: Fly out's words, the flight for the jump.
  const words = flightFromText(two, rules, 1, [ids[0]]);
  assert.equal(words.ok, true);
  assert.equal(words.title, `Fly to ${home.colony.world.name}`);
  assert.ok(words.lines.includes(`To ${home.colony.world.name}: 1 day, 1 supplies a day for those aboard, heat +2 to ${two.heat + 2}, no hunters`), words.lines.join(' | '));
  assert.ok(!words.lines.some((line) => line.startsWith('Into a system')));
  assert.match(words.ask, new RegExp(`^Fly to ${home.colony.world.name} with .*; a day's flight\\. Tap again to fly\\.$`));
  assert.match(flightFromText(two, rules, 1, []).why, /Pick who goes/);
  const flown = flyFrom(two, rules, 1, [ids[0]]);
  assert.match(flightReport(flown, two, rules).text, new RegExp(`^Landed at ${home.colony.world.name} after 1 day`));
});

test('a lander down at another colony: the hint and Defend name it, and the report says where they landed', () => {
  const down = raidAtFirst(two);
  const where = home.colony.world.name;
  assert.equal(raidHint(down, rules).text, `Con-Reg Recovery's lander is down at ${where}: nothing passes until it is faced. Tap Defend: its guns fire as it comes down, then whoever is at ${where} fights the rest.`);
  const defend = defendText(down, rules);
  assert.equal(defend.ok, true);
  assert.match(defend.ask, new RegExp(`^Nothing at ${where} fires at the lander\\. 1 at ${where} fight whoever lands of 4`));
  const faced = faceRaid(down, rules);
  assert.equal(landingReport(faced, down, rules).text, `Nothing fired at the lander. 4 raiders land at ${where}: hold them off.`);
  // Coming, from a voyage: whether flying there now meets it.
  const out = voyageOut(two, rules, ids.slice(0, 2)).campaign;
  const coming = landerComing(raidAtFirst(out, out.colonies[0].day + 2), rules);
  assert.equal(coming.text, `Con-Reg Recovery found ${where}: their lander comes down in 2 days. Fly to ${where} now (2 days) to meet it, or those there fight it.`);
  const late = landerComing(raidAtFirst(out, out.colonies[0].day + 1), rules);
  assert.match(late.text, /Flying there takes 2 days, too long to meet it: those there fight it\.$/);
});

test('a flight from the colony screen a lander stopped: where the ship waits, Continue, Fly on and the hint', () => {
  const far = raidAtFirst({ ...two, colony: { ...two.colony, at: 5 } }, two.colonies[0].day + 2);
  const stopped = flyFrom(far, rules, 1, ids.slice(0, 2));
  assert.equal(stopped.stopped, true);
  const where = home.colony.world.name;
  const system = stopped.campaign.run.sector.name;
  assert.equal(flightReport(stopped, far, rules).text, `Con-Reg Recovery's lander is down at ${where}: the ship waits in ${system}, 3 days still to fly to ${where}, until the raid is faced.`);
  assert.equal(continueText(stopped.campaign, rules), `Act 3 · ${system}, on the way to ${where}`);
  assert.deepEqual([homeText(stopped.campaign, rules).ok, homeText(stopped.campaign, rules).label], [false, 'Fly on']);
  assert.match(sectorText(stopped.campaign, rules).hint.text, new RegExp(`lander is down at ${where}`));
  // Faced, Fly on flies on there, and says so.
  const fought = faceRaid(stopped.campaign, rules).campaign;
  const won = endColonyRaid({ ...fought, fight: { ...fought.fight, battle: { ...fought.fight.battle, winner: 'crew' } } }, rules);
  const on = homeText(won, rules);
  assert.equal(on.ok, true, on.why);
  assert.match(on.ask, new RegExp(`^Fly on to ${where}: 3 days`));
  assert.equal(sectorText(won, rules).hint.text, `On the way to ${where}, 3 days still to fly: tap Fly on.`);
});
