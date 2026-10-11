import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { act, createBattle, playBattle } from '../src/sim/battle.js';
import { wallAt } from '../src/sim/mapFromShip.js';
import { walkable } from '../src/sim/terrain.js';
import { BATTLE_FIXTURE, EXAMPLE_BATTLE, GOLDEN_BATTLE, logText, playScripted } from '../tools/battle-log.js';
import { exampleMap, rules } from './battleKit.js';

const fixture = JSON.parse(readFileSync(BATTLE_FIXTURE, 'utf8'));
const setup = (extra = {}) => ({ map: exampleMap(), seed: fixture.seed, units: fixture.units, ...extra });

test('the example battle replays identically: the same log as the golden one', () => {
  // To change it on purpose: node tools/battle-log.js --golden, and say so
  // in PROGRESS.md.
  const run = playBattle(setup(), fixture.actions, rules);
  assert.equal(run.error, null);
  assert.equal(logText(run.events, run.battle), readFileSync(GOLDEN_BATTLE, 'utf8'));
  assert.equal(run.battle.winner, 'crew');
});

test('replaying it again gives the very same battle and events, even through JSON', () => {
  const once = playBattle(setup(), fixture.actions, rules);
  assert.deepEqual(playBattle(setup(), fixture.actions, rules), once);
  const copied = JSON.parse(JSON.stringify({ start: setup(), actions: fixture.actions }));
  assert.deepEqual(playBattle(copied.start, copied.actions, rules), once);
  assert.deepEqual(JSON.parse(JSON.stringify(once.battle)), once.battle, 'a battle is plain data');
});

test('the scripted player still plays the example battle the same way', () => {
  assert.deepEqual({ seed: fixture.seed, units: fixture.units }, EXAMPLE_BATTLE);
  assert.deepEqual(playScripted(setup(), rules).actions, fixture.actions);
});

// What must hold after every action.
function checkBattle(battle, where) {
  const { balance } = rules;
  const taken = new Set();
  for (const u of battle.units) {
    const at = `${where}: ${u.id}`;
    assert.ok(['active', 'down', 'stable', 'dead', 'out'].includes(u.status), at);
    assert.ok(u.hp >= 0 && u.hp <= u.maxHp, `${at} hp ${u.hp}`);
    assert.ok(u.ammo >= 0 && u.ammo <= rules.weapons.get(u.weapon).clip, `${at} ammo ${u.ammo}`);
    assert.ok(u.ap >= 0 && u.ap <= balance.actionPoints, `${at} ap ${u.ap}`);
    assert.ok(u.air >= 0 && u.air <= balance.suitAir, `${at} air ${u.air}`);
    assert.equal(u.status === 'active', u.hp > 0, `${at}: active exactly while it has hit points`);
    if (u.status !== 'active') assert.deepEqual([u.ap, u.overwatch], [0, false], at);
    if (u.side !== battle.side) assert.equal(u.ap, 0, `${at}: not its turn`);
    assert.equal(u.status === 'down', u.bleed > 0, at);
    assert.ok(walkable(battle, u.x, u.y, rules), `${at} on (${u.x}, ${u.y})`);
    if (u.status === 'dead') continue;
    assert.ok(!taken.has(`${u.x},${u.y}`), `${at}: two units on (${u.x}, ${u.y})`);
    taken.add(`${u.x},${u.y}`);
  }
  assert.deepEqual(battle.doors, [...new Set(battle.doors)].sort(), `${where}: doors`);
  for (const key of battle.doors) {
    const [x, y, side] = key.split(',');
    assert.equal(wallAt(battle.map, Number(x), Number(y), side), 'door', `${where}: ${key}`);
  }
  const standing = (side) => battle.units.some((u) => u.side === side && u.status === 'active');
  assert.equal(battle.winner !== null, !standing('crew') || !standing('enemy'), `${where}: winner`);
}

// The scripted player shoots whatever it can see, at any odds, so a battle
// can end in two units trading long shots forever. Most end, though, and a
// rule that left both sides stuck (as doors did before units could open
// them) would show here.
test('scripted battles from many seeds keep the rules after every action, and replay identically', () => {
  const won = { crew: 0, enemy: 0, none: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const start = setup({ seed });
    const scripted = playScripted(start, rules, { maxRounds: 20 });
    let { battle } = createBattle(start, rules);
    checkBattle(battle, `seed ${seed}, start`);
    for (const [i, action] of scripted.actions.entries()) {
      const result = act(battle, action, rules);
      assert.ok(result.ok, `seed ${seed}, action ${i}: ${result.error}`);
      battle = result.battle;
      checkBattle(battle, `seed ${seed}, action ${i}`);
    }
    assert.deepEqual(battle, scripted.battle);
    assert.deepEqual(playBattle(start, scripted.actions, rules).events, scripted.events);
    won[battle.winner ?? 'none'] += 1;
  }
  assert.ok(won.none <= 4, `most battles end within 20 rounds: ${JSON.stringify(won)}`);
  assert.ok(won.crew > 0 && won.enemy > 0, `both sides win some: ${JSON.stringify(won)}`);
});
