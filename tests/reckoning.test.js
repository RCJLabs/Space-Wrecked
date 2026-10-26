// The reckoning (M56): the pursuer's leader comes for the founding colony
// once, by its day reckoningDay or reckoningAfter days after the
// background's thread pays off; found as a raid is, its party the
// leader's; won, the pursuit is over and no raid comes again; lost, the
// leader comes again reckoningAgain days on.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { nextDay } from '../src/sim/days.js';
import { foundOdds, landingPlan, raidersOf, settleRaid } from '../src/sim/raids.js';
import { afterPayoff, HOME, pursuitOver, reckoningDay, reckoningDue, reckoningOf } from '../src/sim/reckoning.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const { reckoningAfter, reckoningAgain, reckoningDay: dayOf, reckoningWarning } = rules.balance;

// The colony on day `day`, with heat as given and food enough.
function onDay(campaign, day, heat = campaign.heat) {
  return { ...campaign, heat, supplies: 200, colony: { ...campaign.colony, day, heat } };
}

test("each pursuer has a leader: their own party, an enemy above the pursuer's others, and their words", () => {
  for (const background of rules.backgrounds.values()) {
    const reckoning = background.pursuer.colony.reckoning;
    const party = rules.encounters.get(reckoning.party).enemies;
    assert.ok(party.includes(reckoning.leader), background.id);
    const leader = rules.enemies.get(reckoning.leader);
    const others = rules.encounters.get(background.pursuer.colony.raiders).enemies.map((id) => rules.enemies.get(id));
    assert.ok(others.every((other) => leader.hp > other.hp && leader.armor >= other.armor), `${background.id}: ${leader.name} tougher than the raiders`);
    for (const key of ['name', 'found', 'landing', 'won', 'lost']) assert.ok(reckoning[key].length > 0);
  }
});

test('due on the founding colony\'s day reckoningDay; found at that day\'s end, before any raid is rolled for, warned reckoningWarning days', () => {
  const colony = settled();
  assert.equal(colony.colony.id, HOME);
  assert.equal(reckoningDay(colony, rules), dayOf);
  assert.equal(reckoningDue(onDay(colony, dayOf - 1), rules), false);
  assert.equal(reckoningDue(onDay(colony, dayOf), rules), true);
  // The day before: the day's end makes it due, and it is found, even with
  // heat too low for any raid.
  const day = nextDay(onDay(colony, dayOf - 1, 0), rules);
  assert.equal(day.ok, true, day.error);
  const { raid } = day.campaign.colony;
  assert.deepEqual(raid, { found: dayOf - 1, lands: dayOf + reckoningWarning, extra: 0, reckoning: true });
  // Its party is the leader's.
  const leader = reckoningOf(day.campaign, rules);
  assert.deepEqual(raidersOf(day.campaign, rules), rules.encounters.get(leader.party).enemies);
  const down = { ...day.campaign, colony: { ...day.campaign.colony, day: raid.lands } };
  assert.deepEqual(landingPlan(down, rules).raiders, rules.encounters.get(leader.party).enemies);
});

test('the thread\'s pay-off brings it forward reckoningAfter days, never later than it was', () => {
  const colony = onDay(settled(), 12);
  assert.deepEqual(afterPayoff(colony, rules).reckoning, { due: 12 + reckoningAfter });
  const late = onDay(settled(), dayOf - 2);
  assert.deepEqual(afterPayoff(late, rules).reckoning, { due: dayOf });
  // Before act 3, as it was.
  const before = { ...settled(), colony: null, colonies: [] };
  assert.equal(afterPayoff(before, rules), before);
});

test('won, the pursuit is over: the ending kept, no raid found again, nothing due', () => {
  const colony = onDay(settled(), dayOf + reckoningWarning, 95);
  const down = { ...colony, colony: { ...colony.colony, raid: { found: dayOf - 1, lands: dayOf + reckoningWarning, extra: 0, reckoning: true } } };
  const won = settleRaid(down, rules, true).campaign;
  assert.deepEqual(won.ending, { day: dayOf + reckoningWarning, colony: colony.colony.world.name, won: true, seen: false });
  assert.equal(won.colony.raid, null);
  assert.equal(pursuitOver(won), true);
  assert.equal(foundOdds({ ...won, heat: 99, colony: { ...won.colony, heat: 99 } }, rules), 0);
  assert.equal(reckoningDue(onDay(won, dayOf + 40), rules), false);
  assert.deepEqual(campaignProblems(won), []);
  // Lost: a raid lost, the leader due again reckoningAgain days on.
  const lost = settleRaid(down, rules, false).campaign;
  assert.equal(lost.ending, null);
  assert.deepEqual(lost.reckoning, { due: dayOf + reckoningWarning + reckoningAgain });
  assert.ok(lost.flags.colonyRaidsLost >= 1);
  // A plain raid settles as before, the reckoning untouched.
  const plain = { ...colony, colony: { ...colony.colony, raid: { found: 3, lands: 6, extra: 0 } } };
  const after = settleRaid(plain, rules, true).campaign;
  assert.deepEqual([after.ending, after.reckoning], [null, null]);
});

test('the reckoning and the ending are saved and read back; a save from before has neither', () => {
  const colony = onDay(settled(), 20);
  const ended = { ...colony, reckoning: { due: 30 }, ending: { day: 35, colony: 'Copperhill', won: true, seen: false } };
  const state = { ...initialState(1), campaign: ended };
  const parsed = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.equal(parsed.ok, true, parsed.error);
  assert.deepEqual([parsed.save.data.campaign.reckoning, parsed.save.data.campaign.ending], [ended.reckoning, ended.ending]);
  assert.equal(SAVE_VERSION, 48);
  const old = { campaign: { ...colony } };
  delete old.campaign.reckoning;
  delete old.campaign.ending;
  const up = MIGRATIONS.find((step) => step.from === 47).up(old);
  assert.deepEqual([up.campaign.reckoning, up.campaign.ending], [null, null]);
  // Unreadable shapes are caught.
  assert.ok(campaignProblems({ ...colony, reckoning: { due: -1 } }).some((p) => p.includes('reckoning')));
  assert.ok(campaignProblems({ ...colony, ending: { day: 3, colony: null, won: false } }).some((p) => p.includes('ending')));
});

test('a pursuer\'s reckoning is checked: its party known, the leader in it, its words', async () => {
  const { checkReckoning } = await import('../tools/validate-campaign.js');
  const problems = (reckoning) => {
    const found = [];
    const encounters = new Map([...rules.encounters].map(([id, e]) => [id, e.enemies]));
    checkReckoning(reckoning, 'here', encounters, (where, what) => found.push(`${where}: ${what}`));
    return found;
  };
  const good = rules.backgrounds.get('miner').pursuer.colony.reckoning;
  assert.deepEqual(problems(good), []);
  assert.ok(problems({ ...good, party: 'nobody' }).some((p) => p.includes('unknown party')));
  assert.ok(problems({ ...good, leader: 'pirate' }).some((p) => p.includes('must be in the party')));
  assert.ok(problems({ ...good, won: '' }).some((p) => p.includes('won must be')));
});

test('won, the epilogue shows until Carry on, then the colony; Continue goes where Carry on left it', () => {
  const colony = onDay(settled(), 40);
  const ended = { ...colony, ending: { day: 40, colony: colony.colony.world.name, won: true, seen: false } };
  assert.equal(campaignScreen(ended), 'epilogue');
  assert.equal(campaignScreen({ ...ended, place: 'fight', fight: { raid: true } }), 'campaign-fight', 'not while a fight is on');
  const state = { ...initialState(1), campaign: ended, screen: 'fight' };
  const closed = reduce(state, { type: 'campaign/epilogue/close' });
  assert.equal(closed.campaign.ending.seen, true);
  assert.equal(closed.screen, 'colony');
  assert.equal(reduce({ ...closed, screen: 'title' }, { type: 'campaign/continue' }).screen, 'colony');
  // Nothing to close once it is read.
  assert.equal(reduce(closed, { type: 'campaign/epilogue/close' }), closed);
});
