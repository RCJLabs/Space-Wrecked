// The scripted player: a plain player for either side of a battle. Tests
// and tools/battle-log.js play both sides with it (the golden battle), and
// tests play the crew with it against the enemy AI (ai.js). It is plain on
// purpose: it doesn't weigh cover, flanks or odds.
import { autoplay } from './autoplay.js';
import { targetsFor } from './battle.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { reachable, stepsFrom } from './moves.js';

// The scripted player's next action, for whichever side's turn it is. The
// first unit of that side with an action left: if it can see an enemy, it
// reloads if empty, or shoots the one it is likeliest to hit (then the one
// with the fewest hit points, then the first listed). If it can't, it steps
// as near an enemy as one action takes it, by walking distance. With
// nowhere nearer, it opens a closed door beside it, or else goes on
// overwatch (or reloads). With no one left to act, the turn ends.
export function scriptedAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit) return { type: 'end' };
  const targets = targetsFor(battle, unit, rules);
  if (targets.length) {
    if (unit.ammo < 1) return { type: 'reload', unit: unit.id };
    targets.sort((a, b) => b.odds.hit - a.odds.hit || a.target.hp - b.target.hp);
    return { type: 'shoot', unit: unit.id, target: targets[0].target.id };
  }
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const away = stepsFrom(battle, foes.map((u) => [u.x, u.y]), rules);
  let best = { d: away.get(`${unit.x},${unit.y}`) ?? Infinity, cost: 0, x: unit.x, y: unit.y };
  for (const spot of reachable(battle, unit, unit.mobility, rules).values()) {
    const d = away.get(`${spot.x},${spot.y}`) ?? Infinity;
    if (d < best.d || (d === best.d && spot.cost < best.cost)) best = { d, cost: spot.cost, x: spot.x, y: spot.y };
  }
  if (best.x !== unit.x || best.y !== unit.y) return { type: 'move', unit: unit.id, to: [best.x, best.y] };
  const door = SIDES.find((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !battle.doors.includes(edgeKey(unit.x, unit.y, side)));
  if (door) return { type: 'open', unit: unit.id, side: door };
  return unit.ammo < 1 ? { type: 'reload', unit: unit.id } : { type: 'overwatch', unit: unit.id };
}

// Plays a battle with the scripted player on both sides until it ends, or
// until maxRounds have passed. Returns { battle, actions, events }.
export function playScripted(setup, rules, options) {
  return autoplay(setup, rules, { crew: scriptedAction, enemy: scriptedAction }, options);
}
