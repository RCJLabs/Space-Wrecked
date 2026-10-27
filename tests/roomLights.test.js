// M59: each room on a battle map has a light of its own, out in a wrecked
// room and red when the crew's own ship is boarded; a burning tile throws
// light on the tiles beside it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { battleScene, roomLights } from '../src/render/battleScene.js';
import { palette, skinFor } from '../src/render/palette.js';
import { exampleMap } from './battleKit.js';

const map = exampleMap();

test('every room has a soft light over its middle, as wide as the room', () => {
  const lights = roomLights(map);
  assert.equal(lights.length, map.rooms.length);
  for (const [i, room] of map.rooms.entries()) {
    const light = lights[i];
    assert.deepEqual(light.at, [room.x + room.w / 2, room.y + room.h / 2, 0.5]);
    assert.ok(light.r >= Math.max(room.w, room.h) * 0.45);
    assert.equal(light.color, palette.roomLight);
    assert.ok(light.alpha > 0 && light.alpha < 0.55, 'softer than a fire or a vented room');
  }
});

test("a wrecked room's light is out, and an alert turns the rest red", () => {
  const wrecked = { ...map, rooms: map.rooms.map((room, i) => (i === 0 ? { ...room, wreck: 'rubble' } : room)) };
  assert.equal(roomLights(wrecked).length, map.rooms.length - 1);
  const red = roomLights(map, true);
  assert.ok(red.every((light) => light.color === palette.alertLight));
  assert.ok(red[0].alpha > roomLights(map)[0].alpha, 'brighter in red');
});

test("the scene carries the lights; a burning tile throws a dim light past its own", () => {
  const skin = skinFor('yard');
  const { glows } = battleScene({ map, skin });
  assert.equal(glows.filter((g) => g.color === palette.roomLight).length, map.rooms.length);
  const tile = map.rooms[0];
  const burning = battleScene({ map, skin, fires: [{ at: [tile.x, tile.y] }] }).glows.filter((g) => g.color === palette.fire);
  assert.equal(burning.length, 2);
  const spill = burning.find((g) => g.r > 1);
  assert.ok(spill && spill.alpha < 0.3, 'wide and dim, over the tiles beside it');
  assert.equal(battleScene({ map, skin, alert: true }).glows.filter((g) => g.color === palette.alertLight).length, map.rooms.length);
});
