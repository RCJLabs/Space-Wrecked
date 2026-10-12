// Heat (ROADMAP §4.4): the pursuer's meter, 0 to HEAT_MAX, on the campaign.
// In act 1, every job raises it, a loud one more, and a payment on the debt
// buys some off. Past each threshold (data/balance.json) the pursuer does
// more, and says so (the background's pursuer, data/backgrounds.json):
//   calm      below rumorHeat: nothing
//   rumors    from rumorHeat: asking around, words only
//   hunters   from huntHeat: the pursuer's hunters join every job's fight
//   raid      from raidHeat: they raid the hangar (raid.js), and no job can
//             be taken until the raid is fought, or heat is paid down
// Pure: plain data in, plain data out.
import { HEAT_MAX } from './campaign.js';

export const LEVELS = ['calm', 'rumors', 'hunters', 'raid'];

// The level heat is at.
export function heatLevel(heat, rules) {
  const { rumorHeat, huntHeat, raidHeat } = rules.balance;
  if (heat >= raidHeat) return 'raid';
  if (heat >= huntHeat) return 'hunters';
  return heat >= rumorHeat ? 'rumors' : 'calm';
}

// The pursuer after the campaign (its background's), or null.
export function pursuerOf(campaign, rules) {
  return rules.backgrounds.get(campaign.background)?.pursuer ?? null;
}

// What a job adds to heat when it is over, done or lost: { heat, loud }.
// A clear-out is loud (data/contracts.json missions), and so is a twist
// that says so (a fire).
export function jobHeat(job, rules) {
  const mission = rules.contracts.missions.get(rules.contracts.jobs.get(job.contract)?.mission);
  const twist = job.twist ? rules.contracts.twists.get(job.twist) : null;
  const loud = mission?.loud === true || twist?.loud === true;
  return { heat: loud ? rules.balance.loudJobHeat : rules.balance.jobHeat, loud };
}

// Heat after adding to it, kept from 0 to HEAT_MAX.
export function withHeat(heat, change) {
  return Math.max(0, Math.min(HEAT_MAX, heat + change));
}

// The enemies that join a job's fight at the campaign's heat: the
// pursuer's hunters, from huntHeat up.
export function huntersFor(campaign, rules) {
  if (campaign.heat < rules.balance.huntHeat) return [];
  return pursuerOf(campaign, rules)?.hunters ?? [];
}

// True when the pursuer raids the hangar before anything else: at the hub,
// with heat at raidHeat or more.
export function raidDue(campaign, rules) {
  return campaign.place === 'hub' && campaign.heat >= rules.balance.raidHeat;
}

// What a payment on the debt costs and buys: the pursuer's payment
// ({ name, text, credits, heat }) and whether it can be made now, with
// why not: { payment, ok, why }.
export function paymentFor(campaign, rules) {
  const payment = pursuerOf(campaign, rules)?.payment ?? null;
  if (!payment) return { payment, ok: false, why: 'There is no one to pay.' };
  if (campaign.place !== 'hub') return { payment, ok: false, why: 'Payments are made from the hangar.' };
  if (campaign.heat <= 0) return { payment, ok: false, why: 'There is no heat to pay off.' };
  if (campaign.credits < payment.credits) return { payment, ok: false, why: `A payment is ${payment.credits} credits.` };
  return { payment, ok: true, why: null };
}

// Makes a payment: its credits off the campaign's, its heat off the
// meter, and the flags count it. Returns { ok: true, campaign } or
// { ok: false, error }.
export function makePayment(campaign, rules) {
  const { payment, ok, why } = paymentFor(campaign, rules);
  if (!ok) return { ok: false, error: why };
  return {
    ok: true,
    campaign: {
      ...campaign,
      credits: campaign.credits - payment.credits,
      heat: withHeat(campaign.heat, -payment.heat),
      flags: { ...campaign.flags, payments: (campaign.flags.payments ?? 0) + 1 },
    },
  };
}
