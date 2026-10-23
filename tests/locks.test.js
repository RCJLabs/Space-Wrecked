// M45: doors as tactics. Closing a door, locking one, the crew opening its
// own lock, the other side forcing it with a whole turn and the door left
// broken open, and the AI and those pressing on forcing the locks in their
// way, so no fight waits at a locked door.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction } from '../src/sim/ai.js';
import { act, createBattle, targetsFor } from '../src/sim/battle.js';
import { forceAction } from '../src/sim/locks.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { reachable } from '../src/sim/moves.js';
import { pressAction } from '../src/sim/press.js';
import { canSee } from '../src/sim/sight.js';
import { openMap, rules, wall } from './battleKit.js';

const b = rules.balance;
const who = (battle, id) => battle.units.find((u) => u.id === id);
// A corridor of six tiles with a door between (2, 0) and (3, 0): the
// crew's marine beside it on the east, a pirate down the far end.
const door = edgeKey(2, 0, 'e');
const start = (units = [{ kind: 'marine', x: 3, y: 0 }, { kind: 'pirate', x: 0, y: 0 }]) => createBattle({ map: wall(openMap(6, 1), 2, 0, 'e', 'door'), units, seed: 7 }, rules).battle;

function play(battle, ...actions) {
  const events = [];
  for (const action of actions) {
    const result = act(battle, action, rules);
    assert.ok(result.ok, `${JSON.stringify(action)}: ${result.error}`);
    battle = result.battle;
    events.push(...result.events);
  }
  return { battle, events };
}
const refused = (battle, action) => act(battle, action, rules).error;

test('a door beside a unit closes for one action, and a walk through opens it again', () => {
  let { battle } = play(start(), { type: 'open', unit: 'c1', side: 'w' });
  assert.ok(battle.doors.includes(door));
  assert.match(refused(start(), { type: 'close', unit: 'c1', side: 'w' }), /shut already/);
  const closed = play(battle, { type: 'close', unit: 'c1', side: 'w' });
  assert.deepEqual(closed.events[0], { type: 'close', unit: 'c1', at: [3, 0], side: 'w' });
  assert.equal(who(closed.battle, 'c1').ap, 0, 'open and close: both actions');
  assert.ok(!closed.battle.doors.includes(door));
  assert.ok(!canSee(closed.battle, [3, 0], [0, 0], rules), 'a closed door blocks sight');
  // Next turn (both actions spent, the crew's ended), a walk through
  // opens it as any closed door.
  battle = play(closed.battle, { type: 'end' }).battle;
  assert.equal(battle.side, 'crew');
  assert.ok(reachable(battle, who(battle, 'c1'), 2, rules).has('1,0'), 'a closed door is no bar to a walk');
  assert.match(refused(start(), { type: 'close', unit: 'c1', side: 'e' }), /no door on that side/);
});

test('a lock shuts the door; no one walks or sees through it, and the crew opens its own', () => {
  const opened = play(start(), { type: 'open', unit: 'c1', side: 'w' }).battle;
  const { battle, events } = play(opened, { type: 'lock', unit: 'c1', side: 'w' });
  assert.deepEqual(events[0], { type: 'lock', unit: 'c1', at: [3, 0], side: 'w' });
  assert.deepEqual(battle.locks, [{ key: door, side: 'crew' }]);
  assert.ok(!battle.doors.includes(door), 'locking an open door shuts it');
  assert.ok(!canSee(battle, [3, 0], [0, 0], rules));
  assert.equal(targetsFor(battle, who(battle, 'c1'), rules).length, 0);
  assert.equal(battle.side, 'enemy', "open and lock: the crew's turn is spent");
  const next = play(battle, { type: 'end' }).battle;
  assert.ok(!reachable(next, who(next, 'c1'), 4, rules).has('2,0'), 'no walk through a lock');
  assert.match(refused(next, { type: 'lock', unit: 'c1', side: 'w' }), /locked already/);
  const unlocked = play(next, { type: 'open', unit: 'c1', side: 'w' });
  assert.deepEqual(unlocked.events, [{ type: 'unlock', unit: 'c1', at: [3, 0], side: 'w' }]);
  assert.deepEqual([unlocked.battle.locks, unlocked.battle.doors.includes(door), who(unlocked.battle, 'c1').ap], [[], true, b.actionPoints - 1]);
});

test('the other side forces a lock with a whole turn, and the door stays broken open', () => {
  // The pirate beside the door on the west, the marine locks it.
  let battle = play(start([{ kind: 'marine', x: 3, y: 0 }, { kind: 'pirate', x: 2, y: 0 }]), { type: 'lock', unit: 'c1', side: 'w' }, { type: 'end' }).battle;
  assert.match(refused(battle, { type: 'open', unit: 'e1', side: 'e' }), /locked: forcing it takes a whole turn/);
  assert.match(refused(battle, { type: 'force', unit: 'c1', side: 'w' }), /isn't the crew's turn/i);
  const moved = { ...battle, units: battle.units.map((u) => (u.id === 'e1' ? { ...u, ap: 1 } : u)) };
  assert.match(refused(moved, { type: 'force', unit: 'e1', side: 'e' }), /whole turn/);
  const { battle: forced, events } = play(battle, { type: 'force', unit: 'e1', side: 'e' });
  assert.deepEqual(events.slice(0, 1), [{ type: 'force', unit: 'e1', at: [2, 0], side: 'e' }]);
  assert.deepEqual([forced.locks, forced.broken, forced.doors.includes(door)], [[], [door], true]);
  battle = forced.side === 'crew' ? forced : play(forced, { type: 'end' }).battle;
  assert.match(refused(battle, { type: 'close', unit: 'c1', side: 'w' }), /forced: it stays open/);
  assert.match(refused(battle, { type: 'lock', unit: 'c1', side: 'w' }), /forced: it stays open/);
  assert.match(refused(battle, { type: 'force', unit: 'c1', side: 'w' }), /forced/);
});

test("the crew can't force its own lock, and a welded door can't be locked or forced", () => {
  const locked = play(start(), { type: 'lock', unit: 'c1', side: 'w' }).battle;
  assert.match(refused(locked, { type: 'force', unit: 'c1', side: 'w' }), /side locked it: Open door unlocks it/);
  const welded = { ...start(), welds: [{ key: door, until: 3 }] };
  assert.match(refused(welded, { type: 'lock', unit: 'c1', side: 'w' }), /welded shut/);
  const both = { ...locked, side: 'enemy', welds: [{ key: door, until: 3 }], units: locked.units.map((u) => (u.id === 'e1' ? { ...u, x: 2, ap: b.actionPoints } : u)) };
  assert.match(refused(both, { type: 'force', unit: 'e1', side: 'e' }), /welded shut/);
  assert.equal(forceAction(both, who(both, 'e1'), rules), null);
});

test('the AI and those pressing on walk up to a lock in their way and force it', () => {
  for (const player of [pressAction, aiAction]) {
    let battle = play(start(), { type: 'lock', unit: 'c1', side: 'w' }, { type: 'end' }).battle;
    let forced = false;
    for (let i = 0; i < 12 && !forced && !battle.winner; i++) {
      const action = battle.side === 'enemy' ? player(battle, rules) : { type: 'end' };
      const result = act(battle, action, rules);
      assert.ok(result.ok, `${player.name}: ${JSON.stringify(action)}: ${result.error}`);
      battle = result.battle;
      forced = result.events.some((e) => e.type === 'force');
    }
    assert.ok(forced, `${player.name} forces the lock`);
    assert.deepEqual(battle.broken, [door]);
  }
});

test('no one forces a lock that leads nowhere nearer, or with part of its turn spent', () => {
  // The pirate beside the door, the crew on its own side of it.
  const battle = { ...start([{ kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 2, y: 0 }]), side: 'enemy', locks: [{ key: door, side: 'crew' }] };
  battle.units = battle.units.map((u) => (u.id === 'e1' ? { ...u, ap: b.actionPoints } : u));
  assert.equal(forceAction(battle, who(battle, 'e1'), rules), null);
  const across = { ...battle, units: battle.units.map((u) => (u.id === 'c1' ? { ...u, x: 4 } : u)) };
  assert.deepEqual(forceAction(across, who(across, 'e1'), rules), { type: 'force', unit: 'e1', side: 'e' });
  const spent = { ...across, units: across.units.map((u) => (u.id === 'e1' ? { ...u, ap: 1 } : u)) };
  assert.equal(forceAction(spent, who(spent, 'e1'), rules), null);
});

test('the log tells each door event in words', async () => {
  const { describeEvent } = await import('../src/sim/battleLog.js');
  const battle = start();
  const at = { unit: 'c1', at: [3, 0], side: 'w' };
  assert.deepEqual(['close', 'lock', 'unlock', 'force'].map((type) => describeEvent({ type, ...at }, battle)), [
    'Marine c1 shuts the door on the west side of (3, 0).',
    'Marine c1 locks the door on the west side of (3, 0).',
    'Marine c1 unlocks and opens the door on the west side of (3, 0).',
    'Marine c1 forces the door on the west side of (3, 0): it stays open.',
  ]);
});
