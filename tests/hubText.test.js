import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFight, newCampaign } from '../src/sim/campaign.js';
import { continueText, fightsText, hubText, partsText } from '../src/ui/campaign/hubText.js';
import { rules } from './battleKit.js';

test('the hub shows the act, its home, the crew, the ship and what the campaign holds', () => {
  const campaign = newCampaign(rules, 77);
  const wounded = { ...campaign, credits: 1250, crew: [{ ...campaign.crew[0], hp: 4 }, { ...campaign.crew[1], name: 'Ada' }, campaign.crew[2]] };
  const text = hubText(wounded, rules);
  assert.equal(text.act, 'Act 1 · Homeworld');
  assert.equal(text.home, 'The hangar');
  assert.deepEqual(text.crew, [
    { name: 'Marine', job: '', hp: 4, max: 10 },
    { name: 'Ada', job: 'Engineer', hp: 8, max: 8 },
    { name: 'Medic', job: '', hp: 8, max: 8 },
  ]);
  assert.deepEqual(text.ship, { size: '9 parts', ready: false, lines: ['No thrust: Add Engine (+12 thrust)', 'Missing engine: Add Engine'] });
  assert.deepEqual(text.holdings, [['Credits', '1,250'], ['Heat', '0 of 100'], ['Parts', 'None'], ['Fights', 'None yet']]);
});

test('parts held and fights fought, in words', () => {
  assert.equal(partsText({}, rules), 'None');
  assert.equal(partsText({ engine: 2, corridor: 1 }, rules), 'Engine ×2, Corridor');
  assert.equal(fightsText({}), 'None yet');
  assert.equal(fightsText({ fightsLost: 1 }), '0 won, 1 lost');
  assert.equal(fightsText({ fightsWon: 3, fightsLost: 1 }), '3 won, 1 lost');
});

test("Continue says where the campaign is, with or without the content loaded", () => {
  const campaign = newCampaign(rules, 77);
  assert.equal(continueText(campaign, rules), 'Act 1 · The hangar');
  assert.equal(continueText(campaign, null), 'Act 1');
  const fighting = beginFight(campaign, rules).campaign;
  assert.equal(continueText(fighting, null), 'Act 1 · In a fight, round 1');
  const over = { ...fighting, fight: { ...fighting.fight, battle: { ...fighting.fight.battle, winner: 'crew' } } };
  assert.equal(continueText(over, rules), 'Act 1 · A fight just ended');
});
