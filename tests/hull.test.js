import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOSE_MAX, OVERHANG, traceHull } from '../src/render/hull.js';
import { buildShip, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const ship = (placements) => {
  const { ship: built, rejected } = buildShip(defs, 'starter', placements);
  assert.deepEqual(rejected, []);
  return built;
};
const at = (type, x, y, rot = 0) => ({ type, x, y, rot });
// Coordinates to three places, so 0.1 steps compare cleanly.
const round = (value) => JSON.parse(JSON.stringify(value), (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));

// The ship-shaped layout from the M4 mockups:
//   .QQRR..
//   EE+RR+B
//   EE++++B
//   ..LAW..
const MOCKUP = [
  at('bridge', 6, 1, 1),
  at('corridor', 5, 1), at('corridor', 5, 2), at('corridor', 4, 2), at('corridor', 3, 2), at('corridor', 2, 2), at('corridor', 2, 1),
  at('reactor', 3, 0), at('quarters', 1, 0), at('engine', 0, 1), at('engine', 0, 2),
  at('lifesupport', 2, 3), at('airlock', 3, 3), at('weapon', 4, 3, 2),
];

test('an empty ship has no hull', () => {
  assert.deepEqual(traceHull(newShip('starter'), defs), {
    cells: [], pockets: [], fairings: [], edges: [], noses: [], nozzles: [], barrels: [], collars: [], lights: [],
  });
});

test('the body covers every occupied cell, row by row', () => {
  const { cells } = traceHull(ship(MOCKUP), defs);
  assert.equal(cells.length, 4 + 7 + 7 + 3);
  assert.deepEqual(cells.slice(0, 5), [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1]]);
  assert.deepEqual(cells.at(-1), [4, 3]);
});

test('an empty corner between two parts gets a slope from wall to wall', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  assert.deepEqual(hull.pockets, []);
  assert.deepEqual(hull.fairings, [
    [[1, 0], [1, 1], [0, 1]], // (0, 0): quarters east, engine south
    [[5, 0], [5, 1], [6, 1]], // (5, 0): reactor west, corridor south
    [[2, 4], [2, 3], [1, 3]], // (1, 3): engine north, life support east
    [[5, 4], [5, 3], [6, 3]], // (5, 3): corridor north, weapon west
  ]);
});

test('the outline is closed, slopes replace the corners they cross, and normals point out', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  const ends = new Map();
  for (const { a, b } of hull.edges) for (const p of [a, b]) ends.set(`${p}`, (ends.get(`${p}`) ?? 0) + 1);
  assert.ok([...ends.values()].every((n) => n === 2), 'every corner of the outline joins two edges');
  const diagonals = hull.edges.filter(({ a, b }) => a[0] !== b[0] && a[1] !== b[1]);
  assert.equal(diagonals.length, 4);
  assert.ok(!hull.edges.some(({ a, b }) => `${a}${b}` === '5,05,1' || `${a}${b}` === '5,15,0'), "the reactor's east wall is behind a slope");
  const cells = new Set(hull.cells.map((c) => `${c}`));
  for (const { a, b, normal } of hull.edges) {
    if (a[0] !== b[0] && a[1] !== b[1]) continue;
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const cell = (d) => `${Math.floor(mx + normal[0] * d)},${Math.floor(my + normal[1] * d)}`;
    assert.ok(cells.has(cell(-0.5)) && !cells.has(cell(0.5)), `edge ${a} ${b}`);
  }
  const [shoulder] = diagonals.filter(({ a }) => a[0] === 5 && a[1] === 0);
  assert.deepEqual(shoulder.normal.map((n) => Math.sign(n)), [1, -1], 'the front shoulder faces up and forward');
});

test('a gap closed on three sides is filled with hull, not sloped', () => {
  // +++
  // +.+
  const hull = traceHull(ship([at('corridor', 1, 0), at('corridor', 2, 0), at('corridor', 3, 0), at('corridor', 1, 1), at('corridor', 3, 1)]), defs);
  assert.deepEqual(hull.pockets, [[2, 1]]);
  assert.ok(hull.fairings.every((tri) => !tri.some(([x, y]) => x > 2 && x < 3 && y > 1 && y < 2)));
});

test('a nose caps each run of cells on the front column, longer for longer runs', () => {
  assert.deepEqual(traceHull(ship(MOCKUP), defs).noses, [{ x: 7, y0: 1, y1: 3, length: NOSE_MAX }]);
  // Two separate cells at the front: a forked bow with two short noses.
  const forked = traceHull(ship([at('corridor', 0, 1), at('corridor', 1, 1), at('corridor', 1, 0), at('corridor', 1, 2), at('corridor', 2, 0), at('corridor', 2, 2)]), defs);
  assert.deepEqual(round(forked.noses), [
    { x: 3, y0: 0, y1: 1, length: 0.55 },
    { x: 3, y0: 2, y1: 3, length: 0.55 },
  ]);
});

test('engines get nozzles and guns get barrels only where the way out is open', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  assert.deepEqual(hull.nozzles, [{ x: 0, y: 1, side: 'w' }, { x: 0, y: 2, side: 'w' }]);
  assert.deepEqual(hull.barrels, [{ x: 4, y: 3, side: 's' }], 'turned twice, the gun points south');
  const blocked = traceHull(ship([at('corridor', 0, 1), at('engine', 1, 1), at('corridor', 4, 0), at('weapon', 4, 1)]), defs);
  assert.deepEqual(blocked.nozzles, [], 'a part behind the engine');
  assert.deepEqual(blocked.barrels, [], 'a part in front of the gun');
});

test('airlocks get a docking collar on each side open to space', () => {
  assert.deepEqual(traceHull(ship(MOCKUP), defs).collars, [{ x: 3, y: 3, side: 's' }]);
  const lone = traceHull(ship([at('airlock', 3, 1)]), defs);
  assert.deepEqual(lone.collars.map((c) => c.side), ['n', 'e', 's', 'w']);
});

test('running lights sit at the stern corners, red to port', () => {
  const lights = round(traceHull(ship(MOCKUP), defs).lights);
  assert.deepEqual(lights, [{ x: 0.08, y: 1.12, side: 'port' }, { x: 0.08, y: 2.88, side: 'starboard' }]);
});

test('everything stays inside the room the camera keeps around the frame', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  for (const nose of hull.noses) assert.ok(nose.x + nose.length <= 7 + OVERHANG.right);
});

test('tracing is pure', () => {
  const built = ship(MOCKUP);
  const frozen = structuredClone(built);
  const first = traceHull(built, defs);
  assert.deepEqual(traceHull(built, defs), first);
  assert.deepEqual(built, frozen);
});
