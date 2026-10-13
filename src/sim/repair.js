// Repairs (ROADMAP §4.6): a module wrecked in an approach (encounter.js)
// stays wrecked until a station repairs it, for repairPercent of its cost,
// in steps of PAY_STEP and never less than one step. A station repairs what
// the credits cover, the cheapest first. Pure.
import { PAY_STEP } from './economy.js';
import { tally } from './flags.js';
import { hereOf, onTheRun } from './travel.js';
import { wrecksOn } from './encounter.js';

// What a station charges to repair a wrecked part, or null for a part it
// doesn't know.
export function repairPrice(type, rules) {
  const cost = rules.modules.get(type)?.cost;
  return cost === undefined ? null : PAY_STEP * Math.max(1, Math.round((cost * rules.balance.repairPercent) / 100 / PAY_STEP));
}

// The ship's wrecks, cheapest to repair first: [{ uid, type, wreck, price }].
export function wrecksToRepair(campaign, rules) {
  return Object.entries(wrecksOn(campaign.ship, campaign.wrecks))
    .map(([uid, wreck]) => {
      const type = campaign.ship.modules.find((module) => module.uid === Number(uid)).type;
      return { uid: Number(uid), type, wreck, price: repairPrice(type, rules) ?? 0 };
    })
    .sort((a, b) => a.price - b.price || a.uid - b.uid);
}

// What the station the ship is at would repair: { ok: true, wrecks (all of
// them), repairs (those the credits cover, cheapest first), cost (of those),
// total (of all) }, or { ok: false, error }.
export function repairPlan(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Repairs are made at stations.' };
  const wrecks = wrecksToRepair(campaign, rules);
  if (!wrecks.length) return { ok: false, error: 'Nothing on the ship is wrecked.' };
  const repairs = [];
  let cost = 0;
  for (const wreck of wrecks) {
    if (cost + wreck.price > campaign.credits) break;
    repairs.push(wreck);
    cost += wreck.price;
  }
  const total = wrecks.reduce((sum, wreck) => sum + wreck.price, 0);
  if (!repairs.length) return { ok: false, error: `A repair costs ${wrecks[0].price} credits.`, wrecks, total };
  return { ok: true, wrecks, repairs, cost, total };
}

// Repairs what the credits cover at the station. Returns { ok: true,
// campaign, plan } or { ok: false, error }.
export function repairShip(campaign, rules) {
  const plan = repairPlan(campaign, rules);
  if (!plan.ok) return plan;
  const wrecks = { ...campaign.wrecks };
  for (const repair of plan.repairs) delete wrecks[repair.uid];
  return { ok: true, plan, campaign: { ...campaign, wrecks, credits: campaign.credits - plan.cost, flags: tally(campaign.flags, { repairs: plan.repairs.length }) } };
}
