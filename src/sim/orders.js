// A crew job's order in a fight (ROADMAP §4.3, M32): each job in
// data/jobs.json has one (`order`), usable `uses` times a fight. battle.js
// carries out { type: 'order', unit, target?, side? } through doOrder, and
// calls the turn hooks below for what orders leave behind. Pure: it works
// on battle.js's draft, as battle.js does.
//
// The kinds, each with its numbers in the data:
//   suppress { aim }    an enemy in sight: its shots take `aim` (below 0)
//                       until its side's next turn ends. Ends the unit's
//                       turn and uses a round.
//   weld     { rounds } the door on the given side of its tile closes and is
//                       welded shut for `rounds` rounds, this one counted:
//                       no one walks or sees through it.
//   patch    { hp }     an ally beside, hurt or down: `hp` hit points back,
//                       up to their most. One down gets up with `hp`.
//   hustle   { ap }     itself: `ap` more actions this turn. It costs none.
//   mark     { aim }    an enemy in sight: the other side's shots at it take
//                       `aim` until the crew's next turn ends.
//   sedate   { aim }    an enemy in sight: a dart, rolled at a shot's odds
//                       (odds.js) and `aim` more (0, or a xenobiologist's
//                       rank 1, M32b). A hit puts it to sleep through its
//                       side's next turn. Ends the unit's turn and uses a
//                       round.
//   kit      { armor }  itself or an ally beside, once each: a full clip
//                       and `armor` more armor for the rest of the fight.
// The others take one action. What orders leave on a unit: `uses` (the
// uses left), `mark` (null, or { aim, turns }: the crew's turn ends left),
// `suppressed` (null, or { aim }), `asleep` and `kitted`; on the battle,
// `welds` ([{ key, until }]: the door's edge key, mapFromShip.js edgeKey,
// and the last round it holds).
import { percent } from '../core/rng.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { shotOdds } from './odds.js';
import { jobAtRank } from './ranks.js';
import { talentOrder } from './talents.js';
import { canSee } from './sight.js';
import { weldedAt } from './terrain.js';

// Each kind's numbers, with how far they go, and whom it reaches: 'enemy'
// (in sight), 'ally' (beside), 'self', 'kit' (itself or an ally beside) or
// 'door' (a side of its tile).
export const ORDER_KINDS = {
  suppress: { fields: { aim: [-100, -1] }, reaches: 'enemy' },
  weld: { fields: { rounds: [1, 20] }, reaches: 'door' },
  patch: { fields: { hp: [1, 99] }, reaches: 'ally' },
  hustle: { fields: { ap: [1, 3] }, reaches: 'self' },
  mark: { fields: { aim: [1, 100] }, reaches: 'enemy' },
  sedate: { fields: { aim: [0, 100] }, reaches: 'enemy' },
  kit: { fields: { armor: [1, 5] }, reaches: 'kit' },
};

// The crew's turn ends a mark lasts, the one it was made in counted.
const MARK_TURNS = 2;

// A unit's order (its job's, data/jobs.json, at the unit's rank, M32b), or
// null: enemies have none.
export function orderOf(unit, rules) {
  if (unit.side !== 'crew') return null;
  // A loyal companion's is their talent, past rank 2 (M33c, talents.js).
  if (unit.talent) return talentOrder(rules, unit.talent);
  return jobAtRank(rules.jobs.get(unit.kind), unit.rank ?? 0)?.order ?? null;
}

// What a new unit starts a fight with: its order's uses, and nothing on it.
export function freshOrders(order) {
  return { uses: order?.uses ?? 0, mark: null, suppressed: null, asleep: false, kitted: false };
}

// What the unit's order could reach now: the units' ids, or for a weld the
// sides of its tile; [] when it has none, no uses left, or nothing in
// reach. Ready or not to act is the caller's (battle.js readyToAct).
export function orderTargets(battle, unit, rules) {
  const order = orderOf(unit, rules);
  if (!order || unit.uses < 1) return [];
  const others = battle.units.filter((u) => u.id !== unit.id);
  switch (ORDER_KINDS[order.type]?.reaches) {
    case 'enemy':
      if ((order.type === 'suppress' || order.type === 'sedate') && unit.ammo < 1) return [];
      return others.filter((u) => u.side !== unit.side && u.status === 'active' && canSee(battle, [unit.x, unit.y], [u.x, u.y], rules)).map((u) => u.id);
    case 'ally':
      return others.filter((u) => u.side === unit.side && beside(unit, u) && patchable(u)).map((u) => u.id);
    case 'kit':
      return [unit, ...others.filter((u) => u.side === unit.side && beside(unit, u))].filter((u) => u.status === 'active' && !u.kitted).map((u) => u.id);
    case 'self':
      return [unit.id];
    case 'door':
      return SIDES.filter((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !weldedAt(battle, unit.x, unit.y, side));
    default:
      return [];
  }
}

// The odds of a sedative dart: a shot's, part by part (odds.js), and the
// order's own `aim` as a part of its own ('steady') when it has any.
export function dartOdds(battle, unit, target, rules) {
  const odds = shotOdds(battle, unit, target, rules);
  const steady = orderOf(unit, rules)?.aim ?? 0;
  if (!steady) return odds;
  const hitParts = [...odds.hitParts, { why: 'steady', value: steady }];
  return { ...odds, hitParts, hit: Math.max(0, Math.min(100, hitParts.reduce((sum, part) => sum + part.value, 0))) };
}

// Carries out the unit's order on the draft. Returns an error, or null.
export function doOrder(battle, unit, action, events, rules) {
  const order = orderOf(unit, rules);
  if (!order) return `${unit.name} has no order of their own.`;
  if (unit.uses < 1) return `${unit.name} has no ${order.name} left this fight.`;
  const reaches = ORDER_KINDS[order.type]?.reaches;
  if (reaches === 'door') return weld(battle, unit, order, action.side, events);
  const target = reaches === 'self' ? unit : battle.units.find((u) => u.id === action.target);
  if (!target || !orderTargets(battle, unit, rules).includes(target.id)) return whyNot(battle, unit, order, target, rules);
  unit.uses -= 1;
  const said = { type: 'order', order: order.type, unit: unit.id, target: target.id };
  switch (order.type) {
    case 'suppress':
      unit.ap = 0;
      unit.ammo -= 1;
      target.suppressed = { aim: order.aim };
      events.push({ ...said, aim: order.aim });
      return null;
    case 'patch': {
      const up = target.status !== 'active';
      const hp = up ? Math.min(target.maxHp, order.hp) : Math.min(target.maxHp, target.hp + order.hp);
      events.push({ ...said, hp, healed: up ? hp : hp - target.hp, up });
      if (up) {
        target.status = 'active';
        target.bleed = 0;
        target.ap = 0;
      }
      target.hp = hp;
      unit.ap -= 1;
      return null;
    }
    case 'hustle':
      unit.ap += order.ap;
      events.push({ ...said, ap: order.ap });
      return null;
    case 'mark':
      unit.ap -= 1;
      target.mark = { aim: order.aim, turns: MARK_TURNS };
      events.push({ ...said, aim: order.aim });
      return null;
    case 'sedate': {
      const odds = dartOdds(battle, unit, target, rules);
      unit.ap = 0;
      unit.ammo -= 1;
      const hit = percent(battle.rng, odds.hit);
      battle.rng = hit.state;
      battle.misses[unit.side] = hit.value ? 0 : battle.misses[unit.side] + 1;
      if (hit.value) {
        target.asleep = true;
        target.overwatch = false;
      }
      events.push({ ...said, chance: odds.hit, roll: hit.roll, hit: hit.value });
      return null;
    }
    case 'kit': {
      const clip = rules.weapons.get(target.weapon).clip;
      unit.ap -= 1;
      target.armor += order.armor;
      target.ammo = clip;
      target.kitted = true;
      events.push({ ...said, armor: order.armor, ammo: clip });
      return null;
    }
    default:
      unit.uses += 1;
      return `Unknown order "${order.type}".`;
  }
}

function weld(battle, unit, order, side, events) {
  if (!SIDES.includes(side) || wallAt(battle.map, unit.x, unit.y, side) !== 'door') return `There's no door on that side of ${unit.name}.`;
  if (weldedAt(battle, unit.x, unit.y, side)) return 'That door is welded shut already.';
  const key = edgeKey(unit.x, unit.y, side);
  unit.uses -= 1;
  unit.ap -= 1;
  battle.doors = battle.doors.filter((door) => door !== key);
  const until = battle.round + order.rounds - 1;
  battle.welds = [...battle.welds, { key, until }];
  events.push({ type: 'order', order: 'weld', unit: unit.id, at: [unit.x, unit.y], side, until });
  return null;
}

// Why an order can't reach its target, in words.
function whyNot(battle, unit, order, target, rules) {
  const reaches = ORDER_KINDS[order.type]?.reaches;
  if ((order.type === 'suppress' || order.type === 'sedate') && unit.ammo < 1) return `${unit.name} has to reload first.`;
  if (!target) return `${order.name} needs someone to reach.`;
  if (reaches === 'enemy') {
    if (target.side === unit.side) return `${order.name} is for the enemy.`;
    if (target.status !== 'active') return `${target.name} is already down.`;
    return `${unit.name} can't see ${target.name}.`;
  }
  if (target.side !== unit.side) return `${order.name} is for the crew.`;
  if (!beside(unit, target)) return `${unit.name} has to be next to ${target.name}.`;
  if (reaches === 'kit') return target.kitted ? `${target.name} is kitted out already.` : `${target.name} is ${target.status}.`;
  return target.status === 'active' ? `${target.name} isn't hurt.` : `${target.name} is ${target.status}.`;
}

// A unit's side's turn begins: one asleep gets no actions.
export function wakeTurn(battle, unit, events) {
  if (!unit.asleep) return;
  unit.ap = 0;
  events.push({ type: 'asleep', unit: unit.id });
}

// A side's turn ends: its units shake off suppression and wake, and at the
// crew's, marks wear down a turn.
export function endOrders(battle, side, events) {
  for (const unit of battle.units) {
    if (unit.side === side) {
      unit.suppressed = null;
      if (unit.asleep) {
        unit.asleep = false;
        events.push({ type: 'awake', unit: unit.id });
      }
    }
    if (side === 'crew' && unit.mark) unit.mark = unit.mark.turns > 1 ? { ...unit.mark, turns: unit.mark.turns - 1 } : null;
  }
}

// A new round begins: the welds past their last round give way, closed.
export function endWelds(battle, events) {
  const [held, given] = [battle.welds.filter((w) => w.until >= battle.round), battle.welds.filter((w) => w.until < battle.round)];
  if (!given.length) return;
  battle.welds = held;
  for (const { key } of given) events.push({ type: 'unweld', key });
}

// Ally `b` beside `a`: next to it by a side or a corner, as Stabilize asks.
function beside(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

// One Patch can help: down or stable, or standing and hurt.
function patchable(unit) {
  return unit.status === 'down' || unit.status === 'stable' || (unit.status === 'active' && unit.hp < unit.maxHp);
}
