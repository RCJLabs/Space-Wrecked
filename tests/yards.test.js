// M37b: the shipyards on the run (src/sim/yards.js). One in every sector,
// charted and safe; yardSize parts rolled once for the yard from every
// maker, leaning to its side's; yardPercent of the dealer's price at the
// side's share; a buy-back at half a part's cost, never above what the yard
// would charge for it; refits there; the docking heat at the pursuer's
// side's yards; and the save's migration to v33.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, SAVE_VERSION } from '../src/core/save.js';
import { removeModule } from '../src/sim/builder.js';
import { campaignProblems, canRefit, HEAT_MAX, maxHp, refitShip } from '../src/sim/campaign.js';
import { priceOf, sellPriceOf } from '../src/sim/economy.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { withHeat } from '../src/sim/heat.js';
import { huntOdds } from '../src/sim/hunt.js';
import { launch } from '../src/sim/launch.js';
import { regroupPlan } from '../src/sim/regroup.js';
import { initialState, reduce } from '../src/sim/root.js';
import { costAt, floorOf, LEVELS, pursuerSide } from '../src/sim/standing.js';
import { beginRun, failingCheck, jumpPlan, linked } from '../src/sim/travel.js';
import { buyFromYard, sellToYard, yardAt, yardBuyBack, yardHere, yardPlan, yardPriceOf, yardSellPlan } from '../src/sim/yards.js';
import { fitPart } from '../tools/run.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const yardOf = (campaign) => campaign.run.sector.nodes.find((node) => node.type === 'shipyard');
// The ship at node `id` of its sector: for the tests, no jump.
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });
// The ship at the yard of its first sector.
function atTheYard(extra = {}) {
  const run = onRun(extra);
  return at(run, yardOf(run).id);
}
// The campaign with the yard where the ship is named `name`, and so whose
// it is (data/factions.json stations).
function named(campaign, name) {
  const { sector, at: here } = campaign.run;
  return { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes: sector.nodes.map((node) => (node.id === here ? { ...node, name } : node)) } } };
}
// The shipyards' names that belong to `side`, or to nobody for null.
const yardsOf = (side) => rules.sectors.names.shipyards.filter((name) => (rules.factions.stations[name] ?? null) === side);
// The crew's standing with `side` at the floor of `level`.
const standingAt = (campaign, side, level) => ({ ...campaign, standing: { ...campaign.standing, [side]: floorOf(level, rules) } });
const partName = (type) => rules.modules.get(type).name.toLowerCase();
const uidOf = (ship, type) => ship.modules.find((m) => m.type === type).uid;

test('a shipyard in every sector of the run, charted and safe as stations are, in a column of its own, named from its list', () => {
  const kind = rules.nodeTypes.get('shipyard');
  assert.deepEqual([kind.charted, kind.safe], [true, true]);
  const names = rules.sectors.names.shipyards;
  assert.equal(new Set(names).size, names.length);
  const sectors = rules.acts.get(2).sectors;
  for (let seed = 1; seed <= 60; seed++) {
    for (let index = 1; index <= sectors; index++) {
      const sector = generateSector(rules, seed, index);
      const yards = sector.nodes.filter((node) => node.type === 'shipyard');
      assert.equal(yards.length, 1, `seed ${seed}, sector ${index}`);
      const [yard] = yards;
      assert.ok(names.includes(yard.name), yard.name);
      assert.ok(!yard.event && !yard.hostile, 'nothing waits at a yard');
      const column = sector.nodes.filter((node) => node.col === yard.col && node !== yard);
      assert.ok(column.every((node) => !Object.hasOwn(rules.sectors.counts, node.type)), `seed ${seed}, sector ${index}: a column of its own`);
    }
  }
  // Every side has yards, and some are nobody's.
  for (const side of rules.factions.sides.keys()) assert.ok(yardsOf(side).length > 0, side);
  assert.ok(yardsOf(null).length > 0);
  // The hunters never find the ship at one, however hot.
  const run = atTheYard();
  assert.deepEqual(huntOdds(run, rules, HEAT_MAX, 'shipyard'), { chance: 0, ship: null, why: 'safe' });
});

test("a yard's stock: yardSize different parts, the same on every visit, from the campaign's seed and not its rolls", () => {
  assert.equal(balance.yardSize, 12);
  const run = atTheYard({ credits: 2000 });
  const yard = yardOf(run);
  const stock = yardAt(run, rules, yard.id);
  assert.equal(stock.length, balance.yardSize);
  assert.deepEqual(stock.map((item) => item.slot), [...stock.keys()]);
  assert.equal(new Set(stock.map((item) => item.part)).size, stock.length, 'no part twice');
  assert.ok(stock.every((item) => rules.modules.has(item.part)));
  assert.deepEqual(yardAt(run, rules, yard.id), stock, 'the same on every visit');
  assert.deepEqual(yardAt({ ...run, rng: { ...run.rng } }, rules, yard.id), stock);
  assert.deepEqual(yardAt(buyFromYard(run, rules, 0).campaign, rules, yard.id), stock, 'buying rolls nothing');
  assert.notDeepEqual(yardAt({ ...run, seed: run.seed + 1 }, rules, yard.id), stock, 'another campaign, another yard');
  assert.deepEqual(yardAt(run, rules, run.run.sector.start), [], 'the way in is no yard');
  assert.deepEqual(yardHere(run, rules), stock);
  const station = run.run.sector.nodes.find((node) => node.type === 'station');
  assert.deepEqual(yardHere(at(run, station.id), rules), [], 'nor is a station');
});

test("a yard leans to its side's makers: the Fleet's to Bastion, the Hallorans' to Kestrel, Con-Reg's to the Yard's own, the union's to Scrapline; nobody's rolls evenly", () => {
  const run = atTheYard();
  const yard = yardOf(run);
  // Each maker's share of 100 campaigns' stock at a yard named `name`.
  const shares = (name) => {
    const count = {};
    let all = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of yardAt(named({ ...run, seed }, name), rules, yard.id)) {
        const maker = rules.modules.get(item.part).manufacturer;
        count[maker] = (count[maker] ?? 0) + 1;
        all++;
      }
    }
    return Object.fromEntries([...rules.manufacturers.keys()].map((maker) => [maker, (count[maker] ?? 0) / all]));
  };
  const leans = { fleet: 'bastion', hallorans: 'kestrel', conreg: 'yard', union: 'scrapline' };
  for (const [side, maker] of Object.entries(leans)) {
    assert.deepEqual(rules.factions.sides.get(side).yard, { [maker]: 3 });
    const share = shares(yardsOf(side)[0]);
    assert.ok(share[maker] >= 0.35, `${side}: ${maker} ${share[maker]}`);
    for (const [other, part] of Object.entries(share)) if (other !== maker) assert.ok(part > 0.05 && part <= 0.3, `${side}: ${other} ${part}, every maker`);
  }
  const even = shares(yardsOf(null)[0]);
  for (const [maker, part] of Object.entries(even)) assert.ok(part >= 0.15 && part <= 0.35, `nobody's: ${maker} ${part}`);
});

test("yard prices: yardPercent of the dealer's, in steps of 5, at the side's share; a friendlier side charges less", () => {
  assert.equal(balance.yardPercent, 60);
  for (const def of rules.modules.values()) {
    const price = yardPriceOf(def.id, rules);
    assert.equal(price, Math.max(5, 5 * Math.round((priceOf(def.id, rules) * 60) / 100 / 5)), def.id);
    assert.ok(price < priceOf(def.id, rules) || priceOf(def.id, rules) <= 5, def.id);
  }
  assert.equal(yardPriceOf('nothing', rules), null);
  const run = atTheYard();
  const yard = yardOf(run);
  const fleets = named(run, yardsOf('fleet')[0]);
  let last = Infinity;
  for (const level of LEVELS) {
    const campaign = standingAt(fleets, 'fleet', level);
    const share = balance[`${level}Price`];
    const stock = yardAt(campaign, rules, yard.id);
    for (const item of stock) assert.equal(item.price, costAt(1, yardPriceOf(item.part, rules), share), `${level}: ${item.part}`);
    const total = stock.reduce((sum, item) => sum + item.price, 0);
    assert.ok(total < last, `${level} charges less than the level below`);
    last = total;
  }
  // Nobody's yard charges the yard's price, whoever the crew stands well with.
  const nobodys = named(run, yardsOf(null)[0]);
  for (const item of yardAt(nobodys, rules, yard.id)) assert.equal(item.price, yardPriceOf(item.part, rules));
});

test('buying at a yard: the part on hand, its price off the credits, and gone from the yard for good; what it takes, said first', () => {
  const run = atTheYard({ credits: 2000 });
  const yard = yardOf(run);
  const stock = yardHere(run, rules);
  const [first, second] = stock;
  assert.deepEqual(yardPlan(run, rules, first.slot), { ok: true, item: first, dock: balance.dockHeat });
  const bought = buyFromYard(run, rules, first.slot);
  assert.ok(bought.ok, bought.error);
  const after = bought.campaign;
  assert.equal(after.credits, run.credits - first.price);
  assert.equal(after.parts[first.part], (run.parts[first.part] ?? 0) + 1);
  assert.deepEqual(after.run.yarded, [{ node: yard.id, slot: first.slot }]);
  assert.equal(after.flags.partsBought, (run.flags.partsBought ?? 0) + 1);
  assert.deepEqual([after.rng, after.supplies, after.crew, after.ship], [run.rng, run.supplies, run.crew, run.ship], 'nothing else moves');
  assert.deepEqual(yardHere(after, rules), stock.slice(1));
  assert.equal(yardPlan(after, rules, first.slot).error, "That one's gone from the yard.");
  assert.equal(buyFromYard(after, rules, first.slot).ok, false);
  assert.deepEqual(campaignProblems(after), []);
  // Short of credits, the price.
  const poor = { ...run, credits: second.price - 1 };
  assert.equal(yardPlan(poor, rules, second.slot).error, `The ${partName(second.part)} is ${second.price} credits.`);
  // Away from a yard, or held where it is, nothing.
  assert.equal(yardPlan(at(run, run.run.sector.start), rules, first.slot).error, 'Parts are sold at shipyards.');
  const held = { ...run, run: { ...run.run, approach: { enemy: { name: 'Cutter' }, outcome: null } } };
  assert.equal(yardPlan(held, rules, first.slot).error, 'Deal with the Cutter first.');
  assert.equal(yardPlan(run, rules, 99).error, "That one's gone from the yard.");
});

test('the yard buys any part on hand at half its cost, never above what it charges for it: a part bought and sold straight back makes nothing', () => {
  const run = atTheYard({ credits: 2000 });
  const fleets = named(run, yardsOf('fleet')[0]);
  let capped = 0;
  for (const level of LEVELS) {
    const campaign = standingAt(fleets, 'fleet', level);
    const share = balance[`${level}Price`];
    for (const def of rules.modules.values()) {
      const back = yardBuyBack(campaign, rules, def.id);
      const charge = costAt(1, yardPriceOf(def.id, rules), share);
      assert.equal(back, Math.min(sellPriceOf(def.id, rules), charge), `${level}: ${def.id}`);
      if (back < sellPriceOf(def.id, rules)) capped++;
    }
  }
  assert.ok(capped > 0, 'at trusted, the cap bites');
  assert.equal(yardBuyBack(run, rules, 'nothing'), null);
  // Sold: its price onto the credits, one fewer on hand, the last one gone.
  const holding = { ...run, parts: { cargo: 2 } };
  const price = yardBuyBack(holding, rules, 'cargo');
  assert.deepEqual(yardSellPlan(holding, rules, 'cargo'), { ok: true, type: 'cargo', price, dock: balance.dockHeat });
  const once = sellToYard(holding, rules, 'cargo');
  assert.ok(once.ok, once.error);
  assert.deepEqual([once.campaign.credits, once.campaign.parts, once.campaign.flags.partsSold], [holding.credits + price, { cargo: 1 }, (holding.flags.partsSold ?? 0) + 1]);
  assert.equal(once.campaign.run.docked, true);
  const twice = sellToYard(once.campaign, rules, 'cargo').campaign;
  assert.deepEqual(twice.parts, {});
  assert.equal(yardSellPlan(twice, rules, 'cargo').error, `There's no ${partName('cargo')} on hand.`);
  assert.equal(yardSellPlan({ ...twice, parts: { ghost: 1 } }, rules, 'ghost').error, 'The yard has no price for that.');
  assert.equal(yardSellPlan(at(holding, holding.run.sector.start), rules, 'cargo').error, 'Parts are bought at shipyards.');
  assert.deepEqual(campaignProblems(twice), []);
  // Every part of the stock, bought and sold straight back, at every level.
  for (const level of LEVELS) {
    const campaign = standingAt(fleets, 'fleet', level);
    for (const item of yardHere(campaign, rules)) {
      const bought = buyFromYard(campaign, rules, item.slot).campaign;
      const sold = sellToYard(bought, rules, item.part).campaign;
      assert.ok(sold.credits <= campaign.credits, `${level}: ${item.part} ${campaign.credits} -> ${sold.credits}`);
    }
  }
});

test("trading at a yard of the pursuer's side docks the ship with its heat, once; at anyone else's, with none", () => {
  const run = atTheYard({ credits: 2000, parts: { cargo: 2 } });
  const side = pursuerSide(run, rules);
  const theirs = named(run, yardsOf(side)[0]);
  assert.equal(yardPlan(theirs, rules, 0).dock, balance.dockHeat);
  const bought = buyFromYard(theirs, rules, 0).campaign;
  assert.equal(bought.heat, withHeat(theirs.heat, balance.dockHeat));
  assert.equal(bought.run.docked, true);
  assert.equal(yardPlan(bought, rules, 1).dock, 0, 'docked: no more');
  assert.equal(sellToYard(bought, rules, 'cargo').campaign.heat, bought.heat);
  // Selling first docks it too.
  assert.equal(sellToYard(theirs, rules, 'cargo').campaign.heat, withHeat(theirs.heat, balance.dockHeat));
  // Anyone else's yard, or nobody's: docked, no heat.
  for (const name of [yardsOf(null)[0], ...[...rules.factions.sides.keys()].filter((id) => id !== side).map((id) => yardsOf(id)[0])]) {
    const other = buyFromYard(named(run, name), rules, 0).campaign;
    assert.deepEqual([other.heat, other.run.docked], [run.heat, true], name);
  }
});

test('a refit at a yard, as at a station: the parts on hand go on, what comes off is on hand to sell, and a failing flight check keeps the ship there', () => {
  const campaign = atTheYard({ parts: { cargo: 1 } });
  assert.equal(canRefit(campaign, rules), true);
  const cargo = fitPart(campaign.ship, rules, 'cargo');
  const fitted = refitShip(campaign, cargo.ship, rules);
  assert.equal(fitted.ship, cargo.ship);
  assert.deepEqual(fitted.parts, {});
  const off = refitShip(fitted, removeModule(fitted.ship, uidOf(fitted.ship, 'cargo')), rules);
  assert.deepEqual(off.parts, { cargo: 1 });
  assert.equal(sellToYard(off, rules, 'cargo').ok, true, 'and the yard buys it');
  // The reactor taken off: the ship stays until a refit puts power back.
  const near = linked(campaign.run.sector, campaign.run.at)[0];
  assert.equal(failingCheck(campaign, rules), null);
  const broken = refitShip(campaign, removeModule(campaign.ship, uidOf(campaign.ship, 'reactor')), rules);
  assert.equal(failingCheck(broken, rules).id, 'power');
  assert.equal(jumpPlan(broken, rules, near).ok, false);
  assert.equal(failingCheck(refitShip(broken, campaign.ship, rules), rules), null);
  // Elsewhere on the run, no refit.
  const empty = campaign.run.sector.nodes.find((node) => Object.hasOwn(rules.sectors.mix, node.type));
  assert.equal(canRefit(at(campaign, empty.id), rules), false);
});

test("a day's rest at a yard: no Patch up there, so the crew can regroup, out of the hunters' reach", () => {
  const run = atTheYard({ heat: 90 });
  const hurt = { ...run, crew: run.crew.map((member) => ({ ...member, hp: maxHp(member, rules) - 2 })) };
  const plan = regroupPlan(hurt, rules);
  assert.ok(plan.ok, plan.error);
  assert.equal(plan.kind, 'regroup');
  assert.deepEqual(plan.hunt, { chance: 0, ship: null, why: 'safe' });
});

test('through the game: a part bought and one sold at the yard; one that fails changes nothing', () => {
  const state = { ...initialState(1), screen: 'sector', campaign: atTheYard({ credits: 2000, parts: { cargo: 1 } }) };
  const [first] = yardHere(state.campaign, rules);
  const bought = reduce(state, { type: 'campaign/yard/buy', slot: first.slot, rules });
  assert.equal(bought.campaign.parts[first.part], (state.campaign.parts[first.part] ?? 0) + 1);
  assert.equal(bought.campaign.credits, state.campaign.credits - first.price);
  assert.equal(bought.screen, 'sector');
  assert.equal(reduce(bought, { type: 'campaign/yard/buy', slot: first.slot, rules }), bought, 'gone from the yard');
  const price = yardBuyBack(bought.campaign, rules, 'cargo');
  const sold = reduce(bought, { type: 'campaign/yard/sell', part: 'cargo', rules });
  assert.equal(sold.campaign.credits, bought.campaign.credits + price);
  assert.equal(sold.campaign.parts.cargo, bought.campaign.parts.cargo - 1 || undefined);
  const none = { ...sold, campaign: { ...sold.campaign, parts: {} } };
  assert.equal(reduce(none, { type: 'campaign/yard/sell', part: 'cargo', rules }), none, 'none on hand');
});

test('SAVE_VERSION 33: a run from before reads with nothing bought at a yard; a broken record of them, or a dock elsewhere, is caught', () => {
  assert.equal(SAVE_VERSION, 49);
  const step = MIGRATIONS.find((m) => m.from === 32);
  const run = atTheYard({ credits: 2000 });
  const { yarded, ...oldRun } = run.run;
  const up = step.up({ campaign: { ...run, run: oldRun } });
  assert.deepEqual(up.campaign.run, { ...oldRun, yarded: [] });
  assert.deepEqual(campaignProblems(up.campaign), []);
  // Off the run, as it was.
  const home = readyToLaunch();
  assert.deepEqual(step.up({ campaign: home }), { campaign: home });
  assert.deepEqual(step.up({ campaign: null }), { campaign: null });
  // What the run keeps of the yards: a seen yard's node and a slot, once each.
  const yard = yardOf(run).id;
  const bought = buyFromYard(run, rules, 0).campaign;
  assert.deepEqual(campaignProblems(bought), [], 'docked at a yard reads');
  const broken = (patch) => campaignProblems({ ...bought, run: { ...bought.run, ...patch } });
  for (const yardedBad of [null, [{ node: yard, slot: 20 }], [{ node: yard, slot: -1 }], [{ node: run.run.sector.start, slot: 0 }], [{ node: yard, slot: 0 }, { node: yard, slot: 0 }], [{ node: yard }]]) {
    assert.deepEqual(broken({ yarded: yardedBad }), ["The campaign's run has unreadable shipyards."], JSON.stringify(yardedBad));
  }
  const away = { at: run.run.sector.start, docked: false };
  assert.deepEqual(broken({ ...away, seen: [run.run.sector.start] }), ["The campaign's run has unreadable shipyards."], 'a yard never reached');
  assert.deepEqual(broken(away), [], 'one left behind');
  assert.deepEqual(broken({ at: run.run.sector.start, yarded: [] }), ["The campaign's run has an unreadable dock."], 'docked at the way in');
});
