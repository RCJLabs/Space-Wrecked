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
//   volley   −10 more for a side's patrol that will fire first (M33); one
//            that will wave the ship through is worth nothing either way
//   standing 2 a point of standing with a side, either way, as far as it
//            moves (M33): a side's stations' prices, and the Fleet's patrols
//   friendly 10 for a station of a side friendly or trusted with the crew
//            on the way (M33): its prices, and calling there to keep it so
//   quest    40 for a choice that does a quest's open step, and against one
//            that ends it (M33b); and for the choice that starts a side's
//            chain, where the start's price leaves its buffer (the holds keep
//            HELP_JUMPS jumps' worth after it, and the purse, if it pays, a
//            holdful's price, as a recruit's fee must) and a sector of the
//            act is still to come for its step. It starts one side's chain at
//            a time (chainOpen), and only to gain by it: from M33c its
//            companion, where they could come aboard (a berth free, and the
//            holds lasting HIRE_JUMPS jumps with them aboard, as for a
//            recruit: feeds); or, as M33b's Fleet chain, where it would leave
//            the crew friendly or better with a side whose patrols then wave
//            the ship through (chainBefriends). On the way, a node's quest
//            counts at a share of it, the sectors gone over the act's
//            (questPull): a quest's node comes back in each sector while its
//            step is open, so early on the way goes by it only where that
//            costs little, and in the act's last sector wherever it goes
//            hungry no more often
//   companion 100 for the choice at a chain's step that signs its companion
//            on (M33c), on top of the step's worth, where the holds would
//            feed them (feeds): more than any other choice there is worth,
//            so they come aboard; the berth is the choice's need. Signing on
//            wherever a berth was free, and starting every chain, 100
//            voyages from each start ended fed in 47, 53 and 81 (M33b: 73,
//            90 and 98): a fourth mouth empties the start ship's 30 supplies
//            in 7 jumps
//   arms     a quarter of its price for a weapon (M37) GAIN points better,
//            for a fight aboard a ship, than anything someone who could
//            carry it has (arms.js upgradeOf): a part's worth, half what act
//            1's dealer would pay; any other, nothing, with no dealer on the
//            run to sell it to. At 1.5 times its price the player raided
//            lockers and walked into traps for weapons over supplies, and
//            fewer voyages crossed fed (PROGRESS.md, M37)
// A station of the pursuer's side is worth its docking heat (M33), priced
// as an event's heat is, from the heat after the jump there. From M36 an
// event's trap is worth a hostile ship that fires first (hostile and volley
// together); a part it wrecks costs what a station would charge to repair
// it, on average over the working parts a wreck could hit (wreckCost); and
// a repair is worth what a station would charge for the wrecks it mends,
// the dearest first (mendWorth). A choice that needs someone (M36) it makes
// only with them aboard. A choice is
// worth what its outcomes are, each at its chance. A node
// whose kind is known is worth its event's best choice until settled, or a
// hostile ship's worth until met; one still unknown, what the mix's kinds
// are worth on average. It boards a ship it has disabled only with the crew
// fit to (boardIt), and otherwise leaves her. It signs a recruit on (hireWho)
// where there is room, the fee is left beyond a holdful's price, and the
// holds would still last HIRE_JUMPS jumps with the recruit aboard: what the
// lockers alone last the start crew (30 supplies, 3 aboard). On the lockers
// alone a fourth mouth leaves 7 jumps, and a station is sometimes further
// off than that, past a sector's jump point, where no plan can see.
// Quests' own events (M33b) are never in a sector's mix, so they count for
// nothing in what an unknown node is worth.
// At a station it refits (refitAt, M23h): every part on hand that feeds,
// heals, houses, guards, arms or drives the ship goes on, in that order,
// and from M39 its systems (a scanner, a workshop, a survey lab, a
// grapple), where it touches most of the ship, each kept only while every
// flight check still passes; a part the power doesn't stretch to takes a
// reactor on hand with it. Never corridors, airlocks, armories or a second
// bridge, no healer that heals no more than one aboard, and no part whose
// ship effects are all at their caps already, or a second grapple: they
// would add nothing.
// From M38c it takes work at a station (stationJobPick): of the jobs on its
// board, the one worth most, if that is anything, with a full squad of the
// fit going (tripSquad). A job is worth its pay, its part and the standing
// it moves, each at the test crew's odds on it (tools/run.js jobOdds, as
// act 1's are weighed), less its wounds (JOB_WOUNDS, at WORTH.hp) and its
// heat, with the docking heat at a station of the pursuer's side not yet
// traded at, as an event's heat. Managing heat, it takes one only where
// that heat and the next jump's keep the ship under huntHeat.
// Heat (M24), by its policy. Managing it, the player makes long jumps from
// LONG_FROM, and in place of any jump that would come out where the
// hunters may wait; swaps the transponder at a station from SWAP_FROM
// where the credits cover it beyond half a holdful's price; hides in a
// nebula on its way from HIDE_FROM while the holds keep HIDE_JUMPS jumps'
// worth; weighs an event's heat at WORTH.hot; scans only below LONG_FROM;
// and never regroups, since a day's rest costs more heat than it heals.
// From M33 it prices a station's supplies at the share it charges the crew,
// and prefers a friendly side's station (WORTH.friendly). Managing heat, at
// a station of the pursuer's side, where trading logs the ship (M33's fix),
// it trades only to swap the transponder or where filling the holds makes
// the way on better (tradeHere, stationChoice), counting the trade as a
// hungry jump (better) and its heat as an event's; passing by costs
// nothing. Its choice of way counts the same.
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
// as the stores take them, a part PLACE_PART, a wound PLACE_HP a hit point;
// from M36 a wreck mended PLACE_PART (it can go to the colony again), a
// trap PLACE_TRAP against, and only what the squad can take; from M37 a
// weapon GAIN points better, for a raid on the ground, than anything
// someone who could carry it has (arms.js), PLACE_PART. A trap's fight is
// fought then and there.
// From M29, while a raid is coming it stays home and sets down from the
// hold what will help when the lander comes (raidPrep): guns that fire at
// it, then a shield and an armory for the defenders, each only where it
// would stand powered. From M33b it flies to the colony's quest place
// before any other held derelict, on the same terms.
// From M38d, once the colony's days are played, it flies out on a voyage
// into the systems past the colony's with the healthiest who fit aboard,
// leaving one at home (voyageCrew), and plays them as act 2's sectors. It
// flies home at the jump point of the last system it means to cross, or
// sooner, once the holds come down to the way home's supplies and
// HOME_JUMPS jumps' more (homeNow). From M38d's fix it stocks the holds
// before it flies: farms that grow STOCK_SHARE times what the crew eats
// (nextBuild), and days at home until the food fills the holds, at most
// STOCK_DAYS; and it flies home when the pursuer finds the colony while
// it is away, as long as the flight home lands before their lander.
import { canRefit, maxHp, refitShip, shipChecklist } from '../src/sim/campaign.js';
import { buildingOf, colonyStats, givesOf, shipParts, storesOf, yieldOf } from '../src/sim/colony.js';
import { build, buildPlan, takeDown } from '../src/sim/colonyBuild.js';
import { crewRoom } from '../src/sim/crew.js';
import { shipEdge, STATION_EFFECTS } from '../src/sim/edges.js';
import { sellPriceOf, weaponPrice } from '../src/sim/economy.js';
import { wrecksOn } from '../src/sim/encounter.js';
import { eventsOf, freshest } from '../src/sim/eventPool.js';
import { choiceProblem, wreckable } from '../src/sim/events.js';
import { tripPlan } from '../src/sim/expeditions.js';
import { LANES } from '../src/sim/gen/system.js';
import { jobHeat, withHeat } from '../src/sim/heat.js';
import { hasTag } from '../src/sim/modules.js';
import { huntOdds } from '../src/sim/hunt.js';
import { openStep } from '../src/sim/quests.js';
import { raidIn } from '../src/sim/raids.js';
import { recruitOffer } from '../src/sim/recruits.js';
import { repairPrice, wrecksToRepair } from '../src/sim/repair.js';
import { regroupPlan } from '../src/sim/regroup.js';
import { dockHeat, jobMoves, jobPay, levelOf, moveStanding, patrolWelcome, priceShare, standingWith, stationSide } from '../src/sim/standing.js';
import { stationBoard } from '../src/sim/stationJobs.js';
import { swapPlan } from '../src/sim/transponder.js';
import { failingCheck, holdOf, jumpSupplies, knownNodes, leavePlan, linked, reach, supplyCapacity, tradeHeat, within } from '../src/sim/travel.js';
import { voyageHomePlan, voyagePlan } from '../src/sim/voyage.js';
import { yardHere } from '../src/sim/yards.js';
import { upgradeOf } from './arms.js';
import { fitPart, jobOdds } from './run.js';

export const WORTH = { supply: 2, short: 6, hp: 2, heat: 0.3, part: 0.5, hostile: -30, nebula: 15, hot: 1.5, hunted: -40, volley: -10, standing: 2, friendly: 10, quest: 40, companion: 100, arms: 0.25 };
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
// A side's chain is started (M33b: the Fleet's tender lent a hand) only
// while the holds keep this many jumps' worth after the choice: the buffer,
// so it never spends into it for standing.
const HELP_JUMPS = BUFFER_JUMPS;

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

// The hit points a squad loses in each station job (M38c), on average over
// the fights its odds were measured in, won or lost, of the start crews'
// 26 (tools/jobs.js --stations --odds 200). One not measured counts at
// about their mean, WOUNDS_ELSE.
const JOB_WOUNDS = { claimrights: 17, familybooks: 16, cutrig: 18, pumppirates: 19, badpaper: 19, fleetstores: 18, safepassage: 6, pumplocks: 17, repomen: 15, undeclared: 18, steward: 10, salvage: 18, courier: 9, holdberth: 12, dues: 18 };
const WOUNDS_ELSE = 15;

// The job the careful player takes at the station the ship is at (M38c,
// stationJobs.js): of those on its board, the one worth most
// (stationJobWorth) if that is anything, with a full squad of the fit
// going (tripSquad), while nothing holds the ship; managing heat, only one
// whose heat, the docking heat with it and the next jump's keep the ship
// under huntHeat. { index (on the board), job, squad (crew ids), worth }, or
// null.
export function stationJobPick(campaign, rules, heat = 'manage') {
  const board = stationBoard(campaign, rules);
  if (!board.length || holdOf(campaign, rules)) return null;
  const squad = tripSquad(campaign, rules);
  if (squad.length < Math.min(rules.balance.squadSize, campaign.crew.length)) return null;
  const dock = tradeHeat(campaign, rules);
  let best = null;
  board.forEach((job, index) => {
    const added = jobHeat(job, rules).heat + dock;
    if (heat === 'manage' && withHeat(campaign.heat, added + rules.balance.jumpHeat) >= rules.balance.huntHeat) return;
    const worth = stationJobWorth(campaign, rules, job, added, heat);
    if (worth > 0 && (!best || worth > best.worth)) best = { index, job, squad, worth };
  });
  return best;
}

// What a station job is worth to the careful player (M38c): done, its pay
// (with what its client's side adds), its part and the standing it moves;
// lost, the standing that moves; each at the test crew's odds on it; less
// its wounds and its heat (`added`, the docking heat with it), as an
// event's outcome is weighed (effectsWorth).
function stationJobWorth(campaign, rules, job, added, heat) {
  const odds = jobOdds(job, rules);
  const done = effectsWorth(campaign, rules, { credits: jobPay(campaign, rules, job), part: job.part, standing: jobMoves(job, rules, true) }, heat);
  const lost = effectsWorth(campaign, rules, { standing: jobMoves(job, rules, false) }, heat);
  return odds * done + (1 - odds) * lost + effectsWorth(campaign, rules, { heat: added }, heat) - WORTH.hp * (JOB_WOUNDS[job.contract] ?? WOUNDS_ELSE);
}

// The kinds of part the test player fits at a station, in the order it
// fits them (data/modules.json categories), and the parts it never fits, by
// tag.
export const FIT_ORDER = ['cargo', 'crew', 'defense', 'weapons', 'engines', 'command', 'utility'];
export const NEVER_FIT = ['bridge', 'corridor', 'airlock', 'armory'];

// The parts on hand the test player would fit, in order: by FIT_ORDER, the
// dearest first in each, one entry for each part.
export function refitPicks(campaign, rules) {
  return Object.entries(campaign.parts)
    .filter(([type]) => wouldFit(campaign, rules, type))
    .sort(([a], [b]) => fitOrder(rules, a, b))
    .flatMap(([type, count]) => Array(count).fill(type));
}

// Whether the test player fits a part of `type` at all: one of FIT_ORDER's
// kinds and none of NEVER_FIT's; a healing part only when it heals better
// than the ship's best; and (M39) a part with ship effects only while one
// of them is short of its cap with the crew aboard, a grapple only with
// none aboard.
function wouldFit(campaign, rules, type) {
  const def = rules.modules.get(type);
  if (!FIT_ORDER.includes(def?.category) || NEVER_FIT.some((tag) => hasTag(def, tag))) return false;
  const effects = Object.keys(def.station ?? {});
  if (effects.length && effects.every((key) => shipEdge(campaign.ship, campaign.crew, rules, key, campaign.wrecks ?? {}) >= STATION_EFFECTS[key][1])) return false;
  if (hasTag(def, 'grapple') && campaign.ship.modules.some((module) => hasTag(rules.modules.get(module.type), 'grapple'))) return false;
  const healer = Math.max(0, ...campaign.ship.modules.map((module) => rules.modules.get(module.type)?.heal ?? 0));
  return !def.heal || def.heal > healer;
}

// refitPicks' order: by FIT_ORDER, the dearest first in each, then by type.
function fitOrder(rules, a, b) {
  return FIT_ORDER.indexOf(rules.modules.get(a).category) - FIT_ORDER.indexOf(rules.modules.get(b).category) || rules.modules.get(b).cost - rules.modules.get(a).cost || a.localeCompare(b);
}

// What the careful player buys first at the shipyard the ship is at
// (M37b): the part of the yard's it would fit first, in refitPicks' order,
// that goes on with every flight check passing, and leaves a holdful's
// price and a transponder swap's, as a weapon off a rack does (M37): { slot,
// part, price } or null.
export function yardBuy(campaign, rules) {
  const reserve = supplyCapacity(campaign.ship, rules, campaign.crew) * rules.balance.supplyPrice + rules.balance.swapPrice;
  const items = yardHere(campaign, rules)
    .filter((item) => campaign.credits - item.price >= reserve && wouldFit(campaign, rules, item.part))
    .sort((a, b) => fitOrder(rules, a.part, b.part) || a.slot - b.slot);
  return items.find((item) => fitted({ ...campaign, parts: { ...campaign.parts, [item.part]: (campaign.parts[item.part] ?? 0) + 1 } }, rules, item.part)) ?? null;
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
  // Standing (M33), as far as it would move.
  if (effects.standing) worth += WORTH.standing * moveStanding(campaign, rules, effects.standing).changes.reduce((sum, change) => sum + change.to - change.from, 0);
  // A weapon (M37): GAIN points better than anyone who could carry it has,
  // aboard a ship, WORTH.arms of its price; else nothing, with no dealer on
  // the run to sell it to.
  if (effects.arms) worth += upgradeOf(campaign, rules, effects.arms, 'ship') ? WORTH.arms * (weaponPrice(effects.arms, rules) ?? 0) : 0;
  // A trap, parts wrecked and wrecks mended (M36).
  if (effects.ambush) worth += WORTH.hostile + WORTH.volley;
  if (effects.wreck) worth -= wreckCost(campaign, rules, effects.wreck);
  if (effects.repair) worth += mendWorth(campaign, rules, effects.repair);
  return worth;
}

// What wrecking `count` parts costs (M36): a station's repair of each, on
// average over the working parts a wreck could hit.
function wreckCost(campaign, rules, count) {
  const prices = wreckable(campaign.ship, wrecksOn(campaign.ship, campaign.wrecks), rules).map((module) => repairPrice(module.type, rules) ?? 0);
  return prices.length ? (Math.min(count, prices.length) * prices.reduce((sum, price) => sum + price, 0)) / prices.length : 0;
}

// What mending `count` wrecks is worth (M36): a station's price for the
// dearest of them, as many as it mends.
function mendWorth(campaign, rules, count) {
  return wrecksToRepair(campaign, rules)
    .map((wreck) => wreck.price)
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, price) => sum + price, 0);
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
// most of those it can make, with what it does to a quest (questWorth) at
// `pull` of its worth: all of it at the event, questPull's on the way. From
// M36, as at a station, it spends credits only beyond a holdful's price
// (dipsReserve), but on supplies or a quest's step: the traders sell parts,
// repairs and quiet now, and weapons from M37, and a purse spent on them
// left nothing for the holds or the transponder. With every choice dipping,
// it judges them all.
export function bestChoice(campaign, rules, event, heat = 'manage', pull = 1) {
  const reserve = supplyCapacity(campaign.ship, rules, campaign.crew) * rules.balance.supplyPrice;
  const judged = [];
  for (const choice of event.choices) {
    if (choiceProblem(campaign, choice, rules)) continue;
    const quest = questWorth(campaign, rules, event, choice);
    const worth = choice.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * effectsWorth(campaign, rules, outcome.effects, heat), 0) + pull * quest;
    judged.push({ choice, worth, dips: quest <= 0 && dipsReserve(campaign, choice, reserve) });
  }
  const kept = judged.some((entry) => !entry.dips) ? judged.filter((entry) => !entry.dips) : judged;
  let best = null;
  for (const { choice, worth } of kept) if (!best || worth > best.worth) best = { choice, worth };
  return best;
}

// Whether a choice pays credits out of the reserve (a holdful's price) for
// anything but supplies.
function dipsReserve(campaign, choice, reserve) {
  return choice.outcomes.some(({ effects }) => (effects.credits ?? 0) < 0 && !(effects.supplies > 0) && campaign.credits + effects.credits < reserve);
}

// The share of a quest's worth a node on the way counts (M33b): the
// sectors gone over the act's, all of it in the last.
function questPull(campaign, rules) {
  const last = rules.acts.get(2)?.sectors ?? 1;
  return Math.min(1, campaign.run.sector.index / last);
}

// What a choice does to the quests, in credits (M33b): WORTH.quest for one
// that does an open step, against one that ends it, and WORTH.companion on
// top for one that signs a companion on where the holds would feed them
// (M33c); for one that starts a side's chain, WORTH.quest where it gains by
// it (see the top of the file) and its price leaves the buffer, else
// nothing.
function questWorth(campaign, rules, event, choice) {
  const open = event.quest ? openStep(campaign, rules, event.quest) : null;
  if (open?.step.event === event.id) {
    // A companion signing on (M33c) is part of what the step is worth.
    const joins = choice.outcomes.find((outcome) => outcome.effects.joins)?.effects.joins;
    if (open.step.done.includes(choice.id)) return WORTH.quest + (joins && feeds(campaign, rules, joins) ? WORTH.companion : 0);
    return (open.step.cold ?? []).includes(choice.id) ? -WORTH.quest : 0;
  }
  const starts = [...(rules.quests?.values() ?? [])].find((quest) => quest.start?.event === event.id && quest.start.choice === choice.id && !campaign.quests?.[quest.id]);
  if (!starts || campaign.run.sector.index >= (rules.acts.get(2)?.sectors ?? 0)) return 0;
  // One side's chain at a time; for its companion, where they could come
  // aboard (M33c), or, as in M33b, where it would befriend a side whose
  // patrols then wave the ship through.
  if (chainOpen(campaign, rules)) return 0;
  const companion = [...(rules.companions?.values() ?? [])].find((one) => one.chain === starts.id);
  const forCompanion = companion && crewRoom(campaign.ship, rules) > campaign.crew.length && feeds(campaign, rules, companion.id);
  const forPatrols = Boolean(rules.factions?.sides.get(starts.side)?.patrol) && chainBefriends(campaign, rules, starts, choice);
  if (!forCompanion && !forPatrols) return 0;
  const expected = (key) => choice.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * (outcome.effects[key] ?? 0), 0);
  if (campaign.supplies + expected('supplies') < HELP_JUMPS * jumpSupplies(campaign, rules)) return 0;
  const reserve = supplyCapacity(campaign.ship, rules, campaign.crew) * rules.balance.supplyPrice;
  return expected('credits') < 0 && campaign.credits + expected('credits') < reserve ? 0 : WORTH.quest;
}

// Whether a side's chain is under way (M33c): it starts one at a time.
// With a berth for each, bunks had it chasing three at once, and the crew
// it signed on went hungry.
function chainOpen(campaign, rules) {
  return [...(rules.quests?.values() ?? [])].some((quest) => quest.side && campaign.quests?.[quest.id]?.state === 'open');
}

// Whether the holds would last HIRE_JUMPS jumps with companion `id` aboard
// (M33c), their lockers counted, as for a recruit (hireWho).
function feeds(campaign, rules, id) {
  const companion = rules.companions.get(id);
  const crew = [...campaign.crew, { job: companion.job, fights: companion.fights, traits: companion.traits }];
  return supplyCapacity(campaign.ship, rules, crew) >= HIRE_JUMPS * rules.balance.jumpSupplies * crew.length;
}

// Whether a side's chain (M33b), started with `choice` and each step done,
// would leave the crew friendly or trusted with its side: the standing the
// start and each step's done choice move, at their outcomes' chances,
// added to the crew's now.
function chainBefriends(campaign, rules, quest, choice) {
  const moves = (made) => made.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * (outcome.effects.standing?.[quest.side] ?? 0), 0);
  let by = moves(choice);
  for (const step of quest.steps) {
    const done = rules.events.get(step.event)?.choices.find((made) => step.done?.includes(made.id));
    if (done) by += moves(done);
  }
  const level = levelOf(standingWith(campaign, quest.side) + by, rules);
  return level === 'friendly' || level === 'trusted';
}

// What an unknown node is worth on average: the mix's kinds by weight, each
// its events' best choices on average, or a hostile ship's worth. Since M36
// its events are those the campaign's pool still holds (eventPool.js): its
// background's own among them, and none it has met while the kind has
// others.
function unknownWorth(campaign, rules, heat) {
  const mix = Object.entries(rules.sectors.mix);
  const total = mix.reduce((sum, [, weight]) => sum + weight, 0);
  let worth = 0;
  for (const [kind, weight] of mix) {
    if (rules.nodeTypes.get(kind)?.ships) {
      worth += (weight / total) * WORTH.hostile;
      continue;
    }
    const events = freshest(eventsOf(rules, kind, campaign.background), campaign.eventsMet ?? []).map((id) => rules.events.get(id));
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

// How a way on goes from what the ship carries: { hungry (jumps), docks,
// value }: what is left out of the sector (supplies at their worth, and
// credits), and what the nodes passed are worth. The jump out of the sector
// counts too, unless it is the act's last. At a station of the pursuer's
// side the managing player passes by or trades, whichever makes the rest
// of the way better (stationChoice); docks counts the trades (M33's fix).
function wayCost(campaign, rules, way, { supplies, credits }, judge, heat = 'manage') {
  const { sector } = campaign.run;
  const room = supplyCapacity(campaign.ship, rules, campaign.crew);
  const each = jumpSupplies(campaign, rules);
  let hungry = 0;
  let worth = 0;
  const eat = () => {
    if (supplies < each) hungry += 1;
    supplies = Math.max(0, supplies - each);
  };
  for (let i = 1; i < way.length; i++) {
    eat();
    worth += judge(way[i]);
    const node = sector.nodes[way[i]];
    if (node.type !== 'station') continue;
    if (heat === 'manage' && dockHeat(campaign, rules, node)) {
      const on = (carried) => wayCost(campaign, rules, way.slice(i), carried, judge, heat);
      const rest = stationChoice(campaign, rules, node, on, { supplies, credits }, heat);
      return { hungry: hungry + rest.hungry, docks: rest.docks, value: rest.value + worth };
    }
    const price = stationPrice(campaign, rules, node);
    const bought = fill(supplies, credits, room, price);
    supplies += bought;
    credits -= bought * price;
  }
  if (leavePlan({ ...campaign, run: { ...campaign.run, at: sector.exit } }, rules).ok) {
    eat();
    // Into the next sector with less than the buffer, where no plan can see
    // a station yet, is as good as hungry.
    if (supplies < BUFFER_JUMPS * each) hungry += 1;
  }
  return { hungry, docks: 0, value: WORTH.supply * supplies + credits + worth };
}

// At a station of the pursuer's side (M33's fix): the way on from it, as
// wayCost has it, passing by or trading there, whichever is better. `on`
// gives the way on from what the ship carries out of the station. Trading
// fills the holds, as far as the credits go, and counts as a dock, its heat
// at its worth (dockWorth; `arrived`: the ship is there now, not a jump
// away); with nothing to buy it passes by. { hungry, docks, value, trades }.
function stationChoice(campaign, rules, node, on, { supplies, credits }, heat, arrived = false) {
  const pass = { ...on({ supplies, credits }), trades: false };
  const price = stationPrice(campaign, rules, node);
  const bought = fill(supplies, credits, supplyCapacity(campaign.ship, rules, campaign.crew), price);
  if (!bought) return pass;
  const after = on({ supplies: supplies + bought, credits: credits - bought * price });
  const trade = { hungry: after.hungry, docks: after.docks + 1, value: after.value + dockWorth(campaign, rules, node, heat, arrived), trades: true };
  return better(trade, pass) ? trade : pass;
}

// What the heat of trading at a station of the pursuer's side is worth
// (M33's fix): priced as an event's heat (effectsWorth), from the heat the
// ship has there: now, once it has `arrived`, else after the jump there.
function dockWorth(campaign, rules, node, heat, arrived) {
  const there = arrived ? campaign : { ...campaign, heat: withHeat(campaign.heat, rules.balance.jumpHeat) };
  return effectsWorth(there, rules, { heat: dockHeat(campaign, rules, node) }, heat);
}

// Whether way a beats way b (or there is no b): hungry least, each trade at
// a station of the pursuer's side counting as a hungry jump (M33: its heat
// is as bad as going on into the next sector short), then worth most.
function better(a, b) {
  if (!b) return true;
  const [short, shortB] = [a.hungry + a.docks, b.hungry + b.docks];
  return short !== shortB ? short < shortB : a.value > b.value;
}

// Whether the player trades at the station the ship is at (M33's fix): yes,
// unless it manages heat at a station of the pursuer's side it hasn't
// traded at since it arrived (travel.js tradeHeat). There it trades to swap
// the transponder (swapNow: the swap sheds more than the trade adds), or
// where filling the holds makes the best way on better (stationChoice).
// Refits and letting crew go are no trade: it does them anyway.
export function tradeHere(campaign, rules, heat) {
  if (heat !== 'manage' || !tradeHeat(campaign, rules)) return true;
  if (swapNow(campaign, rules, heat)) return true;
  const { at } = campaign.run;
  const judge = nodeJudge(campaign, rules, heat);
  const on = (carried) => bestWay(campaign, rules, at, carried, judge, heat);
  return stationChoice(campaign, rules, campaign.run.sector.nodes[at], on, { supplies: campaign.supplies, credits: campaign.credits }, heat, true).trades;
}

// What each node is worth passing through, for the campaign as it stands:
// a nebula, too, while the managing player would hide there.
function nodeJudge(campaign, rules, heat = 'manage') {
  const { run } = campaign;
  const known = knownNodes(run, rules);
  const guess = unknownWorth(campaign, rules, heat);
  const hiding = heat === 'manage' && campaign.heat >= HIDE_FROM;
  const pull = questPull(campaign, rules);
  return (id) => {
    if (!known.has(id)) return guess;
    const node = run.sector.nodes[id];
    if (hiding && rules.nodeTypes.get(node.type)?.hides) return WORTH.nebula;
    if (run.done.includes(id)) return 0;
    if (node.hostile) {
      const welcome = patrolWelcome(campaign, rules, rules.ships.get(node.hostile.ship));
      return welcome === 'waved' ? 0 : welcome === 'fired' ? WORTH.hostile + WORTH.volley : WORTH.hostile;
    }
    if (node.type === 'station') return stationWorth(campaign, rules, node);
    const event = node.event ? rules.events.get(node.event) : null;
    return event ? (bestChoice(campaign, rules, event, heat, pull)?.worth ?? 0) : 0;
  };
}

// What calling at a station is worth for its side (M33): a friendly or
// trusted side's, WORTH.friendly; any other's, nothing more than its prices
// (stationPrice). Trading at the pursuer's is weighed on the way
// (stationChoice).
function stationWorth(campaign, rules, node) {
  const side = stationSide(node, rules);
  if (!side) return 0;
  const level = levelOf(standingWith(campaign, side), rules);
  return level === 'friendly' || level === 'trusted' ? WORTH.friendly : 0;
}

// What a supply costs at a station, at the share it charges the crew (M33).
function stationPrice(campaign, rules, node) {
  return (rules.balance.supplyPrice * priceShare(campaign, rules, node)) / 100;
}

// The best way on from node `from` with what the ship carries there.
function bestWay(campaign, rules, from, carried, judge, heat = 'manage') {
  let best = null;
  for (const way of waysOn(campaign.run.sector, from)) {
    const cost = { ...wayCost(campaign, rules, way, carried, judge, heat), way };
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
  const way = bestWay(campaign, rules, at, { supplies: campaign.supplies, credits: campaign.credits }, judge, heat);
  if (policy !== 'heat' || campaign.heat < from) return way.way[1];
  if (sector.nodes[way.way[1]].type === 'station' && campaign.supplies < supplyCapacity(campaign.ship, rules, campaign.crew)) return way.way[1];
  const cost = jumpSupplies(campaign, rules, true);
  if (campaign.supplies - cost < BUFFER_JUMPS * jumpSupplies(campaign, rules)) return way.way[1];
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
    const target = sector.nodes[to];
    const wayOn = (carried) => bestWay(campaign, rules, to, carried, judge, heat);
    let on;
    if (target.type === 'station' && heat === 'manage' && dockHeat(campaign, rules, target)) on = stationChoice(campaign, rules, target, wayOn, { supplies, credits }, heat);
    else {
      if (target.type === 'station') {
        const price = stationPrice(campaign, rules, target);
        const bought = fill(supplies, credits, room, price);
        supplies += bought;
        credits -= bought * price;
      }
      on = wayOn({ supplies, credits });
    }
    const there = { hungry: on.hungry, docks: on.docks, value: on.value + judge(to) + shed, to };
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
// that fits, or null to let the day pass. share: the farms grow that many
// times what the crew eats (STOCK_SHARE stocking for a voyage).
export function nextBuild(campaign, rules, share = 1) {
  const builds = [...rules.colony.builds.values()];
  const farm = builds.find((build) => build.makes === 'food');
  const mine = builds.find((build) => build.makes === 'materials');
  if (!farm) return null;
  const { world, materials, buildings } = campaign.colony;
  const count = (build) => buildings.filter((building) => building.type === build.id).length;
  const needed = Math.ceil((share * jumpSupplies(campaign, rules)) / yieldOf(farm, world)) - count(farm);
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
// A trap at a place (M36): the scavengers' fight there with the squad as it
// is, which the player otherwise takes on only at full strength (nextPlace).
const PLACE_TRAP = 16;

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
  // The quest's place first (M33b), then a held derelict, then the
  // nearest, then the first listed.
  const before = (a, b) => a.findIndex((v, i) => v !== b[i]) !== -1 && a[a.findIndex((v, i) => v !== b[i])] < b[a.findIndex((v, i) => v !== b[i])];
  let best = null;
  campaign.colony.places.forEach((place, index) => {
    if (place.held && !full) return;
    const plan = tripPlan(campaign, rules, index, squad);
    if (!plan.ok || plan.hungry > 0 || plan.days.out + plan.days.back > days) return;
    const rank = [place.quest ? 0 : 1, place.held ? 0 : 1, plan.days.out, index];
    if (!best || before(rank, best.rank)) best = { index, rank };
  });
  return best?.index ?? null;
}

// The choice the player makes at a place's event: { choice, worth }, the
// one worth most of those it can make, the first on a tie.
export function placeChoice(campaign, rules, event) {
  const stores = storesOf(campaign, rules).total;
  const among = campaign.colony.trip?.squad ?? null;
  const squad = among?.length ?? 1;
  const wrecks = Object.keys(wrecksOn(campaign.ship, campaign.wrecks)).length;
  const worth = (effects) =>
    Math.min(Math.max(0, stores - campaign.colony.materials), effects.materials ?? 0) +
    Math.min(Math.max(0, stores - campaign.supplies), Math.max(0, effects.supplies ?? 0)) +
    (effects.drop || effects.part ? PLACE_PART : 0) +
    (effects.arms && upgradeOf(campaign, rules, effects.arms, 'ground') ? PLACE_PART : 0) +
    PLACE_PART * Math.min(effects.repair ?? 0, wrecks) -
    (effects.ambush ? PLACE_TRAP : 0) -
    (effects.wound ? PLACE_HP * effects.wound.hp * (effects.wound.all ? squad : 1) : 0);
  let best = null;
  for (const choice of event.choices) {
    if (choiceProblem(campaign, choice, rules, { among })) continue;
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

// M38d: the jumps' supplies the holds keep beyond the way home's on a
// voyage; once they come down to that, the player flies home.
export const HOME_JUMPS = 2;
// M38d's fix: stocking the holds before a voyage, the farms grow
// STOCK_SHARE times what the crew eats, and the player waits at home for
// the food to fill the holds at most STOCK_DAYS days.
export const STOCK_SHARE = 2;
export const STOCK_DAYS = 20;

// The food the player stocks before a voyage: as much as the holds take
// with the whole crew aboard, or as the colony's stores keep with the ship
// home, whichever is less.
export function stockFor(campaign, rules) {
  return Math.min(supplyCapacity(campaign.ship, rules, campaign.crew), storesOf(campaign, rules).total);
}

// Who flies out on a voyage from the colony (M38d): the healthiest, the
// share of their most hit points they have, the crew's order breaking ties;
// as many as the ship can fly with every flight check passing, leaving one
// at home when there are two or more. Their ids, in the crew's order; none
// when the ship can't fly even one.
export function voyageCrew(campaign, rules) {
  const { crew } = campaign;
  const ranked = crew.map((member, i) => ({ member, i })).sort((a, b) => b.member.hp / maxHp(b.member, rules) - a.member.hp / maxHp(a.member, rules) || a.i - b.i);
  for (let n = Math.min(crewRoom(campaign.ship, rules), Math.max(1, crew.length - 1)); n > 0; n--) {
    const going = new Set(ranked.slice(0, n).map(({ member }) => member.id));
    const ids = crew.filter((member) => going.has(member.id)).map((member) => member.id);
    if (voyagePlan(campaign, rules, ids).ok) return ids;
  }
  return [];
}

// Whether the player flies home from its voyage now (M38d): flying on once
// a lander stopped the flight; with the pursuer's lander coming down at
// the colony no sooner than the flight home lands (M38d's fix), from M38f
// the day after; at the jump
// point of the `systems`th system out; or once the holds come down to the
// way home's supplies and HOME_JUMPS jumps' more. Never while something
// holds the ship.
export function homeNow(campaign, rules, systems) {
  const voyage = campaign.colony?.voyage;
  const plan = voyage ? voyageHomePlan(campaign, rules) : null;
  if (!plan?.ok) return false;
  if (voyage.homing) return true;
  // A raid coming that the flight home lands the day before (M38f: on its
  // day it is fought out without the ship).
  const coming = raidIn(campaign);
  if (coming !== null && plan.days < coming) return true;
  const { run } = campaign;
  if (voyage.out >= systems && run.at === run.sector.exit) return true;
  return campaign.supplies <= plan.eats + HOME_JUMPS * jumpSupplies(campaign, rules);
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

// The second colony's world (M38e): in a system past the colony's, the
// best world there (bestWorld): { kind: 'settle' } once the ship is at it,
// else { kind: 'jump', to } a link on toward it.
export function settleMove(campaign, rules) {
  const { sector, at } = campaign.run;
  const best = bestWorld(campaign, rules);
  return best === at ? { kind: 'settle' } : { kind: 'jump', to: stepToward(sector, at, best) };
}

// Who flies back from the second colony (M38e): everyone there, but the
// least fit of three or more (the last in the crew's order on a tie), who
// stays. Their ids, in the crew's order.
export function backCrew(campaign, rules) {
  const { crew } = campaign;
  if (crew.length < 3) return crew.map((member) => member.id);
  const share = (member) => member.hp / maxHp(member, rules);
  const [{ member: stays }] = crew.map((member, i) => ({ member, i })).sort((a, b) => share(a.member) - share(b.member) || b.i - a.i);
  return crew.filter((member) => member !== stays).map((member) => member.id);
}

// The node a link on from `from` toward `to`, by the fewest links; the
// lowest id on a tie.
function stepToward(sector, from, to) {
  const back = within(sector, to, sector.nodes.length);
  return linked(sector, from).sort((a, b) => back.get(a) - back.get(b) || a - b)[0];
}
