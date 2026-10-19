// Where death is permanent (M41), the crew's player gets an ally who is
// down up before they bleed out, as a careful player would: the test
// players' crews (ai.js, press.js, jobAi.js), so their measurements read
// the setting fairly. It stabilizes one beside it (battle.js stabilize), the
// one nearest to bleeding out first, unless its order can patch one it
// reaches (orderAi.js gives the patch, which gets them up); else, with an
// action to spare after a walk, it walks to the nearest tile beside the
// one nearest to bleeding out it can reach. Machines and a job's ward
// don't, and nothing changes where death isn't permanent. Pure.
import { isMachine } from './battle.js';
import { reachable } from './moves.js';
import { orderOf, orderTargets } from './orders.js';

// The action that gets a downed ally up, or null.
export function rescueAction(battle, unit, rules) {
  if (!battle.options.permadeath || unit.side !== 'crew' || unit.ward || isMachine(unit, rules)) return null;
  const down = battle.units.filter((u) => u.side === unit.side && u.status === 'down').sort((a, b) => a.bleed - b.bleed || a.id.localeCompare(b.id));
  if (!down.length || patches(battle, unit, down, rules)) return null;
  const now = down.find((ally) => besideOf(ally, unit.x, unit.y));
  if (now) return { type: 'stabilize', unit: unit.id, target: now.id };
  if (unit.ap < 2 || unit.carrying) return null;
  const walk = [...reachable(battle, unit, unit.mobility, rules).values()].filter((spot) => spot.cost > 0);
  for (const ally of down) {
    const spot = walk.filter((at) => besideOf(ally, at.x, at.y)).sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
    if (spot) return { type: 'move', unit: unit.id, to: [spot.x, spot.y] };
  }
  return null;
}

// True if the unit's order is a patch it can give one of `down` now.
function patches(battle, unit, down, rules) {
  if (orderOf(unit, rules)?.type !== 'patch' || unit.uses < 1) return false;
  const reach = orderTargets(battle, unit, rules);
  return down.some((ally) => reach.includes(ally.id));
}

// True if a unit at x, y is beside `ally`, diagonals too (battle.js
// stabilize's reach).
function besideOf(ally, x, y) {
  return Math.max(Math.abs(ally.x - x), Math.abs(ally.y - y)) <= 1;
}
