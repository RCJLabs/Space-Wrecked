// A player for the crew on a job, for tests and tools/jobs.js: pressing on
// (press.js), plus the job's objective. Pure and deterministic, with
// aiAction's shape. For the first of the crew with an action left:
// - a crate of the objective's in its reach, it grabs; the terminal in its
//   reach, not yet worked this round, it works;
// - otherwise it presses on: toward the nearest place it can do the
//   objective from, or with none left to do, toward the nearest enemy.
// The other side is the AI's, or presses on in a raid. Nobody guards the
// objective on purpose yet.
import { objectiveDone } from './battle.js';
import { pressAction } from './press.js';
import { inReach, walkable } from './terrain.js';

export function jobAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit || unit.side !== 'crew') return pressAction(battle, rules);
  const { objective } = battle;
  const targets = objective && !objectiveDone(objective) ? objectiveTiles(battle) : [];
  const now = targets.find((at) => inReach(battle, [unit.x, unit.y], at));
  if (now) return objective.type === 'grab' ? { type: 'grab', unit: unit.id, at: now } : { type: 'hack', unit: unit.id };
  // Toward a tile it could do the objective from: next to a target, and
  // in reach of it once there.
  const goals = targets.flatMap((at) => AROUND.map(([dx, dy]) => [at[0] + dx, at[1] + dy]).filter((to) => walkable(battle, to[0], to[1], rules) && inReach(battle, to, at)));
  return pressAction(battle, rules, goals.length ? goals : null);
}

// What is left to do: the crates not grabbed, or the terminal while it can
// be worked this round.
function objectiveTiles(battle) {
  const { objective } = battle;
  if (objective.type === 'grab') return objective.crates.filter(([x, y]) => !objective.taken.some(([tx, ty]) => tx === x && ty === y));
  return objective.worked === battle.round ? [] : [objective.at];
}

const AROUND = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
