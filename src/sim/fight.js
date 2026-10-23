// A battle as the player fights it on the Fight screen: the battle
// (battle.js), the crew member giving orders, and what the next tap would
// do. Pure: reduceFight(fight, action, rules) returns a new fight, or the
// same one when nothing changed.
//
// The player plays the crew. These rules keep a stray tap from spending a
// turn, as the builder's keep one from placing a part:
// - A tap on a tile the selected unit can reach shows the move there: its
//   path, and whether it takes one action or both (a dash). Only a second
//   tap on that tile makes it.
// - A tap on an enemy it can see shows the shot, with the odds part by
//   part (odds.js). Only a second tap on that enemy, or Fire, takes it. An
//   enemy in sight but past the weapon's reach (M37) says so.
// - Its job's order (orders.js) is shown first, at whom or what it would
//   reach, and only a second press takes it. While an order that reaches an
//   enemy is shown, a tap on another enemy shows it at them instead.
// - A tap on another crew member selects them instead.
// Every action goes through battle.js. When the crew's turn ends, the
// enemy's whole turn is played at once by the enemy AI (ai.js), pressing
// on where the battle says so (press.js), up to the crew's next turn or the
// end of the battle. What a dispatch played is kept in `played`, for the screen to
// show it happening.
//
// A fight:
//   battle    the battle now
//   selected  the id of the crew member giving orders, or null
//   preview   null, or what a second tap (or Fire) does:
//             { type: 'move', to: [x, y], cost, dash, path }
//             { type: 'shoot', target, odds }
//             { type: 'order', kind, at, odds, change }: at is the unit it
//             reaches, or the door's side for a weld; odds a dart's, or
//             null; change what a Mark or Suppress does to a shot's odds,
//             { shooter, target, was, now } (the unit's own at the enemy
//             marked; the enemy's best at the crew, suppressed), or null
//   played    [{ action, events, battle }]: the actions the last dispatch
//             played, in order, each with its events and the battle after
//   log       every event so far
//   notice    null, or { id, tone, text }: why a tap did nothing
//
// Actions:
//   fight/select { unit }    a crew member gives the orders
//   fight/tap { x, y }       a tile (whole numbers); see above
//   fight/aim { target? }    shows the shot at that enemy (a second time,
//                            takes it); with no target, the likeliest hit,
//                            then the next each time
//   fight/confirm            makes the move or takes the shot shown
//   fight/cancel             drops the move or shot shown
//   fight/overwatch, fight/reload, fight/stabilize, fight/open,
//   fight/grab, fight/hack, fight/free, fight/plant, fight/close,
//   fight/lock               the selected unit's
//                            other orders: stabilize the ally down beside
//                            it, open, close or lock the door beside it
//                            (M45; the first, north, east, south, west, as
//                            ordersFor has it), and a job's
//                            objective (objectives.js): grab or pick up a
//                            crate in its reach, work the terminal, free
//                            the captive, set a charge by a target
//   fight/order { at? }      the selected unit's job's order: shows it at
//                            `at` (a unit's id or a door's side), or at its
//                            likeliest; a second time at the same, takes it
//   fight/end                ends the crew's turn
//   fight/load { battle, events }   a new battle
import { aiAction } from './ai.js';
import { act, isMachine, targetsFor } from './battle.js';
import { shotOdds } from './odds.js';
import { dartOdds, ORDER_KINDS, orderOf, orderTargets } from './orders.js';
import { canSee } from './sight.js';
import { outOfReach, withinReach } from './weapons.js';
import { SIDES } from './grid.js';
import { closable, lockable, ownLocks } from './locks.js';
import { moveRange, reachable } from './moves.js';
import { pressAction } from './press.js';
import { inReach, shutDoor, walkable } from './terrain.js';

// More actions than any side's turn can take: a guard, should the enemy
// player ever stall.
const MAX_TURN_ACTIONS = 100;

export function createFight(battle, rules, events = []) {
  return focus({ battle, selected: null, preview: null, played: [], log: events, notice: null }, null, rules);
}

export function reduceFight(fight, action, rules) {
  if (action.type === 'fight/load') return createFight(action.battle, rules, action.events);
  if (fight.battle.winner || fight.battle.side !== 'crew') return fight;
  const unit = selectedUnit(fight);
  switch (action.type) {
    case 'fight/select':
      return select(fight, fight.battle.units.find((u) => u.id === action.unit), rules);
    case 'fight/tap':
      return tap(fight, action.x, action.y, rules);
    case 'fight/aim':
      return action.target === undefined ? nextTarget(fight, rules) : aim(fight, action.target, rules);
    case 'fight/confirm':
      if (fight.preview?.type === 'move') return play(fight, { type: 'move', unit: unit.id, to: fight.preview.to }, rules);
      if (fight.preview?.type === 'shoot') return play(fight, { type: 'shoot', unit: unit.id, target: fight.preview.target }, rules);
      if (fight.preview?.type === 'order') return orderAt(fight, unit, fight.preview.at, rules);
      return fight;
    case 'fight/order':
      return unit ? orderAt(fight, unit, action.at, rules) : fight;
    case 'fight/cancel':
      return fight.preview ? { ...fight, preview: null } : fight;
    case 'fight/overwatch':
    case 'fight/reload':
      return unit ? play(fight, { type: action.type.slice(6), unit: unit.id }, rules) : fight;
    case 'fight/stabilize': {
      const target = unit && downBeside(fight.battle, unit);
      return target ? play(fight, { type: 'stabilize', unit: unit.id, target: target.id }, rules) : fight;
    }
    case 'fight/open': {
      const side = unit && doorBeside(fight.battle, unit);
      return side ? play(fight, { type: 'open', unit: unit.id, side }, rules) : fight;
    }
    case 'fight/close': {
      const side = unit && closable(fight.battle, unit)[0];
      return side ? play(fight, { type: 'close', unit: unit.id, side }, rules) : fight;
    }
    case 'fight/lock': {
      const side = unit && lockable(fight.battle, unit)[0];
      return side ? play(fight, { type: 'lock', unit: unit.id, side }, rules) : fight;
    }
    case 'fight/grab': {
      const at = unit && crateInReach(fight.battle, unit);
      return at ? play(fight, { type: 'grab', unit: unit.id, at }, rules) : fight;
    }
    case 'fight/hack':
      return unit && terminalInReach(fight.battle, unit) ? play(fight, { type: 'hack', unit: unit.id }, rules) : fight;
    case 'fight/free':
      return unit && captiveInReach(fight.battle, unit) ? play(fight, { type: 'free', unit: unit.id }, rules) : fight;
    case 'fight/plant': {
      const at = unit && targetInReach(fight.battle, unit);
      return at ? play(fight, { type: 'plant', unit: unit.id, at }, rules) : fight;
    }
    case 'fight/end':
      return play(fight, { type: 'end' }, rules);
    default:
      return fight;
  }
}

// The selected crew member, or null.
export function selectedUnit(fight) {
  return fight.battle.units.find((u) => u.id === fight.selected) ?? null;
}

// True if a unit can take orders now: one of the crew, standing, with an
// action left, on the crew's turn.
export function canAct(battle, unit) {
  return !battle.winner && battle.side === 'crew' && unit.side === 'crew' && unit.status === 'active' && unit.ap > 0;
}

// What the selected unit can do now, for the screen's overlays and buttons:
//   reach      Map "x,y" -> { x, y, cost, path, dash }: every tile it can
//              move to (not its own); dash means both actions
//   targets    [{ target, odds }]: the enemies it can see, likeliest hit
//              first (then the fewest hit points)
//   reload, overwatch   whether it can
//   stabilize  the ally down beside it, or null
//   door       the side of a closed door beside it it can open (its own
//              side's lock among them, M45), or null
//   close      the side of an open door beside it it can close, or null
//   lock       the side of a door beside it it can lock, or null (M45)
//   grab       the [x, y] of a crate to grab in its reach, or null: on an
//              extract, one to pick up or a fallen carrier's to take
//   hack       whether it can work the terminal now: in its reach, and not
//              worked yet this round
//   free       whether it can free the captive in its reach (a rescue)
//   plant      the [x, y] of a target in its reach to set a charge by, or
//              null (a sabotage)
//   order      its job's order while it can use it on someone or something
//              now: { kind, name, uses, reaches }, or null
// Null when no one is selected. A ward (objectives.js) can only move; a
// machine (M39, a ship's turret) only shoots, watches and reloads.
export function ordersFor(fight, rules) {
  const unit = selectedUnit(fight);
  if (!unit || !canAct(fight.battle, unit)) return null;
  const { battle } = fight;
  const reach = reachOf(battle, unit, rules);
  const none = { stabilize: null, door: null, close: null, lock: null, grab: null, hack: false, free: false, plant: null, order: null };
  if (unit.ward) return { unit, reach, targets: [], reload: false, overwatch: false, ...none };
  const clip = rules.weapons.get(unit.weapon).clip;
  if (isMachine(unit, rules)) return { unit, reach: new Map(), targets: unit.ammo > 0 ? sortedTargets(battle, unit, rules) : [], reload: unit.ammo < clip, overwatch: unit.ammo > 0, ...none };
  return {
    unit,
    reach,
    targets: unit.ammo > 0 ? sortedTargets(battle, unit, rules) : [],
    reload: unit.ammo < clip,
    overwatch: unit.ammo > 0,
    stabilize: downBeside(battle, unit),
    door: doorBeside(battle, unit),
    close: closable(battle, unit)[0] ?? null,
    lock: lockable(battle, unit)[0] ?? null,
    grab: crateInReach(battle, unit),
    hack: terminalInReach(battle, unit) && battle.objective.worked !== battle.round,
    free: captiveInReach(battle, unit),
    plant: targetInReach(battle, unit),
    order: orderNow(battle, unit, rules),
  };
}

// The unit's order, when it can be given now: { kind, name, uses (left),
// reaches, def (the job's order, with its numbers) }.
function orderNow(battle, unit, rules) {
  const order = orderOf(unit, rules);
  if (!order || !orderTargets(battle, unit, rules).length) return null;
  return { kind: order.type, name: order.name, uses: unit.uses, reaches: ORDER_KINDS[order.type].reaches, def: order };
}

// The tiles a unit can move to this turn, with its actions as they are; a
// carrier's once a turn, no dash (moves.js moveRange).
export function reachOf(battle, unit, rules) {
  const spots = reachable(battle, unit, moveRange(unit), rules);
  spots.delete(`${unit.x},${unit.y}`);
  for (const spot of spots.values()) spot.dash = spot.cost > unit.mobility;
  return spots;
}

function sortedTargets(battle, unit, rules) {
  return targetsFor(battle, unit, rules).sort((a, b) => b.odds.hit - a.odds.hit || a.target.hp - b.target.hp);
}

function select(fight, unit, rules) {
  if (!unit || unit.side !== 'crew') return fight;
  if (unit.id === fight.selected) return fight.preview ? { ...fight, preview: null } : fight;
  if (canAct(fight.battle, unit)) return { ...fight, selected: unit.id, preview: null };
  const status = unit.status === 'dead' && isMachine(unit, rules) ? 'wrecked' : unit.status;
  const why = status === 'active' ? 'has no actions left this turn' : status === 'down' ? 'is down: stand beside them and tap Stabilize' : status === 'held' ? 'is held: stand beside them and tap Free' : `is ${status}`;
  return withNotice(fight, 'info', `${unit.name} ${why}.`);
}

function tap(fight, x, y, rules) {
  const { battle } = fight;
  const there = battle.units.find((u) => u.status !== 'dead' && u.x === x && u.y === y);
  if (there?.side === 'crew') return select(fight, there, rules);
  if (there && fight.preview?.type === 'order' && ORDER_KINDS[fight.preview.kind]?.reaches === 'enemy') return orderAt(fight, selectedUnit(fight), there.id, rules);
  if (there) return aim(fight, there.id, rules);
  const unit = selectedUnit(fight);
  if (!unit) return fight;
  const spot = reachOf(battle, unit, rules).get(`${x},${y}`);
  if (!spot) {
    const cleared = fight.preview ? { ...fight, preview: null } : fight;
    return walkable(battle, x, y, rules) ? withNotice(cleared, 'info', `${unit.name} can't get there this turn.`) : cleared;
  }
  if (fight.preview?.type === 'move' && fight.preview.to[0] === x && fight.preview.to[1] === y) {
    return play(fight, { type: 'move', unit: unit.id, to: [x, y] }, rules);
  }
  return { ...fight, preview: { type: 'move', to: [x, y], cost: spot.cost, dash: spot.dash, path: spot.path } };
}

// Shows the shot at an enemy, or takes it if it is already shown.
function aim(fight, id, rules) {
  const unit = selectedUnit(fight);
  const target = fight.battle.units.find((u) => u.id === id);
  if (!unit || !target || target.side === unit.side || target.status !== 'active') return fight;
  if (fight.preview?.type === 'shoot' && fight.preview.target === id) {
    return play(fight, { type: 'shoot', unit: unit.id, target: id }, rules);
  }
  if (unit.ward) return withNotice(fight, 'info', `${unit.name} has no gun.`);
  if (unit.ammo < 1) return withNotice(fight, 'bad', `${unit.name} has to reload first.`);
  const shot = targetsFor(fight.battle, unit, rules).find((t) => t.target.id === id);
  const weapon = rules.weapons.get(unit.weapon);
  const seen = canSee(fight.battle, [unit.x, unit.y], [target.x, target.y], rules);
  if (!shot && seen && !withinReach(weapon, [unit.x, unit.y], [target.x, target.y])) return withNotice({ ...fight, preview: null }, 'info', `${outOfReach(unit, { ...target, name: `${target.name} ${target.id}` }, weapon)} Move ${unit.name} closer.`);
  if (!shot) return withNotice({ ...fight, preview: null }, 'info', `${unit.name} can't see ${target.name} ${target.id} from here.`);
  return { ...fight, preview: { type: 'shoot', target: id, odds: shot.odds } };
}

// Shows the shot at the next enemy in sight: the likeliest hit first.
function nextTarget(fight, rules) {
  const unit = selectedUnit(fight);
  if (!unit) return fight;
  if (unit.ward) return withNotice(fight, 'info', `${unit.name} has no gun.`);
  if (unit.ammo < 1) return withNotice(fight, 'bad', `${unit.name} has to reload first.`);
  const targets = sortedTargets(fight.battle, unit, rules);
  if (!targets.length) {
    const weapon = rules.weapons.get(unit.weapon);
    const sighted = weapon.reach && fight.battle.units.some((u) => u.side !== unit.side && u.status === 'active' && canSee(fight.battle, [unit.x, unit.y], [u.x, u.y], rules));
    const tiles = `${weapon.reach} tile${weapon.reach === 1 ? '' : 's'}`;
    return withNotice(fight, 'info', sighted ? `No one in sight is within ${tiles}, the ${weapon.name.toLowerCase()}'s reach.` : `${unit.name} can't see anyone to shoot.`);
  }
  const shown = fight.preview?.type === 'shoot' ? targets.findIndex((t) => t.target.id === fight.preview.target) : -1;
  const { target, odds } = targets[(shown + 1) % targets.length];
  if (target.id === fight.preview?.target) return fight;
  return { ...fight, preview: { type: 'shoot', target: target.id, odds } };
}

// Shows the unit's order at `at` (a unit's id, or a door's side for a
// weld), or at its likeliest with none given; takes it if that is shown
// already.
function orderAt(fight, unit, given, rules) {
  const order = unit && orderOf(unit, rules);
  if (!order) return fight;
  const { battle } = fight;
  const shown = fight.preview?.type === 'order' ? fight.preview.at : undefined;
  const at = given ?? shown ?? likeliest(battle, unit, order, rules);
  const reaches = ORDER_KINDS[order.type].reaches;
  if (shown !== undefined && at === shown) return play(fight, reaches === 'door' ? { type: 'order', unit: unit.id, side: at } : { type: 'order', unit: unit.id, target: at }, rules);
  if (at === null || !orderTargets(battle, unit, rules).includes(at)) return withNotice({ ...fight, preview: null }, 'info', noOrder(battle, unit, order, at));
  const target = battle.units.find((u) => u.id === at);
  const odds = order.type === 'sedate' ? dartOdds(battle, unit, target, rules) : null;
  return { ...fight, preview: { type: 'order', kind: order.type, at, odds, change: oddsChange(battle, unit, order, target, rules) } };
}

// What a Mark or a Suppress does to a shot's odds, for its preview: the
// unit's own shot at the enemy marked, or the suppressed enemy's best shot
// at one of the crew it can see. { shooter, target, was, now } (ids and
// percent), or null.
function oddsChange(battle, unit, order, target, rules) {
  if (order.type === 'mark') {
    const marked = { ...target, mark: { aim: order.aim, turns: 1 } };
    return { shooter: unit.id, target: target.id, was: shotOdds(battle, unit, target, rules).hit, now: shotOdds(battle, unit, marked, rules).hit };
  }
  if (order.type !== 'suppress') return null;
  const suppressed = { ...target, suppressed: { aim: order.aim } };
  const crew = battle.units.filter((u) => u.side === unit.side && u.status === 'active' && canSee(battle, [target.x, target.y], [u.x, u.y], rules));
  const best = crew.map((u) => ({ u, hit: shotOdds(battle, target, u, rules).hit })).sort((a, b) => b.hit - a.hit)[0];
  return best ? { shooter: target.id, target: best.u.id, was: best.hit, now: shotOdds(battle, suppressed, best.u, rules).hit } : null;
}

// Whom or what an order would likeliest reach: the enemy likeliest hit
// (then the fewest hit points), the ally down (then the most hurt), itself
// before an ally for a kit-out, or the first door beside. Null for none.
function likeliest(battle, unit, order, rules) {
  const reach = orderTargets(battle, unit, rules);
  if (!reach.length) return null;
  const units = reach.map((id) => battle.units.find((u) => u.id === id)).filter(Boolean);
  switch (ORDER_KINDS[order.type].reaches) {
    case 'enemy': {
      const odds = (u) => targetsFor(battle, { ...unit, ammo: 1 }, rules).find((t) => t.target.id === u.id)?.odds.hit ?? 0;
      return [...units].sort((a, b) => odds(b) - odds(a) || a.hp - b.hp)[0].id;
    }
    case 'ally':
      return [...units].sort((a, b) => Number(b.status !== 'active') - Number(a.status !== 'active') || a.hp / a.maxHp - b.hp / b.maxHp)[0].id;
    default:
      return reach[0];
  }
}

// Why the order can't be used, in words.
function noOrder(battle, unit, order, at) {
  if (unit.uses < 1) return `${unit.name} has no ${order.name} left this fight.`;
  if ((order.type === 'suppress' || order.type === 'sedate') && unit.ammo < 1) return `${unit.name} has to reload first.`;
  const target = battle.units.find((u) => u.id === at);
  switch (ORDER_KINDS[order.type].reaches) {
    case 'enemy':
      return target ? `${unit.name} can't ${order.name.toLowerCase()} ${target.name} ${target.id} from here.` : `${unit.name} can't see anyone to ${order.name.toLowerCase()}.`;
    case 'ally':
      return `No one beside ${unit.name} needs patching.`;
    case 'kit':
      return `Everyone beside ${unit.name} is kitted out.`;
    case 'door':
      return `There's no door beside ${unit.name} to weld.`;
    default:
      return `${unit.name} can't ${order.name.toLowerCase()} now.`;
  }
}

// Carries out a crew action, then, if that ended the crew's turn, the
// enemy's whole turn.
function play(fight, action, rules) {
  const first = act(fight.battle, action, rules);
  if (!first.ok) return withNotice({ ...fight, preview: null }, 'bad', first.error);
  const played = [{ action, events: first.events, battle: first.battle }];
  let { battle } = first;
  // The enemy plays as the AI, or presses on where the battle says so (a
  // raid's raiders, press.js).
  const enemy = battle.options.press ? pressAction : aiAction;
  while (battle.side === 'enemy' && !battle.winner) {
    let next = played.length > MAX_TURN_ACTIONS ? { type: 'end' } : enemy(battle, rules);
    let result = act(battle, next, rules);
    if (!result.ok) {
      next = { type: 'end' };
      result = act(battle, next, rules);
    }
    played.push({ action: next, events: result.events, battle: result.battle });
    battle = result.battle;
  }
  const log = [...fight.log, ...played.flatMap((step) => step.events)];
  return focus({ ...fight, battle, preview: null, played, log, notice: null }, fight.selected, rules);
}

// Selects who gives orders next: the one who just did, while they can, or
// else the next of the crew in line who can.
function focus(fight, after, rules) {
  const crew = fight.battle.units.filter((u) => u.side === 'crew');
  const from = Math.max(0, crew.findIndex((u) => u.id === after));
  const order = [...crew.slice(from), ...crew.slice(0, from)];
  const next = order.find((u) => canAct(fight.battle, u))?.id ?? null;
  return next === fight.selected ? fight : { ...fight, selected: next };
}

function downBeside(battle, unit) {
  return battle.units.find((u) => u.side === unit.side && u.status === 'down' && Math.max(Math.abs(u.x - unit.x), Math.abs(u.y - unit.y)) <= 1) ?? null;
}

// The first crate of the objective's still to grab that the unit can reach;
// on an extract, with its hands free, the first to pick up, or a fallen
// carrier's to take.
function crateInReach(battle, unit) {
  const { objective } = battle;
  const near = (at) => inReach(battle, [unit.x, unit.y], at);
  const left = (list) => list.filter(([x, y]) => !objective.taken.some(([tx, ty]) => tx === x && ty === y));
  if (objective?.type === 'grab') return left(objective.crates).find(near) ?? null;
  if (objective?.type !== 'extract' || unit.carrying) return null;
  const fallen = battle.units.find((u) => u.carrying && u.status !== 'active' && near([u.x, u.y]));
  return left(objective.crates).find(near) ?? (fallen ? [fallen.x, fallen.y] : null);
}

// True if the unit can free the held captive (a rescue).
function captiveInReach(battle, unit) {
  const { objective } = battle;
  const ward = objective?.type === 'rescue' ? battle.units.find((u) => u.id === objective.ward) : null;
  return ward?.status === 'held' && inReach(battle, [unit.x, unit.y], [ward.x, ward.y]);
}

// The first target in the unit's reach with no charge set and not blown (a
// sabotage), or null.
function targetInReach(battle, unit) {
  const { objective } = battle;
  if (objective?.type !== 'sabotage' || objective.left < 1) return null;
  const same = (a) => (b) => a[0] === b[0] && a[1] === b[1];
  return objective.targets.find((at) => !objective.blown.some(same(at)) && !objective.charges.some((charge) => same(at)(charge.at)) && inReach(battle, [unit.x, unit.y], at)) ?? null;
}

function terminalInReach(battle, unit) {
  return battle.objective?.type === 'hack' && inReach(battle, [unit.x, unit.y], battle.objective.at);
}

function doorBeside(battle, unit) {
  return SIDES.find((side) => shutDoor(battle, unit.x, unit.y, side)) ?? ownLocks(battle, unit)[0] ?? null;
}

function withNotice(fight, tone, text) {
  return { ...fight, notice: { id: (fight.notice?.id ?? 0) + 1, tone, text } };
}
