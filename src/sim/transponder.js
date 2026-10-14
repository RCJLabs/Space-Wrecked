// The transponder swap (ROADMAP §4.4, M24): at a station, once a sector,
// the ship's transponder is swapped for one with a clean registration, and
// the pursuer loses the trail: heat falls swapHeat, for swapPrice credits.
// The run keeps whether it has been swapped in this sector (run.swapped,
// travel.js), and the flags count the swaps. Pure.
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { hereOf, onTheRun } from './travel.js';

// What a swap where the ship is would come to: { ok: true, price, heat (its
// change) }, or { ok: false, error }.
export function swapPlan(campaign, rules) {
  if (!campaign.run || !onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Transponders are swapped at stations.' };
  if (campaign.run.swapped) return { ok: false, error: 'The transponder has been swapped in this sector already.' };
  if (campaign.heat <= 0) return { ok: false, error: 'There is no heat to lose.' };
  const price = rules.balance.swapPrice;
  if (campaign.credits < price) return { ok: false, error: `A swap is ${price} credits.` };
  return { ok: true, price, heat: withHeat(campaign.heat, rules.balance.swapHeat) - campaign.heat };
}

// Swaps it. Returns { ok: true, plan, campaign } or { ok: false, error }.
export function swapTransponder(campaign, rules) {
  const plan = swapPlan(campaign, rules);
  if (!plan.ok) return plan;
  return {
    ok: true,
    plan,
    campaign: {
      ...campaign,
      credits: campaign.credits - plan.price,
      heat: campaign.heat + plan.heat,
      flags: tally(campaign.flags, { swaps: 1 }),
      run: { ...campaign.run, swapped: true },
    },
  };
}
