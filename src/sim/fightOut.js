// Fights played on to their end, a player for each side (autoplay.js
// playFrom), with a way out of the ones that drag (M32's test players,
// tools/boarding.js; from M38f the sim's own, for a raid fought out
// without the player, raids.js fightAway). Past DRAGGING rounds both sides
// press on, so two sides on overwatch either side of a door can't hold a
// fight up; and a shot with less than HOPELESS percent to hit, or
// overwatch, gives way to a step nearer, or with none (the fallen lying in
// the only way through), to a tile with an enemy in sight, so two sides
// can't trade misses or watch for each other for ever. A fight still going
// after MAX_ROUNDS has stalled. Pure.
import { aiAction } from './ai.js';
import { playFrom } from './autoplay.js';
import { reachable, stepsFrom } from './moves.js';
import { shotOdds } from './odds.js';
import { advance, pressAction } from './press.js';
import { canSee } from './sight.js';

export const MAX_ROUNDS = 60;
const DRAGGING = 40;
const HOPELESS = 10;
const BOTH_PRESS = { crew: charge, enemy: charge };
// Who plays a raid on a colony (M29): those there the AI, the raiders
// pressing on.
export const RAID_PLAYERS = { crew: aiAction, enemy: pressAction };

// A battle played on by the players, and past DRAGGING rounds with both
// sides pressing on (charge), to its end or maxRounds: playFrom's { battle,
// actions, events }, and dragged (true when it went past DRAGGING). The
// test player's fights in act 1 (tools/run.js, M32) play on the same way.
export function playOn(battle, rules, players, { maxRounds = MAX_ROUNDS } = {}) {
  const played = playFrom(battle, rules, players, { maxRounds: Math.min(DRAGGING, maxRounds) });
  if (played.battle.winner || maxRounds <= DRAGGING) return { ...played, dragged: false };
  const rest = playFrom(played.battle, rules, BOTH_PRESS, { maxRounds });
  return { battle: rest.battle, actions: [...played.actions, ...rest.actions], events: [...played.events, ...rest.events], dragged: true };
}

// Pressing on, past DRAGGING rounds: as pressAction, but a hopeless shot
// or overwatch gives way to a step nearer, or with none and no enemy in
// sight, to the nearest tile with one in sight, where there is one; and
// from M37 a move that ends no nearer the enemy gives way to a step nearer
// (a torch's reach short of the enemy, the AI stepped out and back each
// turn, and so did the raiders it faced, for good).
function charge(battle, rules) {
  const action = pressAction(battle, rules);
  const unit = battle.units.find((u) => u.id === action.unit);
  if (action.type === 'move') return nearer(battle, unit, action.to, rules) ? action : (advance(battle, unit, rules) ?? action);
  if (action.type !== 'shoot' && action.type !== 'overwatch') return action;
  const target = action.type === 'shoot' ? battle.units.find((u) => u.id === action.target) : null;
  if (target && shotOdds(battle, unit, target, rules).hit >= HOPELESS) return action;
  return advance(battle, unit, rules) ?? (target ? null : intoSight(battle, unit, rules)) ?? action;
}

// Whether tile `to` is fewer steps from the nearest enemy than where the
// unit stands.
function nearer(battle, unit, [x, y], rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const away = stepsFrom(battle, foes.map((u) => [u.x, u.y]), rules);
  return (away.get(`${x},${y}`) ?? Infinity) < (away.get(`${unit.x},${unit.y}`) ?? Infinity);
}

// A move toward the cheapest tile with an enemy in sight, however far,
// as far along the way as one action takes it; or null. (Till M37 only a
// tile in one action's reach: two sides whose fallen shut the short way
// between them watched for each other for good.)
function intoSight(battle, unit, rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const sees = (x, y) => foes.some((foe) => canSee(battle, [x, y], [foe.x, foe.y], rules));
  if (sees(unit.x, unit.y)) return null;
  let best = null;
  for (const spot of reachable(battle, unit, Infinity, rules).values()) {
    if ((!best || spot.cost < best.cost) && sees(spot.x, spot.y)) best = spot;
  }
  if (!best) return null;
  const near = reachable(battle, unit, unit.mobility, rules);
  const to = [...best.path].reverse().find(([x, y]) => near.has(`${x},${y}`));
  return to && (to[0] !== unit.x || to[1] !== unit.y) ? { type: 'move', unit: unit.id, to } : null;
}

// A raid fought out without the player (M38f, raids.js fightAway): played
// on by RAID_PLAYERS to its end, or to MAX_ROUNDS: playOn's.
export function fightOut(battle, rules) {
  return playOn(battle, rules, RAID_PLAYERS);
}
