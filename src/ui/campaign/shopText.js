// Words for the shop (src/sim/economy.js): what the district's dealer has
// for sale, what the crew could sell, and which parts the flight checklist
// still needs. Since M37 the dealer sells weapons too, and buys spares.
// Pure: rules are the content tables (src/sim/defs.js).
import { partsNeeded } from '../../sim/campaign.js';
import { buyable, sellable, shopOf, weaponSellable } from '../../sim/economy.js';
import { carries } from '../../sim/loadout.js';
import { baseOf, countOfAny, versionsOf } from '../../sim/makers.js';
import { cardFor } from '../builder/card.js';
import { weaponFacts, weaponWord } from './armsText.js';

// The shop as its screen shows it, or null where there is none:
//   name, dealer, pitch   "Dutch's yard", "Dutch Abernathy, the scrap
//                         dealer", and the dealer's words
//   credits               "250 credits"
//   stock   for sale, what the ship needs first, then the weapons: [{
//           index, key, part, weapon, name, price, needed, facts, carried,
//           ok, why, action, ask }], index being its place in the
//           campaign's stock (what buying takes)
//   held    the parts on hand, to sell, what the ship needs first, then the
//           spare weapons: [{ key, part, weapon, name, count, price,
//           needed, facts, carried, ok, why, action, ask, warn }], warn
//           null, or what to know before selling
//   hint    { tone, text }: what to do here
// For each: key the part's type, or 'w:' and the weapon's id; part or
// weapon the one that isn't null; price "200 credits" (what it costs, or
// what it fetches); needed null, or what the checklist still needs of a
// part, any maker's version counting ("Needed for launch: 3, none on
// hand"); facts a part's size and stats, or a weapon's kind, aim and rules
// (armsText.js weaponFacts); carried who aboard could carry a weapon, or
// null for a part; ok and why whether it can be bought or sold now; action
// and ask the button's words before and after its first tap ("Buy · 200",
// "Buy for 200?").
export function shopText(campaign, rules) {
  const shop = shopOf(campaign, rules);
  if (!shop) return null;
  const needs = partsNeeded(campaign, rules);
  const need = (type) => needs[baseOf(rules.modules.get(type) ?? { id: type })] ?? 0;
  const onHand = (type) => countOfAny(rules, type, (version) => campaign.parts[version] ?? 0);
  const needed = (type) => (need(type) ? `Needed for launch: ${need(type)}, ${onHand(type) ? `${onHand(type)} on hand` : 'none on hand'}` : null);
  const facts = (type) => {
    const def = rules.modules.get(type);
    return def ? cardFor(rules, def).lines.slice(0, 2) : [];
  };
  const name = (type) => rules.modules.get(type)?.name ?? type;
  const offers = (campaign.shop ?? []).map((item, index) => {
    const { ok, why } = buyable(campaign, rules, index);
    const trade = { index, price: credits(item.price), ok, why, action: `Buy · ${item.price}`, ask: `Buy for ${item.price}?` };
    if (item.weapon) return { ...trade, ...weaponOf(campaign, rules, item.weapon) };
    return { ...trade, key: item.part, part: item.part, weapon: null, name: name(item.part), needed: needed(item.part), facts: facts(item.part), carried: null };
  });
  const stock = [...neededFirst(offers.filter((item) => item.part)), ...offers.filter((item) => item.weapon)];
  const parts = neededFirst(Object.entries(campaign.parts).map(([part, count]) => {
    const { price, ok, why } = sellable(campaign, rules, part);
    const warn = need(part) ? `The ship needs the ${name(part)}` : null;
    return { key: part, part, weapon: null, name: name(part), count, price: price === null ? '' : credits(price), needed: needed(part), facts: facts(part), carried: null, ok, why, action: `Sell · ${price}`, ask: `Sell for ${price}?`, warn };
  }));
  const spares = Object.entries(campaign.arms ?? {}).filter(([, count]) => count > 0).map(([id, count]) => {
    const { price, ok, why } = weaponSellable(campaign, rules, id);
    return { ...weaponOf(campaign, rules, id), count, price: price === null ? '' : credits(price), ok, why, action: `Sell · ${price}`, ask: `Sell for ${price}?`, warn: null };
  });
  const held = [...parts, ...spares];
  const dealer = rules.clients.get(shop.dealer);
  const wanted = stock.find((item) => item.needed && item.ok) ?? stock.find((item) => item.needed);
  const toFit = held.find((item) => item.needed);
  return {
    name: shop.name,
    dealer: dealer ? `${dealer.name}, ${dealer.title}` : '',
    pitch: shop.pitch,
    credits: credits(campaign.credits),
    stock,
    held,
    hint: shopHint({ wanted, toFit, stock, shop }),
  };
}

// The shop's offer of a part the checklist asks for, for the hangar's
// goal lines: "200 at Dutch's yard", or, where it has only another maker's
// version, "Bastion engine 220 at Dutch's yard"; null when it has none.
export function offerText(campaign, rules, type) {
  const shop = shopOf(campaign, rules);
  if (!shop) return null;
  const versions = versionsOf(rules, type);
  const offers = (campaign.shop ?? []).filter((offer) => versions.includes(offer.part));
  const item = offers.find((offer) => offer.part === type) ?? offers.sort((a, b) => a.price - b.price)[0];
  if (!item) return null;
  return item.part === type ? `${item.price} at ${shop.name}` : `${rules.modules.get(item.part)?.name ?? item.part} ${item.price} at ${shop.name}`;
}

// A weapon as the shop shows it (M37): { key, part: null, weapon, name,
// needed: null, facts, carried }: carried says who aboard could carry it.
function weaponOf(campaign, rules, id) {
  const weapon = rules.weapons.get(id);
  const able = campaign.crew.filter((member) => carries(rules.jobs.get(member.job), weapon)).map((member) => member.name);
  const carried = able.length ? `${listed(able)} could carry it.` : `No one aboard carries the ${weaponWord(id, rules)}.`;
  return { key: `w:${id}`, part: null, weapon: id, name: weapon?.name ?? id, needed: null, facts: weaponFacts(id, rules), carried };
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

// What to do at the shop: buy a part the ship needs, fit one bought, save
// up for one, or look around.
function shopHint({ wanted, toFit, stock, shop }) {
  if (wanted?.ok) return { tone: 'good', text: `The ship needs the ${wanted.name}: buy it, then fit it with Build.` };
  if (toFit) return { tone: 'good', text: `The ${toFit.name} is on hand: fit it with Build, back at the hangar.` };
  if (wanted) return { tone: 'info', text: `The ${wanted.name} the ship needs is ${wanted.price}. Jobs pay the rest.` };
  if (!stock.length) return { tone: 'info', text: `${shop.name} is sold out. The stock turns over after every job.` };
  return { tone: 'info', text: 'Pick a part or a weapon to read about it. Buying or selling takes two taps.' };
}

// The parts the ship needs before the rest, each kept in its order.
function neededFirst(items) {
  return [...items.filter((item) => item.needed), ...items.filter((item) => !item.needed)];
}

function credits(n) {
  return `${n.toLocaleString('en')} credits`;
}
