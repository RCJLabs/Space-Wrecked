// M37: the test players' weapons (tools/arms.js): every weapon in the
// weapons' table for each kind of fight; each crew member carrying the best
// on hand of their job's kinds, those whose jobs carry the fewest picking
// first; the xenobiologist keeping the dart gun Sedate needs; and a weapon
// worth buying or taking only where someone who could carry it has nothing
// within GAIN points of it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { weaponOf } from '../src/sim/loadout.js';
import { armFor, GAIN, SETTINGS, upgradeOf, WINS } from '../tools/arms.js';
import { rules } from './battleKit.js';

// The miner's start crew (a marine with a rifle, an engineer with a
// shotgun, a medic with a pistol) and these spares on hand.
const start = (arms = {}) => ({ ...newCampaign(rules, 7), arms });
const carried = (campaign) => Object.fromEntries(campaign.crew.map((member) => [member.job, weaponOf(member, rules)]));

test("each kind of fight has every weapon's wins from the table", () => {
  assert.deepEqual(SETTINGS, ['ship', 'ground']);
  for (const setting of SETTINGS) {
    assert.deepEqual(Object.keys(WINS[setting]).sort(), [...rules.weapons.keys()].sort(), setting);
    assert.ok(Object.values(WINS[setting]).every((wins) => wins >= 0 && wins <= 100), setting);
  }
  assert.throws(() => armFor(start(), rules, 'space'), /No setting "space"/);
});

test('the crew carry the best on hand of their kinds, the fewest kinds picking first, and what they put down goes on hand', () => {
  assert.deepEqual(carried(start()), { marine: 'rifle', engineer: 'shotgun', medic: 'pistol' });
  const armed = armFor(start({ sawnoff: 1, riotgun: 1, machinepistol: 1 }), rules, 'ship');
  // The medic, sidearms only, picks first; the engineer takes the riot gun
  // and puts the shotgun down, which the marine, last, takes up.
  assert.deepEqual(carried(armed), { marine: 'shotgun', engineer: 'riotgun', medic: 'machinepistol' });
  assert.deepEqual(armed.arms, { sawnoff: 1, pistol: 1, rifle: 1 });
  // Nothing better on hand: no one swaps.
  const bare = start({ dartgun: 2 });
  assert.equal(armFor(bare, rules, 'ship'), bare);
});

test('the kind of fight ahead decides the best: the autogun aboard a ship, the rail rifle on the ground', () => {
  const campaign = start({ autogun: 1, railrifle: 1 });
  assert.equal(carried(armFor(campaign, rules, 'ship')).marine, 'autogun');
  assert.equal(carried(armFor(campaign, rules, 'ground')).marine, 'railrifle');
});

test('the xenobiologist keeps the dart gun Sedate needs', () => {
  const campaign = start({ machinepistol: 1 });
  const medic = campaign.crew.find((member) => member.job === 'medic');
  const xeno = { ...campaign, crew: campaign.crew.map((member) => (member === medic ? { ...member, job: 'xenobiologist' } : member)) };
  assert.equal(carried(armFor(xeno, rules, 'ship')).xenobiologist, 'dartgun');
  // Beside the engineer alone, whose shotgun is better aboard, a machine
  // pistol is worth having for a medic, not for a xenobiologist.
  const withEngineer = (crewed) => ({ ...crewed, arms: {}, crew: crewed.crew.filter((member) => member.job !== 'marine') });
  assert.equal(upgradeOf(withEngineer(campaign), rules, 'machinepistol', 'ship'), true, 'the medic would take it');
  assert.equal(upgradeOf(withEngineer(xeno), rules, 'machinepistol', 'ship'), false, 'the xenobiologist would not');
});

test('a weapon is worth having only GAIN points better than what someone who could carry it has, spares counted', () => {
  const campaign = start();
  const gain = (setting, id, over) => WINS[setting][id] - WINS[setting][over];
  assert.equal(upgradeOf(campaign, rules, 'autogun', 'ship'), true, 'for the marine');
  assert.ok(gain('ship', 'autogun', 'rifle') >= GAIN);
  // Better, but by less than GAIN: the marksman's rifle aboard, the rail
  // rifle on the ground, over the marine's rifle; the riot gun over the
  // engineer's shotgun, with the marine's rifle swapped for one on hand.
  for (const [setting, id] of [['ship', 'marksman'], ['ground', 'railrifle']]) {
    assert.ok(gain(setting, id, 'rifle') > 0 && gain(setting, id, 'rifle') < GAIN, `${id} ${setting}`);
    assert.equal(upgradeOf(campaign, rules, id, setting), false, `${id} ${setting}`);
  }
  assert.equal(upgradeOf(start({ shotgun: 1 }), rules, 'riotgun', 'ship'), false);
  assert.equal(upgradeOf(campaign, rules, 'riotgun', 'ship'), true, 'for the marine');
  assert.equal(upgradeOf(campaign, rules, 'pistol', 'ship'), false, 'the medic has one');
  assert.equal(upgradeOf(campaign, rules, 'dartgun', 'ground'), false);
  assert.equal(upgradeOf(campaign, rules, 'nothing', 'ship'), false);
  assert.equal(upgradeOf(start({ autogun: 1 }), rules, 'autogun', 'ship'), false, 'one on hand already');
});
