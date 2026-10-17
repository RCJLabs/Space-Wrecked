// M37: what a weapon's rules do in a fight (src/sim/weapons.js): bursts,
// armor piercing, reach, stuns and fire, in the odds, the rolls and the
// AI; a crew member carrying a weapon of their own; Sedate needing a dart
// gun. The tests add weapons of their own to the content, so they hold
// whatever data/weapons.json says.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestPlan, harm, plansFor, WEIGHTS } from '../src/sim/ai.js';
import { act, createBattle, targetsFor } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { shotOdds } from '../src/sim/odds.js';
import { orderTargets } from '../src/sim/orders.js';
import { hazardAt } from '../src/sim/terrain.js';
import { armorAgainst, shotsOf, withinReach } from '../src/sim/weapons.js';
import { openMap, rules as content, wreck } from './battleKit.js';

// A sure hit for 1, unless a test says otherwise.
const sure = (id, extra = {}) => ({ id, name: id, kind: 'long', cost: 50, damage: [1, 1], accuracy: { close: 100, mid: 100, long: 100 }, crit: 0, critDamage: 0, clip: 6, sound: 'shot', held: { length: 0.3, height: 0.07, bore: 0.01, hands: 2 }, ...extra });
const WEAPONS = [
  sure('t-burst', { burst: { shots: 3, aim: -10 } }),
  sure('t-pierce', { damage: [3, 3], pierce: 1 }),
  sure('t-plain3', { damage: [3, 3] }),
  sure('t-reach', { reach: 1 }),
  sure('t-stun', { stun: true, reach: 1 }),
  sure('t-torch', { burn: 2, reach: 2 }),
  sure('t-wide', { burst: { shots: 2, aim: -20 }, accuracy: { close: 0, mid: 0, long: 0 }, damage: [2, 4] }),
  sure('t-narrow', { accuracy: { close: 0, mid: 0, long: 0 }, damage: [2, 4] }),
];
const rules = { ...content, weapons: new Map([...content.weapons, ...WEAPONS.map((w) => [w.id, w])]) };
const fight = (map, units, extra = {}) => createBattle({ map, units, seed: 7, ...extra }, rules).battle;
const who = (battle, id) => battle.units.find((u) => u.id === id);

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

const shoot = (unit, target) => ({ type: 'shoot', unit, target });

test('a crew member can carry a weapon of their own: its clip, and none that is unknown', () => {
  const battle = fight(openMap(4, 1), [{ kind: 'medic', x: 0, y: 0, weapon: 't-burst' }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.deepEqual([who(battle, 'c1').weapon, who(battle, 'c1').ammo], ['t-burst', 6]);
  assert.equal(who(battle, 'e1').weapon, rules.enemies.get('pirate').weapon);
  assert.throws(() => fight(openMap(4, 1), [{ kind: 'medic', x: 0, y: 0, weapon: 'nothing' }, { kind: 'pirate', x: 3, y: 0 }]), /no weapon "nothing"/);
});

test('a burst is its shots at the same odds, each a round, the burst a part of the odds; it stops when the target drops; overwatch fires one', () => {
  const units = [{ kind: 'marine', x: 0, y: 0, weapon: 't-burst' }, { kind: 'brute', x: 3, y: 0 }];
  const battle = fight(openMap(5, 1), units);
  const odds = shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
  assert.deepEqual(odds.hitParts.find((part) => part.why === 'burst'), { why: 'burst', shots: 3, value: -10 });
  const { battle: after, events } = play(battle, shoot('c1', 'e1'));
  const shots = events.filter((e) => e.type === 'shot');
  assert.deepEqual(shots.map((s) => s.burst), [1, 2, 3]);
  assert.ok(shots.every((s) => s.chance === odds.hit && s.hit));
  assert.equal(who(after, 'c1').ammo, 3);
  assert.equal(who(after, 'e1').hp, rules.enemies.get('brute').hp - 3);
  assert.match(describeEvent(shots[1], after), /\(burst, shot 2\)/);
  // A target that drops takes no more: two shots for a pirate at 2.
  const nearly = fight(openMap(5, 1), [units[0], { kind: 'pirate', x: 3, y: 0, hp: 2 }]);
  const dropped = play(nearly, shoot('c1', 'e1'));
  assert.equal(dropped.events.filter((e) => e.type === 'shot').length, 2);
  assert.equal(who(dropped.battle, 'c1').ammo, 4);
  // Overwatch: one shot, without the burst's part.
  assert.equal(shotsOf(rules.weapons.get('t-burst'), true), 1);
  assert.equal(shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules, { overwatch: true }).hitParts.some((part) => part.why === 'burst'), false);
});

test('armor piercing: that much of the armor doesn\'t count, and never below none', () => {
  assert.deepEqual([armorAgainst(1, { pierce: 1 }), armorAgainst(3, { pierce: 1 }), armorAgainst(0, { pierce: 2 }), armorAgainst(2, {})], [0, 2, 0, 2]);
  const hit = (weapon) => {
    const battle = fight(openMap(5, 1), [{ kind: 'marine', x: 0, y: 0, weapon }, { kind: 'brute', x: 3, y: 0 }]);
    return play(battle, shoot('c1', 'e1')).events.find((e) => e.type === 'shot').damage;
  };
  assert.equal(rules.enemies.get('brute').armor, 1);
  assert.deepEqual([hit('t-plain3'), hit('t-pierce')], [2, 3]);
});

test('reach: no shot past it, by a side or a corner, on overwatch too', () => {
  const weapon = rules.weapons.get('t-reach');
  assert.deepEqual([withinReach(weapon, [0, 0], [1, 1]), withinReach(weapon, [0, 0], [2, 0]), withinReach(rules.weapons.get('rifle'), [0, 0], [9, 9])], [true, false, true]);
  const far = fight(openMap(5, 2), [{ kind: 'marine', x: 0, y: 0, weapon: 't-reach' }, { kind: 'pirate', x: 2, y: 0 }]);
  assert.deepEqual(targetsFor(far, who(far, 'c1'), rules), []);
  assert.equal(act(far, shoot('c1', 'e1'), rules).error, 'Pirate is out of reach: the t-reach reaches 1 tile.');
  const near = fight(openMap(5, 2), [{ kind: 'marine', x: 0, y: 0, weapon: 't-reach' }, { kind: 'pirate', x: 1, y: 1 }]);
  assert.equal(targetsFor(near, who(near, 'c1'), rules).length, 1);
  // On overwatch: a walk two tiles off draws nothing; a step beside does.
  const watching = play(fight(openMap(6, 3), [{ kind: 'marine', x: 0, y: 0, weapon: 't-reach' }, { kind: 'pirate', x: 4, y: 2 }]), { type: 'overwatch', unit: 'c1' }).battle;
  const past = act(watching, { type: 'move', unit: 'e1', to: [2, 2] }, rules);
  assert.ok(past.ok && !past.events.some((e) => e.type === 'shot'));
  const beside = act(past.battle, { type: 'move', unit: 'e1', to: [1, 1] }, rules);
  assert.ok(beside.ok && beside.events.some((e) => e.type === 'shot' && e.overwatch));
});

test('a stun: the target sleeps through its side\'s next turn; stunned in its own turn, it loses the rest of that one', () => {
  const battle = fight(openMap(4, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 't-stun' }, { kind: 'brute', x: 1, y: 0 }]);
  const struck = play(battle, shoot('c1', 'e1'));
  assert.ok(struck.events.some((e) => e.type === 'stun' && e.unit === 'e1'));
  assert.equal(describeEvent(struck.events.find((e) => e.type === 'stun'), struck.battle), 'Pirate brute e1 is stunned.');
  // The crew's turn ends with its only unit's shot; the enemy's sleeps, and
  // wakes as its turn ends.
  assert.ok(struck.events.some((e) => e.type === 'asleep' && e.unit === 'e1'));
  assert.deepEqual([struck.battle.side, who(struck.battle, 'e1').ap], ['enemy', 0]);
  const slept = play(struck.battle, { type: 'end' });
  assert.ok(slept.events.some((e) => e.type === 'awake' && e.unit === 'e1'));
  assert.equal(slept.battle.side, 'crew');
  // On overwatch, in the enemy's own turn: it stops where it is, and wakes as its turn ends.
  const watching = play(fight(openMap(5, 2), [{ kind: 'marine', x: 0, y: 0, weapon: 't-stun' }, { kind: 'brute', x: 3, y: 1 }]), { type: 'overwatch', unit: 'c1' }).battle;
  const stopped = act(watching, { type: 'move', unit: 'e1', to: [1, 1] }, rules);
  assert.ok(stopped.ok);
  assert.ok(stopped.events.some((e) => e.type === 'stun'));
  assert.equal(stopped.battle.side, 'crew', 'its turn ended with the stun');
  assert.equal(who(stopped.battle, 'e1').asleep, false);
});

test('fire: a hit sets the tile burning for its rounds, burning whoever starts a turn there, then it goes out; a wrecked tile doesn\'t catch', () => {
  const battle = fight(openMap(5, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 't-torch' }, { kind: 'brute', x: 2, y: 0 }]);
  const lit = play(battle, shoot('c1', 'e1'));
  assert.deepEqual(lit.events.find((e) => e.type === 'fire'), { type: 'fire', at: [2, 0], until: 2 });
  assert.equal(hazardAt(lit.battle, 2, 0), 'fire');
  assert.equal(battleProblem(lit.battle), null);
  // The enemy's turn starts on the fire: it burns.
  const burn = lit.events.find((e) => e.type === 'hazard' && e.unit === 'e1');
  assert.deepEqual(burn, { type: 'hazard', unit: 'e1', hazard: 'fire', damage: rules.balance.fireDamage });
  // Round 2 burns on; round 3 opens with it out.
  const state = play(lit.battle, { type: 'end' }).battle;
  const round2 = play(state, { type: 'end' });
  assert.ok(round2.events.some((e) => e.type === 'hazard' && e.unit === 'e1'), 'still burning in round 2');
  const round3 = play(round2.battle, { type: 'end' });
  assert.equal(round3.battle.round, 3);
  assert.deepEqual(round3.events.find((e) => e.type === 'fire out'), { type: 'fire out', at: [2, 0] });
  assert.equal(describeEvent(round3.events.find((e) => e.type === 'fire out'), round3.battle), 'The fire at (2, 0) burns out.');
  assert.deepEqual(round3.battle.fires, []);
  assert.equal(hazardAt(round3.battle, 2, 0), null);
  assert.equal(play(round3.battle, { type: 'end' }).events.some((e) => e.type === 'hazard'), false);
  // A tile in vacuum has nothing to burn.
  const airless = fight(wreck(openMap(5, 1), 2, 0, 'vacuum'), [{ kind: 'marine', x: 0, y: 0, weapon: 't-torch' }, { kind: 'brute', x: 2, y: 0 }]);
  assert.equal(play(airless, shoot('c1', 'e1')).events.some((e) => e.type === 'fire'), false);
  assert.equal(battleProblem({ ...lit.battle, fires: [{ at: [9, 0], until: 2 }] }), 'has unreadable fires');
});

test('the AI weighs the rules: a burst\'s shots, nothing past its reach, and the fire under it', () => {
  const battle = fight(openMap(6, 2), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 4, y: 0 }]);
  const [crew, foe] = [who(battle, 'c1'), who(battle, 'e1')];
  const one = harm(battle, { ...crew, weapon: 't-narrow' }, foe, rules);
  const burst = harm(battle, { ...crew, weapon: 't-wide' }, foe, rules);
  assert.ok(burst > one, `two shots at 20 worse (${burst}) beat one (${one}) here`);
  assert.equal(harm(battle, { ...crew, weapon: 't-reach' }, foe, rules), 0);
  const reachOnly = fight(openMap(6, 2), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], { first: 'enemy' });
  const plans = plansFor(reachOnly, { ...who(reachOnly, 'e1'), weapon: 't-reach', mobility: 1 }, rules);
  assert.ok(plans.every((plan) => plan.then?.type !== 'shoot'), 'no shot from where it can reach no one');
  // Standing in a fire a weapon set counts as harm it would take; a wrecked
  // room's, which never goes out, it crosses as before.
  const cold = fight(openMap(6, 2), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 1 }]);
  const hot = { ...cold, fires: [{ at: [5, 1], until: 9 }] };
  const wrecked = fight(wreck(openMap(6, 2), 5, 1, 'fire'), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 1 }]);
  const stay = (b) => plansFor(b, who(b, 'e1'), rules).find((plan) => plan.ap === 0 && !plan.open);
  assert.equal(stay(hot).threat - stay(cold).threat, rules.balance.fireDamage);
  assert.equal(stay(wrecked).threat, stay(cold).threat);
});

test('with a reach, the AI closes to it, and its overwatch counts for little till an enemy is about that close', () => {
  const battle = fight(openMap(12, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 11, y: 0 }], { first: 'enemy' });
  const unit = { ...who(battle, 'e1'), weapon: 't-reach' };
  const plans = plansFor(battle, unit, rules);
  const here = plans.find((plan) => plan.ap === 0 && plan.then?.type === 'overwatch');
  assert.equal(here.attack, WEIGHTS.idle, 'nothing for its watch from out here');
  const best = bestPlan(plans);
  assert.ok(best.steps < here.steps - unit.mobility, `it closes in, dashing: ${here.steps} steps to ${best.steps}`);
  // Next to an enemy, it strikes.
  const near = fight(openMap(12, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 1, y: 0 }], { first: 'enemy' });
  assert.equal(bestPlan(plansFor(near, { ...who(near, 'e1'), weapon: 't-reach' }, rules)).then?.type, 'shoot');
});

test('Sedate needs a dart gun in hand; Suppress reaches only as far as the weapon', () => {
  const darted = fight(openMap(5, 1), [{ kind: 'xenobiologist', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.deepEqual(orderTargets(darted, who(darted, 'c1'), rules), ['e1']);
  const pistol = fight(openMap(5, 1), [{ kind: 'xenobiologist', x: 0, y: 0, weapon: 'pistol' }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.deepEqual(orderTargets(pistol, who(pistol, 'c1'), rules), []);
  assert.equal(act(pistol, { type: 'order', unit: 'c1', target: 'e1' }, rules).error, 'Sedate needs a dart gun in hand.');
  const baton = fight(openMap(5, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 't-reach' }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.deepEqual(orderTargets(baton, who(baton, 'c1'), rules), []);
  assert.match(act(baton, { type: 'order', unit: 'c1', target: 'e1' }, rules).error, /out of reach/);
});
