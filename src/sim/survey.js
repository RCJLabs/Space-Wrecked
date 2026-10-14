// Surveying a world (ROADMAP §4.7, M25): at a world in the system past the
// charts, a day in orbit shows what it is worth to a colony: its numbers
// for act 3 (gen/system.js), once a world. The day eats a jump's supplies
// and adds surveyHeat, and the pursuer's hunters may find the ship as it
// sits, at a jump's odds (hunt.js), as when regrouping. A day the supplies
// don't cover isn't taken. The flags count the surveys. Pure.
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { huntOdds, rollHunt } from './hunt.js';
import { hereOf, holdOf, jumpSupplies, onTheRun } from './travel.js';

// What a survey where the ship is would take: { ok: true, supplies (what
// it eats), heat (its change), hunt (the hunters' odds, hunt.js huntOdds)
// }, or { ok: false, error }.
export function surveyPlan(campaign, rules) {
  const { run } = campaign;
  if (!run || !onTheRun(campaign, rules)) return { ok: false, error: 'Worlds are surveyed from the ship, on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const here = hereOf(campaign);
  if (!here.world) return { ok: false, error: 'There is no world here to survey.' };
  if (run.surveyed.includes(run.at)) return { ok: false, error: `${here.name} has been surveyed.` };
  const supplies = jumpSupplies(campaign, rules);
  if (campaign.supplies < supplies) return { ok: false, error: `A day's survey eats ${supplies} supplies, and the holds have ${campaign.supplies}.` };
  const heat = withHeat(campaign.heat, rules.balance.surveyHeat) - campaign.heat;
  return { ok: true, supplies, heat, hunt: huntOdds(campaign, rules, campaign.heat + heat, here.type) };
}

// Surveys the world the ship is at. Returns { ok: true, plan, campaign,
// hunt (hunt.js rollHunt's) } or { ok: false, error }.
export function survey(campaign, rules) {
  const plan = surveyPlan(campaign, rules);
  if (!plan.ok) return plan;
  const { run } = campaign;
  const done = {
    ...campaign,
    supplies: campaign.supplies - plan.supplies,
    heat: campaign.heat + plan.heat,
    flags: tally(campaign.flags, { surveys: 1 }),
    run: { ...run, surveyed: [...run.surveyed, run.at] },
  };
  const met = rollHunt(done, rules);
  return { ok: true, plan, campaign: met.campaign, hunt: met.hunt };
}
