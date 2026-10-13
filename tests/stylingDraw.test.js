// M23f's styling as drawn (src/render/pieces.js, exterior.js, shipScene.js,
// hull.js): every piece has a look of its own outside, on the plans and in
// the drawer; it sits on its cells against the hull; wings sweep back on
// either side; paint and trim color the hull; wedges and curves change the
// outline. Where pieces go is tests/styling.test.js's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { hullShape, styleOf } from '../src/render/hullShape.js';
import { paints, skins, trims } from '../src/render/palette.js';
import { MODELED, pieceIconSvg, pieceScene } from '../src/render/pieces.js';
import { blueprintScene } from '../src/render/shipScene.js';
import { applyCommand, openings } from '../src/sim/builder.js';
import { pieceCells } from '../src/sim/styling.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const start = readyToLaunch().ship;
const skin = skins.yard;
const P = (type, x, y, rot = 0) => ({ type, x, y, rot });
// A spot on the start ship each standing piece fits (tests/styling.test.js
// has the ship's map).
const SPOTS = {
  sweptwing: P('sweptwing', 9, 3, 0),
  deltawing: P('deltawing', 12, 3, 0),
  tailfin: P('tailfin', 7, 3, 0),
  spoiler: P('spoiler', 12, 4, 0),
  antenna: P('antenna', 13, 4, 0),
  dish: P('dish', 12, 4, 0),
  floodlight: P('floodlight', 16, 5, 0),
  lightstrip: P('lightstrip', 15, 9, 2),
  armorplate: P('armorplate', 12, 4, 0),
};

function dress(ship, pieces) {
  for (const piece of pieces) {
    const result = applyCommand(ship, rules, { op: 'place', ...piece });
    assert.ok(result.ok, `${piece.type}: ${result.message}`);
    ship = result.ship;
  }
  return ship;
}

function scene(placement, ship = start) {
  const style = styleOf(rules, ship);
  const shape = hullShape(traceHull(ship, rules), style);
  return pieceScene({ def: rules.styling.get(placement.type), placement: { ...placement, uid: 99 }, shape, wallTop: style.profile[style.profile.length - 2][1] * HULL, skin });
}

test('every piece has a look of its own: a model outside (or the hull\'s shape) and an icon in the drawer', () => {
  for (const def of rules.styling.values()) {
    if (!def.shape) assert.ok(MODELED.includes(def.id), `${def.id} has a model`);
    const icon = pieceIconSvg(def, 20);
    assert.match(icon, /^<svg [^>]*viewBox="[-\d. ]+"/, def.id);
    assert.ok(icon.includes('<path'), `${def.id}'s icon draws something`);
  }
  assert.deepEqual(Object.keys(SPOTS).sort(), MODELED.slice().sort());
});

test('each standing piece sits on its cells against the hull, finite, the same every time', () => {
  for (const [id, placement] of Object.entries(SPOTS)) {
    const def = rules.styling.get(id);
    const { faces, glows } = scene(placement);
    assert.ok(faces.length >= 4, `${id} has faces`);
    const cells = pieceCells(def, placement);
    const [x0, y0] = [Math.min(...cells.map(([x]) => x)), Math.min(...cells.map(([, y]) => y))];
    const [x1, y1] = [Math.max(...cells.map(([x]) => x)) + 1, Math.max(...cells.map(([, y]) => y)) + 1];
    for (const { pts, normal } of faces) {
      assert.ok(normal.every(Number.isFinite), `${id}: a normal`);
      for (const [x, y, z] of pts) {
        assert.ok([x, y, z].every(Number.isFinite), `${id}: a point`);
        assert.ok(x >= x0 - 0.6 && x <= x1 + 0.6 && y >= y0 - 0.6 && y <= y1 + 0.6, `${id}: (${x}, ${y}) off its cells`);
        assert.ok(z >= -0.05 && z <= 2, `${id}: height ${z}`);
      }
    }
    for (const g of glows) assert.ok(g.at.every(Number.isFinite) && g.r > 0, `${id}: a glow`);
    assert.deepEqual(scene(placement), { faces, glows }, `${id}: the same each time`);
  }
});

test('wings sweep back on either side, red light to port and green to starboard', () => {
  for (const [placement, light] of [[P('sweptwing', 9, 3, 0), skin.port], [P('sweptwing', 9, 9, 4), skin.starboard]]) {
    const { faces, glows } = scene(placement);
    const top = faces.filter((f) => f.normal[2] > 0.9).flatMap((f) => f.pts);
    // The root runs along the hull, the tip is the end furthest from it.
    const away = (p) => Math.abs(p[1] - (placement.rot ? 9 : 5));
    const far = Math.max(...top.map(away));
    const root = top.filter((p) => away(p) < 0.7);
    const tip = top.filter((p) => away(p) > far - 0.15);
    assert.ok(Math.max(...tip.map(([x]) => x)) < Math.max(...root.map(([x]) => x)) - 0.8, `rot ${placement.rot}: the tip trails the root`);
    assert.ok(glows.some((g) => g.color === light), `rot ${placement.rot}: its light`);
  }
});

test('paint and trim color the hull, its plates and its stripe; a ship from before is in the yard\'s colors', () => {
  const painted = dress({ ...start, paint: 'rust', trim: 'amber' }, [SPOTS.sweptwing]);
  const colors = (ship) => new Set(exteriorScene({ ship, defs: rules, hull: traceHull(ship, rules), skin }).faces.map((f) => f.color));
  const used = colors(painted);
  for (const color of [paints.rust.hull, ...paints.rust.plates.slice(0, 2), trims.amber]) assert.ok(used.has(color), `uses ${color}`);
  assert.ok(!used.has(paints.slate.hull) && !used.has(trims.sky), 'and none of the yard\'s');
  const { paint: _, trim: __, ...before } = start;
  const yard = colors(before);
  assert.ok(yard.has(skin.hull) && yard.has(skin.livery));
  assert.equal(skin.hull, paints.slate.hull);
  assert.equal(skin.livery, trims.sky);
});

test('wedges and curves change the outline and get roof and deck; standing pieces show on the plans', () => {
  const sculpted = dress(start, [P('wedge', 7, 3, 0), P('curve', 15, 5, 0)]);
  const bare = traceHull(start, rules);
  const hull = traceHull(sculpted, rules);
  assert.equal(hull.sculpt.length, 2);
  assert.notDeepEqual(hull.edges, bare.edges);
  assert.ok(hull.edges.some(({ a, b }) => Math.min(a[1], b[1]) < 4), 'the stern rake rises above the engines');
  assert.ok(!hull.fairings.some((tri) => tri.some(([x, y]) => x === 16 && y === 5)), 'the curve takes the bow step\'s fairing\'s place');
  const outside = exteriorScene({ ship: sculpted, defs: rules, hull, skin });
  for (const { region } of hull.sculpt) {
    assert.ok(outside.faces.some((f) => f.pts.length === region.length && f.pts.every((p, i) => p[0] === region[i][0] && p[1] === region[i][1] && p[2] === HULL)), 'roofed over');
  }
  const dressed = dress(sculpted, [SPOTS.sweptwing, SPOTS.antenna]);
  const frame = rules.frames.get('starter');
  const plans = blueprintScene({ ship: dressed, defs: rules, frame, doors: openings(dressed, rules), hull: traceHull(dressed, rules), selected: null, lifted: null, flagged: new Set() }).model;
  assert.ok(plans.faces.some((f) => f.style === 'pieceFace') && plans.lines.some((l) => l.style === 'pieceEdge'), 'standing pieces in their own lines');
  assert.equal(plans.faces.filter((f) => f.style === 'deck').length, traceHull(dressed, rules).cells.length + traceHull(dressed, rules).pockets.length + traceHull(dressed, rules).fairings.length + 2, 'a deck under each shaped piece');
});
