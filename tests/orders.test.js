// M32: each crew job's order in a fight (src/sim/orders.js): its rule, its
// uses, what it leaves on a unit, and when that wears off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { percent } from '../src/core/rng.js';
import { act, createBattle } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { beginFight, newCampaign } from '../src/sim/campaign.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { reachable } from '../src/sim/moves.js';
import { shotOdds } from '../src/sim/odds.js';
import { dartOdds, orderTargets } from '../src/sim/orders.js';
import { initialState, saveData } from '../src/sim/root.js';
import { canSee } from '../src/sim/sight.js';
import { openMap, rules, wall } from './battleKit.js';

const fight = (map, units, extra = {}) => createBattle({ map, units, seed: 7, ...extra }, rules).battle;
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

function tweak(battle, changes) {
  for (const [id, fields] of Object.entries(changes)) Object.assign(who(battle, id), fields);
  return battle;
}

const order = (unit, extra = {}) => ({ type: 'order', unit, ...extra });

test('every job has an order, a ship effect and a colony effect; a fight starts with every order\'s uses and nothing on anyone', () => {
  assert.equal(rules.jobs.size, 7);
  for (const job of rules.jobs.values()) {
    assert.ok(job.order && job.station && job.colony, `${job.id} has all three`);
  }
  const battle = fight(openMap(8, 2), [...rules.jobs.keys()].map((kind, x) => ({ kind, x, y: 0 })).concat([{ kind: 'pirate', x: 7, y: 1 }]));
  for (const unit of battle.units) {
    const uses = unit.side === 'crew' ? rules.jobs.get(unit.kind).order.uses : 0;
    assert.deepEqual([unit.uses, unit.mark, unit.suppressed, unit.asleep, unit.kitted], [uses, null, null, false, false], unit.kind);
  }
  assert.deepEqual(battle.welds, []);
  assert.equal(battleProblem(battle), null);
});

test('an enemy has no order, and an order with no uses left says so', () => {
  const battle = fight(openMap(4, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }], { first: 'enemy' });
  assert.match(act(battle, order('e1'), rules).error, /has no order of their own/);
  const spent = fight(openMap(4, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  const once = play(spent, order('c1')).battle;
  assert.equal(who(once, 'c1').uses, 0);
  assert.match(act(once, order('c1'), rules).error, /has no Hustle left this fight/);
  assert.deepEqual(orderTargets(once, who(once, 'c1'), rules), []);
});

test('Suppress: an enemy in sight shoots at −30 until its side\'s turn ends; it ends the marine\'s turn and uses a round', () => {
  const battle = fight(openMap(6, 2), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 0 }]);
  const before = shotOdds(battle, who(battle, 'e1'), who(battle, 'c1'), rules);
  assert.match(act(battle, order('c1', { target: 'c2' }), rules).error, /for the enemy/);
  const { battle: after, events } = play(battle, order('c1', { target: 'e1' }));
  assert.deepEqual(events[0], { type: 'order', order: 'suppress', unit: 'c1', target: 'e1', aim: -30 });
  assert.deepEqual([who(after, 'c1').ap, who(after, 'c1').ammo, who(after, 'c1').uses], [0, 3, 1]);
  const now = shotOdds(after, who(after, 'e1'), who(after, 'c1'), rules);
  assert.deepEqual(now.hitParts.find((p) => p.why === 'suppressed'), { why: 'suppressed', value: -30 });
  assert.equal(now.hit, before.hit - 30);
  // Through the enemy's turn, then gone.
  const theirs = play(after, { type: 'end' }).battle;
  assert.equal(theirs.side, 'enemy');
  assert.deepEqual(who(theirs, 'e1').suppressed, { aim: -30 });
  const next = play(theirs, { type: 'end' }).battle;
  assert.equal(who(next, 'e1').suppressed, null);
  // No round in the clip, no Suppress.
  const empty = tweak(fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]), { c1: { ammo: 0 } });
  assert.match(act(empty, order('c1', { target: 'e1' }), rules).error, /has to reload first/);
});

test('Weld: the door beside closes and holds for 3 rounds, this one counted; nobody walks, sees or opens it through', () => {
  // A corridor with a door between (1, 0) and (2, 0), open.
  const map = wall(openMap(6, 1), 1, 0, 'e', 'door');
  const battle = fight(map, [{ kind: 'engineer', x: 1, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  battle.doors = [edgeKey(1, 0, 'e')];
  assert.deepEqual(orderTargets(battle, who(battle, 'c1'), rules), ['e']);
  const { battle: welded, events } = play(battle, order('c1', { side: 'e' }));
  assert.deepEqual(events[0], { type: 'order', order: 'weld', unit: 'c1', at: [1, 0], side: 'e', until: 3 });
  assert.deepEqual(welded.doors, [], 'shut');
  assert.deepEqual(welded.welds, [{ key: edgeKey(1, 0, 'e'), until: 3 }]);
  assert.equal(canSee(welded, [0, 0], [5, 0], rules), false);
  assert.equal(reachable(welded, who(welded, 'c1'), 10, rules).has('3,0'), false, 'no one walks through');
  assert.match(act(welded, order('c1', { side: 'e' }), rules).error, /welded shut already/);
  // The pirate's turn: it can't open it either.
  const theirs = play(welded, { type: 'end' }).battle;
  const pirate = tweak(theirs, { e1: { x: 2 } });
  assert.match(act(pirate, { type: 'open', unit: 'e1', side: 'w' }, rules).error, /welded shut/);
  // Rounds 1, 2 and 3 it holds; round 4 it gives way, shut.
  let later = welded;
  const given = [];
  for (let i = 0; i < 6; i++) {
    const step = play(later, { type: 'end' });
    later = step.battle;
    given.push(...step.events.filter((e) => e.type === 'unweld').map((e) => [later.round, e.key]));
  }
  assert.deepEqual(given, [[4, edgeKey(1, 0, 'e')]]);
  assert.deepEqual([later.welds, later.doors], [[], []]);
  assert.equal(reachable(later, who(later, 'c1'), 10, rules).has('3,0'), true, 'a shut door opens as anyone walks through');
  assert.match(describeEvent(events[0], welded), /welds the door on the east side of \(1, 0\) shut, to round 3/);
});

test('Patch: an ally beside gets 3 hit points back, up to their most; one who is down gets up with 3', () => {
  const battle = fight(openMap(5, 2), [{ kind: 'medic', x: 1, y: 0 }, { kind: 'marine', x: 2, y: 1 }, { kind: 'engineer', x: 0, y: 0 }, { kind: 'pirate', x: 4, y: 0 }]);
  tweak(battle, { c2: { hp: 4 }, c3: { hp: 0, status: 'down', bleed: 2, ap: 0 } });
  assert.deepEqual(orderTargets(battle, who(battle, 'c1'), rules), ['c2', 'c3']);
  const { battle: after, events } = play(battle, order('c1', { target: 'c2' }));
  assert.deepEqual(events[0], { type: 'order', order: 'patch', unit: 'c1', target: 'c2', hp: 7, healed: 3, up: false });
  const { battle: up, events: told } = play(after, order('c1', { target: 'c3' }));
  assert.deepEqual(told[0], { type: 'order', order: 'patch', unit: 'c1', target: 'c3', hp: 3, healed: 3, up: true });
  assert.deepEqual([who(up, 'c3').status, who(up, 'c3').hp, who(up, 'c3').bleed, who(up, 'c3').ap], ['active', 3, 0, 0]);
  assert.equal(who(up, 'c1').uses, 0);
  // Never past their most; never one who isn't hurt, or isn't beside.
  const nearly = tweak(fight(openMap(4, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]), { c2: { hp: 9 } });
  assert.equal(who(play(nearly, order('c1', { target: 'c2' })).battle, 'c2').hp, 10);
  const whole = fight(openMap(4, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.match(act(whole, order('c1', { target: 'c2' }), rules).error, /isn't hurt/);
  const apart = tweak(fight(openMap(5, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 2, y: 0 }, { kind: 'pirate', x: 4, y: 0 }]), { c2: { hp: 2 } });
  assert.match(act(apart, order('c1', { target: 'c2' }), rules).error, /has to be next to/);
});

test('Hustle: one more action this turn, once a fight, costing none', () => {
  const battle = fight(openMap(12, 1), [{ kind: 'pilot', x: 0, y: 0 }, { kind: 'pirate', x: 11, y: 0 }]);
  const { battle: after, events } = play(battle, order('c1'));
  assert.deepEqual(events[0], { type: 'order', order: 'hustle', unit: 'c1', target: 'c1', ap: 1 });
  assert.equal(who(after, 'c1').ap, 3);
  const moved = play(after, { type: 'move', unit: 'c1', to: [10, 0] }, { type: 'move', unit: 'c1', to: [9, 0] }).battle;
  assert.equal(moved.side, 'enemy', 'three actions spent: a dash and a step');
});

test("Mark: the crew's shots at a marked enemy are +15 until the crew's next turn ends; it takes one action", () => {
  const battle = fight(openMap(8, 2), [{ kind: 'scout', x: 0, y: 0 }, { kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 7, y: 0 }]);
  const before = shotOdds(battle, who(battle, 'c2'), who(battle, 'e1'), rules);
  const { battle: after, events } = play(battle, order('c1', { target: 'e1' }));
  assert.deepEqual(events[0], { type: 'order', order: 'mark', unit: 'c1', target: 'e1', aim: 15 });
  assert.deepEqual([who(after, 'c1').ap, who(after, 'e1').mark], [1, { aim: 15, turns: 2 }]);
  const now = shotOdds(after, who(after, 'c2'), who(after, 'e1'), rules);
  assert.deepEqual(now.hitParts.find((p) => p.why === 'marked'), { why: 'marked', value: 15 });
  assert.equal(now.hit, before.hit + 15);
  assert.equal(shotOdds(after, who(after, 'e1'), who(after, 'c2'), rules).hitParts.some((p) => p.why === 'marked'), false, 'its own shots are as they were');
  // Through the enemy's turn and the crew's next, then gone.
  const crewAgain = play(after, { type: 'end' }, { type: 'end' }).battle;
  assert.deepEqual(who(crewAgain, 'e1').mark, { aim: 15, turns: 1 });
  const done = play(crewAgain, { type: 'end' }).battle;
  assert.equal(who(done, 'e1').mark, null);
});

test('Sedate: a dart rolled at the shot\'s odds; a hit sleeps the enemy through its next turn, and it wakes', () => {
  const battle = fight(openMap(6, 1), [{ kind: 'xenobiologist', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  tweak(battle, { c1: { aim: 200 }, e1: { overwatch: true } });
  const odds = shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
  const { battle: after, events } = play(battle, order('c1', { target: 'e1' }));
  assert.deepEqual(events[0], { type: 'order', order: 'sedate', unit: 'c1', target: 'e1', chance: odds.hit, roll: percent(battle.rng, odds.hit).roll, hit: true });
  assert.deepEqual([who(after, 'c1').ap, who(after, 'c1').ammo, who(after, 'e1').asleep, who(after, 'e1').overwatch], [0, 3, true, false]);
  assert.equal(after.side, 'enemy');
  assert.equal(who(after, 'e1').ap, 0, 'asleep on its turn');
  assert.ok(events.some((e) => e.type === 'asleep' && e.unit === 'e1'));
  assert.equal(after.side, 'enemy');
  const { battle: woke, events: told } = play(after, { type: 'end' });
  assert.ok(told.some((e) => e.type === 'awake' && e.unit === 'e1'));
  assert.equal(who(woke, 'e1').asleep, false);
  const next = play(woke, { type: 'end' }).battle;
  assert.equal(who(next, 'e1').ap, rules.balance.actionPoints, 'its next turn as ever');
  // A hopeless dart misses, and counts as a miss.
  const hopeless = tweak(fight(openMap(6, 1), [{ kind: 'xenobiologist', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]), { c1: { aim: -200 } });
  const missed = play(hopeless, order('c1', { target: 'e1' }));
  assert.deepEqual([missed.events[0].hit, who(missed.battle, 'e1').asleep, missed.battle.misses.crew], [false, false, 1]);
});

test('Kit out: itself or an ally beside, a full clip and 1 armor for the fight, once each', () => {
  const battle = fight(openMap(5, 1), [{ kind: 'quartermaster', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 4, y: 0 }]);
  tweak(battle, { c1: { ammo: 1 }, c2: { ammo: 0 } });
  assert.deepEqual(orderTargets(battle, who(battle, 'c1'), rules), ['c1', 'c2']);
  const { battle: after, events } = play(battle, order('c1', { target: 'c2' }));
  assert.deepEqual(events[0], { type: 'order', order: 'kit', unit: 'c1', target: 'c2', armor: 1, ammo: 4 });
  assert.deepEqual([who(after, 'c2').armor, who(after, 'c2').ammo, who(after, 'c2').kitted], [2, 4, true]);
  assert.match(act(after, order('c1', { target: 'c2' }), rules).error, /kitted out already/);
  const self = play(after, order('c1', { target: 'c1' }));
  assert.deepEqual([who(self.battle, 'c1').armor, who(self.battle, 'c1').ammo], [2, 3]);
  assert.match(describeEvent(self.events[0], self.battle), /kits up: armor \+1, 3 shots/);
});

test('every order event reads as a line of the log', () => {
  const lines = [
    [{ type: 'order', order: 'suppress', unit: 'c1', target: 'e1', aim: -30 }, /suppresses Pirate e1: its shots -30/],
    [{ type: 'order', order: 'patch', unit: 'c1', target: 'c1', hp: 3, healed: 3, up: true }, /back on their feet with 3/],
    [{ type: 'order', order: 'hustle', unit: 'c1', target: 'c1', ap: 1 }, /hustles: 1 more action this turn/],
    [{ type: 'order', order: 'mark', unit: 'c1', target: 'e1', aim: 15 }, /marks Pirate e1: the crew's shots at it \+15/],
    [{ type: 'order', order: 'sedate', unit: 'c1', target: 'e1', chance: 60, roll: 12, hit: true }, /darts Pirate e1: 60%, rolled 12, asleep/],
    [{ type: 'asleep', unit: 'e1' }, /is asleep and does nothing/],
    [{ type: 'awake', unit: 'e1' }, /wakes up/],
    [{ type: 'unweld', key: '2,0,w' }, /gives way: the door is shut/],
  ];
  const battle = fight(openMap(4, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  for (const [event, pattern] of lines) assert.match(describeEvent(event, battle), pattern);
});

test('a battle with what orders leave reads back, and broken fields are caught', () => {
  const battle = fight(openMap(4, 1), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  const marked = { ...battle, welds: [{ key: '1,0,w', until: 2 }], units: battle.units.map((u) => (u.side === 'enemy' ? { ...u, mark: { aim: 15, turns: 1 }, suppressed: { aim: -30 }, asleep: true } : { ...u, kitted: true })) };
  assert.equal(battleProblem(JSON.parse(JSON.stringify(marked))), null);
  const broken = [
    { ...marked, welds: undefined },
    { ...marked, welds: [{ key: 7, until: 2 }] },
    { ...marked, units: marked.units.map((u) => ({ ...u, uses: -1 })) },
    { ...marked, units: marked.units.map((u) => ({ ...u, mark: { aim: 15 } })) },
    { ...marked, units: marked.units.map((u) => ({ ...u, asleep: 'no' })) },
  ];
  for (const value of broken) assert.notEqual(battleProblem(value), null);
});

test('saves: v24 for orders in a fight; a v23 fight under way carries on with every crew member\'s 2 uses, nothing on anyone and no door welded', () => {
  // 27 since M33's fix (docking on trade), 28 since M33b's quests, 29
  // since M33c's companions.
  assert.equal(SAVE_VERSION, 31);
  const fighting = beginFight(newCampaign(rules, 5), rules).campaign;
  const strip = (unit) => {
    const { uses, mark, suppressed, asleep, kitted, ...rest } = unit;
    return rest;
  };
  const { welds, ...battle } = fighting.fight.battle;
  const v23 = { ...fighting, fight: { ...fighting.fight, battle: { ...battle, units: battle.units.map(strip) } } };
  const data = { ...saveData(initialState(5)), campaign: v23 };
  const step = MIGRATIONS.find((m) => m.from === 23);
  const up = step.up(data).campaign.fight.battle;
  assert.deepEqual(up.units.map((u) => [u.side, u.uses, u.mark, u.suppressed, u.asleep, u.kitted]), battle.units.map((u) => [u.side, u.side === 'crew' ? 2 : 0, null, null, false, false]));
  assert.deepEqual(up.welds, []);
  assert.equal(step.up({ ...data, campaign: { ...v23, fight: null } }).campaign.fight, null, 'no fight, nothing to do');
  const opened = parseSave(JSON.stringify({ version: 23, data }));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.data.campaign.fight.battle.units.find((u) => u.side === 'crew').uses, 2);
  // A v24 fight round-trips with what its orders left.
  const marked = { ...fighting, fight: { ...fighting.fight, battle: { ...fighting.fight.battle, welds: [{ key: '1,1,w', until: 3 }] } } };
  const again = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(5)), campaign: marked })));
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.save.data.campaign.fight.battle.welds, [{ key: '1,1,w', until: 3 }]);
});

test('on the Fight screen an order is shown first and taken only by a second press; a tap on another enemy moves it there', () => {
  const battle = fight(openMap(8, 3), [{ kind: 'scout', x: 0, y: 1 }, { kind: 'xenobiologist', x: 0, y: 2 }, { kind: 'pirate', x: 7, y: 0 }, { kind: 'pirate', x: 7, y: 2 }]);
  tweak(battle, { e2: { hp: 2 } });
  let screen = reduceFight(createFight(battle, rules), { type: 'fight/select', unit: 'c1' }, rules);
  assert.deepEqual(ordersFor(screen, rules).order, { kind: 'mark', name: 'Mark', uses: 2, reaches: 'enemy', def: rules.jobs.get('scout').order });
  // The likeliest hit first, then the fewest hit points: the nearer pirate
  // is the same distance off, so the one with 2 hit points.
  screen = reduceFight(screen, { type: 'fight/order' }, rules);
  // What the Mark does to the scout's own shot at it is shown with it.
  const own = shotOdds(battle, who(battle, 'c1'), who(battle, 'e2'), rules).hit;
  assert.deepEqual(screen.preview, { type: 'order', kind: 'mark', at: 'e2', odds: null, change: { shooter: 'c1', target: 'e2', was: own, now: Math.min(100, own + 15) } });
  assert.equal(screen.battle, battle, 'nothing spent');
  // A tap on the other pirate shows the Mark at it instead...
  screen = reduceFight(screen, { type: 'fight/tap', x: 7, y: 0 }, rules);
  assert.equal(screen.preview.at, 'e1');
  assert.equal(screen.battle, battle);
  // ...and a second tap on it takes it.
  screen = reduceFight(screen, { type: 'fight/tap', x: 7, y: 0 }, rules);
  assert.deepEqual(who(screen.battle, 'e1').mark, { aim: 15, turns: 2 });
  assert.equal(screen.preview, null);
  assert.equal(who(screen.battle, 'c1').uses, 1);
  // A dart's preview carries its odds, as a shot's does.
  screen = reduceFight(screen, { type: 'fight/select', unit: 'c2' }, rules);
  screen = reduceFight(screen, { type: 'fight/order', at: 'e1' }, rules);
  assert.deepEqual(screen.preview.odds, dartOdds(screen.battle, who(screen.battle, 'c2'), who(screen.battle, 'e1'), rules));
  screen = reduceFight(screen, { type: 'fight/confirm' }, rules);
  assert.equal(who(screen.battle, 'c2').uses, 1, 'Fire takes the order shown');
});

test("a Suppress shows what it does to the enemy's best shot at the crew", () => {
  const battle = fight(openMap(8, 2), [{ kind: 'marine', x: 0, y: 0 }, { kind: 'medic', x: 3, y: 1 }, { kind: 'pirate', x: 7, y: 0 }]);
  let screen = reduceFight(createFight(battle, rules), { type: 'fight/select', unit: 'c1' }, rules);
  screen = reduceFight(screen, { type: 'fight/order' }, rules);
  const pirate = who(battle, 'e1');
  const best = Math.max(...['c1', 'c2'].map((id) => shotOdds(battle, pirate, who(battle, id), rules).hit));
  const at = shotOdds(battle, pirate, who(battle, 'c2'), rules).hit === best ? 'c2' : 'c1';
  assert.deepEqual(screen.preview.change, { shooter: 'e1', target: at, was: best, now: Math.max(0, best - 30) });
  // A Patch, a Hustle or a Kit out changes no odds.
  const kit = fight(openMap(4, 1), [{ kind: 'quartermaster', x: 0, y: 0 }, { kind: 'pirate', x: 3, y: 0 }]);
  const kitting = reduceFight(reduceFight(createFight(kit, rules), { type: 'fight/select', unit: 'c1' }, rules), { type: 'fight/order' }, rules);
  assert.deepEqual([kitting.preview.at, kitting.preview.change], ['c1', null]);
});

test("an order that can't be used now isn't offered, and pressing it says why", () => {
  const battle = fight(openMap(6, 1), [{ kind: 'medic', x: 0, y: 0 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  let screen = reduceFight(createFight(battle, rules), { type: 'fight/select', unit: 'c1' }, rules);
  assert.equal(ordersFor(screen, rules).order, null, 'no one beside is hurt');
  screen = reduceFight(screen, { type: 'fight/order' }, rules);
  assert.equal(screen.notice.text, 'No one beside Medic needs patching.');
  assert.equal(screen.preview, null);
  // Hurt, the marine is the one.
  const hurt = tweak(structuredClone(battle), { c2: { hp: 5 } });
  let healing = reduceFight(createFight(hurt, rules), { type: 'fight/select', unit: 'c1' }, rules);
  healing = reduceFight(reduceFight(healing, { type: 'fight/order' }, rules), { type: 'fight/order' }, rules);
  assert.equal(who(healing.battle, 'c2').hp, 8);
});
