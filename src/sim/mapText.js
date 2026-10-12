// The battle map text format: two characters a tile each way, tiles at odd
// places and what stands on the edges between them, with '+' where edges
// meet. tools/battle-map.js prints a ship's map in it, tests draw their
// own maps in it, and data/sites.json draws the planet maps' templates in
// it (src/sim/gen/site.js).
//
//   + - + - +      a row of north edges: '-' a wall, '=' the hull,
//   | . / h        '/' a door, 'o' a hatch; then a row of tiles, each
//   +   + - +      after its west edge: '|' a wall, 'I' the hull, '/' a
//                  door, 'o' a hatch
//
// Trailing spaces can be left off a line. Lines come in as they are: the
// last edge row of a map with nothing on it is an empty line.
import { createGrid } from './grid.js';

export const EDGE_CHARS = { '-': 'wall', '|': 'wall', '=': 'hull', I: 'hull', '/': 'door', o: 'hatch' };

// Reads the lines of a map: { width, height, chars, walls: { n, w } }, with
// chars a grid of each tile's character and walls as mapFromShip.js has
// them (null where nothing stands). width is the widest line's, unless
// given (for a map whose last column is bare). Throws on a malformed map.
export function readMapText(lines, { width } = {}) {
  const rows = lines;
  const height = (rows.length - 1) / 2;
  if (!Number.isInteger(height) || height < 1) throw new Error(`readMapText: expected 2 × height + 1 lines, got ${rows.length}`);
  width ??= Math.max(...rows.map((line) => Math.floor(line.length / 2)));
  if (width < 1) throw new Error('readMapText: the map has no tiles');
  const at = (row, col) => rows[row][col] ?? ' ';
  const chars = createGrid(width, height, ' ');
  const walls = { n: createGrid(width, height, null), w: createGrid(width, height, null) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = y * width + x;
      chars.cells[k] = at(2 * y + 1, 2 * x + 1);
      walls.n.cells[k] = EDGE_CHARS[at(2 * y, 2 * x + 1)] ?? null;
      walls.w.cells[k] = EDGE_CHARS[at(2 * y + 1, 2 * x)] ?? null;
    }
  }
  return { width, height, chars, walls };
}

// The lines turned over left to right and/or top to bottom: the same map
// mirrored. Each line is padded to its full width first, so its tiles and
// edges change places as one.
export function flipMapText(lines, { x = false, y = false, width } = {}) {
  const rows = lines;
  width ??= Math.max(...rows.map((line) => Math.floor(line.length / 2)));
  const full = rows.map((line) => line.padEnd(2 * width + 1, ' '));
  const across = x ? full.map((line) => [...line].reverse().join('')) : full;
  return (y ? [...across].reverse() : across).map((line) => line.trimEnd());
}
