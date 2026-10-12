import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createBattle, objectiveDone } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { canSee } from '../src/sim/sight.js';
import { inReach } from '../src/sim/terrain.js';
import { drawn, rules } from './battleKit.js';

// A yard with a fence down the middle: crates at (2, 1) and (5, 1), the
// fence between (4, *) and (5, *) with a door at row 2, and a terminal
// (console) at (2, 3).
const yard = () =>
  drawn(`
+-+-+-+-+-+-+-+-+
|. . . . .|. . .|
+         +     +
|. . h . .|h . .|
+         +     +
|. . . . ./. . .|
+               +
|. . c . . . . .|
+-+-+-+-+-+-+-+-+
`);

const grab = { type: 'grab', crates: [[2, 1], [5, 1]] };
const hack = { type: 'hack', at: [2, 3], turns: 2 };
const setup = (objective, units, options) => ({
  map: yard(),
  units: units ?? [
    { kind: 'marine', x: 1, y: 1 },
    { kind: 'medic', x: 4, y: 1 },
    { kind: 'pirate', x: 7, y: 0 },
  ],
  seed: 3,
  objective,
  options,
});
const start = (...args) => createBattle(setup(...args), rules).battle;
const play = (battle, action) => {
  const result = act(battle, action, rules);
  assert.ok(result.ok, result.error);
  return result;
};

test('a battle starts its objective with nothing done', () => {
  assert.deepEqual(start(grab).objective, { type: 'grab', crates: [[2, 1], [5, 1]], taken: [] });
  assert.deepEqual(start(hack).objective, { type: 'hack', at: [2, 3], turns: 2, progress: 0, worked: 0 });
  assert.equal(start(null).objective, null);
  assert.throws(() => start({ type: 'dance' }), /no objective "dance"/);
  for (const objective of [grab, hack, null]) assert.equal(battleProblem(start(objective)), null);
});

test('reach is next to it, by a side or a corner, with nothing between', () => {
  const battle = start(grab);
  assert.ok(inReach(battle, [1, 1], [2, 1]), 'beside');
  assert.ok(inReach(battle, [3, 2], [2, 1]), 'round a corner');
  assert.ok(!inReach(battle, [4, 1], [5, 1]), 'not through the fence');
  assert.ok(!inReach(battle, [4, 2], [5, 1]), 'nor round its corner');
  assert.ok(!inReach(battle, [0, 1], [2, 1]), 'two tiles off');
  assert.ok(!inReach(battle, [5, 2], [4, 2]), 'a closed door is in the way');
  assert.ok(inReach({ ...battle, doors: ['5,2,w'] }, [5, 2], [4, 2]), 'an open one is not');
});

test('grabbing a crate takes one action, and the last one wins the job', () => {
  let battle = start(grab);
  let result = play(battle, { type: 'grab', unit: 'c1', at: [2, 1] });
  battle = result.battle;
  assert.deepEqual(battle.objective.taken, [[2, 1]]);
  assert.equal(battle.units[0].ap, 1);
  assert.deepEqual(result.events, [{ type: 'grab', unit: 'c1', at: [2, 1], left: 1 }]);
  assert.equal(describeEvent(result.events[0], battle), 'Marine c1 grabs the crate at (2, 1): 1 to go.');
  assert.equal(battle.winner, null);
  // Walk round through the door, and grab the other.
  battle = play(battle, { type: 'end' }).battle;
  while (battle.side !== 'crew') battle = play(battle, { type: 'end' }).battle;
  battle = play(battle, { type: 'move', unit: 'c2', to: [5, 2] }).battle;
  result = play(battle, { type: 'grab', unit: 'c2', at: [5, 1] });
  assert.ok(objectiveDone(result.battle.objective));
  assert.equal(result.battle.winner, 'crew');
  assert.deepEqual(result.events.at(-1), { type: 'over', winner: 'crew', reason: 'objective' });
  assert.equal(describeEvent(result.events.at(-1), result.battle), 'The crew wins: the job is done.');
  assert.equal(describeEvent(result.events[0], result.battle), 'Medic c2 grabs the crate at (5, 1): that was the last one.');
});

test("a crate out of reach, grabbed already or not the job's can't be grabbed", () => {
  const battle = start(grab);
  const tries = [
    [{ type: 'grab', unit: 'c2', at: [5, 1] }, 'Medic has to be next to the crate.'],
    [{ type: 'grab', unit: 'c1', at: [0, 0] }, 'There is no crate to grab there.'],
    [{ type: 'grab', unit: 'c1' }, 'There is no crate to grab there.'],
    [{ type: 'hack', unit: 'c1' }, 'There is no terminal to work.'],
  ];
  for (const [action, error] of tries) assert.deepEqual(act(battle, action, rules), { ok: false, error });
  const once = play(battle, { type: 'grab', unit: 'c1', at: [2, 1] }).battle;
  assert.deepEqual(act(once, { type: 'grab', unit: 'c1', at: [2, 1] }, rules), { ok: false, error: 'That crate is grabbed already.' });
  assert.deepEqual(act(start(null), { type: 'grab', unit: 'c1', at: [2, 1] }, rules), { ok: false, error: 'There is no crate to grab there.' });
  // The other side doesn't grab.
  const theirs = start(grab, [{ kind: 'marine', x: 0, y: 3 }, { kind: 'pirate', x: 1, y: 1 }], undefined);
  const enemyTurn = play(theirs, { type: 'end' }).battle;
  assert.deepEqual(act(enemyTurn, { type: 'grab', unit: 'e1', at: [2, 1] }, rules), { ok: false, error: 'There is no crate to grab there.' });
});

test('working the terminal ends the turn, counts once a round, and the last turn of work wins', () => {
  const units = [{ kind: 'marine', x: 1, y: 3 }, { kind: 'engineer', x: 3, y: 2 }, { kind: 'pirate', x: 7, y: 0 }];
  let battle = start(hack, units);
  let result = play(battle, { type: 'hack', unit: 'c1' });
  battle = result.battle;
  assert.equal(battle.units[0].ap, 0, 'its whole turn');
  assert.deepEqual(battle.objective, { type: 'hack', at: [2, 3], turns: 2, progress: 1, worked: 1 });
  assert.equal(describeEvent(result.events[0], battle), 'Marine c1 works the terminal: 1 of 2 turns.');
  assert.deepEqual(act(battle, { type: 'hack', unit: 'c2' }, rules), { ok: false, error: 'The terminal has been worked this turn.' });
  const fight = createFight(battle, rules);
  assert.equal(reduceFight(fight, { type: 'fight/select', unit: 'c2' }, rules).selected, 'c2');
  assert.equal(ordersFor(reduceFight(fight, { type: 'fight/select', unit: 'c2' }, rules), rules).hack, false, 'no Hack button twice a round');
  battle = play(battle, { type: 'end' }).battle;
  while (battle.side !== 'crew') battle = play(battle, { type: 'end' }).battle;
  assert.equal(battle.round, 2);
  result = play(battle, { type: 'hack', unit: 'c2' });
  assert.equal(result.battle.winner, 'crew');
  assert.deepEqual(result.events.at(-1), { type: 'over', winner: 'crew', reason: 'objective' });
  assert.deepEqual(act(start(hack, units), { type: 'move', unit: 'c2', to: [5, 2] }, rules).ok, true);
  assert.deepEqual(act(start(hack, [{ kind: 'marine', x: 5, y: 3 }, { kind: 'pirate', x: 7, y: 0 }]), { type: 'hack', unit: 'c1' }, rules), { ok: false, error: 'Marine has to be next to the terminal.' });
});

test('past the deadline, the crew has lost, at the end of its turn that round', () => {
  let battle = start(grab, undefined, { deadline: 2 });
  assert.equal(battle.options.deadline, 2);
  battle = play(battle, { type: 'end' }).battle;
  assert.equal(battle.winner, null, 'round 1 is fine');
  while (battle.side !== 'crew') battle = play(battle, { type: 'end' }).battle;
  assert.equal(battle.round, 2);
  const result = play(battle, { type: 'end' });
  assert.equal(result.battle.winner, 'enemy');
  assert.deepEqual(result.events.slice(-2), [{ type: 'end', side: 'crew' }, { type: 'over', winner: 'enemy', reason: 'deadline' }]);
  assert.equal(describeEvent(result.events.at(-1), result.battle), 'The enemy wins: the deadline has passed.');
  // Done in time beats it.
  let quick = start(grab, undefined, { deadline: 1 });
  quick = play(quick, { type: 'grab', unit: 'c1', at: [2, 1] }).battle;
  quick = play(quick, { type: 'move', unit: 'c2', to: [5, 2] }).battle;
  assert.equal(quick.side, 'crew');
  const done = play(quick, { type: 'grab', unit: 'c2', at: [5, 1] });
  assert.equal(done.battle.winner, 'crew');
});

test("a battle's own sight range stands in for the balance's", () => {
  const units = [{ kind: 'marine', x: 0, y: 3 }, { kind: 'pirate', x: 7, y: 3 }];
  const far = start(null, units);
  assert.ok(canSee(far, [0, 3], [7, 3], rules), 'seven tiles in the open');
  const dark = start(null, units, { sight: 6 });
  assert.ok(!canSee(dark, [0, 3], [7, 3], rules), 'not past six');
  assert.ok(canSee(dark, [1, 3], [7, 3], rules), 'six is fine');
  assert.equal(battleProblem(dark), null);
});

test('the Fight screen offers Grab and Hack only within reach', () => {
  let fight = createFight(start(grab), rules);
  assert.deepEqual(ordersFor(fight, rules).grab, [2, 1]);
  assert.equal(ordersFor(fight, rules).hack, false);
  fight = reduceFight(fight, { type: 'fight/grab' }, rules);
  assert.deepEqual(fight.battle.objective.taken, [[2, 1]]);
  fight = reduceFight(fight, { type: 'fight/select', unit: 'c2' }, rules);
  assert.equal(ordersFor(fight, rules).grab, null, 'the other crate is behind the fence');
  assert.equal(reduceFight(fight, { type: 'fight/grab' }, rules), fight, 'nothing to grab: nothing happens');
  let hacking = createFight(start(hack, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 0 }]), rules);
  assert.equal(ordersFor(hacking, rules).hack, true);
  hacking = reduceFight(hacking, { type: 'fight/hack' }, rules);
  assert.equal(hacking.battle.objective.progress, 1);
});
