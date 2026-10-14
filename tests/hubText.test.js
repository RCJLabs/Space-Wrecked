import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand } from '../src/sim/builder.js';
import { beginFight, newCampaign, refitShip } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { initialState, reduce } from '../src/sim/root.js';
import { continueText, hangarText, jobsText, partsText } from '../src/ui/campaign/hubText.js';
import { rules } from './battleKit.js';

test('the hangar shows the act, its goal with what is on hand, the crew and the holdings', () => {
  const campaign = newCampaign(rules, 77);
  // Named by their job (as before M23c), by a name, and by a name and job alike.
  const wounded = { ...campaign, credits: 1250, crew: [{ ...campaign.crew[0], hp: 4, name: 'Marine' }, { ...campaign.crew[1], name: 'Ada' }, campaign.crew[2]] };
  const text = hangarText(wounded, rules);
  assert.equal(text.act, 'Act 1 · Homeworld');
  assert.equal(text.home, 'The hangar');
  assert.deepEqual(text.goal, {
    ready: false,
    lines: [
      { ok: true, text: 'Power +6 (8 made, 2 used)', fix: null },
      { ok: false, text: 'No thrust', fix: 'Add 2 × Engine (+12 thrust each): none on hand' },
      { ok: false, text: 'Berths 0 of 3 crew', fix: 'Add Crew quarters (+4 berths): 1 on hand' },
      { ok: false, text: 'Life support 0 of 3 crew', fix: 'Add Life support (+4 crew): 1 on hand' },
      { ok: false, text: 'Missing engine', fix: 'Add Engine: none on hand' },
      { ok: true, text: 'Every part joined to the bridge, airlock on the hull edge', fix: null },
    ],
  });
  assert.deepEqual(text.crew, [
    { name: 'Marine', job: '', hp: 4, max: 10 },
    { name: 'Ada', job: 'Engineer', hp: 8, max: 8 },
    { name: campaign.crew[2].name, job: 'Medic', hp: 8, max: 8 },
  ]);
  // Heat has its own meter (text.heat), by the act.
  assert.deepEqual(text.holdings, [['Credits', '1,250'], ['Parts on hand', 'Crew quarters, Life support, Corridor ×2'], ['Jobs', 'None yet']]);
  assert.equal(text.build, true);
  assert.deepEqual(text.hint, { tone: 'good', text: 'Your ship is half built. Tap Build to fit the parts on hand.' });
});

test('the hint follows what is left to do', () => {
  const campaign = newCampaign(rules, 77);
  // The quarters and life support fitted: only corridors on hand, and the
  // engine has to come from somewhere else.
  let ship = applyCommand(campaign.ship, rules, { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }).ship;
  ship = applyCommand(ship, rules, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }).ship;
  const fitted = refitShip(campaign, ship, rules);
  assert.deepEqual(fitted.parts, { corridor: 2 });
  const text = hangarText(fitted, rules);
  assert.equal(text.build, false);
  assert.deepEqual(text.hint, { tone: 'info', text: 'The parts still missing come from jobs and the shop, where spares sell too.' });
  assert.deepEqual(hangarText({ ...fitted, parts: {} }, rules).hint, { tone: 'info', text: 'The parts still missing come from jobs and the shop: tap Jobs.' });
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

test('the hangar shows heat by its level, the payment, and a raid at the door', () => {
  const campaign = { ...newCampaign(rules, 77), credits: 120 };
  const calm = hangarText(campaign, rules);
  assert.deepEqual([calm.heat.value, calm.heat.level, calm.heat.name, calm.heat.marks], [0, 'calm', 'Calm', [25, 50, 75]]);
  assert.equal(calm.heat.line, "Con-Reg has other debtors to worry about. For now.");
  assert.deepEqual([calm.heat.payment.label, calm.heat.payment.ask, calm.heat.payment.ok, calm.heat.payment.why], ['Pay 50', 'Pay 50?', false, 'There is no heat to pay off.']);
  assert.equal(calm.raid, null);
  const hunted = hangarText({ ...campaign, heat: 55, parts: {} }, rules);
  assert.deepEqual([hunted.heat.level, hunted.heat.payment.ok], ['hunters', true]);
  assert.deepEqual(hunted.hint, { tone: 'warn', text: 'A Recovery agent tails the crew to every job. A payment buys some heat off.' });
  const raided = hangarText({ ...campaign, heat: 80 }, rules);
  assert.deepEqual(raided.raid, { line: 'Con-Reg Recovery is at the hangar door with a court order and a lot of friends.', ok: true, why: null });
  assert.deepEqual(raided.hint, { tone: 'bad', text: 'Con-Reg Recovery is at the hangar door with a court order and a lot of friends. Defend the ship, or pay heat down under 75.' });
  const airlock = campaign.ship.modules.find((m) => m.type === 'airlock');
  const sealed = hangarText({ ...campaign, heat: 80, ship: { ...campaign.ship, modules: campaign.ship.modules.filter((m) => m !== airlock) } }, rules);
  assert.equal(sealed.raid.ok, false);
  assert.match(sealed.hint.text, /won't cut through the hull\. Put an airlock on it, then face them\.$/);
});

test('Continue names a raid', () => {
  const raiding = { ...newCampaign(rules, 77), heat: 80 };
  const begun = reduce({ ...initialState(1), campaign: raiding }, { type: 'campaign/raid/begin', rules }).campaign;
  assert.equal(continueText(begun, rules), 'Act 1 · The raid, round 1');
  const over = { ...begun, fight: { ...begun.fight, battle: { ...begun.fight.battle, winner: 'enemy' } } };
  assert.equal(continueText(over, null), 'Act 1 · The raid just ended');
});
