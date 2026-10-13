// The hull's shape in a style (M23d, src/render/hullShape.js): it covers
// every cell and never cuts into a room, its outer corners are rounded or
// cut, a nose takes over at the front, and what sticks out sits on its side.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { CHORD, hullBands, hullShape, MAX_NOSE, noseSurfaces, PLAIN, sidePoint, styleOf } from '../src/render/hullShape.js';
import { skins } from '../src/render/palette.js';
import { buildShip } from '../src/sim/builder.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launchedShip } from '../tools/startShip.js';
import { rules } from './battleKit.js';

const placements = JSON.parse(readFileSync(new URL('./fixtures/example-ship.json', import.meta.url), 'utf8')).placements;
const at = (type, x, y, rot = 0) => ({ type, x, y, rot });
// Ships of every kind: the example, the launched start ship, odd shapes (a
// lone cell, a forked bow, a ring round a pocket, a diagonal touch), and
// the presets at a few seeds.
const odd = [
  [at('corridor', 5, 5)],
  [at('corridor', 0, 1), at('corridor', 1, 1), at('corridor', 1, 0), at('corridor', 1, 2), at('corridor', 2, 0), at('corridor', 2, 2)],
  [[1, 0], [2, 0], [3, 0], [1, 1], [3, 1], [1, 2], [2, 2], [3, 2]].map(([x, y]) => at('corridor', x, y)),
  [at('corridor', 3, 3), at('corridor', 4, 4), at('corridor', 5, 3)],
];
const fleet = [
  ['example', buildShip(rules, 'starter', placements).ship],
  ['launched', launchedShip(rules)],
  ...odd.map((list, i) => [`odd ${i}`, buildShip(rules, 'starter', list).ship]),
  ...[...rules.ships.keys()].flatMap((preset) => [1, 2, 3].map((seed) => [`${preset} ${seed}`, generateShip(rules, preset, seed).ship])),
];
const styles = [...rules.hulls.values()];

// Inside any loop of a level: the winding number of the point.
function inside(levelLoops, [px, py]) {
  let winding = 0;
  for (const pts of levelLoops) {
    for (let i = 0; i < pts.length; i++) {
      const [[ax, ay], [bx, by]] = [pts[i], pts[(i + 1) % pts.length]];
      const cross = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
      if (ay <= py && by > py && cross > 0) winding++;
      else if (ay > py && by <= py && cross < 0) winding--;
    }
  }
  return winding !== 0;
}

test('in every style the hull covers every cell at every height, so it never cuts into a room', () => {
  for (const style of styles) {
    for (const [name, ship] of fleet) {
      const hull = traceHull(ship, rules);
      const shape = hullShape(hull, style);
      const levels = shape.loops[0].levels.length;
      for (let j = 0; j < levels; j++) {
        const loops = shape.loops.map((loop) => loop.levels[j].pts);
        for (const [x, y] of hull.cells) {
          // Each cell's corners, a hair in from them: a room is 0.1 in.
          for (const [cx, cy] of [[x + 0.01, y + 0.01], [x + 0.99, y + 0.01], [x + 0.99, y + 0.99], [x + 0.01, y + 0.99]]) {
            assert.ok(inside(loops, [cx, cy]), `${style.id}, ${name}: (${cx}, ${cy}) outside level ${j}`);
          }
        }
      }
    }
  }
});

test('no outer corner of the outline is a plain right angle: a nose takes over at the front', () => {
  for (const style of styles) {
    for (const [name, ship] of fleet) {
      const shape = hullShape(traceHull(ship, rules), style);
      for (const { levels, nose } of shape.loops) {
        // The base's distinct points, each with the run of indices it was
        // given at (a sharp corner repeats its point).
        const all = levels[levels.length - 1].pts;
        const points = [];
        all.forEach((p, i) => {
          const last = points[points.length - 1];
          if (last && Math.hypot(p[0] - last.at[0], p[1] - last.at[1]) < 1e-6) last.to = i;
          else points.push({ at: p, from: i, to: i });
        });
        if (points.length > 1 && Math.hypot(points[0].at[0] - points.at(-1).at[0], points[0].at[1] - points.at(-1).at[1]) < 1e-6) {
          points[0].from = points.pop().from - all.length;
        }
        const n = points.length;
        const flag = (i) => nose[((i % all.length) + all.length) % all.length];
        for (let j = 0; j < n; j++) {
          const [a, b, c] = [points[(j - 1 + n) % n].at, points[j].at, points[(j + 1) % n].at];
          const u = [b[0] - a[0], b[1] - a[1]];
          const v = [c[0] - b[0], c[1] - b[1]];
          const turn = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
          // Where a nose's front starts or ends, the nose carries the
          // outline on.
          let atNose = flag(points[j].from - 1);
          for (let i = points[j].from; i <= points[j].to; i++) atNose ||= flag(i);
          if (atNose) continue;
          // A gap a cell wide closes at the side, both edges of it out by
          // half a cell: the outline runs into it and straight back out,
          // a crease in the hull rather than a corner.
          if (Math.abs(turn) > Math.PI - 0.05) continue;
          assert.ok(turn < Math.PI / 2 - 0.01, `${style.id}, ${name}: a right angle at (${b.map((c) => c.toFixed(2))})`);
        }
      }
      for (const nose of shape.noses) {
        // The nose's side leaves the hull's at a slant, not square.
        const [first, second] = [nose.rings[0], nose.rings[1] ?? [nose.tip]];
        const widest = (ring) => Math.max(...ring.map((p) => Math.abs(p[1] - (nose.y0 + nose.y1) / 2)));
        const narrowing = widest(first) - widest(second);
        const forward = (second[0][0] ?? nose.tip[0]) - first[0][0];
        assert.ok(Math.atan2(narrowing, forward) < Math.PI / 2 - 0.1, `${style.id}, ${name}: a square-cut nose`);
        assert.ok(nose.length > 0 && nose.length <= MAX_NOSE);
      }
    }
  }
});

test("a rounded corner takes the steps its size needs, up to its style's: pieces CHORD long or less", () => {
  const style = rules.hulls.get('rounded');
  const used = new Set();
  for (const [name, ship] of fleet) {
    for (const { levels, per } of hullShape(traceHull(ship, rules), style).loops) {
      const count = levels[0].pts.length;
      for (let at = 0; at < count; at += per) {
        // A corner's pieces on every level, and how many it took: the same
        // on all of them.
        const pieces = levels.map(({ pts }) => Array.from({ length: per - 1 }, (_, k) => Math.hypot(pts[at + k + 1][0] - pts[at + k][0], pts[at + k + 1][1] - pts[at + k][1])));
        const took = Math.max(...pieces.map((list) => list.filter((l) => l > 1e-9).length));
        used.add(took);
        if (took < style.steps) assert.ok(pieces.flat().every((l) => l <= CHORD + 1e-9), `${name}: a corner of ${took} pieces has one over ${CHORD}`);
      }
    }
  }
  assert.ok(used.has(style.steps) && [...used].some((n) => n > 0 && n < style.steps), `big corners take every step, small ones fewer (${[...used].sort()})`);
});

test('every band and nose surface is finite, and the same ship always gives the same shape', () => {
  for (const style of styles) {
    for (const [name, ship] of fleet) {
      const hull = traceHull(ship, rules);
      const shape = hullShape(hull, style);
      const bands = hullBands(shape, HULL);
      assert.ok(bands.length > 0, name);
      for (const { pts, outward } of bands) assert.ok([...pts.flat(), ...outward].every(Number.isFinite), `${style.id}, ${name}`);
      for (const nose of shape.noses) for (const { pts } of noseSurfaces(nose, HULL)) assert.ok(pts.flat().every(Number.isFinite));
      assert.deepEqual(hullShape(traceHull(structuredClone(ship), rules), style).loops, shape.loops, 'pure');
    }
  }
});

test("nozzles and collars sit on the hull's side, out past their cells", () => {
  for (const style of styles) {
    for (const [name, ship] of fleet) {
      const hull = traceHull(ship, rules);
      const shape = hullShape(hull, style);
      const base = shape.loops.flatMap((loop) => {
        const pts = loop.levels[loop.levels.length - 1].pts;
        return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
      });
      const toSide = ([px, py]) => Math.min(...base.map(([[ax, ay], [bx, by]]) => {
        const [ex, ey] = [bx - ax, by - ay];
        const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1)));
        return Math.hypot(px - ax - t * ex, py - ay - t * ey);
      }));
      const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
      for (const { x, y, side } of [...hull.nozzles, ...hull.collars]) {
        const p = sidePoint(shape, [x + 0.5, y + 0.5], STEP[side]);
        assert.ok(toSide(p) < 1e-6, `${style.id}, ${name}: off the side`);
        const out = (p[0] - (x + 0.5)) * STEP[side][0] + (p[1] - (y + 0.5)) * STEP[side][1];
        assert.ok(out >= 0.5 - 1e-6, `${style.id}, ${name}: inside its cell`);
      }
    }
  }
});

test('a ship is drawn in its own style; one with none, or one content lacks, in the default', () => {
  const ship = buildShip(rules, 'starter', placements).ship;
  assert.equal(styleOf(rules, { ...ship, hull: 'plated' }).id, 'plated');
  assert.equal(styleOf(rules, { ...ship, hull: 'chrome' }).id, 'rounded');
  assert.equal(styleOf(rules, { ...ship, hull: undefined }).id, 'rounded');
  assert.equal(styleOf({ hulls: new Map() }, ship), PLAIN, 'no styles at all: the outline upright');
  const scene = (hull) => exteriorScene({ ship: { ...ship, hull }, defs: rules, hull: traceHull(ship, rules), skin: skins.yard });
  const [rounded, plated] = [scene('rounded'), scene('plated')];
  assert.notDeepEqual(rounded.faces, plated.faces, 'the styles look different');
  assert.equal(rounded.exhausts.length, traceHull(ship, rules).nozzles.length, "one exhaust a nozzle's mouth");
  assert.deepEqual(rounded.exhausts, scene('rounded').exhausts, 'the same every time');
});
