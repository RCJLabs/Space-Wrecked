import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palette } from '../src/render/palette.js';
import { colorsOf, crewColor, ordersScene, unitsScene } from '../src/render/units.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { field, openMap, put, rules, wall } from './battleKit.js';

const marine = rules.jobs.get('marine');
const figure = (extra = {}) => ({ id: 'c1', side: 'crew', status: 'active', at: [2.5, 3.5], facing: [1, 0], trim: palette.crewA, look: marine.look, held: rules.weapons.get('rifle').held, pose: {}, ...extra });
const colors = new Set(Object.values(palette));
const top = (faces) => Math.max(...faces.flatMap((f) => f.pts.map((p) => p[2])));

test('units are figures to draw: their look, weapon, colours and pose, standing where they stand', () => {
  const unit = figure({ pose: { aim: 1 } });
  const { figures } = unitsScene([unit, figure({ id: 'e1', side: 'enemy', trim: palette.enemyTrim })]);
  assert.equal(figures.length, 2);
  const [crew, enemy] = figures;
  assert.deepEqual([crew.id, crew.at, crew.facing, crew.look, crew.held, crew.pose], [unit.id, unit.at, unit.facing, unit.look, unit.held, { aim: 1 }]);
  assert.ok(Object.values(crew.colors).every((c) => colors.has(c)), 'palette colours only');
  assert.equal(crew.colors.trim, palette.crewA);
  assert.equal(crew.colors.suit, palette.crewSuit);
  assert.equal(enemy.colors.suit, palette.enemySuit);
  assert.equal(enemy.colors.visor, palette.enemyVisor);
  assert.notEqual(crew.key, enemy.key, 'drawn apart');
  assert.equal(unitsScene([figure()]).figures[0].key, unitsScene([figure({ at: [9.5, 1.5], pose: { aim: 1 } })]).figures[0].key, 'one look, one key wherever it stands');
});

test('down, stable, out or dead, a unit lies on the deck; out or dead, in grey', () => {
  for (const status of ['down', 'stable', 'out', 'dead']) {
    const [lying] = unitsScene([figure({ status, pose: { aim: 1 } })]).figures;
    assert.deepEqual(lying.pose, { fall: 1 });
    const gone = status === 'out' || status === 'dead';
    assert.equal(lying.colors.suit, gone ? palette.fallen : palette.crewSuit);
    if (gone) assert.ok(Object.values(colorsOf('crew', status, palette.crewA)).every((c) => [palette.fallen, palette.fallenTrim, palette.fallenDark, palette.figureEdge].includes(c)));
  }
});

test('a unit just hit flashes in the tracer colour', () => {
  const [hit] = unitsScene([figure({ flash: true })]).figures;
  assert.equal(hit.colors.suit, palette.tracer);
  assert.equal(hit.colors.trim, palette.tracer);
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
