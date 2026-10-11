import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellAt } from '../src/sim/grid.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { canSee, lineOfSight } from '../src/sim/sight.js';
import { renderMap } from '../tools/battle-map.js';
import { drawn, exampleMap, field, openMap, put, rules, wall } from './battleKit.js';

const sees = (map, a, b, doors) => lineOfSight(field(map, doors), a, b, rules);

test('in an open room every tile sees every other', () => {
  const map = openMap(6, 4);
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) assert.ok(sees(map, [i % 6, Math.floor(i / 6)], [j % 6, Math.floor(j / 6)]));
  }
});

test('a wall, the hull or a hatch on an edge the line crosses blocks it', () => {
  for (const kind of ['wall', 'hull', 'hatch']) {
    const map = wall(openMap(5, 3), 2, 1, 'e', kind);
    assert.equal(sees(map, [0, 1], [4, 1]), false, kind);
    assert.equal(sees(map, [0, 0], [4, 0]), true, `${kind}: a row it doesn't cross`);
  }
});

test('a closed door blocks the line, an open one lets it through', () => {
  const map = wall(openMap(5, 3), 2, 1, 'e', 'door');
  assert.equal(sees(map, [0, 1], [4, 1]), false);
  assert.equal(sees(map, [0, 1], [4, 1], [edgeKey(3, 1, 'w')]), true);
});

test('tall things block the line, low ones and units do not', () => {
  for (const [name, blocks] of [['full cover', true], ['machinery', true], ['hull', true], ['half cover', false], ['console', false]]) {
    const map = put(openMap(5, 3), 2, 1, name);
    assert.equal(sees(map, [0, 1], [4, 1]), !blocks, name);
  }
});

test('a line through a corner gets round it either way, but not through two walls', () => {
  // From (1, 1) to (2, 2) the line runs exactly through the corner they share.
  const one = wall(openMap(4, 4), 1, 1, 'e');
  assert.equal(sees(one, [1, 1], [2, 2]), true, 'round the other way');
  const both = wall(wall(openMap(4, 4), 1, 1, 'e'), 1, 1, 's');
  assert.equal(sees(both, [1, 1], [2, 2]), false, 'both ways shut');
  const blockedTile = put(wall(openMap(4, 4), 1, 1, 'e'), 1, 2, 'machinery');
  assert.equal(sees(blockedTile, [1, 1], [2, 2]), false, 'the other way is through machinery');
});

test('the line from a tall tile or to one is not blocked by its own ends', () => {
  const map = put(openMap(5, 1), 4, 0, 'machinery');
  assert.equal(sees(map, [0, 0], [4, 0]), true);
});

test('sight is the same from either end, everywhere on the example ship', () => {
  const map = exampleMap();
  const standing = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) if (rules.tileRules[cellAt(map.tiles, x, y)].walk) standing.push([x, y]);
  }
  let seen = 0;
  for (const a of standing) {
    for (const b of standing) {
      const ab = sees(map, a, b);
      assert.equal(ab, sees(map, b, a), `(${a}) and (${b})`);
      seen += ab;
    }
  }
  assert.ok(seen > standing.length && seen < standing.length ** 2, 'some pairs see each other and some do not');
});

test("the example ship: the reactor's core and the bridge's walls block the view, an open door doesn't", () => {
  const map = exampleMap();
  // The reactor's core (7, 2) stands between the bridge (9, 2) and the quarters (5, 2).
  assert.equal(sees(map, [9, 2], [5, 2]), false);
  // The bridge's wall blocks (9, 3) to (8, 3).
  assert.equal(sees(map, [9, 3], [8, 3]), false);
  // The door from the bridge into the reactor, opened.
  assert.equal(sees(map, [9, 2], [8, 2], [edgeKey(9, 2, 'w')]), true);
  assert.match(renderMap(map, rules.tiles), /\+\/\+-\+\/\+-\+\/\+\/\+\/\+=\+/, 'the map is the one these were worked out on');
});

test('canSee stops at the sight range', () => {
  const map = openMap(30, 1);
  const range = rules.balance.sightRange;
  assert.equal(canSee(field(map), [0, 0], [range, 0], rules), true);
  assert.equal(canSee(field(map), [0, 0], [range + 1, 0], rules), false);
});

test('a hand-drawn map reads the same way', () => {
  const map = drawn(`
+-+-+-+-+-+
|. .|. . .

|. H . . .
+-+-+-+-+-+
`);
  assert.equal(map.width, 5);
  assert.equal(sees(map, [0, 0], [4, 0]), false, 'the wall between (1, 0) and (2, 0)');
  assert.equal(sees(map, [0, 1], [4, 1]), false, 'the locker at (1, 1)');
  assert.equal(sees(map, [2, 1], [4, 0]), true);
});
