import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBattle } from '../src/sim/battle.js';
import { deploy } from '../src/sim/deploy.js';
import { stepsFrom } from '../src/sim/moves.js';
import { walkable } from '../src/sim/terrain.js';
import { exampleMap, field, openMap, rules, wall } from './battleKit.js';

const boarders = rules.encounters.get('boarders').enemies;

test('the squad starts on the bridge and the boarders at the hatch, nearest first', () => {
  const map = exampleMap();
  const { ok, units } = deploy(map, rules.squad, boarders, rules);
  assert.ok(ok);
  // The bridge is (9, 2) to (10, 4); the hatch is on (5, 4), the airlock's
  // west tile. One step from it: (5, 3) through a door, then (4, 4) and
  // (6, 4), top to bottom and left to right.
  assert.deepEqual(units, [
    { kind: 'marine', x: 9, y: 2 },
    { kind: 'engineer', x: 9, y: 3 },
    { kind: 'medic', x: 10, y: 3 },
    { kind: 'pirate', x: 5, y: 4 },
    { kind: 'pirate', x: 5, y: 3 },
    { kind: 'brute', x: 4, y: 4 },
    { kind: 'pirate', x: 6, y: 4 },
  ]);
  const bridge = map.rooms.find((room) => room.type === 'bridge');
  for (const { x, y } of units.slice(0, 3)) assert.ok(x >= bridge.x && x < bridge.x + bridge.w && y >= bridge.y && y < bridge.y + bridge.h);
  assert.deepEqual(deploy(exampleMap(), rules.squad, boarders, rules), { ok, units }, 'the same every time');
});

test('a deployment is a battle setup: three crew against four boarders', () => {
  const { units } = deploy(exampleMap(), rules.squad, boarders, rules);
  const { battle } = createBattle({ map: exampleMap(), units, seed: 1 }, rules);
  assert.deepEqual(battle.units.map((u) => u.id), ['c1', 'c2', 'c3', 'e1', 'e2', 'e3', 'e4']);
  for (const u of battle.units) assert.ok(walkable(battle, u.x, u.y, rules));
});

test('without a bridge, the squad starts as far from the hatches as the ship goes', () => {
  const map = exampleMap();
  const noBridge = { ...map, rooms: map.rooms.filter((room) => room.type !== 'bridge') };
  const { ok, units } = deploy(noBridge, rules.squad, boarders, rules);
  assert.ok(ok);
  const away = stepsFrom(field(map), map.hatches.map(({ x, y }) => [x, y]), rules);
  const furthest = Math.max(...away.values());
  assert.equal(away.get(`${units[0].x},${units[0].y}`), furthest);
});

test('a ship with no hatch, or no room, says what it needs', () => {
  const map = exampleMap();
  assert.deepEqual(deploy({ ...map, hatches: [] }, rules.squad, boarders, rules), { ok: false, error: 'Boarders need a way in: put an airlock on the hull.' });
  const crowd = Array(30).fill('marine');
  assert.deepEqual(deploy(map, crowd, boarders, rules), { ok: false, error: "There isn't room on board for 30 crew and 4 boarders." });
});

test('steps from a set of tiles go through doors but not walls, past anyone', () => {
  const map = wall(wall(openMap(4, 1), 0, 0, 'e', 'door'), 1, 0, 'e', 'wall');
  const away = stepsFrom(field(map), [[0, 0]], rules);
  assert.deepEqual([...away], [['0,0', 0], ['1,0', 1]]);
  assert.deepEqual(stepsFrom(field(openMap(3, 1)), [[0, 0], [2, 0]], rules).get('1,0'), 1, 'from the nearest');
});
