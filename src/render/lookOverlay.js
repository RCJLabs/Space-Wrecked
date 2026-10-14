// The Look's marks on the solid ship (M23f): the styling piece being
// placed or moved, see-through in green (red where it can't go), and the
// piece picked out, in the accent. Each is its model where it would stand
// (a wedge or a curve, its outline raised to the roof) over its cells.
// Pure: solid faces out (solid.js), drawn over the ship's. pieceBox is the
// space a piece takes, for picking it (pick.js).
import { pieceCells, pieceShape } from '../sim/styling.js';
import { HULL } from './exterior.js';
import { hullShape, styleOf } from './hullShape.js';
import { palette, rgba, skinFor } from './palette.js';
import { pieceScene } from './pieces.js';
import { normalOf } from './solid.js';

// input: { ship, defs, hull: traceHull(ship, defs), ghost: { placement, ok }
// or null, selected: a piece's uid or null }.
export function lookOverlay({ ship, defs, hull, ghost, selected }) {
  const faces = [];
  const mark = (placement, color, alpha) => {
    const tint = { color, alpha, emissive: true, edge: rgba(color, 0.9) };
    for (const face of solidOf(defs, ship, hull, placement)) faces.push({ pts: face.pts, normal: face.normal, ...tint, ...(face.cell ? { alpha: alpha * 0.6, edge: undefined } : {}) });
  };
  if (ghost) mark(ghost.placement, ghost.ok ? palette.good : palette.bad, 0.45);
  const picked = (ship.styling ?? []).find((piece) => piece.uid === selected);
  if (picked) mark(picked, palette.accent, 0.35);
  return faces;
}

// The box [x0, y0, z0, x1, y1, z1] round a piece where it would stand: its
// model and its cells.
export function pieceBox({ ship, defs, hull }, placement) {
  const pts = solidOf(defs, ship, hull, placement).flatMap((face) => face.pts);
  if (!pts.length) return null;
  const [x0, y0, z0] = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
  const [x1, y1, z1] = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  return [x0, y0, z0, x1, y1, z1];
}

// A piece as solid faces where it would stand, colorless: a square on each
// of its cells (flagged `cell`), then its model, or a wedge's or a curve's
// outline up to the roof. Nothing for an unknown piece or a ship with no
// hull to stand against.
function solidOf(defs, ship, hull, placement) {
  const def = defs.styling?.get(placement.type);
  if (!def || !hull.cells.length) return [];
  const faces = pieceCells(def, placement).map(([x, y]) => ({ pts: [[x + 0.06, y + 0.06, 0.01], [x + 0.94, y + 0.06, 0.01], [x + 0.94, y + 0.94, 0.01], [x + 0.06, y + 0.94, 0.01]], normal: [0, 0, 1], cell: true }));
  if (def.shape) {
    const { region } = pieceShape(def, placement);
    const top = HULL + 0.02;
    faces.push({ pts: region.map(([x, y]) => [x, y, top]), normal: [0, 0, 1] });
    const middle = [0, 1].map((k) => region.reduce((sum, p) => sum + p[k], 0) / region.length);
    for (let i = 0; i < region.length; i++) {
      const [a, b] = [region[i], region[(i + 1) % region.length]];
      const pts = [[...a, 0], [...b, 0], [...b, top], [...a, top]];
      faces.push({ pts, normal: normalOf(pts, [...middle, top / 2]) });
    }
    return faces;
  }
  const { shape, wallTop } = shapeOf(defs, ship, hull);
  return [...faces, ...pieceScene({ def, placement, shape, wallTop, skin: skinFor('yard') }).faces];
}

// The hull's shape for a traced hull in the ship's style, worked out once
// (a ghost redraws as a finger moves).
const shapes = new WeakMap();
function shapeOf(defs, ship, hull) {
  const style = styleOf(defs, ship);
  let known = shapes.get(hull);
  if (known?.style !== style) {
    known = { style, shape: hullShape(hull, style), wallTop: style.profile[style.profile.length - 2][1] * HULL };
    shapes.set(hull, known);
  }
  return known;
}
