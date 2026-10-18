// M38's missions (src/sim/objectives.js): extract, escort, rescue, sabotage
// and defend, each in a small yard, and the ward: the person the crew brings
// out, on the crew's side with no gun, who doesn't count as crew.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { aiAction } from '../src/sim/ai.js';
import { act, createBattle, objectiveDone, targetsFor } from '../src/sim/battle.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { campaignProblems, newCampaign, saveFight } from '../src/sim/campaign.js';
import { jobSetup, takeJob, withBoard } from '../src/sim/contracts.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { generateSite } from '../src/sim/gen/site.js';
import { jobAction } from '../src/sim/jobAi.js';
import { drawn, rules } from './battleKit.js';

// An open yard, 8 × 4, with crates at (2, 1) and (5, 1).
const yard = () =>
  drawn(`
+-+-+-+-+-+-+-+-+
|. . . . . . . .|
+               +
|. . h . . h . .|
+               +
|. . . . . . . .|
+               +
|. . . . . . . .|
+-+-+-+-+-+-+-+-+
`);
const WEST = [[0, 0], [0, 1], [0, 2], [0, 3]];
const start = (objective, units) => createBattle({ map: yard(), units, seed: 5, objective }, rules).battle;
const play = (battle, action) => {
  const result = act(battle, action, rules);
  assert.ok(result.ok, result.error);
  return result;
};
const refuse = (battle, action, pattern) => {
  const result = act(battle, action, rules);
  assert.ok(!result.ok, `${JSON.stringify(action)} should be refused`);
  assert.match(result.error, pattern);
};
// Both sides end their turns: back to the crew's, a round on.
const nextRound = (battle) => {
  let next = play(battle, { type: 'end' }).battle;
  while (!next.winner && next.side !== 'crew') next = play(next, { type: 'end' }).battle;
  return next;
};
const unit = (battle, id) => battle.units.find((u) => u.id === id);
const lastOver = (events) => events.findLast((event) => event.type === 'over');

test('each new objective starts with nothing done, and reads back from a save', () => {
  const crew = [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }];
  const cases = [
    [{ type: 'extract', crates: [[2, 1]], exits: WEST }, { type: 'extract', crates: [[2, 1]], taken: [], out: [], exits: WEST }],
    [{ type: 'escort', ward: 'w1', exits: [[7, 0]] }, { type: 'escort', ward: 'w1', exits: [[7, 0]], out: false }],
    [{ type: 'rescue', ward: 'w1', exits: WEST }, { type: 'rescue', ward: 'w1', exits: WEST, freed: false, out: false }],
    [{ type: 'sabotage', targets: [[2, 1], [5, 1]], left: 3 }, { type: 'sabotage', targets: [[2, 1], [5, 1]], charges: [], blown: [], left: 3 }],
    [{ type: 'defend', rounds: 4, line: WEST }, { type: 'defend', rounds: 4, line: WEST, held: false, through: null }],
  ];
  for (const [given, fresh] of cases) {
    const ward = given.ward ? [{ kind: given.type === 'rescue' ? 'captive' : 'client', x: 6, y: 0, name: 'Linnet', held: given.type === 'rescue' }] : [];
    const battle = start(given, [...crew, ...ward]);
    assert.deepEqual(battle.objective, fresh, given.type);
    assert.ok(!objectiveDone(battle.objective), `${given.type}: nothing done yet`);
    assert.equal(battleProblem(battle), null, `${given.type}: reads back`);
  }
});

test('a ward is on the crew\'s side with no gun, and held until freed on a rescue', () => {
  const battle = start({ type: 'rescue', ward: 'w1', exits: WEST }, [
    { kind: 'marine', x: 1, y: 2 },
    { kind: 'pirate', x: 7, y: 3 },
    { kind: 'captive', x: 6, y: 0, name: 'Nell Prewitt', held: true },
  ]);
  const ward = unit(battle, 'w1');
  assert.deepEqual(
    { side: ward.side, ward: ward.ward, weapon: ward.weapon, ammo: ward.ammo, status: ward.status, name: ward.name, hp: ward.hp, mobility: ward.mobility },
    { side: 'crew', ward: true, weapon: null, ammo: 0, status: 'held', name: 'Nell Prewitt', hp: rules.people.get('captive').hp, mobility: rules.people.get('captive').mobility },
  );
  // Held, they can't be shot: the pirate has a clear line, and no target.
  assert.ok(!targetsFor(battle, unit(battle, 'e1'), rules).some((t) => t.target.id === 'w1'));
  assert.deepEqual(targetsFor(battle, ward, rules), [], 'and they shoot no one');
  assert.throws(() => start(null, [{ kind: 'ghost', x: 0, y: 0 }]), /no job, person or enemy "ghost"/);
});

test('extract: a crate in hand goes out the way in, one move a turn and no dash', () => {
  const objective = { type: 'extract', crates: [[2, 1], [5, 1]], exits: WEST };
  let battle = start(objective, [{ kind: 'marine', x: 3, y: 1 }, { kind: 'medic', x: 6, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  let result = play(battle, { type: 'grab', unit: 'c1', at: [2, 1] });
  battle = result.battle;
  assert.deepEqual(unit(battle, 'c1').carrying, [2, 1]);
  assert.deepEqual(battle.objective.taken, [[2, 1]]);
  assert.deepEqual(result.events, [{ type: 'grab', unit: 'c1', at: [2, 1], left: 1 }]);
  refuse(battle, { type: 'grab', unit: 'c1', at: [2, 1] }, /picked up already|crate in hand/);
  battle = play(battle, { type: 'grab', unit: 'c2', at: [5, 1] }).battle;
  battle = nextRound(battle);
  // Five steps to (0, 3) is past a marine's one move of 4: no dash with a crate.
  refuse(battle, { type: 'move', unit: 'c1', to: [0, 3] }, /can't get to \(0, 3\)/);
  battle = play(battle, { type: 'move', unit: 'c1', to: [1, 2] }).battle;
  assert.equal(unit(battle, 'c1').hauled, true);
  assert.equal(unit(battle, 'c1').ap, 1, 'a move takes one action');
  refuse(battle, { type: 'move', unit: 'c1', to: [0, 2] }, /crate in hand: one move a turn/);
  assert.equal(battleProblem(battle), null, 'a carrier mid-turn reads back');
  battle = nextRound(battle);
  assert.equal(unit(battle, 'c1').hauled, undefined, 'a new turn, a new move');
  result = play(battle, { type: 'move', unit: 'c1', to: [0, 2] });
  battle = result.battle;
  assert.deepEqual(battle.objective.out, [[2, 1]]);
  assert.equal(unit(battle, 'c1').carrying, undefined);
  assert.deepEqual(result.events.at(-1), { type: 'out', unit: 'c1', at: [0, 2], crate: [2, 1], left: 1 });
  assert.equal(battle.winner, null, 'one crate still to go');
  // The medic walks the other out over two turns, and that wins the job.
  battle = play(battle, { type: 'move', unit: 'c2', to: [2, 0] }).battle;
  battle = nextRound(battle);
  result = play(battle, { type: 'move', unit: 'c2', to: [0, 0] });
  assert.ok(objectiveDone(result.battle.objective));
  assert.equal(result.battle.winner, 'crew');
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'crew', reason: 'objective' });
});

test('extract: a carrier who goes down keeps the crate, and anyone beside can take it', () => {
  const objective = { type: 'extract', crates: [[2, 1]], exits: WEST };
  let battle = start(objective, [{ kind: 'marine', x: 3, y: 1 }, { kind: 'medic', x: 5, y: 2 }, { kind: 'pirate', x: 7, y: 3 }]);
  battle = play(battle, { type: 'grab', unit: 'c1', at: [2, 1] }).battle;
  // The marine goes down where they stand.
  battle = { ...battle, units: battle.units.map((u) => (u.id === 'c1' ? { ...u, hp: 0, status: 'down', bleed: 3, ap: 0 } : u)) };
  assert.deepEqual(unit(battle, 'c1').carrying, [2, 1], 'down, still holding it');
  refuse(battle, { type: 'grab', unit: 'c2', at: [3, 1] }, /has to be next to/);
  battle = play(battle, { type: 'move', unit: 'c2', to: [4, 2] }).battle;
  const result = play(battle, { type: 'grab', unit: 'c2', at: [3, 1] });
  assert.deepEqual(unit(result.battle, 'c2').carrying, [2, 1]);
  assert.equal(unit(result.battle, 'c1').carrying, undefined);
  assert.deepEqual(result.events[0], { type: 'grab', unit: 'c2', at: [3, 1], from: 'c1', left: 0 });
  assert.equal(battleProblem(result.battle), null);
});

test('escort: the client walks to the far gate; they can only move, and if they bleed out the job is lost', () => {
  const objective = { type: 'escort', ward: 'w1', exits: [[7, 0], [7, 1]] };
  const units = [{ kind: 'marine', x: 1, y: 2 }, { kind: 'medic', x: 1, y: 3 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'client', x: 0, y: 0, name: 'Linnet Shaw' }];
  let battle = start(objective, units);
  refuse(battle, { type: 'shoot', unit: 'w1', target: 'e1' }, /Linnet Shaw has no gun: they can only move/);
  refuse(battle, { type: 'overwatch', unit: 'w1' }, /no gun/);
  // A dash along the top row, 7 steps of the client's 10, ends at the gate.
  const result = play(battle, { type: 'move', unit: 'w1', to: [7, 0] });
  assert.deepEqual(result.events.findLast((e) => e.type === 'out'), { type: 'out', unit: 'w1', at: [7, 0] });
  assert.equal(result.battle.objective.out, true);
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'crew', reason: 'objective' });

  // Bled out, the job is lost, whoever is standing.
  battle = start(objective, units);
  battle = play(battle, { type: 'end' }).battle;
  battle = { ...battle, units: battle.units.map((u) => (u.id === 'w1' ? { ...u, hp: 0, status: 'down', bleed: 1 } : u)) };
  const lost = play(battle, { type: 'end' });
  assert.equal(unit(lost.battle, 'w1').status, 'out');
  assert.deepEqual(lastOver(lost.events), { type: 'over', winner: 'enemy', reason: 'ward' });
});

test('a ward doesn\'t count as crew: with the crew all down the job is lost, and with the enemy down it is won', () => {
  const objective = { type: 'escort', ward: 'w1', exits: [[7, 0]] };
  let battle = start(objective, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'client', x: 0, y: 0, name: 'Linnet Shaw' }]);
  battle = play(battle, { type: 'end' }).battle;
  battle = { ...battle, units: battle.units.map((u) => (u.id === 'c1' ? { ...u, hp: 0, status: 'out' } : u)) };
  let result = play(battle, { type: 'end' });
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'enemy' }, 'the client alone is no crew');
  // With the pirate down, the site is the crew's: won, the client still walking.
  battle = start(objective, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'client', x: 0, y: 0, name: 'Linnet Shaw' }]);
  battle = play(battle, { type: 'end' }).battle;
  battle = { ...battle, units: battle.units.map((u) => (u.id === 'e1' ? { ...u, hp: 0, status: 'dead' } : u)) };
  result = play(battle, { type: 'end' });
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'crew' });
});

test('rescue: the captive is freed from beside them, moves at once, and walks out the way in', () => {
  const objective = { type: 'rescue', ward: 'w1', exits: WEST };
  let battle = start(objective, [{ kind: 'marine', x: 3, y: 0 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'captive', x: 6, y: 0, name: 'Nell Prewitt', held: true }]);
  refuse(battle, { type: 'free', unit: 'c1' }, /has to be next to Nell Prewitt/);
  battle = play(battle, { type: 'move', unit: 'c1', to: [5, 0] }).battle;
  const result = play(battle, { type: 'free', unit: 'c1' });
  battle = result.battle;
  assert.deepEqual(result.events, [{ type: 'free', unit: 'c1', target: 'w1' }]);
  assert.equal(unit(battle, 'w1').status, 'active');
  assert.equal(battle.objective.freed, true);
  assert.equal(unit(battle, 'w1').ap, rules.balance.actionPoints, 'freed, they move at once');
  assert.equal(battle.side, 'crew', 'the crew\'s turn goes on: the captive has actions');
  const ended = play(battle, { type: 'move', unit: 'w1', to: [0, 0] });
  assert.deepEqual(lastOver(ended.events), { type: 'over', winner: 'crew', reason: 'objective' });
});

test('sabotage: a charge blows as the crew\'s next turn starts, hurting everyone beside it; an enemy can pull one', () => {
  const objective = { type: 'sabotage', targets: [[2, 1], [5, 1]] };
  let battle = start(objective, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'medic', x: 6, y: 2 }, { kind: 'pirate', x: 4, y: 0 }]);
  let result = play(battle, { type: 'plant', unit: 'c1', at: [2, 1] });
  battle = result.battle;
  assert.deepEqual(result.events, [{ type: 'plant', unit: 'c1', at: [2, 1], blows: 2 }]);
  assert.deepEqual(battle.objective.charges, [{ at: [2, 1], blows: 2 }]);
  refuse(battle, { type: 'plant', unit: 'c1', at: [2, 1] }, /charge is set there already/);
  refuse(battle, { type: 'plant', unit: 'c1', at: [5, 1] }, /has to be next to the target/);
  battle = play(battle, { type: 'move', unit: 'c1', to: [0, 3] }).battle;
  battle = play(battle, { type: 'plant', unit: 'c2', at: [5, 1] }).battle;
  assert.equal(battleProblem(battle), null, 'charges set read back');
  // The pirate pulls the medic's charge, from a corner, then steps beside
  // the marine's.
  battle = play(battle, { type: 'end' }).battle;
  refuse(battle, { type: 'pull', unit: 'e1', at: [2, 1] }, /has to be next to the charge/);
  refuse(battle, { type: 'plant', unit: 'e1', at: [2, 1] }, /no target there/);
  battle = play(battle, { type: 'pull', unit: 'e1', at: [5, 1] }).battle;
  assert.deepEqual(battle.objective.charges, [{ at: [2, 1], blows: 2 }]);
  const hp = unit(battle, 'e1').hp;
  // Its last action ends its turn, and round 2 opens with the marine's
  // charge blowing, the pirate beside it.
  result = play(battle, { type: 'move', unit: 'e1', to: [3, 0] });
  battle = result.battle;
  const blast = result.events.find((e) => e.type === 'blast');
  assert.deepEqual(blast, { type: 'blast', at: [2, 1], units: ['e1'], damage: rules.balance.blastDamage });
  assert.equal(unit(battle, 'e1').hp, Math.max(0, hp - rules.balance.blastDamage));
  assert.deepEqual(battle.objective.blown, [[2, 1]]);
  assert.deepEqual(battle.objective.charges, []);
  refuse(battle, { type: 'plant', unit: 'c1', at: [2, 1] }, /blown already|has to be next/);
  assert.ok(!objectiveDone(battle.objective), 'one target still to blow');
});

test('sabotage: the crew has so many charges, and one pulled is gone', () => {
  let battle = start({ type: 'sabotage', targets: [[2, 1]], left: 1 }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 3, y: 1 }]);
  battle = play(battle, { type: 'plant', unit: 'c1', at: [2, 1] }).battle;
  assert.equal(battle.objective.left, 0);
  battle = play(battle, { type: 'end' }).battle;
  battle = play(battle, { type: 'pull', unit: 'e1', at: [2, 1] }).battle;
  battle = nextRound(battle);
  refuse(battle, { type: 'plant', unit: 'c1', at: [2, 1] }, /no charges left/);
  assert.equal(ordersFor(createFight(battle, rules), rules).plant, null, 'no Plant with none left');
  assert.equal(battle.winner, null, 'the job goes on: down everyone, and the crew still wins');
});

test('sabotage: the blast hurts the crew too, and the last target blown wins the job', () => {
  const objective = { type: 'sabotage', targets: [[2, 1]] };
  let battle = start(objective, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'medic', x: 2, y: 2 }, { kind: 'pirate', x: 7, y: 3 }]);
  battle = play(battle, { type: 'plant', unit: 'c1', at: [2, 1] }).battle;
  const hp = unit(battle, 'c2').hp;
  const result = play(play(battle, { type: 'end' }).battle, { type: 'end' });
  const blast = result.events.find((e) => e.type === 'blast');
  assert.deepEqual(blast?.units, ['c1', 'c2'], 'both beside it, both hurt');
  assert.ok(unit(result.battle, 'c2').hp < hp);
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'crew', reason: 'objective' });
});

test('defend: an enemy stepping onto the way in breaks through; held to the last round, the crew has won', () => {
  const objective = { type: 'defend', rounds: 2, line: WEST };
  let battle = start(objective, [{ kind: 'marine', x: 0, y: 3 }, { kind: 'pirate', x: 2, y: 0 }]);
  battle = play(battle, { type: 'end' }).battle;
  const result = play(battle, { type: 'move', unit: 'e1', to: [0, 1] });
  assert.ok(result.events.some((e) => e.type === 'through' && e.unit === 'e1'));
  assert.equal(result.battle.objective.through, 'e1');
  assert.deepEqual(lastOver(result.events), { type: 'over', winner: 'enemy', reason: 'through' });
  // Held: two rounds, both sides only ending their turns.
  battle = start(objective, [{ kind: 'marine', x: 0, y: 3 }, { kind: 'pirate', x: 7, y: 0 }]);
  battle = nextRound(battle);
  assert.equal(battle.winner, null, 'round 1 is not the last');
  const held = play(play(battle, { type: 'end' }).battle, { type: 'end' });
  assert.equal(held.battle.objective.held, true);
  assert.deepEqual(lastOver(held.events), { type: 'over', winner: 'crew', reason: 'held' });
});

test('the Fight screen offers Grab, Free and Plant in reach, and a ward only moves', () => {
  const extract = createFight(start({ type: 'extract', crates: [[2, 1]], exits: WEST }, [{ kind: 'marine', x: 3, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]), rules);
  assert.deepEqual(ordersFor(extract, rules).grab, [2, 1]);
  const carried = reduceFight(extract, { type: 'fight/grab' }, rules);
  assert.deepEqual(unit(carried.battle, 'c1').carrying, [2, 1]);
  assert.ok([...ordersFor(carried, rules).reach.values()].every((spot) => !spot.dash && spot.cost <= 4), 'a carrier: one move, no dash');

  const rescue = createFight(start({ type: 'rescue', ward: 'w1', exits: WEST }, [{ kind: 'marine', x: 5, y: 0 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'captive', x: 6, y: 0, name: 'Nell Prewitt', held: true }]), rules);
  assert.equal(ordersFor(rescue, rules).free, true);
  const freed = reduceFight(rescue, { type: 'fight/free' }, rules);
  assert.equal(unit(freed.battle, 'w1').status, 'active');

  const sabotage = createFight(start({ type: 'sabotage', targets: [[2, 1]] }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]), rules);
  assert.deepEqual(ordersFor(sabotage, rules).plant, [2, 1]);
  const planted = reduceFight(sabotage, { type: 'fight/plant' }, rules);
  assert.equal(planted.battle.objective.charges.length, 1);
  assert.equal(ordersFor(planted, rules).plant, null, 'one charge a target');

  const escort = createFight(start({ type: 'escort', ward: 'w1', exits: [[7, 0]] }, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'client', x: 0, y: 0, name: 'Linnet Shaw' }]), rules);
  const client = reduceFight(escort, { type: 'fight/select', unit: 'w1' }, rules);
  const orders = ordersFor(client, rules);
  assert.equal(orders.unit.id, 'w1');
  assert.ok(orders.reach.size > 0, 'they can walk');
  assert.deepEqual([orders.targets, orders.overwatch, orders.reload, orders.grab, orders.order], [[], false, false, null, null]);
  assert.match(reduceFight(client, { type: 'fight/aim', target: 'e1' }, rules).notice.text, /Linnet Shaw has no gun/);
});

test('a job sets up each mission from its site: the client at a way in, the captive on a captive tile', () => {
  const contract = (mission, more) => ({ id: `test-${mission}`, title: 'Test', mission, clients: ['marta'], sites: ['pit9'], encounter: 'jumpers', credits: [50, 50], pitch: 'Test.', ...more });
  const jobs = new Map([...rules.contracts.jobs]);
  for (const [mission, more] of [['extract', { crates: 2 }], ['escort', {}], ['rescue', { captive: 'Tam Okafor' }], ['sabotage', { targets: 2 }], ['defend', { rounds: 5 }]]) jobs.set(`test-${mission}`, contract(mission, more));
  const withJobs = { ...rules, contracts: { ...rules.contracts, jobs } };
  const crew = [{ id: 1, name: 'Ada', job: 'marine', hp: 10, traits: [] }];
  const site = (seed) => generateSite(rules.siteMaps.get('bench'), seed);
  for (const seed of [11, 12, 13]) {
    const { zones } = site(seed);
    const job = (mission) => ({ contract: `test-${mission}`, client: 'marta', site: 'pit9', twist: null, seed, credits: 50, part: null });
    const setup = (mission) => jobSetup(job(mission), withJobs, crew);
    const tile = (list, at) => list.some(([x, y]) => x === at[0] && y === at[1]);

    const extract = setup('extract').objective;
    assert.equal(extract.crates.length, 2);
    assert.ok(extract.crates.every((at) => tile(zones.loot, at)));
    assert.deepEqual(extract.exits, zones.entry);

    const escort = setup('escort');
    const client = escort.units.at(-1);
    assert.equal(client.kind, 'client');
    assert.equal(client.name, rules.clients.get('marta').name);
    assert.ok(tile(zones.entry, [client.x, client.y]), 'the client comes in with the crew');
    assert.deepEqual(escort.objective, { type: 'escort', ward: 'w1', exits: zones.exit });

    const rescue = setup('rescue');
    const captive = rescue.units.at(-1);
    assert.deepEqual([captive.kind, captive.name, captive.held], ['captive', 'Tam Okafor', true]);
    assert.ok(tile(zones.captive, [captive.x, captive.y]), 'held on a captive tile');
    assert.deepEqual(rescue.objective, { type: 'rescue', ward: 'w1', exits: zones.entry });

    assert.equal(setup('sabotage').objective.targets.length, 2);
    assert.deepEqual(setup('defend').objective, { type: 'defend', rounds: 5, line: zones.entry });
    for (const mission of ['extract', 'escort', 'rescue', 'sabotage', 'defend']) {
      const battle = createBattle(setup(mission), withJobs).battle;
      assert.equal(battleProblem(battle), null, `${mission} at seed ${seed} reads back`);
    }
  }
});

// Every order saves the fight, and a save is checked as it loads
// (campaign.js campaignProblems): the person brought out is on the crew's
// side, but not one of the crew the fight names.
test('a campaign saved at any order of each new mission\'s fight passes the save\'s checks', () => {
  for (const id of ['strikefund', 'backdoor', 'yardwatch', 'pumps', 'nephew']) {
    const contract = rules.contracts.jobs.get(id);
    const job = { contract: id, client: contract.clients[0], site: contract.sites[0], twist: null, seed: 7, credits: contract.credits[0], part: null };
    const taken = takeJob({ ...withBoard(newCampaign(rules, 1), rules), board: [job] }, rules, 0);
    assert.ok(taken.ok, taken.error);
    let { campaign } = taken;
    let { battle, log } = campaign.fight;
    const ward = { escort: 'client', rescue: 'captive' }[contract.mission];
    assert.deepEqual(battle.units.filter((u) => u.ward).map((u) => u.kind), ward ? [ward] : [], id);
    for (let step = 0; !battle.winner; step++) {
      assert.ok(step < 2000, `${id}: the fight ends`);
      const result = act(battle, battle.side === 'crew' ? jobAction(battle, rules) : aiAction(battle, rules), rules);
      assert.ok(result.ok, result.error);
      ({ battle } = result);
      log = [...log, ...result.events];
      campaign = saveFight(campaign, battle, log);
      assert.deepEqual(campaignProblems(campaign), [], `${id}, round ${battle.round}`);
    }
  }
});

test('SAVE_VERSION 34: a save from before reads unchanged', () => {
  assert.equal(SAVE_VERSION, 37);
  const data = { campaign: { crew: [], fight: null }, slots: [] };
  const migrated = migrate({ version: 33, data });
  assert.equal(migrated.version, 37);
  // Unchanged but for M38e's other colonies, none (v37).
  assert.deepEqual(migrated.data, { ...data, campaign: { ...data.campaign, colonies: [] } });
});
