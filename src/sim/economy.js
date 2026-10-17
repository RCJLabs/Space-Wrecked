// Money and the shop (ROADMAP §4.6). Credits come in steps of PAY_STEP.
// A part's price is its module's cost (data/modules.json) times
// balance.json's buyPercent, and a dealer buys one back for sellPercent of
// the cost, rounded down: selling never pays more than buying costs.
//
// The shop is the district's dealer (data/districts.json): it sells parts
// from a stock rolled from its table (drops.js) with each job board, and
// buys any part on hand. Since M37 it sells weapons too, from a table of
// its own, and buys any spare weapon back. A stock's prices are fixed when
// it is rolled, so an offer never changes once it is made. On the campaign:
//   shop   null until a stock is rolled, then [{ part, price }] and
//          [{ weapon, price }]: what is for sale, one of each; one bought
//          leaves it
// Buying and selling are for the hangar (act 1). Pure: the parts are
// rolled with the campaign's RNG, the weapons from a seed of their own.
import { seedFrom } from '../core/rng.js';
import { atHangar } from './acts.js';
import { pickSeveral } from './drops.js';
import { withArms } from './loadout.js';

export const PAY_STEP = 5;
// More than any stock holds, parts and weapons together: a guard on what a
// save can hold.
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

// What the shop charges for a weapon (M37): its cost (data/weapons.json)
// at buyPercent, as a part's; null for one it doesn't know.
export function weaponPrice(id, rules) {
  const cost = rules.weapons.get(id)?.cost;
  return cost === undefined ? null : PAY_STEP * Math.round((cost * rules.balance.buyPercent) / 100 / PAY_STEP);
}

// What the shop pays for a spare weapon: its cost at sellPercent, rounded
// down; null for one it doesn't know.
export function weaponSellPrice(id, rules) {
  const cost = rules.weapons.get(id)?.cost;
  return cost === undefined ? null : PAY_STEP * Math.floor((cost * rules.balance.sellPercent) / 100 / PAY_STEP);
}

// The district's shop: { name, dealer, pitch, size, parts, armsSize?,
// arms? }, or null.
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

// The weapons for a new stock (M37): up to the shop's armsSize different
// weapons by weight from its table, each at its price. They are rolled
// from the campaign's seed and how many stocks it has had (stocksRolled),
// not the campaign's RNG, so no other roll moves.
export function rollArms(rules, campaign, district) {
  const shop = shopIn(rules, district);
  if (!shop?.arms || !shop.armsSize) return [];
  const picked = pickSeveral(seedFrom(`arms ${campaign.seed} ${stocksRolled(campaign)}`), shop.arms, shop.armsSize);
  return picked.value.map((weapon) => ({ weapon, price: weaponPrice(weapon, rules) }));
}

// How many stocks the shop has had before the one rolling now: one a job
// played, and the first.
function stocksRolled(campaign) {
  return (campaign.flags.jobsDone ?? 0) + (campaign.flags.jobsFailed ?? 0);
}

// Whether the shop can sell what is at that place in its stock now:
// { item, ok, why }, item being { part, price }, { weapon, price } or
// null.
export function buyable(campaign, rules, index) {
  const item = campaign.shop?.[index] ?? null;
  const known = item && (item.weapon ? rules.weapons.has(item.weapon) : rules.modules.has(item.part));
  const why = shopWhy(campaign, rules) ??
    (!known ? `That ${item?.weapon ? 'weapon' : 'part'} is gone.` : campaign.credits < item.price ? `It's ${item.price} credits.` : null);
  return { item, ok: !why, why };
}

// Buys what is at that place in the stock: its price off the credits, the
// part or the weapon (M37) on hand, and gone from the stock. Returns
// { ok: true, campaign } or { ok: false, error }.
export function buyPart(campaign, rules, index) {
  const { item, ok, why } = buyable(campaign, rules, index);
  if (!ok) return { ok: false, error: why };
  const flag = item.weapon ? 'armsBought' : 'partsBought';
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits - item.price,
      ...(item.weapon ? { arms: withArms(campaign.arms ?? {}, item.weapon) } : { parts: { ...campaign.parts, [item.part]: (campaign.parts[item.part] ?? 0) + 1 } }),
      shop: campaign.shop.filter((_, i) => i !== index),
      flags: { ...campaign.flags, [flag]: (campaign.flags[flag] ?? 0) + 1 },
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

// Whether a spare weapon can be sold now (M37): { price, ok, why }. Only a
// spare: a weapon someone carries comes off them first.
export function weaponSellable(campaign, rules, id) {
  const price = weaponSellPrice(id, rules);
  const why = shopWhy(campaign, rules) ??
    (!(campaign.arms?.[id] > 0) ? `There's no spare ${rules.weapons.get(id)?.name.toLowerCase() ?? 'weapon like that'} on hand.` : price === null ? 'The shop has no price for that.' : null);
  return { price, ok: !why, why };
}

// Sells a spare weapon: its sell price onto the credits, and one fewer on
// hand. Returns { ok: true, campaign } or { ok: false, error }.
export function sellWeapon(campaign, rules, id) {
  const { price, ok, why } = weaponSellable(campaign, rules, id);
  if (!ok) return { ok: false, error: why };
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits + price,
      arms: withArms(campaign.arms, id, -1),
      flags: { ...campaign.flags, armsSold: (campaign.flags.armsSold ?? 0) + 1 },
    },
  };
}

// Why the shop can't trade now, or null.
function shopWhy(campaign, rules) {
  if (!shopOf(campaign, rules)) return 'There is no shop here.';
  if (!atHangar(campaign, rules)) return 'Buy and sell from the hangar.';
  return null;
}
