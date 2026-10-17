import assert from 'node:assert/strict';
import { test } from 'node:test';
import { int } from '../src/core/rng.js';
import { parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand } from '../src/sim/builder.js';
import { beginFight, campaignProblems, newCampaign, refitShip } from '../src/sim/campaign.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { pickSeveral, pickWeighted, rollDrop } from '../src/sim/drops.js';
import { buyable, buyPart, PAY_STEP, priceOf, rollStock, sellable, sellPart, sellPriceOf, shopOf } from '../src/sim/economy.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { hangarText } from '../src/ui/campaign/hubText.js';
import { offerText, shopText } from '../src/ui/campaign/shopText.js';
import { rules } from './battleKit.js';

const DISTRICT = 'tailings';
const shop = rules.districts.get(DISTRICT).shop;
// A stock holds the shop's parts and, since M37, its weapons.
const stocked = shop.size + (shop.armsSize ?? 0);
const fresh = (seed = 5, extra = {}) => ({ ...withBoard(newCampaign(rules, seed), rules), ...extra });

test("a part's price is its cost, and the shop buys it back for half, in steps of 5", () => {
  assert.deepEqual([rules.balance.buyPercent, rules.balance.sellPercent], [100, 50]);
  assert.deepEqual(['engine', 'reactor', 'corridor', 'quarters'].map((type) => [priceOf(type, rules), sellPriceOf(type, rules)]), [[200, 100], [200, 100], [10, 5], [80, 40]]);
  for (const def of rules.modules.values()) {
    const [buy, sell] = [priceOf(def.id, rules), sellPriceOf(def.id, rules)];
    assert.ok(buy % PAY_STEP === 0 && sell % PAY_STEP === 0 && sell <= buy, def.id);
  }
  assert.equal(priceOf('teleporter', rules), null);
  // Half of 45 is 22.5: rounded down, so selling never pays more than half.
  const odd = { ...rules, modules: new Map([['odd', { cost: 45 }]]) };
  assert.equal(sellPriceOf('odd', odd), 20);
});

test('a drop table picks by weight, and with even weights as a plain pick would', () => {
  // Even weights take one roll over the list, as contracts.js always did.
  for (let state = 1; state < 50; state++) {
    const list = ['cargo', 'armory', 'shield'];
    assert.deepEqual(pickWeighted(state, { cargo: 1, armory: 1, shield: 1 }), { value: list[int(state, 0, 2).value], state: int(state, 0, 2).state });
  }
  // Weights count: 3 to 1 comes out near 3 to 1.
  let state = 7;
  const counts = { engine: 0, corridor: 0 };
  for (let i = 0; i < 4000; i++) {
    const pick = pickWeighted(state, { engine: 3, corridor: 1 });
    counts[pick.value] += 1;
    state = pick.state;
  }
  assert.ok(counts.engine > 2800 && counts.engine < 3200, JSON.stringify(counts));
  // A job's drops: none means no roll at all; 100 always gives a part.
  assert.deepEqual(rollDrop(9, undefined), { value: null, state: 9 });
  assert.equal(rollDrop(9, { chance: 100, parts: { engine: 1 } }).value, 'engine');
  // Several different parts, as many as asked or as there are.
  const several = pickSeveral(3, { engine: 4, cargo: 2, corridor: 1 }, 2).value;
  assert.equal(new Set(several).size, 2);
  assert.deepEqual(pickSeveral(3, { engine: 4, cargo: 2 }, 5).value.sort(), ['cargo', 'engine']);
});

test("the shop's stock: different parts at their prices, rolled from the campaign's RNG", () => {
  const { stock, rng } = rollStock(rules, 42, DISTRICT);
  assert.equal(stock.length, shop.size);
  assert.equal(new Set(stock.map((item) => item.part)).size, shop.size, 'one of each');
  for (const item of stock) {
    assert.ok(Object.hasOwn(shop.parts, item.part), item.part);
    assert.equal(item.price, priceOf(item.part, rules));
  }
  assert.deepEqual(rollStock(rules, 42, DISTRICT), { stock, rng }, 'the same state, the same stock');
  assert.notEqual(rng, 42);
  assert.deepEqual(rollStock(rules, 42, 'nowhere'), { stock: [], rng: 42 }, 'no shop, no roll');
  // Engines are the heaviest weight: in most stocks.
  let engines = 0;
  for (let seed = 1; seed <= 200; seed++) if (rollStock(rules, seed, DISTRICT).stock.some((item) => item.part === 'engine')) engines += 1;
  assert.ok(engines > 100, `${engines} of 200 stocks have an engine`);
});

test('a new campaign has a stock, and every job, done or lost, brings a new one', () => {
  const campaign = fresh();
  assert.equal(campaign.shop.length, stocked);
  assert.equal(shopOf(campaign, rules), shop);
  assert.deepEqual(campaignProblems(campaign), []);
  const on = takeJob(campaign, rules, 0).campaign;
  assert.deepEqual(on.shop, campaign.shop, 'a fight leaves it as it was');
  for (const winner of ['crew', 'enemy']) {
    const after = endJob({ ...on, fight: { ...on.fight, battle: { ...on.fight.battle, winner } } }, rules);
    assert.equal(after.shop.length, stocked);
    assert.notEqual(after.rng, on.rng);
    assert.deepEqual(campaignProblems(after), []);
  }
  // The board's rolls come first, so a board is the same with or without a shop.
  const unshopped = { ...rules, districts: new Map([[DISTRICT, { ...rules.districts.get(DISTRICT), shop: undefined }]]) };
  const bare = withBoard(newCampaign(unshopped, 5), unshopped);
  assert.deepEqual(bare.board, campaign.board);
  assert.deepEqual(bare.shop, [], 'no shop: an empty stock, so the hangar asks no more');
});

test('buying: the price off the credits, the part on hand, gone from the stock', () => {
  const campaign = fresh(5, { credits: 400 });
  const [first] = campaign.shop;
  const bought = buyPart(campaign, rules, 0);
  assert.ok(bought.ok, bought.error);
  assert.equal(bought.campaign.credits, 400 - first.price);
  assert.equal(bought.campaign.parts[first.part], (campaign.parts[first.part] ?? 0) + 1);
  assert.deepEqual(bought.campaign.shop, campaign.shop.slice(1));
  assert.equal(bought.campaign.flags.partsBought, 1);
  assert.deepEqual(campaignProblems(bought.campaign), []);
  // Why not.
  assert.deepEqual(buyPart({ ...campaign, credits: first.price - PAY_STEP }, rules, 0), { ok: false, error: `It's ${first.price} credits.` });
  assert.deepEqual(buyPart(campaign, rules, 9), { ok: false, error: 'That part is gone.' });
  const fighting = beginFight(campaign, rules).campaign;
  assert.deepEqual(buyPart(fighting, rules, 0), { ok: false, error: 'Buy and sell from the hangar.' });
  assert.deepEqual(buyable({ ...campaign, background: 'nobody' }, rules, 0).why, 'There is no shop here.');
  assert.equal(buyable(campaign, rules, 0).ok, true);
});

test('selling: a part on hand for its sell price', () => {
  const campaign = fresh(5, { credits: 10, parts: { cargo: 2, corridor: 1 } });
  const sold = sellPart(campaign, rules, 'cargo');
  assert.ok(sold.ok, sold.error);
  assert.deepEqual([sold.campaign.credits, sold.campaign.parts, sold.campaign.flags.partsSold], [10 + sellPriceOf('cargo', rules), { cargo: 1, corridor: 1 }, 1]);
  assert.deepEqual(sellPart(sold.campaign, rules, 'corridor').campaign.parts, { cargo: 1 }, 'the last one goes');
  assert.deepEqual(sellPart(campaign, rules, 'engine'), { ok: false, error: "There's no Engine on hand." });
  assert.equal(sellable(campaign, rules, 'cargo').price, sellPriceOf('cargo', rules));
  const fighting = beginFight(campaign, rules).campaign;
  assert.deepEqual(sellPart(fighting, rules, 'cargo'), { ok: false, error: 'Buy and sell from the hangar.' });
});

test('buying and selling through the game, which changes nothing when it fails', () => {
  const state = { ...initialState(1), screen: 'hub', campaign: fresh(5, { credits: 400 }) };
  const bought = reduce(state, { type: 'campaign/buy', index: 0, rules });
  assert.equal(bought.campaign.shop.length, stocked - 1);
  const part = state.campaign.shop[0].part;
  const sold = reduce(bought, { type: 'campaign/sell', part, rules });
  assert.equal(sold.campaign.credits, 400 - state.campaign.shop[0].price + sellPriceOf(part, rules));
  const broke = { ...state, campaign: { ...state.campaign, credits: 0 } };
  assert.equal(reduce(broke, { type: 'campaign/buy', index: 0, rules }), broke);
  assert.equal(reduce(state, { type: 'campaign/sell', part: 'reactor', rules }), state);
});

test('a v6 save gains a shop yet to be rolled, which the hangar rolls, and no jobs done once', () => {
  const campaign = fresh();
  const { shop: stock, spent, ...v6Campaign } = campaign;
  const v6 = { version: 6, data: { ...saveData(initialState(2)), campaign: v6Campaign } };
  const loaded = parseSave(JSON.stringify(v6));
  assert.ok(loaded.ok, loaded.error);
  assert.equal(loaded.save.version, SAVE_VERSION);
  assert.deepEqual(loaded.save.data.campaign, { ...campaign, shop: null });
  const opened = reduce({ ...initialState(1), campaign: loaded.save.data.campaign }, { type: 'campaign/board', rules });
  assert.equal(opened.campaign.shop.length, stocked);
  assert.deepEqual(opened.campaign.board, campaign.board, 'the board it had stays');
  // A save with no campaign is left alone.
  assert.equal(parseSave(JSON.stringify({ version: 6, data: saveData(initialState(3)) })).save.data.campaign, null);
  // What a damaged stock looks like.
  for (const shopValue of [undefined, 'none', [{ part: 'engine' }], [{ part: 'Engine!', price: 5 }], Array(13).fill({ part: 'engine', price: 150 })]) {
    assert.match(campaignProblems({ ...campaign, shop: shopValue }).join(' '), /shop's stock is unreadable/, JSON.stringify(shopValue));
  }
});

test('the shop in words: what the ship needs first, prices, why not, and what to do', () => {
  const campaign = { ...fresh(5), shop: [{ part: 'cargo', price: 60 }, { part: 'engine', price: 200 }, { part: 'corridor', price: 10 }], parts: { corridor: 2, engine: 1 }, credits: 150 };
  const text = shopText(campaign, rules);
  assert.deepEqual([text.name, text.dealer, text.credits], ["Dutch's yard", 'Dutch Abernathy, the scrap dealer', '150 credits']);
  assert.match(text.pitch, /Cash, no questions/);
  assert.deepEqual(text.stock.map((item) => [item.index, item.name, item.price, item.needed, item.ok, item.why, item.action, item.ask]), [
    [1, 'Engine', '200 credits', 'Needed for launch: 3, 1 on hand', false, "It's 200 credits.", 'Buy · 200', 'Buy for 200?'],
    [0, 'Cargo hold', '60 credits', null, true, null, 'Buy · 60', 'Buy for 60?'],
    [2, 'Corridor', '10 credits', null, true, null, 'Buy · 10', 'Buy for 10?'],
  ]);
  assert.deepEqual(text.stock[0].facts, ["2×2 squares · doesn't turn · exhaust must face space", 'Power −1 · Thrust 12 · Mass 3 · Hull points 15']);
  assert.deepEqual(text.held.map((item) => [item.name, item.count, item.price, item.ok, item.action, item.warn]), [
    ['Engine', 1, '100 credits', true, 'Sell · 100', 'The ship needs the Engine'],
    ['Corridor', 2, '5 credits', true, 'Sell · 5', null],
  ]);
  // What to do, the most useful first.
  assert.deepEqual(text.hint, { tone: 'good', text: 'The Engine is on hand: fit it with Build, back at the hangar.' });
  assert.deepEqual(shopText({ ...campaign, credits: 400 }, rules).hint, { tone: 'good', text: 'The ship needs the Engine: buy it, then fit it with Build.' });
  assert.deepEqual(shopText({ ...campaign, parts: {} }, rules).hint, { tone: 'info', text: 'The Engine the ship needs is 200 credits. Jobs pay the rest.' });
  assert.deepEqual(shopText({ ...campaign, parts: {}, shop: [] }, rules).hint, { tone: 'info', text: "Dutch's yard is sold out. The stock turns over after every job." });
  assert.deepEqual(shopText({ ...campaign, parts: {}, shop: [{ part: 'cargo', price: 60 }] }, rules).hint.text, 'Pick a part or a weapon to read about it. Buying or selling takes two taps.');
  assert.equal(shopText({ ...campaign, background: 'nobody' }, rules), null);
  assert.equal(offerText(campaign, rules, 'engine'), "200 at Dutch's yard");
  assert.equal(offerText(campaign, rules, 'reactor'), null);
});

test("the hangar points to the shop: its price in the goal's fixes, and a hint when a part the ship needs is in reach", () => {
  let campaign = { ...fresh(5), shop: [{ part: 'engine', price: 200 }], credits: 250 };
  let { ship } = campaign;
  for (const command of [{ op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }]) ship = applyCommand(ship, rules, command).ship;
  campaign = refitShip(campaign, ship, rules);
  const text = hangarText(campaign, rules);
  assert.equal(text.shop, true);
  assert.equal(text.goal.lines.find((line) => line.text.startsWith('Thrust') || line.text === 'No thrust').fix, "Add 3 × Engine (+12 thrust each): none on hand, 200 at Dutch's yard");
  assert.deepEqual(text.hint, { tone: 'good', text: "Dutch's yard has the Engine the ship needs, for 200. Tap Shop." });
  assert.notEqual(hangarText({ ...campaign, credits: 150 }, rules).hint.text, text.hint.text, 'not with too few credits');
  assert.equal(hangarText({ ...campaign, shop: [] }, rules).goal.lines[1].fix, 'Add 3 × Engine (+12 thrust each): none on hand');
  assert.equal(hangarText({ ...campaign, background: 'nobody' }, rules).shop, false);
});

test('with the hunters out, their warning comes before the shop', () => {
  let campaign = { ...fresh(5), shop: [{ part: 'engine', price: 200 }], credits: 250, parts: {} };
  let { ship } = campaign;
  for (const command of [{ op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }]) ship = applyCommand(ship, rules, command).ship;
  campaign = { ...campaign, ship };
  assert.match(hangarText({ ...campaign, heat: 30 }, rules).hint.text, /Tap Shop/, 'rumors are only words');
  assert.deepEqual(hangarText({ ...campaign, heat: 60 }, rules).hint, { tone: 'warn', text: 'A Recovery agent tails the crew to every job. A payment buys some heat off.' });
});
