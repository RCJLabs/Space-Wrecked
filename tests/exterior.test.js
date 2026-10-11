import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { skins } from '../src/render/palette.js';
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
  assert.deepEqual(scene(newShip('starter')), { faces: [], glows: [] });
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
