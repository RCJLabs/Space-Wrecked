// Line of sight on a battle map: a straight line from the middle of one tile
// to the middle of another. A wall, the hull, a hatch or a closed door on an
// edge it crosses blocks it, and so does a tile it passes over that blocks
// sight (full cover, machinery, the hull; data/tiles.json). Where the line
// runs exactly through a corner, it gets by if either way round the corner
// is clear. Units don't block it. The arithmetic is in whole numbers, so it
// is exact, and the line is the same seen from either end.
import { edgeAt, tileRule } from './terrain.js';

// True if a unit at `from` can see `to` ([x, y] tiles): within the sight
// range (balance.sightRange in tiles, or the battle's own where a job's
// twist cuts it) and with a clear line.
export function canSee(battle, from, to, rules) {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const range = sightRange(battle, rules);
  return dx * dx + dy * dy <= range * range && lineOfSight(battle, from, to, rules);
}

export function sightRange(battle, rules) {
  return battle.options?.sight ?? rules.balance.sightRange;
}

export function lineOfSight(battle, [ax, ay], [bx, by], rules) {
  const [nx, ny] = [Math.abs(bx - ax), Math.abs(by - ay)];
  const [sx, sy] = [Math.sign(bx - ax), Math.sign(by - ay)];
  const [xSide, ySide] = [sx > 0 ? 'e' : 'w', sy > 0 ? 's' : 'n'];
  const crossX = (x, y) => edgeAt(battle, x, y, xSide) === null;
  const crossY = (x, y) => edgeAt(battle, x, y, ySide) === null;
  const clear = (x, y) => (x === bx && y === by) || !tileRule(battle, x, y, rules).blocksSight;
  let [x, y, i, j] = [ax, ay, 1, 1];
  while (i <= nx || j <= ny) {
    // Where the line meets the next grid line across x and across y, both
    // scaled by 2 · nx · ny so they stay whole.
    const atX = i <= nx ? (2 * i - 1) * ny : Infinity;
    const atY = j <= ny ? (2 * j - 1) * nx : Infinity;
    if (atX < atY) {
      if (!crossX(x, y)) return false;
      x += sx;
      i++;
    } else if (atY < atX) {
      if (!crossY(x, y)) return false;
      y += sy;
      j++;
    } else {
      // Exactly through a corner: round it one way or the other.
      const viaX = crossX(x, y) && clear(x + sx, y) && crossY(x + sx, y);
      const viaY = crossY(x, y) && clear(x, y + sy) && crossX(x, y + sy);
      if (!viaX && !viaY) return false;
      x += sx;
      y += sy;
      i++;
      j++;
    }
    if (!clear(x, y)) return false;
  }
  return true;
}
