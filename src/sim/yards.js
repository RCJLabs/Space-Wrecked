// The shipyards on the run (ROADMAP M37b). One stands in every sector,
// and sells yardSize parts (data/balance.json), the same on every visit:
// rolled from the campaign's seed, the sector and the yard, not the
// campaign's RNG, as a station's rack is (racks.js). Every part can come up:
// a part of a maker its side leans to (`yard` on the side in
// data/factions.json) weighs that much, every other part 1, and nobody's
// yard rolls evenly. A part costs yardPercent of the dealer's price
// (economy.js priceOf), at the yard's share of it (M33, standing.js). One
// bought is gone from the yard (run.yarded).
//
// The yard buys any part on hand at the dealer's price (economy.js
// sellPriceOf), never more than it would charge for that part itself, so
// nothing is made by buying a part and selling it straight back. A part
// taken off the ship in a refit (campaign.js refitShip) is on hand to sell.
// Trading docks the ship as at a station (travel.js dockShip). Pure.
import { seedFrom } from '../core/rng.js';
import { atYard } from './acts.js';
import { pickSeveral } from './drops.js';
import { PAY_STEP, priceOf, sellPriceOf } from './economy.js';
import { tally } from './flags.js';
import { costAt, priceShare, stationSide } from './standing.js';
import { dockShip, hereOf, holdOf, tradeHeat } from './travel.js';

// What a yard charges for a part before its side's share: yardPercent of
// the dealer's price, in steps of PAY_STEP and never under one; null for a
// part it doesn't know.
export function yardPriceOf(type, rules) {
  const price = priceOf(type, rules);
  if (price === null) return null;
  return Math.max(PAY_STEP, PAY_STEP * Math.round((price * rules.balance.yardPercent) / 100 / PAY_STEP));
}

// The yard at node `nodeId` in the ship's sector, bought or not: [{ slot,
// part (its type), price }]; [] for a node that isn't a yard.
export function yardAt(campaign, rules, nodeId) {
  const { sector } = campaign.run;
  const node = sector.nodes[nodeId];
  if (node?.type !== 'shipyard') return [];
  const picked = pickSeveral(seedFrom(`yard ${campaign.seed} ${sector.index} ${sector.name} ${nodeId}`), tableOf(node, rules), rules.balance.yardSize ?? 0);
  const share = priceShare(campaign, rules, node);
  return picked.value.map((part, slot) => ({ slot, part, price: costAt(1, yardPriceOf(part, rules), share) }));
}

// The parts for sale where the ship is: those of the yard it is at not
// bought yet, or [] away from one.
export function yardHere(campaign, rules) {
  if (!atYard(campaign, rules)) return [];
  const { at, yarded = [] } = campaign.run;
  return yardAt(campaign, rules, at).filter((item) => !yarded.some((y) => y.node === at && y.slot === item.slot));
}

// What buying the part in `slot` takes: { ok: true, item, dock (the heat it
// adds) } or { ok: false, error }.
export function yardPlan(campaign, rules, slot) {
  if (!atYard(campaign, rules)) return { ok: false, error: 'Parts are sold at shipyards.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const item = yardHere(campaign, rules).find((i) => i.slot === slot);
  if (!item) return { ok: false, error: "That one's gone from the yard." };
  if (campaign.credits < item.price) return { ok: false, error: `The ${partName(item.part, rules)} is ${item.price} credits.` };
  return { ok: true, item, dock: tradeHeat(campaign, rules) };
}

// Buys the part in `slot`: on hand, its price off the credits, and gone
// from the yard. Returns { ok: true, campaign, plan } or { ok: false,
// error }.
export function buyFromYard(campaign, rules, slot) {
  const plan = yardPlan(campaign, rules, slot);
  if (!plan.ok) return plan;
  const { item } = plan;
  const docked = dockShip(campaign, rules);
  const { run } = docked;
  return {
    ok: true,
    plan,
    campaign: {
      ...docked,
      credits: docked.credits - item.price,
      parts: { ...docked.parts, [item.part]: (docked.parts[item.part] ?? 0) + 1 },
      flags: tally(docked.flags, { partsBought: 1 }),
      run: { ...run, yarded: [...(run.yarded ?? []), { node: run.at, slot: item.slot }] },
    },
  };
}

// What the yard the ship is at pays for a part of `type`: the dealer's
// price, at most what the yard would charge for it; null for a part it
// doesn't know.
export function yardBuyBack(campaign, rules, type) {
  const sell = sellPriceOf(type, rules);
  const charge = yardPriceOf(type, rules);
  if (sell === null || charge === null) return null;
  return Math.min(sell, costAt(1, charge, priceShare(campaign, rules, hereOf(campaign))));
}

// What selling a part of `type` on hand takes: { ok: true, type, price,
// dock } or { ok: false, error }.
export function yardSellPlan(campaign, rules, type) {
  if (!atYard(campaign, rules)) return { ok: false, error: 'Parts are bought at shipyards.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  if (!campaign.parts[type]) return { ok: false, error: `There's no ${partName(type, rules)} on hand.` };
  const price = yardBuyBack(campaign, rules, type);
  if (price === null) return { ok: false, error: 'The yard has no price for that.' };
  return { ok: true, type, price, dock: tradeHeat(campaign, rules) };
}

// Sells a part of `type` on hand to the yard: its price onto the credits,
// one fewer on hand. Returns { ok: true, campaign, plan } or { ok: false,
// error }.
export function sellToYard(campaign, rules, type) {
  const plan = yardSellPlan(campaign, rules, type);
  if (!plan.ok) return plan;
  const docked = dockShip(campaign, rules);
  const left = docked.parts[type] - 1;
  const { [type]: _, ...rest } = docked.parts;
  return {
    ok: true,
    plan,
    campaign: {
      ...docked,
      credits: docked.credits + plan.price,
      parts: left > 0 ? { ...rest, [type]: left } : rest,
      flags: tally(docked.flags, { partsSold: 1 }),
    },
  };
}

// The table a yard's stock rolls from: every part, a part of a maker its
// side leans to weighing that, every other part 1.
function tableOf(node, rules) {
  const side = stationSide(node, rules);
  const lean = (side && rules.factions.sides.get(side)?.yard) ?? {};
  return Object.fromEntries([...rules.modules.values()].map((def) => [def.id, lean[def.manufacturer] ?? 1]));
}

function partName(type, rules) {
  return (rules.modules.get(type)?.name ?? type).toLowerCase();
}
