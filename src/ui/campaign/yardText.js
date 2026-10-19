// Words for a shipyard on the run (M37b, src/sim/yards.js), as the shop
// screen (shop.js) shows them: the parts the yard has left for sale, each
// at its price there, and the parts on hand it would buy. The same shape as
// shopText.js's, so the one screen serves both. Pure: rules are the content
// tables (src/sim/defs.js).
import { atYard } from '../../sim/acts.js';
import { pursuerSide } from '../../sim/standing.js';
import { hereOf, tradeHeat } from '../../sim/travel.js';
import { framePlan, framesHere, yardBuyBack, yardHere, yardPlan, yardSellPlan } from '../../sim/yards.js';
import { cardFor, traitText } from '../builder/card.js';
import { dockSaid, sideIs, stationText } from './standingText.js';

// The yard as the shop screen shows it, or null away from one:
//   yard        true: the screen's trades are the yard's
//   title       "Shipyard"
//   name        the yard's name ("Slipway Four")
//   dealer      whose it is and its prices ("The Fleet's yard: friendly,
//               prices 90%."), or that it is nobody's, at full prices
//   pitch       the yard's words (data/sectors.json)
//   credits     "250 credits"
//   stock       for sale: [{ slot, key, part, weapon: null, name, price,
//               needed: null, facts, carried: null, ok, why, action, ask }]
//   held        the parts on hand, to sell: [{ key, part, weapon: null,
//               name, count, price, needed: null, facts, carried: null, ok,
//               why, action, ask, warn: null }]
//   frames      the hull frames for sale (M39): [{ key ('f:' and its id),
//               frame, name, price, facts, ok, why, warn, action, ask }],
//               price what it costs with the ship's own frame given in part
//               payment, facts its size, caps, trait and that payment, and
//               warn the flight check the ship would fail on it, which keeps
//               it at the yard until a refit, or null
//   dock        what the first trade adds at a yard of the pursuer's side
//               ("Con-Reg logs the ship: heat +10 to 40."), or ''
//   soldOut     the words for a yard with nothing left
//   framePitch  what buying a frame does
//   back        the way back: { label, screen }
//   hint        { tone, text }
// key is the part's type: a yard has no part twice. facts are a part's
// size and stats, as the shop's.
export function yardText(campaign, rules) {
  if (!atYard(campaign, rules)) return null;
  const here = hereOf(campaign);
  const name = (type) => rules.modules.get(type)?.name ?? type;
  const facts = (type) => {
    const def = rules.modules.get(type);
    return def ? cardFor(rules, def).lines.slice(0, 2) : [];
  };
  const stock = yardHere(campaign, rules).map((item) => {
    const plan = yardPlan(campaign, rules, item.slot);
    return { slot: item.slot, key: item.part, part: item.part, weapon: null, name: name(item.part), price: credits(item.price), needed: null, facts: facts(item.part), carried: null, ok: plan.ok, why: plan.ok ? null : plan.error, action: `Buy · ${item.price}`, ask: `Buy for ${item.price}?` };
  });
  const held = Object.entries(campaign.parts)
    .filter(([, count]) => count > 0)
    .map(([part, count]) => {
      const plan = yardSellPlan(campaign, rules, part);
      const price = yardBuyBack(campaign, rules, part);
      return { key: part, part, weapon: null, name: name(part), count, price: price === null ? '' : credits(price), needed: null, facts: facts(part), carried: null, ok: plan.ok, why: plan.ok ? null : plan.error, action: `Sell · ${price}`, ask: `Sell for ${price}?`, warn: null };
    });
  const frames = framesHere(campaign, rules).map((item) => {
    const frame = rules.frames.get(item.frame);
    const plan = framePlan(campaign, rules, item.frame);
    const own = rules.frames.get(campaign.ship.frame)?.name ?? 'old frame';
    const facts = [
      `${frame.width}×${frame.height} cells · ${frame.maxModules} parts · ${frame.maxStyling} styling pieces · thrust for mass ${frame.minThrustToMass}`,
      traitText(frame) || 'No trait of its own.',
      item.worth ? `${item.price} credits here, less ${item.worth} for your ${own.toLowerCase()}` : `${item.price} credits here`,
    ];
    const warn = plan.ok && plan.check ? `On it the ship would fail a flight check (${plan.check.text.charAt(0).toLowerCase()}${plan.check.text.slice(1)}): it stays at the yard until a refit fixes it` : null;
    return { key: `f:${item.frame}`, frame: item.frame, name: item.name, price: credits(item.cost), facts, ok: plan.ok, why: plan.ok ? null : plan.error, warn, action: `Buy · ${item.cost}`, ask: `Buy for ${item.cost}?` };
  });
  const side = stationText(here, campaign, rules);
  const heat = tradeHeat(campaign, rules);
  return {
    yard: true,
    title: 'Shipyard',
    name: here.name,
    dealer: side ? side.line : "Nobody's yard: full prices.",
    pitch: rules.nodeTypes.get('shipyard')?.text ?? '',
    credits: credits(campaign.credits),
    stock,
    held,
    frames,
    dock: dockSaid(campaign, rules, heat).trim(),
    soldOut: 'Sold out: what was here is gone for good. The yard still buys parts.',
    framePitch: 'Bought, the ship moves onto it at once: every part where it was, with the frame\'s trait and its thrust for mass. Your own frame is the part payment.',
    back: { label: 'Map', screen: 'sector' },
    hint: yardHint(campaign, rules, { stock, held, heat }),
  };
}

// What to do at the yard: mind the docking heat, buy, or sell.
function yardHint(campaign, rules, { stock, held, heat }) {
  if (heat) return { tone: 'warn', text: `${capital(sideIs(pursuerSide(campaign, rules), rules))} after you, and this is their yard: your first trade here adds ${heat} heat.` };
  if (!stock.length && !held.length) return { tone: 'info', text: 'The yard is sold out, and you have no parts to sell.' };
  if (!stock.length) return { tone: 'info', text: 'The yard is sold out, but buys parts: pick one of yours to sell.' };
  return { tone: 'info', text: `Pick a part to read about it. Bought, it goes on hand: Refit fits it, back on the map.${held.length ? ' The yard buys yours too.' : ''}` };
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function credits(n) {
  return `${n.toLocaleString('en')} credits`;
}
