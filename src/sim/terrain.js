// What a battle map lets units do, tile by tile and edge by edge, with the
// battle's doors as they are now. mapFromShip.js makes the map, and
// data/tiles.json says what each kind of tile does: whether units stand on
// it, the cover it gives a unit beside it, and whether it blocks sight. On
// the edges, a wall, the hull or a hatch always stands in the way; a door
// does while it is closed, and a unit walking through opens it, unless it
// is welded shut (orders.js, M32) or locked (locks.js, M45).
import { cellAt } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';

const NO_RULE = {};

// The rules for the tile at (x, y): { walk, cover, blocksSight }. Off the
// map is space.
export function tileRule(battle, x, y, rules) {
  return rules.tileRules[cellAt(battle.map.tiles, x, y) ?? 'space'] ?? NO_RULE;
}

export function walkable(battle, x, y, rules) {
  return tileRule(battle, x, y, rules).walk === true;
}

// What stands on the given side of (x, y) now: null for nothing (or an open
// door), else 'wall', 'hull', 'hatch' or 'door' (closed).
export function edgeAt(battle, x, y, side) {
  const edge = wallAt(battle.map, x, y, side);
  return edge === 'door' && battle.doors.includes(edgeKey(x, y, side)) ? null : edge;
}

// True if the door on `side` of (x, y) is welded shut now.
export function weldedAt(battle, x, y, side) {
  const key = edgeKey(x, y, side);
  return (battle.welds ?? []).some((w) => w.key === key);
}

// The lock on the door on `side` of (x, y), { key, side } (the side that
// locked it), or null (locks.js, M45).
export function lockAt(battle, x, y, side) {
  const key = edgeKey(x, y, side);
  return (battle.locks ?? []).find((lock) => lock.key === key) ?? null;
}

// True if the door on `side` of (x, y) was forced: it stays open for the
// rest of the fight (locks.js, M45).
export function brokenAt(battle, x, y, side) {
  return (battle.broken ?? []).includes(edgeKey(x, y, side));
}

// True if there is a closed door on `side` of (x, y) that a unit there can
// open: not open already, not welded shut and not locked.
export function shutDoor(battle, x, y, side) {
  return wallAt(battle.map, x, y, side) === 'door' && !battle.doors.includes(edgeKey(x, y, side)) && !weldedAt(battle, x, y, side) && !lockAt(battle, x, y, side);
}

// The hazard on the tile at (x, y): null, 'fire', 'vacuum' or 'rubble'. A
// tile a weapon set burning (battle.js fires, M37) is on fire too.
export function hazardAt(battle, x, y) {
  return cellAt(battle.map.hazards, x, y) ?? (burningAt(battle, x, y) ? 'fire' : null);
}

// True if a weapon's fire burns on the tile at (x, y) now (battle.js fires,
// M37): one that goes out, unlike a wrecked room's.
export function burningAt(battle, x, y) {
  return Boolean(battle.fires?.some(({ at }) => at[0] === x && at[1] === y));
}

// True if a unit at `from` can reach the tile at `to` with its hands, as it
// grabs a crate or works a terminal: next to it by a side or a corner, with
// nothing standing on the edges between now.
export function inReach(battle, from, to) {
  return besideClear(from, to, (x, y, side) => edgeAt(battle, x, y, side) === null);
}

// True if `to` is next to `from` by a side or a corner and open(x, y, side)
// holds for the edges between: the one between them, or, round a corner,
// both edges of either way round.
export function besideClear([ax, ay], [bx, by], open) {
  const [dx, dy] = [bx - ax, by - ay];
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
  const [xSide, ySide] = [dx > 0 ? 'e' : 'w', dy > 0 ? 's' : 'n'];
  if (dy === 0) return open(ax, ay, xSide);
  if (dx === 0) return open(ax, ay, ySide);
  return (open(ax, ay, xSide) && open(bx, ay, ySide)) || (open(ax, ay, ySide) && open(ax, by, xSide));
}
