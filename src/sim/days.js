// The colony's days (ROADMAP §2, M27): act 3 counts days from the landing,
// day 1 first, and Next day passes one. A day, in order:
//   - each farm grows its food and each mine digs its materials, by the
//     world's numbers (colony.js yieldOf);
//   - the crew eats what a jump eats (travel.js jumpSupplies): food is the
//     run's supplies;
//   - a fed crew rests, each of the wounded healing what a day's regroup
//     heals (regroupHp) and what a powered infirmary heals on top, a medic
//     adding theirs as to a med bay's on the run (medbay.js). Short of
//     food, everyone goes hungry as on a hungry jump instead, losing
//     hungerHp hit points, never the last, and the infirmary still heals;
//   - food and materials are each kept up to the colony's stores (colony.js
//     storesOf): what is past them is lost;
//   - the day count rises.
// Giving, building, moving and taking down take no time. The flags count
// the days, the hungry ones, the food grown, the materials dug, what the
// stores couldn't keep, and the hit points the days healed and hunger
// took. Nothing is rolled. Pure.
import { atColony } from './acts.js';
import { colonyStats, storesOf } from './colony.js';
import { tally } from './flags.js';
import { healCrew, stationHeal } from './medbay.js';
import { jumpSupplies } from './travel.js';

// More days than a colony will see: a guard on what a save can hold.
export const MAX_DAYS = 99999;

// What passing the day would come to: { ok: true, day (the day it is now),
// made ({ food, materials }: what the farms and mines make), eats (the
// food the crew eats), fed (whether the food covers it), heal (what each
// of the wounded heals), hunger (what each loses going hungry, 0 when
// fed), food and materials ([now, after the day]), lost ({ food,
// materials }: what the stores can't keep), stores (what they keep of
// each) }, or { ok: false, error }.
export function dayPlan(campaign, rules) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Days pass at the colony.' };
  const { day, materials } = campaign.colony;
  if (day >= MAX_DAYS) return { ok: false, error: 'The colony has counted all the days it can.' };
  const stats = colonyStats(campaign, rules);
  const stores = storesOf(campaign, rules, stats).total;
  const { made } = stats;
  const eats = jumpSupplies(campaign, rules);
  const harvest = campaign.supplies + made.food;
  const fed = harvest >= eats;
  const infirmary = stats.infirmary ? stats.infirmary + stationHeal(campaign.crew, rules) : 0;
  const { regroupHp, hungerHp } = rules.balance;
  const food = Math.max(0, harvest - eats);
  const dug = materials + made.materials;
  return {
    ok: true,
    day,
    made,
    eats,
    fed,
    heal: (fed ? regroupHp : 0) + infirmary,
    hunger: fed ? 0 : hungerHp,
    food: [campaign.supplies, Math.min(food, stores)],
    materials: [materials, Math.min(dug, stores)],
    lost: { food: Math.max(0, food - stores), materials: Math.max(0, dug - stores) },
    stores,
  };
}

// Passes the day (see dayPlan). Returns { ok: true, plan, campaign, healed
// (hit points healed in all), hurt (hit points hunger took in all) } or
// { ok: false, error }.
export function nextDay(campaign, rules) {
  const plan = dayPlan(campaign, rules);
  if (!plan.ok) return plan;
  let hurt = 0;
  const hungry = campaign.crew.map((member) => {
    const hp = Math.max(1, member.hp - plan.hunger);
    hurt += member.hp - hp;
    return hp === member.hp ? member : { ...member, hp };
  });
  const { crew, healed } = healCrew(hungry, plan.heal, rules);
  const flags = tally(campaign.flags, {
    colonyDays: 1,
    hungryDays: plan.fed ? 0 : 1,
    foodGrown: plan.made.food,
    materialsDug: plan.made.materials,
    foodLost: plan.lost.food,
    materialsLost: plan.lost.materials,
    colonyHealed: healed,
    hungerHurt: hurt,
  });
  const colony = { ...campaign.colony, day: plan.day + 1, materials: plan.materials[1] };
  return { ok: true, plan, campaign: { ...campaign, supplies: plan.food[1], crew, colony, flags }, healed, hurt };
}
