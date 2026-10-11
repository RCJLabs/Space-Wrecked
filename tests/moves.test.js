import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reachable, sideToward } from '../src/sim/moves.js';
import { field, openMap, put, rules, wall, wreck } from './battleKit.js';

const walker = (x, y, side = 'crew') => ({ id: 'w', side, x, y, status: 'active' });
const reach = (map, unit, budget, others = []) => reachable({ ...field(map), units: [unit, ...others] }, unit, budget, rules);
const at = (spots, x, y) => spots.get(`${x},${y}`);

test('in an open room a unit reaches a diamond of tiles, four-way', () => {
  const spots = reach(openMap(9, 9), walker(4, 4), 2);
  assert.equal(spots.size, 13, '1 + 4 + 8');
  assert.equal(at(spots, 6, 4).cost, 2);
  assert.equal(at(spots, 5, 5).cost, 2, 'a diagonal is two steps');
  assert.equal(at(spots, 6, 5), undefined);
  assert.deepEqual(at(spots, 4, 4), { x: 4, y: 4, cost: 0, path: [[4, 4]] });
});

test('paths of equal cost always tie the same way: east before south', () => {
  assert.deepEqual(at(reach(openMap(3, 3), walker(0, 0), 2), 1, 1).path, [[0, 0], [1, 0], [1, 1]]);
});

test('walls, the hull and hatches are in the way; doors are not', () => {
  for (const [kind, passes] of [['wall', false], ['hull', false], ['hatch', false], ['door', true]]) {
    const map = wall(openMap(3, 1), 0, 0, 'e', kind);
    assert.equal(Boolean(at(reach(map, walker(0, 0), 5), 1, 0)), passes, kind);
  }
});

test('a wall makes a unit walk round it', () => {
  const map = wall(openMap(3, 3), 0, 1, 'e');
  assert.equal(at(reach(map, walker(0, 1), 9), 1, 1).cost, 3);
});

test('units only stand on tiles made for it', () => {
  for (const [name, walk] of [['floor', true], ['airlock', true], ['half cover', false], ['console', false], ['machinery', false], ['space', false]]) {
    assert.equal(Boolean(at(reach(put(openMap(2, 1), 1, 0, name), walker(0, 0), 3), 1, 0)), walk, name);
  }
});

test('rubble costs more to cross', () => {
  const map = wreck(openMap(4, 1), 1, 0, 'rubble');
  const spots = reach(map, walker(0, 0), 9);
  assert.equal(at(spots, 1, 0).cost, rules.balance.rubbleMoveCost);
  assert.equal(at(spots, 2, 0).cost, rules.balance.rubbleMoveCost + 1);
});

test("a unit passes its own side but not the other's, and stops on neither", () => {
  const corridor = openMap(4, 1);
  const ally = { id: 'a', side: 'crew', x: 1, y: 0, status: 'active' };
  const foe = { id: 'f', side: 'enemy', x: 1, y: 0, status: 'active' };
  const withAlly = reach(corridor, walker(0, 0), 9, [ally]);
  assert.equal(at(withAlly, 1, 0), undefined, 'not onto the ally');
  assert.equal(at(withAlly, 2, 0).cost, 2, 'through it');
  assert.equal(at(reach(corridor, walker(0, 0), 9, [foe]), 2, 0), undefined, 'not through an enemy');
  const fallen = { ...ally, status: 'down' };
  assert.equal(at(reach(corridor, walker(0, 0), 9, [fallen]), 1, 0), undefined, 'not onto someone lying hurt');
  const gone = { ...foe, status: 'dead' };
  assert.equal(at(reach(corridor, walker(0, 0), 9, [gone]), 1, 0).cost, 1, 'the dead are no obstacle');
});

test('sideToward names the side a step goes through', () => {
  assert.deepEqual([[1, 0], [2, 1], [1, 2], [0, 1]].map((to) => sideToward([1, 1], to)), ['n', 'e', 's', 'w']);
});
