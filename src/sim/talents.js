// A loyal companion's talent (M33c, companions.js): their job's order at a
// third rank, past the jobs' last, with the numbers of their own
// (data/companions.json talent.order) laid over rank 2's. A battle unit
// that is a loyal companion carries their id as `talent` (battle.js), and
// its order is this one (orders.js orderOf). Imports only the ranks, so
// the fight can ask without taking in the campaign. Pure.
import { jobAtRank } from './ranks.js';

// The rank a loyal companion's order is at: one past the jobs' last.
export const TALENT_RANK = 3;

// Companion `id`'s talent: their job's order at rank 2 with their numbers
// laid over it, or null when there is no such companion or job order.
export function talentOrder(rules, id) {
  const companion = rules.companions?.get(id);
  const job = companion && rules.jobs.get(companion.job);
  if (!job?.order || !companion.talent?.order) return null;
  return { ...jobAtRank(job, TALENT_RANK - 1).order, ...companion.talent.order };
}
