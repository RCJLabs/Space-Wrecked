// The run (ROADMAP §2, act 2): the ship crossing sectors, jumping from node
// to node on each sector's map (gen/sector.js) and on into the next sector
// from its jump point, up to the act's last. Pure: every roll is the
// campaign's.
//
// campaign.run, from the act's first visit home (beginRun) on:
//   sector   the sector the ship is in, saved whole, so an update to the
//            game can't move a node under it: { index, name, nodes, links,
//            start, exit }. A node of a kind that holds events has one
//            (node.event, an id in data/events.json)
//   at       the node the ship is at
//   seen     the nodes it has been to in this sector, in order
//   past     the names of the sectors crossed before, oldest first
//   done     the nodes whose events are settled (events.js)
//   scans    the nodes the ship has scanned from
//   result   the last event settled, until the next jump: { node, event,
//            choice, outcome, roll, changes } (events.js)
//   approach the approach phase going on where the ship is, against a
//            hostile ship, or null (encounter.js)
// campaign.supplies: what the ship carries, up to supplyCapacity.
//
// A jump goes to a linked node: each crew member eats jumpSupplies, and heat
// rises by jumpHeat. A long jump goes two links away, past the node between:
// longJumpFactor times the supplies, and heat changes by longJumpHeat, since
// the pursuer loses the trail. A jump the supplies don't cover still goes:
// they run out, and every crew member goes hungry, losing hungerHp hit
// points, never the last. Stations sell supplies at supplyPrice each. From
// the jump point, leaving the sector is a jump into the next one's way in,
// rolled from the campaign's RNG as it is left. The flags count the jumps,
// the long ones, the hungry ones, the supplies bought and the scans.
//
// An event open at the ship's node holds every jump and scan until it is
// settled, and so does an approach until it is over and put away. Arriving
// where a hostile ship is opens the approach. What a node holds is known for
// the way in, the jump point and stations, which are on the charts, and for
// any node the ship has been at or next to; a scan shows every node within
// scanRange links of the ship, for scanHeat.
import { int } from '../core/rng.js';
import { actOf } from './acts.js';
import { shipStats } from './constraints.js';
import { openApproach } from './encounter.js';
import { tally } from './flags.js';
import { generateSector } from './gen/sector.js';
import { withHeat } from './heat.js';

const MAX_SEED = 0xffffffff;
// The kinds of node on the charts: known before the ship gets near.
const CHARTED = ['start', 'exit', 'station'];

// What the ship can carry: its lockers (baseSupplies) and its cargo holds.
export function supplyCapacity(ship, rules) {
  return rules.balance.baseSupplies + shipStats(ship, rules).cargo;
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
  return { ok: true, campaign: { ...campaign, rng, supplies: supplyCapacity(campaign.ship, rules), run: freshRun(sector, []) } };
}

// A run entering `sector`, with the sectors behind it.
function freshRun(sector, past) {
  return { sector, at: sector.start, seen: [sector.start], past, done: [], scans: [], result: null, approach: null };
}

// The event open at the ship's node: { node, event } (the event from
// data/events.json), or null when there is none or it is settled. An event
// the data no longer has is passed by.
export function openEvent(campaign, rules) {
  const { run } = campaign;
  const node = run?.sector.nodes[run.at];
  if (!node?.event || run.done.includes(run.at)) return null;
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

// The nodes whose kind is known on the map (see the top of the file).
export function knownNodes(run, rules) {
  const { sector } = run;
  const known = new Set(sector.nodes.filter((node) => CHARTED.includes(node.type)).map((node) => node.id));
  for (const id of run.seen) {
    known.add(id);
    for (const next of linked(sector, id)) known.add(next);
  }
  for (const id of run.scans) for (const near of within(sector, id, rules.balance.scanRange).keys()) known.add(near);
  return known;
}

// What a scan from the ship's node would show: { ok: true, heat (its
// change), reveals (the nodes it makes known) }, or { ok: false, error }.
export function scanPlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Scans are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const known = knownNodes(run, rules);
  const reveals = [...within(run.sector, run.at, rules.balance.scanRange).keys()].filter((id) => !known.has(id));
  if (!reveals.length) return { ok: false, error: 'Everything a scan would reach is known.' };
  return { ok: true, heat: rules.balance.scanHeat, reveals };
}

// Scans from the ship's node. Returns { ok: true, campaign, plan } or
// { ok: false, error }.
export function scan(campaign, rules) {
  const plan = scanPlan(campaign, rules);
  if (!plan.ok) return plan;
  const { run } = campaign;
  return { ok: true, plan, campaign: { ...campaign, heat: withHeat(campaign.heat, plan.heat), flags: tally(campaign.flags, { scans: 1 }), run: { ...run, scans: [...run.scans, run.at] } } };
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

// What a jump to node `to` takes, before it is made: { ok: true, kind:
// 'jump' or 'long', supplies (what it eats), heat (its change), hungry (the
// supplies don't cover it) }, or { ok: false, error }.
export function jumpPlan(campaign, rules, to) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Jumps are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const node = run.sector.nodes[to];
  if (!node) return { ok: false, error: 'There is no such place on the map.' };
  if (to === run.at) return { ok: false, error: `The ship is at ${node.name}.` };
  const links = reach(run.sector, run.at).get(to);
  if (!links) return { ok: false, error: `${node.name} is too far: a jump reaches the next node, a long jump the one past it.` };
  const long = links === 2;
  const supplies = jumpSupplies(campaign, rules, long);
  const { jumpHeat, longJumpHeat } = rules.balance;
  return { ok: true, kind: long ? 'long' : 'jump', supplies, heat: long ? longJumpHeat : jumpHeat, hungry: campaign.supplies < supplies };
}

// Jumps to node `to`, where a hostile ship opens the approach. Returns
// { ok: true, campaign, plan } or { ok: false, error }.
export function jump(campaign, rules, to) {
  const plan = jumpPlan(campaign, rules, to);
  if (!plan.ok) return plan;
  const moved = spend(campaign, rules, plan);
  const { run } = moved;
  const arrived = { ...moved, run: { ...run, at: to, seen: run.seen.includes(to) ? run.seen : [...run.seen, to], result: null } };
  return { ok: true, plan, campaign: openApproach(arrived, rules) };
}

// What the station the ship is at sells: { ok: true, price (a supply),
// room (in the holds), most (what the credits and the room allow) }, or
// { ok: false, error } away from one.
export function supplyOffer(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Supplies are sold at stations.' };
  const price = rules.balance.supplyPrice;
  const room = Math.max(0, supplyCapacity(campaign.ship, rules) - campaign.supplies);
  return { ok: true, price, room, most: Math.min(room, Math.floor(campaign.credits / price)) };
}

// Buys `count` supplies at the station the ship is at. Returns { ok: true,
// campaign } or { ok: false, error }.
export function buySupplies(campaign, rules, count) {
  const offer = supplyOffer(campaign, rules);
  if (!offer.ok) return offer;
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: 'Buy one or more.' };
  if (count > offer.room) return { ok: false, error: offer.room ? `The holds take ${offer.room} more.` : 'The holds are full.' };
  const cost = count * offer.price;
  if (cost > campaign.credits) return { ok: false, error: `${count} cost ${cost} credits.` };
  return { ok: true, campaign: { ...campaign, supplies: campaign.supplies + count, credits: campaign.credits - cost, flags: tally(campaign.flags, { suppliesBought: count }) } };
}

// What leaving the sector from its jump point takes: a jump's supplies and
// heat, into the next sector's way in. { ok: true, kind: 'sector',
// supplies, heat, hungry } or { ok: false, error, last } (last: the act's
// last sector, past which the charts end).
export function leavePlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Jumps are made from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  if (run.at !== run.sector.exit) return { ok: false, error: 'The sector is left from its jump point.' };
  if (run.sector.index >= (actOf(campaign, rules)?.sectors ?? 0)) return { ok: false, last: true, error: 'The charts end at this jump point.' };
  const supplies = jumpSupplies(campaign, rules);
  return { ok: true, kind: 'sector', supplies, heat: rules.balance.jumpHeat, hungry: campaign.supplies < supplies };
}

// Leaves the sector into the next one. Returns { ok: true, campaign, plan }
// or { ok: false, error }.
export function leaveSector(campaign, rules) {
  const plan = leavePlan(campaign, rules);
  if (!plan.ok) return plan;
  const moved = spend(campaign, rules, plan);
  const { value: seed, state: rng } = int(moved.rng, 0, MAX_SEED);
  const past = [...campaign.run.past, campaign.run.sector.name];
  const sector = generateSector(rules, seed, campaign.run.sector.index + 1, { avoid: past });
  return { ok: true, plan, campaign: { ...moved, rng, run: freshRun(sector, past) } };
}

// A jump's cost: supplies (and, short of them, hunger), heat, and the
// flags' count.
function spend(campaign, rules, plan) {
  const crew = plan.hungry ? campaign.crew.map((member) => ({ ...member, hp: Math.max(1, member.hp - rules.balance.hungerHp) })) : campaign.crew;
  const flags = tally(campaign.flags, { jumps: 1, longJumps: plan.kind === 'long' ? 1 : 0, hungryJumps: plan.hungry ? 1 : 0 });
  return { ...campaign, supplies: Math.max(0, campaign.supplies - plan.supplies), heat: withHeat(campaign.heat, plan.heat), crew, flags };
}

export { tally } from './flags.js';
