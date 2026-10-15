import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { skins } from '../src/render/palette.js';
import { paintSolid, prepareSolid } from '../src/render/painter.js';
import { placeFaces, shade, solidBox } from '../src/render/solid.js';
import { buildShip, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { readData } from '../tools/data.js';
import { readFileSync } from 'node:fs';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';

const defs = indexDefs(readData());
const script = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
const example = () => buildShip(defs, 'starter', script.placements).ship;
const scene = (ship) => exteriorScene({ ship, defs, hull: traceHull(ship, defs), skin: skins.yard });

test('an empty ship has nothing to show from outside', () => {
  assert.deepEqual(scene(newShip('starter')), { faces: [], glows: [], exhausts: [] });
});

test('every face is flat data with a unit normal and a skin colour', () => {
  const { faces } = scene(example());
  assert.ok(faces.length > 300);
  for (const face of faces) {
    assert.ok(face.pts.length >= 3 && face.pts.flat().every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
    assert.match(face.color, /^#[0-9a-f]{6}$/);
  }
});

test('every module type puts something on the roof', () => {
  for (const def of defs.modules.values()) {
    const { ship } = buildShip(defs, 'starter', [{ type: def.id, x: 1, y: 1, rot: 0 }]);
    const roof = scene(ship).faces.filter((f) => f.pts.every((p) => p[2] > HULL));
    assert.ok(roof.length > 0, def.id);
  }
});

test('engines glow at the stern, running lights show port and starboard', () => {
  const { faces, glows } = scene(example());
  const exhaust = glows.filter((g) => g.color === skins.yard.flame);
  assert.equal(exhaust.length, 4, "one per cell of each engine's exhaust");
  assert.ok(exhaust.every((g) => g.at[0] < 7), 'behind the stern');
  assert.equal(faces.filter((f) => f.emissive && f.color === skins.yard.flame).length, 4, 'a lit mouth on each nozzle');
  assert.deepEqual(glows.filter((g) => g.color === skins.yard.port || g.color === skins.yard.starboard).map((g) => g.color), [skins.yard.port, skins.yard.starboard]);
});

test('turned faces keep pointing out of their shape', () => {
  const def = { size: [2, 1] };
  const box = [];
  solidBox(box, [0.2, 0.1, 0], [1.8, 0.5, 0.3], '#445566');
  for (let rot = 0; rot < 4; rot++) {
    const placed = placeFaces(box, def, { x: 3, y: 1, rot });
    const all = placed.flatMap((f) => f.pts);
    const mid = [0, 1, 2].map((k) => all.reduce((a, p) => a + p[k], 0) / all.length);
    for (const face of placed) {
      const c = [0, 1, 2].map((k) => face.pts.reduce((a, p) => a + p[k], 0) / face.pts.length);
      const out = face.normal[0] * (c[0] - mid[0]) + face.normal[1] * (c[1] - mid[1]) + face.normal[2] * (c[2] - mid[2]);
      assert.ok(out > 0, `turned ${rot}`);
    }
  }
});

test('light falls on faces turned toward it; lit panels ignore it', () => {
  const up = shade({ normal: [0, 0, 1], color: '#808080' });
  const away = shade({ normal: [0.35, 0.55, -0.76], color: '#808080' });
  const level = (rgb) => Number(rgb.match(/\d+/)[0]);
  assert.ok(level(up) > level(away));
  assert.equal(shade({ normal: [0, 0, -1], color: '#a8e8ff', emissive: true }), 'rgb(168, 232, 255)');
});

test("a curved surface's pieces are drawn grown by half a pixel, not outlined, so no seam shows between them", () => {
  // A ctx that remembers what was drawn.
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
  const cam = { yaw: 0, pitch: Math.PI / 2, distance: 40, pivot: [0, 0], scale: 40, x: 100, y: 100 };
  const square = (x, edge) => ({ pts: [[x, 0, 0], [x + 1, 0, 0], [x + 1, 1, 0], [x, 1, 0]], normal: [0, 0, 1], color: '#445566', edge });
  const path = (from) => calls.slice(from).filter(([k]) => k === 'moveTo' || k === 'lineTo').map(([, x, y]) => [x, y]);
  paintSolid(ctx, prepareSolid([square(0, '#000000')], shade), [], cam);
  const plain = path(0);
  assert.equal(calls.filter(([k]) => k === 'stroke').length, 1, 'an edge is an outline');
  const from = calls.length;
  paintSolid(ctx, prepareSolid([square(0, 'fill')], shade), [], cam);
  const grown = path(from);
  assert.equal(calls.slice(from).filter(([k]) => k === 'stroke').length, 0, 'no outline');
  assert.equal(grown.length, 4);
  const box = (pts) => [0, 1].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const [[x0, x1], [y0, y1]] = box(plain);
  const [[gx0, gx1], [gy0, gy1]] = box(grown);
  for (const d of [x0 - gx0, gx1 - x1, y0 - gy0, gy1 - y1]) assert.ok(Math.abs(d - 0.5) < 1e-9, `out by ${d}`);
});

test("a maker's part wears its maker's fittings, mark and flame under the ship's paint; a Yard part, the yard's (M23g, M31)", async () => {
  const { readData: read } = await import('../tools/data.js');
  const marks = Object.fromEntries(read().manufacturers.manufacturers.map((m) => [m.id, m.mark]));
  assert.deepEqual(marks, { yard: undefined, bastion: 'chevrons', kestrel: 'stripes', scrapline: 'patches' });
  const ship = example();
  const yard = scene(ship);
  const colors = (s) => new Set(s.faces.map((f) => f.color));
  assert.ok(yard.exhausts.every((e) => e.flame === skins.yard.flame));
  for (const maker of ['bastion', 'kestrel', 'scrapline']) {
    const skin = skins[maker];
    const engines = { ...ship, modules: ship.modules.map((m) => (m.type === 'engine' ? { ...m, type: `${maker}-engine` } : m)) };
    const made = scene(engines);
    // Its mark and its fittings show only on its ship (chevrons and patches
    // in two colors, stripes in one); the hull's paint is the same on both.
    const own = [skin.mark, skin.dark, ...(marks[maker] === 'stripes' ? [] : [skin.markDark])];
    for (const color of own) assert.ok(colors(made).has(color) && !colors(yard).has(color), `${maker}: ${color}`);
    assert.ok(colors(made).has(skins.yard.hull) && colors(made).has(skins.yard.metal), "the hull and the Yard's parts keep their colors");
    // The engines' flames, at rest and lifting off, are the maker's.
    assert.ok(made.exhausts.length > 0 && made.exhausts.every((e) => e.flame === skin.flame), maker);
    assert.ok(made.glows.some((g) => g.color === skin.flame), maker);
    // Painted rust: the hull takes the paint, the maker's fittings stay its own.
    const rust = scene({ ...engines, paint: 'rust' });
    assert.ok(!colors(rust).has(skins.yard.hull) && colors(rust).has(skin.mark), maker);
    // A version's mark is the only thing it adds: the same shapes, a few faces more.
    assert.equal(made.exhausts.length, yard.exhausts.length);
    assert.ok(made.faces.length > yard.faces.length && made.faces.length < yard.faces.length + 40, `${maker}: ${made.faces.length - yard.faces.length} faces more`);
  }
  // Each maker's flames are its own.
  const flames = ['yard', 'bastion', 'kestrel', 'scrapline'].map((maker) => skins[maker].flame);
  assert.equal(new Set(flames).size, flames.length);
});
