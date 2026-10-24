// Text for the colony's levers on heat (M53, src/sim/pressure.js and
// src/sim/traders.js): lying low, a payment from the colony, and the
// friendly sides' traders. rules are the content tables (src/sim/defs.js).
import { colonyPaymentFor, lowProfilePlan } from '../../sim/pressure.js';
import { pursuerOf } from '../../sim/heat.js';
import { nextCall, tradePlan } from '../../sim/traders.js';

// Lie low, for its row: { name, detail, ok, ask }.
export function lowProfileRow(campaign, rules) {
  const { lowProfileFall, colonyHeatFall } = rules.balance;
  const plan = lowProfilePlan(campaign, rules);
  const on = campaign.colony.lowProfile === true;
  const cost = 'nothing flies, the mines dig nothing';
  if (on) {
    return {
      name: 'Stop lying low',
      detail: plan.ok ? `Lying low: heat falls ${lowProfileFall} a day; ${cost}` : plan.why,
      ok: plan.ok,
      ask: `Stop lying low: the ship can fly and the mines dig again; heat falls ${colonyHeatFall} a day. Tap again to stop.`,
    };
  }
  return {
    name: 'Lie low',
    detail: plan.ok ? `Heat falls ${lowProfileFall} a day, not ${colonyHeatFall}; ${cost}` : plan.why,
    ok: plan.ok,
    ask: `Lie low: heat falls ${lowProfileFall} a day instead of ${colonyHeatFall}, but nothing flies, no trip, voyage or flight, and the mines dig nothing till it stops. The farms grow and the guns stand. Tap again to lie low.`,
  };
}

// A payment from the colony, for its row: { name, detail, ok, ask }, or
// null when there is no one to pay (the Provost takes none).
export function paymentRow(campaign, rules) {
  const plan = colonyPaymentFor(campaign, rules);
  if (!plan.payment) return null;
  const { credits, heat } = plan.payment;
  const name = pursuerOf(campaign, rules)?.name ?? 'the pursuer';
  const after = Math.max(0, campaign.heat - heat);
  return {
    name: `Pay ${name}`,
    detail: plan.ok ? `${credits} credits of ${campaign.credits} · heat −${heat}` : plan.why,
    ok: plan.ok,
    ask: `Pay ${name} ${credits} credits of your ${campaign.credits}: heat falls ${heat}, from ${campaign.heat} to ${after}. Tap again to pay.`,
  };
}

// The trader, for its section: { title, rows: [{ key, name, detail, ok,
// ask }], note }. With none here, no rows and a note of the next call.
export function traderText(campaign, rules) {
  const plan = tradePlan(campaign, rules);
  if (!plan.ok) {
    const call = nextCall(campaign, rules, campaign.colony.day + 1);
    const name = rules.factions.sides.get(call?.side)?.name ?? call?.side ?? '';
    const note = call
      ? `${name.charAt(0).toUpperCase()}${name.slice(1)}'s trader calls on day ${call.day}${call.day === campaign.colony.day + 1 ? ', tomorrow' : ''}: it buys materials and brings a part.`
      : 'A side friendly with the crew sends a trader every few days; none is yet.';
    return { title: 'Trader', rows: [], note };
  }
  const { lots, part } = plan;
  const rows = [
    {
      key: 'sell',
      name: 'Sell materials',
      detail: lots.ok ? `${lots.lot} of ${campaign.colony.materials} for ${lots.price} credits · ${lots.left} lot${lots.left === 1 ? '' : 's'} left` : lots.why,
      ok: lots.ok,
      ask: `Sell ${lots.lot} materials of ${campaign.colony.materials} for ${lots.price} credits. Tap again to sell.`,
    },
  ];
  if (part) {
    const partName = rules.modules.get(part.type)?.name ?? part.type;
    rows.push({
      key: 'buy',
      name: `Buy ${partName}`,
      detail: part.ok ? `${part.price} credits of ${campaign.credits} · into the hold` : part.why,
      ok: part.ok,
      ask: `Buy the ${partName} for ${part.price} credits of your ${campaign.credits}: it goes into the hold, to set down or fit. Tap again to buy.`,
    });
  }
  return { title: `Trader · ${plan.side}`, rows, note: 'Here today only.' };
}
