// The transponder swap (ROADMAP §4.4, M24): at a station, once a sector,
// the ship's transponder is swapped for one with a clean registration, and
// the pursuer loses the trail: heat falls swapHeat, for swapPrice credits.
// A swap docks the ship at the station first (travel.js dockShip), so at
// one of the pursuer's side the docking heat comes before the swap's fall.
// The run keeps whether it has been swapped in this sector (run.swapped,
// travel.js), and the flags count the swaps. Pure.
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { dockShip, hereOf, onTheRun, tradeHeat } from './travel.js';

// What a swap where the ship is would come to: { ok: true, price, dock (the
// heat docking adds first: travel.js tradeHeat), heat (the swap's change
// after it) }, or { ok: false, error }.
export function swapPlan(campaign, rules) {
  if (!campaign.run || !onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Transponders are swapped at stations.' };
  if (campaign.run.swapped) return { ok: false, error: 'The transponder has been swapped in this sector already.' };
  if (campaign.heat <= 0) return { ok: false, error: 'There is no heat to lose.' };
  const price = rules.balance.swapPrice;
  if (campaign.credits < price) return { ok: false, error: `A swap is ${price} credits.` };
  const dock = tradeHeat(campaign, rules);
  const from = withHeat(campaign.heat, dock);
  return { ok: true, price, dock, heat: withHeat(from, rules.balance.swapHeat) - from };
}

// Swaps it. Returns { ok: true, plan, campaign } or { ok: false, error }.
export function swapTransponder(campaign, rules) {
  const plan = swapPlan(campaign, rules);
  if (!plan.ok) return plan;
  const docked = dockShip(campaign, rules);
  return {
    ok: true,
    plan,
    campaign: {
      ...docked,
      credits: docked.credits - plan.price,
      heat: docked.heat + plan.heat,
      flags: tally(docked.flags, { swaps: 1 }),
      run: { ...docked.run, swapped: true },
    },
  };
}
