// M39: hull frames that differ in kind, bought at a shipyard (yards.js,
// reframe.js). Every yard sells the player's frames but the ship's own, at
// yardPercent of the frame's price and the side's share, less half what the
// ship's own frame fetches there. The ship moves over at once, its parts and
// styling pieces keeping their places, shifted into the new grid if they
// don't fit; refused, saying why, past the cap, the grid or the styling cap.
// The frame's trait and thrust for mass hold at once, and a ship that then
// fails a flight check stays until a refit (M23h's rule). Saves stay at v38.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { sideStats } from '../src/sim/approach.js';
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { placedCells } from '../src/sim/modules.js';
import { onFrame } from '../src/sim/reframe.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { costAt, floorOf, LEVELS, priceShare } from '../src/sim/standing.js';
import { beginRun, failingCheck, jumpPlan, linked, supplyCapacity } from '../src/sim/travel.js';
import { buyFrame, framePlan, frameYardPrice, framesHere } from '../src/sim/yards.js';
import { launchedShip, withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const yardOf = (campaign) => campaign.run.sector.nodes.find((node) => node.type === 'shipyard');
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });
// The ship at its first sector's yard, with credits to spend.
const atTheYard = (credits = 5000) => {
  const run = onRun();
  return { ...at(run, yardOf(run).id), credits };
};
const cellsOf = (ship) => ship.modules.flatMap((m) => placedCells(rules.modules.get(m.type), m));
const box = (ship) => {
  const cells = cellsOf(ship);
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
};

test("a yard sells the player's frames but the ship's own, at its percent of the price and its side's share, less half the old frame's worth", () => {
  const campaign = atTheYard();
  const here = framesHere(campaign, rules);
  assert.deepEqual(here.map((item) => item.frame), ['courier', 'gunship', 'freighter'], "not the ship's own, nor an enemy's");
  // The yard's side's share (standing.js), as for its parts.
  const share = priceShare(campaign, rules, yardOf(campaign));
  const own = frameYardPrice(rules.frames.get('starter'), rules);
  assert.equal(own, Math.round((rules.frames.get('starter').cost * balance.yardPercent) / 100 / 5) * 5);
  const worth = Math.floor(costAt(1, own, share) / 2 / 5) * 5;
  for (const item of here) {
    const price = costAt(1, frameYardPrice(rules.frames.get(item.frame), rules), share);
    assert.deepEqual([item.price, item.worth, item.cost], [price, worth, Math.max(0, price - worth)], item.frame);
  }
  assert.equal(frameYardPrice(rules.frames.get('patrolhull'), rules), null, "an enemy's frame has no price");
  // On the courier, the starter hull is for sale and the courier isn't.
  const moved = buyFrame(campaign, rules, 'courier').campaign;
  assert.deepEqual(framesHere(moved, rules).map((item) => item.frame), ['starter', 'gunship', 'freighter']);
  // Away from a yard, none.
  const away = at(campaign, campaign.run.sector.start);
  assert.deepEqual(framesHere(away, rules), []);
  assert.match(framePlan(away, rules, 'courier').error, /Frames are sold at shipyards/);
});

test("a side's yard charges its level's share for a frame, as for a part", () => {
  const campaign = atTheYard();
  const node = yardOf(campaign);
  const sides = Object.entries(rules.factions.stations).filter(([name]) => rules.sectors.names.shipyards.includes(name));
  const [name, side] = sides[0];
  const named = { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes: campaign.run.sector.nodes.map((n) => (n.id === node.id ? { ...n, name } : n)) } } };
  const liked = { ...named, standing: { ...named.standing, [side]: floorOf(LEVELS.at(-1), rules) } };
  const plain = framesHere(campaign, rules).find((item) => item.frame === 'gunship');
  const cheap = framesHere(liked, rules).find((item) => item.frame === 'gunship');
  assert.ok(cheap.price < plain.price, `${cheap.price} at a trusted side's yard, ${plain.price} at nobody's`);
});

test('bought, the ship moves over at once: its parts keep their places, its cost comes off, and the save reads as v38', () => {
  const campaign = atTheYard(1000);
  const plan = framePlan(campaign, rules, 'courier');
  assert.equal(plan.ok, true, plan.error);
  assert.deepEqual(plan.shift, [0, 0], 'the launched ship fits the courier where it is');
  const bought = buyFrame(campaign, rules, 'courier');
  const { campaign: after } = bought;
  assert.equal(after.ship.frame, 'courier');
  assert.deepEqual(after.ship.modules, campaign.ship.modules);
  assert.equal(after.credits, 1000 - plan.item.cost);
  assert.equal(after.flags.framesBought, 1);
  assert.deepEqual(layoutProblems(after.ship, rules), []);
  assert.deepEqual(campaignProblems(after), []);
  assert.equal(SAVE_VERSION, 51);
  const reread = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(3)), campaign: after })));
  assert.equal(reread.ok, true, reread.error);
  assert.equal(reread.save.data.campaign.ship.frame, 'courier');
  // Through the game's own action too.
  const viaRoot = reduce({ ...initialState(), campaign }, { type: 'campaign/yard/frame', frame: 'gunship', rules });
  assert.equal(viaRoot.campaign.ship.frame, 'gunship');
});

test("a ship that doesn't fit where it is shifts in, all of it together; one bigger than the grid is refused", () => {
  // The launched ship moved to the far corner of a freighter's grid.
  const ship = launchedShip(rules);
  const [left, right, top, bottom] = box(ship);
  const big = onFrame(ship, rules, 'freighter').ship;
  const [dx, dy] = [rules.frames.get('freighter').width - 1 - right, rules.frames.get('freighter').height - 1 - bottom];
  const cornered = { ...big, modules: big.modules.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy })) };
  assert.deepEqual(layoutProblems(cornered, rules), []);
  const small = onFrame(cornered, rules, 'courier');
  assert.equal(small.ok, true, small.error);
  const courier = rules.frames.get('courier');
  assert.deepEqual(small.shift, [courier.width - 1 - (right + dx), courier.height - 1 - (bottom + dy)]);
  assert.deepEqual(box(small.ship), [left + dx + small.shift[0], courier.width - 1, top + dy + small.shift[1], courier.height - 1]);
  assert.deepEqual(layoutProblems(small.ship, rules), []);
  // The parts keep their places to one another.
  const offsets = (s) => s.modules.map((m) => [m.uid, m.x - s.modules[0].x, m.y - s.modules[0].y]);
  assert.deepEqual(offsets(small.ship), offsets(cornered));
  // An empty ship fits anywhere.
  assert.equal(onFrame(buildShip(rules, 'freighter', []).ship, rules, 'courier').ok, true);
  // A row of corridors out past the courier's 18 cells, within its 24
  // parts: refused, saying how big.
  const tail = Array.from({ length: 11 }, (_, i) => ({ uid: 900 + i, type: 'corridor', x: right + 1 + i, y: top, rot: 0 }));
  const long = { ...big, modules: [...big.modules, ...tail] };
  assert.ok(long.modules.length <= rules.frames.get('courier').maxModules);
  assert.equal(box(long)[1] - box(long)[0] + 1, right - left + 12);
  assert.match(onFrame(long, rules, 'courier').error, new RegExp(`^The ship is ${right - left + 12} × ${bottom - top + 1} cells, and the Courier frame's yard 18 × 10\\.$`));
});

test('refused, saying why: the parts past the cap, the styling pieces past the frame\'s, the credits short, the frame its own, or one the yard never sells', () => {
  const campaign = atTheYard();
  // More parts than the courier's 24.
  let ship = campaign.ship;
  while (ship.modules.length <= rules.frames.get('courier').maxModules) ship = withPart(ship, rules, 'corridor');
  assert.match(framePlan({ ...campaign, ship }, rules, 'courier').error, new RegExp(`The Courier frame holds at most 24 parts, and the ship has ${ship.modules.length}`));
  // More styling pieces than its 16 (any pieces will do for the count).
  const styled = { ...campaign.ship, styling: Array.from({ length: 17 }, (_, i) => ({ uid: 900 + i, type: 'antenna', x: 0, y: 0, rot: 0 })) };
  assert.match(onFrame(styled, rules, 'courier').error, /The Courier frame takes at most 16 styling pieces, and the ship has 17/);
  // Short of credits.
  const poor = { ...campaign, credits: 10 };
  assert.match(framePlan(poor, rules, 'courier').error, /The Courier frame is \d+ credits, the ship's own frame given in part payment/);
  assert.match(framePlan(campaign, rules, 'starter').error, /The ship is on the Starter hull already/);
  assert.match(framePlan(campaign, rules, 'patrolhull').error, /The yard doesn't sell that frame/);
  assert.match(framePlan(campaign, rules, 'warpframe').error, /The yard doesn't sell that frame/);
  // A refusal changes nothing.
  assert.equal(buyFrame(poor, rules, 'courier').ok, false);
});

test("the frame's trait holds at once: the courier's evasion, the gunship's aim, the freighter's lockers", () => {
  const campaign = atTheYard();
  const side = (c) => sideStats({ ship: c.ship, damage: {}, wrecked: {} }, rules);
  const courier = buyFrame(campaign, rules, 'courier').campaign;
  const byThrust = (stats) => Math.round(balance.evasionPerThrust * stats.ratio);
  assert.equal(side(courier).evasion, byThrust(side(courier)) + 10);
  assert.equal(side(buyFrame(campaign, rules, 'gunship').campaign).gunnery, 10);
  const freighter = buyFrame(campaign, rules, 'freighter').campaign;
  assert.equal(supplyCapacity(freighter.ship, rules, freighter.crew), supplyCapacity(campaign.ship, rules, campaign.crew) + 20);
});

test("a frame asking more thrust for its mass than the ship has: bought, the ship stays at the yard until a refit fixes it", () => {
  const campaign = atTheYard();
  // Two of its three engines off: 0.5 thrust for each unit of mass, all
  // the starter hull asks and short of the freighter's 0.6.
  const engines = campaign.ship.modules.filter((m) => m.type === 'engine').map((m) => m.uid);
  assert.equal(engines.length, 3);
  const slow = engines.slice(1).reduce((ship, uid) => ({ ...ship, modules: ship.modules.filter((m) => m.uid !== uid) }), campaign.ship);
  const ratio = sideStats({ ship: slow, damage: {}, wrecked: {} }, rules).ratio;
  assert.ok(ratio >= rules.frames.get('starter').minThrustToMass && ratio < rules.frames.get('freighter').minThrustToMass, `ratio ${ratio}`);
  const ready = { ...campaign, ship: slow };
  assert.equal(failingCheck(ready, rules), null);
  const plan = framePlan(ready, rules, 'freighter');
  assert.equal(plan.ok, true, plan.error);
  assert.equal(plan.check.id, 'thrust');
  const moved = buyFrame(ready, rules, 'freighter').campaign;
  const to = linked(moved.run.sector, moved.run.at)[0];
  const jumping = jumpPlan(moved, rules, to);
  assert.deepEqual([jumping.ok, jumping.check?.id], [false, 'thrust']);
  assert.match(jumping.error, /can't leave until every flight check passes/);
  // An engine more and it flies.
  const fixed = { ...moved, ship: withPart(moved.ship, rules, 'engine') };
  assert.equal(failingCheck(fixed, rules), null);
});
