// How the test voyage's player (tools/voyage.js) judges things: an event's
// choices, what a node is worth passing through, and the way on to a
// sector's jump point. What things are worth to it, in credits (WORTH):
//   supply   2: out here, supplies are dearer than at a station
//   short    6 a supply while the holds hold less than BUFFER_JUMPS jumps'
//            worth: a hungry jump costs the whole crew hit points
//   hp       2: wounds heal only at stations (patch.js) or with a med bay
//   heat     0.3 a point: it does nothing in act 2 yet, but it will
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
import { maxHp } from '../src/sim/campaign.js';
import { crewRoom } from '../src/sim/crew.js';
import { sellPriceOf } from '../src/sim/economy.js';
import { choiceProblem } from '../src/sim/events.js';
import { recruitOffer } from '../src/sim/recruits.js';
import { jumpSupplies, knownNodes, leavePlan, linked, reach, supplyCapacity } from '../src/sim/travel.js';

export const WORTH = { supply: 2, short: 6, hp: 2, heat: 0.3, part: 0.5, hostile: -30 };
const BUFFER_JUMPS = 4;
export const HIRE_JUMPS = 10;

// Whether to board a ship the player has disabled: with at least half the
// crew's hit points between them; a crew worn down leaves her.
export function boardIt(campaign, rules) {
  const most = campaign.crew.reduce((sum, member) => sum + maxHp(member, rules), 0);
  const now = campaign.crew.reduce((sum, member) => sum + member.hp, 0);
  return now * 2 >= most;
}

// The recruit to sign on where the ship is, by slot, or null: with room
// aboard, the holds lasting HIRE_JUMPS jumps with one more, and the fee left
// beyond a holdful's price, the one whose job the crew has fewest of, the
// most hit points then the first slot breaking ties.
export function hireWho(campaign, rules) {
  const offer = recruitOffer(campaign, rules);
  if (!offer.length || campaign.crew.length >= crewRoom(campaign.ship, rules)) return null;
  if (supplyCapacity(campaign.ship, rules) < HIRE_JUMPS * rules.balance.jumpSupplies * (campaign.crew.length + 1)) return null;
  const reserve = supplyCapacity(campaign.ship, rules) * rules.balance.supplyPrice;
  if (campaign.credits - rules.balance.recruitFee < reserve) return null;
  const count = (job) => campaign.crew.filter((member) => member.job === job).length;
  return [...offer].sort((a, b) => count(a.job) - count(b.job) || b.hp - a.hp || a.slot - b.slot)[0].slot;
}

// What a change in supplies is worth: the part of it below the buffer at
// WORTH.short each, the rest at WORTH.supply; gains only as far as the
// holds take.
function suppliesWorth(campaign, rules, change) {
  const buffer = BUFFER_JUMPS * jumpSupplies(campaign, rules);
  const from = campaign.supplies;
  const to = Math.max(0, Math.min(supplyCapacity(campaign.ship, rules), from + change));
  const [low, high] = to > from ? [from, to] : [to, from];
  const short = Math.max(0, Math.min(high, buffer) - Math.min(low, buffer));
  const worth = short * WORTH.short + (high - low - short) * WORTH.supply;
  return to > from ? worth : -worth;
}

// What an outcome's effects are worth to the player, in credits, for the
// campaign as it stands.
export function effectsWorth(campaign, rules, effects) {
  let worth = effects.credits ?? 0;
  if (effects.supplies) worth += suppliesWorth(campaign, rules, effects.supplies);
  worth -= WORTH.heat * (effects.heat ?? 0);
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
export function bestChoice(campaign, rules, event) {
  let best = null;
  for (const choice of event.choices) {
    if (choiceProblem(campaign, choice)) continue;
    const worth = choice.outcomes.reduce((sum, outcome) => sum + (outcome.chance / 100) * effectsWorth(campaign, rules, outcome.effects), 0);
    if (!best || worth > best.worth) best = { choice, worth };
  }
  return best;
}

// What an unknown node is worth on average: the mix's kinds by weight, each
// its events' best choices on average, or a hostile ship's worth.
function unknownWorth(campaign, rules) {
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
    const each = events.reduce((sum, event) => sum + (bestChoice(campaign, rules, event)?.worth ?? 0), 0) / events.length;
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
  const room = supplyCapacity(campaign.ship, rules);
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
  if (leavePlan({ ...campaign, run: { ...campaign.run, at: sector.exit } }, rules).ok) eat();
  return { hungry, value: WORTH.supply * supplies + credits + worth };
}

// Whether way a beats way b (or there is no b): hungry least, then worth
// most.
function better(a, b) {
  return !b || (a.hungry !== b.hungry ? a.hungry < b.hungry : a.value > b.value);
}

// What each node is worth passing through, for the campaign as it stands.
function nodeJudge(campaign, rules) {
  const { run } = campaign;
  const known = knownNodes(run, rules);
  const guess = unknownWorth(campaign, rules);
  return (id) => {
    if (!known.has(id)) return guess;
    const node = run.sector.nodes[id];
    if (run.done.includes(id)) return 0;
    if (node.hostile) return WORTH.hostile;
    const event = node.event ? rules.events.get(node.event) : null;
    return event ? (bestChoice(campaign, rules, event)?.worth ?? 0) : 0;
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
// a node id. With the 'heat' policy, when heat is at the hunters' level or
// over, a long jump on instead, if it leaves the holds above the buffer,
// the way on from there is forecast to go hungry not once, it is worth as
// much as the way it skips, counting the heat it sheds at its worth, and it
// doesn't pass the station the way calls at next while the holds have room.
// The forecast counts only the credits on hand, not what the nodes will
// pay: so a long jump goes over nodes that pay nothing, empty space or a
// hostile ship, not over those that pay.
export function nextJump(campaign, rules, policy) {
  const { sector, at } = campaign.run;
  const judge = nodeJudge(campaign, rules);
  const way = bestWay(campaign, rules, at, { supplies: campaign.supplies, credits: campaign.credits }, judge);
  if (policy !== 'heat' || campaign.heat < rules.balance.huntHeat) return way.way[1];
  if (sector.nodes[way.way[1]].type === 'station' && campaign.supplies < supplyCapacity(campaign.ship, rules)) return way.way[1];
  const cost = jumpSupplies(campaign, rules, true);
  if (campaign.supplies - cost < BUFFER_JUMPS * jumpSupplies(campaign, rules)) return way.way[1];
  const price = rules.balance.supplyPrice;
  const room = supplyCapacity(campaign.ship, rules);
  // What the heat a long jump sheds is worth, against the two jumps it
  // takes the place of.
  const shed = WORTH.heat * (2 * rules.balance.jumpHeat - rules.balance.longJumpHeat);
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
    if (there.hungry === 0 && there.value >= way.value && better(there, long)) long = there;
  }
  return long ? long.to : way.way[1];
}
