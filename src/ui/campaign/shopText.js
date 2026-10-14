// Words for the shop (src/sim/economy.js): what the district's dealer has
// for sale, what the crew could sell, and which parts the flight checklist
// still needs. Pure: rules are the content tables (src/sim/defs.js).
import { partsNeeded } from '../../sim/campaign.js';
import { buyable, sellable, shopOf } from '../../sim/economy.js';
import { baseOf, countOfAny, versionsOf } from '../../sim/makers.js';
import { cardFor } from '../builder/card.js';

// The shop as its screen shows it, or null where there is none:
//   name, dealer, pitch   "Dutch's yard", "Dutch Abernathy, the scrap
//                         dealer", and the dealer's words
//   credits               "250 credits"
//   stock   for sale, what the ship needs first: [{ index, part, name,
//           price, needed, facts, ok, why, action, ask }], index being the
//           part's place in the campaign's stock (what buying takes)
//   held    the parts on hand, to sell, what the ship needs first:
//           [{ part, name, count, price, needed, facts, ok, why, action,
//           ask, warn }], warn null, or what to know before selling
//   hint    { tone, text }: what to do here
// For each part: price "200 credits" (what it costs, or what it fetches);
// needed null, or what the checklist still needs of it, any maker's
// version counting ("Needed for launch: 3, none on hand"); facts its size
// and stats; ok and why whether
// it can be bought or sold now; action and ask the button's words before
// and after its first tap ("Buy · 200", "Buy for 200?").
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
  const stock = neededFirst((campaign.shop ?? []).map((item, index) => {
    const { ok, why } = buyable(campaign, rules, index);
    return { index, part: item.part, name: name(item.part), price: credits(item.price), needed: needed(item.part), facts: facts(item.part), ok, why, action: `Buy · ${item.price}`, ask: `Buy for ${item.price}?` };
  }));
  const held = neededFirst(Object.entries(campaign.parts).map(([part, count]) => {
    const { price, ok, why } = sellable(campaign, rules, part);
    const warn = need(part) ? `The ship needs the ${name(part)}` : null;
    return { part, name: name(part), count, price: price === null ? '' : credits(price), needed: needed(part), facts: facts(part), ok, why, action: `Sell · ${price}`, ask: `Sell for ${price}?`, warn };
  }));
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

// What to do at the shop: buy a part the ship needs, fit one bought, save
// up for one, or look around.
function shopHint({ wanted, toFit, stock, shop }) {
  if (wanted?.ok) return { tone: 'good', text: `The ship needs the ${wanted.name}: buy it, then fit it with Build.` };
  if (toFit) return { tone: 'good', text: `The ${toFit.name} is on hand: fit it with Build, back at the hangar.` };
  if (wanted) return { tone: 'info', text: `The ${wanted.name} the ship needs is ${wanted.price}. Jobs pay the rest.` };
  if (!stock.length) return { tone: 'info', text: `${shop.name} is sold out. The stock turns over after every job.` };
  return { tone: 'info', text: 'Pick a part to read about it. Buying or selling takes two taps.' };
}

// The parts the ship needs before the rest, each kept in its order.
function neededFirst(items) {
  return [...items.filter((item) => item.needed), ...items.filter((item) => !item.needed)];
}

function credits(n) {
  return `${n.toLocaleString('en')} credits`;
}
