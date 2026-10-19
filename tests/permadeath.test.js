// Permanent death (M41): picked at New game and kept for the game. Someone
// who bleeds out dies: they leave the crew, hand in their weapon, end a
// companion's loyalty quest and are named among the fallen; a captain's
// death passes command on; with no one left aboard the game is over. Act
// 1's hangar signs on a green hand while the crew is short, and the crew's
// AI gets the downed up first. A fight no one plays kills no one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiAction } from '../src/sim/ai.js';
import { createBattle } from '../src/sim/battle.js';
import { beginFight, campaignProblems, endFight, gameOver, MAX_FALLEN, newCampaign } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { nextCrewId } from '../src/sim/away.js';
import { fightAway } from '../src/sim/raids.js';
import { hangarRecruit, hireRecruit, recruitOffer } from '../src/sim/recruits.js';
import { rescueAction } from '../src/sim/rescueAi.js';
import { campaignScreen, initialState, reduce } from '../src/sim/root.js';
import { crewCardText } from '../src/ui/campaign/crewText.js';
import { overText } from '../src/ui/campaign/overText.js';
import { openMap, rules } from './battleKit.js';
import { settled } from './colonyKit.js';

// A fight on the ship with these crew units' statuses, won or lost.
function ended(campaign, statuses, winner = 'crew') {
  const begun = beginFight(campaign, rules).campaign;
  const units = begun.fight.battle.units.map((unit) => (unit.side === 'crew' && statuses[unit.id] ? { ...unit, hp: 0, status: statuses[unit.id] } : unit.side === 'enemy' ? { ...unit, hp: 0, status: 'dead' } : unit));
  return { ...begun, fight: { ...begun.fight, battle: { ...begun.fight.battle, units, winner } } };
}

test("a fight where death is permanent says so, and bleeding out kills; where it isn't, nothing changes", () => {
  const board = (permadeath) => withBoard(newCampaign(rules, 9, { permadeath }), rules);
  assert.equal(takeJob(board(true), rules, 0).campaign.fight.battle.options.permadeath, true);
  assert.equal(takeJob(board(false), rules, 0).campaign.fight.battle.options.permadeath, false);
  assert.equal(beginFight(newCampaign(rules, 9, { permadeath: true }), rules).campaign.fight.battle.options.permadeath, true);
});

test('the dead leave the crew: their weapon to the spares, named among the fallen, counted; a captain passes command to the most fought', () => {
  const start = newCampaign(rules, 77, { permadeath: true });
  const captain = start.captain;
  const veteran = { ...start, crew: start.crew.map((member) => (member.id === 3 ? { ...member, fights: 9 } : member)), flags: {} };
  const after = endFight(ended(veteran, { c1: 'dead' }), rules);
  assert.deepEqual(after.crew.map((member) => member.id), [2, 3]);
  assert.equal(captain, 1);
  assert.equal(after.captain, 3, 'the one with most fights takes command');
  assert.deepEqual(after.fallen.map(({ id, name, act }) => ({ id, name, act })), [{ id: 1, name: start.crew[0].name, act: 1 }]);
  assert.deepEqual(after.flags, { fightsWon: 1, crewLost: 1, captainsLost: 1 });
  assert.deepEqual(after.arms, { [rules.jobs.get(start.crew[0].job).weapon]: 1 });
  assert.deepEqual(campaignProblems(after), []);
  assert.equal(nextCrewId(after), 4, "the fallen's ids never come back");
  // A companion's loyalty quest ends with them.
  const loyal = { ...veteran, crew: veteran.crew.map((member) => (member.id === 2 ? { ...member, companion: 'brandt' } : member)), quests: { ...veteran.quests, [rules.companions.get('brandt').loyalty]: { step: 0, state: 'open' } } };
  const gone = endFight(ended(loyal, { c2: 'dead' }), rules);
  assert.equal(gone.quests[rules.companions.get('brandt').loyalty].state, 'cold');
  assert.equal(gone.captain, captain, 'the captain lives: command stays');
  // The newest MAX_FALLEN are kept.
  const many = Array.from({ length: MAX_FALLEN }, (_, i) => ({ id: 100 + i, name: 'Old Hand', job: 'marine', act: 1, look: start.crew[0].look }));
  assert.equal(endFight(ended({ ...veteran, fallen: many }, { c1: 'dead' }), rules).fallen.length, MAX_FALLEN);
});

test('with no one left aboard the game is over: its end, and nothing more to do', () => {
  const start = newCampaign(rules, 77, { permadeath: true });
  const over = endFight(ended(start, { c1: 'dead', c2: 'dead', c3: 'dead' }, 'enemy'), rules);
  assert.deepEqual(over.crew, []);
  assert.equal(gameOver(over), true);
  assert.deepEqual(campaignProblems(over), [], 'the save reads, its captain the last one');
  assert.equal(campaignScreen(over), 'over');
  const state = reduce({ ...initialState(1), campaign: over, screen: 'title' }, { type: 'campaign/continue' });
  assert.equal(state.screen, 'over');
  assert.equal(gameOver({ ...over, permadeath: false }), false);
  const text = overText(over, rules);
  assert.equal(text.fallen.length, 3);
  assert.ok(text.record.some(([label, value]) => label === 'Lost' && value.startsWith('3 of the crew, 1 captain')));
  // Down but not dead (stabilized, or the fight lost with them bleeding): no game over.
  const held = endFight(ended(start, { c1: 'stable', c2: 'down', c3: 'out' }, 'enemy'), rules);
  assert.equal(held.crew.length, 3);
  assert.equal(gameOver(held), false);
});

test("act 1's hangar signs on a green hand in the job the crew is short of, for nothing, while it is short", () => {
  const start = withBoard(newCampaign(rules, 77, { permadeath: true }), rules);
  assert.equal(hangarRecruit(start, rules), null, 'a full crew: no one');
  const short = { ...start, crew: start.crew.filter((member) => member.job !== 'medic') };
  const recruit = hangarRecruit(short, rules);
  assert.deepEqual([recruit.job, recruit.traits, recruit.fights, recruit.fee, recruit.slot], ['medic', [], 0, 0, 0]);
  assert.ok(!short.crew.some((member) => member.name === recruit.name));
  assert.deepEqual(recruitOffer(short, rules), [recruit]);
  assert.deepEqual(hangarRecruit(short, rules), recruit, 'the same on every look');
  assert.equal(hangarRecruit({ ...short, permadeath: false }, rules), null, 'only where death is permanent');
  assert.equal(hangarRecruit({ ...short, act: 2 }, rules), null, 'only in act 1');
  const signed = hireRecruit({ ...short, credits: 0 }, rules, 0);
  assert.ok(signed.ok, signed.error);
  assert.deepEqual(signed.campaign.crew.at(-1).job, 'medic');
  assert.equal(signed.campaign.credits, 0);
  assert.equal(hangarRecruit(signed.campaign, rules), null, 'the crew whole again');
  const two = { ...start, crew: start.crew.slice(0, 1) };
  const first = hireRecruit(two, rules, 0).campaign;
  assert.notDeepEqual(hangarRecruit(first, rules), hangarRecruit(two, rules), 'the next one is someone else');
  // The crew card offers them at the hangar.
  const card = crewCardText(short, rules);
  assert.equal(card.hire.title, 'Looking for a berth');
  assert.deepEqual([card.hire.recruits[0].label, card.hire.recruits[0].ok], ['Sign on', true]);
  assert.match(card.hint.text, /^Someone is looking for a berth/);
});

test("where death is permanent the crew's AI gets a downed ally up: beside them, or a walk there with an action to spare", () => {
  const map = openMap(8, 3);
  const units = [
    { kind: 'marine', x: 0, y: 1 },
    { kind: 'engineer', x: 4, y: 1 },
    { kind: 'pirate', x: 7, y: 1 },
  ];
  const make = (permadeath, downAt) => {
    const { battle } = createBattle({ map, units: units.map((u, i) => (i === 1 ? { ...u, x: downAt } : u)), seed: 1, options: { permadeath } }, rules);
    const down = battle.units[1];
    down.hp = 0;
    down.status = 'down';
    down.bleed = 2;
    return battle;
  };
  const beside = make(true, 1);
  assert.deepEqual(rescueAction(beside, beside.units[0], rules), { type: 'stabilize', unit: 'c1', target: 'c2' });
  assert.deepEqual(aiAction(beside, rules), { type: 'stabilize', unit: 'c1', target: 'c2' });
  const far = make(true, 3);
  const walk = rescueAction(far, far.units[0], rules);
  assert.equal(walk.type, 'move');
  assert.ok(Math.max(Math.abs(walk.to[0] - 3), Math.abs(walk.to[1] - 1)) <= 1, 'to a tile beside them');
  assert.equal(rescueAction(make(false, 1), make(false, 1).units[0], rules), null, 'not where death is not permanent');
});

test('a raid fought out where the ship is not kills no one, even where death is permanent', () => {
  for (let n = 0; n < 20; n++) {
    const base = settled();
    const down = { ...base, permadeath: true, rng: 500 + n, colony: { ...base.colony, day: 2, raid: { found: 1, lands: 2 } } };
    const fought = fightAway(down, rules);
    assert.equal(fought.campaign.crew.length, down.crew.length);
    assert.ok(fought.campaign.crew.every((member) => member.hp >= 1));
  }
});
