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
// Trading docks the ship as at a station (travel.js dockShip).
//
// From M39 a yard sells hull frames too (data/frames.json): every frame
// with a price but the ship's own, at yardPercent of its price and the
// yard's share, less half what the ship's own frame fetches there, priced
// the same way, never under nothing. Bought, the ship moves over at once
// (reframe.js onFrame), and its frame's trait and thrust for mass with it:
// a ship that then fails a flight check stays until a refit fixes it
// (travel.js failingCheck, M23h's rule). The flags count the frames
// bought. Pure.
import { seedFrom } from '../core/rng.js';
import { atYard } from './acts.js';
import { pickSeveral } from './drops.js';
import { PAY_STEP, priceOf, sellPriceOf } from './economy.js';
import { tally } from './flags.js';
import { onFrame } from './reframe.js';
import { costAt, priceShare, stationSide } from './standing.js';
import { dockShip, failingCheck, hereOf, holdOf, tradeHeat } from './travel.js';

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

// What a yard charges for a frame before its side's share, as for a part:
// yardPercent of its price; null for a frame with none (an enemy's).
export function frameYardPrice(frame, rules) {
  if (!frame?.cost) return null;
  return Math.max(PAY_STEP, PAY_STEP * Math.round((frame.cost * rules.balance.yardPercent) / 100 / PAY_STEP));
}

// The frames for sale where the ship is, in data order: [{ frame (its id),
// name, price (the yard's, at its share), worth (what the ship's own frame
// fetches against it: half its price there, in steps of PAY_STEP), cost
// (the price less the worth, never under 0) }]; [] away from a yard.
export function framesHere(campaign, rules) {
  if (!atYard(campaign, rules)) return [];
  const share = priceShare(campaign, rules, hereOf(campaign));
  const own = frameYardPrice(rules.frames.get(campaign.ship.frame), rules);
  const worth = own === null ? 0 : PAY_STEP * Math.floor(costAt(1, own, share) / 2 / PAY_STEP);
  return [...rules.frames.values()]
    .filter((frame) => frame.id !== campaign.ship.frame && frameYardPrice(frame, rules) !== null)
    .map((frame) => {
      const price = costAt(1, frameYardPrice(frame, rules), share);
      return { frame: frame.id, name: frame.name, price, worth, cost: Math.max(0, price - worth) };
    });
}

// What moving the ship onto frame `frameId` takes: { ok: true, item
// (framesHere's), ship (moved over), shift (how far its parts moved, [dx,
// dy]), check (the first flight check it would then fail, which keeps it
// at the yard until a refit, or null), dock (the heat it adds) } or { ok:
// false, error }.
export function framePlan(campaign, rules, frameId) {
  if (!atYard(campaign, rules)) return { ok: false, error: 'Frames are sold at shipyards.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  if (frameId === campaign.ship.frame) return { ok: false, error: `The ship is on the ${rules.frames.get(frameId)?.name ?? 'frame'} already.` };
  const item = framesHere(campaign, rules).find((i) => i.frame === frameId);
  if (!item) return { ok: false, error: "The yard doesn't sell that frame." };
  const moved = onFrame(campaign.ship, rules, frameId);
  if (!moved.ok) return moved;
  if (campaign.credits < item.cost) return { ok: false, error: `The ${item.name} is ${item.cost} credits, the ship's own frame given in part payment.` };
  const check = failingCheck({ ...campaign, ship: moved.ship }, rules);
  return { ok: true, item, ship: moved.ship, shift: moved.shift, check, dock: tradeHeat(campaign, rules) };
}

// Moves the ship onto frame `frameId`, its cost off the credits. Returns {
// ok: true, campaign, plan } or { ok: false, error }.
export function buyFrame(campaign, rules, frameId) {
  const plan = framePlan(campaign, rules, frameId);
  if (!plan.ok) return plan;
  const docked = dockShip(campaign, rules);
  return { ok: true, plan, campaign: { ...docked, ship: plan.ship, credits: docked.credits - plan.item.cost, flags: tally(docked.flags, { framesBought: 1 }) } };
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
