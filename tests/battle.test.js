import assert from 'node:assert/strict';
import { test } from 'node:test';
import { int, percent } from '../src/core/rng.js';
import { act, createBattle, playBattle, targetsFor } from '../src/sim/battle.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { shotOdds } from '../src/sim/odds.js';
import { openMap, put, rules, wall, wreck } from './battleKit.js';

const b = rules.balance;
const fight = (map, units, extra = {}) => createBattle({ map, units, seed: 7, ...extra }, rules);
const who = (battle, id) => battle.units.find((u) => u.id === id);

// Plays actions that must all work, returning the battle and their events.
function play(battle, ...actions) {
  const events = [];
  for (const action of actions) {
    const result = act(battle, action, rules);
    assert.ok(result.ok, `${JSON.stringify(action)}: ${result.error}`);
    battle = result.battle;
    events.push(...result.events);
  }
  return { battle, events };
}

// Sets fields on units of a battle this test made (it owns the object).
function tweak(battle, changes) {
  for (const [id, fields] of Object.entries(changes)) Object.assign(who(battle, id), fields);
  return battle;
}

test('a battle starts on the first side, with units made from the data', () => {
  const { battle, events } = fight(openMap(9, 3), [{ kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 8, y: 1 }, { kind: 'medic', x: 1, y: 1, name: 'Doc' }]);
  assert.deepEqual(events, [{ type: 'turn', side: 'crew', round: 1 }]);
  assert.deepEqual(battle.units.map((u) => [u.id, u.side, u.name]), [['c1', 'crew', 'Marine'], ['e1', 'enemy', 'Pirate'], ['c2', 'crew', 'Doc']]);
  const marine = who(battle, 'c1');
  assert.deepEqual([marine.hp, marine.maxHp, marine.aim, marine.weapon, marine.ammo, marine.ap, marine.air], [10, 10, 70, 'rifle', 4, b.actionPoints, b.suitAir]);
  assert.equal(who(battle, 'e1').ap, 0, 'not their turn');
  assert.deepEqual([battle.side, battle.round, battle.winner, battle.doors], ['crew', 1, null, []]);
});

test('a battle refuses a bad setup', () => {
  const map = put(openMap(4, 1), 2, 0, 'half cover');
  assert.throws(() => fight(map, [{ kind: 'wizard', x: 0, y: 0 }]), /no job or enemy "wizard"/);
  assert.throws(() => fight(map, [{ kind: 'marine', x: 2, y: 0 }]), /can't stand at \(2, 0\)/);
  assert.throws(() => fight(map, [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 0, y: 0 }]), /two units at \(0, 0\)/);
});

test('a move costs one action within the mobility, and both for a dash', () => {
  const units = [{ kind: 'marine', x: 0, y: 1 }, { kind: 'medic', x: 0, y: 0 }, { kind: 'pirate', x: 11, y: 0 }];
  const start = fight(openMap(12, 3), units).battle;
  const walked = play(start, { type: 'move', unit: 'c1', to: [4, 1] }).battle;
  assert.deepEqual([who(walked, 'c1').x, who(walked, 'c1').ap], [4, 1]);
  assert.match(act(walked, { type: 'move', unit: 'c1', to: [9, 1] }, rules).error, /can't get to \(9, 1\) this turn/);
  const dashed = play(start, { type: 'move', unit: 'c1', to: [7, 2] }).battle;
  assert.deepEqual([who(dashed, 'c1').x, who(dashed, 'c1').y, who(dashed, 'c1').ap], [7, 2, 0]);
  assert.match(act(start, { type: 'move', unit: 'c1', to: [0, 1] }, rules).error, /already there/);
  assert.match(act(start, { type: 'move', unit: 'c1', to: [9, 1] }, rules).error, /can't get to/, 'too far even for a dash');
});

test('an action leaves the battle it was given as it was', () => {
  const { battle } = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  const before = JSON.stringify(battle);
  play(battle, { type: 'move', unit: 'c1', to: [2, 0] }, { type: 'shoot', unit: 'c1', target: 'e1' });
  assert.equal(JSON.stringify(battle), before);
});

test('a door opens as a unit walks through it, and stays open', () => {
  const map = wall(openMap(4, 1), 1, 0, 'e', 'door');
  const { battle, events } = play(fight(map, [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]).battle, { type: 'move', unit: 'c1', to: [2, 0] });
  assert.deepEqual(battle.doors, [edgeKey(1, 0, 'e')]);
  assert.deepEqual(events.slice(0, 3), [
    { type: 'move', unit: 'c1', path: [[0, 0], [1, 0]] },
    { type: 'door', unit: 'c1', at: [1, 0], side: 'e' },
    { type: 'move', unit: 'c1', path: [[1, 0], [2, 0]] },
  ]);
});

test('a shot is rolled at the odds shown, uses a round and ends the turn', () => {
  const { battle } = fight(openMap(6, 3), [{ kind: 'marine', x: 0, y: 1 }, { kind: 'medic', x: 0, y: 2 }, { kind: 'pirate', x: 5, y: 1 }]);
  const odds = shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
  const { battle: after, events } = play(battle, { type: 'shoot', unit: 'c1', target: 'e1' });
  const shot = events[0];
  assert.equal(shot.type, 'shot');
  assert.equal(shot.chance, odds.hit);
  assert.equal(shot.hit, shot.roll < shot.chance);
  assert.equal(percent(battle.rng, odds.hit).roll, shot.roll, 'the first roll from the battle RNG');
  assert.deepEqual([who(after, 'c1').ammo, who(after, 'c1').ap], [3, 0]);
  assert.equal(after.side, 'crew', 'the medic can still act');
});

test('damage is the weapon roll, plus the crit bonus on a crit, less armor, and at least 1', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { battle } = createBattle({ map: openMap(4, 1), seed, units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'brute', x: 2, y: 0 }] }, rules);
    tweak(battle, { c1: { aim: 100 }, e1: { hp: 99 } });
    const odds = shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
    const shot = play(battle, { type: 'shoot', unit: 'c1', target: 'e1' }).events[0];
    const hit = percent(battle.rng, odds.hit);
    const crit = percent(hit.state, odds.crit);
    const roll = int(crit.state, 3, 5);
    assert.equal(shot.hit, true);
    assert.equal(shot.crit, crit.value);
    assert.equal(shot.damage, Math.max(1, roll.value + (crit.value ? 2 : 0) - 1), `seed ${seed}`);
  }
});

test('a sure shot always hits and a hopeless one always misses', () => {
  const sure = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]).battle;
  tweak(sure, { c1: { aim: 100 }, e1: { hp: 99 } });
  // A shotgun at long range, at a pirate behind a crate: 0 - 30 - 20.
  const hopeless = fight(put(openMap(12, 1), 10, 0, 'half cover'), [{ kind: 'engineer', x: 0, y: 0 }, { kind: 'pirate', x: 11, y: 0 }]).battle;
  tweak(hopeless, { c1: { aim: 0 } });
  for (let seed = 1; seed <= 20; seed++) {
    const hit = play({ ...sure, rng: seed }, { type: 'shoot', unit: 'c1', target: 'e1' }).events[0];
    assert.deepEqual([hit.chance, hit.hit], [100, true]);
    const miss = play({ ...hopeless, rng: seed }, { type: 'shoot', unit: 'c1', target: 'e1' }).events[0];
    assert.deepEqual([miss.chance, miss.hit, miss.cover], [0, false, 'half']);
  }
});

// Two crew and a pirate on a line: the pirate shoots the medic (made sure
// of it) on the enemy's first turn.
function medicDown(options = {}) {
  let { battle } = fight(openMap(8, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 4, y: 0 }], { options });
  tweak(battle, { c1: { hp: 1, defense: 0 }, e1: { aim: 100 } });
  return play(battle, { type: 'end' }, { type: 'shoot', unit: 'e1', target: 'c1' });
}

test('crew at 0 hit points go down and bleed out over their own turns', () => {
  let { battle, events } = medicDown();
  assert.deepEqual(events.slice(-4), [
    { type: 'down', unit: 'c1', bleed: b.bleedOutTurns },
    { type: 'end', side: 'enemy' },
    { type: 'turn', side: 'crew', round: 2 },
    { type: 'bleed', unit: 'c1', bleed: b.bleedOutTurns - 1 },
  ]);
  const told = [];
  while (who(battle, 'c1').status === 'down') {
    const step = play(battle, { type: 'end' });
    battle = step.battle;
    told.push(...step.events.filter((e) => e.unit === 'c1'));
  }
  assert.deepEqual(told, [
    ...Array.from({ length: b.bleedOutTurns - 2 }, (_, i) => ({ type: 'bleed', unit: 'c1', bleed: b.bleedOutTurns - 2 - i })),
    { type: 'bled out', unit: 'c1', dead: false },
  ]);
  assert.deepEqual([who(battle, 'c1').status, battle.winner], ['out', null], 'not dead, and the marine fights on');
});

test('with permadeath, bleeding out is death', () => {
  let { battle } = medicDown({ permadeath: true });
  for (let i = 0; i < 2 * b.bleedOutTurns; i++) ({ battle } = play(battle, { type: 'end' }));
  assert.equal(who(battle, 'c1').status, 'dead');
});

test('an ally beside a downed unit can stabilize it, and it bleeds no more', () => {
  const { battle } = medicDown();
  assert.equal(battle.side, 'crew');
  assert.match(act(battle, { type: 'stabilize', unit: 'c2', target: 'e1' }, rules).error, /only stabilize an ally who is down/);
  const { battle: after, events } = play(battle, { type: 'stabilize', unit: 'c2', target: 'c1' });
  assert.deepEqual(events[0], { type: 'stabilize', unit: 'c2', target: 'c1' });
  assert.deepEqual([who(after, 'c1').status, who(after, 'c1').bleed, who(after, 'c2').ap], ['stable', 0, 1]);
  let later = after;
  const told = [];
  for (let i = 0; i < 6; i++) {
    const step = play(later, { type: 'end' });
    later = step.battle;
    told.push(...step.events.filter((e) => e.unit === 'c1'));
  }
  assert.deepEqual(told, []);
  const far = tweak(structuredClone(battle), { c2: { x: 3 } });
  assert.match(act(far, { type: 'stabilize', unit: 'c2', target: 'c1' }, rules).error, /has to be next to/);
});

test('enemies at 0 hit points die, and with the last one the crew wins', () => {
  const { battle } = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  tweak(battle, { c1: { aim: 100 }, e1: { hp: 1 } });
  const { battle: after, events } = play(battle, { type: 'shoot', unit: 'c1', target: 'e1' });
  assert.deepEqual(events.slice(1).map((e) => e.type), ['dead', 'over']);
  assert.deepEqual([who(after, 'e1').status, after.winner], ['dead', 'crew']);
  assert.equal(act(after, { type: 'end' }, rules).error, 'The battle is over.');
});

test('with every crew member down the enemy wins', () => {
  const { battle } = fight(openMap(6, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  tweak(battle, { c1: { hp: 1, defense: 0 }, e1: { aim: 100 } });
  const { battle: after } = play(battle, { type: 'end' }, { type: 'shoot', unit: 'e1', target: 'c1' });
  assert.equal(after.winner, 'enemy');
});

test('overwatch fires once, with its penalty, at the first enemy to step into sight', () => {
  // A corridor with a closed door: the pirate opens it coming through.
  const map = wall(openMap(10, 1), 4, 0, 'e', 'door');
  const { battle } = fight(map, [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 8, y: 0 }, { kind: 'pirate', x: 9, y: 0 }]);
  tweak(battle, { e1: { hp: 99 }, e2: { hp: 99 } });
  const watching = play(battle, { type: 'overwatch', unit: 'c1' });
  assert.deepEqual(watching.events.slice(0, 2), [{ type: 'overwatch', unit: 'c1' }, { type: 'end', side: 'crew' }]);
  const { battle: after, events } = play(watching.battle, { type: 'move', unit: 'e1', to: [4, 0] });
  assert.deepEqual(events.slice(0, 4).map((e) => e.type), ['move', 'door', 'move', 'shot']);
  assert.deepEqual(events[2].path, [[5, 0], [4, 0]], 'through the door, into sight');
  const shot = events[3];
  assert.equal(shot.overwatch, true);
  assert.equal(shot.chance, 70 + 10 - b.overwatchPenalty, 'mid range, in the open, less the penalty');
  assert.equal(who(after, 'c1').overwatch, false);
  assert.equal(who(after, 'c1').ammo, 3);
  const second = play(after, { type: 'move', unit: 'e2', to: [5, 0] });
  assert.equal(second.events.filter((e) => e.type === 'shot').length, 0, 'it fired already');
});

test("overwatch waits while a unit passes through an ally's tile, so no two units ever share one", () => {
  const { battle } = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 1, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], { first: 'enemy' });
  tweak(battle, { c1: { hp: 1, defense: 0 }, e1: { aim: 100 } });
  const watching = play(battle, { type: 'overwatch', unit: 'e1' }).battle;
  const { battle: after, events } = play(watching, { type: 'move', unit: 'c1', to: [2, 0] });
  assert.deepEqual(events.slice(0, 3).map((e) => e.type), ['move', 'shot', 'down']);
  assert.deepEqual(events[0].path, [[0, 0], [1, 0], [2, 0]], 'past the medic before the shot');
  assert.deepEqual([who(after, 'c1').x, who(after, 'c1').status], [2, 'down']);
});

test("overwatch ends at the start of its unit's next turn", () => {
  const { battle } = fight(openMap(6, 3), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 2 }]);
  const { battle: after } = play(battle, { type: 'overwatch', unit: 'c1' }, { type: 'end' });
  assert.equal(who(after, 'c1').overwatch, false);
  assert.equal(after.side, 'crew');
});

test('reload refills the clip for one action; an empty gun must reload to shoot', () => {
  const { battle } = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  tweak(battle, { c1: { ammo: 0 } });
  assert.match(act(battle, { type: 'shoot', unit: 'c1', target: 'e1' }, rules).error, /has to reload first/);
  assert.match(act(battle, { type: 'overwatch', unit: 'c1' }, rules).error, /has to reload first/);
  const { battle: after, events } = play(battle, { type: 'reload', unit: 'c1' });
  assert.deepEqual(events, [{ type: 'reload', unit: 'c1', ammo: 4 }]);
  assert.deepEqual([who(after, 'c1').ammo, who(after, 'c1').ap], [4, 1]);
  assert.match(act(after, { type: 'reload', unit: 'c1' }, rules).error, /rifle is full/);
});

test("a side's turn ends by itself when no one has an action left, and rounds count both turns", () => {
  const { battle } = fight(openMap(9, 3), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 0, y: 2 }, { kind: 'pirate', x: 8, y: 1 }]);
  const half = play(battle, { type: 'overwatch', unit: 'c1' }, { type: 'move', unit: 'c2', to: [0, 1] });
  assert.equal(half.battle.side, 'crew', 'the medic has an action left');
  const done = play(half.battle, { type: 'move', unit: 'c2', to: [1, 1] });
  assert.deepEqual(done.events.slice(-2), [{ type: 'end', side: 'crew' }, { type: 'turn', side: 'enemy', round: 1 }]);
  assert.equal(who(done.battle, 'e1').ap, b.actionPoints);
  const next = play(done.battle, { type: 'end' });
  assert.deepEqual(next.events, [{ type: 'end', side: 'enemy' }, { type: 'turn', side: 'crew', round: 2 }]);
  assert.deepEqual([who(next.battle, 'c1').ap, who(next.battle, 'c2').ap], [b.actionPoints, b.actionPoints]);
});

test('fire burns at the start of a turn; vacuum uses suit air, then hurts', () => {
  const map = wreck(wreck(openMap(6, 1), 0, 0, 'fire'), 1, 0, 'vacuum');
  const { battle, events } = fight(map, [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 1, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.deepEqual(events.slice(1), [
    { type: 'hazard', unit: 'c1', hazard: 'fire', damage: b.fireDamage },
    { type: 'air', unit: 'c2', air: b.suitAir - 1 },
  ]);
  assert.equal(who(battle, 'c1').hp, 10 - b.fireDamage);
  let at = battle;
  const breath = [];
  for (let i = 0; i < 2 * b.suitAir; i++) {
    const step = play(at, { type: 'end' });
    at = step.battle;
    breath.push(...step.events.filter((e) => e.unit === 'c2'));
  }
  const kinds = breath.map((e) => (e.type === 'air' ? `air ${e.air}` : `${e.type} ${e.damage}`));
  assert.deepEqual(kinds.slice(0, b.suitAir), [...Array.from({ length: b.suitAir - 1 }, (_, i) => `air ${b.suitAir - 2 - i}`), `hazard ${b.airlessDamage}`]);
});

test('a unit can open a door beside it for one action', () => {
  const map = wall(openMap(4, 1), 1, 0, 'e', 'door');
  const { battle } = fight(map, [{ kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  const { battle: after, events } = play(battle, { type: 'open', unit: 'c1', side: 'e' });
  assert.deepEqual(events, [{ type: 'door', unit: 'c1', at: [1, 0], side: 'e' }]);
  assert.deepEqual([after.doors, who(after, 'c1').ap], [[edgeKey(1, 0, 'e')], 1]);
  assert.equal(targetsFor(after, who(after, 'c1'), rules).length, 1, 'the pirate is in sight now');
  assert.match(act(after, { type: 'open', unit: 'c1', side: 'e' }, rules).error, /open already/);
  assert.match(act(battle, { type: 'open', unit: 'c1', side: 'w' }, rules).error, /no door on that side/);
  assert.match(act(battle, { type: 'open', unit: 'c1', side: 'up' }, rules).error, /no door on that side/);
});

test('errors name the problem and change nothing', () => {
  const { battle } = fight(wall(openMap(6, 3), 2, 1, 'e'), [{ kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }]);
  const errors = [
    [{ type: 'move', unit: 'c9', to: [1, 1] }, /no unit "c9"/],
    [{ type: 'move', unit: 'e1', to: [4, 1] }, /isn't the enemy's turn/],
    [{ type: 'dance', unit: 'c1' }, /Unknown action "dance"/],
    [{ type: 'shoot', unit: 'c1', target: 'e1' }, /can't see Pirate/],
    [{ type: 'shoot', unit: 'c1', target: 'c1' }, /can't shoot that/],
  ];
  for (const [action, message] of errors) {
    const result = act(battle, action, rules);
    assert.equal(result.ok, false);
    assert.match(result.error, message);
  }
});

test("forgiving odds: the crew's misses in a row raise the next shot's odds, shown and rolled", () => {
  const map = put(openMap(12, 1), 10, 0, 'half cover');
  let { battle } = fight(map, [{ kind: 'engineer', x: 0, y: 0 }, { kind: 'pirate', x: 11, y: 0 }], { options: { forgiving: true } });
  // A shotgun at long range at a pirate behind a crate: 50 - 30 - 20, nothing.
  tweak(battle, { c1: { aim: 50 } });
  ({ battle } = play(battle, { type: 'shoot', unit: 'c1', target: 'e1' }, { type: 'end' }));
  assert.equal(battle.misses.crew, 1);
  const [{ odds }] = targetsFor(battle, who(battle, 'c1'), rules);
  assert.equal(odds.hit, b.forgivingStep);
  const shot = play(battle, { type: 'shoot', unit: 'c1', target: 'e1' }).events[0];
  assert.equal(shot.chance, b.forgivingStep);
});

test('the same setup and actions always play out the same; another seed rolls differently', () => {
  const setup = (seed) => ({ map: openMap(8, 3), seed, units: [{ kind: 'marine', x: 0, y: 1 }, { kind: 'engineer', x: 0, y: 0 }, { kind: 'pirate', x: 7, y: 1 }, { kind: 'brute', x: 7, y: 2 }] });
  const actions = [
    { type: 'shoot', unit: 'c1', target: 'e2' },
    { type: 'move', unit: 'c2', to: [3, 0] },
    { type: 'overwatch', unit: 'c2' },
    { type: 'shoot', unit: 'e1', target: 'c1' },
    { type: 'move', unit: 'e2', to: [5, 2] },
    { type: 'end' },
  ];
  const one = playBattle(setup('replay'), actions, rules);
  const two = playBattle(setup('replay'), actions, rules);
  assert.equal(one.error, null);
  assert.deepEqual(two, one);
  const rolls = (run) => run.events.filter((e) => e.type === 'shot').map((e) => e.roll);
  const others = Array.from({ length: 5 }, (_, i) => rolls(playBattle(setup(`other ${i}`), actions, rules)));
  assert.ok(others.some((r) => JSON.stringify(r) !== JSON.stringify(rolls(one))));
});

test('playBattle stops at the first action that fails, and says which', () => {
  const run = playBattle({ map: openMap(4, 1), seed: 1, units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }] }, [{ type: 'move', unit: 'c1', to: [1, 0] }, { type: 'fly', unit: 'c1' }], rules);
  assert.deepEqual(run.error, { index: 1, message: 'Unknown action "fly".' });
  assert.equal(who(run.battle, 'c1').x, 1);
});
