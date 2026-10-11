import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceHull } from '../src/render/hull.js';
import { DRAWN, placeModel, propsModel } from '../src/render/props.js';
import { blueprintScene, ghostScene } from '../src/render/shipScene.js';
import { buildShip, doorStates, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { footprint } from '../src/sim/modules.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const at = (type, x, y, rot = 0) => ({ type, x, y, rot });
const SHAPED = { id: 'shaped', name: 'Shaped hull', width: 7, height: 4, maxModules: 20, minThrustToMass: 0.5, shape: ['.####..', '#######', '#######', '.####..'] };

function scene(ship, extra = {}, frame = defs.frames.get(ship.frame)) {
  return blueprintScene({ ship, defs, frame, doors: doorStates(ship, defs), hull: traceHull(ship, defs), selected: null, lifted: null, flagged: new Set(), ...extra });
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
  for (let i = 0; i < 4; i++) model = placeModel(model, i % 2 ? { ...def, size: [1, 2] } : def, { x: 0, y: 0, rot: 1 });
  assert.equal(JSON.stringify(model.faces[0].pts.map((p) => p.map((n) => Math.round(n * 1e9) / 1e9))), first);
});

test('joined doors are doorways; the rest are coloured panels that say why not', () => {
  const { ship } = buildShip(defs, 'starter', [at('corridor', 1, 0), at('corridor', 2, 0)]);
  const { model } = scene(ship);
  // Each corridor: a doorway splits the shared wall in two; three solid walls.
  assert.equal(count(model, 'lines', 'wallTop'), 10);
  assert.equal(count(model, 'faces', 'doorSealed'), 3, 'the north doors and the west one face space');
  assert.equal(count(model, 'faces', 'doorOpen'), 3, 'sockets facing free cells');
  assert.equal(count(model, 'faces', 'doorBlocked'), 0);
});

test('every free cell of the frame shows a slot', () => {
  const empty = scene(newShip('starter'), {}, SHAPED);
  assert.equal(count(empty.model, 'lines', 'slot'), 22);
  assert.equal(empty.model.faces.length, 0);
  const { ship } = buildShip(defs, 'starter', [at('reactor', 1, 0)]);
  assert.equal(count(scene(ship, {}, SHAPED).model, 'lines', 'slot'), 18);
});

test('the selection is outlined and named; a lifted part leaves only its outline', () => {
  const { ship } = buildShip(defs, 'starter', [at('reactor', 1, 0), at('corridor', 3, 0)]);
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
  const { ship } = buildShip(defs, 'starter', [at('bridge', 5, 1, 1), at('engine', 0, 1), at('airlock', 4, 1)]);
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
