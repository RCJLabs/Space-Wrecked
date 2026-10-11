import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction, bestPlan, harm, OPEN_SHOT, plansFor } from '../src/sim/ai.js';
import { autoplay } from '../src/sim/autoplay.js';
import { act, createBattle } from '../src/sim/battle.js';
import { coverFrom } from '../src/sim/cover.js';
import { deploy } from '../src/sim/deploy.js';
import { edgeKey, wallAt } from '../src/sim/mapFromShip.js';
import { sideToward } from '../src/sim/moves.js';
import { scriptedAction } from '../src/sim/scripted.js';
import { canSee } from '../src/sim/sight.js';
import { exampleMap, openMap, put, rules, wall } from './battleKit.js';

// A battle on a small map where the enemy (the AI) moves first.
function enemyFirst(map, units, seed = 1) {
  return createBattle({ map, units, seed, first: 'enemy' }, rules).battle;
}

// The AI's whole turn for its first unit: its actions and their events,
// and the battle after.
function aiTurn(battle) {
  const id = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0).id;
  const actions = [];
  const events = [];
  while (!battle.winner && battle.side === 'enemy' && battle.units.find((u) => u.id === id).ap > 0) {
    const action = aiAction(battle, rules);
    const result = act(battle, action, rules);
    assert.ok(result.ok, result.error);
    actions.push(action);
    events.push(...result.events);
    battle = result.battle;
  }
  return { actions, events, battle };
}

const unit = (battle, id) => battle.units.find((u) => u.id === id);
const coverOf = (battle, id, from) => coverFrom(battle, [unit(battle, id).x, unit(battle, id).y], [unit(battle, from).x, unit(battle, from).y], rules);

test('it takes cover to shoot: behind a crate rather than in the open', () => {
  // A room with one crate; a marine across it in the open. The pirate can
  // shoot from anywhere it can see the marine, but only beside the crate
  // does it have cover.
  const map = put(openMap(9, 5), 4, 1, 'half cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 8, y: 2 }, { kind: 'pirate', x: 2, y: 2 }]);
  const { actions, battle } = aiTurn(start);
  assert.equal(actions[0].type, 'move');
  assert.deepEqual(coverOf(battle, 'e1', 'c1'), { cover: 'half', flanked: false }, `it stopped at (${actions[0].to})`);
  assert.deepEqual(actions.at(-1), { type: 'shoot', unit: 'e1', target: 'c1' });
});

test('it takes the best cover it can shoot from: a locker before a crate', () => {
  // The marine is to the north-east, at mid range from both spots. A crate
  // at (6, 1) covers (6, 2) from the north; a locker at (5, 3) covers
  // (5, 4) from the north, and the shot from there passes beside it.
  const map = put(put(openMap(12, 6), 6, 1, 'half cover'), 5, 3, 'full cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 11, y: 1 }, { kind: 'pirate', x: 4, y: 3 }]);
  const { actions, battle } = aiTurn(start);
  assert.deepEqual(actions[0], { type: 'move', unit: 'e1', to: [5, 4] });
  assert.equal(coverOf(battle, 'e1', 'c1').cover, 'full');
  assert.deepEqual(actions.at(-1), { type: 'shoot', unit: 'e1', target: 'c1' });
});

test('it flanks: round the marine\'s crate to a spot with cover of its own', () => {
  // The marine at (6, 2) has a crate to its west, so from the west it is
  // in half cover. From (7, 0), north-east of it, it has none, and a crate
  // at (6, 0) covers the pirate there from the west.
  const map = put(put(openMap(9, 4), 5, 2, 'half cover'), 6, 0, 'half cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 6, y: 2 }, { kind: 'pirate', x: 4, y: 1 }]);
  assert.equal(coverOf(start, 'c1', 'e1').cover, 'half', 'where the pirate starts, the marine has cover');
  const { actions, events, battle } = aiTurn(start);
  assert.deepEqual(actions[0], { type: 'move', unit: 'e1', to: [7, 0] });
  assert.equal(coverOf(battle, 'c1', 'e1').flanked, true, 'the marine is flanked');
  assert.equal(coverOf(battle, 'e1', 'c1').cover, 'half', 'and the pirate is in cover');
  const shot = events.find((e) => e.type === 'shot');
  assert.equal(shot.target, 'c1');
  assert.equal(shot.cover, null);
});

test('it picks the target it can do most harm to: the one in the open', () => {
  // Two marines the same distance off, one behind a crate.
  const map = put(openMap(9, 5), 6, 3, 'half cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 7, y: 1 }, { kind: 'marine', x: 7, y: 3 }, { kind: 'pirate', x: 3, y: 2 }]);
  const { events } = aiTurn(start);
  assert.equal(events.find((e) => e.type === 'shot').target, 'c1');
});

test('a hit that would kill is worth more than the damage alone', () => {
  const map = openMap(9, 3);
  const { battle } = createBattle({ map, units: [{ kind: 'pirate', x: 1, y: 1 }, { kind: 'marine', x: 5, y: 1 }], seed: 1 }, rules);
  const [pirate, marine] = [unit(battle, 'e1'), unit(battle, 'c1')];
  const healthy = harm(battle, pirate, marine, rules);
  const dying = harm(battle, pirate, { ...marine, hp: 1 }, rules);
  assert.ok(dying > healthy, `${dying} against ${healthy}`);
});

test('with no shot in reach it moves up and watches: the overwatch fallback', () => {
  // A room cut by a row of lockers with a gap at the bottom; the marine
  // waits just behind them, a few steps off. No tile one move away sees it,
  // and a dash would leave no action to shoot with.
  const map = openMap(12, 4);
  for (const y of [0, 1, 2]) put(map, 6, y, 'full cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 8, y: 0 }, { kind: 'pirate', x: 2, y: 1 }]);
  const { actions, battle } = aiTurn(start);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].type, 'move');
  assert.deepEqual(actions[1], { type: 'overwatch', unit: 'e1' });
  const pirate = unit(battle, 'e1');
  assert.ok(!canSee(battle, [8, 0], [pirate.x, pirate.y], rules) || !coverOf(battle, 'e1', 'c1').flanked, 'not in the open');
});

test('with the enemy far off and out of sight, it pushes on instead of watching', () => {
  const map = openMap(20, 4);
  for (const y of [0, 1, 2]) put(map, 12, y, 'full cover');
  const start = enemyFirst(map, [{ kind: 'marine', x: 16, y: 0 }, { kind: 'pirate', x: 1, y: 1 }]);
  const { actions, battle } = aiTurn(start);
  assert.deepEqual(actions.map((a) => a.type), ['move']);
  assert.ok(unit(battle, 'e1').x >= 7, 'a dash');
});

test('it breaches: opens the door beside it and shoots through, drawing no overwatch fire', () => {
  // Two rooms with a closed door between; the marine on overwatch watches
  // the doorway from the far side.
  const map = wall(wall(wall(openMap(10, 3), 4, 0, 'e'), 4, 1, 'e', 'door'), 4, 2, 'e');
  const start = enemyFirst(map, [{ kind: 'marine', x: 8, y: 1 }, { kind: 'pirate', x: 4, y: 1 }]);
  start.units[0].overwatch = true;
  const { actions, events } = aiTurn(start);
  assert.deepEqual(actions[0], { type: 'open', unit: 'e1', side: 'e' });
  assert.deepEqual(actions[1], { type: 'shoot', unit: 'e1', target: 'c1' });
  assert.equal(events.filter((e) => e.type === 'shot' && e.overwatch).length, 0);
  assert.ok(events.some((e) => e.type === 'door'));
});

test('it reloads an empty gun first', () => {
  const battle = enemyFirst(openMap(6, 3), [{ kind: 'marine', x: 5, y: 1 }, { kind: 'pirate', x: 1, y: 1 }]);
  battle.units[1].ammo = 0;
  assert.deepEqual(aiAction(battle, rules), { type: 'reload', unit: 'e1' });
});

test('the same battle always gets the same plan, and planning changes nothing', () => {
  const map = exampleMap();
  const start = createBattle({ map, units: deploy(map, rules.squad, rules.encounters.get('boarders').enemies, rules).units, seed: 5, first: 'enemy' }, rules).battle;
  const copy = JSON.parse(JSON.stringify(start));
  assert.deepEqual(aiAction(start, rules), aiAction(copy, rules));
  assert.deepEqual(start, copy);
});

// The boarding party against the squad on the example ship, the boarders
// played by the AI and the crew by the AI or the scripted player.
function boardings(crew, seeds) {
  const map = exampleMap();
  const units = deploy(map, rules.squad, rules.encounters.get('boarders').enemies, rules).units;
  return seeds.map((seed) => ({ seed, setup: { map, units, seed }, players: { crew, enemy: aiTurnPlayer } }));
}

// The AI as a player, checking every plan it makes as it goes (see below).
const decisions = [];
function aiTurnPlayer(battle) {
  const actor = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (actor && actor.ammo > 0) decisions.push({ battle, actor, plans: plansFor(battle, actor, rules) });
  return aiAction(battle, rules);
}

const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

test('boarding fights end: against the scripted crew, and AI against AI', () => {
  for (const crew of [scriptedAction, aiAction]) {
    const won = { crew: 0, enemy: 0, none: 0 };
    for (const { setup, players } of boardings(crew, seeds)) won[autoplay(setup, rules, players, { maxRounds: 30 }).battle.winner ?? 'none'] += 1;
    assert.equal(won.none, 0, JSON.stringify(won));
    assert.ok(won.crew > 0 && won.enemy > 0, `both sides win some: ${JSON.stringify(won)}`);
  }
});

test('boarders breach from the airlock: within two rounds they have fired', () => {
  for (const { seed, setup, players } of boardings(aiAction, seeds)) {
    const { events } = autoplay(setup, rules, players, { maxRounds: 2 });
    assert.ok(events.some((e) => e.type === 'shot' && e.unit.startsWith('e')), `seed ${seed}`);
  }
});

// Never in the open without a reason: whenever the AI's plan leaves a unit
// where an enemy sees it with no cover between (worked out here from the
// rules, not taken from the plan), either no plan at all was covered, or
// that plan is a shot better than any covered plan's. Checked for every
// decision in 60 fights.
test('it never stands in the open without a reason', () => {
  decisions.length = 0;
  for (const crew of [scriptedAction, aiAction]) for (const { setup, players } of boardings(crew, seeds)) autoplay(setup, rules, players, { maxRounds: 30 });
  let open = 0;
  for (const { battle, actor, plans } of decisions) {
    const plan = bestPlan(plans);
    // The doors as they'll be: the one it opens, or those its walk opens.
    const opened = plan.open ? [edgeKey(actor.x, actor.y, plan.open)] : [];
    for (let i = 1; i < plan.path.length; i++) {
      const side = sideToward(plan.path[i - 1], plan.path[i]);
      if (wallAt(battle.map, ...plan.path[i - 1], side) === 'door') opened.push(edgeKey(...plan.path[i - 1], side));
    }
    const field = { ...battle, doors: [...new Set([...battle.doors, ...opened])] };
    const exposed = (p) =>
      battle.units.some((f) => f.side !== actor.side && f.status === 'active' && canSee(field, [f.x, f.y], p.to, rules) && coverFrom(field, p.to, [f.x, f.y], rules).flanked);
    if (!exposed(plan)) continue;
    open += 1;
    const covered = plans.filter((p) => !p.exposed.length);
    const bestCovered = Math.max(-Infinity, ...covered.filter((p) => p.then?.type === 'shoot').map((p) => p.attack));
    const reason = !covered.length || (plan.then?.type === 'shoot' && plan.attack > bestCovered && plan.attack >= OPEN_SHOT);
    assert.ok(reason, `${actor.id} at (${actor.x}, ${actor.y}) to (${plan.to}) ${JSON.stringify(plan.then)}`);
  }
  assert.ok(decisions.length > 500, `${decisions.length} decisions, ${open} in the open with a reason`);
});
