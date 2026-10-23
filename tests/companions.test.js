// Companions (M33c): one for each side, signing on at the end of their
// side's chain given a free berth, and loyal once their loyalty quest's
// place at the colony is won, their order at a third rank
// (src/sim/companions.js, src/sim/talents.js, data/companions.json).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, SAVE_VERSION } from '../src/core/save.js';
import { act, createBattle } from '../src/sim/battle.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { campaignProblems, crewUnit, maxHp } from '../src/sim/campaign.js';
import { aboard, freeBerths, joinCompanion, memberTalent } from '../src/sim/companions.js';
import { choiceProblem, chooseEvent } from '../src/sim/events.js';
import { boardPlace, endPlaceFight, flyOut, withPlaces } from '../src/sim/expeditions.js';
import { orderOf } from '../src/sim/orders.js';
import { jobAtRank } from '../src/sim/ranks.js';
import { dismissCrew } from '../src/sim/recruits.js';
import { TALENT_RANK, talentOrder } from '../src/sim/talents.js';
import { openMap, rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { atEvent, atStep, CHAINS, moveTo, onRun, winner } from './companionKit.js';

test("each side's chain starts at its event, and its step is an event of its own in the next sector", () => {
  for (const [chain, { start, step }] of Object.entries(CHAINS)) {
    const there = atEvent(onRun(), start[0]);
    const started = chooseEvent(there, rules, start[1]);
    assert.equal(started.ok, true, `${chain}: ${started.error}`);
    assert.deepEqual(started.campaign.quests[chain], { step: 0, state: 'open' }, chain);
    assert.equal(started.result.quest.did, 'started', chain);
    const node = atStep(chain).run.sector.nodes.find((n) => n.quest === chain);
    assert.deepEqual([node.event, node.type], [step, rules.events.get(step).kind], chain);
  }
});

test("the chain's step signs its companion on, given a free berth: their name, job, traits, fights and face, at full health, and their loyalty quest open", () => {
  for (const [chain, { join, companion: id }] of Object.entries(CHAINS)) {
    const there = atStep(chain);
    assert.equal(freeBerths(there, rules), 1, 'the ship has a berth to spare');
    const made = chooseEvent(there, rules, join);
    assert.equal(made.ok, true, `${chain}: ${made.error}`);
    const companion = rules.companions.get(id);
    const member = aboard(made.campaign, id);
    assert.deepEqual(
      { name: member.name, job: member.job, traits: member.traits, fights: member.fights, look: member.look, companion: member.companion },
      { name: companion.name, job: companion.job, traits: companion.traits, fights: companion.fights, look: companion.look, companion: id },
    );
    assert.equal(member.hp, maxHp(member, rules));
    assert.equal(member.id, Math.max(...there.crew.map((m) => m.id)) + 1);
    assert.equal(made.campaign.crew.length, there.crew.length + 1);
    assert.deepEqual(made.campaign.quests[chain], { step: 0, state: 'done' }, 'the chain is done');
    assert.deepEqual(made.campaign.quests[companion.loyalty], { step: 0, state: 'open' }, 'the loyalty quest is open');
    assert.equal(made.result.changes.joined, id);
    assert.deepEqual(campaignProblems(made.campaign), [], chain);
  }
});

test('with no berth free the companion can\'t sign on; the step can still be done without them, ended, or left', () => {
  for (const [chain, { join, done, cold, companion: id }] of Object.entries(CHAINS)) {
    const there = atStep(chain);
    const full = { ...there, crew: [...there.crew, { ...there.crew[2], id: 9, name: 'Stowaway' }] };
    const choice = rules.events.get(CHAINS[chain].step).choices.find((c) => c.id === join);
    assert.equal(choiceProblem(full, choice, rules), 'Needs a free berth.', chain);
    assert.equal(chooseEvent(full, rules, join).error, 'Needs a free berth.', chain);
    const without = chooseEvent(full, rules, done).campaign;
    assert.deepEqual(without.quests[chain], { step: 0, state: 'done' }, chain);
    assert.equal(aboard(without, id), null);
    assert.ok(!(rules.companions.get(id).loyalty in without.quests), 'no loyalty quest without them');
    assert.deepEqual(chooseEvent(there, rules, cold).campaign.quests[chain], { step: 0, state: 'cold' }, chain);
    const leave = rules.events.get(CHAINS[chain].step).choices.find((c) => ![join, done, cold].includes(c.id)).id;
    assert.deepEqual(chooseEvent(there, rules, leave).campaign.quests[chain], { step: 0, state: 'open' }, chain);
  }
  // joinCompanion itself turns away a second sign-on and one with no berth.
  const home = settled();
  const once = joinCompanion(home, rules, 'osei');
  assert.ok(once.joined);
  assert.equal(joinCompanion(once.campaign, rules, 'osei').joined, null, 'aboard already');
  assert.equal(joinCompanion(once.campaign, rules, 'varga').joined, null, 'no berth left');
  assert.equal(joinCompanion(home, rules, 'nobody').joined, null, 'no such companion');
});

test('loyalty: their place is within reach of the colony, held by someone from their past; won, they are loyal', () => {
  const home = joinCompanion(settled(), rules, 'osei').campaign;
  const listed = withPlaces(home, rules);
  const place = listed.colony.places.find((p) => p.quest === 'osei-loyal');
  assert.deepEqual([place.name, place.held, place.days], ["Survey chief's tug", true, 2]);
  assert.deepEqual(campaignProblems(listed), []);
  const index = listed.colony.places.indexOf(place);
  const osei = aboard(listed, 'osei');
  const there = flyOut(listed, rules, index, [1, osei.id]).campaign;
  const begun = boardPlace(there, rules);
  assert.equal(begun.ok, true, begun.error);
  assert.equal(begun.campaign.fight.encounter, 'guards');
  // Lost: not loyal yet, and the place is still there.
  const lost = endPlaceFight(winner(begun.campaign, 'enemy'), rules);
  assert.deepEqual(lost.quests['osei-loyal'], { step: 0, state: 'open' });
  assert.equal(aboard(lost, 'osei').loyal, undefined);
  // Won: loyal, and the fight's result says the quest is finished.
  const won = endPlaceFight(winner(begun.campaign, 'crew'), rules);
  assert.deepEqual(won.quests['osei-loyal'], { step: 0, state: 'done' });
  assert.equal(aboard(won, 'osei').loyal, true);
  assert.equal(won.colony.trip.result.quest.did, 'finished');
  assert.deepEqual(campaignProblems(won), []);
});

test("a loyal companion's order is at a third rank: their job's rank 2 with their talent's numbers over it, in every fight", () => {
  for (const [id, companion] of rules.companions) {
    const rank2 = jobAtRank(rules.jobs.get(companion.job), 2).order;
    assert.deepEqual(talentOrder(rules, id), { ...rank2, ...companion.talent.order }, id);
    const member = { ...joinCompanion(settled(), rules, id).joined, loyal: true };
    assert.deepEqual(memberTalent(member, rules), talentOrder(rules, id));
    assert.equal(memberTalent({ ...member, loyal: undefined }, rules), null, 'not loyal, no talent');
    const unit = crewUnit(member, rules);
    assert.deepEqual([unit.rank, unit.talent], [TALENT_RANK, id], id);
    const before = crewUnit({ ...member, loyal: undefined }, rules);
    assert.equal(before.talent, undefined);
    const { battle } = createBattle({ map: openMap(6, 3), seed: 3, units: [{ ...unit, x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }] }, rules);
    assert.deepEqual(orderOf(battle.units[0], rules), talentOrder(rules, id), id);
    assert.equal(battle.units[0].uses, talentOrder(rules, id).uses);
    assert.equal(battleProblem(battle), null);
  }
  // Dez's Patch heals 8 where a rank 1 medic's heals 5.
  const dez = { ...joinCompanion(settled(), rules, 'halloran').joined, loyal: true };
  const fight = (medic) => createBattle({ map: openMap(6, 3), seed: 3, units: [{ ...crewUnit(medic, rules), x: 0, y: 1 }, { kind: 'marine', x: 1, y: 1, hp: 1 }, { kind: 'pirate', x: 5, y: 1 }] }, rules).battle;
  const patched = (battle) => act(battle, { type: 'order', unit: 'c1', target: 'c2' }, rules).battle.units.find((u) => u.id === 'c2').hp;
  assert.equal(patched(fight(dez)), 9);
  assert.equal(patched(fight({ ...dez, loyal: undefined })), 1 + jobAtRank(rules.jobs.get('medic'), 1).order.hp);
});

test('a companion let go ends their loyalty quest, and the chain they came through stays done', () => {
  const there = atStep('runner');
  const joined = chooseEvent(there, rules, 'towjoin').campaign;
  const dez = aboard(joined, 'halloran');
  // At a station: another node of the sector made one.
  const id = joined.run.sector.nodes.find((n) => !['start', 'exit'].includes(n.type) && !n.quest && !joined.run.done.includes(n.id)).id;
  const nodes = joined.run.sector.nodes.map((n) => (n.id === id ? { ...n, type: 'station', event: undefined, hostile: undefined } : n));
  const docked = moveTo({ ...joined, run: { ...joined.run, sector: { ...joined.run.sector, nodes } } }, id);
  const gone = dismissCrew(docked, rules, dez.id);
  assert.equal(gone.ok, true, gone.error);
  assert.equal(aboard(gone.campaign, 'halloran'), null);
  assert.deepEqual(gone.campaign.quests['halloran-loyal'], { step: 0, state: 'cold' });
  assert.deepEqual(gone.campaign.quests.runner, { step: 0, state: 'done' });
  assert.deepEqual(campaignProblems(gone.campaign), []);
});

test('saves: v29 for companions; a v28 save reads as it is; companions, loyalty and talents are checked', () => {
  assert.equal(SAVE_VERSION, 41);
  const step = MIGRATIONS.find((m) => m.from === 28);
  const v28 = { settings: {}, rng: 1, builds: null, campaign: settled() };
  assert.equal(step.up(v28), v28);
  const home = joinCompanion(settled(), rules, 'varga').campaign;
  const loyal = { ...home, crew: home.crew.map((m) => (m.companion ? { ...m, loyal: true } : m)) };
  assert.deepEqual(campaignProblems(loyal), []);
  const broken = (change) => campaignProblems({ ...home, crew: home.crew.map((m) => (m.companion ? change(m) : m)) });
  assert.ok(broken((m) => ({ ...m, companion: 'Ines Varga' })).some((p) => /crew is unreadable/.test(p)), 'a companion id like an id');
  assert.ok(broken((m) => ({ ...m, loyal: 'yes' })).some((p) => /crew is unreadable/.test(p)), 'loyal is true or absent');
  assert.ok(campaignProblems({ ...home, crew: home.crew.map((m) => (m.id === 1 ? { ...m, loyal: true } : m)) }).some((p) => /crew is unreadable/.test(p)), 'loyal only a companion');
  const { battle } = createBattle({ map: openMap(6, 3), seed: 3, units: [{ ...crewUnit({ ...aboard(loyal, 'varga') }, rules), x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }] }, rules);
  assert.equal(battleProblem(battle), null);
  assert.match(battleProblem({ ...battle, units: battle.units.map((u) => (u.side === 'enemy' ? { ...u, talent: 'varga' } : u)) }), /unreadable unit/);
});
