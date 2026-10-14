// Regrouping on the run (ROADMAP §2, §4.4, M24): away from stations, the
// crew takes a day to rest and patch itself up. The day eats a jump's
// supplies and heals each of the wounded regroupHp hit points, and what
// the med bay heals in a day (medbay.js), up to their most. It costs time,
// and time is heat: heat rises regroupHeat, and the pursuer's hunters may
// find the ship while it sits, at a jump's odds (hunt.js). In a kind of
// node to hide in (a nebula, data/sectors.json), the day hides the ship
// instead: heat falls hideHeat, and the hunters can't see it to roll. A
// day the supplies don't cover isn't taken: hunger would undo the rest.
// The flags count the regroups, the hides and the hit points they healed.
// Pure.
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { huntOdds, rollHunt } from './hunt.js';
import { maxHp } from './campaign.js';
import { healCrew, healRate } from './medbay.js';
import { hereOf, holdOf, jumpSupplies, onTheRun } from './travel.js';

// What a day's rest where the ship is would come to: { ok: true, kind:
// 'regroup' or 'hide', supplies (what it eats), heat (its change), heal
// (what each of the wounded heals), hunt (the hunters' odds, hunt.js
// huntOdds) }, or { ok: false, error }.
export function regroupPlan(campaign, rules) {
  if (!campaign.run || !onTheRun(campaign, rules)) return { ok: false, error: 'The crew regroups on the run.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const node = hereOf(campaign);
  if (node.type === 'station') return { ok: false, error: 'At a station, Patch up sees to the crew.' };
  const hides = rules.nodeTypes.get(node.type)?.hides === true;
  const hurt = campaign.crew.some((member) => member.hp < maxHp(member, rules));
  if (hides ? !hurt && campaign.heat <= 0 : !hurt) return { ok: false, error: hides ? 'No one is hurt, and there is no heat to lose.' : 'No one needs the rest.' };
  const supplies = jumpSupplies(campaign, rules);
  if (campaign.supplies < supplies) return { ok: false, error: `A day's rest eats ${supplies} supplies, and the holds have ${campaign.supplies}.` };
  const { regroupHp, regroupHeat, hideHeat } = rules.balance;
  const heat = withHeat(campaign.heat, hides ? hideHeat : regroupHeat) - campaign.heat;
  const hunt = hides ? { chance: 0, ship: null, why: 'hidden' } : huntOdds(campaign, rules, campaign.heat + heat, node.type);
  return { ok: true, kind: hides ? 'hide' : 'regroup', supplies, heat, heal: regroupHp + healRate(campaign, rules), hunt };
}

// Takes the day. Returns { ok: true, plan, campaign, hunt (hunt.js
// rollHunt's, or null hiding) } or { ok: false, error }.
export function regroup(campaign, rules) {
  const plan = regroupPlan(campaign, rules);
  if (!plan.ok) return plan;
  const { crew, healed } = healCrew(campaign.crew, plan.heal, rules);
  const hiding = plan.kind === 'hide';
  const rested = {
    ...campaign,
    supplies: campaign.supplies - plan.supplies,
    heat: campaign.heat + plan.heat,
    crew,
    flags: tally(campaign.flags, { [hiding ? 'hides' : 'regroups']: 1, hpRested: healed }),
  };
  if (hiding) return { ok: true, plan, campaign: rested, hunt: null };
  const met = rollHunt(rested, rules);
  return { ok: true, plan, campaign: met.campaign, hunt: met.hunt };
}
