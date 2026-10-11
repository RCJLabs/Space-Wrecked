// Module geometry: footprints, and the side a part needs open to space,
// under rotation.
//
// A definition (data/modules.json) has a size [w, h] in cells and, for an
// engine or a gun, facesSpace: { side, what }, the side (unrotated) that
// has to face space and what is there ("exhaust"). A placement is
// { type, x, y, rot }: (x, y) is the top-left cell of the rotated footprint
// and rot is 0 to 3 quarter turns clockwise.

const TURN = { n: 'e', e: 's', s: 'w', w: 'n' };

export function isRotation(rot) {
  return rot === 0 || rot === 1 || rot === 2 || rot === 3;
}

// [width, height] in cells after rot quarter turns.
export function footprint(def, rot) {
  const [w, h] = def.size;
  return rot % 2 === 0 ? [w, h] : [h, w];
}

// The side that has to face space after rot quarter turns, or null for a
// part that has none.
export function facingSide(def, rot) {
  let side = def.facesSpace?.side ?? null;
  for (let i = 0; side && i < rot; i++) side = TURN[side];
  return side;
}

// The grid cells a placement covers, as [x, y].
export function placedCells(def, { x, y, rot }) {
  const [w, h] = footprint(def, rot);
  const cells = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) cells.push([x + i, y + j]);
  }
  return cells;
}

// The cells of a placement along one of its sides, as [x, y], left to
// right or top to bottom.
export function sideCells(def, { x, y, rot }, side) {
  const [w, h] = footprint(def, rot);
  if (side === 'n' || side === 's') return Array.from({ length: w }, (_, i) => [x + i, side === 'n' ? y : y + h - 1]);
  return Array.from({ length: h }, (_, j) => [side === 'w' ? x : x + w - 1, y + j]);
}

export function hasTag(def, tag) {
  return def.tags.includes(tag);
}

// The interior template (rows of tile characters) after rot quarter turns
// clockwise, the same way the footprint turns.
export function interiorRows(def, rot) {
  let rows = def.interior.map((row) => [...row]);
  for (let i = 0; i < rot; i++) {
    const h = rows.length;
    const w = rows[0].length;
    const turned = Array.from({ length: w }, () => new Array(h));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) turned[x][h - 1 - y] = rows[y][x];
    }
    rows = turned;
  }
  return rows.map((row) => row.join(''));
}
