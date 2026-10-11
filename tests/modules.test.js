import assert from 'node:assert/strict';
import { test } from 'node:test';
import { facingSide, footprint, interiorRows, placedCells, sideCells } from '../src/sim/modules.js';

const long = { size: [2, 1] };
// An engine-like part: its exhaust faces west, unrotated.
const jet = { size: [2, 1], facesSpace: { side: 'w', what: 'exhaust' } };

test('footprints swap width and height on odd quarter turns', () => {
  assert.deepEqual(footprint(long, 0), [2, 1]);
  assert.deepEqual(footprint(long, 1), [1, 2]);
  assert.deepEqual(footprint(long, 2), [2, 1]);
  assert.deepEqual(footprint(long, 3), [1, 2]);
});

test('the side facing space turns clockwise with the part, and a part without one has none', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((rot) => facingSide(jet, rot)), ['w', 'n', 'e', 's', 'w']);
  assert.equal(facingSide(long, 1), null);
});

test('placed cells are offset to the placement', () => {
  assert.deepEqual(placedCells(long, { x: 3, y: 4, rot: 1 }), [[3, 4], [3, 5]]);
  assert.deepEqual(placedCells(long, { x: 3, y: 4, rot: 0 }), [[3, 4], [4, 4]]);
});

test('side cells run along the side named, left to right or top to bottom', () => {
  const placement = { x: 3, y: 4, rot: 0 }; // covers (3, 4) and (4, 4)
  assert.deepEqual(sideCells(long, placement, 'n'), [[3, 4], [4, 4]]);
  assert.deepEqual(sideCells(long, placement, 's'), [[3, 4], [4, 4]]);
  assert.deepEqual(sideCells(long, placement, 'w'), [[3, 4]]);
  assert.deepEqual(sideCells(long, placement, 'e'), [[4, 4]]);
  assert.deepEqual(sideCells(long, { x: 3, y: 4, rot: 1 }, 'e'), [[3, 4], [3, 5]], 'upright');
});

test('interiors turn with their footprint', () => {
  const def = { size: [2, 1], interior: ['c..#', '....'] };
  assert.deepEqual(interiorRows(def, 0), ['c..#', '....']);
  assert.deepEqual(interiorRows(def, 1), ['.c', '..', '..', '.#']);
  assert.deepEqual(interiorRows(def, 2), ['....', '#..c']);
  assert.deepEqual(interiorRows(def, 3), ['#.', '..', '..', 'c.']);
});
