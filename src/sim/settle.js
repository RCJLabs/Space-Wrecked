// Settling a world (ROADMAP §2, M25): at a world in the system past the
// charts, Settle here ends act 2, surveyed or not. The campaign moves on to
// the next act, the colony, with the world it settled saved whole for the
// colony to build on (M26 on): its name and kind, its numbers for act 3
// (gen/system.js), and whether it was surveyed; and from M38d the system's
// other worlds, which its trips can reach. The ship, crew, credits, parts
// on hand and heat go with it, and the run stays as it ended, for the act's
// record. Not while an approach holds the ship. From M38e a world a voyage
// passes (M38d) can be settled too, a colony more (colonies.js): it lies
// where the ship is along the line of systems, the ship lands there with
// those aboard and the act stays, and the colony it flew from keeps
// whoever was at home and its food. Pure.
import { allColonies, MAX_COLONIES, nextColonyId } from './colonies.js';
import { newColony } from './colony.js';
import { tally } from './flags.js';
import { hereOf, holdOf, onTheRun } from './travel.js';

// What settling where the ship is would come to: { ok: true, world (as the
// colony keeps it: { name, kind, soil, water, ore, danger, lanes, surveyed
// }), worlds (the system's others, as the colony keeps them: [{ name, world
// }]), id (the colony's number, M38e), at (where it lies) }, or { ok:
// false, error }.
export function settlePlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'A world is settled from the ship, on the run.' };
  const voyage = campaign.colony?.voyage ?? null;
  if (campaign.colony && !voyage) return { ok: false, error: `The crew's colony is on ${campaign.colony.world.name}.` };
  if (allColonies(campaign).length >= MAX_COLONIES) return { ok: false, error: `The crew keeps ${MAX_COLONIES} colonies already: no more.` };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const here = hereOf(campaign);
  if (!here.world) return { ok: false, error: 'There is no world here to settle.' };
  const worlds = run.sector.nodes.filter((node) => node.world && node.id !== here.id).map((node) => ({ name: node.name, world: node.world }));
  return { ok: true, world: { name: here.name, ...here.world, surveyed: run.surveyed.includes(run.at) }, worlds, id: nextColonyId(campaign), at: voyage ? voyage.at : 0 };
}

// Settles the world the ship is at: act 2 ends, and the colony begins on
// day 1 with no buildings yet and the materials the landing salvaged
// (colony.js). On a voyage (M38e) the act stays, and the colony flown from
// joins the others with those at home and its food. Returns { ok: true,
// plan, campaign } or { ok: false, error }.
export function settle(campaign, rules) {
  const plan = settlePlan(campaign, rules);
  if (!plan.ok) return plan;
  const colony = newColony(plan.world, rules.colony?.materials ?? 0, plan.worlds, { id: plan.id, at: plan.at, heat: campaign.heat });
  const flags = tally(campaign.flags, { settled: 1 });
  if (!campaign.colony) return { ok: true, plan, campaign: { ...campaign, act: campaign.act + 1, place: 'hub', colony, flags } };
  const { voyage, ...from } = campaign.colony;
  const left = { ...from, voyage: null, keep: { crew: voyage.home.crew, food: voyage.home.food } };
  return { ok: true, plan, campaign: { ...campaign, place: 'hub', colony, colonies: [...campaign.colonies, left].sort((a, b) => a.id - b.id), flags } };
}
