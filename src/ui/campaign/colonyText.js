// Text for the colony (src/sim/colony.js, M26; days and building by hand,
// M27; raids, M29; citizens and the news of the ship's time away, M38f):
// what act 3's home shows. rules are the content tables (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { buildingOf, colonyStats, shipParts, storesOf } from '../../sim/colony.js';
import { buildList } from '../../sim/colonyBuild.js';
import { dayPlan, planDay } from '../../sim/days.js';
import { colonyPursuer, raidIn } from '../../sim/raids.js';
import { reckoningOf } from '../../sim/reckoning.js';
import { actTitle, crewText, heatText, shipLine } from './hubText.js';
import { runRecord } from './launchText.js';
import { nearLine, namesOf } from './neighbourText.js';
import { newsText } from './newsText.js';
import { defenseRow, raidHint, raidStatus } from './raidText.js';
import { worldSaid } from './sectorText.js';
import { easedSaid, questsText } from './questText.js';
import { sidesText } from './standingText.js';

// What the colony screen shows:
//   act, home   "Act 3 · The colony", "Greenhaven · Ice world · Day 4",
//               and "· the ship away" while it is out on a trip (M28)
//   ship        the ship's name and number (M52), and "· away" while she
//               is
//   day         the colony's day
//   needs       [{ label, value, ok }]: power, then beds and air against
//               the crew at home and who sleeps aboard (while the ship is
//               away, who goes without, and who is away); its citizens
//               (M38f: how many, the beds they take, and the days to the
//               next or why none comes); food and materials against the
//               stores, with what a day makes and eats; the infirmary once
//               the colony has one; defenses
//               (M29: what fires at a lander and what the defenders gain)
//               once it has any or a raid is coming; and the raid's line:
//               the day's odds of being found, or the lander's days. ok is
//               false for a need short (for food, a day that would go
//               hungry) and for a raid coming.
//   heat        the heat meter (hubText.js heatText): the run's levels,
//               with the pursuer's words for them at the colony
//   raid        raidText.js raidStatus's: the raid's line and its state
//   power       how the power is made: "1 from its plants, 3 the ship's"
//   stores      what the stores keep of each: "30 each, in the landed
//               ship's holds"
//   buildings   [{ uid, name, gives, powered }] in the order built: what
//               each gives or makes, or that it is dark and what it needs;
//               a farm or a mine a citizen works says so (M38f)
//   crew        crewText's rows (hubText.js), each with aboard: true for
//               whoever sleeps aboard the landed ship, and (M28) away: true
//               for the squad on a trip, rough: true for whoever is home
//               without a bed and air while the ship is away
//   sides       each side and the crew's standing with it (M33), as the
//               hangar's: act 3 moves none of it
//   builds      [{ what, id, name, cost, makes, ok, why }]: the farms,
//               mines, solar arrays and shelters, what each costs and would
//               make a day here or give (makes: the words for either), and
//               why one can't be built now
//   hold        [{ what, uids, type, name, count, ok, building, gives, why
//               }]: the spare parts in the hold, as parts are below
//   parts       [{ uid, uids, type, name, count, ok, building, gives, why }]:
//               the ship's parts, those that can be given first, a row a
//               kind with its count, each with the building it would be and
//               what that gives (uid is the one a tap gives); then the rest,
//               a row a reason, naming each kind it holds back (uids: every
//               part in the row).
//   world       { title, lines }: the world's numbers and lanes, and a
//               line if it was settled without a survey
//   record      { title, lines: [[label, value]] }: how the run went (M25)
//   news        what happened there while the ship was away (M38f,
//               newsText.js): { text, tone }, or null with none
//   next        what to do next (M43), for the hint when nothing else
//               is said: { text, tone }
//   ahead       the act's words for what is still to come
//   text        the colony's words (data/colony.json)
export function colonyText(campaign, rules) {
  const stats = colonyStats(campaign, rules);
  const stores = storesOf(campaign, rules, stats);
  const plan = dayPlan(campaign, rules);
  const { world, materials } = campaign.colony;
  const kind = rules.worlds?.kinds.get(world.kind)?.name ?? world.kind;
  const crew = crewText(campaign, rules);
  const aboard = new Set(stats.aboard);
  const rough = new Set(stats.rough);
  const away = new Set(stats.away);
  const trip = Boolean(campaign.colony.trip);
  const n = crew.length - away.size;
  // While the ship is away, the next day's plan is a trip's (days.js).
  const day = trip ? planDay(campaign, rules) : plan;
  const eats = day.ok ? day.eats : 0;
  const needs = [
    { label: 'Power', value: `${stats.power.used} used of ${stats.power.made}`, ok: stats.buildings.every((b) => b.powered) },
    { label: 'Beds', value: `${stats.beds} for ${n}`, ok: stats.beds >= n },
    { label: 'Air', value: `${stats.air} for ${n}`, ok: stats.air >= n },
    trip
      ? { label: 'Away', value: `${away.size} on the trip${rough.size ? `, ${rough.size} home without a bed` : ''}`, ok: rough.size === 0 }
      : { label: 'Aboard', value: aboard.size ? `${aboard.size} sleep${aboard.size === 1 ? 's' : ''} on the ship` : 'Nobody', ok: aboard.size === 0 },
    citizensRow(stats, day, rules),
    { label: 'Food', value: `${campaign.supplies} of ${stores.total} · +${stats.made.food}, eats ${eats}`, ok: day.ok ? day.fed : true },
    { label: 'Materials', value: `${materials} of ${stores.total} · +${stats.made.materials} a day`, ok: true },
  ];
  if (stats.infirmary) needs.push({ label: 'Infirmary', value: `Heals ${stats.infirmary}`, ok: true });
  const guard = defenseRow(campaign, rules);
  if (guard) needs.push(guard);
  const raid = raidStatus(campaign, rules);
  needs.push({ label: raid.label, value: raid.value, ok: raid.ok });
  const list = buildList(campaign, rules);
  // What a building's neighbours give it (M54), after what it gives.
  const names = namesOf(stats);
  const near = (b) => (b.near?.length ? ` · ${nearLine(b, names)}` : '');
  return {
    act: actTitle(campaign.act, rules),
    home: `${world.name} · ${kind} · Day ${campaign.colony.day}${trip ? ' · the ship away' : ''}`,
    ship: `${shipLine(campaign, rules)}${trip ? ' · away' : ''}`,
    day: campaign.colony.day,
    needs,
    heat: heatText(campaign, rules),
    raid,
    power: trip ? `${stats.power.plants} from power plants; the ship is away` : `${stats.power.plants} from power plants, ${stats.power.ship} spare from the landed ship`,
    stores: `${stores.total} each, ${stores.colony ? `${stores.ship} in the ${trip ? '' : 'landed '}ship's holds and ${stores.colony} in storehouses` : `in the ${trip ? '' : 'landed '}ship's holds`}`,
    buildings: stats.buildings.map((b) => ({
      uid: b.uid,
      name: b.name,
      gives: !b.powered ? `Dark: needs ${b.need} power` : `${b.makes ? `${makesText(b.makes)}${b.worked ? ' · a citizen works it' : ''}` : givesText(b.gives)}${near(b)}`,
      powered: b.powered,
    })),
    crew: crew.map((row, i) => ({ ...row, aboard: aboard.has(campaign.crew[i].id), away: away.has(campaign.crew[i].id), rough: rough.has(campaign.crew[i].id) })),
    sides: sidesText(campaign, rules),
    quests: questsText(campaign, rules),
    builds: list.builds.map((row) => ({ what: row.what, id: row.id, name: row.name, cost: row.cost, makes: row.makes ? `${makesText(row.makes)} here` : givesText(row.gives), ok: row.ok, why: row.error })),
    hold: holdRows(list.hold, rules),
    parts: partRows(campaign, rules),
    world: { title: `${world.name} · ${kind}`, lines: [...worldSaid(world, rules, true), ...(world.surveyed ? [] : ['Settled without a survey: these are what the landing found.'])] },
    record: { title: actTitle(campaign.act - 1, rules), lines: runRecord(campaign, rules) },
    news: newsText(campaign.colony, campaign, rules),
    next: nextHint(needs),
    ahead: actOf(campaign, rules)?.ahead ?? '',
    text: rules.colony?.text ?? '',
  };
}

// What to do next at the colony (M43): the needs not met first, then the
// day.
function nextHint(needs) {
  const unmet = needs.filter((need) => need.ok === false).map((need) => need.label.toLowerCase());
  if (unmet.length) return { tone: 'warn', text: `Not met yet, marked !: ${unmet.join(', ')}. Build for them, or give the ship's parts below. Then tap Next day.` };
  return { tone: 'info', text: 'Every need is met. Tap Next day, or fly out to a place nearby.' };
}

// The colony's citizens, for its needs (M38f): how many and the beds they
// take, then the days to the next, or why none comes: "2 in 2 beds · the
// next in 3 days". Not ok only on a day that will go hungry, when one
// leaves.
function citizensRow(stats, day, rules) {
  const { count, housed } = stats.citizens;
  const plan = day.ok ? day.citizens : null;
  const why = plan?.why ?? null;
  const left = Math.max(1, (rules.balance.citizenDays ?? 0) - (plan?.growth[0] ?? 0));
  const next = why === null ? `the ${count ? 'next' : 'first'} in ${left} day${left === 1 ? '' : 's'}`
    : why === 'hungry' ? (count ? 'short of food: one leaves tonight' : 'none comes while food is short')
    : why === 'room' ? 'none comes: no bed and air free'
    : why === 'dark' ? 'none comes while a building is dark'
    : 'none comes with nobody there';
  const now = count ? `${count} in ${housed} bed${housed === 1 ? '' : 's'}` : 'None';
  return { label: 'Citizens', value: `${now} · ${next}`, ok: why !== 'hungry' || !count };
}

// The ship's parts, as rows: see colonyText. Those that can be given are a
// row a kind, with their count; those that can't, a row a reason, naming
// every kind it holds back.
function partRows(campaign, rules) {
  const rows = new Map();
  for (const part of shipParts(campaign, rules)) {
    const key = part.ok ? `give|${part.type}` : `keep|${part.error}`;
    const row = rows.get(key) ?? { uid: part.uid, uids: [], kinds: new Map(), ok: part.ok, building: part.ok ? part.building.name : null, gives: part.ok ? givesText(part.gives) : null, why: part.ok ? null : part.error };
    row.uids.push(part.uid);
    const name = rules.modules.get(part.type)?.name ?? part.type;
    row.kinds.set(name, (row.kinds.get(name) ?? 0) + 1);
    rows.set(key, row);
  }
  const all = [...rows.values()].map(({ kinds, ...row }) => ({
    ...row,
    type: row.ok ? campaign.ship.modules.find((m) => m.uid === row.uid).type : null,
    name: [...kinds].map(([name, n]) => (n > 1 && !row.ok ? `${name} ×${n}` : name)).join(', '),
    count: row.ok ? row.uids.length : null,
  }));
  return [...all.filter((row) => row.ok), ...all.filter((row) => !row.ok)];
}

// The hold's spare parts, as rows (colonyBuild.js buildList's): those that
// can be set down a row a kind, with their count and what they would give;
// the rest a row a reason, naming every kind it holds back.
function holdRows(hold, rules) {
  const ready = hold.filter((row) => row.ok).map((row) => ({ what: row.what, type: row.type, name: partName(row.type, rules), count: row.count, ok: true, building: row.name, gives: givesText(row.gives), why: null }));
  const reasons = new Map();
  for (const row of hold.filter((r) => !r.ok)) {
    const named = `${partName(row.type, rules)}${row.count > 1 ? ` ×${row.count}` : ''}`;
    reasons.set(row.error, [...(reasons.get(row.error) ?? []), named]);
  }
  const refused = [...reasons].map(([why, names]) => ({ what: null, type: null, name: names.join(', '), count: null, ok: false, building: null, gives: null, why }));
  return [...ready, ...refused];
}

function partName(type, rules) {
  return rules.modules.get(type)?.name ?? type;
}

// What a building gives, from colony.js givesOf: "Beds 4 · power −1".
export function givesText(gives) {
  const said = [];
  if (gives.power > 0) said.push(`power +${gives.power}`);
  if (gives.beds) said.push(`beds ${gives.beds}`);
  if (gives.air) said.push(`air ${gives.air}`);
  if (gives.storage) said.push(`stores ${gives.storage}`);
  if (gives.heal) said.push(`heals ${gives.heal}`);
  if (gives.damage) said.push(`guns ${gives.damage}`);
  if (gives.shield) said.push(`shield ${gives.shield}`);
  if (gives.intercept) said.push(`flak ${gives.intercept}`);
  if (gives.armory) said.push('arms the crew');
  if (gives.power < 0) said.push(`power −${-gives.power}`);
  const text = said.join(' · ') || 'nothing yet';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What a farm or a mine makes a day (colony.js colonyStats makes): "Food
// +3 a day".
export function makesText(makes) {
  const [what, n] = Object.entries(makes)[0];
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} +${n} a day`;
}

// What a tap on a row that can't be built says: { text, tone }. verb:
// 'given' (the ship's parts), 'set down' (the hold's) or 'built'.
export function whyNotText(row, verb) {
  return { text: `${row.name}: can't be ${verb}. ${row.why}`, tone: 'warn' };
}

// What a ghost on the grid says (colonyBuild.js buildPlan's or movePlan's
// plan): where it is and what the second tap does, or why it can't stand
// there. moving: true for a building being moved.
//   { ok, text, tone }
// near (M54, neighbourText.js ghostNearText): what it would gain and give
// by its neighbours there, after what it does.
export function placeText(plan, { moving = false, near = '' } = {}) {
  if (!plan.ok) return { ok: false, text: `${plan.error} Tap the grid where it can go.`, tone: 'warn' };
  const name = plan.name;
  const after = 'or tap the grid to put it somewhere else.';
  if (moving) return { ok: true, text: `The ${lowerFirst(name)} here${near ? `.${near} Tap` : ': tap'} it again to move it, ${after}`, tone: 'info' };
  if (plan.from === 'build') return { ok: true, text: `A ${lowerFirst(name)} here, for ${plan.cost} materials: ${lowerFirst(plan.makes ? makesText(plan.makes) : givesText(plan.gives))}.${near} Tap it again to build it, ${after}`, tone: 'info' };
  if (plan.from === 'hold') return { ok: true, text: `The ${lowerFirst(name)} here, from the hold: ${lowerFirst(givesText(plan.gives))}.${near} Tap it again to set it down, ${after}`, tone: 'info' };
  return { ok: true, text: `The ${lowerFirst(name)} here: ${lowerFirst(givesText(plan.gives))}.${near} It comes off the ship. Tap it again to give it, ${after}`, tone: 'info' };
}

// What a tap on a row that can't be given says, and (M26) what a first tap
// on one that can would: { ok, ask, text, tone }.
export function giveText(row) {
  if (!row.ok) return { ok: false, ask: null, ...whyNotText(row, 'given') };
  return { ok: true, ask: 'Give?', text: `${row.name} becomes the colony's ${row.building}: ${lowerFirst(row.gives)}. It comes off the ship. Tap again to give it.`, tone: 'info' };
}

// What giving a part came to (colony.js donate's result).
export function givenText(result, rules) {
  const name = buildingOf(result.plan.type, rules)?.name ?? result.plan.type;
  return { text: `The ${lowerFirst(name)} stands at the colony: ${lowerFirst(givesText(result.plan.gives))}.`, tone: 'good' };
}

// What building came to (colonyBuild.js build's result): { text, tone }.
// With rules, what its neighbours give it too (M54).
export function builtText(result, rules = null) {
  const { plan, campaign } = result;
  const stats = rules ? colonyStats(campaign, rules) : null;
  const near = stats?.buildings.at(-1)?.near?.length ? `, ${nearLine(stats.buildings.at(-1), namesOf(stats))}` : '';
  const does = `${lowerFirst(plan.makes ? makesText(plan.makes) : givesText(plan.gives))}${near}`;
  const what = plan.from === 'build' ? `${does}. ${campaign.colony.materials} materials left` : does;
  return { text: `The ${lowerFirst(plan.name)} stands at the colony: ${what}.`, tone: 'good' };
}

// What a building being looked at says: its name and what it gives or
// makes, or that it is dark. building: colonyText's row.
export function buildingInfo(building) {
  return { text: `${building.name}: ${lowerFirst(building.gives)}. Move or turn it, or take it down.`, tone: building.powered ? 'info' : 'warn' };
}

// What a first tap on Take down says (colonyBuild.js takeDownPlan's plan):
// what comes back and what goes dark, and the second tap's ask.
export function takeDownText(plan) {
  const name = lowerFirst(plan.name);
  let back = 'Its part goes back into the hold.';
  if (plan.back.materials !== undefined) {
    const kept = plan.back.kept < plan.back.materials ? `, and the stores take ${plan.back.kept}` : '';
    back = `Its ${plan.back.materials} materials come back${kept}.`;
  }
  const dark = plan.darkens.length ? ` The ${listOf(plan.darkens.map(lowerFirst))} ${plan.darkens.length === 1 ? 'goes' : 'go'} dark.` : '';
  return { text: `Take the ${name} down? ${back}${dark} Tap again to take it down.`, tone: plan.darkens.length ? 'warn' : 'info' };
}

// What taking a building down came to (colonyBuild.js takeDown's result).
export function takenText(result) {
  const { plan } = result;
  const back = plan.back.materials !== undefined ? `${plan.back.kept} materials back` : 'its part is in the hold';
  return { text: `The ${lowerFirst(plan.name)} came down: ${back}.`, tone: 'good' };
}

// What a first tap on Next day says (days.js dayPlan's plan): what the day
// will bring, the odds of the pursuer finding the colony at its end (M29),
// and the second tap's ask.
export function dayText(plan, eased = null) {
  if (!plan.ok) return { text: plan.error, tone: 'warn' };
  const made = madeText(plan.made, 'grow', 'dig');
  const n = plan.citizens?.now ?? 0;
  const who = eaters(plan);
  const eat = !n
    ? plan.fed ? `the crew eats ${plan.eats} and rests` : `the crew needs ${plan.eats} and goes hungry, losing ${plan.hunger} hit points each`
    : plan.fed ? `${who} eat ${plan.eats}, and the crew rests` : `${who} need ${plan.eats} and go hungry, the crew losing ${plan.hunger} hit points each`;
  const lost = lostText(plan.lost, 'will be lost');
  const found = plan.found ? ` ${plan.found}% the colony is found tonight${eased ? `, ${eased}` : ''}.` : '';
  return { text: `Day ${plan.day} ends: ${made}; ${eat}. Food ${plan.food[0]} → ${plan.food[1]}, materials ${plan.materials[0]} → ${plan.materials[1]}.${lost}${citizensSaid(plan, 'comes', 'leaves')}${found} Tap again for day ${plan.day + 1}.`, tone: plan.fed ? 'info' : 'warn' };
}

// Who eats at the colony (M38f): "the crew", or "the crew and 2 citizens".
function eaters(plan) {
  const n = plan.citizens?.now ?? 0;
  return n ? `the crew and ${n} citizen${n === 1 ? '' : 's'}` : 'the crew';
}

// A citizen coming or leaving at the day's end (M38f): " A citizen
// comes: 3 then.", or ''.
function citizensSaid(plan, comes, leaves) {
  const citizens = plan.citizens;
  if (!citizens || citizens.after === citizens.now) return '';
  const then = comes === 'comes' ? 'then' : 'now';
  return citizens.after > citizens.now ? ` A citizen ${comes}: ${citizens.after} ${then}.` : ` Short of food, a citizen ${leaves}: ${citizens.after} ${then}.`;
}

// What passing the day came to (days.js nextDay's result): the day's
// report, and (M29) the raid's: if the pursuer found the colony, its
// words, the roll against the odds and the lander's days; while one is
// coming, its days; and on the day it lands, the raid's hint, Defend.
export function dayReport(result, rules) {
  const { plan } = result;
  const made = madeText(plan.made, 'grew', 'dug');
  const who = eaters(plan);
  const rested = plan.citizens?.now ? ', and the crew rested' : ' and rested';
  let eat = `${who} ate ${plan.eats}${rested}${result.healed ? `, healing ${result.healed} hit points` : ''}`;
  if (!plan.fed) eat = `short of food, ${who} went hungry${result.hurt ? `: ${result.hurt} hit points lost` : ''}${result.healed ? `, ${result.healed} healed` : ''}`;
  const lost = lostText(plan.lost, 'lost');
  const text = `Day ${plan.day + 1}. ${made.charAt(0).toUpperCase()}${made.slice(1)}; ${eat}. Food ${plan.food[1]}, materials ${plan.materials[1]}.${lost}${citizensSaid(plan, 'came', 'left')}`;
  const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
  const tone = plan.fed ? 'good' : 'bad';
  if (result.found?.reckoning) {
    // The leader comes (M56): no roll for it.
    const words = reckoningOf(result.campaign, rules)?.found;
    return { text: `${text}${words ? ` ${words}` : ''} The lander comes down in ${days(result.found.lands - (plan.day + 1))}.`, tone: 'bad' };
  }
  if (result.found) {
    const words = colonyPursuer(result.campaign, rules)?.found;
    return { text: `${text}${words ? ` ${words}` : ''} Rolled ${result.roll}, under the ${plan.found}%: the lander comes down in ${days(result.found.lands - (plan.day + 1))}.`, tone: 'bad' };
  }
  const left = rules ? raidIn(result.campaign) : null;
  if (left === 0) return { text: `${text} ${raidHint(result.campaign, rules).text}`, tone: 'bad' };
  if (left) return { text: `${text} The lander comes down in ${days(left)}.`, tone: plan.fed ? 'warn' : 'bad' };
  return { text, tone };
}

// "the farms grow 4 food and the mines dig 2 materials", or "nothing
// grows" without either.
function madeText(made, grow, dig) {
  const said = [];
  if (made.food) said.push(`the farms ${grow} ${made.food} food`);
  if (made.materials) said.push(`the mines ${dig} ${made.materials} materials`);
  return said.join(' and ') || `nothing ${grow === 'grow' ? 'grows' : 'grew'}`;
}

// " The stores are full: 3 food will be lost." or ''.
function lostText(lost, verb) {
  const said = [];
  if (lost.food) said.push(`${lost.food} food`);
  if (lost.materials) said.push(`${lost.materials} materials`);
  return said.length ? ` The stores are full: ${said.join(' and ')} ${verb}.` : '';
}

// "a, b and c".
function listOf(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

