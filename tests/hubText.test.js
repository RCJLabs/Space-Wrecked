import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand } from '../src/sim/builder.js';
import { beginFight, newCampaign, refitShip } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { continueText, hangarText, jobsText, partsText } from '../src/ui/campaign/hubText.js';
import { rules } from './battleKit.js';

test('the hangar shows the act, its goal with what is on hand, the crew and the holdings', () => {
  const campaign = newCampaign(rules, 77);
  const wounded = { ...campaign, credits: 1250, crew: [{ ...campaign.crew[0], hp: 4 }, { ...campaign.crew[1], name: 'Ada' }, campaign.crew[2]] };
  const text = hangarText(wounded, rules);
  assert.equal(text.act, 'Act 1 · Homeworld');
  assert.equal(text.home, 'The hangar');
  assert.deepEqual(text.goal, {
    ready: false,
    lines: [
      { ok: true, text: 'Power +6 (8 made, 2 used)', fix: null },
      { ok: false, text: 'No thrust', fix: 'Add Engine (+12 thrust): none on hand' },
      { ok: false, text: 'Berths 0 of 3 crew', fix: 'Add Crew quarters (+4 berths): 1 on hand' },
      { ok: false, text: 'Life support 0 of 3 crew', fix: 'Add Life support (+4 crew): 1 on hand' },
      { ok: false, text: 'Missing engine', fix: 'Add Engine: none on hand' },
      { ok: true, text: 'Every part joined to the bridge, airlock on the hull edge', fix: null },
    ],
  });
  assert.deepEqual(text.crew, [
    { name: 'Marine', job: '', hp: 4, max: 10 },
    { name: 'Ada', job: 'Engineer', hp: 8, max: 8 },
    { name: 'Medic', job: '', hp: 8, max: 8 },
  ]);
  assert.deepEqual(text.holdings, [['Credits', '1,250'], ['Heat', '0 of 100'], ['Parts on hand', 'Crew quarters, Life support, Corridor ×2'], ['Jobs', 'None yet']]);
  assert.equal(text.build, true);
  assert.deepEqual(text.hint, { tone: 'good', text: 'Your ship is half built. Tap Build to fit the parts on hand.' });
});

test('the hint follows what is left to do', () => {
  const campaign = newCampaign(rules, 77);
  // The quarters and life support fitted: only corridors on hand, and the
  // engine has to come from somewhere else.
  let ship = applyCommand(campaign.ship, rules, { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }).ship;
  ship = applyCommand(ship, rules, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }).ship;
  const fitted = refitShip(campaign, ship);
  assert.deepEqual(fitted.parts, { corridor: 2 });
  const text = hangarText(fitted, rules);
  assert.equal(text.build, false);
  assert.deepEqual(text.hint, { tone: 'info', text: 'Tap Build to change the ship. The parts still missing come from jobs: tap Jobs.' });
  assert.deepEqual(hangarText({ ...fitted, parts: {} }, rules).hint, { tone: 'info', text: 'The parts still missing come from jobs: tap Jobs.' });
});

test('parts on hand and jobs done, in words', () => {
  assert.equal(partsText({}, rules), 'None');
  assert.equal(partsText({ engine: 2, corridor: 1 }, rules), 'Engine ×2, Corridor');
  assert.equal(jobsText({}), 'None yet');
  assert.equal(jobsText({ jobsFailed: 1, fightsLost: 1 }), '0 done, 1 lost');
  assert.equal(jobsText({ jobsDone: 3, jobsFailed: 1 }), '3 done, 1 lost');
});

test("Continue says where the campaign is, with or without the content loaded", () => {
  const campaign = newCampaign(rules, 77);
  assert.equal(continueText(campaign, rules), 'Act 1 · The hangar');
  assert.equal(continueText(campaign, null), 'Act 1');
  const fighting = beginFight(campaign, rules).campaign;
  assert.equal(continueText(fighting, null), 'Act 1 · In a fight, round 1');
  const over = { ...fighting, fight: { ...fighting.fight, battle: { ...fighting.fight.battle, winner: 'crew' } } };
  assert.equal(continueText(over, rules), 'Act 1 · A fight just ended');
  const boarded = withBoard(campaign, rules);
  const onJob = takeJob(boarded, rules, 0).campaign;
  const title = rules.contracts.jobs.get(boarded.board[0].contract).title;
  assert.equal(continueText(onJob, rules), `Act 1 · ${title}, round 1`);
  assert.equal(continueText(onJob, null), 'Act 1 · On a job, round 1');
  const jobOver = { ...onJob, fight: { ...onJob.fight, battle: { ...onJob.fight.battle, winner: 'enemy' } } };
  assert.equal(continueText(jobOver, rules), 'Act 1 · A job just ended');
});
