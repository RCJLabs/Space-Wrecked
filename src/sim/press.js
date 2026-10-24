// Pressing on: a player for a side that came to fight, with aiAction's
// shape (ai.js). Pure and deterministic. For the first unit of the side
// whose turn it is with an action left:
// - with an enemy in its sight, it plays as the AI would;
// - with no one in sight, it walks toward the nearest of `goals` ([x, y]
//   tiles; the enemy's own, unless given), as far as one action takes it;
// - with nowhere nearer, it forces a lock in its way (locks.js, M45), or
//   opens a closed door beside it.
// Left to the AI alone, two sides either side of a closed door each wait
// for the other to open it, and boarders hold back from a crew on its
// bridge (ROADMAP §8). A raid's raiders press on (raid.js), and so does
// the crew the tools send on jobs (jobAi.js).
//
// In sight of the enemy, one pressing on keeps it in sight (M48): the AI's
// plan that would walk it back out of sight, where it would only press on
// again next turn, gives way to its best plan that keeps someone in sight,
// or to overwatch where it stands. Left alone, a unit stepped out and back
// turn after turn (ROADMAP §9).
import { aiAction, bestPlan, planAction, plansFor } from './ai.js';
import { forceAction } from './locks.js';
import { rescueAction } from './rescueAi.js';
import { isMachine } from './battle.js';
import { SIDES } from './grid.js';
import { reachable, stepsFrom } from './moves.js';
import { canSee } from './sight.js';
import { shutDoor } from './terrain.js';

export function pressAction(battle, rules, goals = null) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit) return { type: 'end' };
  // Where death is permanent (M41), a downed ally first (rescueAi.js).
  const rescue = rescueAction(battle, unit, rules);
  if (rescue) return rescue;
  if (people(battle, unit, rules).some((u) => canSee(battle, [unit.x, unit.y], [u.x, u.y], rules))) return unit.side === 'enemy' ? inSight(battle, unit, rules) : aiAction(battle, rules);
  return advance(battle, unit, rules, goals) ?? aiAction(battle, rules);
}

// The AI's action for a unit with the enemy in sight, unless it walks out of
// sight of all of them: then its best plan that keeps one in sight, or
// overwatch.
function inSight(battle, unit, rules) {
  const action = aiAction(battle, rules);
  if (action.type !== 'move' || action.unit !== unit.id) return action;
  const foes = people(battle, unit, rules);
  const seesFrom = ([x, y]) => foes.some((u) => canSee(battle, [x, y], [u.x, u.y], rules));
  if (seesFrom(action.to)) return action;
  const keeping = plansFor(battle, unit, rules).filter((plan) => !plan.open && seesFrom(plan.to));
  if (keeping.length) return planAction(unit, bestPlan(keeping));
  return unit.ammo > 0 ? { type: 'overwatch', unit: unit.id } : action;
}

// The other side's people standing, or with none, whoever stands for it:
// a ship's turret (M39) holds its place and doesn't decide the fight, so
// those pressing on go on past it to the people.
function people(battle, unit, rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const them = foes.filter((u) => !isMachine(u, rules));
  return them.length ? them : foes;
}

// The unit's step on: a move toward the nearest of `goals` (the enemy's
// tiles, unless given), as far as one action takes it, or with nowhere
// nearer, opening a closed door beside it. Null with neither, and for a
// machine (M39), which holds its place.
export function advance(battle, unit, rules, goals = null) {
  if (isMachine(unit, rules)) return null;
  const away = stepsFrom(battle, goals ?? people(battle, unit, rules).map((u) => [u.x, u.y]), rules);
  let best = { d: away.get(`${unit.x},${unit.y}`) ?? Infinity, cost: 0, x: unit.x, y: unit.y };
  for (const spot of reachable(battle, unit, unit.mobility, rules).values()) {
    const d = away.get(`${spot.x},${spot.y}`) ?? Infinity;
    if (d < best.d || (d === best.d && spot.cost < best.cost)) best = { d, cost: spot.cost, x: spot.x, y: spot.y };
  }
  if (best.x !== unit.x || best.y !== unit.y) return { type: 'move', unit: unit.id, to: [best.x, best.y] };
  const force = forceAction(battle, unit, rules, goals);
  if (force) return force;
  const door = SIDES.find((side) => shutDoor(battle, unit.x, unit.y, side));
  return door ? { type: 'open', unit: unit.id, side: door } : null;
}
