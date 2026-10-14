// Settling a world (ROADMAP §2, M25): at a world in the system past the
// charts, Settle here ends act 2, surveyed or not. The campaign moves on to
// the next act, the colony, with the world it settled saved whole for the
// colony to build on (M26 on): its name and kind, its numbers for act 3
// (gen/system.js), and whether it was surveyed. The ship, crew, credits,
// parts on hand and heat go with it, and the run stays as it ended, for
// the act's record. Not while an approach holds the ship. Pure.
import { newColony } from './colony.js';
import { tally } from './flags.js';
import { hereOf, holdOf, onTheRun } from './travel.js';

// What settling where the ship is would come to: { ok: true, world (as the
// colony keeps it: { name, kind, soil, water, ore, danger, lanes, surveyed
// }) }, or { ok: false, error }.
export function settlePlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'A world is settled from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const here = hereOf(campaign);
  if (!here.world) return { ok: false, error: 'There is no world here to settle.' };
  return { ok: true, world: { name: here.name, ...here.world, surveyed: run.surveyed.includes(run.at) } };
}

// Settles the world the ship is at: act 2 ends, and the colony begins with
// no buildings yet (colony.js). Returns { ok: true, plan, campaign } or
// { ok: false, error }.
export function settle(campaign, rules) {
  const plan = settlePlan(campaign, rules);
  if (!plan.ok) return plan;
  return { ok: true, plan, campaign: { ...campaign, act: campaign.act + 1, place: 'hub', colony: newColony(plan.world), flags: tally(campaign.flags, { settled: 1 }) } };
}
