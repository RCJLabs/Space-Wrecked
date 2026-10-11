import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverFrom, coverOnSide } from '../src/sim/cover.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { exampleMap, field, openMap, put, rules, wall } from './battleKit.js';

// A unit at the middle of a 7 × 7 room, (3, 3), and attackers all round it.
const AT = [3, 3];
const NORTH = [3, 0];
const SOUTH = [3, 6];
const EAST = [6, 3];
const WEST = [0, 3];
const NORTHEAST = [6, 1];
const SOUTHWEST = [0, 5];
const cover = (map, from, doors) => coverFrom(field(map, doors), AT, from, rules);

test('in the open a unit has no cover, and is flanked from everywhere', () => {
  for (const from of [NORTH, SOUTH, EAST, WEST, NORTHEAST]) assert.deepEqual(cover(openMap(7, 7), from), { cover: null, flanked: true });
});

test('a crate gives half cover against attackers on its side, and none against the rest', () => {
  const map = put(openMap(7, 7), 3, 2, 'half cover'); // north of the unit
  assert.deepEqual(cover(map, NORTH), { cover: 'half', flanked: false });
  assert.deepEqual(cover(map, NORTHEAST), { cover: 'half', flanked: false }, 'anyone north of it, at any angle');
  assert.deepEqual(cover(map, SOUTH), { cover: null, flanked: true });
  assert.deepEqual(cover(map, EAST), { cover: null, flanked: true }, 'level with the unit is not north of it');
});

test('lockers, machinery, walls, the hull and hatches give full cover; consoles half', () => {
  for (const [name, expected] of [['full cover', 'full'], ['machinery', 'full'], ['console', 'half'], ['floor', null]]) {
    assert.equal(cover(put(openMap(7, 7), 3, 2, name), NORTH).cover, expected, name);
  }
  for (const kind of ['wall', 'hull', 'hatch']) assert.equal(cover(wall(openMap(7, 7), 3, 3, 'n', kind), NORTH).cover, 'full', kind);
});

test('a closed door is full cover, an open one none', () => {
  const map = wall(openMap(7, 7), 3, 3, 'w', 'door');
  assert.equal(cover(map, WEST).cover, 'full');
  assert.equal(cover(map, WEST, [edgeKey(3, 3, 'w')]).cover, null);
});

test('in a corner the best cover that faces the attacker counts', () => {
  // A wall to the north and a crate to the east.
  const map = put(wall(openMap(7, 7), 3, 3, 'n'), 4, 3, 'half cover');
  assert.equal(cover(map, NORTHEAST).cover, 'full', 'both face it: the wall is better');
  assert.equal(cover(map, EAST).cover, 'half');
  assert.equal(cover(map, [6, 5]).cover, 'half', 'south-east: only the crate faces it');
  assert.deepEqual(cover(map, SOUTHWEST), { cover: null, flanked: true });
});

test('the cover on one side is the same whoever is asking', () => {
  const map = put(wall(openMap(7, 7), 3, 3, 'n'), 4, 3, 'half cover');
  const sides = ['n', 'e', 's', 'w'].map((side) => coverOnSide(field(map), AT, side, rules));
  assert.deepEqual(sides, ['full', 'half', null, null]);
});

test('on the example ship, the bunks cover the quarters from the north and the bridge consoles from the east', () => {
  const map = exampleMap();
  assert.equal(coverOnSide(field(map), [3, 2], 'n', rules), 'half'); // the bunk at (3, 1)
  assert.equal(coverOnSide(field(map), [9, 3], 'e', rules), null); // (10, 3) is floor
  assert.equal(coverOnSide(field(map), [9, 2], 'e', rules), 'half'); // a console at (10, 2)
  assert.equal(coverOnSide(field(map), [9, 2], 'n', rules), 'full'); // the hull
});
