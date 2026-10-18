// Settling a world (ROADMAP §2, M25): at a world in the system past the
// charts, Settle here ends act 2, surveyed or not. The campaign moves on to
// the next act, the colony, with the world it settled saved whole for the
// colony to build on (M26 on): its name and kind, its numbers for act 3
// (gen/system.js), and whether it was surveyed; and from M38d the system's
// other worlds, which its trips can reach. The ship, crew, credits, parts
// on hand and heat go with it, and the run stays as it ended, for the act's
// record. Not while an approach holds the ship, and not once there is a
// colony: the worlds a voyage passes (M38d) are surveyed, not settled. Pure.
import { newColony } from './colony.js';
import { tally } from './flags.js';
import { hereOf, holdOf, onTheRun } from './travel.js';

// What settling where the ship is would come to: { ok: true, world (as the
// colony keeps it: { name, kind, soil, water, ore, danger, lanes, surveyed
// }), worlds (the system's others, as the colony keeps them: [{ name, world
// }]) }, or { ok: false, error }.
export function settlePlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'A world is settled from the ship, on the run.' };
  if (campaign.colony) return { ok: false, error: `The crew's colony is on ${campaign.colony.world.name}.` };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const here = hereOf(campaign);
  if (!here.world) return { ok: false, error: 'There is no world here to settle.' };
  const worlds = run.sector.nodes.filter((node) => node.world && node.id !== here.id).map((node) => ({ name: node.name, world: node.world }));
  return { ok: true, world: { name: here.name, ...here.world, surveyed: run.surveyed.includes(run.at) }, worlds };
}

// Settles the world the ship is at: act 2 ends, and the colony begins on
// day 1 with no buildings yet and the materials the landing salvaged
// (colony.js). Returns { ok: true, plan, campaign } or { ok: false, error }.
export function settle(campaign, rules) {
  const plan = settlePlan(campaign, rules);
  if (!plan.ok) return plan;
  const colony = newColony(plan.world, rules.colony?.materials ?? 0, plan.worlds);
  return { ok: true, plan, campaign: { ...campaign, act: campaign.act + 1, place: 'hub', colony, flags: tally(campaign.flags, { settled: 1 }) } };
}
