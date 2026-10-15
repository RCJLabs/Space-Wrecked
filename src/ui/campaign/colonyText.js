// Text for the colony (src/sim/colony.js, M26; days and building by hand,
// M27): what act 3's home shows. rules are the content tables
// (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { buildingOf, colonyStats, shipParts, storesOf } from '../../sim/colony.js';
import { buildList } from '../../sim/colonyBuild.js';
import { dayPlan, planDay } from '../../sim/days.js';
import { actTitle, crewText } from './hubText.js';
import { runRecord } from './launchText.js';
import { worldSaid } from './sectorText.js';

// What the colony screen shows:
//   act, home   "Act 3 · The colony", "Greenhaven · Ice world · Day 4",
//               and "· the ship away" while it is out on a trip (M28)
//   day         the colony's day
//   needs       [{ label, value, ok }]: power, then beds and air against
//               the crew at home and who sleeps aboard (while the ship is
//               away, who goes without, and who is away); food and
//               materials against the stores, with what a day makes and
//               eats; defenses and the infirmary once the colony has any.
//               ok is false for a need short (for food, a day that would
//               go hungry).
//   power       how the power is made: "1 from its plants, 3 the ship's"
//   stores      what the stores keep of each: "30 each, in the landed
//               ship's holds"
//   buildings   [{ uid, name, gives, powered }] in the order built: what
//               each gives or makes, or that it is dark and what it needs
//   crew        crewText's rows (hubText.js), each with aboard: true for
//               whoever sleeps aboard the landed ship, and (M28) away: true
//               for the squad on a trip, rough: true for whoever is home
//               without a bed and air while the ship is away
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
    { label: 'Food', value: `${campaign.supplies} of ${stores.total} · +${stats.made.food}, eats ${eats}`, ok: day.ok ? day.fed : true },
    { label: 'Materials', value: `${materials} of ${stores.total} · +${stats.made.materials} a day`, ok: true },
  ];
  const guard = defenseText(stats.defense);
  if (guard) needs.push({ label: 'Defense', value: guard, ok: true });
  if (stats.infirmary) needs.push({ label: 'Infirmary', value: `Heals ${stats.infirmary}`, ok: true });
  const list = buildList(campaign, rules);
  return {
    act: actTitle(campaign.act, rules),
    home: `${world.name} · ${kind} · Day ${campaign.colony.day}${trip ? ' · the ship away' : ''}`,
    day: campaign.colony.day,
    needs,
    power: trip ? `${stats.power.plants} from power plants; the ship is away` : `${stats.power.plants} from power plants, ${stats.power.ship} spare from the landed ship`,
    stores: `${stores.total} each, ${stores.colony ? `${stores.ship} in the ${trip ? '' : 'landed '}ship's holds and ${stores.colony} in storehouses` : `in the ${trip ? '' : 'landed '}ship's holds`}`,
    buildings: stats.buildings.map((b) => ({
      uid: b.uid,
      name: b.name,
      gives: !b.powered ? `Dark: needs ${b.need} power` : b.makes ? makesText(b.makes) : givesText(b.gives),
      powered: b.powered,
    })),
    crew: crew.map((row, i) => ({ ...row, aboard: aboard.has(campaign.crew[i].id), away: away.has(campaign.crew[i].id), rough: rough.has(campaign.crew[i].id) })),
    builds: list.builds.map((row) => ({ what: row.what, id: row.id, name: row.name, cost: row.cost, makes: row.makes ? `${makesText(row.makes)} here` : givesText(row.gives), ok: row.ok, why: row.error })),
    hold: holdRows(list.hold, rules),
    parts: partRows(campaign, rules),
    world: { title: `${world.name} · ${kind}`, lines: [...worldSaid(world, rules, true), ...(world.surveyed ? [] : ['Settled without a survey: these are what the landing found.'])] },
    record: { title: actTitle(campaign.act - 1, rules), lines: runRecord(campaign, rules) },
    ahead: actOf(campaign, rules)?.ahead ?? '',
    text: rules.colony?.text ?? '',
  };
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

// "Guns 15 · shield 10 · 1 armory", or '' with no defenses.
function defenseText({ damage, shield, intercept, armories }) {
  const said = [];
  if (damage) said.push(`guns ${damage}`);
  if (shield) said.push(`shield ${shield}`);
  if (intercept) said.push(`flak ${intercept}`);
  if (armories) said.push(`${armories} arm${armories === 1 ? 'ory' : 'ories'}`);
  const text = said.join(' · ');
  return text && `${text.charAt(0).toUpperCase()}${text.slice(1)}, for raids to come`;
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
export function placeText(plan, { moving = false } = {}) {
  if (!plan.ok) return { ok: false, text: `${plan.error} Tap the grid where it can go.`, tone: 'warn' };
  const name = plan.name;
  const after = 'or tap the grid to put it somewhere else.';
  if (moving) return { ok: true, text: `The ${lowerFirst(name)} here: tap it again to move it, ${after}`, tone: 'info' };
  if (plan.from === 'build') return { ok: true, text: `A ${lowerFirst(name)} here, for ${plan.cost} materials: ${lowerFirst(plan.makes ? makesText(plan.makes) : givesText(plan.gives))}. Tap it again to build it, ${after}`, tone: 'info' };
  if (plan.from === 'hold') return { ok: true, text: `The ${lowerFirst(name)} here, from the hold: ${lowerFirst(givesText(plan.gives))}. Tap it again to set it down, ${after}`, tone: 'info' };
  return { ok: true, text: `The ${lowerFirst(name)} here: ${lowerFirst(givesText(plan.gives))}. It comes off the ship. Tap it again to give it, ${after}`, tone: 'info' };
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
export function builtText(result) {
  const { plan, campaign } = result;
  const does = lowerFirst(plan.makes ? makesText(plan.makes) : givesText(plan.gives));
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
// will bring, and the second tap's ask.
export function dayText(plan) {
  if (!plan.ok) return { text: plan.error, tone: 'warn' };
  const made = madeText(plan.made, 'grow', 'dig');
  const eat = plan.fed ? `the crew eats ${plan.eats} and rests` : `the crew needs ${plan.eats} and goes hungry, losing ${plan.hunger} hit points each`;
  const lost = lostText(plan.lost, 'will be lost');
  return { text: `Day ${plan.day} ends: ${made}; ${eat}. Food ${plan.food[0]} → ${plan.food[1]}, materials ${plan.materials[0]} → ${plan.materials[1]}.${lost} Tap again for day ${plan.day + 1}.`, tone: plan.fed ? 'info' : 'warn' };
}

// What passing the day came to (days.js nextDay's result): the day's
// report.
export function dayReport(result) {
  const { plan } = result;
  const made = madeText(plan.made, 'grew', 'dug');
  let eat = `the crew ate ${plan.eats} and rested${result.healed ? `, healing ${result.healed} hit points` : ''}`;
  if (!plan.fed) eat = `short of food, the crew went hungry${result.hurt ? `: ${result.hurt} hit points lost` : ''}${result.healed ? `, ${result.healed} healed` : ''}`;
  const lost = lostText(plan.lost, 'lost');
  return { text: `Day ${plan.day + 1}. ${made.charAt(0).toUpperCase()}${made.slice(1)}; ${eat}. Food ${plan.food[1]}, materials ${plan.materials[1]}.${lost}`, tone: plan.fed ? 'good' : 'bad' };
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

