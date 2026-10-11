import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceHull } from '../src/render/hull.js';
import { DRAWN, placeModel, propsModel } from '../src/render/props.js';
import { blueprintScene, ghostScene, gridModel, MAJOR } from '../src/render/shipScene.js';
import { buildShip, newShip, openings } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { footprint } from '../src/sim/modules.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const at = (type, x, y, rot = 0) => ({ type, x, y, rot });
function scene(ship, extra = {}, frame = defs.frames.get(ship.frame)) {
  return blueprintScene({ ship, defs, frame, doors: openings(ship, defs), hull: traceHull(ship, defs), selected: null, lifted: null, flagged: new Set(), ...extra });
}
const count = (model, kind, style) => model[kind].filter((p) => p.style === style).length;

test('every module type has fittings, drawn for it or made from its interior', () => {
  for (const def of defs.modules.values()) {
    const model = propsModel(def);
    assert.ok(model.faces.length + model.lines.length > 0, def.id);
    assert.ok(DRAWN.includes(def.id), `${def.id} has a drawing of its own`);
  }
  const made = { ...defs.modules.get('armory'), id: 'galley', interior: ['#c', 'hH'] };
  assert.ok(propsModel(made).faces.length > 0, 'a new type draws from its template');
});

test('fittings stay inside the footprint, however the part is turned', () => {
  for (const def of defs.modules.values()) {
    if (def.id === 'weapon') continue; // the barrels reach the cell edge exactly
    for (let rot = 0; rot < (def.rotates ? 4 : 1); rot++) {
      const placement = { x: 2, y: 1, rot };
      const [w, h] = footprint(def, rot);
      const placed = placeModel(propsModel(def), def, placement);
      for (const { pts } of [...placed.faces, ...placed.lines]) {
        for (const [x, y] of pts) assert.ok(x >= 2 - 1e-9 && x <= 2 + w + 1e-9 && y >= 1 - 1e-9 && y <= 1 + h + 1e-9, `${def.id} turned ${rot}: (${x}, ${y})`);
      }
    }
  }
});

test('four quarter turns bring a fitting back where it started', () => {
  const def = defs.modules.get('quarters');
  let model = propsModel(def);
  const first = JSON.stringify(model.faces[0].pts);
  for (let i = 0; i < 4; i++) model = placeModel(model, i % 2 ? { ...def, size: [def.size[1], def.size[0]] } : def, { x: 0, y: 0, rot: 1 });
  assert.equal(JSON.stringify(model.faces[0].pts.map((p) => p.map((n) => Math.round(n * 1e9) / 1e9))), first);
});

test('rooms that share a wall have a doorway; corridors side by side are open', () => {
  // Two corridors: no wall between them, three walls each, no doorways.
  const run = scene(buildShip(defs, 'starter', [at('corridor', 1, 0), at('corridor', 2, 0)]).ship).model;
  assert.equal(count(run, 'lines', 'wallTop'), 6);
  assert.equal(count(run, 'lines', 'wallPost'), 0);
  // A corridor beside the quarters: one doorway, a post either side of it in
  // each room's wall.
  const room = scene(buildShip(defs, 'starter', [at('corridor', 1, 0), at('quarters', 2, 0)]).ship).model;
  assert.equal(count(room, 'lines', 'wallPost'), 4);
  assert.equal(count(room, 'lines', 'wallTop'), 3 + 2 + 3 + 2, 'the shared walls are split by the doorway');
  // An airlock's hatch to space is a doorway in its outside wall.
  const lock = scene(buildShip(defs, 'starter', [at('airlock', 1, 1)]).ship).model;
  assert.equal(count(lock, 'lines', 'wallPost'), 4 * 2, 'four hatches, two posts each');
});

test('the grid has a line every cell, heavier every few, and the edge of the build area', () => {
  const frame = defs.frames.get('starter');
  const grid = gridModel(frame, 2);
  const across = frame.width + 5;
  const down = frame.height + 5;
  assert.equal(count(grid, 'lines', 'gridMinor') + count(grid, 'lines', 'gridMajor'), across + down);
  assert.equal(count(grid, 'lines', 'gridMajor'), [...Array(across)].filter((_, i) => (i - 2) % MAJOR === 0).length + [...Array(down)].filter((_, i) => (i - 2) % MAJOR === 0).length);
  assert.equal(count(grid, 'lines', 'yardEdge'), 1);
  const empty = scene(newShip('starter'));
  assert.equal(empty.model.faces.length + empty.model.lines.length, 0, 'an empty yard has no ship to draw');
});

test('the selection is outlined and named; a lifted part leaves only its outline', () => {
  const { ship } = buildShip(defs, 'starter', [at('reactor', 1, 0), at('corridor', 4, 0)]);
  const picked = scene(ship, { selected: 1 });
  assert.deepEqual(picked.labels.map((l) => [l.text, l.tone]), [['Reactor', 'info']]);
  assert.ok(count(picked.model, 'lines', 'selectEdge') >= 2);
  const lifted = scene(ship, { lifted: 1 });
  assert.equal(count(lifted.model, 'lines', 'liftedEdge'), 1);
  assert.equal(count(lifted.model, 'lines', 'coreEdge'), 0, "the reactor's core isn't drawn while it's lifted");
  const flagged = scene(ship, { flagged: new Set([2]) });
  assert.equal(count(flagged.model, 'lines', 'flagEdge'), 1);
});

test('a part being placed floats in green, or red with what blocks it', () => {
  const { ship } = buildShip(defs, 'starter', [at('reactor', 1, 0)]);
  const good = ghostScene({ ship, defs, ghost: { placement: at('corridor', 4, 1), ok: true } });
  assert.deepEqual([good.label.text, good.label.tone], ['Corridor', 'good']);
  assert.ok(good.model.lines.every((l) => l.style.startsWith('ghost')));
  assert.equal(count(good.model, 'lines', 'ghostDrop'), 4);
  const bad = ghostScene({ ship, defs, ghost: { placement: at('corridor', 1, 0), ok: false, blockers: [1] } });
  assert.equal(bad.label.tone, 'bad');
  assert.equal(count(bad.model, 'faces', 'blockFace'), 1);
  assert.ok(bad.model.lines.some((l) => l.style === 'ghostBadLine'));
});

test('building a scene changes nothing it was given', () => {
  const { ship } = buildShip(defs, 'starter', [at('bridge', 5, 1, 1), at('engine', 0, 1), at('airlock', 3, 1)]);
  const copy = structuredClone(ship);
  scene(ship, { selected: 1 });
  assert.deepEqual(ship, copy);
});

test('every part has a blueprint icon for the drawer, new types included', async () => {
  const { DRAWN: drawnIcons, partIconSvg } = await import('../src/render/parts/blueprint.js');
  const closesEveryTag = (svg) => (svg.match(/<[a-z]+[^>]*[^/]>/g) ?? []).length === (svg.match(/<\/[a-z]+>/g) ?? []).length;
  for (const def of defs.modules.values()) {
    const svg = partIconSvg(def);
    assert.ok(drawnIcons.includes(def.id), def.id);
    assert.match(svg, /^<svg aria-hidden="true" xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(closesEveryTag(svg), def.id);
  }
  const made = { ...defs.modules.get('armory'), id: 'galley', interior: ['#c', 'hH'] };
  const svg = partIconSvg(made);
  assert.ok(svg.includes('<rect') && closesEveryTag(svg), 'drawn from its interior template');
});
