// Pressure on the colony and its levers (M53): a raid that grows with the
// heat it was found at, lying low, a payment from the colony, and the
// sides' traders.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { colonyStats } from '../src/sim/colony.js';
import { nextDay, planDay } from '../src/sim/days.js';
import { tripPlan } from '../src/sim/expeditions.js';
import { LOW_PROFILE, colonyPaymentFor, heatFallOf, payFromColony, setLowProfile } from '../src/sim/pressure.js';
import { landingPlan, raidExtra, raidParty, raidersOf } from '../src/sim/raids.js';
import { initialState, reduce } from '../src/sim/root.js';
import { buyFromTrader, callDay, callerOn, friendlySides, nextCall, sellToTrader, tradePlan, traderAfter, traderPart } from '../src/sim/traders.js';
import { voyagePlan } from '../src/sim/voyage.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const { balance } = rules;

test('a raid grows with the heat it was found at: one more at the hunters, two at a task force, three cornered', () => {
  assert.equal(raidExtra(0, rules), 0);
  assert.equal(raidExtra(balance.rumorHeat, rules), 0);
  assert.equal(raidExtra(balance.huntHeat, rules), balance.raidExtraHunters);
  assert.equal(raidExtra(balance.raidHeat, rules), balance.raidExtraTaskForce);
  assert.equal(raidExtra(100, rules), balance.raidExtraCornered);
  assert.deepEqual([balance.raidExtraHunters, balance.raidExtraTaskForce, balance.raidExtraCornered], [1, 2, 3]);
  // The extras are the pursuer's own party in turn.
  assert.deepEqual(raidParty(['agent', 'heavy', 'agent', 'guard'], 3), ['agent', 'heavy', 'agent', 'guard', 'agent', 'heavy', 'agent']);
  assert.deepEqual(raidParty(['mp', 'cadet', 'mp'], 0), ['mp', 'cadet', 'mp']);
  assert.deepEqual(raidParty([], 2), []);
  // A lander down with two extra raiders brings six of Con-Reg's four.
  const colony = settled();
  const down = { ...colony, colony: { ...colony.colony, raid: { found: colony.colony.day - 1, lands: colony.colony.day, extra: 2 } } };
  assert.equal(raidersOf(down, rules).length, 6);
  assert.equal(landingPlan(down, rules).raiders.length, 6);
  // A raid from a save before M53 has no extra: the party as it was.
  const old = { ...colony, colony: { ...colony.colony, raid: { found: colony.colony.day - 1, lands: colony.colony.day } } };
  assert.equal(raidersOf(old, rules).length, 4);
});

test('lying low: nothing flies, the mines dig nothing, and heat falls lowProfileFall a day', () => {
  const colony = settled(1, { heat: 60 });
  const low = setLowProfile(colony, rules, true);
  assert.equal(low.ok, true);
  assert.equal(low.campaign.colony.lowProfile, true);
  assert.equal(setLowProfile(colony, rules, 'yes').ok, false);
  // Nothing flies.
  if (colony.colony.places.length) assert.equal(tripPlan(low.campaign, rules, 0, [colony.crew[0].id]).error, LOW_PROFILE);
  if (colony.run) assert.equal(voyagePlan(low.campaign, rules, [colony.crew[0].id]).error, LOW_PROFILE);
  // The mines dig nothing; the farms grow.
  const mined = { ...colony, colony: { ...colony.colony, buildings: [...colony.colony.buildings] } };
  const stats = colonyStats(mined, rules);
  const lowStats = colonyStats({ ...mined, colony: { ...mined.colony, lowProfile: true } }, rules);
  assert.equal(lowStats.made.materials, 0);
  assert.equal(lowStats.made.food, stats.made.food);
  // Heat falls faster.
  assert.equal(heatFallOf(low.campaign.colony, rules), balance.lowProfileFall);
  assert.equal(heatFallOf(colony.colony, rules), balance.colonyHeatFall);
  assert.ok(balance.lowProfileFall > balance.colonyHeatFall);
  const quiet = { ...low.campaign, rng: 12345 };
  const before = quiet.heat;
  const day = nextDay(quiet, rules);
  assert.equal(day.ok, true);
  assert.equal(day.campaign.heat, before - balance.lowProfileFall);
  // Off again, it falls as before.
  const off = setLowProfile(day.campaign, rules, false).campaign;
  assert.equal(nextDay(off, rules).campaign.heat, off.heat - balance.colonyHeatFall);
  assert.equal(planDay(off, rules).ok, true);
});

test('a payment from the colony: the pursuer\'s price for its heat, with the ship landed; the Provost takes none', () => {
  const colony = { ...settled(1, { heat: 40 }), credits: 200 };
  const plan = colonyPaymentFor(colony, rules);
  assert.equal(plan.ok, true);
  const paid = payFromColony(colony, rules);
  assert.equal(paid.ok, true);
  assert.equal(paid.campaign.credits, 200 - plan.payment.credits);
  assert.equal(paid.campaign.heat, colony.heat - plan.payment.heat);
  assert.equal(paid.campaign.flags.payments, (colony.flags.payments ?? 0) + 1);
  assert.equal(payFromColony({ ...colony, credits: 10 }, rules).ok, false);
  assert.equal(payFromColony({ ...colony, heat: 0 }, rules).ok, false);
  const deserter = { ...colony, background: 'deserter' };
  assert.equal(colonyPaymentFor(deserter, rules).why, 'There is no one to pay.');
  // The action makes it.
  const state = reduce({ ...initialState(2), campaign: colony }, { type: 'campaign/colony/pay', rules });
  assert.equal(state.campaign.heat, colony.heat - plan.payment.heat);
});

test("a friendly side's trader calls on its day of every traderEvery, buys materials and sells a part", () => {
  const base = settled();
  const friendly = { ...base, standing: { ...base.standing, union: balance.friendlyStanding } };
  assert.ok(friendlySides(friendly, rules).includes('union'));
  assert.ok(!friendlySides({ ...base, standing: { ...base.standing, union: 0 } }, rules).includes('union'));
  const day = callDay('union', rules);
  assert.ok(day >= 0 && day < balance.traderEvery);
  // Its day, and only its: the next call from any day is it.
  const call = nextCall(friendly, rules, 1);
  assert.ok(call);
  const unionDays = Array.from({ length: 30 }, (_, i) => i + 1).filter((d) => callerOn(friendly, rules, d) === 'union');
  assert.ok(unionDays.length >= 2 && unionDays.every((d, i) => i === 0 || d - unionDays[i - 1] === balance.traderEvery));
  // It brings one of its side's yard maker's parts, the same for the same day.
  const part = traderPart(friendly, rules, 'union', unionDays[0]);
  assert.equal(rules.modules.get(part).manufacturer, 'scrapline');
  assert.equal(traderPart(friendly, rules, 'union', unionDays[0]), part);
  // A day's end that brings it sets it at the colony; the next clears it.
  const arrived = traderAfter(friendly, rules, unionDays[0]);
  assert.deepEqual(arrived, { side: 'union', day: unionDays[0], part, bought: false, sold: 0 });
  assert.equal(traderAfter(friendly, rules, unionDays[0] + 1), null);
  // It trades.
  const here = { ...friendly, credits: 1000, colony: { ...friendly.colony, materials: 40, trader: arrived } };
  const plan = tradePlan(here, rules);
  assert.equal(plan.ok, true);
  assert.equal(plan.side, rules.factions.sides.get('union').name);
  const sold = sellToTrader(here, rules);
  assert.equal(sold.campaign.colony.materials, 40 - balance.traderLot);
  assert.equal(sold.campaign.credits, 1000 + balance.traderLotPrice);
  let last = sold.campaign;
  for (let i = 1; i < balance.traderLots; i++) last = sellToTrader(last, rules).campaign;
  assert.equal(sellToTrader(last, rules).ok, false, 'it buys traderLots lots a call');
  const bought = buyFromTrader(here, rules);
  assert.equal(bought.ok, true);
  assert.equal(bought.campaign.parts[part], (here.parts[part] ?? 0) + 1);
  assert.equal(bought.campaign.credits, 1000 - plan.part.price);
  assert.equal(buyFromTrader(bought.campaign, rules).ok, false, 'one part a call');
  assert.equal(buyFromTrader({ ...here, credits: 0 }, rules).ok, false);
  // With no trader, nothing trades.
  assert.equal(tradePlan(friendly, rules).ok, false);
  // The actions trade.
  const state = reduce({ ...initialState(2), campaign: here }, { type: 'campaign/trader/sell', rules });
  assert.equal(state.campaign.colony.trader.sold, 1);
});

test('the days bring the traders: a friendly side calls at the colony the ship is at, none while lying low is off or on alike', () => {
  const base = settled();
  const friendly = { ...base, standing: { ...base.standing, union: balance.friendlyStanding }, heat: 0 };
  let now = friendly;
  const seen = [];
  for (let i = 0; i < 2 * balance.traderEvery; i++) {
    const day = nextDay(now, rules);
    if (!day.ok) break;
    now = day.campaign;
    if (now.colony.trader) seen.push(now.colony.day);
  }
  assert.ok(seen.length >= 2, `it called: ${seen.join(', ')}`);
  assert.ok(seen.every((d) => callerOn(friendly, rules, d)));
});

test('save v47: a colony from before neither lies low nor has a trader, and a raid coming keeps the pursuer\'s party', () => {
  assert.equal(SAVE_VERSION, 49);
  const colony = settled();
  const strip = ({ lowProfile, trader, ...rest }) => rest;
  const old = { version: 46, data: { ...initialState(2), campaign: { ...colony, colony: { ...strip(colony.colony), raid: { found: 1, lands: 4 } } } } };
  const loaded = parseSave(JSON.stringify(old));
  assert.equal(loaded.ok, true, loaded.error);
  assert.equal(loaded.save.data.campaign.colony.lowProfile, false);
  assert.equal(loaded.save.data.campaign.colony.trader, null);
  assert.deepEqual(loaded.save.data.campaign.colony.raid, { extra: 0, found: 1, lands: 4 });
  // As saved, it reloads.
  const low = { ...colony, colony: { ...colony.colony, lowProfile: true, trader: { side: 'union', day: colony.colony.day, part: null, bought: false, sold: 1 } } };
  const kept = parseSave(JSON.stringify(makeSave({ ...initialState(2), campaign: low })));
  assert.equal(kept.ok, true, kept.error);
  assert.deepEqual(kept.save.data.campaign.colony.trader, low.colony.trader);
  const broken = parseSave(JSON.stringify(makeSave({ ...initialState(2), campaign: { ...low, colony: { ...low.colony, lowProfile: 'yes' } } })));
  assert.equal(broken.ok, false);
});

test('the colony screen\'s words for the levers: Lie low, Pay, the trader and the next call', async () => {
  const { lowProfileRow, paymentRow, traderText } = await import('../src/ui/campaign/pressureText.js');
  const colony = { ...settled(1, { heat: 60 }), credits: 200 };
  const low = lowProfileRow(colony, rules);
  assert.equal(low.name, 'Lie low');
  assert.match(low.detail, new RegExp(`Heat falls ${balance.lowProfileFall} a day`));
  assert.equal(lowProfileRow(setLowProfile(colony, rules, true).campaign, rules).name, 'Stop lying low');
  const pay = paymentRow(colony, rules);
  assert.equal(pay.ok, true);
  assert.match(pay.ask, /Tap again to pay/);
  assert.equal(paymentRow({ ...colony, background: 'deserter' }, rules), null);
  const friendly = { ...colony, standing: { ...colony.standing, union: balance.friendlyStanding } };
  assert.match(traderText(friendly, rules).note, /trader calls on day \d+/);
  assert.equal(traderText(friendly, rules).rows.length, 0);
  const day = nextCall(friendly, rules, 1).day;
  const here = { ...friendly, colony: { ...friendly.colony, materials: 30, trader: traderAfter(friendly, rules, day) } };
  const text = traderText(here, rules);
  assert.deepEqual(text.rows.map((row) => row.key), ['sell', 'buy']);
  assert.equal(text.rows[0].ok, true);
});
