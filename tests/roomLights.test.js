// M59: each room on a battle map has a light of its own, pooled on its
// floor, out in a wrecked room and red when the crew's own ship is boarded;
// a burning tile throws light on the tiles beside it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { battleScene, litFloor, POOL } from '../src/render/battleScene.js';
import { palette, skinFor } from '../src/render/palette.js';
import { exampleMap } from './battleKit.js';

const map = exampleMap();
const floor = '#202020';
const lum = (hex) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
const room = map.rooms.find((r) => r.w >= 3 && r.h >= 3);
const middle = [room.x + Math.floor(room.w / 2), room.y + Math.floor(room.h / 2)];

test("a room's light pools on its floor, brightest at the middle and soft", () => {
  const mid = litFloor(floor, room, ...middle);
  const corner = litFloor(floor, room, room.x, room.y);
  assert.ok(lum(mid) > lum(corner) && lum(corner) >= lum(floor), 'brightest at the middle');
  assert.ok(lum(mid) - lum(floor) <= POOL.lit * 3 * 255 + 3, 'a soft pool');
  assert.equal(litFloor(floor, null, 0, 0), floor, 'no room, no light');
});

test("a wrecked room's light is out, and an alert turns the rest red and stronger", () => {
  assert.equal(litFloor(floor, { ...room, wreck: 'rubble' }, ...middle), floor);
  const red = litFloor(floor, room, ...middle, true);
  const plain = litFloor(floor, room, ...middle);
  const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  assert.ok(channel(red, 0) > channel(red, 2), 'red');
  assert.ok(channel(red, 0) - channel(floor, 0) > channel(plain, 0) - channel(floor, 0), 'a stronger pool in red');
  assert.ok(POOL.alert > POOL.lit);
});

test('the scene lights its floors without a glow per room; a burning tile throws a dim light past its own', () => {
  const skin = skinFor('yard');
  const lit = battleScene({ map, skin });
  assert.equal(lit.glows.filter((g) => g.color === palette.roomLight || g.color === palette.alertLight).length, 0, 'no gradient per room: the frame budget');
  const floorAt = (scene, [x, y]) => scene.faces.find((f) => f.pts.every((p) => p[2] === 0) && f.pts.every(([px, py]) => px >= x && px <= x + 1 && py >= y && py <= y + 1)).color;
  const bare = skin.floors[room.uid % skin.floors.length];
  assert.ok(lum(floorAt(lit, middle)) > lum(bare), 'the middle of a room is lit');
  assert.notEqual(floorAt(battleScene({ map, skin, alert: true }), middle), floorAt(lit, middle), 'red on alert');
  const burning = battleScene({ map, skin, fires: [{ at: [room.x, room.y] }] }).glows.filter((g) => g.color === palette.fire);
  assert.equal(burning.length, 2);
  const spill = burning.find((g) => g.r > 1);
  assert.ok(spill && spill.alpha < 0.3, 'wide and dim, over the tiles beside it');
});
