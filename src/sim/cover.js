// Cover on a battle map. Each side of a unit's tile gives cover from what is
// there: a wall, the hull, a hatch or a closed door is full cover, and
// otherwise the tile beyond gives its own (data/tiles.json: half for a crate
// or a console, full for a locker or machinery). Cover on a side counts
// against an attacker on that side of the unit, so the north side's counts
// against anyone north of it. The best that counts is the unit's cover
// against that attacker; with none, the unit is flanked (ROADMAP §4.3).
import { SIDES, step } from './grid.js';
import { edgeAt, tileRule } from './terrain.js';

const LEVEL = { half: 1, full: 2 };

// { cover: null | 'half' | 'full', flanked } for a unit at `at` against an
// attacker at `from`, both [x, y].
export function coverFrom(battle, at, from, rules) {
  let cover = null;
  for (const side of SIDES) {
    if (!facing(side, at, from)) continue;
    const here = coverOnSide(battle, at, side, rules);
    if (here && (!cover || LEVEL[here] > LEVEL[cover])) cover = here;
  }
  return { cover, flanked: cover === null };
}

// The cover on one side of a tile, whoever it is against: null, 'half' or
// 'full'.
export function coverOnSide(battle, [x, y], side, rules) {
  if (edgeAt(battle, x, y, side) !== null) return 'full';
  return tileRule(battle, ...step(x, y, side), rules).cover ?? null;
}

// True if `from` is on the given side of `at`.
function facing(side, [x, y], [fx, fy]) {
  if (side === 'n') return fy < y;
  if (side === 's') return fy > y;
  if (side === 'e') return fx > x;
  return fx < x;
}
