import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { footprint } from '../src/sim/modules.js';
import { commandsOf, covers, createSession, HISTORY_LIMIT, reduceSession, snapPlacement } from '../src/sim/session.js';

// A small catalog, so content changes don't break these interaction rules.
const ALL_SIDES = ['n', 'e', 's', 'w'].map((side) => ({ side, at: 0 }));
const mod = (id, size, rotates = true) => ({ id, name: id[0].toUpperCase() + id.slice(1), size, rotates, doors: ALL_SIDES, tags: [] });
const defs = indexDefs({
  modules: {
    tilesPerCell: 2,
    tiles: { '.': 'floor' },
    modules: [mod('hall', [1, 1]), mod('long', [2, 1]), mod('big', [2, 2]), mod('fixed', [2, 1], false)],
  },
  frames: { frames: [{ id: 'yard', name: 'Yard frame', width: 6, height: 4, maxModules: 10 }] },
  manufacturers: { manufacturers: [] },
});
const frame = defs.frames.get('yard');

const start = () => createSession(newShip('yard'));
const act = (session, action) => reduceSession(session, action, defs);
const arm = (s, moduleType) => act(s, { type: 'build/arm', moduleType });
const tap = (s, x, y) => act(s, { type: 'build/tap', x, y });
const drop = (s, type, x, y, rot = 0) => act(s, { type: 'build/drop', placement: { type, x, y, rot } });
const modules = (s) => s.ship.modules.map(({ uid, type, x, y, rot }) => [uid, type, x, y, rot]);

test('an armed part previews where the hull is tapped, and only a tap on the preview places it', () => {
  let s = arm(start(), 'long');
  assert.deepEqual(s.armed, { type: 'long', rot: 0 });
  s = tap(s, 2.2, 1.5);
  assert.deepEqual(s.ghost, { type: 'long', x: 1, y: 1, rot: 0 }, 'centered on the tap');
  assert.deepEqual(modules(s), [], 'the first tap places nothing');
  s = tap(s, 4.5, 2.5);
  assert.deepEqual(s.ghost, { type: 'long', x: 4, y: 2, rot: 0 }, 'a tap elsewhere moves the preview');
  assert.deepEqual(modules(s), []);
  s = tap(s, 5.9, 2.1);
  assert.deepEqual(modules(s), [[1, 'long', 4, 2, 0]], 'a tap on the preview places it');
  assert.equal(s.ghost, null);
  assert.deepEqual(s.armed, { type: 'long', rot: 0 }, 'still armed for the next one');
  assert.deepEqual([s.notice.tone, s.notice.text], ['good', 'Placed Long.']);
});

test('a preview always covers the cell that was tapped', () => {
  for (const type of ['hall', 'long', 'big']) {
    for (let rot = 0; rot < 4; rot++) {
      for (let px = 0.05; px < frame.width; px += 0.3) {
        for (let py = 0.05; py < frame.height; py += 0.3) {
          const placement = snapPlacement(defs, frame, type, rot, px, py);
          assert.ok(covers(defs, placement, Math.floor(px), Math.floor(py)), `${type} rot ${rot} at ${px}, ${py}`);
          const [w, h] = footprint(defs.modules.get(type), rot);
          assert.ok(placement.x >= 0 && placement.y >= 0 && placement.x + w <= frame.width && placement.y + h <= frame.height);
        }
      }
    }
  }
});

test('a tap within a cell of the hull slides the preview inside; farther out it clears it', () => {
  let s = tap(arm(start(), 'hall'), -0.5, 1.2);
  assert.deepEqual(s.ghost, { type: 'hall', x: 0, y: 1, rot: 0 });
  s = tap(s, -1.5, 1.2);
  assert.equal(s.ghost, null);
  assert.deepEqual(s.armed, { type: 'hall', rot: 0 }, 'still armed');
  assert.equal(tap(s, 9, 9), s, 'a far tap with no preview changes nothing');
});

test('taps select placed parts; while armed, taps only move the preview', () => {
  let s = drop(start(), 'hall', 0, 0);
  s = tap(s, 3.5, 3.5);
  assert.equal(s.selected, null, 'empty hull clears the selection');
  s = tap(s, 0.5, 0.5);
  assert.equal(s.selected, 1);
  assert.equal(tap(s, 0.2, 0.7), s, 'tapping the selected part again changes nothing');
  s = arm(s, 'hall');
  assert.equal(s.selected, null, 'arming clears the selection');
  s = tap(s, 0.5, 0.5);
  assert.deepEqual(s.ghost, { type: 'hall', x: 0, y: 0, rot: 0 }, 'a tap on a part previews there instead of selecting');
  assert.equal(s.selected, null);
  s = tap(s, 0.5, 0.5);
  assert.deepEqual(modules(s), [[1, 'hall', 0, 0, 0]], 'a blocked preview places nothing');
  assert.equal(s.notice.tone, 'bad');
  assert.match(s.notice.text, /overlap Hall at \(0, 0\)/);
});

test('a drop places at once and selects the part; a drop that can\'t fit stays as a preview', () => {
  let s = drop(start(), 'big', 0, 0);
  assert.deepEqual(modules(s), [[1, 'big', 0, 0, 0]]);
  assert.equal(s.selected, 1);
  assert.equal(s.armed, null);
  s = drop(s, 'hall', 1, 1);
  assert.deepEqual(modules(s), [[1, 'big', 0, 0, 0]], 'nothing placed');
  assert.deepEqual(s.ghost, { type: 'hall', x: 1, y: 1, rot: 0 });
  assert.deepEqual(s.armed, { type: 'hall', rot: 0 }, 'armed, so a tap can move it and a second tap place it');
  assert.equal(s.notice.tone, 'bad');
  s = tap(tap(s, 3.5, 0.5), 3.5, 0.5);
  assert.deepEqual(modules(s), [[1, 'big', 0, 0, 0], [2, 'hall', 3, 0, 0]]);
});

test('turning: a preview turns in place, a part turns four times back home, a blocked turn says why', () => {
  let s = tap(arm(start(), 'long'), 2.6, 1.5); // preview at (2, 1)
  s = act(s, { type: 'build/rotate' });
  assert.deepEqual(s.armed, { type: 'long', rot: 1 });
  assert.deepEqual(s.ghost, { type: 'long', x: 2, y: 1, rot: 1 });

  s = drop(start(), 'long', 2, 1);
  for (let i = 0; i < 4; i++) s = act(s, { type: 'build/rotate' });
  assert.deepEqual(modules(s), [[1, 'long', 2, 1, 0]]);
  assert.equal(s.past.length, 5, 'one place and four turns');
  assert.equal(s.past.at(-1).label, 'turn Long');

  s = drop(s, 'hall', 2, 2);
  s = act(tap(s, 2.5, 1.5), { type: 'build/rotate' });
  assert.deepEqual(modules(s), [[1, 'long', 2, 1, 0], [2, 'hall', 2, 2, 0]], 'blocked by the hall below');
  assert.equal(s.notice.tone, 'bad');

  s = act(arm(s, 'fixed'), { type: 'build/rotate' });
  assert.deepEqual(s.armed, { type: 'fixed', rot: 0 });
  assert.match(s.notice.text, /can't be rotated/);
});

test('moving keeps the uid and build order; a blocked move changes nothing', () => {
  let s = drop(drop(start(), 'hall', 0, 0), 'long', 2, 0);
  s = act(s, { type: 'build/move', uid: 1, x: 5, y: 3 });
  assert.deepEqual(modules(s), [[1, 'hall', 5, 3, 0], [2, 'long', 2, 0, 0]]);
  assert.equal(s.selected, 1);
  const blocked = act(s, { type: 'build/move', uid: 1, x: 3, y: 0 });
  assert.deepEqual(modules(blocked), modules(s));
  assert.equal(blocked.past.length, s.past.length);
  assert.equal(blocked.notice.tone, 'bad');
  assert.equal(act(s, { type: 'build/move', uid: 1, x: 5, y: 3 }), s, 'moving onto itself changes nothing');
});

test('delete removes the selected part; Done stops placing', () => {
  let s = act(drop(start(), 'long', 0, 0), { type: 'build/delete' });
  assert.deepEqual(modules(s), []);
  assert.equal(s.selected, null);
  assert.equal(s.notice.text, 'Removed Long.');
  s = act(tap(arm(s, 'hall'), 1.5, 1.5), { type: 'build/cancel' });
  assert.equal(s.armed, null);
  assert.equal(s.ghost, null);
  assert.equal(arm(arm(s, 'hall'), 'hall').armed, null, 'picking the armed part again also stops');
});

test('undo and redo walk the history and select what changed; a new change clears redo', () => {
  let s = drop(drop(start(), 'hall', 0, 0), 'hall', 1, 0);
  s = act(s, { type: 'build/move', uid: 2, x: 4, y: 3 });
  s = act(s, { type: 'build/undo' });
  assert.deepEqual(modules(s), [[1, 'hall', 0, 0, 0], [2, 'hall', 1, 0, 0]]);
  assert.equal(s.selected, 2);
  assert.equal(s.notice.text, 'Undone: move Hall.');
  s = act(s, { type: 'build/undo' });
  assert.deepEqual(modules(s), [[1, 'hall', 0, 0, 0]]);
  assert.equal(s.selected, null, 'the undone part is gone');
  s = act(s, { type: 'build/redo' });
  assert.deepEqual(modules(s), [[1, 'hall', 0, 0, 0], [2, 'hall', 1, 0, 0]]);
  assert.equal(s.selected, 2);
  assert.equal(s.future.length, 1);
  s = drop(s, 'hall', 5, 0);
  assert.equal(s.future.length, 0);
  assert.equal(act(s, { type: 'build/redo' }), s);
});

test('undo keeps the last HISTORY_LIMIT steps', () => {
  let s = drop(start(), 'hall', 0, 0);
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) s = act(s, { type: 'build/move', uid: 1, x: (i + 1) % 2, y: 0 });
  assert.equal(s.past.length, HISTORY_LIMIT);
});

test('replaying the recorded commands rebuilds the same ship', () => {
  let s = drop(drop(start(), 'big', 0, 0), 'long', 2, 0);
  s = tap(tap(arm(s, 'hall'), 4.5, 0.5), 4.5, 0.5);
  s = act(act(s, { type: 'build/cancel' }), { type: 'build/tap', x: 2.5, y: 0.5 });
  s = act(s, { type: 'build/rotate' });
  s = act(tap(s, 0.5, 0.5), { type: 'build/delete' });
  s = act(s, { type: 'build/undo' });
  let ship = newShip('yard');
  for (const command of commandsOf(s)) {
    const result = applyCommand(ship, defs, command);
    assert.ok(result.ok, JSON.stringify(command));
    ship = result.ship;
  }
  assert.deepEqual(ship, s.ship);
});

test('actions that change nothing return the same session', () => {
  const s = start();
  for (const action of [
    { type: 'build/undo' },
    { type: 'build/redo' },
    { type: 'build/cancel' },
    { type: 'build/rotate' },
    { type: 'build/delete' },
    { type: 'build/tap', x: 2, y: 2 },
    { type: 'build/arm', moduleType: 'nope' },
    { type: 'build/move', uid: 9, x: 0, y: 0 },
    { type: 'something/else' },
  ]) {
    assert.equal(act(s, action), s, action.type);
  }
});
