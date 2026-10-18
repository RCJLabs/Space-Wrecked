// A player for the crew on a job, for tests and the tools (tools/jobs.js,
// tools/run.js): pressing on (press.js), plus the job's objective
// (objectives.js). Pure and deterministic, with aiAction's shape. For the
// first of the crew with an action left:
// - a crate of the objective's in its reach, it grabs (on an extract it
//   picks it up, or takes a fallen carrier's); a carrier walks it out the
//   way in, one move a turn, and fights from where it gets to;
// - the terminal in its reach, not yet worked this round, it works;
// - a target in its reach with no charge by it, it plants one; beside a
//   charge set, it steps clear of the blast, to the best of the AI's plans
//   that leave it clear (a guard could pull the charge forever while it
//   watched beside it);
// - the captive in its reach, held, it frees;
// - on a defense it plays as the AI, which holds the way in (objectiveAi.js);
// - otherwise it presses on: toward the nearest place it can do the
//   objective from (on an escort, the far gate), or with none left to do,
//   toward the nearest enemy.
// The ward (an escort's client, a freed captive) moves last, from cover to
// cover toward its way out (wardAction). The other side is the AI's, or
// presses on in a raid.
import { aiAction, bestPlan, harm, planAction, plansFor } from './ai.js';
import { objectiveDone } from './objectives.js';
import { blastsAt } from './objectiveAi.js';
import { moveRange, reachable, stepsFrom } from './moves.js';
import { advance, pressAction } from './press.js';
import { canSee } from './sight.js';
import { inReach, walkable } from './terrain.js';

// How much the ward fears a shot: each hit point it could be expected to
// lose somewhere counts as this many steps further from its way out.
export const WARD_FEAR = 3;
const FAR = 99;

export function jobAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit || unit.side !== 'crew') return pressAction(battle, rules);
  if (unit.ward) return wardAction(battle, unit, rules);
  const { objective } = battle;
  if (!objective || objectiveDone(objective)) return pressAction(battle, rules);
  const near = (at) => inReach(battle, [unit.x, unit.y], at);
  switch (objective.type) {
    case 'defend':
      return aiAction(battle, rules);
    case 'extract': {
      if (unit.carrying) return (!unit.hauled && advance(battle, unit, rules, objective.exits)) || aiAction(battle, rules);
      const crates = left(objective.crates, objective.taken);
      const fallen = battle.units.filter((u) => u.carrying && u.status !== 'active').map((u) => [u.x, u.y]);
      const now = [...crates, ...fallen].find(near);
      if (now) return { type: 'grab', unit: unit.id, at: now };
      return pressAction(battle, rules, besideAll(battle, [...crates, ...fallen], rules));
    }
    case 'sabotage': {
      const charges = objective.charges.map((charge) => charge.at);
      const open = objective.left > 0 ? left(left(objective.targets, objective.blown), charges) : [];
      const now = open.find(near);
      if (now) return { type: 'plant', unit: unit.id, at: now };
      if (blastsAt(battle, unit.x, unit.y, charges).length) {
        const clear = unit.ammo > 0 ? plansFor(battle, unit, rules).filter((plan) => !blastsAt(battle, plan.to[0], plan.to[1], charges).length) : [];
        return clear.length ? planAction(unit, bestPlan(clear)) : aiAction(battle, rules);
      }
      return pressAction(battle, rules, besideAll(battle, open, rules));
    }
    case 'rescue': {
      const ward = battle.units.find((u) => u.id === objective.ward);
      if (ward?.status !== 'held') return pressAction(battle, rules);
      if (near([ward.x, ward.y])) return { type: 'free', unit: unit.id };
      return pressAction(battle, rules, besideAll(battle, [[ward.x, ward.y]], rules));
    }
    case 'escort':
      return pressAction(battle, rules, objective.exits);
    default: {
      const targets = objectiveTiles(battle);
      const now = targets.find(near);
      if (now) return objective.type === 'grab' ? { type: 'grab', unit: unit.id, at: now } : { type: 'hack', unit: unit.id };
      return pressAction(battle, rules, besideAll(battle, targets, rules));
    }
  }
}

// The ward's move: of the tiles it can get to this turn (staying put among
// them), the one nearest its way out, each hit point it could be expected
// to lose there (ai.js harm, from every enemy that would see it) counting
// WARD_FEAR steps; a way out it can reach wins at once. Staying put ends
// the crew's turn: the ward is last of the crew in line.
export function wardAction(battle, ward, rules) {
  const exits = battle.objective?.exits ?? [];
  const away = stepsFrom(battle, exits, rules);
  const foes = battle.units.filter((u) => u.side !== ward.side && u.status === 'active');
  let best = null;
  for (const spot of reachable(battle, ward, moveRange(ward), rules).values()) {
    const steps = away.get(`${spot.x},${spot.y}`) ?? FAR;
    const there = { ...ward, x: spot.x, y: spot.y };
    const danger = steps === 0 ? 0 : foes.filter((f) => canSee(battle, [f.x, f.y], [spot.x, spot.y], rules)).reduce((sum, f) => sum + harm(battle, f, there, rules), 0);
    const score = steps + WARD_FEAR * danger;
    if (!best || score < best.score || (score === best.score && spot.cost < best.cost)) best = { score, cost: spot.cost, x: spot.x, y: spot.y };
  }
  if (!best || (best.x === ward.x && best.y === ward.y)) return { type: 'end' };
  return { type: 'move', unit: ward.id, to: [best.x, best.y] };
}

// What is left to do on a grab or a hack: the crates not grabbed, or the
// terminal while it can be worked this round.
function objectiveTiles(battle) {
  const { objective } = battle;
  if (objective.type === 'grab') return left(objective.crates, objective.taken);
  return objective.worked === battle.round ? [] : [objective.at];
}

// The tiles of `list` not in `done`.
function left(list, done) {
  return list.filter(([x, y]) => !done.some(([dx, dy]) => dx === x && dy === y));
}

// The tiles a unit could stand on to reach any of `targets` from.
function besideAll(battle, targets, rules) {
  const goals = targets.flatMap((at) => AROUND.map(([dx, dy]) => [at[0] + dx, at[1] + dy]).filter((to) => walkable(battle, to[0], to[1], rules) && inReach(battle, to, at)));
  return goals.length ? goals : null;
}

const AROUND = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
