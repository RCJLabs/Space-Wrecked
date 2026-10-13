import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOSE_MAX, OVERHANG, traceHull } from '../src/render/hull.js';
import { buildShip, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { readFileSync } from 'node:fs';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
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

// The example ship (tests/fixtures/example-ship.json), from x 7, y 5:
//   ..QQQRRR..
//   EEQQQRRRBB
//   EE+++RRRBB
//   EELLAAW.BB
//   EE........
const MOCKUP = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')).placements;

test('an empty ship has no hull', () => {
  assert.deepEqual(traceHull(newShip('starter'), defs), {
    cells: [], pockets: [], fairings: [], edges: [], noses: [], nozzles: [], barrels: [], collars: [], lights: [],
  });
});

test('the body covers every occupied cell, row by row', () => {
  const { cells } = traceHull(ship(MOCKUP), defs);
  assert.equal(cells.length, 6 + 10 + 10 + 9 + 2);
  assert.deepEqual(cells.slice(0, 7), [[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [7, 6]]);
  assert.deepEqual(cells.at(-1), [8, 9]);
});

test('an empty corner between two parts gets a slope from wall to wall', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  assert.deepEqual(hull.pockets, [[14, 8]], 'reactor, weapon and bridge round three sides');
  assert.deepEqual(hull.fairings, [
    [[9, 5], [9, 6], [8, 6]], // (8, 5): quarters east, engine south
    [[15, 5], [15, 6], [16, 6]], // (15, 5): reactor west, bridge south
    [[9, 10], [9, 9], [10, 9]], // (9, 9): life support north, engine west
  ]);
});

test('the outline is closed, slopes replace the corners they cross, and normals point out', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  const ends = new Map();
  for (const { a, b } of hull.edges) for (const p of [a, b]) ends.set(`${p}`, (ends.get(`${p}`) ?? 0) + 1);
  assert.ok([...ends.values()].every((n) => n === 2), 'every corner of the outline joins two edges');
  const diagonals = hull.edges.filter(({ a, b }) => a[0] !== b[0] && a[1] !== b[1]);
  assert.equal(diagonals.length, 3);
  assert.ok(!hull.edges.some(({ a, b }) => `${a}${b}` === '15,515,6' || `${a}${b}` === '15,615,5'), "the reactor's east wall is behind a slope");
  const cells = new Set([...hull.cells, ...hull.pockets].map((c) => `${c}`));
  for (const { a, b, normal } of hull.edges) {
    if (a[0] !== b[0] && a[1] !== b[1]) continue;
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const cell = (d) => `${Math.floor(mx + normal[0] * d)},${Math.floor(my + normal[1] * d)}`;
    assert.ok(cells.has(cell(-0.5)) && !cells.has(cell(0.5)), `edge ${a} ${b}`);
  }
  const [shoulder] = diagonals.filter(({ a }) => a[0] === 15 && a[1] === 5);
  assert.deepEqual(shoulder.normal.map((n) => Math.sign(n)), [1, -1], 'the front shoulder faces up and forward');
});

test('a gap closed on three sides is filled with hull, not sloped', () => {
  // +++
  // +.+
  const hull = traceHull(ship([at('corridor', 1, 0), at('corridor', 2, 0), at('corridor', 3, 0), at('corridor', 1, 1), at('corridor', 3, 1)]), defs);
  assert.deepEqual(hull.pockets, [[2, 1]]);
  assert.ok(hull.fairings.every((tri) => !tri.some(([x, y]) => x > 2 && x < 3 && y > 1 && y < 2)));
});

test('a gap the ship shuts in is hull, however few parts touch each cell of it', () => {
  // +++++
  // +...+   the middle cell has parts on two sides only
  // +++++
  const ring = [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]];
  const hull = traceHull(ship(ring.map(([x, y]) => at('corridor', x, y))), defs);
  assert.deepEqual(hull.pockets, [[2, 1], [3, 1], [4, 1]]);
  assert.equal(hull.edges.length, 16, 'the outline is the outside of the ring alone');
  assert.deepEqual(hull.fairings, []);
});

test('a nose caps each run of cells on the front column, longer for longer runs', () => {
  assert.deepEqual(round(traceHull(ship(MOCKUP), defs).noses), [{ x: 17, y0: 6, y1: 9, length: 1.35 }]);
  const long = traceHull(ship([0, 1, 2, 3, 4, 5].map((y) => at('corridor', 3, y))), defs);
  assert.equal(long.noses[0].length, NOSE_MAX, 'a long bow reaches the longest nose');
  // Two separate cells at the front: a forked bow with two short noses.
  const forked = traceHull(ship([at('corridor', 0, 1), at('corridor', 1, 1), at('corridor', 1, 0), at('corridor', 1, 2), at('corridor', 2, 0), at('corridor', 2, 2)]), defs);
  assert.deepEqual(round(forked.noses), [
    { x: 3, y0: 0, y1: 1, length: 0.85 },
    { x: 3, y0: 2, y1: 3, length: 0.85 },
  ]);
});

test('engines get nozzles and guns get barrels only where the way out faces space', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  assert.deepEqual(hull.nozzles, [7, 7, 7, 7].map((x, i) => ({ x, y: 6 + i, side: 'w' })), 'two per engine, one per cell of its exhaust');
  assert.deepEqual(hull.barrels, [{ x: 13, y: 8, side: 's' }], 'turned twice, the gun points south');
  const half = traceHull(ship([at('corridor', 0, 1), at('engine', 1, 1), at('corridor', 4, 0), at('weapon', 4, 1)]), defs);
  assert.deepEqual(half.nozzles, [{ x: 1, y: 2, side: 'w' }], 'a part behind half the exhaust');
  assert.deepEqual(half.barrels, [], 'a part in front of the gun');
  // A gun two cells across (M23e's cannon) has one heavy barrel, at the
  // middle of its muzzle side; turned, it points the way it faces.
  const cannon = traceHull(ship([at('cannon', 2, 1)]), defs);
  assert.deepEqual(cannon.barrels, [{ x: 2.5, y: 1, side: 'n', heavy: true }]);
  const east = traceHull(ship([at('cannon', 2, 1, 1)]), defs);
  assert.deepEqual(east.barrels, [{ x: 2, y: 1.5, side: 'e', heavy: true }]);
});

test('airlocks get a docking collar at the hatch on each side open to space', () => {
  assert.deepEqual(traceHull(ship(MOCKUP), defs).collars, [{ x: 11, y: 8, side: 's' }]);
  const lone = traceHull(ship([at('airlock', 3, 1)]), defs);
  assert.deepEqual(lone.collars, [{ x: 3, y: 1, side: 'n' }, { x: 4, y: 1, side: 'e' }, { x: 3, y: 1, side: 's' }, { x: 3, y: 1, side: 'w' }]);
});

test('running lights sit at the stern corners, red to port', () => {
  const lights = round(traceHull(ship(MOCKUP), defs).lights);
  assert.deepEqual(lights, [{ x: 7.08, y: 6.12, side: 'port' }, { x: 7.08, y: 9.88, side: 'starboard' }]);
});

test('everything stays inside the room the camera keeps around the ship', () => {
  const hull = traceHull(ship(MOCKUP), defs);
  for (const nose of hull.noses) assert.ok(nose.x + nose.length <= 17 + OVERHANG.right);
});

test('tracing is pure', () => {
  const built = ship(MOCKUP);
  const frozen = structuredClone(built);
  const first = traceHull(built, defs);
  assert.deepEqual(traceHull(built, defs), first);
  assert.deepEqual(built, frozen);
});
