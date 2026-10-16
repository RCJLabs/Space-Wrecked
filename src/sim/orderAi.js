// The test players' orders (M32): the order a crew member gives now, by a
// plain rule for each kind, as the action that gives it; or null. aiAction
// asks first (ai.js), so the crew's player in raids, boardings and trips,
// and on jobs once an enemy is in sight (jobAi.js and press.js hand over to
// the AI then), gives orders as a careful player might. Enemies have none,
// so the enemy AI plays as it did, and the scripted player gives none.
// Pure and deterministic. "At the start of its turn" is with all its
// actions (balance.actionPoints) still to take.
//   suppress  an enemy in sight with a GOOD shot at one of the crew, when
//             the unit's own best shot is under GOOD: the one with the
//             best shot at the crew
//   weld      at the start of its turn, with no enemy in sight and one
//             within WELD_STEPS, while it or an ally beside is down to
//             half its hit points or less: the door beside it the nearest
//             enemy would come through, to win the hurt some time
//   patch     an ally beside who is down; else one beside who has lost the
//             patch's hit points, when no shot of its own is GOOD
//   hustle    at the start of its turn, with an enemy in its sight but no
//             good shot from where it stands: a dash and a shot
//   mark      at the start of its turn: of the enemies in sight not marked
//             yet, the one with the fewest hit points
//   sedate    of the enemies in sight still awake, the one with the most
//             hit points, at a dart's odds of GOOD or better
//   kit       at the start of its turn: an ally beside not kitted out yet,
//             else itself
import { step } from './grid.js';
import { stepsFrom } from './moves.js';
import { shotOdds } from './odds.js';
import { dartOdds, orderOf, orderTargets } from './orders.js';
import { canSee } from './sight.js';

// A chance to hit, in percent, worth a shot or a dart.
export const GOOD = 40;
// How near, in steps, an enemy comes before a door is worth welding.
export const WELD_STEPS = 6;

export function orderAction(battle, unit, rules) {
  const order = orderOf(unit, rules);
  if (!order || unit.uses < 1) return null;
  const reach = orderTargets(battle, unit, rules);
  if (!reach.length) return null;
  const fresh = unit.ap >= rules.balance.actionPoints;
  const byId = (id) => battle.units.find((u) => u.id === id);
  const targets = reach.map(byId).filter(Boolean);
  const give = (target) => ({ type: 'order', unit: unit.id, target: target.id });
  switch (order.type) {
    case 'suppress': {
      if (bestShot(battle, unit, rules) >= GOOD) return null;
      const crew = battle.units.filter((u) => u.side === unit.side && u.status === 'active');
      const threat = (foe) => Math.max(0, ...crew.filter((c) => canSee(battle, [foe.x, foe.y], [c.x, c.y], rules)).map((c) => shotOdds(battle, foe, c, rules).hit));
      const worst = most(targets.filter((foe) => !foe.suppressed), threat);
      return worst && threat(worst) >= GOOD ? give(worst) : null;
    }
    case 'weld': {
      const hurt = battle.units.some((u) => u.side === unit.side && u.status === 'active' && beside(u, unit) && u.hp * 2 <= u.maxHp);
      return fresh && hurt ? weldAction(battle, unit, reach, rules) : null;
    }
    case 'patch': {
      const down = targets.find((ally) => ally.status !== 'active');
      if (down) return give(down);
      if (bestShot(battle, unit, rules) >= GOOD) return null;
      const hurt = most(targets.filter((ally) => ally.maxHp - ally.hp >= order.hp), (ally) => ally.maxHp - ally.hp);
      return hurt ? give(hurt) : null;
    }
    case 'hustle':
      return fresh && foesInSight(battle, unit, rules).length && bestShot(battle, unit, rules) < GOOD ? { type: 'order', unit: unit.id } : null;
    case 'mark': {
      if (!fresh) return null;
      const weakest = most(targets.filter((foe) => !foe.mark), (foe) => -foe.hp);
      return weakest ? give(weakest) : null;
    }
    case 'sedate': {
      const awake = targets.filter((foe) => !foe.asleep && dartOdds(battle, unit, foe, rules).hit >= GOOD);
      const biggest = most(awake, (foe) => foe.hp);
      return biggest ? give(biggest) : null;
    }
    case 'kit': {
      if (!fresh) return null;
      const ally = targets.find((u) => u.id !== unit.id);
      return give(ally ?? unit);
    }
    default:
      return null;
  }
}

// The door to weld: of the sides of its tile with one, the side whose far
// tile the nearest enemy reaches soonest, sooner than its own tile, with
// an enemy within WELD_STEPS and none in sight. Null otherwise.
function weldAction(battle, unit, sides, rules) {
  if (foesInSight(battle, unit, rules).length) return null;
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const away = stepsFrom(battle, foes.map((f) => [f.x, f.y]), rules);
  const here = away.get(`${unit.x},${unit.y}`) ?? Infinity;
  if (here > WELD_STEPS) return null;
  const far = (side) => away.get(step(unit.x, unit.y, side).join(',')) ?? Infinity;
  const side = most(sides.filter((s) => far(s) < here), (s) => -far(s));
  return side ? { type: 'order', unit: unit.id, side } : null;
}

// Two units side by side or corner to corner, or the same one.
function beside(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

// The enemies standing in its sight.
function foesInSight(battle, unit, rules) {
  return battle.units.filter((u) => u.side !== unit.side && u.status === 'active' && canSee(battle, [unit.x, unit.y], [u.x, u.y], rules));
}

// Its best chance to hit an enemy in sight, from where it stands: 0 with
// none in sight.
function bestShot(battle, unit, rules) {
  return Math.max(0, ...foesInSight(battle, unit, rules).map((foe) => shotOdds(battle, unit, foe, rules).hit));
}

// The item of `list` with the highest score, the first on a tie, or null.
function most(list, score) {
  let best = null;
  let top = -Infinity;
  for (const item of list) {
    const value = score(item);
    if (value > top) [best, top] = [item, value];
  }
  return best;
}
