// Job ranks (M32b, src/sim/ranks.js): every crew member counts the fights
// they stand in, and at 3 and 8 reaches their job's rank 1 and rank 2. Rank 1
// sharpens the order (a test each), rank 2 the effect aboard or at home (a
// test each), and an effect takes the best rank of the job among those it
// counts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { choicesFor, hitChance, sideStats } from '../src/sim/approach.js';
import { act, createBattle } from '../src/sim/battle.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { beginFight, campaignProblems, crewUnit, endFight, newCampaign, rankUps } from '../src/sim/campaign.js';
import { storesOf } from '../src/sim/colony.js';
import { colonyBy, colonyEdge, stationBy, stationEdge } from '../src/sim/edges.js';
import { approachIntent, approachState } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { healRate } from '../src/sim/medbay.js';
import { shotOdds } from '../src/sim/odds.js';
import { dartOdds } from '../src/sim/orders.js';
import { jobAtRank, memberJob, nextRankAt, rankFor, rankNameFor, rankOf } from '../src/sim/ranks.js';
import { initialState, saveData } from '../src/sim/root.js';
import { beginRun, jump, jumpPlan, linked, scanPlan, supplyCapacity } from '../src/sim/travel.js';
import { oddsText, unitText } from '../src/ui/fight/hints.js';
import { openMap, rules, wall } from './battleKit.js';
import { settled } from './colonyKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const fight = (map, units) => createBattle({ map, units, seed: 7 }, rules).battle;
const who = (battle, id) => battle.units.find((u) => u.id === id);
const order = (unit, extra = {}) => ({ type: 'order', unit, ...extra });

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

// A crew member of `job` with `fights` stood in.
const hand = (job, fights, id = 1) => ({ id, name: `Hand ${id}`, job, fights });
// The campaign with crew member `i` (0 first) in `job`, with `fights`.
const withHand = (campaign, i, job, fights) => ({ ...campaign, crew: campaign.crew.map((m, n) => (n === i ? { ...m, job, fights } : m)) });
const onRun = () => beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;

test('every job has two ranks, at 3 and 8 fights: rank 1 sharpens its order, rank 2 its effect aboard or at home', () => {
  assert.deepEqual([rules.balance.rankOneFights, rules.balance.rankTwoFights], [3, 8]);
  for (const job of rules.jobs.values()) {
    const [one, two] = job.ranks;
    assert.equal(job.ranks.length, 2, job.id);
    assert.ok(one.order && !one.station && !one.colony, `${job.id}'s rank 1 sharpens its order`);
    // Since the M32b fix (Evan's calls, 2026-10-16): a use more, and a
    // number sharper; Kit out a use only, as its 2 armor tipped the raids.
    assert.equal(one.order.uses, job.order.uses + 1, `${job.id}'s rank 1 adds a use`);
    if (job.id !== 'quartermaster') assert.ok(Object.keys(one.order).some((key) => key !== 'uses' && one.order[key] !== job.order[key]), `${job.id}'s rank 1 sharpens a number`);
    assert.ok(!two.order && (two.station || two.colony), `${job.id}'s rank 2 sharpens an effect`);
    assert.ok(one.name && one.text && two.name && two.text, `${job.id}'s ranks have names and words`);
  }
  assert.deepEqual([0, 2, 3, 7, 8, 40].map((n) => rankFor(n, rules)), [0, 0, 1, 1, 2, 2]);
  assert.equal(rankOf(hand('medic', 9), rules), 2);
  assert.equal(rankOf({ job: 'medic' }, rules), 0, 'no count, no rank');
  assert.equal(rankOf(hand('cook', 9), rules), 0, 'a job the data lacks has no ranks');
  assert.deepEqual([0, 3, 8].map((fights) => nextRankAt(hand('medic', fights), rules)), [3, 8, null]);
  // Each rank keeps what the ranks below gave; rank 0 is the job itself.
  const medic = rules.jobs.get('medic');
  assert.equal(jobAtRank(medic, 0), medic);
  assert.deepEqual([jobAtRank(medic, 1).order.hp, jobAtRank(medic, 1).station.heal, jobAtRank(medic, 2).order.hp, jobAtRank(medic, 2).station.heal], [5, 1, 5, 2]);
  assert.equal(jobAtRank(medic, 2), jobAtRank(medic, 2), 'built once');
  assert.equal(memberJob(hand('medic', 3), rules), jobAtRank(medic, 1));
});

test('everyone who stands in a fight counts it when it ends, won or lost; whoever sat it out does not, and the dead are gone', () => {
  const start = newCampaign(rules, 5);
  assert.deepEqual(start.crew.map((m) => m.fights), [0, 0, 0]);
  const fighting = beginFight(start, rules).campaign;
  const units = fighting.fight.battle.units.map((u) => (u.id === 'c2' ? { ...u, status: 'down', hp: 0 } : u.id === 'c3' ? { ...u, status: 'dead', hp: 0 } : u));
  const satOut = { ...start.crew[0], id: 9, name: 'Sat Out', fights: 4 };
  const ended = (winner) => ({ ...fighting, crew: [...fighting.crew, satOut], fight: { ...fighting.fight, battle: { ...fighting.fight.battle, units, winner } } });
  const won = endFight(ended('crew'), rules);
  assert.deepEqual(won.crew.map((m) => [m.id, m.fights]), [[1, 1], [2, 1], [9, 4]], 'the one down counts it; the dead are gone');
  assert.deepEqual(campaignProblems(won), []);
  const lost = endFight(ended('enemy'), rules);
  assert.deepEqual(lost.crew.map((m) => [m.id, m.fights]), [[1, 1], [2, 1], [9, 4]], 'a fight lost counts too');
  // The third fight brings rank 1 into the next fight.
  const seasoned = { ...start, crew: start.crew.map((m) => ({ ...m, fights: 3 })) };
  assert.deepEqual(beginFight(seasoned, rules).campaign.fight.battle.units.filter((u) => u.side === 'crew').map((u) => u.rank), [1, 1, 1]);
});

test('who reaches a rank as a fight ends, by its count: standing in it and alive, the one sitting out not; none while it goes on', () => {
  const start = newCampaign(rules, 5);
  // 2, 7 and 2 fights: the first and second reach a rank if they stand in
  // this one; the third is killed.
  const before = { ...start, crew: start.crew.map((m, i) => ({ ...m, fights: [2, 7, 2][i] })) };
  const fighting = beginFight(before, rules).campaign;
  const units = fighting.fight.battle.units.map((u) => (u.id === 'c3' ? { ...u, status: 'dead', hp: 0 } : u));
  const satOut = { ...start.crew[0], id: 9, name: 'Sat Out', fights: 2 };
  const campaign = { ...fighting, crew: [...fighting.crew, satOut] };
  const battle = { ...fighting.fight.battle, units, winner: 'enemy' };
  assert.deepEqual(rankUps(campaign, battle, rules).map(({ member, rank }) => [member.id, rank]), [[1, 1], [2, 2]]);
  assert.deepEqual(rankUps(campaign, { ...battle, winner: null }, rules), [], 'not over yet');
  // endFight agrees.
  const after = endFight({ ...campaign, fight: { ...campaign.fight, battle } }, rules);
  assert.deepEqual(after.crew.map((m) => [m.id, rankOf(m, rules)]), [[1, 1], [2, 2], [9, 0]]);
});

test('the name of the rank that sharpens each layer: an order\'s at rank 1 and on, an effect\'s at rank 2', () => {
  const marine = rules.jobs.get('marine');
  assert.deepEqual([0, 1, 2].map((rank) => rankNameFor(marine, rank, 'order')), [null, 'Pinning fire', 'Pinning fire']);
  assert.deepEqual([0, 1, 2].map((rank) => rankNameFor(marine, rank, 'station')), [null, null, 'Gun captain']);
  assert.equal(rankNameFor(undefined, 2, 'order'), null);
});

test("a crew member's rank goes into a fight: the unit keeps it, starts with its order's uses, and reads back", () => {
  const member = newCampaign(rules, 5).crew[0];
  assert.equal(crewUnit({ ...member, fights: 3 }, rules).rank, 1);
  assert.equal('rank' in crewUnit({ ...member, fights: 2 }, rules), false, 'rank 0 adds nothing');
  const battle = fight(openMap(8, 2), [{ kind: 'pilot', x: 0, y: 0, rank: 1 }, { kind: 'pilot', x: 0, y: 1 }, { kind: 'pirate', x: 7, y: 0 }]);
  assert.deepEqual([who(battle, 'c1').rank, who(battle, 'c1').uses, 'rank' in who(battle, 'c2'), who(battle, 'c2').uses], [1, 2, false, 1]);
  // Its card says so, and counts its uses against the rank's.
  const card = unitText(who(battle, 'c1'), rules).lines;
  assert.match(card[0], /^Crew · rank 1, Second wind · 8\/8 hit points/);
  assert.ok(card.includes('Hustle: 2 of 2 left this fight.'), card.join(' | '));
  assert.match(unitText(who(battle, 'c2'), rules).lines[0], /^Crew · 8\/8 hit points/);
  assert.equal(battleProblem(JSON.parse(JSON.stringify(battle))), null);
  assert.notEqual(battleProblem({ ...battle, units: battle.units.map((u) => (u.id === 'e1' ? { ...u, rank: 1 } : u)) }), null, 'an enemy has no rank');
  assert.notEqual(battleProblem({ ...battle, units: battle.units.map((u) => (u.id === 'c1' ? { ...u, rank: 0 } : u)) }), null, 'a rank is 1 or more');
});

test("Marine rank 1, Pinning fire: Suppress three times a fight, taking 40 off an enemy's aim", () => {
  const battle = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0, rank: 1 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.equal(who(battle, 'c1').uses, 3);
  const before = shotOdds(battle, who(battle, 'e1'), who(battle, 'c1'), rules);
  const { battle: after, events } = play(battle, order('c1', { target: 'e1' }));
  assert.equal(events[0].aim, -40);
  assert.equal(shotOdds(after, who(after, 'e1'), who(after, 'c1'), rules).hit, Math.max(0, before.hit - 40));
});

test('Engineer rank 1, Hot welds: three welds a fight, each holding 5 rounds', () => {
  const map = wall(openMap(6, 1), 1, 0, 'e', 'door');
  const battle = fight(map, [{ kind: 'engineer', x: 1, y: 0, rank: 1 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.equal(who(battle, 'c1').uses, 3);
  battle.doors = [edgeKey(1, 0, 'e')];
  const { battle: welded, events } = play(battle, order('c1', { side: 'e' }));
  assert.equal(events[0].until, 5);
  assert.deepEqual(welded.welds, [{ key: edgeKey(1, 0, 'e'), until: 5 }]);
});

test('Medic rank 1, Field surgery: Patch three times a fight, giving back 5 hit points, and one who is down gets up with 5', () => {
  const battle = fight(openMap(5, 2), [{ kind: 'medic', x: 1, y: 0, rank: 1 }, { kind: 'marine', x: 2, y: 1 }, { kind: 'engineer', x: 0, y: 0 }, { kind: 'pirate', x: 4, y: 0 }]);
  assert.equal(who(battle, 'c1').uses, 3);
  tweak(battle, { c2: { hp: 2 }, c3: { hp: 0, status: 'down', bleed: 2, ap: 0 } });
  const { battle: after, events } = play(battle, order('c1', { target: 'c2' }));
  assert.deepEqual([events[0].healed, who(after, 'c2').hp], [5, 7]);
  const { battle: up } = play(after, order('c1', { target: 'c3' }));
  assert.deepEqual([who(up, 'c3').status, who(up, 'c3').hp], ['active', 5]);
});

test('Pilot rank 1, Second wind: Hustle twice a fight, two more actions each', () => {
  const battle = fight(openMap(12, 1), [{ kind: 'pilot', x: 0, y: 0, rank: 1 }, { kind: 'pirate', x: 11, y: 0 }]);
  const once = play(battle, order('c1')).battle;
  assert.deepEqual([who(once, 'c1').uses, who(once, 'c1').ap], [1, 4]);
  const twice = play(once, order('c1')).battle;
  assert.deepEqual([who(twice, 'c1').uses, who(twice, 'c1').ap], [0, 6]);
});

test("Scout rank 1, Spotter: three marks a fight, each putting the crew's shots +20", () => {
  const battle = fight(openMap(8, 2), [{ kind: 'scout', x: 0, y: 0, rank: 1 }, { kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 7, y: 0 }]);
  assert.equal(who(battle, 'c1').uses, 3);
  const before = shotOdds(battle, who(battle, 'c2'), who(battle, 'e1'), rules);
  const { battle: after, events } = play(battle, order('c1', { target: 'e1' }));
  assert.deepEqual([events[0].aim, who(after, 'e1').mark.aim], [20, 20]);
  assert.equal(shotOdds(after, who(after, 'c2'), who(after, 'e1'), rules).hit, Math.min(100, before.hit + 20));
});

test("Xenobiologist rank 1, Steady dart: three darts a fight, each +10, shown as a part of its odds and rolled as shown", () => {
  const battle = fight(openMap(6, 2), [{ kind: 'xenobiologist', x: 0, y: 0, rank: 1 }, { kind: 'xenobiologist', x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.deepEqual([who(battle, 'c1').uses, who(battle, 'c2').uses], [3, 2]);
  const shot = shotOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
  const dart = dartOdds(battle, who(battle, 'c1'), who(battle, 'e1'), rules);
  assert.deepEqual(dart.hitParts.at(-1), { why: 'steady', value: 10 });
  assert.equal(dart.hit, Math.min(100, shot.hit + 10));
  assert.deepEqual(dartOdds(battle, who(battle, 'c2'), who(battle, 'e1'), rules), shotOdds(battle, who(battle, 'c2'), who(battle, 'e1'), rules), 'rank 0: a shot\'s odds');
  const { events } = play(battle, order('c1', { target: 'e1' }));
  assert.equal(events[0].chance, dart.hit);
  // The odds card shows it as a row of its own, by the rank's name.
  const card = oddsText(who(battle, 'c1'), who(battle, 'e1'), dart, rules);
  assert.deepEqual(card.rows.at(-1), ['Steady dart', '+10']);
  assert.equal(card.hit, dart.hit);
});

test('Quartermaster rank 1, Deep pockets: Kit out three times a fight, 1 armor each as at rank 0', () => {
  const battle = fight(openMap(5, 2), [{ kind: 'quartermaster', x: 0, y: 0, rank: 1 }, { kind: 'marine', x: 1, y: 0 }, { kind: 'medic', x: 0, y: 1 }, { kind: 'pirate', x: 4, y: 0 }]);
  assert.equal(who(battle, 'c1').uses, 3);
  const done = play(battle, order('c1', { target: 'c1' }), order('c1', { target: 'c2' })).battle;
  assert.deepEqual([who(done, 'c1').armor - who(battle, 'c1').armor, who(done, 'c2').armor - who(battle, 'c2').armor], [1, 1]);
  const next = play(play(done, { type: 'end' }).battle, { type: 'end' }).battle;
  const third = play(next, order('c1', { target: 'c3' })).battle;
  assert.deepEqual([who(third, 'c1').uses, who(third, 'c3').kitted], [0, true]);
});

test('rank 2 sharpens each job\'s effects aboard and at home, and rank 1 leaves them as they were', () => {
  const at = (job, fights) => [hand(job, fights)];
  const cases = [
    ['marine', 'station', 'gunnery', 10, 15],
    ['engineer', 'station', 'repair', 1, 2],
    ['medic', 'station', 'heal', 1, 2],
    ['medic', 'colony', 'heal', 1, 2],
    ['pilot', 'station', 'evasion', 10, 15],
    ['scout', 'station', 'scan', 1, 2],
    ['xenobiologist', 'colony', 'farms', 1, 2],
    ['quartermaster', 'station', 'lockers', 10, 20],
    ['quartermaster', 'colony', 'stores', 20, 40],
  ];
  for (const [job, layer, key, base, ranked] of cases) {
    const edge = layer === 'station' ? stationEdge : colonyEdge;
    assert.deepEqual([0, 3, 8].map((fights) => edge(at(job, fights), rules, key)), [base, base, ranked], `${job} ${layer} ${key}`);
  }
});

test('an effect takes the best rank of the job among those it counts, and names who brings it; a second adds nothing', () => {
  const crew = [hand('marine', 1, 1), hand('marine', 9, 2), hand('medic', 2, 3)];
  assert.equal(stationEdge(crew, rules, 'gunnery'), 15);
  assert.equal(stationBy(crew, rules, 'gunnery').id, 2, 'the veteran brings it');
  assert.equal(colonyEdge(crew, rules, 'landing'), 10, 'rank 2 leaves the marine\'s colony effect as it was');
  assert.equal(colonyBy([hand('medic', 2, 1), hand('medic', 8, 2)], rules, 'heal').id, 2);
  assert.equal(stationEdge([hand('marine', 9, 1), hand('marine', 9, 2)], rules, 'gunnery'), 15, 'two veterans, the same');
});

test('Marine and pilot rank 2, Gun captain and Ace: the guns +15 and the evasion +15 in the approach, as shown', () => {
  const run = onRun();
  const to = linked(run.run.sector, run.run.sector.start)[0];
  const nodes = run.run.sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
  const at = jump({ ...run, run: { ...run.run, sector: { ...run.run.sector, nodes } } }, rules, to).campaign;
  assert.equal(at.crew[0].job, 'marine');
  const veteran = withHand(at, 0, 'marine', 8);
  const state = approachState(veteran, rules);
  const intent = approachIntent(veteran, rules);
  const them = sideStats(state.them, rules);
  assert.equal(choicesFor(state, intent, rules).find((c) => c.order.kind === 'fire').chance, hitChance(them, intent.kind === 'evade', rules) + 15);
  const green = sideStats(approachState(withHand(at, 1, 'pilot', 0), rules).you, rules);
  const ace = sideStats(approachState(withHand(at, 1, 'pilot', 8), rules).you, rules);
  assert.equal(ace.evasion, green.evasion + 5);
});

test('Engineer rank 2, Running repairs: two wrecked parts fixed after each jump, the cheapest first', () => {
  const run = withHand(onRun(), 1, 'engineer', 8);
  const gun = run.ship.modules.find((m) => m.type === 'weapon').uid;
  const quarters = run.ship.modules.find((m) => m.type === 'quarters').uid;
  const wrecked = { ...run, wrecks: { [gun]: 'fire', [quarters]: 'rubble' } };
  const to = linked(run.run.sector, run.run.sector.start)[0];
  assert.deepEqual(jumpPlan(wrecked, rules, to).fixes.map((fix) => fix.uid), [quarters, gun]);
  assert.deepEqual(jump(wrecked, rules, to).campaign.wrecks, {});
});

test('Medic rank 2, Ward chief: a med bay heals 2 more a jump, and a powered infirmary 2 more a day', () => {
  const run = withHand(onRun(), 2, 'medic', 8);
  const bay = { ...run, ship: { ...run.ship, modules: [...run.ship.modules, { uid: 99, type: 'medbay', x: 0, y: 0, rot: 0 }] } };
  assert.equal(healRate(bay, rules), rules.modules.get('medbay').heal + 2);
  assert.equal(colonyEdge(settled().crew.map((m) => (m.job === 'medic' ? { ...m, fights: 8 } : m)), rules, 'heal'), 2);
});

test('Scout rank 2, Long eyes: a scan reaches 4 links', () => {
  const run = withHand(onRun(), 0, 'scout', 8);
  assert.equal(scanPlan(run, rules).reach, rules.balance.scanRange + 2);
  assert.equal(scanPlan(withHand(run, 0, 'scout', 3), rules).reach, rules.balance.scanRange + 1);
});

test('Xenobiologist and quartermaster rank 2, Green thumb and Stores master: farms +2, lockers +20 and stores +40', () => {
  const { ship } = onRun();
  assert.equal(supplyCapacity(ship, rules, [hand('quartermaster', 8)]), supplyCapacity(ship, rules, [hand('quartermaster', 0)]) + 10);
  const home = settled();
  const keeps = (fights) => storesOf({ ...home, crew: home.crew.map((m, i) => (i === 0 ? { ...m, job: 'quartermaster', fights } : m)) }, rules);
  assert.equal(keeps(8).colony, keeps(0).colony + 20);
  assert.equal(colonyEdge([hand('xenobiologist', 8)], rules, 'farms'), 2);
});

test('saves: v25 for fights; a v24 crew starts at 0 fights each, and a fight under way keeps its units at rank 0', () => {
  // 26 since M33's factions, 27 since its fix's docking on trade, 28 since
  // M33b's quests, 29 since M33c's companions.
  assert.equal(SAVE_VERSION, 39);
  const fighting = beginFight(newCampaign(rules, 5), rules).campaign;
  const v24 = { ...fighting, crew: fighting.crew.map(({ fights, ...member }) => member) };
  const data = { ...saveData(initialState(5)), campaign: v24 };
  const up = MIGRATIONS.find((m) => m.from === 24).up(data).campaign;
  assert.deepEqual(up.crew.map((m) => m.fights), [0, 0, 0]);
  assert.deepEqual(up.fight, fighting.fight);
  const opened = parseSave(JSON.stringify({ version: 24, data }));
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(campaignProblems(opened.save.data.campaign), []);
  // A v25 crew round-trips its fights; broken counts are caught.
  const seasoned = { ...fighting, crew: fighting.crew.map((m, i) => ({ ...m, fights: i * 4 })) };
  const again = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(5)), campaign: seasoned })));
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.save.data.campaign.crew.map((m) => m.fights), [0, 4, 8]);
  for (const fights of [-1, 1.5, '3', undefined]) {
    assert.notDeepEqual(campaignProblems({ ...seasoned, crew: seasoned.crew.map((m) => ({ ...m, fights })) }), [], `fights ${fights}`);
  }
});
