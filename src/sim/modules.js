// Module geometry: footprints and door sockets under rotation.
//
// A definition (data/modules.json) has a size [w, h] in cells and door
// sockets { side, at }: n and s sockets count `at` along x from the left,
// e and w sockets count it along y from the top. A placement is
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

// Door sockets as [x, y, side] within the rotated footprint.
export function localDoors(def, rot) {
  let [w, h] = def.size;
  let doors = def.doors.map((door) => socketCell(door, w, h));
  for (let i = 0; i < rot; i++) {
    // One quarter turn clockwise: (x, y) in w×h becomes (h-1-y, x) in h×w.
    doors = doors.map(([x, y, side]) => [h - 1 - y, x, TURN[side]]);
    [w, h] = [h, w];
  }
  return doors;
}

function socketCell({ side, at }, w, h) {
  if (side === 'n') return [at, 0, 'n'];
  if (side === 's') return [at, h - 1, 's'];
  if (side === 'e') return [w - 1, at, 'e'];
  return [0, at, 'w'];
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

// A placement's door sockets as [x, y, side] in grid coordinates.
export function placedDoors(def, { x, y, rot }) {
  return localDoors(def, rot).map(([dx, dy, side]) => [x + dx, y + dy, side]);
}

export function hasTag(def, tag) {
  return def.tags.includes(tag);
}
