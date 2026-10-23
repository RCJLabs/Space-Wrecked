// Where a part goes best on a ship: the test players' fitter (M16, moved
// here from tools/run.js in M44) and the builder's Suggest. Pure.
//
//   fitPart(ship, defs, type) -> { ship, at: { x, y, rot } } or null
//     the ship with a part of `type` fitted where the builder's rules allow
//     it and the layout stays whole (every part joined to the bridge, every
//     exhaust and barrel facing space), touching as much of the ship as it
//     can; ties go to the first row, then column, then turn. A spot is
//     weighed before it is tried: one touching nothing can't join the
//     bridge, and one touching no more than the best so far can't win, so
//     neither is built (M23h: the voyage's refits fit parts at every
//     station).
//   suggestSpot(ship, defs, type) -> { x, y, rot } or null
//     the builder's Suggest (M44): the same search, but a ship still being
//     built has problems of its own (no airlock yet, say), so a spot only
//     has to add none: the part joined to the bridge, facing space where it
//     must, and no problem the ship didn't have before.
import { applyCommand, layoutProblems, occupancy } from './builder.js';
import { cellAt, SIDES, step } from './grid.js';
import { placedCells } from './modules.js';

export function fitPart(ship, defs, type) {
  const best = search(ship, defs, type, (placed) => layoutProblems(placed.ship, defs).length === 0);
  return best && { ship: best.ship, at: best.at };
}

export function suggestSpot(ship, defs, type) {
  const before = new Set(layoutProblems(ship, defs).map((problem) => problem.message));
  const best = search(ship, defs, type, (placed) => layoutProblems(placed.ship, defs).every((problem) => before.has(problem.message) && !problem.uids.includes(placed.uid)));
  return best?.at ?? null;
}

function search(ship, defs, type, whole) {
  const def = defs.modules.get(type);
  const frame = defs.frames.get(ship.frame);
  if (!def || !frame) return null;
  const taken = occupancy(ship, defs);
  const touching = (at) => placedCells(def, at).reduce((sum, [x, y]) => sum + SIDES.filter((side) => (cellAt(taken, ...step(x, y, side)) ?? null) !== null).length, 0);
  let best = null;
  for (const rot of def.rotates ? [0, 1, 2, 3] : [0]) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const score = touching({ x, y, rot });
        if (score === 0 || (best && score <= best.score)) continue;
        const placed = applyCommand(ship, defs, { op: 'place', type, x, y, rot });
        if (!placed.ok || !whole(placed)) continue;
        best = { ship: placed.ship, at: { x, y, rot }, score };
      }
    }
  }
  return best;
}
