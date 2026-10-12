// Text for the sector map (sector.js): where the ship is on the run
// (src/sim/travel.js), what a jump to a node would take, and what a
// station sells. rules are the content tables (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { withHeat } from '../../sim/heat.js';
import { jumpPlan, jumpSupplies, leavePlan, linked, reach, supplyCapacity, supplyOffer } from '../../sim/travel.js';
import { actTitle, crewText, heatText } from './hubText.js';

// What the sector map shows, for a campaign on the run:
//   act, where   "Act 2 · The run", "Sector 1 of 5 · Breaker's Yard"
//   heat         the hangar's meter (hubText.js heatText)
//   nodes        [{ id, col, row, rows, x, y, type, name, here, seen,
//                links }]: rows is how many nodes share its column, links
//                how far a jump from here is: 1, 2 (a long jump) or 0
//   links        [{ a, b, near }]: near when it joins the node the ship is at
//   here         the node the ship is at, as nodeText says it
//   crew         as the hangar's
//   hold         [[label, value]]: supplies and credits
//   offer        what the station sells, or null away from one: { line,
//                why, buys: [{ count, label, ask, text }] }
//   leave        null away from the jump point; there { ok, last, label,
//                ask, title, lines, tone }, last at the act's last
//   hint         { tone, text }
export function sectorText(campaign, rules) {
  const { sector, at, seen } = campaign.run;
  const act = actOf(campaign, rules);
  const far = reach(sector, at);
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
      type: node.type,
      name: node.name,
      here: node.id === at,
      seen: seen.includes(node.id),
      links: far.get(node.id) ?? 0,
    })),
    links: sector.links.map(([a, b]) => ({ a, b, near: a === at || b === at })),
    here: nodeText(sector.nodes[at], rules),
    crew: crewText(campaign, rules),
    hold: [
      ['Supplies', `${campaign.supplies} of ${supplyCapacity(campaign.ship, rules)}`],
      ['Credits', campaign.credits.toLocaleString('en')],
    ],
    offer: offer.ok ? offerText(campaign, rules, offer) : null,
    leave,
    hint: sectorHint(campaign, rules, { each, offer, leave }),
  };
}

// A node: { name, kind (its kind's name, unless that is its name), text
// (its kind's words) }.
export function nodeText(node, rules) {
  const kind = rules.nodeTypes.get(node.type);
  const name = kind?.name ?? node.type;
  return { name: node.name, kind: name === node.name ? '' : name, text: kind?.text ?? '' };
}

// What a jump to node `id` would take, for the panel and Jump: { ok,
// long, label ('Jump' or 'Long jump'), title, node (nodeText), lines,
// tone, way (the nodes it passes, from here) }. Out of reach, lines say
// why.
export function jumpText(campaign, rules, id) {
  const { sector, at } = campaign.run;
  const target = sector.nodes[id];
  const node = nodeText(target, rules);
  const plan = jumpPlan(campaign, rules, id);
  if (!plan.ok) return { ok: false, long: false, label: 'Jump', title: target.name, node, lines: [plan.error], tone: 'info', way: [] };
  const long = plan.kind === 'long';
  const label = long ? 'Long jump' : 'Jump';
  const lines = [suppliesLine(campaign, rules, plan), heatLine(campaign, plan)];
  if (long) lines.push('A long jump passes the node between, and the pursuer loses the trail.');
  const between = long ? linked(sector, at).find((next) => linked(sector, next).includes(id)) : null;
  const way = long ? [at, between, id] : [at, id];
  return { ok: true, long, label, title: `${label} to ${target.name}`, node, lines, tone: plan.hungry ? 'bad' : 'info', way };
}

// What a jump eats, and what is left after it, or the hunger.
function suppliesLine(campaign, rules, plan) {
  if (!plan.hungry) return `Eats ${plan.supplies} supplies: ${campaign.supplies - plan.supplies} left.`;
  return `Eats ${plan.supplies} supplies, and the ship has ${campaign.supplies}: the crew goes hungry, ${rules.balance.hungerHp} hit points each.`;
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
  const lines = plan.ok ? [suppliesLine(campaign, rules, plan), heatLine(campaign, plan)] : [plan.error];
  return { ok: plan.ok, last: false, label: 'Jump on', ask: 'Jump on?', title: `On to sector ${next}`, lines, tone: plan.hungry ? 'bad' : 'info' };
}

// What to do next on the map, the most pressing first.
function sectorHint(campaign, rules, { each, offer, leave }) {
  if (leave?.last) return { tone: 'info', text: 'The charts end here. The rest of the run comes in later updates.' };
  if (offer.ok && offer.room && offer.most) return { tone: 'good', text: `Supplies sell here. A jump eats ${each}.` };
  if (leave) return { tone: 'good', text: `Tap Jump on for sector ${campaign.run.sector.index + 1}.` };
  if (campaign.supplies < each) return { tone: 'bad', text: 'Short of supplies: the next jump goes hungry. Stations sell them.' };
  return { tone: 'info', text: 'Tap a ringed node to plan a jump; dashed is a long jump.' };
}
