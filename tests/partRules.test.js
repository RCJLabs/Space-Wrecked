// M39: what the new parts and hull frames do. A part doing a job's ship
// effect, and a frame's trait, add to the best job's within the effect's
// cap; a wrecked part gives nothing. Stealth baffles take heat off a jump,
// hydroponics grow supplies on one, a torpedo bay fires in the odd rounds
// through the shields, a grapple pulls a ship in, a security turret fights
// for its ship's side, and at the colony the new parts' buildings bring
// their effects. Each test fits the part, or takes it off, and shows the
// rule at work.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { choicesFor, closeChance, enemyOrder, fleeChance, hitChance, openingVolley, playRound, sideStats, torpedoRounds } from '../src/sim/approach.js';
import { act, createBattle, isMachine } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { aiAction } from '../src/sim/ai.js';
import { campaignProblems, endFight, maxHp } from '../src/sim/campaign.js';
import { colonyStats, crewYields, donatePlan } from '../src/sim/colony.js';
import { dayPlan } from '../src/sim/days.js';
import { deploy, machinesOn } from '../src/sim/deploy.js';
import { edgeWith, shipEdge, STATION_EFFECTS } from '../src/sim/edges.js';
import { rollPlaces } from '../src/sim/expeditions.js';
import { gearWon } from '../src/sim/gear.js';
import { launch } from '../src/sim/launch.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { advance } from '../src/sim/press.js';
import { landingPlan } from '../src/sim/raids.js';
import { surveyPlan } from '../src/sim/survey.js';
import { tileRule } from '../src/sim/terrain.js';
import { beginRun, growsOf, jump, jumpHeatOf, jumpPlan, jumpFixes, leavePlan, linked, reach, scanReach, supplyCapacity } from '../src/sim/travel.js';
import { stateText, unitText } from '../src/ui/fight/hints.js';
import { launchedShip, withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const fitted = (campaign, ...types) => ({ ...campaign, ship: types.reduce((ship, type) => withPart(ship, rules, type), campaign.ship) });
const uidOf = (ship, type) => ship.modules.find((module) => module.type === type).uid;
const uidsOf = (ship, type) => ship.modules.filter((module) => module.type === type).map((module) => module.uid);
const side = (ship, wrecked = {}, edge = undefined) => ({ ship, damage: {}, wrecked, ...(edge ? { edge } : {}) });
const bounded = (chance) => Math.max(balance.chanceMin, Math.min(balance.chanceMax, chance));

// The campaign with crew member `i` in `job`.
function withJob(campaign, i, job) {
  const crew = campaign.crew.map((member, n) => (n === i ? { ...member, job } : member));
  return { ...campaign, crew: crew.map((member) => ({ ...member, hp: Math.min(member.hp, maxHp(member, rules)) })) };
}

// The campaign with no one in `job`: a medic in their place.
function without(campaign, job) {
  return { ...campaign, crew: campaign.crew.map((member) => (member.job === job ? { ...member, job: 'medic' } : member)) };
}

// A node a jump reaches from the ship's, and one a long jump does.
function nextNodes(campaign) {
  const far = reach(campaign.run.sector, campaign.run.at);
  return { near: [...far].find(([, links]) => links === 1)[0], far: [...far].find(([, links]) => links === 2)?.[0] };
}

test("a part's and a frame's effect add to the best job's, within the cap; a wrecked part, or a second past the cap, adds nothing", () => {
  const ship = launchedShip(rules);
  const crew = [{ id: 1, name: 'A', job: 'scout' }];
  const scout = rules.jobs.get('scout').station.scan;
  assert.equal(shipEdge(ship, crew, rules, 'scan'), scout);
  const scanned = withPart(ship, rules, 'scanner');
  assert.equal(shipEdge(scanned, crew, rules, 'scan'), scout + rules.modules.get('scanner').station.scan);
  assert.equal(shipEdge(scanned, [], rules, 'scan'), rules.modules.get('scanner').station.scan);
  assert.equal(shipEdge(scanned, crew, rules, 'scan', { [uidOf(scanned, 'scanner')]: 'fire' }), scout, 'wrecked, it gives nothing');
  // A maker's version does the same job.
  const bastion = { ...scanned, modules: scanned.modules.map((module) => (module.type === 'scanner' ? { ...module, type: 'bastion-scanner' } : module)) };
  assert.equal(shipEdge(bastion, [], rules, 'scan'), 1);
  // The cap: the baffles' quiet goes to 1 however many are fitted.
  const quiet = withPart(withPart(ship, rules, 'baffles'), rules, 'baffles');
  assert.equal(STATION_EFFECTS.quiet[1], 1);
  assert.equal(shipEdge(quiet, [], rules, 'quiet'), 1);
  // A frame's trait, with a job's and a part's.
  assert.equal(shipEdge({ ...ship, frame: 'courier' }, [], rules, 'evasion'), rules.frames.get('courier').traits.evasion);
  assert.equal(edgeWith(45, withPart({ ...ship, frame: 'gunship' }, rules, 'firecontrol'), rules, 'gunnery'), STATION_EFFECTS.gunnery[1], '45 + 10 + 10, held to 50');
  assert.equal(shipEdge({ ...ship, frame: 'freighter' }, [], rules, 'lockers'), 20);
  assert.equal(shipEdge({ ...ship, frame: 'patrolhull' }, [], rules, 'evasion'), 0, "an enemy's frame only gives room");
});

test('stealth baffles: each jump adds 1 less heat, a long jump too, and so do the jump into the next map and the flight home', () => {
  const run = onRun({ heat: 40 });
  const { near, far } = nextNodes(run);
  const quiet = fitted(run, 'baffles');
  assert.equal(jumpHeatOf(run, rules), balance.jumpHeat);
  assert.equal(jumpHeatOf(quiet, rules), balance.jumpHeat - 1);
  assert.equal(jumpPlan(quiet, rules, near).heat, balance.jumpHeat - 1);
  assert.equal(jump(quiet, rules, near).campaign.heat, run.heat + balance.jumpHeat - 1);
  if (far !== undefined) assert.equal(jumpPlan(quiet, rules, far).heat, balance.longJumpHeat - 1);
  const atExit = { ...quiet, run: { ...quiet.run, at: quiet.run.sector.exit } };
  assert.equal(leavePlan(atExit, rules).heat, balance.jumpHeat - 1);
  // Wrecked, they take nothing off.
  const wrecked = { ...quiet, wrecks: { [uidOf(quiet.ship, 'baffles')]: 'rubble' } };
  assert.equal(jumpPlan(wrecked, rules, near).heat, balance.jumpHeat);
  assert.deepEqual(campaignProblems(jump(quiet, rules, near).campaign), []);
});

test('hydroponics: 2 supplies grown a jump, a long jump three times that, eaten first, the rest kept up to what the holds take', () => {
  const run = onRun();
  const { near, far } = nextNodes(run);
  const green = fitted(run, 'hydroponics');
  const grows = rules.modules.get('hydroponics').station.grows;
  assert.equal(growsOf(run, rules), 0);
  assert.equal(growsOf(green, rules), grows);
  assert.equal(growsOf(green, rules, true), grows * balance.longJumpFactor);
  const plan = jumpPlan(green, rules, near);
  assert.deepEqual([plan.supplies, plan.grows], [green.crew.length * balance.jumpSupplies, grows]);
  // Short of supplies, what grows feeds the crew first: 1 carried and 2
  // grown cover 3 eaten.
  const short = { ...green, supplies: plan.supplies - grows };
  assert.equal(jumpPlan(short, rules, near).hungry, false);
  assert.equal(jumpPlan({ ...run, supplies: plan.supplies - grows }, rules, near).hungry, true, 'without them, hungry');
  const fed = jump(short, rules, near).campaign;
  assert.equal(fed.supplies, 0);
  assert.equal(fed.flags.hungryJumps, undefined);
  assert.equal(fed.flags.suppliesGrown, grows);
  // With the holds full, no more than they take.
  const cap = supplyCapacity(green.ship, rules, green.crew);
  const full = jump({ ...green, supplies: cap }, rules, near).campaign;
  assert.equal(full.supplies, cap - plan.supplies + grows);
  const one = { ...green, crew: green.crew.slice(0, 1), supplies: supplyCapacity(green.ship, rules, green.crew.slice(0, 1)) };
  assert.equal(jump(one, rules, near).campaign.supplies, supplyCapacity(one.ship, rules, one.crew), 'one aboard eats 1 and 2 grow: still full');
  if (far !== undefined) assert.equal(jumpPlan(green, rules, far).grows, grows * balance.longJumpFactor);
  // Two grow twice as much; wrecked, they grow nothing.
  assert.equal(growsOf(fitted(green, 'hydroponics'), rules), 2 * grows);
  assert.equal(jumpPlan({ ...green, wrecks: { [uidOf(green.ship, 'hydroponics')]: 'fire' } }, rules, near).grows, 0);
  assert.deepEqual(campaignProblems(full), []);
});

test('a scanner reaches a link farther, a workshop mends a wrecked part a jump, a survey lab makes a survey free, and a freighter stows 20 more', () => {
  const run = without(onRun(), 'engineer');
  assert.equal(scanReach(fitted(run, 'scanner'), rules), balance.scanRange + 1);
  assert.equal(scanReach(withJob(fitted(run, 'scanner'), 1, 'scout'), rules), balance.scanRange + 2, "the scout's and the scanner's");
  const gun = uidOf(run.ship, 'weapon');
  const quarters = uidOf(run.ship, 'quarters');
  const wrecked = { ...fitted(run, 'workshop'), wrecks: { [gun]: 'fire', [quarters]: 'rubble' } };
  assert.deepEqual(jumpFixes({ ...run, wrecks: wrecked.wrecks }, rules), []);
  assert.deepEqual(jumpFixes(wrecked, rules).map((fix) => fix.uid), [quarters]);
  assert.deepEqual(jumpFixes(withJob(wrecked, 1, 'engineer'), rules).map((fix) => fix.uid), [quarters, gun], "the engineer's and the workshop's");
  assert.deepEqual(jumpFixes({ ...wrecked, wrecks: { ...wrecked.wrecks, [uidOf(wrecked.ship, 'workshop')]: 'fire' } }, rules).map((fix) => fix.uid), [], 'a wrecked workshop mends nothing, itself least');
  const plain = onRun();
  assert.equal(supplyCapacity({ ...plain.ship, frame: 'freighter' }, rules, plain.crew), supplyCapacity(plain.ship, rules, plain.crew) + 20);
});

test('a survey lab: a survey takes no day, as a xenobiologist makes it', async () => {
  const { leaveSector } = await import('../src/sim/travel.js');
  const run = without(fitted(onRun({ heat: 60 }), 'surveylab'), 'xenobiologist');
  const { sector } = run.run;
  const sectors = rules.acts.get(2).sectors;
  const past = rules.sectors.names.sectors.filter((name) => name !== sector.name).slice(0, sectors - 1);
  const exit = { ...run, run: { ...run.run, sector: { ...sector, index: sectors }, at: sector.exit, seen: [...run.run.seen, sector.exit], past } };
  const system = leaveSector(exit, rules).campaign;
  const there = { ...system, run: { ...system.run, at: 1, seen: [...system.run.seen, 1] } };
  assert.deepEqual(surveyPlan(there, rules), { ok: true, free: true, supplies: 0, heat: 0, hunt: null });
  const lab = uidOf(there.ship, 'surveylab');
  assert.equal(surveyPlan({ ...there, wrecks: { [lab]: 'vacuum' } }, rules).free, false);
});

test('a torpedo bay fires in rounds 1 and 3, never in an opening volley, and its hit passes the shields whole', () => {
  const ship = withPart(launchedShip(rules), rules, 'torpedobay');
  const shielded = withPart(withPart(launchedShip(rules), rules, 'shield'), rules, 'shield');
  const torpedo = rules.modules.get('torpedobay').damage;
  const guns = uidsOf(ship, 'weapon').length;
  assert.deepEqual(torpedoRounds(rules), [1, 3]);
  for (const [round, firing] of [[null, guns + 1], [0, guns], [1, guns + 1], [2, guns], [3, guns + 1]]) {
    const stats = sideStats(side(ship), rules, round);
    assert.equal(stats.guns, firing, `round ${round}`);
    assert.equal(stats.armed, guns + 1);
    assert.equal(stats.through.filter(Boolean).length, firing - guns);
  }
  const tactics = { aim: ['weapons'] };
  const state = (round) => ({ you: side(ship), them: side(shielded), round, tactics });
  // In round 1 a torpedo's hit takes nothing off for the shields, while the
  // guns' hits do; and it is told as a torpedo.
  let found = null;
  for (let seed = 0; seed < 4000 && !found; seed++) {
    const played = playRound(state(1), { kind: 'fire', at: 'reactor' }, seedFrom(seed), rules);
    const volley = played.events.find((event) => event.kind === 'volley' && event.side === 'you');
    const shot = volley?.shots.find((s) => s.torpedo && s.hit);
    if (shot && volley.shots.some((s) => !s.torpedo && s.hit)) found = { volley, shot };
  }
  assert.ok(found, 'a round where a torpedo and a gun both hit');
  assert.equal(found.shot.absorbed, 0);
  assert.equal(found.shot.damage, Math.min(torpedo, rules.modules.get('reactor').stats.hp));
  assert.ok(found.volley.shots.filter((s) => !s.torpedo && s.hit).some((s) => s.absorbed > 0), "the shields take the guns' hits");
  // In round 2 it doesn't fire.
  const second = playRound(state(2), { kind: 'fire', at: 'reactor' }, seedFrom(1), rules);
  assert.equal(second.events.find((event) => event.kind === 'volley').shots.length, guns);
  assert.ok(second.events.find((event) => event.kind === 'volley').shots.every((s) => s.torpedo === undefined));
  // A patrol's opening volley is before round 1: no torpedo.
  const opening = openingVolley({ you: side(shielded), them: side(ship), round: 1, tactics }, seedFrom(2), rules);
  assert.equal(opening.events[0].shots.length, guns);
  // With only torpedoes, Fire waits for their round, and says so.
  const only = { ...ship, modules: ship.modules.filter((module) => module.type !== 'weapon') };
  const fire = (round) => choicesFor({ you: side(only), them: side(shielded), round, tactics }, { kind: 'evade' }, rules).find((choice) => choice.order.kind === 'fire');
  assert.equal(fire(1).ok, true);
  assert.deepEqual([fire(2).ok, fire(2).why], [false, 'Your torpedo bays fire in rounds 1 and 3.']);
  // An enemy with only torpedoes holds fire between its rounds, but doesn't
  // run for having no guns.
  assert.equal(enemyOrder({ you: side(shielded), them: side(only), round: 2, tactics }, rules).kind, 'evade');
  assert.equal(enemyOrder({ you: side(shielded), them: side(only), round: 3, tactics }, rules).kind, 'fire');
});

test("a grapple: 15 more to closing to board, 15 off the other ship's fleeing; the best working one counts", () => {
  const ship = launchedShip(rules);
  const hooked = withPart(ship, rules, 'grapple');
  const pull = rules.modules.get('grapple').grapple;
  const them = sideStats(side(ship), rules);
  const mine = sideStats(side(hooked), rules);
  // The same ship without its pull (the grapple's mass still aboard).
  const unhooked = { ...mine, grapple: 0 };
  assert.equal(mine.grapple, pull);
  assert.equal(closeChance(mine, them, rules), bounded(closeChance(unhooked, them, rules) + pull));
  assert.equal(fleeChance(them, mine, rules), bounded(fleeChance(them, unhooked, rules) - pull));
  assert.equal(sideStats(side(withPart(hooked, rules, 'grapple')), rules).grapple, pull, 'a second adds nothing');
  assert.equal(sideStats(side(hooked, { [uidOf(hooked, 'grapple')]: 'fire' }), rules).grapple, 0);
  // In a round the odds shown are the odds rolled.
  const state = { you: side(hooked), them: side(ship), round: 1, tactics: { aim: ['weapons'] } };
  const close = choicesFor(state, { kind: 'evade' }, rules).find((choice) => choice.order.kind === 'close');
  assert.equal(close.chance, closeChance(sideStats(state.you, rules, 1), sideStats(state.them, rules, 1), rules));
  const played = playRound(state, { kind: 'close' }, seedFrom(5), rules);
  assert.equal(played.events.find((event) => event.kind === 'close').chance, close.chance);
});

test('fire control and an ECM suite: +10 to hit and +10 evasion in the approach, as a marine and a pilot give, added to theirs', () => {
  const ship = launchedShip(rules);
  // Evasion by thrust for mass alone: each part's own mass changes it.
  const byThrust = (stats) => Math.round(balance.evasionPerThrust * stats.ratio);
  const base = sideStats(side(ship), rules);
  const aimed = sideStats(side(withPart(ship, rules, 'firecontrol')), rules);
  const jammed = sideStats(side(withPart(ship, rules, 'ecm')), rules);
  assert.deepEqual([base.gunnery, base.evasion], [0, byThrust(base)]);
  assert.equal(aimed.gunnery, 10);
  assert.equal(jammed.evasion, byThrust(jammed) + 10);
  assert.equal(hitChance(base, false, rules, aimed.gunnery), bounded(hitChance(base, false, rules) + 10));
  // With the crew's edge: added, within the cap.
  const crewed = sideStats(side(withPart(ship, rules, 'firecontrol'), {}, { gunnery: 10, evasion: 10 }), rules);
  assert.deepEqual([crewed.gunnery, crewed.evasion], [20, byThrust(crewed) + 10]);
  // An enemy ship's parts count for her, with no crew edge, and so does
  // her frame's trait.
  const courier = sideStats(side({ ...withPart(ship, rules, 'ecm'), frame: 'courier' }), rules);
  assert.equal(courier.evasion, byThrust(courier) + 20);
});

// A battle on the launched ship's map with a turret fitted: the squad on
// the bridge, boarders at the hatches, the turret on its mount for the
// crew.
function turretFight(extra = []) {
  const ship = extra.reduce((s, type) => withPart(s, rules, type), withPart(launchedShip(rules), rules, 'turret'));
  const map = mapFromShip(ship, rules);
  const machines = machinesOn(map, rules, 'crew');
  const placed = deploy(map, rules.squad, rules.encounters.get('boarders').enemies, rules, machines.map(({ x, y }) => [x, y]));
  assert.equal(placed.ok, true, placed.error);
  return { ship, map, machines, ...createBattle({ map, units: [...placed.units, ...machines], seed: 7 }, rules) };
}

test("a security turret stands on its mount, its room's tile of full cover, for its ship's side; a wrecked one doesn't; two are numbered", () => {
  const { ship, map, machines, battle } = turretFight();
  const room = map.rooms.find((r) => r.type === 'turret');
  assert.equal(machines.length, 1);
  const [turret] = machines;
  assert.deepEqual({ kind: turret.kind, side: turret.side, name: turret.name }, { kind: 'turret', side: 'crew', name: 'Turret' });
  assert.ok(turret.x >= room.x && turret.x < room.x + room.w && turret.y >= room.y && turret.y < room.y + room.h);
  assert.equal(tileRule(battle, turret.x, turret.y, rules).cover, 'full');
  const unit = battle.units.find((u) => u.kind === 'turret');
  const stats = rules.machines.get('turret');
  assert.deepEqual([unit.side, unit.mobility, unit.hp, unit.aim, unit.weapon, unit.id], ['crew', 0, stats.hp, stats.aim, stats.weapon, `c${rules.squad.length + 1}`]);
  assert.equal(isMachine(unit, rules), true);
  assert.equal(battle.units.filter((u) => u.x === turret.x && u.y === turret.y).length, 1, 'no one else starts there');
  assert.deepEqual(machinesOn(mapFromShip(ship, rules, { wrecked: { [room.uid]: 'fire' } }), rules, 'crew'), []);
  assert.deepEqual(machinesOn(map, rules, 'enemy').map((m) => m.side), ['enemy']);
  const two = turretFight(['turret']);
  assert.deepEqual(two.machines.map((m) => m.name), ['Turret 1', 'Turret 2']);
  assert.throws(() => createBattle({ map, units: [{ kind: 'turret', x: turret.x, y: turret.y }], seed: 1 }, rules), /needs a side/);
});

test('a turret shoots, watches and reloads, never moves or opens a door, and at 0 hit points it is wrecked, on either side', () => {
  const { battle } = turretFight();
  const unit = battle.units.find((u) => u.kind === 'turret');
  const near = [unit.x + 1, unit.y];
  assert.match(act(battle, { type: 'move', unit: unit.id, to: near }, rules).error ?? '', /can only shoot, watch and reload/);
  for (const sideOf of ['n', 'e', 's', 'w']) assert.match(act(battle, { type: 'open', unit: unit.id, side: sideOf }, rules).error ?? '', /can only shoot, watch and reload/);
  const watching = act(battle, { type: 'overwatch', unit: unit.id }, rules);
  assert.equal(watching.ok, true, watching.error);
  // The AI on its turn: a shot or a watch, from where it stands.
  const alone = { ...battle, units: battle.units.map((u) => (u.side === 'crew' && u !== unit ? { ...u, ap: 0 } : u)) };
  const choice = aiAction(alone, rules);
  assert.ok(['shoot', 'overwatch'].includes(choice.type), choice.type);
  assert.equal(advance(alone, alone.units.find((u) => u.kind === 'turret'), rules), null);
  // Shot down on the crew's side: wrecked, not down.
  const boarder = battle.units.find((u) => u.side === 'enemy');
  const hurt = { ...battle, side: 'enemy', units: battle.units.map((u) => (u === unit ? { ...u, hp: 1, x: boarder.x + 1, y: boarder.y } : u.side === 'enemy' ? { ...u, ap: 2, ammo: 9 } : u)) };
  let shot = null;
  for (let seed = 0; seed < 300 && !shot; seed++) {
    const tried = act({ ...hurt, rng: seedFrom(seed) }, { type: 'shoot', unit: boarder.id, target: unit.id }, rules);
    if (tried.ok && tried.events.some((event) => event.type === 'dead')) shot = tried;
  }
  assert.ok(shot, 'a seed where the shot takes its last hit point');
  assert.equal(shot.battle.units.find((u) => u.id === unit.id).status, 'dead');
  assert.ok(!shot.events.some((event) => event.type === 'down' && event.unit === unit.id));
  // The log and the fight's words say it is wrecked.
  const wreck = shot.events.find((event) => event.type === 'dead' && event.unit === unit.id);
  assert.equal(wreck.wrecked, true);
  assert.equal(describeEvent(wreck, shot.battle), `Turret ${unit.id} is wrecked.`);
  assert.equal(stateText(shot.battle.units.find((u) => u.id === unit.id), rules), 'Wrecked');
});

test("a side whose people are all down has lost, whatever its turret: the boarders win past the crew's, the crew past the enemy's", () => {
  const { battle } = turretFight();
  const turret = battle.units.find((u) => u.kind === 'turret');
  const boarder = battle.units.find((u) => u.side === 'enemy');
  const [last, ...rest] = battle.units.filter((u) => u.side === 'crew' && u !== turret);
  // The shot that takes the last one standing down, on the first seed it does.
  const lastShot = (state, shooter, target) => {
    for (let seed = 0; seed < 300; seed++) {
      const tried = act({ ...state, rng: seedFrom(seed) }, { type: 'shoot', unit: shooter.id, target: target.id }, rules);
      if (tried.ok && tried.battle.units.find((u) => u.id === target.id).status !== 'active') return tried;
    }
    return null;
  };
  // The crew's last one beside a boarder at 1 hit point, the rest out.
  const crewLast = { ...battle, side: 'enemy', units: battle.units.map((u) => (u === last ? { ...u, hp: 1, x: boarder.x + 1, y: boarder.y } : rest.includes(u) ? { ...u, status: 'out', hp: 0 } : u.side === 'enemy' ? { ...u, ap: 2, ammo: 9 } : u)) };
  const lost = lastShot(crewLast, boarder, last);
  assert.ok(lost, 'a seed where the shot takes them down');
  assert.equal(lost.battle.units.find((u) => u.id === turret.id).status, 'active');
  assert.equal(lost.battle.winner, 'enemy');
  // The turret the enemy's, their last boarder at 1 hit point beside the crew.
  const others = battle.units.filter((u) => u.side === 'enemy' && u !== boarder);
  const theirs = { ...battle, side: 'crew', units: battle.units.map((u) => (u === turret ? { ...u, side: 'enemy' } : u === boarder ? { ...u, hp: 1, x: last.x + 1, y: last.y } : others.includes(u) ? { ...u, status: 'dead', hp: 0 } : u.side === 'crew' ? { ...u, ap: 2, ammo: 9 } : u)) };
  const won = lastShot(theirs, last, boarder);
  assert.ok(won, 'a seed where the shot takes the last boarder down');
  assert.equal(won.battle.units.find((u) => u.id === turret.id).status, 'active');
  assert.equal(won.battle.winner, 'crew');
  // While someone stands, the turret fights on.
  assert.equal(act(crewLast, { type: 'end' }, rules).battle.winner, null);
});

test('selected, a turret has only Shoot, Overwatch and Reload: no tiles to move to, no door, no stabilizing, and its card says so', () => {
  const { battle } = turretFight();
  const unit = battle.units.find((u) => u.kind === 'turret');
  // A crew member down beside it, for a Stabilize it can't give.
  const beside = battle.units.find((u) => u.side === 'crew' && u !== unit);
  const placed = { ...battle, units: battle.units.map((u) => (u === beside ? { ...u, x: unit.x + 1, y: unit.y, status: 'down', bleed: 2, hp: 0 } : u === unit ? { ...u, ammo: 1 } : u)) };
  const fight = { ...createFight(placed, rules), selected: unit.id };
  const orders = ordersFor(fight, rules);
  assert.equal(orders.reach.size, 0);
  assert.deepEqual([orders.stabilize, orders.door, orders.grab, orders.hack, orders.free, orders.plant, orders.order], [null, null, null, false, false, null, null]);
  assert.deepEqual([orders.reload, orders.overwatch], [true, true]);
  const card = unitText(placed.units.find((u) => u.id === unit.id), rules, placed);
  assert.match(card.lines[0], /^Your ship's security turret · \d+\/\d+ hit points/);
  assert.match(card.lines.join(' '), /never moves or opens a door/);
  // Wrecked, it can't be picked, and the notice says why.
  const wrecked = { ...createFight({ ...placed, units: placed.units.map((u) => (u.id === unit.id ? { ...u, status: 'dead', hp: 0 } : u)) }, rules) };
  const tapped = reduceFight(wrecked, { type: 'fight/select', unit: unit.id }, rules);
  assert.match(tapped.notice?.text ?? '', /Turret is wrecked\./);
});

test("a turret isn't one of the crew: a fight's end maps the crew past it, a save reads with it, and its gun never comes away", () => {
  const campaign = onRun();
  const { battle } = turretFight();
  const crew = campaign.crew.slice(0, rules.squad.length);
  const fight = { encounter: 'boarders', seed: 7, crew: crew.map((member) => member.id), battle: { ...battle, winner: 'crew' }, log: [], job: null, raid: false, boarding: null };
  const inFight = { ...campaign, crew: campaign.crew.map((member) => ({ ...member, job: rules.squad[campaign.crew.indexOf(member)] ?? member.job })), place: 'fight', fight };
  assert.deepEqual(campaignProblems(inFight), []);
  const after = endFight(inFight, rules);
  assert.equal(after.fight, null);
  assert.equal(after.crew.length, campaign.crew.length);
  // An enemy turret wrecked: no gear from it.
  const enemyTurret = { ...battle, winner: 'crew', units: battle.units.map((u) => (u.kind === 'turret' ? { ...u, side: 'enemy', status: 'dead' } : u.side === 'enemy' ? { ...u, status: 'active' } : u)) };
  const withGear = { ...rules, balance: { ...balance, gearChance: 100 } };
  assert.equal(gearWon({ seed: 1 }, enemyTurret, withGear), null);
});

test('at the colony: a sensor mast and a fire director +10 to hit at a lander, a machine shop 1 more from each mine, a field station a place more, a greenhouse 2 food a day', () => {
  const landed = settled();
  const build = (campaign, list) => ({ ...campaign, colony: { ...campaign.colony, buildings: list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 })), nextUid: list.length + 1 } });
  const noMarine = without(landed, 'marine');
  const armed = build({ ...noMarine, heat: 70 }, [['reactor', 6, 0], ['weapon', 0, 0], ['scanner', 0, 3], ['firecontrol', 3, 3]]);
  const down = { ...armed, colony: { ...armed.colony, day: 2, raid: { found: 1, lands: 2 } } };
  assert.deepEqual(colonyStats(down, rules).effects, { landing: 20 });
  assert.equal(landingPlan(down, rules).hit, balance.landingHit + 20);
  const dark = build({ ...noMarine, heat: 70 }, [['weapon', 0, 0], ['scanner', 0, 3]]);
  // Unpowered, a sensor mast is dark and adds nothing.
  const darkStats = colonyStats({ ...dark, ship: { ...dark.ship, modules: dark.ship.modules.filter((m) => !rules.modules.get(m.type).tags.includes('reactor')) } }, rules);
  assert.equal(darkStats.effects.landing ?? 0, 0);
  // The machine shop and the field station.
  const { world } = landed.colony;
  const mine = Math.max(1, world.ore);
  const shop = build(without(landed, 'engineer'), [['reactor', 6, 0], ['mine', 4, 4], ['workshop', 0, 0]]);
  assert.equal(crewYields(shop, rules).materials, 1);
  assert.equal(colonyStats(shop, rules).made.materials, mine + 1);
  assert.equal(crewYields(withJob(shop, 1, 'engineer'), rules).materials, 2, "the engineer's and the shop's");
  const field = build(landed, [['reactor', 6, 0], ['surveylab', 0, 0]]);
  assert.equal(rollPlaces(field, rules).places.length, rollPlaces(landed, rules).places.length + 1);
  // The greenhouse.
  const green = build(landed, [['reactor', 6, 0], ['hydroponics', 0, 0]]);
  const house = colonyStats(green, rules).buildings.find((b) => b.type === 'hydroponics');
  assert.deepEqual([house.powered, house.makes, house.worked], [true, { food: 2 }, false]);
  assert.equal(dayPlan(green, rules).made.food, colonyStats(landed, rules).made.food + 2);
  // The parts that stay aboard say so.
  for (const type of ['ecm', 'grapple', 'baffles', 'turret']) {
    const ship = withPart(landed.ship, rules, type);
    assert.equal(donatePlan({ ...landed, ship }, rules, uidOf(ship, type)).error, 'Stays aboard: no use to the colony.', type);
  }
});
