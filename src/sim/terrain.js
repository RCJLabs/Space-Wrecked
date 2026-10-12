// What a battle map lets units do, tile by tile and edge by edge, with the
// battle's doors as they are now. mapFromShip.js makes the map, and
// data/tiles.json says what each kind of tile does: whether units stand on
// it, the cover it gives a unit beside it, and whether it blocks sight. On
// the edges, a wall, the hull or a hatch always stands in the way; a door
// does while it is closed, and a unit walking through opens it.
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

// The hazard on the tile at (x, y): null, 'fire', 'vacuum' or 'rubble'.
export function hazardAt(battle, x, y) {
  return cellAt(battle.map.hazards, x, y) ?? null;
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
