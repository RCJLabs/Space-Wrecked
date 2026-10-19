// The enemy AI, v1: the next action for the side whose turn it is, unit by
// unit, like any player (aiAction has scripted.js's shape). Pure and
// deterministic: no random numbers, and ties go to the plan found first.
// Playing the crew (the test players, M32), a unit first gives its job's
// order where orderAi.js's plain rule for it says to; enemies have none.
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
//     and through the doors (a shot's odds already count the distance); a
//     weapon with a reach (M37) closes to it, each step past its reach
//     counting more, and watches only with an enemy close enough to step
//     within it
//   - the fire it would burn in, standing where a weapon set a tile burning
//     (M37); a wrecked room's fire, which never goes out, it crosses as
//     before, or it could never reach the far side of one
//   - on a job, what it plays for in the objective (objectiveAi.js, M38): a
//     guard that won't shoot keeps by what it guards in place of closing on
//     the nearest enemy, each step past GUARD_RANGE counting; on a defense
//     every plan counts the steps left to the way in; a shot at a crate's
//     carrier or at the person the crew brings out counts more; beside a
//     charge set, an enemy can pull it (a plan of its own, weighed as a
//     shot); and every unit counts the blast of a charge beside where it
//     ends up
// Each spot is judged as it will be: with the doors its path opens. A
// weapon's rules count (weapons.js, M37): it shoots only within its reach,
// a burst's shots and the armor it pierces count in the harm, and so do a
// stunned target's lost turn and the fire a hit leaves under it.
//
// A shot worth taking (MIN_SHOT) beats any plan without one, unless it is
// reckless (scores RECKLESS worse than the best plan without a shot):
// boarders are there to fight, and two sides that only ever watched would
// never meet. With no such shot in reach it moves up and watches (the
// overwatch fallback). And it never ends up in the open, seen by an enemy
// against whom it would have no cover, without a reason: a plan like that
// only counts for a shot worth the risk (OPEN_SHOT) and better than any
// covered tile offers, or when no covered tile is in reach.
import { isMachine } from './battle.js';
import { coverFrom } from './cover.js';
import { blastsAt, playFor } from './objectiveAi.js';
import { orderAction } from './orderAi.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { moveRange, reachable, sideToward, stepsFrom } from './moves.js';
import { shotOdds } from './odds.js';
import { canSee } from './sight.js';
import { burningAt, hazardAt, shutDoor } from './terrain.js';
import { armorAgainst, shotsOf, withinReach } from './weapons.js';

export const WEIGHTS = {
  kill: 4, // a kill, on top of the damage, in hit points: one less gun
  overwatch: 1, // overwatch, with an enemy that could step into sight
  idle: 0.3, // overwatch with no enemy that close
  safety: 0.8, // how much the harm it can be expected to take counts
  near: 0.2, // each step from the nearest enemy, when it won't shoot
  stun: 2.5, // a stunned enemy's lost turn: about one shot's harm
  close: 0.5, // each step past its reach from the nearest enemy, for a weapon with one (M37)
  guard: 0.5, // each step past GUARD_RANGE from what it guards, when it won't shoot (M38)
  push: 0.6, // each step left to the way in, on a defense (M38)
  prize: 1.6, // what a shot at a carrier or the crew's ward counts, times its harm (M38)
  pull: 5, // a charge pulled: a target saved, about a kill's worth (M38)
};
const WATCH_STEPS = 8; // an enemy this many steps off could come into sight
export const GUARD_RANGE = 3; // a guard this many steps from what it guards is at its post
const FAR = 99; // steps to an enemy it can't walk to
export const MIN_SHOT = 0.4; // expected harm, in hit points, that makes a shot worth taking
export const OPEN_SHOT = 1; // and worth standing in the open for
export const RECKLESS = 3; // how much worse than holding back a shot may score and still go first

export function aiAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit) return { type: 'end' };
  const order = orderAction(battle, unit, rules);
  if (order) return order;
  if (unit.ammo < 1) return { type: 'reload', unit: unit.id };
  // A machine (M39, a ship's turret) has no moves and opens no door: it
  // shoots or watches from where it stands.
  const plans = plansFor(battle, unit, rules);
  return planAction(unit, bestPlan(isMachine(unit, rules) ? plans.filter((plan) => !plan.open) : plans));
}

// The next action toward a plan of plansFor's: open the door, get there,
// then what it does there.
export function planAction(unit, plan) {
  if (plan.open) return { type: 'open', unit: unit.id, side: plan.open };
  if (plan.to[0] !== unit.x || plan.to[1] !== unit.y) return { type: 'move', unit: unit.id, to: plan.to };
  if (plan.then?.type === 'pull') return { type: 'pull', unit: unit.id, at: plan.then.at };
  return plan.then.type === 'shoot' ? { type: 'shoot', unit: unit.id, target: plan.then.target } : { type: 'overwatch', unit: unit.id };
}

// Every plan for `unit` this turn, scored:
//   { to: [x, y], ap, open, path, then, attack, threat, risk, steps, guard,
//     push, exposed, score }
// ap is the actions it takes to get set (0 to stay, 1 to move or open a
// door, 2 to dash); open is the side of the door it opens first, or null;
// then is { type: 'shoot', target, flanked }, { type: 'overwatch' },
// { type: 'pull', at } (a charge, M38) or null (no action left); attack,
// threat and risk are expected harm, in hit points (risk is the overwatch
// fire on the way); steps run to the nearest enemy, guard to what it
// guards and push to the way in it pushes for (objectiveAi.js; 0 with
// none); exposed is the ids of the enemies who would see it there with no
// cover between.
export function plansFor(battle, unit, rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const away = stepsFrom(battle, foes.map((f) => [f.x, f.y]), rules);
  const play = playFor(battle, unit);
  const post = play.guard && stepsFrom(battle, play.guard, rules);
  const line = play.push && stepsFrom(battle, play.push, rules);
  const blast = rules.balance.blastDamage ?? 0;
  const plans = [];
  // What it can do from a spot, in a battle with its doors as given. A ward
  // (objectives.js) has no weapon: it only moves.
  const weapon = rules.weapons.get(unit.weapon);
  const reach = weapon?.reach ?? null;
  const consider = (field, spot, ap, open) => {
    const there = { ...unit, x: spot.x, y: spot.y };
    const seenBy = foes.filter((f) => canSee(field, [f.x, f.y], [spot.x, spot.y], rules));
    const burning = burningAt(field, spot.x, spot.y) ? rules.balance.fireDamage : 0;
    const blasts = blastsAt(field, spot.x, spot.y, play.charges);
    const key = `${spot.x},${spot.y}`;
    const base = {
      to: [spot.x, spot.y],
      ap,
      open,
      path: spot.path,
      threat: seenBy.reduce((sum, f) => sum + harm(field, f, there, rules), 0) + burning + blast * blasts.length,
      risk: overwatchRisk(battle, unit, spot.path, foes, rules),
      steps: away.get(key) ?? FAR,
      guard: post ? post.get(key) ?? FAR : 0,
      push: line ? line.get(key) ?? FAR : 0,
      exposed: seenBy.filter((f) => coverFrom(field, [spot.x, spot.y], [f.x, f.y], rules).flanked).map((f) => f.id),
    };
    if (unit.ap - ap < 1 || !weapon) {
      plans.push({ ...base, then: null, attack: 0 });
      return;
    }
    // Sight goes both ways: whoever sees it there, it can shoot, within its
    // weapon's reach; a carrier or the crew's ward counts more.
    for (const foe of seenBy) {
      if (!withinReach(weapon, [spot.x, spot.y], [foe.x, foe.y])) continue;
      const flanked = coverFrom(field, [foe.x, foe.y], [spot.x, spot.y], rules).flanked;
      const attack = harm(field, there, foe, rules) * (play.prizes.has(foe.id) ? WEIGHTS.prize : 1);
      plans.push({ ...base, then: { type: 'shoot', target: foe.id, flanked }, attack });
    }
    // Beside a charge the other side set, it can pull it, and that one
    // won't blow.
    if (unit.side === 'enemy') {
      for (const at of blasts) plans.push({ ...base, threat: base.threat - blast, then: { type: 'pull', at }, attack: WEIGHTS.pull });
    }
    const watching = reach ? base.steps <= reach + 1 : base.steps <= WATCH_STEPS;
    plans.push({ ...base, then: { type: 'overwatch' }, attack: watching ? WEIGHTS.overwatch : WEIGHTS.idle });
  };
  for (const spot of reachable(battle, unit, moveRange(unit), rules).values()) {
    consider(withDoorsOpened(battle, spot.path), spot, spot.cost === 0 ? 0 : spot.cost <= unit.mobility ? 1 : 2, null);
  }
  // Breaching: open a closed door beside it, then shoot or watch through.
  if (unit.ap >= 2) {
    const here = { x: unit.x, y: unit.y, cost: 0, path: [[unit.x, unit.y]] };
    for (const side of SIDES) {
      if (!shutDoor(battle, unit.x, unit.y, side)) continue;
      consider({ ...battle, doors: [...battle.doors, edgeKey(unit.x, unit.y, side)] }, here, 1, side);
    }
  }
  // Off its post a guard counts its steps back; anyone else, its steps from
  // the nearest enemy. On a defense every plan counts the way in.
  const far = (plan) => {
    if (post) return WEIGHTS.guard * Math.max(0, plan.guard - GUARD_RANGE);
    return reach ? WEIGHTS.close * Math.max(0, plan.steps - reach) : WEIGHTS.near * plan.steps;
  };
  for (const plan of plans) {
    plan.score = plan.attack - WEIGHTS.safety * (plan.threat + plan.risk) - (isShot(plan) ? 0 : far(plan)) - (line ? WEIGHTS.push * plan.push : 0);
  }
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

// A plan that does something to the other side: a shot, or a charge
// pulled (M38).
function isShot(plan) {
  return plan.then?.type === 'shoot' || plan.then?.type === 'pull';
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
// points it has, with a kill counted WEIGHTS.kill more. In hit points. None
// past its weapon's reach. A burst, a stun or fire (weapons.js) is weighed
// shot by shot (rulesHarm).
export function harm(battle, shooter, target, rules, options) {
  const weapon = rules.weapons.get(shooter.weapon);
  // A ward (objectives.js) has no weapon, and does no harm.
  if (!weapon || !withinReach(weapon, [shooter.x, shooter.y], [target.x, target.y])) return 0;
  const odds = shotOdds(battle, shooter, target, rules, options);
  if (!odds.hit) return 0;
  const shots = shotsOf(weapon, options?.overwatch);
  if (shots > 1 || weapon.stun || weapon.burn) return rulesHarm(battle, weapon, odds, target, shots, rules);
  const [least, most] = weapon.damage;
  const crit = odds.crit / 100;
  const armor = armorAgainst(target.armor, weapon);
  let damage = 0;
  let kill = 0;
  for (let roll = least; roll <= most; roll++) {
    for (const [p, extra] of [[1 - crit, 0], [crit, weapon.critDamage]]) {
      const dealt = Math.max(1, roll + extra - armor);
      damage += p * Math.min(dealt, target.hp);
      if (dealt >= target.hp) kill += p;
    }
  }
  const rolls = most - least + 1;
  return (odds.hit / 100) * ((damage + WEIGHTS.kill * kill) / rolls);
}

// The harm of a shot with a weapon's rules: its shots one by one, each at
// the same odds, stopping once the target drops, worked out over the hit
// points the target could have left. A kill counts WEIGHTS.kill more; a
// target still standing after a hit counts WEIGHTS.stun more for a stun,
// and the fire it then stands in (at most what it has left) for a burn.
function rulesHarm(battle, weapon, odds, target, shots, rules) {
  const [least, most] = weapon.damage;
  const [hit, crit] = [odds.hit / 100, odds.crit / 100];
  const armor = armorAgainst(target.armor, weapon);
  const each = 1 / (most - least + 1);
  // [hit points left, hit yet?] -> chance, starting untouched.
  let states = new Map([[`${target.hp}|0`, 1]]);
  for (let n = 0; n < shots; n++) {
    const next = new Map();
    const add = (hp, struck, p) => next.set(`${hp}|${struck}`, (next.get(`${hp}|${struck}`) ?? 0) + p);
    for (const [key, p] of states) {
      const [hp, struck] = key.split('|').map(Number);
      if (hp === 0) {
        add(0, 1, p);
        continue;
      }
      add(hp, struck, p * (1 - hit));
      for (let roll = least; roll <= most; roll++) {
        for (const [q, extra] of [[1 - crit, 0], [crit, weapon.critDamage]]) {
          add(Math.max(0, hp - Math.max(1, roll + extra - armor)), 1, p * hit * q * each);
        }
      }
    }
    states = next;
  }
  let [left, kill, standing, burnt] = [0, 0, 0, 0];
  const burns = weapon.burn ? rules.balance.fireDamage : 0;
  for (const [key, p] of states) {
    const [hp, struck] = key.split('|').map(Number);
    left += p * hp;
    if (hp === 0) kill += p;
    else if (struck) {
      standing += p;
      burnt += p * Math.min(burns, hp);
    }
  }
  const stun = weapon.stun ? WEIGHTS.stun * standing : 0;
  return target.hp - left + WEIGHTS.kill * kill + stun + (hazardAt(battle, target.x, target.y) ? 0 : burnt);
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
