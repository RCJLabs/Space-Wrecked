// A ship's livery beyond paint and trim (M58): the paint's pattern, in a
// second color (another paint), and the color its engines burn. The
// patterns are drawings, so they live here; data/styling.json names them
// (tools/validate-data.js checks each has one). Pure.
import { glows, paints, palette } from './palette.js';

// Each pattern says whether a roof plate takes the second color, from the
// plate's middle [x, y] and the hull's bounds { x0, y0, x1, y1 } (cells;
// the bow is toward x1, M2's nose-right).
export const PATTERNS = {
  // One color all over: as every ship was before M58.
  plain: () => false,
  // The fore half in the second color.
  split: ([x], { x0, x1 }) => x >= (x0 + x1) / 2,
  // A band across the middle third, bow to stern.
  band: ([x], { x0, x1 }) => x >= x0 + (x1 - x0) / 3 && x < x0 + (2 * (x1 - x0)) / 3,
  // Blocks, two cells square, in turn.
  blocks: ([x, y]) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 1,
};

// The roof plate's color for a module at [x, y] to [x + w, y + h]: one of
// the paint's tints, or the second color's where the pattern puts it.
export function plateColor(ship, skin, bounds, [x0, y0, x1, y1], uid) {
  const coat = paints[ship.accent];
  const second = coat && (PATTERNS[ship.pattern] ?? PATTERNS.plain)([(x0 + x1) / 2, (y0 + y1) / 2], bounds);
  const plates = second ? coat.plates : skin.plates;
  return plates[uid % plates.length];
}

// The color the ship's engines burn: her glow's, or, for the maker's (or
// one this version doesn't know), the maker's own.
export function flameColor(ship, makerFlame) {
  return glows[ship?.glow] ?? makerFlame;
}

// The crew's suit color (M58): the ship's paint for suits in the ship's
// colors, else the standard slate.
export function suitColor(suits, paint) {
  return suits === 'ship' && paints[paint] ? paints[paint].hull : palette.crewSuit;
}

// A ship's cells' bounds { x0, y0, x1, y1 }: the corners of its hull.
export function cellBounds(cells) {
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
}
