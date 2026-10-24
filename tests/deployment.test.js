// M50: deployment and defenses. No one starts on a hazard while a clear tile
// is left; a raid opens with the crew placed by hand inside a zone clear of
// the raiders (battle.setup, save v45); the colony's powered guns fight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { act, createBattle } from '../src/sim/battle.js';
import { clearFirst, deploy } from '../src/sim/deploy.js';
import { createFight, reachOf, reduceFight } from '../src/sim/fight.js';
import { placeAction, placesFor, placing, placingZone, withPlacing } from '../src/sim/placing.js';
import { beginRaid } from '../src/sim/raid.js';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { exampleMap, openMap, rules, wreck } from './battleKit.js';

// An open room 12 wide, two of the crew on the left, a raider on the right.
function opening() {
  const map = openMap(12, 3);
  const units = [{ kind: 'marine', x: 0, y: 1 }, { kind: 'engineer', x: 1, y: 1 }, { kind: 'pirate', x: 11, y: 1 }];
  return withPlacing(createBattle({ map, units, seed: 3 }, rules).battle, rules);
}

test('clearFirst puts hazard tiles last, keeping the order otherwise', () => {
  const map = wreck(openMap(4, 1), 1, 0, 'fire');
  assert.deepEqual(clearFirst(map, ['0,0', '1,0', '2,0', '3,0']), ['0,0', '2,0', '3,0', '1,0']);
});

test('boarders are met by a crew standing on no fire while a clear tile is left', () => {
  const map = exampleMap();
  // Fire on every other tile of the ship.
  const burning = { ...map, hazards: { ...map.hazards, cells: map.hazards.cells.map((h, i) => (map.tiles.cells[i] === 'floor' && i % 2 ? 'fire' : h)) } };
  const placed = deploy(burning, rules.squad, rules.encounters.get('boarders').enemies, rules);
  assert.ok(placed.ok, placed.error);
  for (const unit of placed.units.filter((u) => rules.jobs.has(u.kind))) {
    assert.equal(burning.hazards.cells[unit.y * burning.width + unit.x], null, `${unit.kind} at ${unit.x},${unit.y}`);
  }
});

test('the zone: open tiles at least placeClear steps (a walk) from every raider, and where the crew stand', () => {
  const battle = opening();
  const clear = rules.balance.placeClear;
  assert.ok(placing(battle));
  const zone = new Set(battle.setup.zone);
  for (let x = 0; x < 12; x++) for (let y = 0; y < 3; y++) {
    const steps = Math.abs(11 - x) + Math.abs(1 - y);
    assert.equal(zone.has(`${x},${y}`), steps >= clear, `${x},${y}`);
  }
  assert.deepEqual(placingZone(battle, rules, 99), ['0,1', '1,1'], 'too far for anywhere: only where the crew stand');
});

test('placing costs nothing, keeps to free tiles of the zone, and Ready or any other order ends it', () => {
  const battle = opening();
  const [marine, engineer, pirate] = battle.units;
  assert.ok(!placesFor(battle, marine, rules).includes('1,1'), 'not onto a mate');
  assert.deepEqual(placesFor(battle, pirate, rules), []);
  const moved = act(battle, { type: 'place', unit: marine.id, to: [3, 0] }, rules);
  assert.ok(moved.ok, moved.error);
  const after = moved.battle.units[0];
  assert.deepEqual([after.x, after.y, after.ap], [3, 0, marine.ap]);
  assert.deepEqual(moved.events, [{ type: 'place', unit: marine.id, from: [0, 1], to: [3, 0] }]);
  assert.ok(placing(moved.battle), 'still placing');
  assert.equal(act(battle, { type: 'place', unit: marine.id, to: [10, 1] }, rules).ok, false, 'too near the raider');
  assert.equal(act(battle, { type: 'place', unit: pirate.id, to: [3, 0] }, rules).ok, false, 'not the raiders');
  const ready = act(moved.battle, { type: 'ready' }, rules);
  assert.deepEqual([ready.ok, placing(ready.battle), ready.events], [true, false, [{ type: 'ready' }]]);
  assert.equal(act(ready.battle, { type: 'place', unit: marine.id, to: [2, 0] }, rules).ok, false, 'no placing once begun');
  const walked = act(battle, { type: 'move', unit: engineer.id, to: [2, 1] }, rules);
  assert.ok(walked.ok && !walked.battle.setup, 'a move ends placing');
  assert.equal(placeAction(walked.battle, { type: 'ready' }, rules).ok, false);
});

test('a machine is never placed', () => {
  const map = openMap(12, 3);
  const gun = rules.colony.gun;
  const units = [{ kind: 'marine', x: 0, y: 1 }, { kind: gun.id, side: 'crew', name: gun.name, x: 2, y: 2 }, { kind: 'pirate', x: 11, y: 1 }];
  const battle = withPlacing(createBattle({ map, units, seed: 3 }, rules).battle, rules);
  const fixed = battle.units[1];
  assert.equal(fixed.kind, gun.id);
  assert.ok(!placesFor(battle, battle.units[0], rules).includes('2,2'), "the gun's tile is held");
  assert.deepEqual(placesFor(battle, fixed, rules), []);
  assert.equal(act(battle, { type: 'place', unit: fixed.id, to: [3, 0] }, rules).ok, false);
  let fight = reduceFight(createFight(battle, rules), { type: 'fight/select', unit: fixed.id }, rules);
  fight = reduceFight(fight, { type: 'fight/tap', x: 3, y: 0 }, rules);
  assert.equal(fight.notice.text, `${gun.name} stays where it is built.`);
});

test('on the Fight screen: the zone is the reach, two taps place, a tap outside says why, End is Ready', () => {
  let fight = createFight(opening(), rules);
  const marine = fight.battle.units[0];
  fight = reduceFight(fight, { type: 'fight/select', unit: marine.id }, rules);
  const reach = reachOf(fight.battle, marine, rules);
  assert.ok([...reach.values()].every((spot) => spot.place && spot.cost === 0));
  assert.equal(reach.size, placesFor(fight.battle, marine, rules).length);
  const outside = reduceFight(fight, { type: 'fight/tap', x: 10, y: 1 }, rules);
  assert.match(outside.notice.text, /only on a lit tile/);
  fight = reduceFight(fight, { type: 'fight/tap', x: 4, y: 2 }, rules);
  assert.deepEqual([fight.preview.type, fight.preview.place, fight.preview.to], ['move', true, [4, 2]]);
  fight = reduceFight(fight, { type: 'fight/tap', x: 4, y: 2 }, rules);
  const placed = fight.battle.units[0];
  assert.deepEqual([placed.x, placed.y, placed.ap], [4, 2, marine.ap]);
  assert.ok(placing(fight.battle));
  fight = reduceFight(fight, { type: 'fight/end' }, rules);
  assert.ok(!placing(fight.battle));
  assert.equal(fight.battle.side, 'crew', 'Ready ends placing, not the turn');
});

test('a hangar raid opens placing; a job does not', () => {
  const campaign = withBoard(newCampaign(rules, 77), rules);
  const raid = beginRaid({ ...campaign, heat: 80 }, rules);
  assert.ok(raid.ok, raid.error);
  const { battle } = raid.campaign.fight;
  assert.ok(placing(battle));
  const raiders = battle.units.filter((u) => u.side === 'enemy');
  assert.ok(battle.units.filter((u) => u.side === 'crew').every((u) => battle.setup.zone.includes(`${u.x},${u.y}`)));
  assert.ok(raiders.length > 0);
});

test('save v45: a fight from before has no setup and carries on as it was', () => {
  assert.equal(SAVE_VERSION, 46);
  const data = { settings: null, campaign: { fight: { battle: { side: 'crew' } } } };
  const moved = migrate({ version: 44, data });
  assert.equal(moved.version, 46);
  assert.deepEqual(moved.data, { ...data, campaign: { ...data.campaign, identity: null } }, 'and M52: no name yet');
});
