// Moving a ship onto another hull frame (M39, bought at a shipyard:
// yards.js). Its parts and styling pieces keep their places on the new
// frame's grid, all of them shifted together, just far enough to fit
// inside it, when they don't fit where they are. Uids, wrecks and the look
// stay as they were. It is refused, saying why, when the parts outnumber
// the new frame's cap, the styling pieces outnumber its own, or the ship
// is bigger than its grid. Pure.
import { inFrame } from './frame.js';
import { placedCells } from './modules.js';
import { pieceCells } from './styling.js';

// The ship on frame frameId: { ok: true, ship, shift: [dx, dy] (how far
// everything moved) } or { ok: false, error }.
export function onFrame(ship, rules, frameId) {
  const frame = rules.frames.get(frameId);
  if (!frame) return { ok: false, error: 'That frame is unknown.' };
  const styling = ship.styling ?? [];
  if (ship.modules.length > frame.maxModules) return { ok: false, error: `The ${frame.name} holds at most ${frame.maxModules} parts, and the ship has ${ship.modules.length}.` };
  if (styling.length > frame.maxStyling) return { ok: false, error: `The ${frame.name} takes at most ${frame.maxStyling} styling pieces, and the ship has ${styling.length}.` };
  const cells = cellsOf(ship, rules);
  if (!cells.length) return { ok: true, ship: { ...ship, frame: frame.id }, shift: [0, 0] };
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [w, h] = [right - left + 1, bottom - top + 1];
  if (w > frame.width || h > frame.height) return { ok: false, error: `The ship is ${w} × ${h} cells, and the ${frame.name}'s yard ${frame.width} × ${frame.height}.` };
  const [dx, dy] = [into(left, right, frame.width), into(top, bottom, frame.height)];
  // A frame with a shape (frame.js) could still leave a cell off it.
  if (!cells.every(([x, y]) => inFrame(frame, x + dx, y + dy))) return { ok: false, error: `The ship doesn't fit the ${frame.name}'s shape.` };
  const moved = (item) => ({ ...item, x: item.x + dx, y: item.y + dy });
  return { ok: true, ship: { ...ship, frame: frame.id, modules: ship.modules.map(moved), styling: styling.map(moved) }, shift: [dx, dy] };
}

// Every cell the ship's parts and styling pieces cover, as [x, y]; those
// the content doesn't know are left out.
function cellsOf(ship, rules) {
  const parts = ship.modules.flatMap((module) => {
    const def = rules.modules.get(module.type);
    return def ? placedCells(def, module) : [];
  });
  const pieces = (ship.styling ?? []).flatMap((piece) => {
    const def = rules.styling?.get(piece.type);
    return def ? pieceCells(def, piece) : [];
  });
  return [...parts, ...pieces];
}

// The least shift that brings [low, high] inside 0 to size - 1, for a
// span no longer than size.
function into(low, high, size) {
  if (low < 0) return -low;
  if (high >= size) return size - 1 - high;
  return 0;
}
