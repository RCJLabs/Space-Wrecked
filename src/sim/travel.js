// The run (ROADMAP §2, act 2): the ship crossing sectors, jumping from node
// to node on each sector's map (gen/sector.js) and on into the next sector
// from its jump point, up to the act's last. Past the last one's jump point
// lies the system (M25, gen/system.js): its worlds, one of which the crew
// settles (settle.js), which ends the act. Pure: every roll is the
// campaign's.
//
// campaign.run, from the act's first visit home (beginRun) on:
//   sector   the sector the ship is in, saved whole, so an update to the
//            game can't move a node under it: { index, name, nodes, links,
//            start, exit }. A node of a kind that holds events has one
//            (node.event, an id in data/events.json). The system past the
//            charts is one too, with system: true, its worlds' nodes each
//            carrying their world, and no jump point (exit: null)
//   at       the node the ship is at
//   seen     the nodes it has been to in this sector, in order
//   past     the names of the sectors crossed before, oldest first
//   done     the nodes whose events are settled (events.js)
//   scans    the scans made: [{ at (the node scanned from), reach (the
//            links it reached) }]
//   result   the last event settled, until the next jump: { node, event,
//            choice, outcome, roll, changes } (events.js)
//   approach the approach phase going on where the ship is, against a
//            hostile ship, or null (encounter.js)
//   hired    the recruits signed on at the sector's stations: [{ node,
//            slot }] (recruits.js)
//   swapped  whether the transponder has been swapped in this sector
//            (transponder.js, M24)
//   surveyed the worlds surveyed in the system (survey.js, M25)
// campaign.supplies: what the ship carries, up to supplyCapacity.
//
// A jump goes to a linked node: each crew member eats jumpSupplies, and heat
// rises by jumpHeat. A long jump goes two links away, past the node between:
// longJumpFactor times the supplies, and heat changes by longJumpHeat, since
// the pursuer loses the trail. A jump the supplies don't cover still goes:
// they run out, and every crew member goes hungry, losing hungerHp hit
// points, never the last. A working med bay heals the wounded as the ship
// jumps (medbay.js), a long jump as many jumps as the supplies it eats.
// Stations sell supplies at supplyPrice each, and see to refits
// (campaign.js refitShip): the ship can't leave a station while a flight
// check fails, and supplies past what the holds take after a refit stay
// behind at the next jump, before it eats. A station of a side (M33,
// standing.js) charges its level's share of the price, and docking at one
// of the pursuer's side adds dockHeat, after the jump's heat. From
// the jump point, leaving the sector is a jump into the next one's way in,
// rolled from the campaign's RNG as it is left; from the last sector's, into
// the system's, rolled the same way. The flags count the jumps,
// the long ones, the hungry ones, the hit points the med bay healed, the
// supplies bought, those left behind, and the scans.
//
// The crew's jobs help (edges.js, M32): a quartermaster aboard stocks the
// lockers deeper, a scout's scans reach farther, and an engineer fixes the
// cheapest wrecked part after each jump, on the way.
//
// An event open at the ship's node holds every jump and scan until it is
// settled, and so does an approach until it is over and put away. Arriving
// where a hostile ship is opens the approach. From huntHeat, wherever a jump
// comes out the pursuer's hunters may be waiting (hunt.js): each plan says
// the chance, by the heat the ship arrives with, and arriving rolls it
// before anything else there. An event where they wait comes once they are
// dealt with. What a node holds is known for the way in, the jump point and
// the kinds on the charts (stations, nebulae), and for any node the ship
// has been at or next to; a scan shows every node within scanRange links
// of the ship (and a scout's more), for scanHeat.
import { int } from '../core/rng.js';
import { actOf, atStation } from './acts.js';
import { flightChecklist, shipStats } from './constraints.js';
import { openApproach } from './encounter.js';
import { tally } from './flags.js';
import { stationEdge } from './edges.js';
import { generateSector } from './gen/sector.js';
import { generateSystem } from './gen/system.js';
import { withHeat } from './heat.js';
import { huntOdds, rollHunt } from './hunt.js';
import { healCrew, healRate } from './medbay.js';
import { wrecksToRepair } from './repair.js';
import { costAt, dockHeat, mostFor, shareHere } from './standing.js';

const MAX_SEED = 0xffffffff;
// The kinds of node on the charts, known before the ship gets near: the way
// in, the jump point, and the kinds the data charts (data/sectors.json).
const FIXED = ['start', 'exit'];

// What the ship can carry: its lockers (baseSupplies, and what a
// quartermaster among the crew aboard adds) and its cargo holds.
export function supplyCapacity(ship, rules, crew = []) {
  return rules.balance.baseSupplies + stationEdge(crew, rules, 'lockers') + shipStats(ship, rules).cargo;
}

// What a jump costs in supplies: jumpSupplies for each crew member, and a
// long jump longJumpFactor times that.
export function jumpSupplies(campaign, rules, long = false) {
  const each = rules.balance.jumpSupplies * campaign.crew.length;
  return long ? each * rules.balance.longJumpFactor : each;
}

// True when the campaign is at home in an act that is a run: one whose home
// is the ship.
export function onTheRun(campaign, rules) {
  return campaign.place === 'hub' && actOf(campaign, rules)?.hub === 'ship';
}

// The node the ship is at, or null off the run.
export function hereOf(campaign) {
  return campaign.run ? campaign.run.sector.nodes[campaign.run.at] : null;
}

// Starts the run: its first sector, rolled from the campaign's RNG, with the
// ship at its way in and its holds full: the hangar stocked it. Returns
// { ok: true, campaign } or { ok: false, error }.
export function beginRun(campaign, rules) {
  if (!onTheRun(campaign, rules)) return { ok: false, error: 'The run starts once the ship has launched.' };
  if (campaign.run) return { ok: false, error: 'The run is under way.' };
  const { value: seed, state: rng } = int(campaign.rng, 0, MAX_SEED);
  const sector = generateSector(rules, seed, 1);
  return { ok: true, campaign: { ...campaign, rng, supplies: supplyCapacity(campaign.ship, rules, campaign.crew), run: freshRun(sector, []) } };
}

// A run entering `sector`, with the sectors behind it.
function freshRun(sector, past) {
  return { sector, at: sector.start, seen: [sector.start], past, done: [], scans: [], result: null, approach: null, hired: [], swapped: false, surveyed: [] };
}

// The event open at the ship's node: { node, event } (the event from
// data/events.json), or null when there is none or it is settled. An event
// the data no longer has is passed by, and one where the hunters wait
// comes once their approach is put away.
export function openEvent(campaign, rules) {
  const { run } = campaign;
  const node = run?.sector.nodes[run.at];
  if (!node?.event || run.done.includes(run.at) || run.approach) return null;
  const event = rules.events.get(node.event);
  return event ? { node, event } : null;
}

// What holds the ship where it is, as the words that say so, or null: an
// event to decide, or a hostile ship to deal with (or, once that is over,
// to put away).
export function holdOf(campaign, rules) {
  const open = openEvent(campaign, rules);
  if (open) return `Decide first: ${open.event.title}.`;
  const approach = campaign.run?.approach;
  if (approach) return approach.outcome ? 'Carry on first.' : `Deal with the ${approach.enemy.name} first.`;
  return null;
}

// The nodes within `links` links of node `id`: Map id -> links away (0 for
// `id`).
export function within(sector, id, links) {
  const away = new Map([[id, 0]]);
  let ring = [id];
  for (let step = 1; step <= links && ring.length; step++) {
    ring = ring.flatMap((at) => linked(sector, at)).filter((next) => !away.has(next));
    for (const next of ring) away.set(next, step);
    ring = [...new Set(ring)];
  }
  return away;
}

// The nodes whose kind is known on the map (see the top of the file), each
// scan's as far as it reached.
export function knownNodes(run, rules) {
  const { sector } = run;
  const charted = (type) => FIXED.includes(type) || rules.nodeTypes.get(type)?.charted === true;
  const known = new Set(sector.nodes.filter((node) => charted(node.type)).map((node) => node.id));
  for (const id of run.seen) {
    known.add(id);
    for (const next of linked(sector, id)) known.add(next);
  }
  for (const { at, reach } of run.scans) for (const near of within(sector, at, reach).keys()) known.add(near);
  return known;
}

// How many links a scan reaches with this crew aboard: scanRange, and a
// scout's more.
export function scanReach(campaign, rules) {
  return rules.balance.scanRange + stationEdge(campaign.crew, rules, 'scan');
}

// What a scan from the ship's node would show: { ok: true, heat (its
// change), reach (scanReach), reveals (the nodes it makes known) }, or
// { ok: false, error }.
export function scanPlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Scans are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const known = knownNodes(run, rules);
  const reach = scanReach(campaign, rules);
  const reveals = [...within(run.sector, run.at, reach).keys()].filter((id) => !known.has(id));
  if (!reveals.length) return { ok: false, error: 'Everything a scan would reach is known.' };
  return { ok: true, heat: rules.balance.scanHeat, reach, reveals };
}

// Scans from the ship's node. Returns { ok: true, campaign, plan } or
// { ok: false, error }.
export function scan(campaign, rules) {
  const plan = scanPlan(campaign, rules);
  if (!plan.ok) return plan;
  const { run } = campaign;
  const scans = [...run.scans, { at: run.at, reach: plan.reach }];
  return { ok: true, plan, campaign: { ...campaign, heat: withHeat(campaign.heat, plan.heat), flags: tally(campaign.flags, { scans: 1 }), run: { ...run, scans } } };
}

// The nodes linked to a node.
export function linked(sector, id) {
  return sector.links.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

// The nodes a jump reaches from a node (1) and a long jump (2): Map id ->
// links away.
export function reach(sector, id) {
  const near = linked(sector, id);
  const far = new Map(near.map((node) => [node, 1]));
  for (const node of near) {
    for (const next of linked(sector, node)) if (next !== id && !far.has(next)) far.set(next, 2);
  }
  return far;
}

// The flight check that keeps the ship at a station, or null: the first
// line of its checklist (constraints.js) that doesn't pass, for the crew
// aboard, once a refit has left one failing. Only a refit changes the ship,
// and only at a station, so away from one nothing holds it.
export function failingCheck(campaign, rules) {
  if (!atStation(campaign, rules)) return null;
  const liftOff = actOf(campaign, rules)?.liftOff ?? null;
  return flightChecklist(campaign.ship, rules, campaign.crew.length, { liftOff }).find((line) => line.ok !== true) ?? null;
}

// The words for a ship a flight check keeps at the station.
export function brokenWhy(line) {
  return `The ship can't leave until every flight check passes: ${line.text.charAt(0).toLowerCase()}${line.text.slice(1)}. Refit to fix it.`;
}

// The supplies past what the holds take, after a refit took a hold off (or
// the quartermaster left): they stay behind at the next jump.
export function suppliesOver(campaign, rules) {
  return Math.max(0, campaign.supplies - supplyCapacity(campaign.ship, rules, campaign.crew));
}

// The wrecked parts an engineer aboard fixes on a jump, the cheapest first
// (repair.js wrecksToRepair): [{ uid, type, wreck, price }], [] with none.
export function jumpFixes(campaign, rules) {
  const fixes = stationEdge(campaign.crew, rules, 'repair');
  return fixes ? wrecksToRepair(campaign, rules).slice(0, fixes) : [];
}

// What a jump to node `to` takes, before it is made: { ok: true, kind:
// 'jump' or 'long', supplies (what it eats), left (the supplies the holds
// can't take, left behind first), heat (its change), dock (the heat of
// docking there after it: standing.js dockHeat), hungry (the supplies
// carried don't cover it), heal (what the med bay heals each of the
// wounded on the way), fixes (the wrecked parts an engineer fixes on the
// way, jumpFixes), hunt (the chance the hunters wait there, hunt.js
// huntOdds) }, or { ok: false, error, check? } (check: the flight check
// that keeps the ship at the station).
export function jumpPlan(campaign, rules, to) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Jumps are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const check = failingCheck(campaign, rules);
  if (check) return { ok: false, error: brokenWhy(check), check };
  const node = run.sector.nodes[to];
  if (!node) return { ok: false, error: 'There is no such place on the map.' };
  if (to === run.at) return { ok: false, error: `The ship is at ${node.name}.` };
  const links = reach(run.sector, run.at).get(to);
  if (!links) return { ok: false, error: `${node.name} is too far: a jump reaches the next node, a long jump the one past it.` };
  const long = links === 2;
  const supplies = jumpSupplies(campaign, rules, long);
  const { jumpHeat, longJumpHeat, longJumpFactor } = rules.balance;
  const heal = healRate(campaign, rules) * (long ? longJumpFactor : 1);
  const left = suppliesOver(campaign, rules);
  const heat = long ? longJumpHeat : jumpHeat;
  const dock = dockHeat(campaign, rules, node);
  const hunt = huntOdds(campaign, rules, withHeat(withHeat(campaign.heat, heat), dock), node.type);
  return { ok: true, kind: long ? 'long' : 'jump', supplies, left, heat, dock, hungry: campaign.supplies - left < supplies, heal, fixes: jumpFixes(campaign, rules), hunt };
}

// Jumps to node `to`, where the hunters may be waiting, or a hostile ship
// opens the approach. Returns { ok: true, campaign, plan, hunt (hunt.js
// rollHunt's) } or { ok: false, error }.
export function jump(campaign, rules, to) {
  const plan = jumpPlan(campaign, rules, to);
  if (!plan.ok) return plan;
  const moved = spend(campaign, rules, plan);
  const { run } = moved;
  const arrived = { ...moved, run: { ...run, at: to, seen: run.seen.includes(to) ? run.seen : [...run.seen, to], result: null } };
  const met = rollHunt(arrived, rules);
  return { ok: true, plan, campaign: openApproach(met.campaign, rules), hunt: met.hunt };
}

// What the station the ship is at sells: { ok: true, price (a supply),
// share (of the price, in percent, the station charges: standing.js), room
// (in the holds), most (what the credits and the room allow) }, or { ok:
// false, error } away from one.
export function supplyOffer(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Supplies are sold at stations.' };
  const price = rules.balance.supplyPrice;
  const share = shareHere(campaign, rules);
  const room = Math.max(0, supplyCapacity(campaign.ship, rules, campaign.crew) - campaign.supplies);
  return { ok: true, price, share, room, most: Math.min(room, mostFor(campaign.credits, price, share)) };
}

// What `count` supplies cost at the station an offer is from: their price
// at its share, in whole credits.
export function suppliesCost(offer, count) {
  return costAt(count, offer.price, offer.share);
}

// Buys `count` supplies at the station the ship is at. Returns { ok: true,
// campaign } or { ok: false, error }.
export function buySupplies(campaign, rules, count) {
  const offer = supplyOffer(campaign, rules);
  if (!offer.ok) return offer;
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: 'Buy one or more.' };
  if (count > offer.room) return { ok: false, error: offer.room ? `The holds take ${offer.room} more.` : 'The holds are full.' };
  const cost = suppliesCost(offer, count);
  if (cost > campaign.credits) return { ok: false, error: `${count} cost ${cost} credits.` };
  return { ok: true, campaign: { ...campaign, supplies: campaign.supplies + count, credits: campaign.credits - cost, flags: tally(campaign.flags, { suppliesBought: count }) } };
}

// What leaving the sector from its jump point takes: a jump's supplies,
// heat and healing, into the next sector's way in, where the hunters may
// wait; from the act's last sector, into the system past the charts (kind
// 'system'). { ok: true, kind: 'sector' or 'system', supplies, left, heat,
// hungry, heal, fixes, hunt } or { ok: false, error, last, check } (last:
// in the system, past which nothing is charted; check: as for a jump).
export function leavePlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Jumps are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  if (run.sector.system) return { ok: false, last: true, error: 'Nothing past the system is charted: settle one of its worlds.' };
  if (run.at !== run.sector.exit) return { ok: false, error: 'The sector is left from its jump point.' };
  const last = run.sector.index >= (actOf(campaign, rules)?.sectors ?? 0);
  const check = failingCheck(campaign, rules);
  if (check) return { ok: false, error: brokenWhy(check), check };
  const supplies = jumpSupplies(campaign, rules);
  const left = suppliesOver(campaign, rules);
  const { jumpHeat } = rules.balance;
  const hunt = huntOdds(campaign, rules, withHeat(campaign.heat, jumpHeat), 'start');
  return { ok: true, kind: last ? 'system' : 'sector', supplies, left, heat: jumpHeat, hungry: campaign.supplies - left < supplies, heal: healRate(campaign, rules), fixes: jumpFixes(campaign, rules), hunt };
}

// Leaves the sector into the next one, or from the last into the system
// past the charts, where the hunters may be waiting at the way in. Returns
// { ok: true, campaign, plan, hunt } or { ok: false, error }.
export function leaveSector(campaign, rules) {
  const plan = leavePlan(campaign, rules);
  if (!plan.ok) return plan;
  const moved = spend(campaign, rules, plan);
  const { value: seed, state: rng } = int(moved.rng, 0, MAX_SEED);
  const past = [...campaign.run.past, campaign.run.sector.name];
  const index = campaign.run.sector.index + 1;
  const sector = plan.kind === 'system' ? generateSystem(rules, seed, index) : generateSector(rules, seed, index, { avoid: past });
  const met = rollHunt({ ...moved, rng, run: freshRun(sector, past) }, rules);
  return { ok: true, plan, campaign: met.campaign, hunt: met.hunt };
}

// A jump's cost: the supplies the holds can't take, left behind; supplies
// eaten (and, short of them, hunger); heat, and docking's after it; what
// the med bay heals on the way (after any hunger); the wrecks an engineer
// fixes; and the flags' count.
function spend(campaign, rules, plan) {
  const left = plan.left ?? 0;
  const fed = plan.hungry ? campaign.crew.map((member) => ({ ...member, hp: Math.max(1, member.hp - rules.balance.hungerHp) })) : campaign.crew;
  const { crew, healed } = plan.heal ? healCrew(fed, plan.heal, rules) : { crew: fed, healed: 0 };
  const fixes = plan.fixes ?? [];
  const wrecks = { ...campaign.wrecks };
  for (const fix of fixes) delete wrecks[fix.uid];
  const flags = tally(campaign.flags, { jumps: 1, longJumps: plan.kind === 'long' ? 1 : 0, hungryJumps: plan.hungry ? 1 : 0, hpHealed: healed, suppliesLeft: left, jumpFixes: fixes.length });
  return { ...campaign, supplies: Math.max(0, campaign.supplies - left - plan.supplies), heat: withHeat(withHeat(campaign.heat, plan.heat), plan.dock ?? 0), crew, wrecks, flags };
}

export { tally } from './flags.js';
