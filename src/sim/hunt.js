// The pursuer's hunters on the run (ROADMAP §4.4, M24). From huntHeat they
// may be waiting wherever a jump comes out, and where the ship sits out a
// day regrouping (regroup.js), by the heat the ship has there:
//   - from huntHeat, huntChance, in the pursuer's hunters' ship;
//   - from raidHeat, taskForceChance, in its task force's;
//   - at HEAT_MAX, certainly, the task force.
// The ships are the pursuer's (its run, data/backgrounds.json). Never at a
// safe kind of node (a station) or one to hide in (a nebula,
// data/sectors.json). The chance is worked out before the jump, shown, and
// rolled as shown (Law 4) with the campaign's RNG; a certain one isn't
// rolled. Found, they are an approach (encounter.js openHunt), and facing
// them drops heat to heatAfterRaid (encounter.js). Pure.
import { int, percent } from '../core/rng.js';
import { HEAT_MAX } from './campaign.js';
import { openHunt } from './encounter.js';
import { pursuerOf } from './heat.js';

const MAX_SEED = 0xffffffff;

// The pursuer's ways on the run, or null: { levels, hunters, taskForce,
// faced }.
export function huntersOf(campaign, rules) {
  return pursuerOf(campaign, rules)?.run ?? null;
}

// The chance the hunters are waiting at a node of kind `type`, for a ship
// there with `heat`: { chance (0 to 100), ship (the preset they fly, or
// null), why } (why: 'safe' or 'hidden' when the kind keeps them off, else
// null).
export function huntOdds(campaign, rules, heat, type) {
  const run = huntersOf(campaign, rules);
  const kind = rules.nodeTypes.get(type);
  if (!run || heat < rules.balance.huntHeat) return { chance: 0, ship: null, why: null };
  if (kind?.hides) return { chance: 0, ship: null, why: 'hidden' };
  if (kind?.safe) return { chance: 0, ship: null, why: 'safe' };
  if (heat >= HEAT_MAX) return { chance: 100, ship: run.taskForce, why: null };
  if (heat >= rules.balance.raidHeat) return { chance: rules.balance.taskForceChance, ship: run.taskForce, why: null };
  return { chance: rules.balance.huntChance, ship: run.hunters, why: null };
}

// Whether the hunters are waiting where the ship is, at the odds above for
// its heat and its node: rolled, unless certain or nil, and if they are,
// their approach opened. Returns { campaign, hunt: { chance, ship, why,
// roll (null if not rolled), found } }.
export function rollHunt(campaign, rules) {
  const { run } = campaign;
  const odds = huntOdds(campaign, rules, campaign.heat, run.sector.nodes[run.at].type);
  if (!odds.chance) return { campaign, hunt: { ...odds, roll: null, found: false } };
  let { rng } = campaign;
  let roll = null;
  if (odds.chance < 100) {
    const p = percent(rng, odds.chance);
    ({ state: rng, roll } = p);
    if (!p.value) return { campaign: { ...campaign, rng }, hunt: { ...odds, roll, found: false } };
  }
  const seed = int(rng, 0, MAX_SEED);
  const met = openHunt({ ...campaign, rng: seed.state }, rules, odds.ship, seed.value);
  return { campaign: met, hunt: { ...odds, roll, found: Boolean(met.run.approach?.hunt) } };
}
