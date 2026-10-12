// A player for the crew on a job, for tests and tools/jobs.js: the enemy
// AI's play (ai.js), plus what a crew sent on a job does. Pure and
// deterministic, with aiAction's shape. For the first of the crew with an
// action left:
// - a crate of the objective's in its reach, it grabs; the terminal in its
//   reach, not yet worked this round, it works;
// - with an enemy in its sight, it plays as the AI would;
// - with no one in sight, it walks toward the nearest place it can do the
//   objective from, or with none to do, toward the nearest enemy, as far
//   as one action takes it; with nowhere nearer, it opens a closed door
//   beside it. The crew came to do a job, so it doesn't wait behind a door
//   for the other side to open it, as the AI on both sides would.
// The enemy plays as the AI. Nobody guards the objective on purpose yet.
import { aiAction } from './ai.js';
import { objectiveDone } from './battle.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { reachable, stepsFrom } from './moves.js';
import { canSee } from './sight.js';
import { inReach, walkable } from './terrain.js';

export function jobAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit || unit.side !== 'crew') return aiAction(battle, rules);
  const { objective } = battle;
  const targets = objective && !objectiveDone(objective) ? objectiveTiles(battle) : [];
  const here = [unit.x, unit.y];
  const now = targets.find((at) => inReach(battle, here, at));
  if (now) return objective.type === 'grab' ? { type: 'grab', unit: unit.id, at: now } : { type: 'hack', unit: unit.id };
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  if (foes.some((u) => canSee(battle, here, [u.x, u.y], rules))) return aiAction(battle, rules);
  // Toward a tile it could do the objective from (next to a target, and in
  // reach of it once there), or else toward the enemy.
  const goals = targets.length ? targets.flatMap((at) => AROUND.map(([dx, dy]) => [at[0] + dx, at[1] + dy]).filter((to) => walkable(battle, to[0], to[1], rules) && inReach(battle, to, at))) : foes.map((u) => [u.x, u.y]);
  const away = stepsFrom(battle, goals, rules);
  let best = { d: away.get(`${unit.x},${unit.y}`) ?? Infinity, cost: 0, x: unit.x, y: unit.y };
  for (const spot of reachable(battle, unit, unit.mobility, rules).values()) {
    const d = away.get(`${spot.x},${spot.y}`) ?? Infinity;
    if (d < best.d || (d === best.d && spot.cost < best.cost)) best = { d, cost: spot.cost, x: spot.x, y: spot.y };
  }
  if (best.x !== unit.x || best.y !== unit.y) return { type: 'move', unit: unit.id, to: [best.x, best.y] };
  const door = SIDES.find((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !battle.doors.includes(edgeKey(unit.x, unit.y, side)));
  return door ? { type: 'open', unit: unit.id, side: door } : aiAction(battle, rules);
}

// What is left to do: the crates not grabbed, or the terminal while it can
// be worked this round.
function objectiveTiles(battle) {
  const { objective } = battle;
  if (objective.type === 'grab') return objective.crates.filter(([x, y]) => !objective.taken.some(([tx, ty]) => tx === x && ty === y));
  return objective.worked === battle.round ? [] : [objective.at];
}

const AROUND = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
