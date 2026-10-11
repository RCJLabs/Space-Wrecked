import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutProblems, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { cardFor } from '../src/ui/builder/card.js';
import { hintFor, layoutSummary } from '../src/ui/builder/hints.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const act = (session, action) => reduceSession(session, action, defs);
const start = () => createSession(newShip('starter'));

test('the hint follows what the player is doing', () => {
  let s = start();
  assert.match(hintFor(s, defs).text, /Drag a part onto the hull/);
  s = act(s, { type: 'build/arm', moduleType: 'reactor' });
  assert.equal(hintFor(s, defs).text, 'Tap the hull where the Reactor goes.');
  s = act(s, { type: 'build/tap', x: 1, y: 1 });
  assert.deepEqual(hintFor(s, defs), { tone: 'good', text: 'Tap the Reactor again to place it.' });
  s = act(act(s, { type: 'build/tap', x: 1, y: 1 }), { type: 'build/tap', x: 1.5, y: 1.5 });
  assert.equal(hintFor(s, defs).tone, 'bad', 'a preview over the placed reactor says why it is blocked');
  assert.match(hintFor(s, defs).text, /would overlap Reactor at \(0, 0\)/);
  s = act(act(s, { type: 'build/cancel' }), { type: 'build/tap', x: 0.5, y: 0.5 });
  assert.equal(hintFor(s, defs).text, 'Reactor: drag to move it, or Turn or Delete.');
  const drag = { kind: 'part', type: 'corridor', placement: null };
  assert.equal(hintFor(s, defs, drag).text, 'Let go off the hull to cancel.');
  assert.equal(hintFor(s, defs, { ...drag, placement: { x: 3, y: 0 } }).text, 'Let go to place the Corridor here.');
  assert.equal(hintFor(s, defs, { ...drag, kind: 'module', placement: { x: 3, y: 0 } }).text, 'Let go to move the Corridor here.');
});

test('the layout chip counts parts and names the first problem', () => {
  const empty = newShip('starter');
  assert.equal(layoutSummary(empty, defs, layoutProblems(empty, defs)), null);
  let s = act(start(), { type: 'build/drop', placement: { type: 'corridor', x: 0, y: 0, rot: 0 } });
  assert.deepEqual(layoutSummary(s.ship, defs, layoutProblems(s.ship, defs)), {
    tone: 'bad',
    text: '1/20 parts · No bridge yet (+1 more)',
  });
  s = act(s, { type: 'build/drop', placement: { type: 'bridge', x: 1, y: 0, rot: 0 } });
  s = act(s, { type: 'build/drop', placement: { type: 'airlock', x: 3, y: 0, rot: 0 } });
  assert.deepEqual(layoutSummary(s.ship, defs, layoutProblems(s.ship, defs)), { tone: 'good', text: '3/20 parts · Layout OK' });
});

test('the details card lists size, doors, stats and where a placed part sits', () => {
  const reactor = defs.modules.get('reactor');
  assert.deepEqual(cardFor(defs, reactor), {
    title: 'Reactor',
    lines: ['2×2 cells · 2 doors · turns', 'Power +8 · Mass 6 · Hull points 30', 'Cost 200 · Yard standard'],
  });
  const engine = defs.modules.get('engine');
  const placed = cardFor(defs, engine, { module: { uid: 4, type: 'engine', x: 0, y: 2, rot: 0 }, joined: false });
  assert.deepEqual(placed.lines, [
    "2×1 cells · 1 door · doesn't turn",
    'Power −1 · Thrust 12 · Mass 3 · Hull points 15',
    'Cost 150 · Yard standard',
    'At (0, 2) · not joined to the bridge',
  ]);
  const quarters = cardFor(defs, defs.modules.get('quarters'), { module: { uid: 1, type: 'quarters', x: 4, y: 0, rot: 1 }, joined: null });
  assert.equal(quarters.lines[0], '1×2 cells · 4 doors · turns', 'size as placed');
  assert.equal(quarters.lines.at(-1), 'At (4, 0) · no bridge yet');
});
