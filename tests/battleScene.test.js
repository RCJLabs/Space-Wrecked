import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { battleBoxes, battleScene, HULL_H, litFloor, WALL_H } from '../src/render/battleScene.js';
import { palette, skins } from '../src/render/palette.js';
import { buildShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { cellAt } from '../src/sim/grid.js';
import { mapFromShip, wallAt } from '../src/sim/mapFromShip.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const skin = skins.yard;
const ship = buildShip(defs, 'starter', JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')).placements).ship;
const exampleMap = (wrecked = {}) => mapFromShip(ship, defs, { wrecked });
const middleOf = (pts) => [0, 1, 2].map((k) => pts.reduce((sum, p) => sum + p[k], 0) / pts.length);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const tops = (faces) => faces.filter((f) => f.normal[2] === 1);

// Every tile of the map, with what is on it.
function* tiles(map) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) yield { x, y, kind: cellAt(map.tiles, x, y), uid: cellAt(map.roomAt, x, y) };
  }
}

test('every face is flat data with a unit normal and a palette colour', () => {
  const { faces, glows } = battleScene({ map: exampleMap({ 1: 'fire', 2: 'rubble', 4: 'vacuum' }), skin });
  assert.ok(faces.length > 300);
  for (const face of faces) {
    assert.ok(face.pts.length >= 3 && face.pts.flat().every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
    assert.match(face.color, /^#[0-9a-f]{6}$/);
  }
  for (const glow of glows) assert.ok(glow.at.every(Number.isFinite) && glow.r > 0);
});

test('the same map always gives the same scene, and the map is left as it was', () => {
  const map = exampleMap({ 1: 'fire' });
  const before = JSON.stringify(map);
  assert.deepEqual(battleScene({ map, skin }), battleScene({ map: exampleMap({ 1: 'fire' }), skin }));
  assert.equal(JSON.stringify(map), before);
});

test('every room tile has a floor, notches are solid hull, and space is empty', () => {
  const map = exampleMap();
  const { faces } = battleScene({ map, skin });
  const rooms = [...tiles(map)].filter((t) => t.uid !== null);
  // Each in its room's light (M59).
  const lit = new Set(rooms.map(({ x, y, uid }) => litFloor(skin.floors[uid % skin.floors.length], map.rooms.find((r) => r.uid === uid), x, y)));
  const floors = faces.filter((f) => f.pts.every((p) => p[2] === 0) && lit.has(f.color));
  assert.equal(floors.length, rooms.length);
  for (const { x, y } of rooms) assert.ok(floors.some((f) => near(middleOf(f.pts)[0], x + 0.5) && near(middleOf(f.pts)[1], y + 0.5)), `(${x}, ${y})`);
  // The notch between the gun and the bridge is a block of hull.
  assert.ok(tops(faces).some((f) => f.color === skin.hull && near(f.pts[0][2], HULL_H) && near(middleOf(f.pts)[0], 8.5) && near(middleOf(f.pts)[1], 4.5)));
  // Nothing stands in open space, but by the hatch.
  const hatchSide = map.hatches.map(({ x, y }) => `${x},${y + 1}`);
  for (const { x, y, kind } of tiles(map)) {
    if (kind !== 'space' || hatchSide.includes(`${x},${y}`)) continue;
    const inside = faces.filter((f) => f.pts.every(([px, py]) => px > x + 0.11 && px < x + 0.89 && py > y + 0.11 && py < y + 0.89));
    assert.equal(inside.length, 0, `(${x}, ${y})`);
  }
});

test('walls stand on their edges, at their heights', () => {
  const map = exampleMap();
  const top = tops(battleScene({ map, skin }).faces);
  const HEIGHT = { wall: WALL_H, hull: HULL_H };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      for (const side of ['n', 'w']) {
        const kind = wallAt(map, x, y, side);
        if (!kind) continue;
        // The middle of the edge is under the top of its piece of wall.
        const [mx, my] = side === 'n' ? [x + 0.5, y] : [x, y + 0.5];
        const over = top.filter((f) => {
          const xs = f.pts.map((p) => p[0]);
          const ys = f.pts.map((p) => p[1]);
          return Math.min(...xs) <= mx && mx <= Math.max(...xs) && Math.min(...ys) <= my && my <= Math.max(...ys) && f.pts[0][2] > 0.3;
        });
        assert.ok(over.length, `(${x}, ${y}) ${side}`);
        if (HEIGHT[kind]) assert.ok(over.some((f) => near(f.pts[0][2], HEIGHT[kind])), `(${x}, ${y}) ${side} ${kind}`);
      }
    }
  }
});

test('posts stand where walls turn and beside doors, not along straight runs', () => {
  const map = exampleMap();
  const posts = tops(battleScene({ map, skin }).faces).filter((f) => {
    const [mx, my] = middleOf(f.pts);
    return near(mx, Math.round(mx)) && near(my, Math.round(my)) && f.pts[0][2] >= WALL_H - 1e-9;
  });
  const at = (x, y) => posts.some((f) => near(middleOf(f.pts)[0], x) && near(middleOf(f.pts)[1], y));
  assert.ok(!at(4, 1), 'the hull over the crew quarters runs straight on');
  assert.ok(at(6, 1), 'where the quarters, the reactor and their doorway meet');
  assert.ok(at(3, 1), "the quarters' corner");
  assert.ok(at(5, 5) && at(6, 5), 'either side of the hatch');
});

test('doors are lit, and each hatch has a docking collar and its light', () => {
  const map = exampleMap();
  const { faces, glows } = battleScene({ map, skin });
  let doors = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) for (const side of ['n', 'w']) if (wallAt(map, x, y, side) === 'door') doors++;
  }
  assert.equal(faces.filter((f) => f.emissive && f.color === skin.doorLight).length, doors);
  assert.equal(faces.filter((f) => f.emissive && f.color === skin.glassHi).length, map.hatches.length);
  const lights = glows.filter((g) => g.color === skin.livery);
  assert.equal(lights.length, map.hatches.length);
  assert.ok(lights[0].at[1] > 5, 'outside, below the airlock');
});

test("an open door slides down into the deck; the battle's other doors stand", () => {
  const map = exampleMap();
  const doors = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) for (const side of ['n', 'w']) if (wallAt(map, x, y, side) === 'door') doors.push(`${x},${y},${side}`);
  }
  const lights = (open) => battleScene({ map, skin, open }).faces.filter((f) => f.emissive && f.color === skin.doorLight).map((f) => f.pts[0][2]);
  assert.deepEqual(lights([]), doors.map(() => 0.46));
  assert.deepEqual(lights([doors[1]]), doors.map((key, i) => (i === 1 ? 0.025 : 0.46)));
});

test('wrecks show: flames and a glow on fire, frost and a cold glow in vacuum, rocks in rubble', () => {
  const map = exampleMap({ 1: 'fire', 2: 'rubble', 4: 'vacuum' });
  const { faces, glows } = battleScene({ map, skin });
  const plain = battleScene({ map: exampleMap(), skin });
  const floorsIn = (color) => faces.filter((f) => f.pts.every((p) => p[2] === 0) && f.color === color).length;
  assert.equal(floorsIn(palette.scorch), 6);
  assert.equal(floorsIn(palette.dust), 9);
  assert.equal(floorsIn(palette.frost), 1);
  // A glow on each burning tile, and since M59 a dimmer one thrown past it.
  assert.equal(glows.filter((g) => g.color === palette.fire && g.alpha === undefined).length, 6, 'a glow on each burning tile');
  assert.equal(glows.filter((g) => g.color === palette.fire && g.alpha !== undefined).length, 6, 'and its light on the tiles beside it');
  assert.ok(faces.some((f) => f.emissive && f.color === palette.fireCore));
  assert.equal(glows.filter((g) => g.color === palette.vacuum).length, 1, 'one for the room');
  assert.ok(faces.some((f) => f.emissive && f.color === palette.vacuum));
  assert.ok(faces.filter((f) => f.color === palette.rubble).length >= 8 * 5, 'rocks on the reactor floor');
  assert.equal(plain.faces.filter((f) => [palette.fire, palette.fireCore, palette.vacuum, palette.rubble].includes(f.color)).length, 0);
});

test('the view opens on the ship and pans over the whole map', () => {
  const map = exampleMap();
  const { fit, all } = battleBoxes(map);
  assert.deepEqual([all.x0, all.y0, all.x1, all.y1], [0, 0, map.width, map.height]);
  assert.ok(fit.x0 > all.x0 && fit.y0 > all.y0 && fit.x1 < all.x1 && fit.y1 < all.y1);
  // The ship's tiles, and the collar under the hatch, are in the fitted box.
  assert.ok(fit.x0 <= 1 && fit.y0 <= 1 && fit.x1 >= map.width - 1 && fit.y1 >= map.height - 1);
  assert.ok(fit.y1 >= map.hatches[0].y + 1.4);
  assert.ok(fit.z1 >= 0.87, 'tall enough for a locker');
});

test("a weapon's fire (M37) burns on its tile over the floor, a glow and flames each, and none once it is out", () => {
  const map = exampleMap();
  const floor = [...tiles(map)].find((tile) => tile.kind === 'floor');
  const plain = battleScene({ map, skin });
  const burning = battleScene({ map, skin, fires: [{ at: [floor.x, floor.y], until: 3 }] });
  const fire = (scene) => scene.glows.filter((g) => g.color === palette.fire && g.alpha === undefined);
  assert.equal(fire(plain).length, 0);
  assert.equal(fire(burning).length, 1);
  assert.deepEqual(fire(burning)[0].at.slice(0, 2), [floor.x + 0.5, floor.y + 0.5]);
  assert.ok(burning.faces.some((f) => f.emissive && f.color === palette.fireCore && f.pts.every(([x, y]) => x >= floor.x && x <= floor.x + 1 && y >= floor.y && y <= floor.y + 1)));
  assert.deepEqual(battleScene({ map, skin, fires: [] }), plain);
});
