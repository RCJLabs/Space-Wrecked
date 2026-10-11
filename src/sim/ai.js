// The enemy AI, v1: the next action for the side whose turn it is, unit by
// unit, like any player (aiAction has scripted.js's shape). Pure and
// deterministic: no random numbers, and ties go to the plan found first.
//
// For the first unit of that side with an action left, every plan it could
// make this turn: stay, move (one action) or dash (both), then shoot at an
// enemy it can see, go on overwatch, or nothing (after a dash). Or breach:
// open a closed door beside it and shoot or watch through it, which draws
// no overwatch fire, since no one moves. Each plan is scored in hit points:
//   + the harm its shot is expected to do: the chance to hit times the
//     damage a hit does, kills counted extra (target choice falls out of
//     this: a flanked or nearly dead enemy is worth more)
//   + something for overwatch, more with an enemy close enough to come
//     into sight on its next turn
//   - the harm every enemy who can see where it ends up is expected to do
//     to it there (cover cuts it, distance changes it)
//   - the overwatch fire it would walk through on the way
//   - when it won't shoot, a little for every step it ends up from the
//     nearest enemy, so with no one in sight it pushes in from the airlock
//     and through the doors (a shot's odds already count the distance)
// Each spot is judged as it will be: with the doors its path opens.
//
// A shot worth taking (MIN_SHOT) beats any plan without one, unless it is
// reckless (scores RECKLESS worse than the best plan without a shot):
// boarders are there to fight, and two sides that only ever watched would
// never meet. With no such shot in reach it moves up and watches (the
// overwatch fallback). And it never ends up in the open, seen by an enemy
// against whom it would have no cover, without a reason: a plan like that
// only counts for a shot worth the risk (OPEN_SHOT) and better than any
// covered tile offers, or when no covered tile is in reach.
import { coverFrom } from './cover.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { reachable, sideToward, stepsFrom } from './moves.js';
import { shotOdds } from './odds.js';
import { canSee } from './sight.js';

export const WEIGHTS = {
  kill: 4, // a kill, on top of the damage, in hit points: one less gun
  overwatch: 1, // overwatch, with an enemy that could step into sight
  idle: 0.3, // overwatch with no enemy that close
  safety: 0.8, // how much the harm it can be expected to take counts
  near: 0.2, // each step from the nearest enemy, when it won't shoot
};
const WATCH_STEPS = 8; // an enemy this many steps off could come into sight
const FAR = 99; // steps to an enemy it can't walk to
export const MIN_SHOT = 0.4; // expected harm, in hit points, that makes a shot worth taking
export const OPEN_SHOT = 1; // and worth standing in the open for
export const RECKLESS = 3; // how much worse than holding back a shot may score and still go first

export function aiAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit) return { type: 'end' };
  if (unit.ammo < 1) return { type: 'reload', unit: unit.id };
  const plan = bestPlan(plansFor(battle, unit, rules));
  if (plan.open) return { type: 'open', unit: unit.id, side: plan.open };
  if (plan.to[0] !== unit.x || plan.to[1] !== unit.y) return { type: 'move', unit: unit.id, to: plan.to };
  return plan.then.type === 'shoot' ? { type: 'shoot', unit: unit.id, target: plan.then.target } : { type: 'overwatch', unit: unit.id };
}

// Every plan for `unit` this turn, scored:
//   { to: [x, y], ap, open, path, then, attack, threat, risk, steps, exposed, score }
// ap is the actions it takes to get set (0 to stay, 1 to move or open a
// door, 2 to dash); open is the side of the door it opens first, or null;
// then is { type: 'shoot', target, flanked }, { type: 'overwatch' } or
// null (no action left); attack, threat and risk are expected harm, in hit
// points (risk is the overwatch fire on the way); steps run to the nearest
// enemy; exposed is the ids of the enemies who would see it there with no
// cover between.
export function plansFor(battle, unit, rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const away = stepsFrom(battle, foes.map((f) => [f.x, f.y]), rules);
  const plans = [];
  // What it can do from a spot, in a battle with its doors as given.
  const consider = (field, spot, ap, open) => {
    const there = { ...unit, x: spot.x, y: spot.y };
    const seenBy = foes.filter((f) => canSee(field, [f.x, f.y], [spot.x, spot.y], rules));
    const base = {
      to: [spot.x, spot.y],
      ap,
      open,
      path: spot.path,
      threat: seenBy.reduce((sum, f) => sum + harm(field, f, there, rules), 0),
      risk: overwatchRisk(battle, unit, spot.path, foes, rules),
      steps: away.get(`${spot.x},${spot.y}`) ?? FAR,
      exposed: seenBy.filter((f) => coverFrom(field, [spot.x, spot.y], [f.x, f.y], rules).flanked).map((f) => f.id),
    };
    if (unit.ap - ap < 1) {
      plans.push({ ...base, then: null, attack: 0 });
      return;
    }
    // Sight goes both ways: whoever sees it there, it can shoot.
    for (const foe of seenBy) {
      const flanked = coverFrom(field, [foe.x, foe.y], [spot.x, spot.y], rules).flanked;
      plans.push({ ...base, then: { type: 'shoot', target: foe.id, flanked }, attack: harm(field, there, foe, rules) });
    }
    plans.push({ ...base, then: { type: 'overwatch' }, attack: base.steps <= WATCH_STEPS ? WEIGHTS.overwatch : WEIGHTS.idle });
  };
  for (const spot of reachable(battle, unit, unit.mobility * Math.min(unit.ap, 2), rules).values()) {
    consider(withDoorsOpened(battle, spot.path), spot, spot.cost === 0 ? 0 : spot.cost <= unit.mobility ? 1 : 2, null);
  }
  // Breaching: open a closed door beside it, then shoot or watch through.
  if (unit.ap >= 2) {
    const here = { x: unit.x, y: unit.y, cost: 0, path: [[unit.x, unit.y]] };
    for (const side of SIDES) {
      const key = edgeKey(unit.x, unit.y, side);
      if (wallAt(battle.map, unit.x, unit.y, side) !== 'door' || battle.doors.includes(key)) continue;
      consider({ ...battle, doors: [...battle.doors, key] }, here, 1, side);
    }
  }
  for (const plan of plans) plan.score = plan.attack - WEIGHTS.safety * (plan.threat + plan.risk) - (isShot(plan) ? 0 : WEIGHTS.near * plan.steps);
  return plans;
}

// The plan to make. Plans that end in the open are only allowed for a shot
// worth the risk and better than any covered plan has, or when no plan is
// covered. Of those allowed, the best-scoring shot worth taking, or else
// the best score.
export function bestPlan(plans) {
  const covered = plans.filter((p) => !p.exposed.length);
  const coveredShot = Math.max(-Infinity, ...covered.filter(isShot).map((p) => p.attack));
  const allowed = plans.filter((p) => !p.exposed.length || !covered.length || (isShot(p) && p.attack >= OPEN_SHOT && p.attack > coveredShot));
  const holding = Math.max(-Infinity, ...allowed.filter((p) => !isShot(p)).map((p) => p.score));
  const shots = allowed.filter((p) => isShot(p) && p.attack >= MIN_SHOT && p.score >= holding - RECKLESS);
  return (shots.length ? shots : allowed).reduce((best, plan) => (plan.score > best.score ? plan : best));
}

function isShot(plan) {
  return plan.then?.type === 'shoot';
}

// The battle as it will be once a walk along `path` has opened the closed
// doors on its way.
function withDoorsOpened(battle, path) {
  let field = battle;
  for (let i = 1; i < path.length; i++) field = throughDoor(field, path[i - 1], path[i]);
  return field;
}

// The battle with the door between two tiles side by side open, if there is
// a closed one.
function throughDoor(battle, from, to) {
  const side = sideToward(from, to);
  const key = edgeKey(from[0], from[1], side);
  if (wallAt(battle.map, from[0], from[1], side) !== 'door' || battle.doors.includes(key)) return battle;
  return { ...battle, doors: [...battle.doors, key].sort() };
}

// The harm `shooter` can be expected to do with one shot at `target` (as
// placed): the chance to hit times the damage a hit does, kept to the hit
// points it has, with a kill counted WEIGHTS.kill more. In hit points.
export function harm(battle, shooter, target, rules, options) {
  const odds = shotOdds(battle, shooter, target, rules, options);
  if (!odds.hit) return 0;
  const weapon = rules.weapons.get(shooter.weapon);
  const [least, most] = weapon.damage;
  const crit = odds.crit / 100;
  let damage = 0;
  let kill = 0;
  for (let roll = least; roll <= most; roll++) {
    for (const [p, extra] of [[1 - crit, 0], [crit, weapon.critDamage]]) {
      const dealt = Math.max(1, roll + extra - target.armor);
      damage += p * Math.min(dealt, target.hp);
      if (dealt >= target.hp) kill += p;
    }
  }
  const rolls = most - least + 1;
  return (odds.hit / 100) * ((damage + WEIGHTS.kill * kill) / rolls);
}

// The fire a walk along `path` would draw: each enemy on overwatch shoots
// at the first tile on it that it can see (not one shared with an ally,
// where it holds fire), with doors opening as the walk reaches them, as
// battle.js walk() does.
function overwatchRisk(battle, unit, path, foes, rules) {
  const watching = new Set(foes.filter((f) => f.overwatch));
  let risk = 0;
  let field = battle;
  for (let i = 1; i < path.length && watching.size; i++) {
    const [x, y] = path[i];
    field = throughDoor(field, path[i - 1], path[i]);
    if (battle.units.some((u) => u !== unit && u.status !== 'dead' && u.x === x && u.y === y)) continue;
    for (const foe of watching) {
      if (!canSee(field, [foe.x, foe.y], [x, y], rules)) continue;
      risk += harm(field, foe, { ...unit, x, y }, rules, { overwatch: true });
      watching.delete(foe);
    }
  }
  return risk;
}
