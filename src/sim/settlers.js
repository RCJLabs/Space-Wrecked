// Survivors settling (M54): an event's settlers, on a voyage, settle at the
// colony the ship flew from, a citizen each, as far as its beds and air
// free for more go (colony.js colonyStats citizens.free), as a freed
// captive does (contracts.js, M38f); its news says so. Elsewhere, or past
// the room, they are set down at the next station and nothing changes.
// Pure.
import { withNews } from './colonies.js';
import { colonyStats } from './colony.js';
import { tally } from './flags.js';

// The campaign with `count` survivors settled where they can: { campaign,
// settled (how many), home (true on a voyage, with a colony to settle at) }.
export function settleSurvivors(campaign, rules, count) {
  const { colony } = campaign;
  if (!colony?.voyage?.home) return { campaign, settled: 0, home: false };
  const settled = Math.min(count, Math.max(0, colonyStats(campaign, rules).citizens.free));
  if (!settled) return { campaign, settled: 0, home: true };
  // A news entry for each, as for each freed captive (M38f).
  let next = colony;
  for (let n = 1; n <= settled; n++) next = withNews({ ...next, citizens: (colony.citizens ?? 0) + n }, { day: colony.day, kind: 'settled', citizens: (colony.citizens ?? 0) + n });
  return {
    campaign: { ...campaign, colony: next, flags: tally(campaign.flags, { survivorsSettled: settled }) },
    settled,
    home: true,
  };
}
