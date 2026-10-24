// The sides' traders at the colony (M53). While the crew stands friendly or
// better with a side, its trader calls at the colony the ship is landed at
// every traderEvery days, on its own day of them (the side's place among
// the sides sets it), and stays the day: colony.trader is set at the day's
// end that brings it, and the next day's end clears it. A trader buys
// materials, traderLot at a time for traderLotPrice credits each lot, up to
// traderLots lots a call, and sells one part, of its side's yard's maker,
// picked by a roll of its own seed (the campaign's rolls don't move), at its
// price (economy.js priceOf) times the side's share (standing.js
// sideShare). A side the crew isn't friendly with sends none; on a trip or
// a voyage none calls. Pure.
//
//   colony.trader   { side, day, part (a module id, or null), bought, sold
//                   (lots bought from the colony) } or null
import { pick, seedFrom } from '../core/rng.js';
import { atColony } from './acts.js';
import { priceOf } from './economy.js';
import { costAt, levelOf, sideShare, standingWith } from './standing.js';

const FRIENDLY = new Set(['friendly', 'trusted']);

// The sides in data order, by id.
function sidesOf(rules) {
  return [...(rules.factions?.sides?.values() ?? [])];
}

// The day of every traderEvery a side's trader calls on: 0 to every - 1.
export function callDay(side, rules) {
  const every = rules.balance.traderEvery;
  const index = sidesOf(rules).findIndex((s) => s.id === side);
  return (index * 3 + 2) % every;
}

// The sides the crew stands friendly or better with.
export function friendlySides(campaign, rules) {
  return sidesOf(rules).filter((side) => FRIENDLY.has(levelOf(standingWith(campaign, side.id), rules))).map((side) => side.id);
}

// Who calls on `day`: the first friendly side whose day it is, or null.
export function callerOn(campaign, rules, day) {
  const every = rules.balance.traderEvery;
  return friendlySides(campaign, rules).find((side) => day % every === callDay(side, rules)) ?? null;
}

// The next day from `day` on (it included) a friendly side's trader calls:
// { side, day }, or null with no friendly side.
export function nextCall(campaign, rules, day) {
  for (let d = day; d < day + rules.balance.traderEvery; d++) {
    const side = callerOn(campaign, rules, d);
    if (side) return { side, day: d };
  }
  return null;
}

// The part a side's trader brings on `day`: one of its yard's maker's
// parts, picked by the seed of the campaign, the side and the day; null
// when the maker has none.
export function traderPart(campaign, rules, side, day) {
  const maker = Object.keys(rules.factions.sides.get(side)?.yard ?? {})[0];
  const parts = [...rules.modules.values()].filter((def) => def.manufacturer === maker && priceOf(def.id, rules) !== null).map((def) => def.id);
  if (!parts.length) return null;
  return pick(seedFrom(`trader:${campaign.seed}:${side}:${day}`), parts).value;
}

// The colony's trader after a day's end that brought it to `day`: a new
// one if a friendly side calls on it, none otherwise. On a trip or a
// voyage none calls.
export function traderAfter(campaign, rules, day) {
  if (campaign.colony.trip || campaign.colony.voyage) return null;
  const side = callerOn(campaign, rules, day);
  return side ? { side, day, part: traderPart(campaign, rules, side, day), bought: false, sold: 0 } : null;
}

// What the trader here would trade, and why not: { ok, why, trader, side
// (its name), part: { type, price, ok, why } or null, lots: { left, lot,
// price, ok, why } }.
export function tradePlan(campaign, rules) {
  const trader = campaign.colony?.trader ?? null;
  if (!trader || !atColony(campaign, rules) || campaign.colony.trip) return { ok: false, why: 'No trader is here.', trader: null, side: null, part: null, lots: null };
  const side = rules.factions.sides.get(trader.side);
  const share = sideShare(campaign, rules, trader.side);
  const price = trader.part ? costAt(1, priceOf(trader.part, rules), share) : null;
  const part = trader.part
    ? {
        type: trader.part,
        price,
        ok: !trader.bought && campaign.credits >= price,
        why: trader.bought ? 'Sold already.' : campaign.credits < price ? `It is ${price} credits.` : null,
      }
    : null;
  const { traderLot: lot, traderLotPrice, traderLots } = rules.balance;
  const left = traderLots - trader.sold;
  const lots = {
    left,
    lot,
    price: traderLotPrice,
    ok: left > 0 && campaign.colony.materials >= lot,
    why: left <= 0 ? 'The trader has bought all it will.' : campaign.colony.materials < lot ? `A lot is ${lot} materials.` : null,
  };
  return { ok: true, why: null, trader, side: side?.name ?? trader.side, part, lots };
}

// Buys the trader's part into the hold: { ok: true, campaign } or { ok:
// false, error }.
export function buyFromTrader(campaign, rules) {
  const plan = tradePlan(campaign, rules);
  if (!plan.ok) return { ok: false, error: plan.why };
  if (!plan.part) return { ok: false, error: 'The trader brought no part.' };
  if (!plan.part.ok) return { ok: false, error: plan.part.why };
  const { type, price } = plan.part;
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits - price,
      parts: { ...campaign.parts, [type]: (campaign.parts[type] ?? 0) + 1 },
      colony: { ...campaign.colony, trader: { ...plan.trader, bought: true } },
      flags: { ...campaign.flags, traderBuys: (campaign.flags.traderBuys ?? 0) + 1 },
    },
  };
}

// Sells the trader a lot of materials: { ok: true, campaign } or { ok:
// false, error }.
export function sellToTrader(campaign, rules) {
  const plan = tradePlan(campaign, rules);
  if (!plan.ok) return { ok: false, error: plan.why };
  if (!plan.lots.ok) return { ok: false, error: plan.lots.why };
  const { lot, price } = plan.lots;
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits + price,
      colony: { ...campaign.colony, materials: campaign.colony.materials - lot, trader: { ...plan.trader, sold: plan.trader.sold + 1 } },
      flags: { ...campaign.flags, traderSales: (campaign.flags.traderSales ?? 0) + 1 },
    },
  };
}
