// M32: the test players' orders (src/sim/orderAi.js). The crew's AI gives
// its job's order first where a plain rule says to, so act 1, raids and the
// voyage are measured with the orders in use. Enemies have none.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction } from '../src/sim/ai.js';
import { createBattle } from '../src/sim/battle.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { dartOdds } from '../src/sim/orders.js';
import { GOOD, orderAction, WELD_STEPS } from '../src/sim/orderAi.js';
import { openMap, rules, wall } from './battleKit.js';

const fight = (map, units, extra = {}) => createBattle({ map, units, seed: 7, ...extra }, rules).battle;
const who = (battle, id) => battle.units.find((u) => u.id === id);
const asks = (battle, id) => orderAction(battle, who(battle, id), rules);

function tweak(battle, changes) {
  for (const [id, fields] of Object.entries(changes)) Object.assign(who(battle, id), fields);
  return battle;
}

test('Patch: a downed ally beside first; a hurt one only when no shot is worth taking', () => {
  const battle = fight(openMap(8, 2), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 4, y: 1 }]);
  assert.equal(asks(battle, 'c1'), null, 'nobody hurt');
  tweak(battle, { c2: { status: 'down', hp: 0 } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'c2' });
  // Hurt, not down: the medic's shot comes first while it is a good one.
  tweak(battle, { c2: { status: 'active', hp: 4 } });
  assert.equal(asks(battle, 'c1'), null);
  tweak(battle, { c1: { aim: 0 } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'c2' });
  // Not hurt by a patch's worth.
  tweak(battle, { c2: { hp: who(battle, 'c2').maxHp - 1 } });
  assert.equal(asks(battle, 'c1'), null);
});

test('Hustle: at the start of its turn, with an enemy in sight but no good shot from where it stands, once', () => {
  const battle = fight(openMap(6, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.equal(asks(battle, 'c1'), null, 'a good shot from here');
  tweak(battle, { c1: { aim: 0 } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1' });
  assert.equal(asks(tweak(fight(openMap(6, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]), { c1: { aim: 0, ap: 1 } }), 'c1'), null, 'not with an action spent');
  const blind = tweak(fight(wall(openMap(6, 1), 2, 0, 'e'), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]), { c1: { aim: 0 } });
  assert.equal(asks(blind, 'c1'), null, 'no one in sight');
  assert.equal(asks(tweak(battle, { c1: { uses: 0 } }), 'c1'), null, 'none left');
});

test('Mark: at the start of its turn, the enemy in sight with the fewest hit points, not one marked already', () => {
  const battle = fight(openMap(8, 2), [{ kind: 'scout', x: 0, y: 0 }, { kind: 'pirate', x: 6, y: 0 }, { kind: 'pirate', x: 6, y: 1 }]);
  tweak(battle, { e2: { hp: 2 } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e2' });
  tweak(battle, { e2: { mark: { aim: 15, turns: 2 } } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e1' });
  assert.equal(asks(tweak(battle, { c1: { ap: 1 } }), 'c1'), null);
});

test('Sedate: the awake enemy in sight with the most hit points, at good odds', () => {
  const battle = fight(openMap(6, 2), [{ kind: 'xenobiologist', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }, { kind: 'brute', x: 3, y: 1 }]);
  const brute = who(battle, 'e2');
  assert.ok(brute.hp > who(battle, 'e1').hp);
  assert.ok(dartOdds(battle, who(battle, 'c1'), brute, rules).hit >= GOOD);
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e2' });
  tweak(battle, { e2: { asleep: true } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e1' });
  tweak(battle, { c1: { aim: 0 } });
  assert.equal(asks(battle, 'c1'), null, 'a dart unlikely to land');
});

test('Kit out: at the start of its turn, an ally beside first, then itself', () => {
  const battle = fight(openMap(8, 2), [{ kind: 'quartermaster', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 7, y: 1 }]);
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'c2' });
  tweak(battle, { c2: { kitted: true } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'c1' });
  tweak(battle, { c1: { kitted: true } });
  assert.equal(asks(battle, 'c1'), null);
});

test('Suppress: when its own best shot is poor, the enemy with the best shot at the crew', () => {
  const battle = fight(openMap(8, 3), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 0, y: 2 }, { kind: 'pirate', x: 4, y: 0 }, { kind: 'brute', x: 7, y: 2 }]);
  assert.equal(asks(battle, 'c1'), null, 'a good shot of its own');
  tweak(battle, { c1: { aim: 0 } });
  // The pirate, nearer, has the better shot at the crew.
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e1' });
  tweak(battle, { e1: { suppressed: { aim: -30 } } });
  assert.deepEqual(asks(battle, 'c1'), { type: 'order', unit: 'c1', target: 'e2' }, 'not one suppressed already');
});

test(`Weld: at the start of its turn, with itself or an ally beside badly hurt, the door the nearest enemy comes through, once it is within ${WELD_STEPS} steps and out of sight`, () => {
  // A corridor with a shut door between (1, 0) and (2, 0), the medic
  // beside the engineer.
  const map = wall(openMap(10, 2), 1, 0, 'e', 'door');
  wall(map, 1, 1, 'e');
  const at = (x) => fight(map, [{ kind: 'engineer', x: 1, y: 0 }, { kind: 'medic', x: 1, y: 1 }, { kind: 'pirate', x, y: 0 }]);
  assert.equal(asks(at(6), 'c1'), null, 'nobody hurt');
  const hurt = (battle) => tweak(battle, { c2: { hp: 4 } });
  assert.deepEqual(asks(hurt(at(6)), 'c1'), { type: 'order', unit: 'c1', side: 'e' });
  assert.deepEqual(asks(tweak(at(6), { c1: { hp: 4 } }), 'c1'), { type: 'order', unit: 'c1', side: 'e' }, 'itself hurt');
  assert.equal(asks(hurt(at(9)), 'c1'), null, 'too far off yet');
  const seen = hurt(at(6));
  seen.doors = [edgeKey(1, 0, 'e')];
  assert.equal(asks(seen, 'c1'), null, 'the enemy in sight through the open door');
  const behind = tweak(fight(map, [{ kind: 'engineer', x: 2, y: 0 }, { kind: 'pirate', x: 6, y: 0 }]), { c1: { hp: 4 } });
  assert.equal(asks(behind, 'c1'), null, 'the door is behind it');
});

test("the AI gives a crew member's order first; enemies have none, so the enemy AI plays as before", () => {
  const battle = tweak(fight(openMap(6, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]), { c1: { aim: 0 } });
  assert.deepEqual(aiAction(battle, rules), { type: 'order', unit: 'c1' });
  const theirs = fight(openMap(6, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], { first: 'enemy' });
  assert.equal(orderAction(theirs, who(theirs, 'e1'), rules), null);
  assert.notEqual(aiAction(theirs, rules).type, 'order');
});
