// The test player keeps the way on foot from the airlock to the bridge
// (M40). The builder joins rooms by a shared wall, but a weapon mount's
// console can't be walked through, so a part given to the colony can leave
// the airlock's side of the ship joined to the bridge's by mounts alone;
// boarders come in by the hatches and the crew starts on the bridge, and a
// boarding there could never end (tools/boarding.js sealedIn). Smuggler
// seed 22's test voyage gave such a reactor. SHIP is the ship it landed
// with: its second reactor, by the bridge, lets the first go once life
// support has, and the two mounts by the airlock still join it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, buildShip } from '../src/sim/builder.js';
import { donate, shipParts } from '../src/sim/colony.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { launchedShip } from '../tools/startShip.js';
import { hatchesCutOff, nextGift } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const SHIP = [
  ['bridge', 15, 6, 1], ['reactor', 12, 5, 0], ['corridor', 9, 7, 0], ['corridor', 10, 7, 0], ['corridor', 11, 7, 0], ['airlock', 11, 8, 0], ['weapon', 13, 8, 2],
  ['lightengine', 10, 6, 0], ['cargo', 12, 2, 0], ['lifesupport', 10, 5, 0], ['scrapline-engine', 10, 3, 0], ['quarters', 15, 3, 1], ['engine', 10, 1, 0], ['engine', 9, 8, 0],
  ['smallreactor', 12, 0, 0], ['scrapline-cargo', 15, 0, 0], ['hydroponics', 17, 3, 1], ['weapon', 14, 8, 2], ['pointdefense', 11, 0, 0], ['reactor', 17, 6, 0],
];
const built = buildShip(rules, 'starter', SHIP.map(([type, x, y, rot]) => ({ type, x, y, rot })));
const { ship } = built;
const uid = (type, x, y) => ship.modules.find((m) => m.type === type && m.x === x && m.y === y).uid;
const without = (type, x, y) => applyCommand(ship, rules, { op: 'remove', uid: uid(type, x, y) }).ship;

test('hatches cut off: those no one can walk to from the bridge, on the battle map (M40)', () => {
  assert.equal(built.rejected.length, 0, 'the ship builds as it flew');
  assert.equal(hatchesCutOff(launchedShip(rules), rules), 0, 'the launched start ship');
  assert.equal(hatchesCutOff(ship, rules), 0);
  const all = mapFromShip(ship, rules).hatches.length;
  assert.ok(all > 0);
  assert.equal(hatchesCutOff(without('reactor', 12, 5), rules), all, 'the reactor by the airlock gone: the mounts join, but no one walks through them');
  assert.equal(hatchesCutOff(without('bridge', 15, 6), rules), all, 'no bridge, no way to it');
  assert.equal(hatchesCutOff(without('reactor', 17, 6), rules), 0, 'the reactor by the bridge gone: the way stays');
  assert.equal(hatchesCutOff(without('weapon', 14, 8), rules), 0, 'a mount gone');
});

test('the test player gives the colony no part whose going cuts a hatch off from the bridge on foot (M40)', () => {
  let campaign = { ...settled(), ship, wrecks: {} };
  let refused = 0;
  for (let gift = nextGift(campaign, rules); gift !== null; gift = nextGift(campaign, rules)) {
    const ready = shipParts(campaign, rules).filter((part) => part.ok);
    const cutting = ready.filter((part) => hatchesCutOff(part.ship, rules) > hatchesCutOff(campaign.ship, rules));
    refused += cutting.length;
    assert.ok(!cutting.some((part) => part.uid === gift), 'never one that cuts');
    const done = donate(campaign, rules, gift);
    assert.ok(done.ok, done.error);
    campaign = done.campaign;
  }
  assert.ok(refused > 0, 'the reactor by the airlock could have gone');
  assert.equal(hatchesCutOff(campaign.ship, rules), 0, 'every hatch still a walk from the bridge');
  assert.ok(campaign.ship.modules.some((m) => m.type === 'reactor' && m.x === 12 && m.y === 5), 'the reactor by the airlock stays aboard');
});
