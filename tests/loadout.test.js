// M37: the weapons the crew carry (src/sim/loadout.js), and where weapons
// come from: a won fight's gear (gear.js), act 1's shop (economy.js),
// stations' racks (racks.js) and events (events.js arms); and the save's
// migration to v32.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems, crewUnit, endFight, newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { buyPart, rollStock, sellWeapon, weaponPrice, weaponSellPrice } from '../src/sim/economy.js';
import { applyEffects } from '../src/sim/events.js';
import { gearWon } from '../src/sim/gear.js';
import { launch } from '../src/sim/launch.js';
import { carriedWords, handedIn, sparesFor, swapProblem, swapWeapon, weaponOf } from '../src/sim/loadout.js';
import { buyFromRack, rackAt, rackHere } from '../src/sim/racks.js';
import { dismissCrew } from '../src/sim/recruits.js';
import { initialState, reduce } from '../src/sim/root.js';
import { beginRun } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const fresh = () => withBoard(newCampaign(rules, 7), rules);
const withSpares = (campaign, arms) => ({ ...campaign, arms: { ...campaign.arms, ...arms } });
const memberOf = (campaign, job) => campaign.crew.find((member) => member.job === job);

test("everyone starts with their job's weapon and none spare, and goes into a fight with it", () => {
  const campaign = fresh();
  assert.deepEqual(campaign.arms, {});
  for (const member of campaign.crew) {
    assert.equal(member.weapon, undefined);
    assert.equal(weaponOf(member, rules), rules.jobs.get(member.job).weapon);
    assert.equal(crewUnit(member, rules).weapon, rules.jobs.get(member.job).weapon);
  }
  assert.deepEqual(campaignProblems(campaign, rules), []);
});

test('a spare of a kind their job carries swaps in, two ways round; the wrong kind, none on hand, the same one or a fight say why', () => {
  const campaign = withSpares(fresh(), { riotgun: 1, railrifle: 1 });
  const marine = memberOf(campaign, 'marine');
  const medic = memberOf(campaign, 'medic');
  assert.deepEqual(sparesFor(campaign, rules, medic), [], 'a medic carries sidearms only');
  assert.deepEqual(sparesFor(campaign, rules, marine).map((s) => s.id), ['railrifle', 'riotgun']);
  const swapped = swapWeapon(campaign, rules, marine.id, 'riotgun');
  assert.ok(swapped.ok);
  assert.equal(weaponOf(swapped.campaign.crew.find((m) => m.id === marine.id), rules), 'riotgun');
  assert.deepEqual(swapped.campaign.arms, { railrifle: 1, rifle: 1 }, 'the rifle goes on hand');
  assert.equal(crewUnit(swapped.campaign.crew.find((m) => m.id === marine.id), rules).weapon, 'riotgun');
  assert.deepEqual(campaignProblems(swapped.campaign, rules), []);
  // And back.
  const back = swapWeapon(swapped.campaign, rules, marine.id, 'rifle');
  assert.deepEqual(back.campaign.arms, { railrifle: 1, riotgun: 1 });
  assert.match(swapProblem(campaign, rules, medic.id, 'riotgun'), /carries sidearms: the riot gun is a heavy weapon/);
  assert.equal(swapProblem(campaign, rules, marine.id, 'autogun'), "There's no autogun on hand.");
  assert.match(swapProblem(campaign, rules, marine.id, 'rifle'), /carries the rifle already/);
  assert.equal(swapProblem({ ...campaign, fight: {} }, rules, marine.id, 'riotgun'), 'Not in the middle of a fight.');
  assert.equal(carriedWords(rules.jobs.get('engineer')), 'sidearms and heavy weapons');
});

test("a won fight can leave one of the fallen enemies' weapons, by a roll of its own seed; a lost one leaves nothing", () => {
  const units = [{ side: 'enemy', status: 'dead', weapon: 'autogun' }, { side: 'enemy', status: 'dead', weapon: 'pistol' }, { side: 'crew', status: 'active', weapon: 'rifle' }];
  const won = { winner: 'crew', units };
  const sure = { ...rules, balance: { ...rules.balance, gearChance: 100 } };
  const never = { ...rules, balance: { ...rules.balance, gearChance: 0 } };
  const left = gearWon({ seed: 3 }, won, sure);
  assert.ok(['autogun', 'pistol'].includes(left));
  assert.equal(gearWon({ seed: 3 }, won, sure), left, 'the same fight, the same roll');
  assert.equal(gearWon({ seed: 3 }, won, never), null);
  assert.equal(gearWon({ seed: 3 }, { ...won, winner: 'enemy' }, sure), null);
  assert.equal(gearWon({ seed: 3 }, { winner: 'crew', units: units.map((u) => ({ ...u, status: 'active' })) }, sure), null, 'no one fell');
  // Over many fights, about gearChance of them.
  const seeds = Array.from({ length: 400 }, (_, i) => i);
  const share = seeds.filter((seed) => gearWon({ seed }, won, rules)).length / seeds.length;
  assert.ok(Math.abs(share - rules.balance.gearChance / 100) < 0.08, `${share}`);
  // endFight puts it on hand and counts it.
  const campaign = fresh();
  const fight = { seed: seeds.find((seed) => gearWon({ seed }, won, rules)), crew: [], battle: won };
  const after = endFight({ ...campaign, place: 'fight', fight }, rules);
  assert.equal(after.flags.gearWon, 1);
  assert.equal(Object.values(after.arms).reduce((a, b) => a + b, 0), 1);
});

test("act 1's shop stocks weapons beside its parts without moving the campaign's rolls, sells them, and buys spares back at half", () => {
  const campaign = fresh();
  const district = rules.backgrounds.get(campaign.background).district;
  const shop = rules.districts.get(district).shop;
  const weapons = campaign.shop.filter((item) => item.weapon);
  assert.equal(weapons.length, shop.armsSize);
  assert.equal(campaign.shop.filter((item) => item.part).length, shop.size);
  // The parts and the campaign's RNG are as they were before weapons came.
  const parts = rollStock(rules, newCampaign(rules, 7).rng, district);
  assert.ok(weapons.every((item) => item.price === weaponPrice(item.weapon, rules)));
  assert.equal(parts.stock.length, shop.size);
  const index = campaign.shop.indexOf(weapons[0]);
  const bought = buyPart({ ...campaign, credits: 999 }, rules, index);
  assert.ok(bought.ok, bought.error);
  assert.equal(bought.campaign.arms[weapons[0].weapon], 1);
  assert.equal(bought.campaign.credits, 999 - weapons[0].price);
  assert.equal(bought.campaign.shop.length, campaign.shop.length - 1);
  const sold = sellWeapon(bought.campaign, rules, weapons[0].weapon);
  assert.ok(sold.ok, sold.error);
  assert.equal(sold.campaign.credits, bought.campaign.credits + weaponSellPrice(weapons[0].weapon, rules));
  assert.deepEqual(sold.campaign.arms, {});
  assert.equal(sellWeapon(campaign, rules, 'rifle').ok, false, "the rifle carried isn't spare");
});

test("a station's rack sells the same weapons on every visit at its side's prices; one bought is gone, and docks the ship", () => {
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((node) => node.type === 'station');
  assert.ok(station, 'a station in the first sector');
  const there = { ...run, credits: 999, run: { ...run.run, at: station.id, seen: [...new Set([...run.run.seen, station.id])] } };
  const rack = rackAt(there, rules, station.id);
  assert.equal(rack.length, rules.balance.rackSize);
  assert.deepEqual(rackAt(there, rules, station.id), rack, 'the same on every visit');
  const bought = buyFromRack(there, rules, rack[0].slot);
  assert.ok(bought.ok, bought.error);
  assert.equal(bought.campaign.arms[rack[0].weapon], 1);
  assert.equal(bought.campaign.credits, 999 - rack[0].price);
  assert.equal(bought.campaign.run.docked, true);
  assert.deepEqual(rackHere(bought.campaign, rules).map((item) => item.slot), rack.slice(1).map((item) => item.slot));
  assert.equal(buyFromRack(bought.campaign, rules, rack[0].slot).ok, false);
  assert.deepEqual(campaignProblems(bought.campaign, rules), []);
  assert.deepEqual(rackHere(run, rules), [], 'away from a station, no rack');
});

test('an event can put a weapon on hand; a crew member let go hands theirs in', () => {
  const campaign = fresh();
  const found = applyEffects(campaign, rules, { arms: 'sawnoff' });
  assert.deepEqual(found.campaign.arms, { sawnoff: 1 });
  assert.deepEqual(found.changes.arms, ['sawnoff']);
  const medic = memberOf(campaign, 'medic');
  assert.deepEqual(handedIn(campaign, medic, rules), { pistol: 1 });
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((node) => node.type === 'station');
  const there = { ...run, run: { ...run.run, at: station.id, seen: [...new Set([...run.run.seen, station.id])] } };
  const leaving = there.crew.find((member) => member.id !== there.captain);
  const gone = dismissCrew(there, rules, leaving.id);
  assert.ok(gone.ok, gone.error);
  assert.equal(gone.campaign.arms[weaponOf(leaving, rules)], 1);
});

test('through the game: a swap, a spare sold at the hangar and a weapon bought from a rack; one that fails changes nothing', () => {
  const state = { ...initialState(1), screen: 'hub', campaign: withSpares(fresh(), { riotgun: 1 }) };
  const marine = memberOf(state.campaign, 'marine');
  const swapped = reduce(state, { type: 'campaign/arms/swap', id: marine.id, weapon: 'riotgun', rules });
  assert.equal(weaponOf(swapped.campaign.crew.find((m) => m.id === marine.id), rules), 'riotgun');
  assert.equal(reduce(swapped, { type: 'campaign/arms/swap', id: marine.id, weapon: 'riotgun', rules }), swapped, 'none left on hand');
  const sold = reduce(swapped, { type: 'campaign/arms/sell', weapon: 'rifle', rules });
  assert.deepEqual(sold.campaign.arms, {});
  assert.equal(sold.campaign.credits, swapped.campaign.credits + weaponSellPrice('rifle', rules));
  assert.equal(reduce(sold, { type: 'campaign/arms/sell', weapon: 'rifle', rules }), sold);
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((node) => node.type === 'station');
  const there = { ...initialState(1), screen: 'sector', campaign: { ...run, credits: 999, run: { ...run.run, at: station.id, seen: [...new Set([...run.run.seen, station.id])] } } };
  const [first] = rackAt(there.campaign, rules, station.id);
  const bought = reduce(there, { type: 'campaign/arms/rack', slot: first.slot, rules });
  assert.equal(bought.campaign.arms[first.weapon], 1);
  assert.equal(bought.screen, 'sector');
  assert.equal(reduce(bought, { type: 'campaign/arms/rack', slot: first.slot, rules }), bought, 'gone from the rack');
});

test('SAVE_VERSION 32: a save from before keeps everyone with their job\'s weapon and none spare, and racks with nothing bought', () => {
  assert.equal(SAVE_VERSION, 51);
  const step = MIGRATIONS.find((m) => m.from === 31);
  const campaign = fresh();
  const { arms, ...before } = campaign;
  const up = step.up({ campaign: before });
  assert.deepEqual(up.campaign.arms, {});
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const { racked, ...oldRun } = run.run;
  const { arms: _, ...oldCampaign } = run;
  const ran = step.up({ campaign: { ...oldCampaign, run: oldRun } });
  assert.deepEqual([ran.campaign.arms, ran.campaign.run.racked], [{}, []]);
  assert.deepEqual(campaignProblems(ran.campaign, rules), []);
  assert.deepEqual(step.up({ campaign: null }), { campaign: null });
});
