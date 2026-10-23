// Where a unit can walk on a battle map: four-way steps between tiles units
// stand on (data/tiles.json). A wall, the hull or a hatch is in the way; a
// door isn't, open or closed, since walking through one opens it, unless it
// is welded shut (orders.js) or locked (locks.js, M45). A step
// costs 1, or balance.rubbleMoveCost onto rubble. A unit can pass through
// its own side's units but not the other side's, and can't stop on anyone
// still in the fight or lying hurt. Paths of equal cost always tie the same
// way: the first found, trying north, east, south, west.
import { SIDES, step } from './grid.js';
import { wallAt } from './mapFromShip.js';
import { hazardAt, lockAt, walkable, weldedAt } from './terrain.js';

// How far a unit can walk on the actions it has left: its mobility on one,
// twice that on both (a dash). A carrier on an extract (objectives.js, M38)
// walks once a turn and never dashes: its mobility, or nothing once it has
// moved this turn.
export function moveRange(unit) {
  if (unit.carrying) return unit.hauled ? 0 : unit.mobility;
  return unit.mobility * Math.min(unit.ap, 2);
}

// Every tile `unit` can get to for at most `budget`, as a Map from "x,y" to
// { x, y, cost, path }, where path runs [x, y] by [x, y] from the unit's
// tile (included, at cost 0) to that one.
export function reachable(battle, unit, budget, rules) {
  const occupied = new Map();
  for (const other of battle.units) {
    if (other.id !== unit.id && other.status !== 'dead') occupied.set(`${other.x},${other.y}`, other.side);
  }
  const start = { x: unit.x, y: unit.y, cost: 0, path: [[unit.x, unit.y]] };
  const best = new Map([[`${unit.x},${unit.y}`, start]]);
  // Steps cost a few whole points, so the frontier is a bucket per cost.
  const buckets = [[start]];
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const here of buckets[cost] ?? []) {
      if (best.get(`${here.x},${here.y}`) !== here) continue; // a cheaper way was found since
      for (const side of SIDES) {
        if (blocked(battle, here.x, here.y, side)) continue;
        const [x, y] = step(here.x, here.y, side);
        const key = `${x},${y}`;
        const who = occupied.get(key);
        if (!walkable(battle, x, y, rules) || (who !== undefined && who !== unit.side)) continue;
        const next = cost + (hazardAt(battle, x, y) === 'rubble' ? rules.balance.rubbleMoveCost : 1);
        if (next > budget || (best.has(key) && best.get(key).cost <= next)) continue;
        const spot = { x, y, cost: next, path: [...here.path, [x, y]] };
        best.set(key, spot);
        (buckets[next] ??= []).push(spot);
      }
    }
  }
  for (const key of occupied.keys()) best.delete(key);
  return best;
}

// What a unit can walk through: anything but these (doors open), and a
// door welded shut or locked. Through locks, a lock is no bar: a way that
// leads to one, to be forced (locks.js).
const BLOCKS = new Set(['wall', 'hull', 'hatch']);

function blocked(battle, x, y, side, throughLocks = false) {
  const edge = wallAt(battle.map, x, y, side);
  return BLOCKS.has(edge) || (edge === 'door' && (weldedAt(battle, x, y, side) || (!throughLocks && Boolean(lockAt(battle, x, y, side)))));
}

// Steps from the nearest of `from` ([x, y] tiles) to every tile units can
// get to, walking through doors and past anyone: a Map from "x,y" to steps.
// A locked door counts as a way through (M45): those heading somewhere
// walk up to it and force it.
export function stepsFrom(battle, from, rules) {
  const away = new Map(from.map(([x, y]) => [`${x},${y}`, 0]));
  const queue = from.map(([x, y]) => [x, y]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const side of SIDES) {
      if (blocked(battle, x, y, side, true)) continue;
      const [nx, ny] = step(x, y, side);
      if (!walkable(battle, nx, ny, rules) || away.has(`${nx},${ny}`)) continue;
      away.set(`${nx},${ny}`, away.get(`${x},${y}`) + 1);
      queue.push([nx, ny]);
    }
  }
  return away;
}

// The side of `from` that `to`, one step away, is across.
export function sideToward([fx, fy], [tx, ty]) {
  if (ty < fy) return 'n';
  if (tx > fx) return 'e';
  if (ty > fy) return 's';
  return 'w';
}
