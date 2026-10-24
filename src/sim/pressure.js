// The colony's levers on heat (M53): lying low, and a payment as in act 1.
// Lying low (colony.lowProfile) keeps the ship on the ground and the
// mines idle: no trip, voyage or flight to another colony leaves while it
// is on, the mines dig nothing (colony.js colonyStats), and heat falls
// lowProfileFall a day instead of colonyHeatFall (raids.js raidDayEnd). The
// farms grow and the guns stand as ever. A payment on the pursuer's terms
// (heat.js paymentFor: its credits for its heat; the Provost takes none)
// can be made from the colony with the ship landed, as from the hangar.
// Pure.
import { atColony } from './acts.js';
import { makePayment, paymentFor } from './heat.js';

// Why nothing flies while the colony lies low.
export const LOW_PROFILE = 'The colony is lying low: nothing flies until it stops.';

// Whether lying low can be set, and why not: { ok, why }.
export function lowProfilePlan(campaign, rules) {
  if (!atColony(campaign, rules)) return { ok: false, why: 'The colony lies low with the ship landed there.' };
  if (campaign.colony.trip) return { ok: false, why: 'The ship is away.' };
  return { ok: true, why: null };
}

// The colony lying low (on) or not: { ok: true, campaign } or { ok: false,
// error }.
export function setLowProfile(campaign, rules, on) {
  const plan = lowProfilePlan(campaign, rules);
  if (!plan.ok) return { ok: false, error: plan.why };
  if (typeof on !== 'boolean') return { ok: false, error: 'Lying low is on or off.' };
  return { ok: true, campaign: { ...campaign, colony: { ...campaign.colony, lowProfile: on } } };
}

// The heat a colony sheds at a day's end.
export function heatFallOf(colony, rules) {
  return colony?.lowProfile ? rules.balance.lowProfileFall : rules.balance.colonyHeatFall;
}

// A payment from the colony (M53): as heat.js paymentFor has it, from the
// colony with the ship landed in place of the hangar. { payment, ok, why }.
export function colonyPaymentFor(campaign, rules) {
  const atHome = atColony(campaign, rules) && !campaign.colony.trip;
  if (!atHome) return { ...paymentFor(campaign, rules), ok: false, why: 'Payments are made from the colony with the ship landed.' };
  return paymentFor(campaign, rules, { from: 'colony' });
}

// Makes a payment from the colony: { ok: true, campaign } or { ok: false,
// error }.
export function payFromColony(campaign, rules) {
  const plan = colonyPaymentFor(campaign, rules);
  if (!plan.ok) return { ok: false, error: plan.why };
  return makePayment(campaign, rules, { from: 'colony' });
}
