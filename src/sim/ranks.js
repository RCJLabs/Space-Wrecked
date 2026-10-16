// Job ranks (ROADMAP §4.5, M32b): every crew member counts the fights they
// stand in (campaign.js endFight), and at balance.rankOneFights and
// balance.rankTwoFights reaches their job's rank 1 and rank 2 (`ranks` in
// data/jobs.json). A rank's numbers take the place of the job's own: rank 1
// sharpens its order, rank 2 its effects aboard and at the colony, as the
// data says, and each rank keeps what the ranks below it gave. A crew
// member's own rank sets their order in a fight (orders.js); an effect takes
// the best rank of the job among those it counts (edges.js). Pure.

// The layers of a job that a rank can sharpen.
export const RANK_LAYERS = ['order', 'station', 'colony'];

// The fights each rank asks for, lowest first.
export function rankFights(rules) {
  return [rules.balance.rankOneFights, rules.balance.rankTwoFights].filter(Number.isInteger);
}

// The rank `fights` fights reach: how many of rankFights they have, 0 for
// none.
export function rankFor(fights, rules) {
  return rankFights(rules).filter((at) => (fights ?? 0) >= at).length;
}

// A crew member's rank, as far as their job has ranks.
export function rankOf(member, rules) {
  const ranks = rules.jobs.get(member.job)?.ranks ?? [];
  return Math.min(rankFor(member.fights, rules), ranks.length);
}

// The fights a crew member needs for their next rank, or null at their
// job's last.
export function nextRankAt(member, rules) {
  const ranks = rules.jobs.get(member.job)?.ranks ?? [];
  const rank = rankOf(member, rules);
  return rank < ranks.length ? rankFights(rules)[rank] ?? null : null;
}

// Each job's ranked versions, built once: index 0 is the job itself.
const RANKED = new WeakMap();

// The job as one of its `rank` does it: its order, station and colony with
// the numbers of each rank up to `rank` laid over them. The job itself at
// rank 0, and for a job with no ranks.
export function jobAtRank(job, rank) {
  if (!job || !(rank > 0) || !job.ranks?.length) return job;
  let ranked = RANKED.get(job);
  if (!ranked) {
    ranked = [job];
    for (const step of job.ranks) {
      const below = ranked.at(-1);
      const next = { ...below };
      for (const layer of RANK_LAYERS) {
        if (step[layer]) next[layer] = { ...below[layer], ...step[layer] };
      }
      ranked.push(next);
    }
    RANKED.set(job, ranked);
  }
  return ranked[Math.min(rank, ranked.length - 1)];
}

// A crew member's job as they do it now, at their rank.
export function memberJob(member, rules) {
  return jobAtRank(rules.jobs.get(member.job), rankOf(member, rules));
}
