import assert from 'node:assert/strict';
import { test } from 'node:test';
import { next, seedFrom } from '../src/core/rng.js';
import { buildShip, newShip, removeModule } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { isCommand, LOG_LIMIT, logFor, logMatches, openBuild, renumbered, replay } from '../src/sim/replay.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const act = (session, action) => reduceSession(session, action, defs);
const last = (log, frame = 'starter') => replay(log, defs, frame).ships.at(-1);

test("a session's build log always replays to its ship, whatever the player does", () => {
  let state = seedFrom('replay property');
  const roll = (n) => {
    const r = next(state);
    state = r.state;
    return Math.floor(r.value * n);
  };
  const types = [...defs.modules.keys()];
  let s = createSession(newShip('starter'));
  for (let step = 0; step < 400; step++) {
    const pick = roll(9);
    const uid = s.ship.modules.length ? s.ship.modules[roll(s.ship.modules.length)].uid : null;
    const [x, y] = [roll(7) + 0.5, roll(4) + 0.5];
    if (pick <= 2) s = act(s, { type: 'build/drop', placement: { type: types[roll(types.length)], x: Math.floor(x), y: Math.floor(y), rot: roll(4) } });
    else if (pick === 3 && uid) s = act(act(s, { type: 'build/tap', x: s.ship.modules.find((m) => m.uid === uid).x + 0.5, y: s.ship.modules.find((m) => m.uid === uid).y + 0.5 }), { type: 'build/rotate' });
    else if (pick === 4 && uid) s = act(s, { type: 'build/move', uid, x: Math.floor(x), y: Math.floor(y) });
    else if (pick === 5 && uid) s = act(act(s, { type: 'build/tap', x: s.ship.modules.find((m) => m.uid === uid).x + 0.5, y: s.ship.modules.find((m) => m.uid === uid).y + 0.5 }), { type: 'build/delete' });
    else if (pick === 6) s = act(s, { type: 'build/undo' });
    else if (pick === 7) s = act(s, { type: 'build/redo' });
    else s = act(s, { type: 'build/cancel' });
    assert.ok(logMatches(s.log, s.ship, defs), `step ${step}: the log no longer replays to the ship`);
  }
  assert.ok(s.log.length > 20, 'the walk did some building');
});

test('undo takes the last command off the log and redo puts it back', () => {
  let s = createSession(newShip('starter'));
  s = act(s, { type: 'build/drop', placement: { type: 'corridor', x: 2, y: 1, rot: 0 } });
  s = act(s, { type: 'build/move', uid: 1, x: 3, y: 1 });
  assert.deepEqual(s.log, [{ op: 'place', uid: 1, type: 'corridor', x: 2, y: 1, rot: 0 }, { op: 'move', uid: 1, x: 3, y: 1, rot: 0 }]);
  const undone = act(s, { type: 'build/undo' });
  assert.deepEqual(undone.log, s.log.slice(0, 1));
  assert.deepEqual(act(undone, { type: 'build/redo' }).log, s.log);
  const branched = act(undone, { type: 'build/drop', placement: { type: 'airlock', x: 4, y: 2, rot: 0 } });
  assert.equal(branched.log.length, 2, 'a new change after an undo replaces what was undone');
  assert.equal(branched.log[1].type, 'airlock');
});

test('a session opened from a slot carries on its log; loading another replaces it', () => {
  const { ship } = buildShip(defs, 'starter', [{ type: 'corridor', x: 1, y: 1, rot: 0 }]);
  let s = createSession(ship, logFor(ship));
  s = act(s, { type: 'build/drop', placement: { type: 'airlock', x: 2, y: 1, rot: 0 } });
  assert.equal(s.log.length, 2);
  assert.equal(act(s, { type: 'build/undo' }).log.length, 1, 'undo stops at what was saved');
  assert.equal(act(act(act(s, { type: 'build/undo' }), { type: 'build/undo' }), { type: 'build/undo' }).log.length, 1);
  const other = newShip('starter');
  assert.deepEqual(act(s, { type: 'build/load', ship: other, log: [] }).log, []);
});

test('replay shows every step from the empty frame, and stops at a step that no longer works', () => {
  const log = [
    { op: 'place', uid: 1, type: 'reactor', x: 1, y: 0, rot: 0 },
    { op: 'place', uid: 2, type: 'corridor', x: 3, y: 1, rot: 0 },
    { op: 'move', uid: 2, x: 3, y: 2, rot: 0 },
    { op: 'remove', uid: 1 },
  ];
  const { ships, error } = replay(log, defs, 'starter');
  assert.equal(error, null);
  assert.deepEqual(ships.map((ship) => ship.modules.length), [0, 1, 2, 2, 1]);
  const broken = replay([log[0], { op: 'place', uid: 2, type: 'corridor', x: 2, y: 1, rot: 0 }], defs, 'starter');
  assert.equal(broken.ships.length, 2);
  assert.deepEqual(broken.error, { index: 1, message: 'Corridor would overlap Reactor at (1, 0).' });
});

test('a ship without a matching log gets one that builds it part by part', () => {
  const { ship } = buildShip(defs, 'starter', [{ type: 'corridor', x: 1, y: 1, rot: 0 }, { type: 'corridor', x: 2, y: 1, rot: 0 }, { type: 'airlock', x: 3, y: 1, rot: 0 }]);
  const gappy = removeModule(ship, 2);
  assert.equal(logMatches(logFor(gappy), gappy, defs), false, 'uids 1 and 3 can only come from a log with a removal');
  const tidy = renumbered(gappy);
  assert.deepEqual(tidy.modules.map((m) => m.uid), [1, 2]);
  assert.equal(tidy.nextUid, 3);
  assert.ok(logMatches(logFor(tidy), tidy, defs));
  assert.equal(renumbered(tidy), tidy, 'already in order: the same object');
});

test('opening a build keeps a good log, and rebuilds a bad or very long one without moving a part', () => {
  const { ship } = buildShip(defs, 'starter', [{ type: 'corridor', x: 1, y: 1, rot: 0 }, { type: 'airlock', x: 2, y: 1, rot: 0 }]);
  const good = logFor(ship);
  const kept = openBuild(ship, good, defs);
  assert.equal(kept.ship, ship);
  assert.equal(kept.log, good);
  const repaired = openBuild(ship, [{ op: 'remove', uid: 9 }], defs);
  assert.deepEqual(repaired.log, good);
  assert.deepEqual(openBuild(ship, null, defs).log, good, 'no log at all');
  let long = good;
  while (long.length <= LOG_LIMIT) long = [...long, { op: 'move', uid: 1, x: 1, y: 2, rot: 0 }, { op: 'move', uid: 1, x: 1, y: 1, rot: 0 }];
  assert.ok(logMatches(long, ship, defs));
  const short = openBuild(ship, long, defs);
  assert.deepEqual(short.log, good);
  assert.deepEqual(short.ship, ship);
  assert.deepEqual(last(short.log), ship);
});

test('commands are recognised by shape', () => {
  for (const ok of [{ op: 'place', uid: 1, type: 'corridor', x: 0, y: 0, rot: 0 }, { op: 'place', type: 'corridor', x: 1, y: 2, rot: 3 }, { op: 'move', uid: 2, x: 1, y: 1, rot: 1 }, { op: 'remove', uid: 4 }]) {
    assert.equal(isCommand(ok), true, JSON.stringify(ok));
  }
  for (const bad of [null, [], {}, { op: 'fly' }, { op: 'remove' }, { op: 'move', uid: 1, x: 1, y: 1, rot: 4 }, { op: 'place', type: '', x: 0, y: 0, rot: 0 }, { op: 'place', type: 'corridor', x: 0.5, y: 0, rot: 0 }]) {
    assert.equal(isCommand(bad), false, JSON.stringify(bad));
  }
});
