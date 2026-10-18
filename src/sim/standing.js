// Standing with the sides (M33): how each side in data/factions.json feels
// about the crew, a whole number from STANDING_MIN to STANDING_MAX, in five
// levels whose edges are data/balance.json's: hostile below coldStanding,
// then cold, neutral from neutralStanding, friendly from friendlyStanding
// and trusted from trustedStanding. A new campaign starts its pursuer's side
// (data/backgrounds.json pursuer.side) at pursuerStanding and every other
// side at 0.
//
// What moves it, by data/balance.json's numbers, always kept within
// STANDING_MIN..STANDING_MAX:
//   - a job in act 1 (contracts.js endJob): done, jobStanding for its
//     client's side (data/districts.json) and as much against the side its
//     enemies are on (data/contracts.json against); lost, lostStanding
//     against them;
//   - an event's outcome (events.js): its effects' standing;
//   - a side's ship (data/ships.json side) boarded, blown up or left adrift
//     by the crew (encounter.js): shipStanding off its side.
// Raids and act 3 move nothing.
//
// What it changes:
//   - at a station of a side (data/factions.json stations, by the station's
//     name), supplies, repairs, patching and recruits cost the side's
//     level's share of the price (hostilePrice to trustedPrice, in percent),
//     rounded as each price is;
//   - at a station of the pursuer's side, the crew's first trade since the
//     ship arrived adds dockHeat: they log the ship (travel.js tradeHeat and
//     dockShip; M33's fix, where it was the jump there);
//   - a job in act 1 from a client whose side is friendly pays friendlyPay
//     percent more, and trusted trustedPay, in steps of PAY_STEP;
//   - a side's ship met at a node (encounter.js) waves a friendly or trusted
//     crew through, and opens fire on a hostile one before the first round.
//
// campaign.standing: { [side]: standing }. A side the campaign lacks (one
// the content added later) stands at 0. Pure.
import { PAY_STEP } from './economy.js';

export const STANDING_MIN = -10;
export const STANDING_MAX = 10;
// The levels, lowest first.
export const LEVELS = ['hostile', 'cold', 'neutral', 'friendly', 'trusted'];
// Where each level above hostile begins, the share of a price each charges
// and the more each pays a job: the balance numbers' names.
const EDGES = { cold: 'coldStanding', neutral: 'neutralStanding', friendly: 'friendlyStanding', trusted: 'trustedStanding' };
const PRICES = { hostile: 'hostilePrice', cold: 'coldPrice', neutral: 'neutralPrice', friendly: 'friendlyPrice', trusted: 'trustedPrice' };
const PAYS = { friendly: 'friendlyPay', trusted: 'trustedPay' };
// The approach outcomes (approach.js) in which the crew struck a ship: it
// boarded her (or disabled her and left her), blew her up, or left her
// adrift.
export const STRUCK = ['boarded', 'destroyed', 'adrift'];

// The level a standing is at.
export function levelOf(value, rules) {
  let level = LEVELS[0];
  for (const next of LEVELS.slice(1)) if (value >= rules.balance[EDGES[next]]) level = next;
  return level;
}

// The least standing at a level: where it begins (M33b, a quest's pay-off
// raises the pursuer's side to one).
export function floorOf(level, rules) {
  return level === LEVELS[0] ? STANDING_MIN : rules.balance[EDGES[level]];
}

// The next level up from a standing and the points it takes to reach it:
// { level, by }, or null at the top.
export function nextLevel(value, rules) {
  const level = LEVELS[LEVELS.indexOf(levelOf(value, rules)) + 1];
  return level ? { level, by: rules.balance[EDGES[level]] - value } : null;
}

// The crew's standing with a side.
export function standingWith(campaign, side) {
  return campaign.standing?.[side] ?? 0;
}

// The side the campaign's pursuer is on, or null.
export function pursuerSide(campaign, rules) {
  return rules.backgrounds.get(campaign.background)?.pursuer?.side ?? null;
}

// Where a new campaign from the background stands with each side, in the
// sides' order: { [side]: standing }.
export function startStanding(rules, background) {
  const pursuer = rules.backgrounds.get(background)?.pursuer?.side;
  return Object.fromEntries([...rules.factions.sides.keys()].map((side) => [side, side === pursuer ? rules.balance.pursuerStanding : 0]));
}

// Moves the crew's standing: moves is { [side]: by }. Each is added and
// kept within STANDING_MIN..STANDING_MAX; a side the content doesn't have
// is passed by. Returns { campaign, changes: [{ side, by, from, to }] }:
// by as asked, from and to what it was and came to.
export function moveStanding(campaign, rules, moves) {
  const changes = [];
  let standing = campaign.standing ?? {};
  for (const [side, by] of Object.entries(moves ?? {})) {
    if (!by || !rules.factions.sides.has(side)) continue;
    const from = standing[side] ?? 0;
    const to = Math.max(STANDING_MIN, Math.min(STANDING_MAX, from + by));
    standing = { ...standing, [side]: to };
    changes.push({ side, by, from, to });
  }
  return { campaign: changes.length ? { ...campaign, standing } : campaign, changes };
}

// The sides a job on the board is for and against: { for: its client's
// side, against: its enemies' }, each null for none.
export function jobSides(job, rules) {
  return { for: rules.clients.get(job.client)?.side ?? null, against: rules.contracts.jobs.get(job.contract)?.against ?? null };
}

// What a job's end moves: { [side]: by }. Done, jobStanding for its client's
// side and against its enemies'; lost, lostStanding against them.
export function jobMoves(job, rules, won) {
  const sides = jobSides(job, rules);
  const { jobStanding, lostStanding } = rules.balance;
  const moves = {};
  if (won && sides.for) moves[sides.for] = jobStanding;
  if (sides.against) moves[sides.against] = (moves[sides.against] ?? 0) - (won ? jobStanding : lostStanding);
  return moves;
}

// How much more a job pays for its client's side's level, in percent:
// friendlyPay or trustedPay, else 0.
export function payBonus(campaign, rules, job) {
  const side = jobSides(job, rules).for;
  const key = side ? PAYS[levelOf(standingWith(campaign, side), rules)] : null;
  return key ? rules.balance[key] : 0;
}

// What a job pays done: its pay with the bonus, in steps of PAY_STEP.
export function jobPay(campaign, rules, job) {
  const bonus = payBonus(campaign, rules, job);
  return bonus ? PAY_STEP * Math.round((job.credits * (100 + bonus)) / 100 / PAY_STEP) : job.credits;
}

// The side a station or a shipyard (M37b) belongs to, by its name, or
// null: for nobody's, and for a node that is neither.
export function stationSide(node, rules) {
  const { stations } = rules.factions;
  return (node?.type === 'station' || node?.type === 'shipyard') && Object.hasOwn(stations, node.name) ? stations[node.name] : null;
}

// The share of the price, in percent, the station `node` charges the crew:
// its side's level's, or 100 at nobody's.
export function priceShare(campaign, rules, node) {
  const side = stationSide(node, rules);
  return side ? rules.balance[PRICES[levelOf(standingWith(campaign, side), rules)]] : 100;
}

// The share where the ship is: the station's, or 100 anywhere else.
export function shareHere(campaign, rules) {
  const { run } = campaign;
  return priceShare(campaign, rules, run?.sector.nodes[run.at]);
}

// `count` of something priced `price` credits apiece, at `share` percent:
// the whole, rounded to whole credits (halves up).
export function costAt(count, price, share) {
  return Math.floor((count * price * share + 50) / 100);
}

// The most of something priced `price` apiece at `share` percent that
// `credits` buy, by costAt; Infinity when it costs nothing.
export function mostFor(credits, price, share) {
  return price * share > 0 ? Math.floor((100 * credits + 49) / (price * share)) : Infinity;
}

// The heat of docking at node `node`, paid on the first trade there
// (travel.js tradeHeat): dockHeat at a station of the pursuer's side, else
// 0.
export function dockHeat(campaign, rules, node) {
  const side = stationSide(node, rules);
  return side !== null && side === pursuerSide(campaign, rules) ? rules.balance.dockHeat : 0;
}

// How a side's ship met at a node greets the crew: 'waved' through when the
// crew is friendly or trusted with its side, 'fired' on when hostile, and
// null otherwise, or for a ship of no side (preset: data/ships.json's).
export function patrolWelcome(campaign, rules, preset) {
  const side = preset?.side;
  if (!side || !rules.factions.sides.has(side)) return null;
  const level = levelOf(standingWith(campaign, side), rules);
  if (level === 'friendly' || level === 'trusted') return 'waved';
  return level === 'hostile' ? 'fired' : null;
}

// What an approach's end costs with the other ship's side (preset): the
// crew struck her (STRUCK), shipStanding off it. { [side]: by }, or {}.
export function shipMoves(preset, kind, rules) {
  return preset?.side && STRUCK.includes(kind) ? { [preset.side]: -rules.balance.shipStanding } : {};
}

// Whether a saved standing is readable: sides by id, each within
// STANDING_MIN..STANDING_MAX, no more than `most` of them.
export function isStanding(value, most) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= most && entries.every(([side, n]) => /^[a-z][a-z0-9-]*$/.test(side) && Number.isInteger(n) && n >= STANDING_MIN && n <= STANDING_MAX);
}

// Whether saved standing changes (an event's result, an approach's outcome)
// are readable: [{ side, by, from, to }].
export function isStandingChanges(value) {
  const within = (n) => Number.isInteger(n) && n >= STANDING_MIN && n <= STANDING_MAX;
  return Array.isArray(value) && value.every((change) => change && typeof change === 'object' && /^[a-z][a-z0-9-]*$/.test(change.side) && Number.isInteger(change.by) && Math.abs(change.by) <= 2 * STANDING_MAX && within(change.from) && within(change.to));
}
