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
//   part (odds.js). Only a second tap on that enemy, or Fire, takes it.
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
//   fight/grab, fight/hack   the selected unit's other orders: stabilize
//                            the ally down beside it, open the door beside
//                            it, grab a crate in its reach, work the
//                            terminal in its reach (a job's objective)
//   fight/end                ends the crew's turn
//   fight/load { battle, events }   a new battle
import { aiAction } from './ai.js';
import { act, targetsFor } from './battle.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { reachable } from './moves.js';
import { pressAction } from './press.js';
import { inReach, walkable } from './terrain.js';

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
      return select(fight, fight.battle.units.find((u) => u.id === action.unit));
    case 'fight/tap':
      return tap(fight, action.x, action.y, rules);
    case 'fight/aim':
      return action.target === undefined ? nextTarget(fight, rules) : aim(fight, action.target, rules);
    case 'fight/confirm':
      if (fight.preview?.type === 'move') return play(fight, { type: 'move', unit: unit.id, to: fight.preview.to }, rules);
      if (fight.preview?.type === 'shoot') return play(fight, { type: 'shoot', unit: unit.id, target: fight.preview.target }, rules);
      return fight;
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
    case 'fight/grab': {
      const at = unit && crateInReach(fight.battle, unit);
      return at ? play(fight, { type: 'grab', unit: unit.id, at }, rules) : fight;
    }
    case 'fight/hack':
      return unit && terminalInReach(fight.battle, unit) ? play(fight, { type: 'hack', unit: unit.id }, rules) : fight;
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
//   door       the side of a closed door beside it, or null
//   grab       the [x, y] of a crate to grab in its reach, or null
//   hack       whether it can work the terminal now: in its reach, and not
//              worked yet this round
// Null when no one is selected.
export function ordersFor(fight, rules) {
  const unit = selectedUnit(fight);
  if (!unit || !canAct(fight.battle, unit)) return null;
  const { battle } = fight;
  const clip = rules.weapons.get(unit.weapon).clip;
  return {
    unit,
    reach: reachOf(battle, unit, rules),
    targets: unit.ammo > 0 ? sortedTargets(battle, unit, rules) : [],
    reload: unit.ammo < clip,
    overwatch: unit.ammo > 0,
    stabilize: downBeside(battle, unit),
    door: doorBeside(battle, unit),
    grab: crateInReach(battle, unit),
    hack: terminalInReach(battle, unit) && battle.objective.worked !== battle.round,
  };
}

// The tiles a unit can move to this turn, with its actions as they are.
export function reachOf(battle, unit, rules) {
  const spots = reachable(battle, unit, unit.mobility * Math.min(unit.ap, 2), rules);
  spots.delete(`${unit.x},${unit.y}`);
  for (const spot of spots.values()) spot.dash = spot.cost > unit.mobility;
  return spots;
}

function sortedTargets(battle, unit, rules) {
  return targetsFor(battle, unit, rules).sort((a, b) => b.odds.hit - a.odds.hit || a.target.hp - b.target.hp);
}

function select(fight, unit) {
  if (!unit || unit.side !== 'crew') return fight;
  if (unit.id === fight.selected) return fight.preview ? { ...fight, preview: null } : fight;
  if (canAct(fight.battle, unit)) return { ...fight, selected: unit.id, preview: null };
  const why = unit.status === 'active' ? 'has no actions left this turn' : unit.status === 'down' ? 'is down: stand beside them and tap Stabilize' : `is ${unit.status}`;
  return withNotice(fight, 'info', `${unit.name} ${why}.`);
}

function tap(fight, x, y, rules) {
  const { battle } = fight;
  const there = battle.units.find((u) => u.status !== 'dead' && u.x === x && u.y === y);
  if (there?.side === 'crew') return select(fight, there);
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
  if (unit.ammo < 1) return withNotice(fight, 'bad', `${unit.name} has to reload first.`);
  const shot = targetsFor(fight.battle, unit, rules).find((t) => t.target.id === id);
  if (!shot) return withNotice({ ...fight, preview: null }, 'info', `${unit.name} can't see ${target.name} ${target.id} from here.`);
  return { ...fight, preview: { type: 'shoot', target: id, odds: shot.odds } };
}

// Shows the shot at the next enemy in sight: the likeliest hit first.
function nextTarget(fight, rules) {
  const unit = selectedUnit(fight);
  if (!unit) return fight;
  if (unit.ammo < 1) return withNotice(fight, 'bad', `${unit.name} has to reload first.`);
  const targets = sortedTargets(fight.battle, unit, rules);
  if (!targets.length) return withNotice(fight, 'info', `${unit.name} can't see anyone to shoot.`);
  const shown = fight.preview?.type === 'shoot' ? targets.findIndex((t) => t.target.id === fight.preview.target) : -1;
  const { target, odds } = targets[(shown + 1) % targets.length];
  if (target.id === fight.preview?.target) return fight;
  return { ...fight, preview: { type: 'shoot', target: target.id, odds } };
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

// The first crate of the objective's still to grab that the unit can reach.
function crateInReach(battle, unit) {
  const { objective } = battle;
  if (objective?.type !== 'grab') return null;
  const left = objective.crates.filter(([x, y]) => !objective.taken.some(([tx, ty]) => tx === x && ty === y));
  return left.find((at) => inReach(battle, [unit.x, unit.y], at)) ?? null;
}

function terminalInReach(battle, unit) {
  return battle.objective?.type === 'hack' && inReach(battle, [unit.x, unit.y], battle.objective.at);
}

function doorBeside(battle, unit) {
  return SIDES.find((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !battle.doors.includes(edgeKey(unit.x, unit.y, side))) ?? null;
}

function withNotice(fight, tone, text) {
  return { ...fight, notice: { id: (fight.notice?.id ?? 0) + 1, tone, text } };
}
