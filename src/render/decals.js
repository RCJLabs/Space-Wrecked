// The ship's identity on her hull (M52): her number painted on the roof by
// the bow, and her emblem amidships, in the trim's color (an emblem's cuts
// in the hull's paint), each on a panel of the hull's paint laid over the
// low plating and vents. Each keeps clear of the tall fittings (guns,
// domes, masts), at the biggest size that fits; nothing is painted where
// none does. Pure:
// plain data in, flat faces (solid.js) out, painted over the finished hull
// in the order given (painter.js paintOver), like hullMarks.js.
import { EMBLEMS } from './emblems.js';

const UP = [0, 0, 1];
const STEP = 0.25; // the roof is looked over in quarter cells
const MARGIN = 0.1; // how far a decal keeps from a tall fitting
const TALL = 0.06; // a fitting higher than this over the roof is kept clear of
const PAD = 0.12; // the panel round a decal, in cells
const NUMBER_SIZES = [0.6, 0.5, 0.4]; // a letter's height, in cells
const EMBLEM_SIZES = [1.8, 1.4, 1.1, 0.8]; // an emblem's width
const ADVANCE = 0.8; // a letter's width and the gap after it, of its height
const WEIGHT = 0.16; // a stroke's width, of a letter's height

// The stroke lettering: each glyph as strokes in a box 0.6 wide and 1 high
// (x along the line, y down from the top), each stroke a polyline.
const GLYPHS = {
  A: [[[0, 1], [0.3, 0], [0.6, 1]], [[0.12, 0.62], [0.48, 0.62]]],
  B: [[[0, 1], [0, 0], [0.45, 0], [0.55, 0.12], [0.55, 0.38], [0.45, 0.5], [0, 0.5]], [[0.45, 0.5], [0.6, 0.62], [0.6, 0.88], [0.48, 1], [0, 1]]],
  C: [[[0.6, 0], [0.12, 0], [0, 0.12], [0, 0.88], [0.12, 1], [0.6, 1]]],
  D: [[[0, 0], [0, 1], [0.42, 1], [0.6, 0.8], [0.6, 0.2], [0.42, 0], [0, 0]]],
  E: [[[0.6, 0], [0, 0], [0, 1], [0.6, 1]], [[0, 0.5], [0.45, 0.5]]],
  F: [[[0.6, 0], [0, 0], [0, 1]], [[0, 0.5], [0.45, 0.5]]],
  G: [[[0.6, 0], [0.12, 0], [0, 0.12], [0, 0.88], [0.12, 1], [0.6, 1], [0.6, 0.55], [0.32, 0.55]]],
  H: [[[0, 0], [0, 1]], [[0.6, 0], [0.6, 1]], [[0, 0.5], [0.6, 0.5]]],
  J: [[[0.6, 0], [0.6, 0.88], [0.48, 1], [0.12, 1], [0, 0.85]]],
  K: [[[0, 0], [0, 1]], [[0.6, 0], [0, 0.55]], [[0.2, 0.38], [0.6, 1]]],
  L: [[[0, 0], [0, 1], [0.6, 1]]],
  M: [[[0, 1], [0, 0], [0.3, 0.55], [0.6, 0], [0.6, 1]]],
  N: [[[0, 1], [0, 0], [0.6, 1], [0.6, 0]]],
  P: [[[0, 1], [0, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.42], [0.48, 0.54], [0, 0.54]]],
  R: [[[0, 1], [0, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.42], [0.48, 0.54], [0, 0.54]], [[0.28, 0.54], [0.6, 1]]],
  S: [[[0.6, 0], [0.12, 0], [0, 0.12], [0, 0.4], [0.12, 0.5], [0.48, 0.5], [0.6, 0.6], [0.6, 0.88], [0.48, 1], [0, 1]]],
  T: [[[0, 0], [0.6, 0]], [[0.3, 0], [0.3, 1]]],
  U: [[[0, 0], [0, 0.88], [0.12, 1], [0.48, 1], [0.6, 0.88], [0.6, 0]]],
  V: [[[0, 0], [0.3, 1], [0.6, 0]]],
  W: [[[0, 0], [0.12, 1], [0.3, 0.45], [0.48, 1], [0.6, 0]]],
  X: [[[0, 0], [0.6, 1]], [[0.6, 0], [0, 1]]],
  Y: [[[0, 0], [0.3, 0.5], [0.6, 0]], [[0.3, 0.5], [0.3, 1]]],
  Z: [[[0, 0], [0.6, 0], [0, 1], [0.6, 1]]],
  0: [[[0.12, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.88], [0.48, 1], [0.12, 1], [0, 0.88], [0, 0.12], [0.12, 0]]],
  1: [[[0.12, 0.2], [0.34, 0], [0.34, 1]], [[0.1, 1], [0.58, 1]]],
  2: [[[0, 0.15], [0.12, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.4], [0, 1], [0.6, 1]]],
  3: [[[0, 0], [0.6, 0], [0.3, 0.42], [0.48, 0.42], [0.6, 0.55], [0.6, 0.88], [0.48, 1], [0, 1]]],
  4: [[[0.45, 1], [0.45, 0], [0, 0.68], [0.6, 0.68]]],
  5: [[[0.6, 0], [0, 0], [0, 0.45], [0.48, 0.45], [0.6, 0.57], [0.6, 0.88], [0.48, 1], [0, 1]]],
  6: [[[0.55, 0], [0.12, 0], [0, 0.15], [0, 0.88], [0.12, 1], [0.48, 1], [0.6, 0.88], [0.6, 0.6], [0.48, 0.48], [0, 0.48]]],
  7: [[[0, 0], [0.6, 0], [0.22, 1]]],
  8: [[[0.12, 0], [0.48, 0], [0.58, 0.1], [0.58, 0.38], [0.48, 0.48], [0.12, 0.48], [0.02, 0.38], [0.02, 0.1], [0.12, 0]], [[0.12, 0.48], [0, 0.6], [0, 0.88], [0.12, 1], [0.48, 1], [0.6, 0.88], [0.6, 0.6], [0.48, 0.48]]],
  9: [[[0.6, 0.52], [0.12, 0.52], [0, 0.4], [0, 0.12], [0.12, 0], [0.48, 0], [0.6, 0.12], [0.6, 0.85], [0.45, 1], [0.05, 1]]],
  '-': [[[0.1, 0.5], [0.5, 0.5]]],
};

// The characters the lettering draws, for tests.
export const LETTERING = Object.keys(GLYPHS);

// The identity's decals on a ship's roof. hull (traceHull's), fitted:
// the faces standing on the roof, which a decal keeps clear of; identity
// { number, emblem } (emblem may be null); colors { mark, cut }; z the
// roof's height. [faces], the number's strokes then the emblem's shapes.
export function decalFaces({ hull, fitted, identity, colors, z }) {
  if (!identity || !hull.cells.length) return [];
  const free = freeRoof(hull, fitted, z);
  const out = [];
  const xs = hull.cells.map(([x]) => x);
  const ys = hull.cells.map(([, y]) => y);
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1];
  const middle = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  const at = z + 0.008;
  let taken = null;
  if (identity.number) {
    for (const size of NUMBER_SIZES) {
      const w = identity.number.length * size * ADVANCE - size * 0.2;
      // As near the bow as it goes: the spot whose front is furthest forward.
      const spot = bestSpot(free, bounds, w, size, ([x0, y0]) => x0 + w + Math.abs(y0 + size / 2 - middle[1]) * -0.3);
      if (!spot) continue;
      out.push(panel(spot, [spot[0] + w, spot[1] + size], colors.cut, at), ...lettering(identity.number, spot, size, colors.mark, at));
      taken = [spot[0], spot[1], spot[0] + w, spot[1] + size];
      break;
    }
  }
  const drawing = identity.emblem && EMBLEMS[identity.emblem];
  if (drawing) {
    for (const size of EMBLEM_SIZES) {
      // As near the middle as it goes, and clear of the number.
      const spot = bestSpot(free, bounds, size, size, ([x0, y0]) => -Math.hypot(x0 + size / 2 - middle[0], y0 + size / 2 - middle[1]), taken);
      if (!spot) continue;
      out.push(panel(spot, [spot[0] + size, spot[1] + size], colors.cut, at), ...emblemFaces(drawing, [spot[0] + size / 2, spot[1] + size / 2], size / 2, colors, at));
      break;
    }
  }
  return out;
}

// Which quarter cells of the roof a decal may go on: on the hull and not
// under (or within MARGIN of) a tall fitting. A test (x, y) -> boolean.
function freeRoof(hull, fitted, z) {
  const cells = new Set(hull.cells.map(([x, y]) => `${x},${y}`));
  const boxes = [];
  for (const face of fitted) {
    if (!face.pts.some((p) => p[2] > z + TALL)) continue;
    const fx = face.pts.map((p) => p[0]);
    const fy = face.pts.map((p) => p[1]);
    boxes.push([Math.min(...fx) - MARGIN, Math.min(...fy) - MARGIN, Math.max(...fx) + MARGIN, Math.max(...fy) + MARGIN]);
  }
  const memo = new Map();
  return (x, y) => {
    const key = `${x},${y}`;
    if (memo.has(key)) return memo.get(key);
    const [cx, cy] = [x + STEP / 2, y + STEP / 2];
    const ok = cells.has(`${Math.floor(cx)},${Math.floor(cy)}`) && !boxes.some(([x0, y0, x1, y1]) => x + STEP > x0 && x < x1 && y + STEP > y0 && y < y1);
    memo.set(key, ok);
    return ok;
  };
}

// The best [x, y] corner of a w × h box of bare roof by score, on the
// quarter-cell lattice over the hull's bounds ([x0, y0, x1, y1]), not
// overlapping `avoid` (a box as bounds are); null if none fits.
function bestSpot(free, bounds, w, h, score, avoid = null) {
  let best = null;
  let bestScore = -Infinity;
  const nw = Math.ceil(w / STEP - 1e-9);
  const nh = Math.ceil(h / STEP - 1e-9);
  for (let y = bounds[1]; y + h <= bounds[3] + 1e-9; y += STEP) {
    for (let x = bounds[0]; x + w <= bounds[2] + 1e-9; x += STEP) {
      if (!free(x, y)) continue;
      if (avoid && x < avoid[2] + MARGIN && x + w > avoid[0] - MARGIN && y < avoid[3] + MARGIN && y + h > avoid[1] - MARGIN) continue;
      const s = score([x, y]);
      if (s <= bestScore) continue;
      let fits = true;
      for (let j = 0; j < nh && fits; j++) for (let i = 0; i < nw && fits; i++) fits = free(x + i * STEP, y + j * STEP);
      if (fits) {
        best = [x, y];
        bestScore = s;
      }
    }
  }
  return best;
}

// The panel a decal is painted on, from [x0, y0] to [x1, y1] and PAD
// round, its corners cut.
function panel([x0, y0], [x1, y1], color, z) {
  const [a, b, c, d] = [x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD];
  const k = PAD;
  return { pts: [[a + k, b, z], [c - k, b, z], [c, b + k, z], [c, d - k, z], [c - k, d, z], [a + k, d, z], [a, d - k, z], [a, b + k, z]], normal: UP, color };
}

// A line of lettering from [x, y] (its top left), letters `size` high, as
// stroke quads.
export function lettering(text, [x, y], size, color, z) {
  const faces = [];
  const half = (size * WEIGHT) / 2;
  [...text].forEach((ch, i) => {
    const left = x + i * size * ADVANCE;
    for (const stroke of GLYPHS[ch] ?? []) {
      const pts = stroke.map(([gx, gy]) => [left + gx * size, y + gy * size]);
      for (let k = 1; k < pts.length; k++) {
        const [a, b] = [pts[k - 1], pts[k]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!len) continue;
        // Each piece runs on half a stroke past its ends, so joins close.
        const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        const [nx, ny] = [-uy * half, ux * half];
        const a2 = [a[0] - ux * half, a[1] - uy * half];
        const b2 = [b[0] + ux * half, b[1] + uy * half];
        faces.push({ pts: [[a2[0] + nx, a2[1] + ny, z], [b2[0] + nx, b2[1] + ny, z], [b2[0] - nx, b2[1] - ny, z], [a2[0] - nx, a2[1] - ny, z]], normal: UP, color });
      }
    }
  });
  return faces;
}

// An emblem's shapes about [cx, cy], r half its width, the drawing's up
// toward -y.
export function emblemFaces(drawing, [cx, cy], r, colors, z) {
  return drawing.map(({ tone, pts }) => ({ pts: pts.map(([px, py]) => [cx + px * r, cy + py * r, z]), normal: UP, color: tone === 'cut' ? colors.cut : colors.mark }));
}
