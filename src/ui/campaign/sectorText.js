// Text for the sector map (sector.js): where the ship is on the run
// (src/sim/travel.js), what the nodes hold as far as it is known, what a
// jump to a node would take, what a station sells and what a scan would
// show, what it would repair and patch up, and its refits (M23h). The event
// card's words are eventText.js's, and the approach screen's
// approachText.js's. rules are the content tables (src/sim/defs.js).
import { actOf, canRefit } from '../../sim/campaign.js';
import { withHeat } from '../../sim/heat.js';
import { maxHp } from '../../sim/campaign.js';
import { crewRoom } from '../../sim/crew.js';
import { healRate } from '../../sim/medbay.js';
import { patchPlan } from '../../sim/patch.js';
import { recruitOffer } from '../../sim/recruits.js';
import { repairPlan, wrecksToRepair } from '../../sim/repair.js';
import { brokenWhy, failingCheck, holdOf, jumpPlan, jumpSupplies, knownNodes, leavePlan, linked, openEvent, reach, scanPlan, suppliesOver, supplyCapacity, supplyOffer } from '../../sim/travel.js';
import { actTitle, crewText, heatText } from './hubText.js';

// What the sector map shows, for a campaign on the run:
//   act, where   "Act 2 · The run", "Sector 1 of 5 · Breaker's Yard"
//   heat         the hangar's meter (hubText.js heatText)
//   nodes        [{ id, col, row, rows, x, y, type, name, here, seen,
//                links, known, done }]: rows is how many nodes share its
//                column, links how far a jump from here is: 1, 2 (a long
//                jump) or 0; known whether what it holds is known (its type
//                is 'unknown' until it is), done whether its event is settled
//   links        [{ a, b, near }]: near when it joins the node the ship is at
//   here         the node the ship is at, as nodeText says it
//   crew         as the hangar's
//   hold         [[label, value]]: supplies and credits, what the med bay
//                heals, if there is one working, the parts wrecked aboard
//                and the parts on hand, if any
//   offer        what the station sells, or null away from one: { line,
//                why, buys: [{ count, label, ask, text }] }
//   refit        the station's refits, or null away from one: { label,
//                parts (how many on hand), line, broken (the words for a
//                flight check that keeps the ship here, or null) }
//   patch        what the station's medic would patch up, or null away
//                from one or with no one hurt: { ok, label, ask, text, why }
//   repair       what the station would repair, or null away from one or
//                with nothing wrecked: { ok, label, ask, text, why }
//   leave        null away from the jump point; there { ok, last, label,
//                ask, title, lines, tone }, last at the act's last
//   scan         what a scan would show, or null when it would show nothing:
//                { label, ask, text }
//   deciding     true while an event is open where the ship is
//   hint         { tone, text }
export function sectorText(campaign, rules) {
  const { sector, at, seen, done } = campaign.run;
  const act = actOf(campaign, rules);
  const far = reach(sector, at);
  const known = knownNodes(campaign.run, rules);
  const columns = new Map();
  for (const node of sector.nodes) columns.set(node.col, (columns.get(node.col) ?? 0) + 1);
  const each = jumpSupplies(campaign, rules);
  const offer = supplyOffer(campaign, rules);
  const leave = at === sector.exit ? leaveText(campaign, rules) : null;
  return {
    act: actTitle(campaign.act, rules),
    where: `Sector ${sector.index} of ${act?.sectors ?? sector.index} · ${sector.name}`,
    heat: heatText(campaign, rules),
    nodes: sector.nodes.map((node) => ({
      id: node.id,
      col: node.col,
      row: node.row,
      rows: columns.get(node.col),
      x: node.x,
      y: node.y,
      type: known.has(node.id) ? node.type : 'unknown',
      name: node.name,
      here: node.id === at,
      seen: seen.includes(node.id),
      links: far.get(node.id) ?? 0,
      known: known.has(node.id),
      done: done.includes(node.id),
    })),
    links: sector.links.map(([a, b]) => ({ a, b, near: a === at || b === at })),
    here: nodeText(sector.nodes[at], rules, { done: done.includes(at) }),
    crew: crewText(campaign, rules),
    hold: [
      ['Supplies', suppliesRow(campaign, rules)],
      ['Credits', campaign.credits.toLocaleString('en')],
      ...medbayRow(campaign, rules),
      ...wrecksLine(campaign, rules),
      ...partsRow(campaign, rules),
    ],
    offer: offer.ok ? offerText(campaign, rules, offer) : null,
    refit: refitText(campaign, rules),
    repair: offer.ok ? repairText(campaign, rules) : null,
    patch: offer.ok ? patchText(campaign, rules) : null,
    leave,
    scan: scanText(campaign, rules),
    deciding: Boolean(openEvent(campaign, rules) || campaign.run.approach),
    hint: sectorHint(campaign, rules, { each, offer, leave, known }),
  };
}

// A node: { name, kind, text }. kind is its kind's name, unless that is its
// name, with its event's title until the event is settled ("Derelict: Dead
// hauler"), or its hostile ship's until it is met ("Hostile ship: Pirate
// cutter"); text is its kind's words. Unknown, it says so.
export function nodeText(node, rules, { known = true, done = false } = {}) {
  if (!known) return { name: node.name, kind: 'Unknown', text: 'Too far to make out. Come closer, or scan.' };
  const kind = rules.nodeTypes.get(node.type);
  const name = kind?.name ?? node.type;
  const event = node.event && !done ? rules.events.get(node.event) : null;
  const ship = node.hostile && !done ? rules.ships.get(node.hostile.ship) : null;
  const what = name === node.name ? '' : name;
  if (ship) return { name: node.name, kind: `${what}: ${ship.name}`, text: kind?.text ?? '' };
  if (done && node.hostile) return { name: node.name, kind: `${what}, gone`, text: 'Nobody here now but the debris.' };
  return { name: node.name, kind: event ? `${what}: ${event.title}` : done && node.event ? `${what}, been and done` : what, text: kind?.text ?? '' };
}

// The supplies aboard, of what the holds take, and those past it that stay
// behind at the next jump (a refit took a hold off).
function suppliesRow(campaign, rules) {
  const over = suppliesOver(campaign, rules);
  return `${campaign.supplies} of ${supplyCapacity(campaign.ship, rules)}${over ? `, ${over} won't fit` : ''}`;
}

// The parts on hand, not fitted, as a holdings row, or none.
function partsRow(campaign, rules) {
  const names = Object.entries(campaign.parts)
    .sort(([a], [b]) => partName(a, rules).localeCompare(partName(b, rules)))
    .map(([type, count]) => (count > 1 ? `${partName(type, rules)} ×${count}` : partName(type, rules)));
  return names.length ? [['Parts', names.join(', ')]] : [];
}

// The station's refits: Refit opens construction mode on the ship, with the
// parts on hand, for nothing. null away from a station.
function refitText(campaign, rules) {
  if (!campaign.run || !canRefit(campaign, rules)) return null;
  const parts = Object.values(campaign.parts).reduce((sum, count) => sum + count, 0);
  const check = failingCheck(campaign, rules);
  const line = parts ? `${parts === 1 ? 'A part' : `${parts} parts`} on hand: Refit fits ${parts === 1 ? 'it' : 'them'}, free.` : 'Refit moves and turns the ship\'s parts, free.';
  return { label: 'Refit', parts, line, broken: check ? brokenWhy(check) : null };
}

// What a working med bay heals each of the wounded a jump, as a holdings
// row, or none.
function medbayRow(campaign, rules) {
  const rate = healRate(campaign, rules);
  return rate ? [['Med bay', `${rate} a jump`]] : [];
}

// The parts wrecked aboard, as a holdings row, or none.
function wrecksLine(campaign, rules) {
  const wrecks = wrecksToRepair(campaign, rules);
  return wrecks.length ? [['Wrecked', wrecks.map((wreck) => rules.modules.get(wreck.type)?.name ?? wreck.type).join(', ')]] : [];
}

// What the station's medic would patch up, two taps, or null with no one
// hurt.
function patchText(campaign, rules) {
  const plan = patchPlan(campaign, rules);
  if (!plan.ok && plan.total === undefined) return null;
  if (!plan.ok) return { ok: false, label: 'Patch up', ask: 'Patch up?', text: plan.error, why: `${plan.error} You have ${campaign.credits}.` };
  const all = plan.cost === plan.total;
  const who = plan.heals.map((heal) => `${heal.name} ${heal.from} to ${heal.to}`).join(', ');
  return {
    ok: true,
    label: `Patch up · ${plan.cost}`,
    ask: `Patch for ${plan.cost}?`,
    text: `${all ? 'Patches up' : 'Your credits cover'} ${who} for ${plan.cost} credits${all ? '' : `, of ${plan.total} to heal everyone`}. Tap again to patch up.`,
    why: null,
  };
}

// What the station would repair, two taps, or null with nothing wrecked.
function repairText(campaign, rules) {
  const plan = repairPlan(campaign, rules);
  if (!plan.ok && !plan.wrecks) return null;
  const name = (wreck) => `the ${(rules.modules.get(wreck.type)?.name ?? wreck.type).toLowerCase()}`;
  if (!plan.ok) return { ok: false, label: 'Repair', ask: 'Repair?', text: plan.error, why: `${plan.error} You have ${campaign.credits}.` };
  const all = plan.repairs.length === plan.wrecks.length;
  return {
    ok: true,
    label: `Repair · ${plan.cost}`,
    ask: `Repair for ${plan.cost}?`,
    text: `${all ? 'Repairs' : 'Your credits cover'} ${plan.repairs.map(name).join(', ')} for ${plan.cost} credits${all ? '' : `, of ${plan.total} for everything`}. Tap again to repair.`,
    why: null,
  };
}

// What a scan would show from here: { label, ask, text }, or null.
function scanText(campaign, rules) {
  const plan = scanPlan(campaign, rules);
  if (!plan.ok) return null;
  const { scanRange } = rules.balance;
  const count = plan.reveals.length;
  return {
    label: 'Scan',
    ask: 'Scan?',
    text: `A scan shows what ${count === 1 ? 'one node holds' : `${count} nodes hold`} within ${scanRange} jumps, for ${plan.heat} heat. Tap again to scan.`,
  };
}

// What a jump to node `id` would take, for the panel and Jump: { ok,
// long, label ('Jump' or 'Long jump'), title, node (nodeText), lines,
// tone, way (the nodes it passes, from here), left (the supplies that stay
// behind) }. When it can't be made, head says why in a word ("Out of
// reach", or "Can't leave" while a flight check keeps the ship at a
// station) and lines say why in full.
export function jumpText(campaign, rules, id) {
  const { sector, at } = campaign.run;
  const target = sector.nodes[id];
  const node = nodeText(target, rules, { known: knownNodes(campaign.run, rules).has(id), done: campaign.run.done.includes(id) });
  const plan = jumpPlan(campaign, rules, id);
  if (!plan.ok) return { ok: false, long: false, label: 'Jump', head: plan.check ? "Can't leave" : 'Out of reach', title: target.name, node, lines: [plan.error], tone: plan.check ? 'bad' : 'info', way: [], left: 0 };
  const long = plan.kind === 'long';
  const label = long ? 'Long jump' : 'Jump';
  const lines = [...leftLine(campaign, rules, plan), suppliesLine(campaign, rules, plan), heatLine(campaign, plan), ...healLine(campaign, rules, plan)];
  if (long) lines.push('A long jump passes the node between, and the pursuer loses the trail.');
  const between = long ? linked(sector, at).find((next) => linked(sector, next).includes(id)) : null;
  const way = long ? [at, between, id] : [at, id];
  return { ok: true, long, label, title: `${label} to ${target.name}`, node, lines, tone: plan.hungry ? 'bad' : plan.left ? 'warn' : 'info', way, left: plan.left };
}

// The supplies the holds can't take, left behind as the ship jumps: a
// line, or none.
function leftLine(campaign, rules, plan) {
  return plan.left ? [`${plan.left} supplies stay behind: the holds take ${supplyCapacity(campaign.ship, rules)}.`] : [];
}

// What a jump eats, and what is left after it, or the hunger: of what the
// holds carry, once any supplies past them are left behind.
function suppliesLine(campaign, rules, plan) {
  const carried = campaign.supplies - (plan.left ?? 0);
  if (!plan.hungry) return `Eats ${plan.supplies} supplies: ${carried - plan.supplies} left.`;
  return `Eats ${plan.supplies} supplies, and the ship has ${carried}: the crew goes hungry, ${rules.balance.hungerHp} hit points each.`;
}

// What the med bay heals on the way, with anyone hurt: a line, or none.
function healLine(campaign, rules, plan) {
  const hurt = campaign.crew.some((member) => member.hp < maxHp(member, rules));
  return plan.heal && hurt ? [`The med bay heals each of the wounded ${plan.heal} on the way.`] : [];
}

function heatLine(campaign, plan) {
  const after = withHeat(campaign.heat, plan.heat);
  const change = plan.heat < 0 ? `−${-plan.heat}` : `+${plan.heat}`;
  return `Heat ${change}: ${after}.`;
}

// The station's supplies: a jump's worth, and as many as the holds and
// the credits take, each two taps.
function offerText(campaign, rules, { price, room, most }) {
  const each = jumpSupplies(campaign, rules);
  const counts = [...new Set([Math.min(each, most), most])].filter((count) => count > 0);
  const cost = (count) => `${count * price} credit${count * price === 1 ? '' : 's'}`;
  return {
    line: `Supplies, ${price} credit${price === 1 ? '' : 's'} each. The holds take ${room} more.`,
    why: !room ? 'The holds are full.' : !most ? `You have ${campaign.credits} credits.` : null,
    buys: counts.map((count) => ({
      count,
      label: count === room ? `Fill up · ${count}` : `Buy ${count}`,
      ask: `${count} for ${cost(count)}?`,
      text: `${count} supplies for ${cost(count)}. Tap again to buy.`,
    })),
  };
}

// The jump point: on into the next sector, or the end of the charts.
function leaveText(campaign, rules) {
  const plan = leavePlan(campaign, rules);
  if (plan.last) return { ok: false, last: true, label: 'Jump on', ask: '', title: 'The end of the charts', lines: [actOf(campaign, rules)?.stub ?? plan.error], tone: 'info' };
  const next = campaign.run.sector.index + 1;
  const lines = plan.ok ? [...leftLine(campaign, rules, plan), suppliesLine(campaign, rules, plan), heatLine(campaign, plan), ...healLine(campaign, rules, plan)] : [plan.error];
  return { ok: plan.ok, last: false, label: 'Jump on', ask: 'Jump on?', title: `On to sector ${next}`, lines, tone: plan.hungry || plan.check ? 'bad' : plan.left ? 'warn' : 'info' };
}

// What to do next on the map, the most pressing first.
function sectorHint(campaign, rules, { each, offer, leave, known }) {
  const held = holdOf(campaign, rules);
  if (held) return { tone: 'warn', text: held };
  const check = failingCheck(campaign, rules);
  if (check) return { tone: 'bad', text: brokenWhy(check) };
  const over = offer.ok ? suppliesOver(campaign, rules) : 0;
  if (over) return { tone: 'warn', text: `The holds take ${supplyCapacity(campaign.ship, rules)} now: ${over} supplies stay behind at the next jump. Refit a hold back on to keep them.` };
  const wrecked = Object.keys(campaign.wrecks).length;
  const hurt = campaign.crew.some((member) => member.hp < maxHp(member, rules));
  const parts = wrecked === 1 ? 'A part is' : `${wrecked} parts are`;
  if (offer.ok && wrecked && hurt) return { tone: 'good', text: `Supplies, repairs and a medic here. ${parts} wrecked aboard, and the crew is hurt.` };
  if (offer.ok && wrecked) return { tone: 'good', text: `Supplies and repairs here. ${parts} wrecked aboard.` };
  if (offer.ok && hurt) return { tone: 'good', text: 'Supplies and a medic here. The crew is hurt.' };
  if (leave?.last) return { tone: 'info', text: 'The charts end here. The rest of the run comes in later updates.' };
  if (offer.ok && offer.room && offer.most) return { tone: 'good', text: `Supplies sell here. A jump eats ${each}.` };
  const recruits = campaign.crew.length < crewRoom(campaign.ship, rules) ? recruitOffer(campaign, rules).length : 0;
  if (recruits) return { tone: 'good', text: `${recruits === 1 ? 'A recruit wants' : `${recruits} recruits want`} a berth here: tap Crew.` };
  // The parts on hand: the station's panel says so too, whatever comes
  // first here.
  const onHand = offer.ok ? Object.values(campaign.parts).reduce((sum, count) => sum + count, 0) : 0;
  if (onHand) return { tone: 'good', text: `${onHand === 1 ? 'A part' : `${onHand} parts`} on hand: tap Refit, on the ship's panel, to fit ${onHand === 1 ? 'it' : 'them'}, free.` };
  if (leave) return { tone: 'good', text: `Tap Jump on for sector ${campaign.run.sector.index + 1}.` };
  if (campaign.supplies < each) return { tone: 'bad', text: 'Short of supplies: the next jump goes hungry. Stations and traders sell them.' };
  const { sector, at } = campaign.run;
  if ([...reach(sector, at).keys()].some((id) => !known.has(id))) return { tone: 'info', text: 'A ? is a node not made out yet: come closer, or Scan.' };
  return { tone: 'info', text: 'Tap a ringed node to plan a jump; dashed is a long jump.' };
}

function partName(type, rules) {
  return rules.modules.get(type)?.name ?? type;
}
