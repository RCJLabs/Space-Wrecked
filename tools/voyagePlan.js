// How the test voyage's player (tools/voyage.js) judges things: an event's
// choices, what a node is worth passing through, and the way on to a
// sector's jump point. What things are worth to it, in credits (WORTH):
//   supply   2: out here, supplies are dearer than at a station
//   short    6 a supply while the holds hold less than BUFFER_JUMPS jumps'
//            worth: a hungry jump costs the whole crew hit points
//   hp       2: wounds heal only at stations (patch.js) or with a med bay
//   heat     0.3 a point: what it costs is the hunters (M24), which the
//            managing player keeps off by its lines below, not by price
//   nebula   15 for a nebula on the way while the managing player hides
//            (HIDE_FROM): a day there sheds hideHeat
//   hot      1.5 a point of heat, for the managing player from HIDE_FROM:
//            what keeping under the hunters is worth
//   hunted   −40 for an event's outcome that takes heat to the hunters'
//            level, for the managing player
//   part     half what the shop pays for it: it has to be sold to be spent
//   hostile  −30 for a hostile ship ahead: tools/approach.js has the start
//            ship boarded by about one in five, which is a fight the crew
//            loses about half the time (tools/sim.js --boardings), and loses
//            the dearest part on hand or half the credits; and wounds and
//            repairs after
// A choice is worth what its outcomes are, each at its chance. A node
// whose kind is known is worth its event's best choice until settled, or a
// hostile ship's worth until met; one still unknown, what the mix's kinds
// are worth on average. It boards a ship it has disabled only with the crew
// fit to (boardIt), and otherwise leaves her. It signs a recruit on (hireWho)
// where there is room, the fee is left beyond a holdful's price, and the
// holds would still last HIRE_JUMPS jumps with the recruit aboard: what the
// lockers alone last the start crew (30 supplies, 3 aboard). On the lockers
// alone a fourth mouth leaves 7 jumps, and a station is sometimes further
// off than that, past a sector's jump point, where no plan can see.
// At a station it refits (refitAt, M23h): every part on hand that feeds,
// heals, houses, guards, arms or drives the ship goes on, in that order,
// where it touches most of the ship, each kept only while every flight
// check still passes; a part the power doesn't stretch to takes a reactor
// on hand with it. Never corridors, airlocks, armories or a second bridge,
// and no healer that heals no more than one aboard.
// Heat (M24), by its policy. Managing it, the player makes long jumps from
// LONG_FROM, and in place of any jump that would come out where the
// hunters may wait; swaps the transponder at a station from SWAP_FROM
// where the credits cover it beyond half a holdful's price; hides in a
// nebula on its way from HIDE_FROM while the holds keep HIDE_JUMPS jumps'
// worth; weighs an event's heat at WORTH.hot; scans only below LONG_FROM;
// and never regroups, since a day's rest costs more heat than it heals.
// Ignoring heat, none of these: it regroups away from stations when the
// crew is down REST_HP hit points each on average and the holds keep
// REST_JUMPS jumps' worth, and weighs heat at nothing. A managed long jump
// sheds heat worth WORTH.hot a point; Evan settled the trade in M24
// (2026-10-14): the managing player meets the hunters in at most 6 runs of
// 30, fed in 24.
// In the system past the charts (M25), it scores each world as a colony
// (worldScore): soil, water and ore a point each, a point for each step
// further from Con-Reg's lanes, where the pursuer's ships pass, and danger a
// point against; a world not surveyed, what its kind's ranges give on
// average. It surveys while its supplies allow (systemMove): the nearest
// world not yet surveyed, while the supplies cover the jumps there, the
// day, and the way from there to the best world it knows of, so a survey
// never leaves it hungry or out of reach of that world. Then it settles the
// best world its supplies reach (bestWorld).
// At the colony (M26) it gives the ship's parts one at a time (nextGift):
// a part that beds or breathes for the crew first, while any can go, then
// the rest, each in the ship's order, until the flight checks let no more
// go. Then (M27), before each day, it builds what its crew's food needs
// (nextBuild): the farms that feed the crew, what they eat a day over
// what a farm grows there, each as soon as the materials allow; while it
// can't yet pay for them all, a mine first whenever the mine would pay for
// them sooner, its own cost counted. Each goes in the first spot that
// fits. Once its farms feed the crew it builds nothing more.
// Then (M28) it flies trips from the colony. Its squad (tripSquad) is the
// healthiest up to squadSize of those healed to FIT_SHARE of their most;
// with none fit, it rests. Before it flies, it refits the ship for the
// squad (refitForSquad): while the flight checks with them aboard fail for
// berths, air or power, it takes down the building that gives most of what is
// short and fits its part back aboard where it touches most of the ship;
// a squad the ship still can't carry shrinks to what it can. Whoever stays
// home gets a shelter, with a solar array to run it while the ship is away,
// as far as the materials go (homeBuild). It flies to the place worth most
// (nextPlace): a derelict the scavengers hold only with a full squad at
// full health, else the nearest place, never one its food doesn't cover
// or that would come home past the days it plays. At an event it makes the
// choice worth most (placeChoice): materials and food a point each, as far
// as the stores take them, a part PLACE_PART, a wound PLACE_HP a hit point.
// From M29, while a raid is coming it stays home and sets down from the
// hold what will help when the lander comes (raidPrep): guns that fire at
// it, then a shield and an armory for the defenders, each only where it
// would stand powered.
import { canRefit, maxHp, refitShip, shipChecklist } from '../src/sim/campaign.js';
import { buildingOf, colonyStats, givesOf, shipParts, storesOf, yieldOf } from '../src/sim/colony.js';
import { build, buildPlan, takeDown } from '../src/sim/colonyBuild.js';
import { crewRoom } from '../src/sim/crew.js';
import { sellPriceOf } from '../src/sim/economy.js';
import { choiceProblem } from '../src/sim/events.js';
import { tripPlan } from '../src/sim/expeditions.js';
import { LANES } from '../src/sim/gen/system.js';
import { withHeat } from '../src/sim/heat.js';
import { huntOdds } from '../src/sim/hunt.js';
import { recruitOffer } from '../src/sim/recruits.js';
import { regroupPlan } from '../src/sim/regroup.js';
import { swapPlan } from '../src/sim/transponder.js';
import { failingCheck, jumpSupplies, knownNodes, leavePlan, linked, reach, supplyCapacity, within } from '../src/sim/travel.js';
import { fitPart } from './run.js';

export const WORTH = { supply: 2, short: 6, hp: 2, heat: 0.3, part: 0.5, hostile: -30, nebula: 15, hot: 1.5, hunted: -40 };
const BUFFER_JUMPS = 4;
export const HIRE_JUMPS = 10;
// How the test player treats heat (M24), and the managing player's lines.
export const HEAT_POLICIES = ['manage', 'ignore'];
export const LONG_FROM = 45;
export const SWAP_FROM = 15;
export const HIDE_FROM = 15;
const REST_HP = 3;
// A day's rest is taken only with this many jumps' supplies left after it,
// and a day hidden with HIDE_JUMPS'.
const REST_JUMPS = 4;
const HIDE_JUMPS = 8;

// Whether to board a ship the player has disabled: with at least half the
// crew's hit points between them; a crew worn down leaves her.
export function boardIt(campaign, rules) {
  const most = campaign.crew.reduce((sum, member) => sum + maxHp(member, rules), 0);
  const now = campaign.crew.reduce((sum, member) => sum + member.hp, 0);
  return now * 2 >= most;
}

// The recruit to sign on where the ship is, by slot, or null: with room
// aboard and the holds lasting HIRE_JUMPS jumps with one more, of those
// whose fee leaves a holdful's price, the one whose job the crew has fewest
// of, the most hit points then the first slot breaking ties.
export function hireWho(campaign, rules) {
  if (campaign.crew.length >= crewRoom(campaign.ship, rules)) return null;
  if (supplyCapacity(campaign.ship, rules, campaign.crew) < HIRE_JUMPS * rules.balance.jumpSupplies * (campaign.crew.length + 1)) return null;
  const reserve = supplyCapacity(campaign.ship, rules, campaign.crew) * rules.balance.supplyPrice;
  const offer = recruitOffer(campaign, rules).filter((recruit) => campaign.credits - recruit.fee >= reserve);
  if (!offer.length) return null;
  const count = (job) => campaign.crew.filter((member) => member.job === job).length;
  return [...offer].sort((a, b) => count(a.job) - count(b.job) || b.hp - a.hp || a.slot - b.slot)[0].slot;
}

// The kinds of part the test player fits at a station, in the order it
// fits them (data/modules.json categories).
export const FIT_ORDER = ['cargo', 'crew', 'defense', 'weapons', 'engines'];

// The parts on hand the test player would fit, in order: by FIT_ORDER, the
// dearest first in each, one entry for each part.
export function refitPicks(campaign, rules) {
  const healer = Math.max(0, ...campaign.ship.modules.map((module) => rules.modules.get(module.type)?.heal ?? 0));
  return Object.entries(campaign.parts)
    .filter(([type]) => FIT_ORDER.includes(rules.modules.get(type)?.category))
    .filter(([type]) => !rules.modules.get(type).heal || rules.modules.get(type).heal > healer)
    .sort(([a], [b]) => FIT_ORDER.indexOf(rules.modules.get(a).category) - FIT_ORDER.indexOf(rules.modules.get(b).category) || rules.modules.get(b).cost - rules.modules.get(a).cost || a.localeCompare(b))
    .flatMap(([type, count]) => Array(count).fill(type));
}

// The careful player's refit where the ship is: { campaign, parts (the
// types fitted, in order) }. Away from a station, nothing. tried: a Map of
// type -> the ship a part of that type last wouldn't go on, so a ship that
// hasn't changed isn't tried again (fitPart tries every cell).
export function refitAt(campaign, rules, tried = new Map()) {
  if (!canRefit(campaign, rules)) return { campaign, parts: [] };
  let now = campaign;
  const parts = [];
  for (const type of refitPicks(campaign, rules)) {
    if (!now.parts[type] || tried.get(type) === now.ship) continue;
    const next = fitted(now, rules, type);
    if (!next) {
      tried.set(type, now.ship);
      continue;
    }
    parts.push(...next.parts);
    now = next.campaign;
  }
  return { campaign: now, parts };
}

// The campaign with a part of `type` fitted, and a reactor on hand with it
// if the power is short: { campaign, parts }, or null if it can't go on
// with every flight check passing.
function fitted(campaign, rules, type) {
  const one = fitOne(campaign, rules, type);
  if (!one) return null;
  const check = failingCheck(one, rules);
  if (!check) return { campaign: one, parts: [type] };
  if (check.id !== 'power') return null;
  const reactor = Object.keys(one.parts).filter((t) => rules.modules.get(t)?.stats.power > 0).sort((a, b) => rules.modules.get(a).stats.mass - rules.modules.get(b).stats.mass || a.localeCompare(b))[0];
  const powered = reactor && fitOne(one, rules, reactor);
  return powered && !failingCheck(powered, rules) ? { campaign: powered, parts: [type, reactor] } : null;
}

// The campaign with one part of `type` fitted where it touches most of the
// ship (tools/run.js fitPart), or null if it fits nowhere.
function fitOne(campaign, rules, type) {
  const placed = fitPart(campaign.ship, rules, type);
  const next = placed && refitShip(campaign, placed.ship, rules);
  return next && next !== campaign ? next : null;
}

// What a change in supplies is worth: the part of it below the buffer at
// WORTH.short each, the rest at WORTH.supply; gains only as far as the
// holds take.
function suppliesWorth(campaign, rules, change) {
  const buffer = BUFFER_JUMPS * jumpSupplies(campaign, rules);
  const from = campaign.supplies;
  const to = Math.max(0, Math.min(supplyCapacity(campaign.ship, rules, campaign.crew), from + change));
  const [low, high] = to > from ? [from, to] : [to, from];
  const short = Math.max(0, Math.min(high, buffer) - Math.min(low, buffer));
  const worth = short * WORTH.short + (high - low - short) * WORTH.supply;
  return to > from ? worth : -worth;
}

// What a point of heat is worth to the player: nothing ignoring it;
// managing it, WORTH.hot from HIDE_FROM, where it starts to tell, and
// WORTH.heat below.
export function heatWorth(campaign, heat = 'manage') {
  if (heat === 'ignore') return 0;
  return campaign.heat >= HIDE_FROM ? WORTH.hot : WORTH.heat;
}

// What an outcome's effects are worth to the player, in credits, for the
// campaign as it stands.
export function effectsWorth(campaign, rules, effects, heat = 'manage') {
  let worth = effects.credits ?? 0;
  if (effects.supplies) worth += suppliesWorth(campaign, rules, effects.supplies);
  worth -= heatWorth(campaign, heat) * (effects.heat ?? 0);
  const { huntHeat } = rules.balance;
  if (heat === 'manage' && campaign.heat < huntHeat && campaign.heat + (effects.heat ?? 0) >= huntHeat) worth += WORTH.hunted;
  if (effects.wound) worth -= WORTH.hp * effects.wound.hp * (effects.wound.all ? campaign.crew.length : 1);
  if (effects.part) worth += WORTH.part * (sellPriceOf(effects.part, rules) ?? 0);
  if (effects.drop) worth += WORTH.part * dropWorth(rules, effects.drop);
  // A sale turns a part, worth half its price held, into its price.
  if (effects.sell) worth += (1 - WORTH.part) * dearest(campaign, rules, effects.sell);
  return worth;
}

// What the shop pays, on average, for a part from a drop table.
function dropWorth(rules, table) {
  const entries = Object.entries(rules.eventDrops[table] ?? {});
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return total ? entries.reduce((sum, [part, weight]) => sum + weight * (sellPriceOf(part, rules) ?? 0), 0) / total : 0;
}

// What the shop pays for the `count` dearest parts on hand.
function dearest(campaign, rules, count) {
  const prices = Object.entries(campaign.parts).flatMap(([part, n]) => Array(n).fill(sellPriceOf(part, rules) ?? 0));
  return prices.sort((a, b) => b - a).slice(0, count).reduce((sum, price) => sum + price, 0);
}

// The choice the player makes at an event: { choice, worth }, the one worth
// most of those it can make.
export function bestChoice(campaign, rules, event, heat = 'manage') {
  let best = null;
  for (const choice of event.choices) {
    if (choiceProblem(campaign, choice)) continue;
    const worth = choice.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * effectsWorth(campaign, rules, outcome.effects, heat), 0);
    if (!best || worth > best.worth) best = { choice, worth };
  }
  return best;
}

// What an unknown node is worth on average: the mix's kinds by weight, each
// its events' best choices on average, or a hostile ship's worth.
function unknownWorth(campaign, rules, heat) {
  const mix = Object.entries(rules.sectors.mix);
  const total = mix.reduce((sum, [, weight]) => sum + weight, 0);
  let worth = 0;
  for (const [kind, weight] of mix) {
    if (rules.nodeTypes.get(kind)?.ships) {
      worth += (weight / total) * WORTH.hostile;
      continue;
    }
    const events = [...rules.events.values()].filter((event) => event.kind === kind);
    if (!events.length) continue;
    const each = events.reduce((sum, event) => sum + (bestChoice(campaign, rules, event, heat)?.worth ?? 0), 0) / events.length;
    worth += (weight / total) * each;
  }
  return worth;
}

// The ways on from node `id` to the sector's jump point, a link at a time:
// lists of nodes, `id` first.
function waysOn(sector, id) {
  if (id === sector.exit) return [[id]];
  const { col } = sector.nodes[id];
  return linked(sector, id)
    .filter((next) => sector.nodes[next].col > col)
    .flatMap((next) => waysOn(sector, next).map((way) => [id, ...way]));
}

// What the holds take at a station, as far as the credits go.
export function fill(supplies, credits, room, price) {
  return Math.max(0, Math.min(room - supplies, Math.floor(credits / price)));
}

// How a way on goes from what the ship carries: { hungry (jumps), value }:
// what is left out of the sector (supplies at their worth, and credits),
// and what the nodes passed are worth. The jump out of the sector counts
// too, unless it is the act's last.
function wayCost(campaign, rules, way, { supplies, credits }, judge) {
  const { sector } = campaign.run;
  const price = rules.balance.supplyPrice;
  const room = supplyCapacity(campaign.ship, rules, campaign.crew);
  const each = jumpSupplies(campaign, rules);
  let hungry = 0;
  let worth = 0;
  const eat = () => {
    if (supplies < each) hungry += 1;
    supplies = Math.max(0, supplies - each);
  };
  for (const id of way.slice(1)) {
    eat();
    worth += judge(id);
    if (sector.nodes[id].type === 'station') {
      const bought = fill(supplies, credits, room, price);
      supplies += bought;
      credits -= bought * price;
    }
  }
  if (leavePlan({ ...campaign, run: { ...campaign.run, at: sector.exit } }, rules).ok) {
    eat();
    // Into the next sector with less than the buffer, where no plan can see
    // a station yet, is as good as hungry.
    if (supplies < BUFFER_JUMPS * each) hungry += 1;
  }
  return { hungry, value: WORTH.supply * supplies + credits + worth };
}

// Whether way a beats way b (or there is no b): hungry least, then worth
// most.
function better(a, b) {
  return !b || (a.hungry !== b.hungry ? a.hungry < b.hungry : a.value > b.value);
}

// What each node is worth passing through, for the campaign as it stands:
// a nebula, too, while the managing player would hide there.
function nodeJudge(campaign, rules, heat = 'manage') {
  const { run } = campaign;
  const known = knownNodes(run, rules);
  const guess = unknownWorth(campaign, rules, heat);
  const hiding = heat === 'manage' && campaign.heat >= HIDE_FROM;
  return (id) => {
    if (!known.has(id)) return guess;
    const node = run.sector.nodes[id];
    if (hiding && rules.nodeTypes.get(node.type)?.hides) return WORTH.nebula;
    if (run.done.includes(id)) return 0;
    if (node.hostile) return WORTH.hostile;
    const event = node.event ? rules.events.get(node.event) : null;
    return event ? (bestChoice(campaign, rules, event, heat)?.worth ?? 0) : 0;
  };
}

// The best way on from node `from` with what the ship carries there.
function bestWay(campaign, rules, from, carried, judge) {
  let best = null;
  for (const way of waysOn(campaign.run.sector, from)) {
    const cost = { ...wayCost(campaign, rules, way, carried, judge), way };
    if (better(cost, best)) best = cost;
  }
  return best;
}

// Where the player jumps next from where the ship is (not the jump point):
// a node id. With the 'heat' policy, when heat is at `from` or over (the
// managing player's LONG_FROM), a long jump on instead, if it leaves the
// holds above the buffer,
// the way on from there is forecast to go hungry not once, it is worth as
// much as the way it skips, counting the heat it sheds at its worth, and it
// doesn't pass the station the way calls at next while the holds have room.
// The forecast counts only the credits on hand, not what the nodes will
// pay: so a long jump goes over nodes that pay nothing, empty space or a
// hostile ship, not over those that pay. Managing heat, a jump that would
// come out where the hunters may wait is the one to skip: then a long jump
// that keeps the holds above the buffer and goes hungry not once is taken
// whatever it passes by.
export function nextJump(campaign, rules, policy, { heat = 'manage', from = LONG_FROM } = {}) {
  const { sector, at } = campaign.run;
  const judge = nodeJudge(campaign, rules, heat);
  const way = bestWay(campaign, rules, at, { supplies: campaign.supplies, credits: campaign.credits }, judge);
  if (policy !== 'heat' || campaign.heat < from) return way.way[1];
  if (sector.nodes[way.way[1]].type === 'station' && campaign.supplies < supplyCapacity(campaign.ship, rules, campaign.crew)) return way.way[1];
  const cost = jumpSupplies(campaign, rules, true);
  if (campaign.supplies - cost < BUFFER_JUMPS * jumpSupplies(campaign, rules)) return way.way[1];
  const price = rules.balance.supplyPrice;
  const room = supplyCapacity(campaign.ship, rules, campaign.crew);
  // What the heat a long jump sheds is worth, against the two jumps it
  // takes the place of.
  const shed = (heat === 'manage' ? WORTH.hot : WORTH.heat) * (2 * rules.balance.jumpHeat - rules.balance.longJumpHeat);
  // Hot: the jump comes out where the hunters may wait, or, to the jump
  // point, leaves the jump on out of the sector hot.
  const { jumpHeat } = rules.balance;
  const next = sector.nodes[way.way[1]];
  const out = next.id === sector.exit ? jumpHeat : 0;
  const hot = heat === 'manage' && (huntOdds(campaign, rules, withHeat(campaign.heat, jumpHeat), next.type).chance > 0 || (out > 0 && huntOdds(campaign, rules, withHeat(campaign.heat, jumpHeat + out), 'start').chance > 0));
  let long = null;
  for (const [to, links] of reach(sector, at)) {
    if (links !== 2 || sector.nodes[to].col !== sector.nodes[at].col + 2) continue;
    let supplies = campaign.supplies - cost;
    let { credits } = campaign;
    if (sector.nodes[to].type === 'station') {
      const bought = fill(supplies, credits, room, price);
      supplies += bought;
      credits -= bought * price;
    }
    const on = bestWay(campaign, rules, to, { supplies, credits }, judge);
    const there = { hungry: on.hungry, value: on.value + judge(to) + shed, to };
    if (there.hungry === 0 && (hot || there.value >= way.value) && better(there, long)) long = there;
  }
  return long ? long.to : way.way[1];
}

// Whether the managing player swaps the transponder where the ship is: at
// a station, heat at SWAP_FROM or more, and the credits covering it beyond
// half a holdful's price.
export function swapNow(campaign, rules, heat) {
  if (heat !== 'manage' || campaign.heat < SWAP_FROM) return false;
  const plan = swapPlan(campaign, rules);
  return plan.ok && campaign.credits - plan.price >= (supplyCapacity(campaign.ship, rules, campaign.crew) * rules.balance.supplyPrice) / 2;
}

// Whether the player scans where a scan would show something ahead:
// managing heat, not from LONG_FROM.
export function scanNow(campaign, rules, heat) {
  return heat !== 'manage' || campaign.heat + rules.balance.scanHeat < LONG_FROM;
}

// Whether to take a day where the ship is: { kind: 'hide' | 'regroup' } or
// null. Managing heat, it hides in a nebula from HIDE_FROM; either way it
// regroups when the crew is down REST_HP each on average, but managing
// heat, only while heat stays under huntHeat. Never below the buffer.
export function restNow(campaign, rules, heat) {
  const plan = regroupPlan(campaign, rules);
  if (!plan.ok) return null;
  if (campaign.supplies - plan.supplies < REST_JUMPS * jumpSupplies(campaign, rules)) return null;
  if (plan.kind === 'hide') return heat === 'manage' && campaign.heat >= HIDE_FROM && campaign.supplies - plan.supplies >= HIDE_JUMPS * jumpSupplies(campaign, rules) ? plan : null;
  // Managing heat, a day's rest costs more heat than it heals: patch up at
  // stations instead.
  if (heat === 'manage') return null;
  const missing = campaign.crew.reduce((sum, member) => sum + maxHp(member, rules) - member.hp, 0);
  return missing >= REST_HP * campaign.crew.length ? plan : null;
}

// The ship's part the player gives the colony next: one that gives beds
// or air, if any can go, else the first that can. A uid, or null once the
// flight checks (or the room) let no more go.
export function nextGift(campaign, rules) {
  const ready = shipParts(campaign, rules).filter((part) => part.ok);
  const housing = ready.find((part) => part.gives.beds > 0 || part.gives.air > 0);
  return (housing ?? ready[0])?.uid ?? null;
}

// What the player builds at the colony next, before the day passes (see
// the top of the file): { build: id }, a farm or a mine in the first spot
// that fits, or null to let the day pass.
export function nextBuild(campaign, rules) {
  const builds = [...rules.colony.builds.values()];
  const farm = builds.find((build) => build.makes === 'food');
  const mine = builds.find((build) => build.makes === 'materials');
  if (!farm) return null;
  const { world, materials, buildings } = campaign.colony;
  const count = (build) => buildings.filter((building) => building.type === build.id).length;
  const needed = Math.ceil(jumpSupplies(campaign, rules) / yieldOf(farm, world)) - count(farm);
  if (needed <= 0) return null;
  const can = (build) => buildPlan(campaign, rules, { build: build.id }).ok;
  const short = needed * farm.cost - materials;
  if (short > 0 && mine && can(mine)) {
    const income = count(mine) * yieldOf(mine, world);
    const days = income > 0 ? Math.ceil(short / income) : Infinity;
    const withMine = Math.ceil((short + mine.cost) / (income + yieldOf(mine, world)));
    if (withMine < days) return { build: mine.id };
  }
  return can(farm) ? { build: farm.id } : null;
}

// M28: the share of their most hit points a crew member is healed to
// before they fly; and what a part and a hit point are worth at a place's
// event, against a material or a food at 1.
export const FIT_SHARE = 0.75;
const PLACE_PART = 8;
const PLACE_HP = 2;

// Who flies on a trip now: the healthiest of those healed to FIT_SHARE of
// their most, up to squadSize, the crew's order breaking ties; their ids,
// in the crew's order. size: the most to take (the ship's room).
export function tripSquad(campaign, rules, size = rules.balance.squadSize) {
  const fit = campaign.crew.map((member, i) => ({ member, i })).filter(({ member }) => member.hp >= FIT_SHARE * maxHp(member, rules));
  const going = new Set(fit.sort((a, b) => b.member.hp - a.member.hp || a.i - b.i).slice(0, Math.min(size, rules.balance.squadSize)).map(({ member }) => member.id));
  return campaign.crew.filter((member) => going.has(member.id)).map((member) => member.id);
}

// The refit that puts berths and air for a squad of `size` aboard: while
// the flight checks with them aboard fail for berths, life support or the
// power to run them (M31: Scrapline's parts draw more, and a ship that gave
// its spare reactor away can be left short), the colony's building that
// gives most of what is short comes down and its part goes back aboard
// (fitPart); one whose part fits nowhere aboard stays standing, and the
// refit stops there. { campaign, moved (the types put aboard) }.
const SHORT = { berths: 'beds', lifeSupport: 'air', power: 'power' };
export function refitForSquad(campaign, rules, size) {
  let now = campaign;
  const moved = [];
  for (let n = 0; n < 4; n++) {
    const short = shipChecklist(now, rules, size).find((line) => line.ok !== true && line.id in SHORT);
    if (!short) break;
    const key = SHORT[short.id];
    const giver = colonyStats(now, rules).buildings.filter((b) => rules.modules.has(b.type) && b.gives?.[key] > 0).sort((a, b) => b.gives[key] - a.gives[key] || a.uid - b.uid)[0];
    if (!giver) break;
    const down = takeDown(now, rules, giver.uid);
    if (!down.ok) break;
    const placed = fitPart(down.campaign.ship, rules, giver.type);
    const aboard = placed && refitShip(down.campaign, placed.ship, rules);
    if (!aboard || aboard === down.campaign) break;
    now = aboard;
    moved.push(giver.type);
  }
  return { campaign: now, moved };
}

// What the player builds before a trip for whoever stays home (squad: the
// ids flying): with someone home and no bed and air for them on the
// colony's own power, a solar array where its own power can't run a
// shelter, else a shelter, as far as the materials go. { build: id } or
// null.
export function homeBuild(campaign, rules, squad) {
  const home = campaign.crew.length - squad.length;
  if (!home) return null;
  const shelter = [...rules.colony.builds.values()].find((b) => !b.makes && (b.gives?.beds ?? 0) > 0 && (b.gives?.air ?? 0) > 0);
  const solar = [...rules.colony.builds.values()].find((b) => !b.makes && (b.gives?.power ?? 0) > 0);
  if (!shelter || !solar) return null;
  // The colony as it would be with the ship away.
  const away = { ...campaign, colony: { ...campaign.colony, trip: { place: null, squad, done: false, result: null } } };
  const stats = colonyStats(away, rules);
  if (Math.min(stats.beds, stats.air) >= home && stats.buildings.every((b) => b.powered)) return null;
  const need = Math.max(0, -(shelter.gives.power ?? 0));
  const what = stats.power.spare >= need && Math.min(stats.beds, stats.air) < home ? shelter : solar;
  return buildPlan(campaign, rules, { build: what.id }).ok ? { build: what.id } : null;
}

// The place the squad flies to (see the top of the file): its index in the
// list, or null for none. days: the most days the trip can take.
export function nextPlace(campaign, rules, squad, days = Infinity) {
  const full = squad.length >= rules.balance.squadSize && squad.every((id) => {
    const member = campaign.crew.find((m) => m.id === id);
    return member.hp >= maxHp(member, rules);
  });
  // A held derelict first, then the nearest, then the first listed.
  const before = (a, b) => a.findIndex((v, i) => v !== b[i]) !== -1 && a[a.findIndex((v, i) => v !== b[i])] < b[a.findIndex((v, i) => v !== b[i])];
  let best = null;
  campaign.colony.places.forEach((place, index) => {
    if (place.held && !full) return;
    const plan = tripPlan(campaign, rules, index, squad);
    if (!plan.ok || plan.hungry > 0 || plan.days.out + plan.days.back > days) return;
    const rank = [place.held ? 0 : 1, plan.days.out, index];
    if (!best || before(rank, best.rank)) best = { index, rank };
  });
  return best?.index ?? null;
}

// The choice the player makes at a place's event: { choice, worth }, the
// one worth most of those it can make, the first on a tie.
export function placeChoice(campaign, rules, event) {
  const stores = storesOf(campaign, rules).total;
  const squad = campaign.colony.trip?.squad.length ?? 1;
  const worth = (effects) =>
    Math.min(Math.max(0, stores - campaign.colony.materials), effects.materials ?? 0) +
    Math.min(Math.max(0, stores - campaign.supplies), Math.max(0, effects.supplies ?? 0)) +
    (effects.drop || effects.part ? PLACE_PART : 0) -
    (effects.wound ? PLACE_HP * effects.wound.hp * (effects.wound.all ? squad : 1) : 0);
  let best = null;
  for (const choice of event.choices) {
    if (choiceProblem(campaign, choice)) continue;
    const value = choice.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * worth(outcome.effects), 0);
    if (!best || value > best.worth) best = { choice, worth: value };
  }
  return best;
}

// What the player sets down from the hold while a raid is coming (M29),
// before the lander comes: { part: type } or null. A part whose building
// fires at the lander (data/colony.json shots), most shots first; then,
// while none stands powered, a shield and an armory for the defenders;
// each only where it would stand powered, so nothing it sets down is dark.
// Ties go to the part's id.
export function raidPrep(campaign, rules) {
  const stats = colonyStats(campaign, rules);
  const lit = stats.buildings.filter((b) => b.powered && b.gives);
  const shielded = lit.some((b) => b.gives.shield > 0);
  const armed = lit.some((b) => b.gives.armory);
  const worth = (type) => {
    const def = rules.modules.get(type);
    const shots = buildingOf(type, rules)?.shots ?? 0;
    if (shots) return 100 + shots;
    const gives = def ? givesOf(def) : null;
    if (gives?.shield > 0 && !shielded) return 50;
    if (gives?.armory && !armed) return 40;
    return 0;
  };
  const held = Object.keys(campaign.parts).filter((type) => worth(type) > 0).sort((a, b) => worth(b) - worth(a) || a.localeCompare(b));
  for (const part of held) {
    if (!buildPlan(campaign, rules, { part }).ok) continue;
    const set = build(campaign, rules, { part });
    if (!set.ok) continue;
    const standing = colonyStats(set.campaign, rules).buildings.at(-1);
    if (standing?.powered) return { part };
  }
  return null;
}

// What a world is worth to the player as a colony: soil, water and ore a
// point each, a point for each step further from the lanes, and danger a
// point against. surveyed: whether its numbers are known; if not, its
// kind's ranges give them, on average.
export function worldScore(rules, world, surveyed) {
  const kind = rules.worlds.kinds.get(world.kind);
  const value = (rating) => (surveyed ? world[rating] : (kind[rating][0] + kind[rating][1]) / 2);
  const lanes = surveyed ? world.lanes : (1 + LANES) / 2;
  return value('soil') + value('water') + value('ore') + lanes - value('danger');
}

// The world the player would settle, from where the ship is in the system:
// the one it scores best of those the supplies reach without going hungry
// (of all of them, if none is in reach); on a tie, one surveyed, then the
// nearest, then the top one. A node id.
export function bestWorld(campaign, rules) {
  const { sector, at, surveyed } = campaign.run;
  const each = jumpSupplies(campaign, rules);
  const away = within(sector, at, sector.nodes.length);
  const worlds = sector.nodes.filter((node) => node.world);
  const reached = worlds.filter((node) => away.get(node.id) * each <= campaign.supplies);
  const known = (node) => (surveyed.includes(node.id) ? 1 : 0);
  const score = (node) => worldScore(rules, node.world, known(node));
  return [...(reached.length ? reached : worlds)].sort((a, b) => score(b) - score(a) || known(b) - known(a) || away.get(a.id) - away.get(b.id) || a.id - b.id)[0].id;
}

// What the player does next in the system: { kind: 'survey' } where the
// ship is, { kind: 'jump', to } a link on, or { kind: 'settle' } where the
// ship is. It surveys the nearest world not yet surveyed (the top one on a
// tie) whose survey the supplies cover, with the jumps there and the way on
// from there to the best world now (bestWorld); once none is, it makes for
// that world, and settles it.
export function systemMove(campaign, rules) {
  const { sector, at, surveyed } = campaign.run;
  const each = jumpSupplies(campaign, rules);
  const links = (from) => within(sector, from, sector.nodes.length);
  const away = links(at);
  const best = bestWorld(campaign, rules);
  const next = sector.nodes
    .filter((node) => node.world && !surveyed.includes(node.id))
    .sort((a, b) => away.get(a.id) - away.get(b.id) || a.id - b.id)
    .find((node) => campaign.supplies >= each * (away.get(node.id) + 1 + links(node.id).get(best)));
  if (next) return next.id === at ? { kind: 'survey' } : { kind: 'jump', to: stepToward(sector, at, next.id) };
  return best === at ? { kind: 'settle' } : { kind: 'jump', to: stepToward(sector, at, best) };
}

// The node a link on from `from` toward `to`, by the fewest links; the
// lowest id on a tie.
function stepToward(sector, from, to) {
  const back = within(sector, to, sector.nodes.length);
  return linked(sector, from).sort((a, b) => back.get(a) - back.get(b) || a - b)[0];
}
