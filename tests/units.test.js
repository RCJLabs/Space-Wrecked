import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palette } from '../src/render/palette.js';
import { crewColor, ordersScene, UNIT_TOP, unitsScene } from '../src/render/units.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { field, openMap, put, rules, wall } from './battleKit.js';

const figure = (extra = {}) => ({ side: 'crew', status: 'active', at: [2.5, 3.5], facing: [1, 0], trim: palette.crewA, ...extra });
const top = (faces) => Math.max(...faces.flatMap((f) => f.pts.map((p) => p[2])));
const colors = new Set(Object.values(palette));

test('a unit is solid faces with unit normals, in palette colours, standing on its point', () => {
  for (const unit of [figure(), figure({ side: 'enemy', trim: palette.enemyTrim, facing: [0, -1] }), figure({ status: 'down' }), figure({ status: 'dead' })]) {
    const { faces } = unitsScene([unit]);
    assert.ok(faces.length > 10);
    for (const face of faces) {
      assert.ok(face.pts.flat().every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
      assert.ok(colors.has(face.color), face.color);
    }
    const xs = faces.flatMap((f) => f.pts.map((p) => p[0]));
    assert.ok(Math.min(...xs) >= 2 && Math.max(...xs) <= 3, 'within its tile');
  }
});

test('standing, a unit is helmet-high and looks the way it faces; down, it lies on the deck', () => {
  const { faces } = unitsScene([figure({ facing: [0, 1] })]);
  assert.ok(Math.abs(top(faces) - UNIT_TOP) < 1e-9);
  const visor = faces.find((f) => f.color === palette.visor);
  assert.deepEqual(visor.normal, [0, 1, 0]);
  assert.ok(visor.pts.every((p) => p[1] > 3.5), 'on the side it faces');
  assert.ok(top(unitsScene([figure({ status: 'down' })]).faces) < 0.2);
  assert.ok(faces.some((f) => f.color === palette.crewA), 'trimmed in its own colour');
});

test('the dead and those out of the fight lie grey; a unit just hit flashes', () => {
  for (const status of ['dead', 'out']) assert.ok(unitsScene([figure({ status })]).faces.every((f) => f.color === palette.fallen));
  const hit = unitsScene([figure({ flash: true })]).faces;
  assert.ok(hit.filter((f) => f.color === palette.tracer).every((f) => f.emissive));
  assert.ok(hit.filter((f) => f.color === palette.tracer).length > 20);
});

test('each crew member has a trim of their own, round again after five', () => {
  const trims = [0, 1, 2, 3, 4].map(crewColor);
  assert.equal(new Set(trims).size, 5);
  assert.equal(crewColor(5), crewColor(0));
});

test('reach marks one tile each, blue for one action and amber for a dash', () => {
  const reach = new Map([['1,1', { x: 1, y: 1, dash: false }], ['2,1', { x: 2, y: 1, dash: true }]]);
  const { faces } = ordersScene({ reach });
  assert.deepEqual(faces.map((f) => f.color), [palette.reach, palette.dash]);
  for (const face of faces) {
    assert.ok(face.alpha > 0 && face.alpha < 1, 'the floor shows through');
    assert.ok(face.pts.every((p) => p[2] > 0 && p[2] < 0.05), 'just above the deck');
  }
});

test('rings under the selected unit and the enemies in sight, the one aimed at the boldest', () => {
  const { faces } = ordersScene({ selected: [1, 1], targets: [[4, 1], [5, 2]], aimed: [4, 1] });
  assert.equal(faces.filter((f) => f.color === palette.accent).length, 16);
  const red = faces.filter((f) => f.color === palette.target);
  assert.equal(red.length, 48);
  assert.equal(Math.max(...red.map((f) => f.alpha)), 1);
});

test('a move shown draws its path, where it stops, and the cover there', () => {
  // A wall to the north of (2, 1) and a crate to its east: full and half cover.
  const map = put(wall(openMap(5, 3), 2, 1, 'n'), 3, 1, 'half cover');
  const preview = { type: 'move', to: [2, 1], cost: 2, dash: false, path: [[0, 1], [1, 1], [2, 1]] };
  const { faces } = ordersScene({ preview, battle: field(map), rules });
  assert.equal(faces.filter((f) => f.color === palette.path).length, 2 + 16, 'two stretches and a ring');
  const panes = faces.filter((f) => f.color === palette.cover);
  assert.equal(panes.length, 4, 'two panes, two faces each');
  const heights = [...new Set(panes.map((f) => top([f])))].sort();
  assert.deepEqual(heights, [0.28, 0.5]);
  const opened = ordersScene({ preview, battle: field(wall(openMap(5, 3), 2, 1, 'n', 'door'), [edgeKey(2, 1, 'n')]), rules });
  assert.equal(opened.faces.filter((f) => f.color === palette.cover).length, 0, 'an open door is no cover');
});
