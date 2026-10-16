// Standing with the sides (src/sim/standing.js, M33): five levels from -10
// to 10; what moves it (a job done or lost, an event's outcome, a side's ship
// struck), always within -10 to 10; and what it changes (a side's station's
// prices, docking with the pursuer's side, a friendly side's pay, the
// Fleet's patrols). Saved from v26.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems, maxHp, newCampaign } from '../src/sim/campaign.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { closeApproach, giveOrder } from '../src/sim/encounter.js';
import { chooseEvent } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { hasTag } from '../src/sim/modules.js';
import { patchPlan } from '../src/sim/patch.js';
import { feeOf, recruitsAt } from '../src/sim/recruits.js';
import { repairPlan } from '../src/sim/repair.js';
import { seedFrom } from '../src/core/rng.js';
import { initialState, saveData } from '../src/sim/root.js';
import { costAt, jobMoves, jobPay, jobSides, levelOf, moveStanding, nextLevel, pursuerSide, shipMoves, standingWith, stationSide, STRUCK } from '../src/sim/standing.js';
import { beginRun, buySupplies, holdOf, jump, jumpPlan, linked, supplyOffer } from '../src/sim/travel.js';
import { OUTCOMES } from '../src/sim/approach.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
// Every side at 0: neutral.
const EVEN = { conreg: 0, fleet: 0, hallorans: 0, union: 0 };
// A standing at each level.
const AT = { hostile: -6, cold: -2, neutral: 0, friendly: 2, trusted: 6 };
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The first node on from the way in, made into `node` (its kind and what it
// holds); nothing else on the map holds anything. { campaign, to }.
function ahead(campaign, node) {
  const { sector } = campaign.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...rest }) => (rest.id === to ? { ...rest, ...node } : rest));
  return { campaign: { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes } } }, to };
}
// The ship at that node, without a jump.
const there = ({ campaign, to }) => ({ ...campaign, run: { ...campaign.run, at: to, seen: [...campaign.run.seen, to] } });

test('standing runs from -10 to 10 in five levels, their edges in data/balance.json', () => {
  const cases = [[-10, 'hostile'], [-6, 'hostile'], [-5, 'cold'], [-2, 'cold'], [-1, 'neutral'], [0, 'neutral'], [1, 'neutral'], [2, 'friendly'], [5, 'friendly'], [6, 'trusted'], [10, 'trusted']];
  for (const [value, level] of cases) assert.equal(levelOf(value, rules), level, String(value));
  assert.deepEqual(nextLevel(-10, rules), { level: 'cold', by: 5 });
  assert.deepEqual(nextLevel(-3, rules), { level: 'neutral', by: 2 });
  assert.deepEqual(nextLevel(0, rules), { level: 'friendly', by: 2 });
  assert.deepEqual(nextLevel(5, rules), { level: 'trusted', by: 1 });
  assert.equal(nextLevel(6, rules), null, 'trusted is the top');
});

test("a new campaign starts hostile with its pursuer's side and neutral with the rest", () => {
  for (const [background, side] of [['miner', 'conreg'], ['deserter', 'fleet'], ['smuggler', 'hallorans']]) {
    const campaign = newCampaign(rules, 3, { background });
    assert.deepEqual(campaign.standing, { ...EVEN, [side]: -10 }, background);
    assert.equal(pursuerSide(campaign, rules), side);
    assert.equal(levelOf(standingWith(campaign, side), rules), 'hostile');
    assert.deepEqual(campaignProblems(campaign), []);
  }
});

test('standing stays within -10 to 10, and a side the content lacks is passed by', () => {
  const campaign = newCampaign(rules, 3);
  const { campaign: moved, changes } = moveStanding(campaign, rules, { conreg: -3, union: 12, guild: 4, fleet: 0 });
  assert.deepEqual(moved.standing, { ...EVEN, conreg: -10, union: 10 });
  assert.deepEqual(changes, [{ side: 'conreg', by: -3, from: -10, to: -10 }, { side: 'union', by: 12, from: 0, to: 10 }]);
  assert.equal(moveStanding(campaign, rules, {}).campaign, campaign, 'nothing moved, nothing changed');
  assert.equal(standingWith({ standing: {} }, 'union'), 0, 'a side the save lacks stands at 0');
  assert.deepEqual(campaignProblems(moved), []);
});

// The union steward's payroll job: for the union, against Con-Reg's guards.
const PAYROLL = { contract: 'payroll', client: 'marta', site: 'pit9', twist: null, seed: 7, credits: 120, part: null };
// A miner's campaign standing as given, the job first on its board, taken
// and its fight over: { campaign (before), after }.
function jobEnded(job, winner, standing) {
  const fresh = withBoard(newCampaign(rules, 9), rules);
  const campaign = { ...fresh, standing: { ...fresh.standing, ...standing }, board: [job, ...fresh.board.slice(1)] };
  const on = takeJob(campaign, rules, 0).campaign;
  return { campaign, after: endJob({ ...on, fight: { ...on.fight, battle: { ...on.fight.battle, winner } } }, rules) };
}

test('a job done is +2 for its client\'s side and -2 against its enemies\'; lost, -2 against them', () => {
  assert.deepEqual(jobSides(PAYROLL, rules), { for: 'union', against: 'conreg' });
  assert.deepEqual(jobSides({ ...PAYROLL, contract: 'jumpers', client: 'sully' }, rules), { for: 'conreg', against: null }, 'the foreman works for Con-Reg');
  assert.deepEqual(jobSides({ ...PAYROLL, contract: 'dockwar', client: 'gage', site: 'pits' }, rules), { for: 'union', against: null });
  assert.deepEqual(jobSides({ ...PAYROLL, contract: 'scrap', client: 'dutch', site: 'yard' }, rules), { for: null, against: null }, 'a dealer is on nobody\'s side');
  assert.deepEqual(jobMoves(PAYROLL, rules, true), { union: balance.jobStanding, conreg: -balance.jobStanding });
  assert.deepEqual(jobMoves(PAYROLL, rules, false), { conreg: -balance.lostStanding });
  const won = jobEnded(PAYROLL, 'crew', { conreg: 0 }).after;
  assert.deepEqual(won.standing, { ...EVEN, conreg: -2, union: 2 });
  assert.deepEqual(campaignProblems(won), []);
  const lost = jobEnded(PAYROLL, 'enemy', { conreg: 0 }).after;
  assert.deepEqual(lost.standing, { ...EVEN, conreg: -2 });
  assert.deepEqual(jobEnded({ ...PAYROLL, contract: 'scrap', client: 'dutch', site: 'yard' }, 'crew', {}).after.standing, { ...EVEN, conreg: -10 }, 'no side, no move');
});

test("a job for a friendly side pays 10% more, for a trusted one 20%, in steps of 5 credits", () => {
  const campaign = newCampaign(rules, 9);
  const standing = (union) => ({ ...campaign, standing: { ...campaign.standing, union } });
  const pay = (union, credits, job = PAYROLL) => jobPay(standing(union), rules, { ...job, credits });
  assert.deepEqual([AT.hostile, AT.cold, AT.neutral, 1].map((union) => pay(union, 120)), [120, 120, 120, 120], 'no more below friendly, and no less');
  assert.equal(pay(AT.friendly, 120), 130, '132, to the nearest 5');
  assert.equal(pay(AT.trusted, 120), 145, '144, to the nearest 5');
  assert.equal(pay(AT.friendly, 70), 75, '77');
  assert.equal(pay(AT.trusted, 70), 85, '84');
  assert.equal(pay(AT.trusted, 120, { ...PAYROLL, contract: 'scrap', client: 'dutch' }), 120, 'a client of no side pays what the board says');
  const { campaign: before, after } = jobEnded(PAYROLL, 'crew', { union: AT.friendly, conreg: 0 });
  assert.equal(after.credits, before.credits + 130, 'paid with the bonus, at the standing it was taken at');
  assert.equal(jobEnded(PAYROLL, 'enemy', { union: AT.trusted }).after.credits, before.credits, 'lost, unpaid');
});

// The ship at node 1, that node holding event `eventId`.
function atEvent(eventId, extra = {}) {
  const campaign = onRun(extra);
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === 1 ? { ...node, type: rules.events.get(eventId).kind, event: eventId } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: 1, seen: [...new Set([...campaign.run.seen, 1])] } };
}

test("an event's outcome moves standing: the company wreck, the stalled miner, and a new event for each side", () => {
  const cases = [
    ['company-wreck', 'fast', { conreg: -1 }],
    ['company-wreck', 'leave', {}],
    ['stalled-miner', 'tow', { union: 1 }],
    ['stalled-miner', 'crate', { union: 1 }],
    ['fleet-tender', 'help', { fleet: 2 }],
    ['fleet-tender', 'stores', { fleet: -2 }],
    ['survey-skiff', 'tow', { conreg: 2 }],
    ['survey-skiff', 'cores', { conreg: -2 }],
    ['halloran-drop', 'take', { hallorans: -2 }],
    ['halloran-drop', 'call', { hallorans: 1 }],
    ['coop-barge', 'fund', { union: 2 }],
    ['coop-barge', 'buy', {}],
  ];
  for (const [event, choice, moves] of cases) {
    const chose = chooseEvent(atEvent(event, { standing: EVEN }), rules, choice);
    assert.ok(chose.ok, `${event} ${choice}: ${chose.error}`);
    assert.deepEqual(chose.campaign.standing, { ...EVEN, ...moves }, `${event} ${choice}`);
    assert.deepEqual(chose.result.changes.standing, Object.entries(moves).map(([side, by]) => ({ side, by, from: 0, to: by })));
    assert.deepEqual(campaignProblems(chose.campaign), []);
  }
  // Each side meets the ship in one of the four new events.
  const sides = new Set(['fleet-tender', 'survey-skiff', 'halloran-drop', 'coop-barge'].flatMap((id) => rules.events.get(id).choices.flatMap((c) => c.outcomes.flatMap((o) => Object.keys(o.effects.standing ?? {})))));
  assert.deepEqual([...sides].sort(), ['conreg', 'fleet', 'hallorans', 'union']);
});

test("a side's ship boarded, blown up or left adrift costs 3 with its side; any other end, or a ship of no side, costs nothing", () => {
  const corvette = rules.ships.get('corvette');
  for (const kind of OUTCOMES) assert.deepEqual(shipMoves(corvette, kind, rules), STRUCK.includes(kind) ? { fleet: -balance.shipStanding } : {}, kind);
  assert.deepEqual(STRUCK, ['boarded', 'destroyed', 'adrift']);
  assert.deepEqual(shipMoves(rules.ships.get('cutter'), 'destroyed', rules), {}, 'pirates are on nobody\'s side');
  assert.deepEqual(shipMoves(rules.ships.get('repotug'), 'boarded', rules), { conreg: -3 }, "the hunters are their pursuer's");
  // At a corvette, neutral with the Fleet: her shields down and her reactors
  // crippled to one hit from going, the crew fires at them until the
  // approach ends.
  const set = ahead(onRun({ standing: EVEN }), { type: 'hostile', hostile: { ship: 'corvette', seed: 1 } });
  const met = jump(set.campaign, rules, set.to).campaign;
  assert.equal(met.run.approach.patrol, null, 'neutral: no patrol, the approach as before');
  const { them } = met.run.approach;
  const tagged = (tag) => them.ship.modules.filter((m) => hasTag(rules.modules.get(m.type), tag));
  const reactors = tagged('reactor');
  const wrecked = { ...them.wrecked, ...Object.fromEntries([...reactors.slice(1), ...tagged('shield')].map((m) => [m.uid, 'fire'])) };
  const damage = { [reactors[0].uid]: rules.modules.get(reactors[0].type).stats.hp - 1 };
  const crippled = { ...met, run: { ...met.run, approach: { ...met.run.approach, them: { ...them, wrecked, damage } } } };
  const ends = new Map();
  for (let seed = 0; seed < 300 && ends.size < 2; seed++) {
    let at = { ...crippled, rng: seedFrom(seed) };
    while (!at.run.approach.outcome) {
      const fired = giveOrder(at, rules, { kind: 'fire', at: 'reactor' });
      at = (fired.ok ? fired : giveOrder(at, rules, { kind: 'evade' })).campaign;
    }
    ends.set(STRUCK.includes(at.run.approach.outcome.kind), at);
  }
  const struck = ends.get(true);
  assert.ok(struck, 'struck in one of 300 seeds');
  assert.equal(struck.standing.fleet, -balance.shipStanding);
  assert.deepEqual(struck.run.approach.outcome.changes.standing, [{ side: 'fleet', by: -3, from: 0, to: -3 }]);
  assert.deepEqual(campaignProblems(struck), []);
  const missed = ends.get(false);
  assert.ok(missed, 'and not struck in another');
  assert.deepEqual([missed.standing.fleet, missed.run.approach.outcome.changes.standing], [0, []]);
});

// A corvette one node on, the campaign standing with the Fleet at `fleet`:
// the approach as the ship arrives.
function atPatrol(fleet, extra = {}) {
  const set = ahead(onRun({ standing: { ...EVEN, fleet }, ...extra }), { type: 'hostile', hostile: { ship: 'corvette', seed: 1 } });
  return { before: set.campaign, after: jump(set.campaign, rules, set.to).campaign, to: set.to };
}

test("the Fleet's patrols wave a friendly or trusted crew through, fire first on a hostile one, and meet anyone else as before", () => {
  for (const level of ['friendly', 'trusted']) {
    const { before, after, to } = atPatrol(AT[level]);
    const { approach } = after.run;
    assert.deepEqual([approach.patrol, approach.outcome.kind, approach.round, approach.fired, approach.last], ['waved', 'waved', 1, false, null], level);
    assert.deepEqual(approach.outcome.changes, { credits: 0, parts: [], lost: null, heat: 0, patched: [], standing: [] });
    assert.ok(after.run.done.includes(to), 'the node is done');
    assert.deepEqual([after.rng, after.heat, after.wrecks, after.flags.patrolsWaved], [before.rng, before.heat + balance.jumpHeat, before.wrecks, 1], 'not a shot fired');
    assert.equal(holdOf(after, rules), 'Carry on first.');
    assert.equal(closeApproach(after).campaign.run.approach, null);
    assert.deepEqual(campaignProblems(after), []);
  }
  for (const level of ['hostile']) {
    const { before, after } = atPatrol(AT[level]);
    const { approach } = after.run;
    assert.deepEqual([approach.patrol, approach.outcome, approach.round], ['fired', null, 1]);
    assert.equal(approach.last.order, null, 'before any order of the player\'s');
    assert.deepEqual(approach.last.intent, { kind: 'fire', at: rules.ships.get('corvette').tactics.aim[0] });
    assert.deepEqual(approach.last.events.map((e) => [e.kind, e.side, e.at, e.shots.length]), [['volley', 'them', 'weapons', approach.them.ship.modules.filter((m) => hasTag(rules.modules.get(m.type), 'weapon')).length]]);
    assert.equal(approach.fired, true);
    assert.notEqual(after.rng, before.rng, 'the volley rolls');
    assert.equal(after.flags.patrolsFired, 1);
    assert.deepEqual(campaignProblems(after), []);
    // Round 1 plays as ever after it.
    const played = giveOrder(after, rules, { kind: 'evade' });
    assert.ok(played.ok, played.error);
    assert.equal(played.campaign.run.approach.round, 2);
  }
  for (const level of ['neutral', 'cold']) {
    const { approach } = atPatrol(AT[level]).after.run;
    assert.deepEqual([approach.patrol, approach.outcome, approach.last, approach.fired], [null, null, null, false], level);
  }
  // A pirate cutter is no patrol, whatever the Fleet thinks.
  const set = ahead(onRun({ standing: { ...EVEN, fleet: AT.trusted } }), { type: 'hostile', hostile: { ship: 'cutter', seed: 3 } });
  assert.equal(jump(set.campaign, rules, set.to).campaign.run.approach.patrol, null);
  // The deserter's crew starts hostile with the Fleet: every patrol fires first.
  assert.equal(levelOf(newCampaign(rules, 1, { background: 'deserter' }).standing.fleet, rules), 'hostile');
});

// The ship docked at a station of the union's (Union Hall Twelve), the
// crew standing with the union at `union`, hurt, with wrecks aboard.
function atUnionHall(union, extra = {}) {
  const campaign = onRun({ credits: 900, standing: { ...EVEN, union }, ...extra });
  const docked = there(ahead(campaign, { type: 'station', name: 'Union Hall Twelve' }));
  const uid = (type) => docked.ship.modules.find((m) => m.type === type).uid;
  const crew = docked.crew.map((member) => ({ ...member, hp: maxHp(member, rules) - 2 }));
  return { ...docked, crew, supplies: 0, wrecks: { [uid('engine')]: 'fire' } };
}

test("a side's station charges its level's share: supplies, repairs, patching and recruits, each rounded as its price is", () => {
  const shares = { hostile: 150, cold: 125, neutral: 100, friendly: 90, trusted: 75 };
  // Ten supplies at a crate a credit; an engine's repair, 50 at the full
  // price, in steps of 5; six hit points patched at 2 each.
  const expected = { hostile: [15, 75, 18], cold: [13, 65, 15], neutral: [10, 50, 12], friendly: [9, 45, 11], trusted: [8, 40, 9] };
  for (const [level, share] of Object.entries(shares)) {
    const docked = atUnionHall(AT[level]);
    assert.equal(stationSide(docked.run.sector.nodes[docked.run.at], rules), 'union');
    const offer = supplyOffer(docked, rules);
    assert.equal(offer.share, share, level);
    const bought = buySupplies(docked, rules, 10);
    assert.equal(docked.credits - bought.campaign.credits, expected[level][0], `${level} supplies`);
    const repair = repairPlan(docked, rules);
    assert.deepEqual([repair.share, repair.cost], [share, expected[level][1]], `${level} repair`);
    const patch = patchPlan(docked, rules);
    assert.deepEqual([patch.share, patch.hp, patch.cost], [share, 6, expected[level][2]], `${level} patching`);
    for (const recruit of recruitsAt(docked, rules, docked.run.at)) assert.equal(recruit.fee, costAt(1, feeOf(recruit, rules), share), `${level} recruit`);
  }
  // A recruit's fee at 100% is M32b's: 30, 20 more a trait, 40 more a rank.
  assert.equal(feeOf({ job: 'marine', traits: ['steady'], fights: 0 }, rules), 50);
  assert.deepEqual(Object.keys(shares).map((level) => feeOf({ job: 'marine', traits: ['steady'], fights: 0 }, rules, shares[level])), [75, 63, 50, 45, 38]);
  // Nobody's station charges the full price, whatever the standing.
  const nobody = there(ahead(onRun({ standing: { ...EVEN, union: AT.trusted } }), { type: 'station', name: "Mac's Pumps" }));
  assert.equal(stationSide(nobody.run.sector.nodes[nobody.run.at], rules), null);
  assert.equal(supplyOffer(nobody, rules).share, 100);
  // As far as the credits go, at the share.
  assert.equal(supplyOffer({ ...atUnionHall(AT.hostile), credits: 4 }, rules).most, 2, 'two cost 3; three cost 4.5, a half rounded up to 5');
});

test("docking at a station of the pursuer's side adds 10 heat, shown in the jump plan", () => {
  for (const [background, name] of [['miner', 'The Depot'], ['deserter', 'Rest Stop Nine'], ['smuggler', "Big Rita's"]]) {
    const campaign = { ...onRun(), background };
    const set = ahead(campaign, { type: 'station', name });
    const plan = jumpPlan(set.campaign, rules, set.to);
    assert.deepEqual([plan.ok, plan.heat, plan.dock], [true, balance.jumpHeat, balance.dockHeat], background);
    assert.equal(jump(set.campaign, rules, set.to).campaign.heat, campaign.heat + balance.jumpHeat + balance.dockHeat);
  }
  // Another side's station, or nobody's: no docking heat.
  for (const name of ['Union Hall Twelve', 'Rest Stop Nine', "Mac's Pumps"]) {
    const set = ahead(onRun(), { type: 'station', name });
    assert.equal(jumpPlan(set.campaign, rules, set.to).dock, 0, name);
  }
});

test('saves: v26 for standing; a v25 campaign stands where its background starts a new one, and an approach under way meets no patrol', () => {
  assert.equal(SAVE_VERSION, 26);
  const step = MIGRATIONS.find((m) => m.from === 25);
  for (const background of ['miner', 'deserter', 'smuggler']) {
    const campaign = newCampaign(rules, 4, { background });
    const { standing, ...v25 } = campaign;
    assert.deepEqual(step.up({ campaign: v25 }).campaign, campaign, background);
  }
  assert.deepEqual(step.up({ campaign: null }), { campaign: null });
  // An approach under way, as v25 saved it.
  const { after: met } = atPatrol(AT.neutral, { standing: { conreg: -10, fleet: 0, hallorans: 0, union: 0 } });
  const { standing, ...v25 } = met;
  const { patrol, ...approach } = met.run.approach;
  const data = { ...saveData(initialState(5)), campaign: { ...v25, run: { ...met.run, approach } } };
  assert.deepEqual(step.up(data).campaign, met);
  const opened = parseSave(JSON.stringify({ version: 25, data }));
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(campaignProblems(opened.save.data.campaign), []);
  // A quit and reopen keeps the standing; broken ones are caught.
  const stood = { ...met, standing: { conreg: -7, fleet: 3, hallorans: 0, union: 10 } };
  const again = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(5)), campaign: stood })));
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.save.data.campaign.standing, stood.standing);
  for (const broken of [null, [], { union: 11 }, { union: 1.5 }, { Union: 1 }, { union: '1' }]) {
    assert.match(campaignProblems({ ...stood, standing: broken }).join(' '), /standing with the sides is unreadable/, JSON.stringify(broken));
  }
  const waved = atPatrol(AT.friendly).after;
  assert.deepEqual(campaignProblems({ ...waved, run: { ...waved.run, approach: { ...waved.run.approach, patrol: null } } }), ["The campaign's run has an unreadable approach."], 'waved through needs its patrol');
  assert.deepEqual(campaignProblems({ ...met, run: { ...met.run, approach: { ...met.run.approach, patrol: 'saluted' } } }), ["The campaign's run has an unreadable approach."]);
});
