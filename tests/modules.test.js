import assert from 'node:assert/strict';
import { test } from 'node:test';
import { footprint, localDoors, placedCells, placedDoors } from '../src/sim/modules.js';

// A 2×1 module with a door on every side: the two south cells, west, east.
const long = {
  size: [2, 1],
  doors: [
    { side: 's', at: 0 },
    { side: 's', at: 1 },
    { side: 'w', at: 0 },
    { side: 'e', at: 0 },
  ],
};

// A 2×2 module with doors at opposite corners.
const square = {
  size: [2, 2],
  doors: [
    { side: 'n', at: 0 },
    { side: 's', at: 1 },
  ],
};

const sorted = (doors) => doors.map((d) => d.join(',')).sort();

test('footprints swap width and height on odd quarter turns', () => {
  assert.deepEqual(footprint(long, 0), [2, 1]);
  assert.deepEqual(footprint(long, 1), [1, 2]);
  assert.deepEqual(footprint(long, 2), [2, 1]);
  assert.deepEqual(footprint(long, 3), [1, 2]);
});

test('doors sit on the edge cells their side names', () => {
  assert.deepEqual(sorted(localDoors(long, 0)), sorted([[0, 0, 's'], [1, 0, 's'], [0, 0, 'w'], [1, 0, 'e']]));
});

test('a quarter turn clockwise moves every door with its cell', () => {
  // Turned clockwise, the 2×1 stands upright (1×2): the south doors face
  // west, the west end is on top and the east end at the bottom.
  assert.deepEqual(sorted(localDoors(long, 1)), sorted([[0, 0, 'w'], [0, 1, 'w'], [0, 0, 'n'], [0, 1, 's']]));
  // Half a turn: south doors face north, in reverse order; ends swap.
  assert.deepEqual(sorted(localDoors(long, 2)), sorted([[1, 0, 'n'], [0, 0, 'n'], [1, 0, 'e'], [0, 0, 'w']]));
  // The square's corner doors turn with it.
  assert.deepEqual(sorted(localDoors(square, 1)), sorted([[1, 0, 'e'], [0, 1, 'w']]));
});

test('every rotation keeps doors on outward edges, and a fourth turn is the start', () => {
  const TURN = { n: 'e', e: 's', s: 'w', w: 'n' };
  for (const def of [long, square]) {
    for (let rot = 0; rot < 4; rot++) {
      const [w, h] = footprint(def, rot);
      for (const [x, y, side] of localDoors(def, rot)) {
        assert.ok(x >= 0 && x < w && y >= 0 && y < h, `door inside the footprint at rot ${rot}`);
        const outward = (side === 'n' && y === 0) || (side === 's' && y === h - 1) || (side === 'w' && x === 0) || (side === 'e' && x === w - 1);
        assert.ok(outward, `door faces out of the module at rot ${rot}`);
      }
    }
    // One more quarter turn after rot 3 must land exactly on rot 0.
    const [, h3] = footprint(def, 3);
    const fourth = localDoors(def, 3).map(([x, y, side]) => [h3 - 1 - y, x, TURN[side]]);
    assert.deepEqual(sorted(fourth), sorted(localDoors(def, 0)));
  }
});

test('placed cells and doors are offset to the placement', () => {
  const placement = { x: 3, y: 4, rot: 1 };
  assert.deepEqual(placedCells(long, placement), [[3, 4], [3, 5]]);
  assert.deepEqual(sorted(placedDoors(long, placement)), sorted([[3, 4, 'w'], [3, 5, 'w'], [3, 4, 'n'], [3, 5, 's']]));
});
