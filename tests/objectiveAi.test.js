// M38: the AI plays to a job's objective (src/sim/objectiveAi.js, ai.js).
// What each objective has it play for; a guard that keeps by what it
// guards; a shot at a carrier that counts more; the push for the way in on
// a defense; a charge pulled; and a charge's blast kept clear of. With no
// objective the AI plays as it always has (the golden battle log).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction, GUARD_RANGE } from '../src/sim/ai.js';
import { act, createBattle } from '../src/sim/battle.js';
import { stepsFrom } from '../src/sim/moves.js';
import { blastsAt, playFor } from '../src/sim/objectiveAi.js';
import { openMap, put, rules } from './battleKit.js';

const start = (map, units, objective = null, first = 'enemy') => createBattle({ map, units, seed: 1, first, objective }, rules).battle;
const unit = (battle, id) => battle.units.find((u) => u.id === id);
const WEST = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]];
// A unit's whole turn, as the AI plays it: its actions, and the battle
// after.
function turnOf(battle, id) {
  const actions = [];
  while (!battle.winner && unit(battle, id).ap > 0 && battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0)?.id === id) {
    const action = aiAction(battle, rules);
    const result = act(battle, action, rules);
    assert.ok(result.ok, result.error);
    actions.push(action);
    battle = result.battle;
    if (action.type === 'end') break;
  }
  return { actions, battle };
}
// A room cut by full cover at x = 11 but for a gap at the bottom: whoever
// is past it is out of sight.
const cut = () => {
  const map = openMap(16, 5);
  for (const y of [0, 1, 2, 3]) put(map, 11, y, 'full cover');
  return map;
};

test('what each objective has a side play for: guards, the push, prizes and charges', () => {
  const map = openMap(10, 5);
  const two = [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 8, y: 3 }];
  const nothing = { guard: null, push: null, prizes: new Set(), charges: [] };
  assert.deepEqual(playFor(start(map, two), unit(start(map, two), 'e1')), nothing, 'no objective: as ever');
  // A grab: the crates not yet grabbed; the crew plays for nothing more.
  let b = start(map, two, { type: 'grab', crates: [[2, 1], [5, 1]] });
  b = { ...b, objective: { ...b.objective, taken: [[2, 1]] } };
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[5, 1]]);
  assert.deepEqual(playFor(b, unit(b, 'c1')), nothing);
  // A hack: the terminal.
  b = start(map, two, { type: 'hack', at: [4, 2], turns: 2 });
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[4, 2]]);
  // An extract: the crates left, and a carrier is a prize.
  b = start(map, two, { type: 'extract', crates: [[2, 1], [5, 1]], exits: WEST });
  b = { ...b, objective: { ...b.objective, taken: [[2, 1]] }, units: b.units.map((u) => (u.id === 'c1' ? { ...u, carrying: [2, 1] } : u)) };
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[5, 1]]);
  assert.deepEqual([...playFor(b, unit(b, 'e1')).prizes], ['c1']);
  // An escort: the far gate, and the client is a prize.
  b = start(map, [...two, { kind: 'client', x: 0, y: 2, name: 'Rook' }], { type: 'escort', ward: 'w1', exits: [[9, 0], [9, 1]] });
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[9, 0], [9, 1]]);
  assert.deepEqual([...playFor(b, unit(b, 'e1')).prizes], ['w1']);
  // A rescue: the captive while held, and a prize once freed.
  b = start(map, [...two, { kind: 'captive', x: 7, y: 1, name: 'Danny', held: true }], { type: 'rescue', ward: 'w1', exits: WEST });
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[7, 1]]);
  const freed = { ...b, units: b.units.map((u) => (u.id === 'w1' ? { ...u, status: 'active' } : u)) };
  assert.equal(playFor(freed, unit(freed, 'e1')).guard, null);
  assert.ok(playFor(freed, unit(freed, 'e1')).prizes.has('w1'));
  // A sabotage: the targets not blown, and the charges set, for both sides.
  b = start(map, two, { type: 'sabotage', targets: [[4, 2], [6, 2]], left: 3 });
  b = { ...b, objective: { ...b.objective, charges: [{ at: [4, 2], blows: 2 }], blown: [[6, 2]] } };
  assert.deepEqual(playFor(b, unit(b, 'e1')).guard, [[4, 2]]);
  assert.deepEqual(playFor(b, unit(b, 'e1')).charges, [[4, 2]]);
  assert.deepEqual(playFor(b, unit(b, 'c1')).charges, [[4, 2]]);
  assert.deepEqual(blastsAt(b, 3, 2, [[4, 2]]), [[4, 2]]);
  assert.deepEqual(blastsAt(b, 1, 2, [[4, 2]]), []);
  // A defense: the enemy pushes for the way in; the crew holds it.
  b = start(map, two, { type: 'defend', rounds: 6, line: WEST });
  assert.deepEqual(playFor(b, unit(b, 'e1')).push, WEST);
  assert.deepEqual(playFor(b, unit(b, 'c1')).guard, WEST);
  // Done, it plays for nothing.
  b = { ...b, objective: { ...b.objective, held: true } };
  assert.deepEqual(playFor(b, unit(b, 'e1')), nothing);
});

test('a guard with no shot keeps by what it guards, where it would close on the crew', () => {
  const units = [{ kind: 'marine', x: 14, y: 1 }, { kind: 'pirate', x: 3, y: 2 }];
  const free = turnOf(start(cut(), units), 'e1').battle;
  assert.ok(unit(free, 'e1').x >= 6, `no objective: it pushes on toward the crew, to (${unit(free, 'e1').x}, ${unit(free, 'e1').y})`);
  const guarding = turnOf(start(cut(), units, { type: 'grab', crates: [[2, 2]] }), 'e1').battle;
  const post = stepsFrom(guarding, [[2, 2]], rules).get(`${unit(guarding, 'e1').x},${unit(guarding, 'e1').y}`);
  assert.ok(post <= GUARD_RANGE, `a grab: it keeps within ${GUARD_RANGE} steps of the crate (${post})`);
});

test('a shot at a carrier counts more: of two marines alike, it shoots the one with the crate', () => {
  // Two marines the same distance off, in the open, either side of the
  // pirate's line: whichever carries the crate takes the shot.
  const map = openMap(10, 5);
  const units = [{ kind: 'marine', x: 7, y: 0 }, { kind: 'marine', x: 7, y: 4 }, { kind: 'pirate', x: 2, y: 2 }];
  for (const carrier of ['c1', 'c2']) {
    let b = start(map, units, { type: 'extract', crates: [[9, 2]], exits: WEST });
    b = { ...b, objective: { ...b.objective, taken: [[9, 2]] }, units: b.units.map((u) => (u.id === carrier ? { ...u, carrying: [9, 2] } : u)) };
    const shots = turnOf(b, 'e1').actions.filter((a) => a.type === 'shoot');
    assert.ok(shots.length && shots.every((a) => a.target === carrier), `${carrier} carrying: ${JSON.stringify(shots)}`);
  }
});

test('defending, the enemy pushes for the way in, where it would close on the crew', () => {
  const units = [{ kind: 'marine', x: 14, y: 2 }, { kind: 'pirate', x: 8, y: 2 }];
  const free = turnOf(start(cut(), units), 'e1').battle;
  assert.ok(unit(free, 'e1').x >= 8, `no objective: toward the crew, to (${unit(free, 'e1').x}, ${unit(free, 'e1').y})`);
  const pushing = turnOf(start(cut(), units, { type: 'defend', rounds: 6, line: WEST }), 'e1').battle;
  assert.ok(unit(pushing, 'e1').x < 8, `a defense: toward the way in, to (${unit(pushing, 'e1').x}, ${unit(pushing, 'e1').y})`);
});

test('an enemy beside a charge pulls it rather than shoot', () => {
  // The pirate may step round the charge first (to the side nearer the
  // marine's line); it pulls it either way, and takes no shot.
  const map = openMap(10, 5);
  let b = start(map, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 6, y: 2 }], { type: 'sabotage', targets: [[5, 2]], left: 2 });
  b = { ...b, objective: { ...b.objective, charges: [{ at: [5, 2], blows: 2 }], left: 1 } };
  const { actions, battle } = turnOf(b, 'e1');
  assert.ok(actions.some((a) => a.type === 'pull' && a.at[0] === 5 && a.at[1] === 2) && !actions.some((a) => a.type === 'shoot'), JSON.stringify(actions));
  assert.deepEqual(battle.objective.charges, [], 'the charge is gone');
});

test('the crew keeps clear of its own charge about to blow', () => {
  // The marine set the charge and has its actions; no enemy in sight.
  let b = start(cut(), [{ kind: 'marine', x: 4, y: 2 }, { kind: 'pirate', x: 14, y: 1 }], { type: 'sabotage', targets: [[5, 2]], left: 2 }, 'crew');
  b = { ...b, objective: { ...b.objective, charges: [{ at: [5, 2], blows: 2 }], left: 1 } };
  const { battle } = turnOf(b, 'c1');
  const marine = unit(battle, 'c1');
  assert.deepEqual(blastsAt(battle, marine.x, marine.y, [[5, 2]]), [], `it ends clear of the blast, at (${marine.x}, ${marine.y})`);
});
