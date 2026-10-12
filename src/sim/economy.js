// Money and the shop (ROADMAP §4.6). Credits come in steps of PAY_STEP.
// A part's price is its module's cost (data/modules.json) times
// balance.json's buyPercent, and a dealer buys one back for sellPercent of
// the cost, rounded down: selling never pays more than buying costs.
//
// The shop is the district's dealer (data/districts.json): it sells parts
// from a stock rolled from its table (drops.js) with each job board, and
// buys any part on hand. A stock's prices are fixed when it is rolled, so
// an offer never changes once it is made. On the campaign:
//   shop   null until a stock is rolled, then [{ part, price }]: what is
//          for sale, one of each; a part bought leaves it
// Buying and selling are for the hangar (act 1). Pure: every roll is the
// campaign's.
import { atHangar } from './acts.js';
import { pickSeveral } from './drops.js';

export const PAY_STEP = 5;
// More parts than any stock holds: a guard on what a save can hold.
export const MAX_STOCK = 12;

// What the shop charges for a part, or null for a part it doesn't know.
export function priceOf(type, rules) {
  const cost = rules.modules.get(type)?.cost;
  return cost === undefined ? null : PAY_STEP * Math.round((cost * rules.balance.buyPercent) / 100 / PAY_STEP);
}

// What the shop pays for a part, or null for a part it doesn't know.
export function sellPriceOf(type, rules) {
  const cost = rules.modules.get(type)?.cost;
  return cost === undefined ? null : PAY_STEP * Math.floor((cost * rules.balance.sellPercent) / 100 / PAY_STEP);
}

// The district's shop: { name, dealer, pitch, size, parts }, or null.
export function shopIn(rules, district) {
  return rules.districts.get(district)?.shop ?? null;
}

// The campaign's shop: its district's, or null.
export function shopOf(campaign, rules) {
  return shopIn(rules, rules.backgrounds.get(campaign.background)?.district);
}

// A new stock for the district's shop: up to its size of different parts,
// picked by weight, each at its price. rng is an RNG state. Returns
// { stock, rng }; with no shop, an empty stock and the state unmoved.
export function rollStock(rules, rng, district) {
  const shop = shopIn(rules, district);
  if (!shop) return { stock: [], rng };
  const picked = pickSeveral(rng, shop.parts, shop.size);
  return { stock: picked.value.map((part) => ({ part, price: priceOf(part, rules) })), rng: picked.state };
}

// Whether the shop can sell the part at that place in its stock now:
// { item, ok, why }, item being { part, price } or null.
export function buyable(campaign, rules, index) {
  const item = campaign.shop?.[index] ?? null;
  const why = shopWhy(campaign, rules) ??
    (!item || !rules.modules.has(item.part) ? 'That part is gone.' : campaign.credits < item.price ? `It's ${item.price} credits.` : null);
  return { item, ok: !why, why };
}

// Buys the part at that place in the stock: its price off the credits, the
// part on hand, and gone from the stock. Returns { ok: true, campaign } or
// { ok: false, error }.
export function buyPart(campaign, rules, index) {
  const { item, ok, why } = buyable(campaign, rules, index);
  if (!ok) return { ok: false, error: why };
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits - item.price,
      parts: { ...campaign.parts, [item.part]: (campaign.parts[item.part] ?? 0) + 1 },
      shop: campaign.shop.filter((_, i) => i !== index),
      flags: { ...campaign.flags, partsBought: (campaign.flags.partsBought ?? 0) + 1 },
    },
  };
}

// Whether a part on hand can be sold now: { price, ok, why }.
export function sellable(campaign, rules, type) {
  const price = sellPriceOf(type, rules);
  const why = shopWhy(campaign, rules) ??
    (!campaign.parts[type] ? `There's no ${rules.modules.get(type)?.name ?? 'such part'} on hand.` : price === null ? 'The shop has no price for that.' : null);
  return { price, ok: !why, why };
}

// Sells a part on hand: its sell price onto the credits, and one fewer on
// hand. Returns { ok: true, campaign } or { ok: false, error }.
export function sellPart(campaign, rules, type) {
  const { price, ok, why } = sellable(campaign, rules, type);
  if (!ok) return { ok: false, error: why };
  const parts = { ...campaign.parts, [type]: campaign.parts[type] - 1 };
  if (!parts[type]) delete parts[type];
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits + price,
      parts,
      flags: { ...campaign.flags, partsSold: (campaign.flags.partsSold ?? 0) + 1 },
    },
  };
}

// Why the shop can't trade now, or null.
function shopWhy(campaign, rules) {
  if (!shopOf(campaign, rules)) return 'There is no shop here.';
  if (!atHangar(campaign, rules)) return 'Buy and sell from the hangar.';
  return null;
}
