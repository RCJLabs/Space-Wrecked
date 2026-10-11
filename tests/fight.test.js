import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createBattle } from '../src/sim/battle.js';
import { deploy } from '../src/sim/deploy.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { shotOdds } from '../src/sim/odds.js';
import { playScripted, scriptedAction } from '../src/sim/scripted.js';
import { exampleMap, openMap, rules } from './battleKit.js';

const boarders = rules.encounters.get('boarders').enemies;

// The example ship: three crew on the bridge, four boarders at the airlock.
function boarding(seed = 7) {
  const map = exampleMap();
  return { map, units: deploy(map, rules.squad, boarders, rules).units, seed };
}

function start(setup = boarding()) {
  const { battle, events } = createBattle(setup, rules);
  return createFight(battle, rules, events);
}

const send = (fight, ...actions) => actions.reduce((f, action) => reduceFight(f, action, rules), fight);
const tap = (x, y) => ({ type: 'fight/tap', x, y });
const unit = (fight, id) => fight.battle.units.find((u) => u.id === id);

// A marine in the open with pirates in sight: e1 at mid range, e2 further.
function shootout() {
  return start({ map: openMap(12, 5), units: [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 6, y: 2 }, { kind: 'pirate', x: 10, y: 4 }], seed: 3 });
}

test('a fight opens with the first crew member giving orders', () => {
  const fight = start();
  assert.equal(fight.selected, 'c1');
  assert.equal(fight.preview, null);
  assert.deepEqual(fight.log, [{ type: 'turn', side: 'crew', round: 1 }]);
  const orders = ordersFor(fight, rules);
  assert.equal(orders.unit.id, 'c1');
  assert.equal(orders.door, 'w', 'the bridge door beside the marine');
  assert.deepEqual(orders.targets, [], 'the doors are shut: nobody in sight');
  assert.equal(orders.reload, false, 'a full clip');
  assert.ok([...orders.reach.values()].some((s) => s.dash) && [...orders.reach.values()].some((s) => !s.dash));
  assert.ok(!orders.reach.has('9,2'), 'not its own tile');
});

test('a tap on a tile in reach shows the move, and only a second tap there makes it', () => {
  const fight = start();
  const spot = [...ordersFor(fight, rules).reach.values()].find((s) => !s.dash && s.cost === 2);
  const shown = send(fight, tap(spot.x, spot.y));
  assert.deepEqual(shown.preview, { type: 'move', to: [spot.x, spot.y], cost: 2, dash: false, path: spot.path });
  assert.equal(shown.battle, fight.battle, 'nothing moved yet');
  const moved = send(shown, tap(spot.x, spot.y));
  assert.deepEqual([unit(moved, 'c1').x, unit(moved, 'c1').y], [spot.x, spot.y]);
  assert.equal(unit(moved, 'c1').ap, 1);
  assert.deepEqual(moved.played.map((p) => p.action), [{ type: 'move', unit: 'c1', to: [spot.x, spot.y] }]);
  assert.equal(moved.preview, null);
  assert.equal(moved.selected, 'c1', 'still giving orders, with an action left');
});

test('a dash takes both actions, and the next crew member takes over', () => {
  const fight = start();
  const spot = [...ordersFor(fight, rules).reach.values()].find((s) => s.dash);
  const dashed = send(fight, tap(spot.x, spot.y), tap(spot.x, spot.y));
  assert.equal(unit(dashed, 'c1').ap, 0);
  assert.equal(dashed.selected, 'c2');
  const told = send(dashed, tap(spot.x, spot.y));
  assert.equal(told.selected, 'c2');
  assert.equal(told.notice.text, 'Marine has no actions left this turn.');
});

test('another tap moves the preview; a tap out of reach or off the floor drops it', () => {
  const fight = start();
  const [a, b] = [...ordersFor(fight, rules).reach.values()];
  const moved = send(fight, tap(a.x, a.y), tap(b.x, b.y));
  assert.deepEqual(moved.preview.to, [b.x, b.y]);
  assert.equal(moved.battle, fight.battle);
  const far = send(moved, tap(2, 3)); // engine room floor, beyond a dash
  assert.equal(far.preview, null);
  assert.equal(far.notice.text, "Marine can't get there this turn.");
  const space = send(moved, tap(0, 0));
  assert.equal(space.preview, null);
  assert.equal(space.notice, null, 'space needs no word');
});

test('a tap on another crew member selects them', () => {
  const fight = send(start(), tap(9, 3));
  assert.equal(fight.selected, 'c2');
  assert.equal(send(fight, { type: 'fight/select', unit: 'c3' }).selected, 'c3');
  assert.equal(send(fight, { type: 'fight/select', unit: 'e1' }).selected, 'c2', 'not an enemy');
});

test('a shot shows the exact odds, part by part, and only the second tap takes it', () => {
  const fight = shootout();
  const shown = send(fight, tap(6, 2));
  const odds = shotOdds(fight.battle, unit(fight, 'c1'), unit(fight, 'e1'), rules);
  assert.deepEqual(shown.preview, { type: 'shoot', target: 'e1', odds });
  assert.deepEqual(odds.hitParts.map((p) => [p.why, p.value]), [['aim', 70], ['weapon', 10]], 'mid range, in the open');
  assert.equal(shown.battle, fight.battle, 'not fired yet');
  const fired = send(shown, tap(6, 2));
  const shot = fired.played[0].events.find((e) => e.type === 'shot');
  assert.equal(shot.chance, odds.hit, 'rolled against the number shown');
  assert.deepEqual(fired.played[0].action, { type: 'shoot', unit: 'c1', target: 'e1' });
  assert.equal(fired.played[0].battle.units[0].ap, 0, 'a shot ends its turn');
});

test('Shoot shows the likeliest hit first, then the next; Fire takes the one shown', () => {
  const fight = shootout();
  const first = send(fight, { type: 'fight/aim' });
  assert.equal(first.preview.target, 'e1', 'nearer, so likelier');
  const second = send(first, { type: 'fight/aim' });
  assert.equal(second.preview.target, 'e2');
  assert.ok(second.preview.odds.hit < first.preview.odds.hit);
  assert.equal(send(second, { type: 'fight/aim' }).preview.target, 'e1', 'round again');
  const fired = send(second, { type: 'fight/confirm' });
  assert.equal(fired.played[0].action.target, 'e2');
  assert.equal(send(fight, { type: 'fight/confirm' }), fight, 'nothing shown, nothing to confirm');
});

test("an enemy out of sight can't be aimed at, and an empty gun has to reload", () => {
  const fight = start();
  const blind = send(fight, tap(5, 4));
  assert.equal(blind.preview, null);
  assert.equal(blind.notice.text, "Marine can't see Pirate e1 from here.");
  const empty = shootout();
  empty.battle.units[0].ammo = 0;
  assert.equal(send(empty, tap(6, 2)).notice.text, 'Marine has to reload first.');
  assert.equal(ordersFor(empty, rules).targets.length, 0);
  assert.equal(ordersFor(empty, rules).overwatch, false);
});

test("ending the crew's turn plays the enemy's whole turn, up to the crew's next", () => {
  const fight = start();
  const next = send(fight, { type: 'fight/end' });
  assert.deepEqual(next.played[0].action, { type: 'end' });
  assert.ok(next.played.length > 1);
  assert.ok(next.played.slice(1).every((p) => p.action.type === 'end' || p.action.unit.startsWith('e')));
  // Each step is the battle rules' own result, from the one before.
  let battle = fight.battle;
  for (const step of next.played) {
    const result = act(battle, step.action, rules);
    assert.deepEqual(result.events, step.events);
    battle = step.battle;
  }
  assert.equal(next.battle, battle);
  assert.equal(next.battle.side, 'crew');
  assert.equal(next.battle.round, 2);
  assert.equal(next.selected, 'c1');
  assert.deepEqual(next.log, [...fight.log, ...next.played.flatMap((p) => p.events)]);
});

test('nothing happens on the enemy turn or once the battle is over', () => {
  const fight = start();
  const theirs = { ...fight, battle: { ...fight.battle, side: 'enemy' } };
  assert.equal(send(theirs, tap(9, 3), { type: 'fight/end' }), theirs);
  const over = { ...fight, battle: { ...fight.battle, winner: 'crew' } };
  assert.equal(send(over, { type: 'fight/end' }, { type: 'fight/aim' }), over);
});

test('the other orders: open the door beside, reload, overwatch, stabilize', () => {
  const opened = send(start(), { type: 'fight/open' });
  assert.ok(opened.battle.doors.includes(edgeKey(9, 2, 'w')));
  assert.equal(unit(opened, 'c1').ap, 1);
  const full = send(start(), { type: 'fight/reload' });
  assert.equal(full.notice.text, "Marine's rifle is full.");
  assert.equal(full.notice.tone, 'bad');
  const watching = send(start(), { type: 'fight/overwatch' });
  assert.equal(unit(watching, 'c1').overwatch, true);
  assert.equal(watching.selected, 'c2');

  const hurt = start({ map: openMap(6, 3), units: [{ kind: 'medic', x: 1, y: 1 }, { kind: 'marine', x: 2, y: 1 }, { kind: 'pirate', x: 5, y: 2 }], seed: 1 });
  Object.assign(hurt.battle.units[1], { hp: 0, status: 'down', bleed: 3, ap: 0 });
  assert.equal(ordersFor(hurt, rules).stabilize.id, 'c2');
  assert.equal(send(hurt, tap(2, 1)).notice.text, 'Marine is down: stand beside them and tap Stabilize.');
  assert.equal(unit(send(hurt, { type: 'fight/stabilize' }), 'c2').status, 'stable');
});

// The scripted player's crew orders, given the way a player gives them:
// select, then a tap to see the move or shot and another to make it.
function ordersOf(action) {
  const pick = { type: 'fight/select', unit: action.unit };
  switch (action.type) {
    case 'move':
      return [pick, tap(...action.to), tap(...action.to)];
    case 'shoot':
      return [pick, { type: 'fight/aim', target: action.target }, { type: 'fight/aim', target: action.target }];
    case 'end':
      return [{ type: 'fight/end' }];
    default:
      return [pick, { type: `fight/${action.type}` }];
  }
}

test('a fight given orders by taps plays exactly as the battle rules do', () => {
  for (const seed of [1, 2, 3, 7]) {
    const setup = boarding(seed);
    let fight = start(setup);
    while (!fight.battle.winner && fight.battle.round <= 12) fight = send(fight, ...ordersOf(scriptedAction(fight.battle, rules)));
    const scripted = playScripted(setup, rules, { maxRounds: 12 });
    assert.deepEqual(fight.battle, scripted.battle, `seed ${seed}`);
    assert.deepEqual(fight.log, scripted.events, `seed ${seed}`);
  }
});
