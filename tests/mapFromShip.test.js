import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildShip, connections, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { cellAt, OPPOSITE, SIDES, step } from '../src/sim/grid.js';
import { mapFromShip, nextWreck, wallAt } from '../src/sim/mapFromShip.js';
import { GOLDEN_MAP, parseMap, renderMap } from '../tools/battle-map.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

const data = readData();
const defs = indexDefs(data);
const ship = (placements) => {
  const { ship: built, rejected } = buildShip(defs, 'starter', placements);
  assert.deepEqual(rejected, []);
  return built;
};
const at = (type, x, y, rot = 0) => ({ type, x, y, rot });

// The example ship (tests/fixtures/example-ship.json). Its map starts one
// cell up and left of the ship, at yard cell (6, 4), so tile (x, y) is yard
// cell (x + 6, y + 4):
//   ..QQQRRR..
//   EEQQQRRRBB
//   EE+++RRRBB
//   EELLAAW.BB
//   EE........
const EXAMPLE = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')).placements;
const example = () => mapFromShip(ship(EXAMPLE), defs);
const tile = (map, x, y) => cellAt(map.tiles, x, y);

test('the example ship converts to its golden map', () => {
  // To change the map on purpose: node tools/battle-map.js --golden, and
  // say so in PROGRESS.md.
  assert.equal(renderMap(example(), defs.tiles), readFileSync(GOLDEN_MAP, 'utf8'));
});

test('parseMap reads back what renderMap writes: tiles, walls and hatches', () => {
  const map = example();
  const back = parseMap(renderMap(map, defs.tiles), defs.tiles, { width: map.width });
  assert.deepEqual([back.width, back.height], [map.width, map.height]);
  assert.deepEqual(back.tiles, map.tiles);
  assert.deepEqual(back.walls, map.walls);
  assert.deepEqual(back.hatches.map(({ x, y, side }) => [x, y, side]), map.hatches.map(({ x, y, side }) => [x, y, side]));
  assert.throws(() => parseMap('+-+\n|Z\n+-+\n', defs.tiles), /no tile for "Z"/);
  assert.throws(() => parseMap('+-+\n|.\n', defs.tiles), /expected 2 × height \+ 1 lines/);
});

test('the same ship always converts to the identical map', () => {
  const built = ship(EXAMPLE);
  const first = mapFromShip(built, defs);
  assert.deepEqual(mapFromShip(built, defs), first);
  assert.deepEqual(mapFromShip(JSON.parse(JSON.stringify(built)), defs), first);
  assert.deepEqual(mapFromShip(built, indexDefs(readData())), first);
  // Plain data: it survives a save as it is.
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test('the same ship anywhere in the yard gives the same map, but for its origin', () => {
  const moved = mapFromShip(ship(EXAMPLE.map((p) => ({ ...p, x: p.x + 4, y: p.y + 3 }))), defs);
  const here = example();
  assert.deepEqual(here.origin, [6, 4]);
  assert.deepEqual(moved.origin, [10, 7]);
  assert.deepEqual({ ...moved, origin: null }, { ...here, origin: null });
});

test('the map is the ship and a tile of space around it', () => {
  const map = example();
  assert.equal(map.width, 12);
  assert.equal(map.height, 7);
  assert.equal(map.tilesPerCell, 1);
  for (let x = 0; x < map.width; x++) {
    assert.equal(tile(map, x, 0), 'space');
    assert.equal(tile(map, x, map.height - 1), 'space');
  }
  for (let y = 0; y < map.height; y++) {
    assert.equal(tile(map, 0, y), 'space');
    assert.equal(tile(map, map.width - 1, y), 'space');
  }
});

test('tiles come from the interior templates, turned with their rooms', () => {
  const map = example();
  // The bridge, turned a quarter, has its consoles at the front.
  assert.deepEqual([9, 10].flatMap((x) => [2, 3, 4].map((y) => tile(map, x, y))), ['floor', 'floor', 'floor', 'console', 'floor', 'console']);
  assert.equal(tile(map, 7, 2), 'machinery'); // the reactor's core
  assert.equal(tile(map, 6, 2), 'floor');
  assert.deepEqual([tile(map, 3, 1), tile(map, 4, 1), tile(map, 5, 1)], ['half cover', 'half cover', 'floor']); // bunks
  assert.equal(tile(map, 3, 4), 'full cover'); // life support's tanks
  assert.deepEqual([tile(map, 5, 4), tile(map, 6, 4)], ['airlock', 'airlock']);
  assert.equal(tile(map, 7, 4), 'console'); // the gun's
  assert.deepEqual([tile(map, 1, 2), tile(map, 2, 2)], ['machinery', 'floor']); // the engine's turbine
});

test('a notch the hull closes over is hull, and open space is space', () => {
  const map = example();
  assert.equal(tile(map, 8, 4), 'hull'); // between the gun and the bridge
  assert.equal(cellAt(map.roomAt, 8, 4), null);
  assert.equal(tile(map, 9, 1), 'space'); // above the bridge
  assert.equal(tile(map, 2, 1), 'space'); // a corner the hull slopes across
});

test('each tile knows its room', () => {
  const map = example();
  assert.equal(cellAt(map.roomAt, 9, 2), 1);
  assert.equal(cellAt(map.roomAt, 8, 3), 2);
  assert.equal(cellAt(map.roomAt, 4, 3), 5);
  assert.equal(cellAt(map.roomAt, 0, 0), null);
  assert.deepEqual(map.rooms[0], { uid: 1, type: 'bridge', x: 9, y: 2, w: 2, h: 3, wreck: null });
  assert.deepEqual(map.rooms.map((room) => room.uid), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('rooms that share a wall get one doorway in its middle', () => {
  const map = example();
  // Crew quarters and the reactor share two cells of wall.
  assert.equal(wallAt(map, 5, 1, 'e'), 'door');
  assert.equal(wallAt(map, 6, 1, 'w'), 'door');
  assert.equal(wallAt(map, 5, 2, 'e'), 'wall');
  // Inside a room there are no walls.
  assert.equal(wallAt(map, 6, 1, 'e'), null);
  assert.equal(wallAt(map, 6, 1, 's'), null);
});

test('corridors side by side open into each other, and doors lead off the run', () => {
  const map = example();
  assert.equal(wallAt(map, 3, 3, 'e'), null);
  assert.equal(wallAt(map, 4, 3, 'e'), null);
  assert.equal(wallAt(map, 5, 3, 'e'), 'door'); // into the reactor
  // Life support sits under two corridor cells: one doorway, on the left.
  assert.equal(wallAt(map, 3, 4, 'n'), 'door');
  assert.equal(wallAt(map, 4, 4, 'n'), 'wall');
});

test('the hull closes the ship, with a hatch where the airlock meets space', () => {
  const map = example();
  assert.equal(wallAt(map, 5, 4, 's'), 'hatch');
  assert.equal(wallAt(map, 6, 4, 's'), 'hull');
  assert.deepEqual(map.hatches, [{ uid: 10, x: 5, y: 4, side: 's' }]);
  assert.equal(wallAt(map, 10, 2, 'e'), 'hull'); // the bridge's front
  assert.equal(wallAt(map, 8, 4, 'w'), 'hull'); // the gun against the notch
  assert.equal(wallAt(map, 8, 4, 's'), null); // the notch's own edge: nothing stands there
});

test("an engine's exhaust gets no doorway, even with a room behind it", () => {
  const map = example();
  assert.equal(wallAt(map, 1, 2, 'w'), 'hull');
  assert.equal(wallAt(map, 1, 3, 'w'), 'hull');
  // A corridor behind an engine is walled off from it.
  const blocked = mapFromShip(ship([at('bridge', 10, 5), at('engine', 8, 5), at('corridor', 7, 5)]), defs);
  assert.deepEqual(blocked.origin, [6, 4]);
  assert.equal(wallAt(blocked, 2, 1, 'w'), 'wall');
  assert.equal(wallAt(blocked, 2, 2, 'w'), 'hull');
  assert.equal(wallAt(blocked, 3, 1, 'e'), 'door'); // into the bridge
});

// Every tile edge, once, with the rooms on either side.
function* edges(map) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      for (const side of ['n', 'w']) {
        const [nx, ny] = step(x, y, side);
        if (nx < 0 || ny < 0) continue;
        yield { x, y, side, a: cellAt(map.roomAt, x, y), b: cellAt(map.roomAt, nx, ny), wall: wallAt(map, x, y, side) };
      }
    }
  }
}

const SHIPS = {
  example: EXAMPLE,
  'cargo hauler': [
    at('bridge', 14, 5, 1), at('reactor', 11, 5), at('cargo', 8, 5), at('corridor', 11, 8), at('corridor', 12, 8),
    at('corridor', 13, 8), at('airlock', 14, 8, 1), at('engine', 6, 5), at('engine', 6, 7), at('medbay', 8, 8),
  ],
  'gun boat': [at('bridge', 10, 6), at('weapon', 10, 5), at('weapon', 12, 5), at('shield', 13, 6, 1), at('airlock', 10, 8), at('engine', 8, 6)],
};

test('rooms are sealed: only hatches open onto space or hull', () => {
  for (const [name, placements] of Object.entries(SHIPS)) {
    const map = mapFromShip(ship(placements), defs);
    for (const { x, y, side, a, b, wall } of edges(map)) {
      if ((a === null) === (b === null)) continue;
      assert.ok(wall === 'hull' || wall === 'hatch', `${name}: (${x}, ${y}) ${side} is ${wall}`);
    }
  }
});

test("doorways join the rooms the builder joins, and walls stand between the rest", () => {
  for (const [name, placements] of Object.entries(SHIPS)) {
    const built = ship(placements);
    const map = mapFromShip(built, defs);
    const links = connections(built, defs);
    const corridor = (uid) => built.modules.find((m) => m.uid === uid).type === 'corridor';
    const doors = new Set();
    for (const { x, y, side, a, b, wall } of edges(map)) {
      if (a === null || b === null || a === b) continue;
      const where = `${name}: (${x}, ${y}) ${side}`;
      if (corridor(a) && corridor(b)) assert.equal(wall, null, where);
      else assert.ok(wall === 'door' || wall === 'wall', `${where} is ${wall}`);
      if (wall === 'door' || wall === null) {
        assert.ok(links.get(a).has(b), `${where} joins rooms the builder doesn't`);
        doors.add(`${a}|${b}`).add(`${b}|${a}`);
      }
    }
    for (const [a, joined] of links) for (const b of joined) assert.ok(doors.has(`${a}|${b}`), `${name}: no way from ${a} to ${b}`);
  }
});

test('every edge reads the same from both sides', () => {
  const map = example();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      for (const side of SIDES) assert.equal(wallAt(map, x, y, side), wallAt(map, ...step(x, y, side), OPPOSITE[side]));
    }
  }
});

test('a wrecked room carries its wreck to every tile', () => {
  const map = mapFromShip(ship(EXAMPLE), defs, { wrecked: { 1: 'fire', 2: 'rubble', 4: 'vacuum', 99: 'fire', 3: 'flood' } });
  const count = (hazard) => map.hazards.cells.filter((h) => h === hazard).length;
  assert.equal(count('fire'), 6); // the bridge
  assert.equal(count('rubble'), 9); // the reactor
  assert.equal(count('vacuum'), 1); // one corridor
  assert.equal(cellAt(map.hazards, 9, 2), 'fire');
  assert.equal(cellAt(map.hazards, 3, 3), 'vacuum');
  assert.equal(cellAt(map.hazards, 4, 3), null);
  assert.deepEqual(map.rooms.filter((room) => room.wreck).map(({ uid, wreck }) => [uid, wreck]), [[1, 'fire'], [2, 'rubble'], [4, 'vacuum']]);
  // The layout itself is the same.
  const plain = example();
  assert.deepEqual(map.tiles, plain.tiles);
  assert.deepEqual(map.walls, plain.walls);
  assert.equal(plain.hazards.cells.some(Boolean), false);
});

test('wrecks cycle: none, fire, vacuum, rubble, none', () => {
  const seen = [null];
  for (let i = 0; i < 4; i++) seen.push(nextWreck(seen.at(-1)));
  assert.deepEqual(seen, [null, 'fire', 'vacuum', 'rubble', null]);
});

test('an empty ship has no map', () => {
  assert.equal(mapFromShip(newShip('starter'), defs), null);
});

test('with two tiles a cell, each cell is 2 × 2 tiles and doors take the middle tile', () => {
  const double = (row) => [...row].map((c) => c + c).join('');
  const fine = indexDefs({
    ...data,
    modules: { ...data.modules, tilesPerCell: 2, modules: data.modules.modules.map((def) => ({ ...def, interior: def.interior.flatMap((row) => [double(row), double(row)]) })) },
  });
  // A bridge with a corridor at its side and an airlock under it.
  const { ship: built } = buildShip(fine, 'starter', [at('bridge', 10, 5), at('corridor', 13, 5), at('airlock', 10, 7)]);
  const map = mapFromShip(built, fine);
  assert.deepEqual(map.origin, [9, 4]);
  assert.equal(map.tilesPerCell, 2);
  assert.equal(map.width, 2 * 6);
  assert.equal(map.height, 2 * 5);
  // The bridge's first console fills a whole cell.
  assert.deepEqual([[2, 2], [3, 2], [2, 3], [3, 3]].map(([x, y]) => tile(map, x, y)), ['console', 'console', 'console', 'console']);
  assert.equal(tile(map, 4, 2), 'floor');
  // The corridor's door is on the upper tile of the cell's edge.
  assert.equal(wallAt(map, 7, 2, 'e'), 'door');
  assert.equal(wallAt(map, 7, 3, 'e'), 'wall');
  // The airlock opens down into space, and to either side.
  assert.equal(wallAt(map, 2, 7, 's'), 'hatch');
  assert.equal(wallAt(map, 3, 7, 's'), 'hull');
  assert.deepEqual(map.hatches.map(({ x, y, side }) => `${x},${y},${side}`).sort(), ['2,6,w', '2,7,s', '5,6,e']);
  assert.equal(wallAt(map, 2, 6, 'n'), 'door'); // up into the bridge
});
