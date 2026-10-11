import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellAt, createGrid, exteriorOf, inBounds, OPPOSITE, SIDES, step, withCells } from '../src/sim/grid.js';

test('createGrid makes a filled rectangle and rejects bad sizes', () => {
  const grid = createGrid(3, 2, 0);
  assert.equal(grid.cells.length, 6);
  assert.ok(grid.cells.every((v) => v === 0));
  assert.throws(() => createGrid(0, 2), RangeError);
  assert.throws(() => createGrid(2, 1.5), RangeError);
});

test('bounds are exact and reject non-integers', () => {
  const grid = createGrid(3, 2);
  assert.equal(inBounds(grid, 0, 0), true);
  assert.equal(inBounds(grid, 2, 1), true);
  assert.equal(inBounds(grid, 3, 1), false);
  assert.equal(inBounds(grid, 0, 2), false);
  assert.equal(inBounds(grid, -1, 0), false);
  assert.equal(inBounds(grid, 0.5, 0), false);
  assert.equal(cellAt(grid, 5, 5), undefined);
});

test('withCells returns a changed copy and leaves the input alone', () => {
  const grid = createGrid(2, 2);
  const next = withCells(grid, [[0, 0], [1, 1]], 'x');
  assert.equal(cellAt(next, 0, 0), 'x');
  assert.equal(cellAt(next, 1, 1), 'x');
  assert.equal(cellAt(next, 1, 0), null);
  assert.equal(cellAt(grid, 0, 0), null);
  assert.throws(() => withCells(grid, [[2, 0]], 'x'), RangeError);
});

test('step and OPPOSITE agree for every side', () => {
  for (const side of SIDES) {
    const [x, y] = step(5, 5, side);
    assert.deepEqual(step(x, y, OPPOSITE[side]), [5, 5]);
  }
  assert.deepEqual(step(0, 0, 'n'), [0, -1]);
  assert.deepEqual(step(0, 0, 'e'), [1, 0]);
});

test('exteriorOf separates open space outside from enclosed holes', () => {
  // A ring of walls around one empty cell, inside a larger empty grid:
  // .....
  // .###.
  // .#.#.
  // .###.
  let grid = createGrid(5, 4, null);
  const ring = [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3]];
  grid = withCells(grid, ring, 'wall');
  const outside = exteriorOf(grid, (v) => v === null);
  assert.equal(outside(0, 0), true);
  assert.equal(outside(4, 3), true);
  assert.equal(outside(2, 2), false, 'the enclosed hole is not outside');
  assert.equal(outside(1, 1), false, 'walls are not outside');
  assert.equal(outside(-1, 2), true, 'beyond the grid is outside');
  assert.equal(outside(5, 0), true);
});
