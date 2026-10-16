// M27: building by hand at the colony. Farms and mines are built from
// materials, spare parts set down from the hold and the ship's parts given,
// each where the player puts it; any building moves, turns and comes down;
// and the landed ship refits there with the parts on hand. Every refusal
// says why.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand } from '../src/sim/builder.js';
import { campaignProblems, canRefit, refitShip, shipChecklist } from '../src/sim/campaign.js';
import { colonyStats, spotFor } from '../src/sim/colony.js';
import { build, buildList, buildPlan, moveBuilding, movePlan, takeDown, takeDownPlan, turnedSpot } from '../src/sim/colonyBuild.js';
import { initialState, reduce } from '../src/sim/root.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const farm = { build: 'farm' };
const mine = { build: 'mine' };

test('a farm or a mine is built from materials, where the player puts it', () => {
  const campaign = settled();
  // Without a placement, the first spot that fits.
  const first = buildPlan(campaign, rules, farm);
  assert.deepEqual(first, { ok: true, what: farm, from: 'build', type: 'farm', name: 'Farm', placement: { x: 0, y: 0, rot: 0 }, cost: 10, gives: null, makes: { food: 1 } });
  const plan = buildPlan(campaign, rules, farm, { x: 5, y: 3, rot: 0 });
  assert.deepEqual([plan.ok, plan.placement], [true, { x: 5, y: 3, rot: 0 }]);
  const one = build(campaign, rules, farm, { x: 5, y: 3, rot: 0 });
  assert.equal(one.ok, true, one.error);
  assert.deepEqual(one.campaign.colony.buildings, [{ uid: 1, type: 'farm', x: 5, y: 3, rot: 0 }]);
  assert.deepEqual([one.campaign.colony.materials, one.campaign.colony.nextUid], [10, 2]);
  assert.deepEqual(one.campaign.flags, { ...campaign.flags, built: 1, materialsSpent: 10 });
  for (const key of ['ship', 'parts', 'crew', 'supplies', 'credits']) assert.deepEqual(one.campaign[key], campaign[key], key);
  assert.deepEqual(campaignProblems(one.campaign), []);
  const two = build(one.campaign, rules, mine, { x: 9, y: 3, rot: 1 });
  assert.equal(two.ok, true, two.error);
  // The world's ore, 2, and the engineer at home's 1 (M32).
  assert.deepEqual(two.plan.makes, { materials: 3 });
  assert.equal(two.campaign.colony.materials, 0);
  // Out of materials.
  assert.deepEqual(buildPlan(two.campaign, rules, farm), { ok: false, error: 'A farm takes 10 materials, and the stores have 0.' });
  // The build list: what each costs and would make here, and whether it can
  // be built now.
  const list = buildList(one.campaign, rules);
  // From M28 a solar array and a shelter too, which give instead of make.
  assert.deepEqual(list.builds.map((row) => [row.id, row.name, row.cost, row.makes, row.ok]), [
    ['farm', 'Farm', 10, { food: 1 }, true],
    ['mine', 'Mine', 10, { materials: 3 }, true],
    ['solar', 'Solar array', 15, null, false],
    ['shelter', 'Shelter', 10, null, true],
  ]);
  assert.deepEqual(list.builds.slice(2).map((row) => [row.gives.power, row.gives.beds, row.gives.air]), [[3, 0, 0], [-1, 2, 2]]);
  assert.deepEqual(buildList(two.campaign, rules).builds.map((row) => row.error), [
    'A farm takes 10 materials, and the stores have 0.',
    'A mine takes 10 materials, and the stores have 0.',
    'A solar array takes 15 materials, and the stores have 0.',
    'A shelter takes 10 materials, and the stores have 0.',
  ]);
});

test('each refusal says why: past the edge, on another building, too close, a turn, unknown, away from the colony, no room', () => {
  const campaign = build(settled(), rules, farm, { x: 5, y: 3, rot: 0 }).campaign;
  const at = (x, y, rot = 0) => buildPlan(campaign, rules, mine, { x, y, rot }).error;
  assert.equal(at(19, 0), "The mine would stand past the edge of the colony's grid.");
  assert.equal(at(-1, 0), "The mine would stand past the edge of the colony's grid.");
  assert.equal(at(0, 11), "The mine would stand past the edge of the colony's grid.");
  assert.equal(at(4, 2), 'The farm stands there.');
  assert.equal(at(7, 3), 'Too close to the farm: every building needs a cell of path round it.');
  assert.equal(at(5, 1), 'Too close to the farm: every building needs a cell of path round it.');
  assert.equal(at(8, 3), undefined);
  assert.equal(at(5, 6), undefined);
  assert.equal(at(1, 1, 4), "The mine can't be turned.");
  assert.equal(at(1.5, 1), "The mine would stand past the edge of the colony's grid.");
  assert.deepEqual(buildPlan(campaign, rules, { build: 'orchard' }), { ok: false, error: 'Nothing by that name can be built.' });
  const { colony, ...run } = campaign;
  assert.deepEqual(buildPlan({ ...run, act: 2, colony: null }, rules, farm), { ok: false, error: 'Building is done at the colony.' });
  // No room: a grid that holds the farm and nothing else.
  const small = { ...rules, colony: { ...rules.colony, site: { width: 4, height: 3, gap: 1 } } };
  const crowded = build(settled(), small, farm).campaign;
  assert.deepEqual(buildPlan(crowded, small, mine), { ok: false, error: "There's no room left on the colony's grid." });
  // A refusal through the game changes nothing.
  const state = { ...initialState(1), screen: 'colony', campaign };
  assert.equal(reduce(state, { type: 'campaign/build', what: mine, placement: { x: 4, y: 2, rot: 0 }, rules }), state);
  const built = reduce(state, { type: 'campaign/build', what: mine, placement: { x: 8, y: 3, rot: 0 }, rules });
  assert.deepEqual(built.campaign.colony.buildings.at(-1), { uid: 2, type: 'mine', x: 8, y: 3, rot: 0 });
  assert.equal(built.screen, 'colony');
});

test('a spare part from the hold is set down as the building of its kind; one that stays aboard is refused', () => {
  const landed = settled();
  const campaign = { ...landed, parts: { quarters: 1, 'bastion-cargo': 2, corridor: 2 } };
  const plan = buildPlan(campaign, rules, { part: 'quarters' }, { x: 0, y: 0, rot: 1 });
  assert.deepEqual([plan.ok, plan.from, plan.name, plan.cost, plan.gives.beds, plan.makes], [true, 'hold', 'Barracks', 0, 4, null]);
  const set = build(campaign, rules, { part: 'quarters' }, { x: 0, y: 0, rot: 1 });
  assert.deepEqual(set.campaign.colony.buildings, [{ uid: 1, type: 'quarters', x: 0, y: 0, rot: 1 }]);
  assert.deepEqual(set.campaign.parts, { 'bastion-cargo': 2, corridor: 2 });
  assert.deepEqual([set.campaign.colony.materials, set.campaign.flags.partsSetDown], [20, 1]);
  assert.deepEqual(set.campaign.ship, campaign.ship);
  // A maker's version stands as the same building, with its own numbers.
  const hold = build(set.campaign, rules, { part: 'bastion-cargo' });
  assert.deepEqual([hold.plan.name, hold.campaign.colony.buildings[1].type, hold.campaign.parts['bastion-cargo']], ['Storehouse', 'bastion-cargo', 1]);
  // What stays aboard, what isn't in the hold, and what is unknown.
  assert.deepEqual(buildPlan(campaign, rules, { part: 'corridor' }), { ok: false, error: 'Stays aboard: no use to the colony.' });
  assert.deepEqual(buildPlan(campaign, rules, { part: 'medbay' }), { ok: false, error: "There's no med bay in the hold." });
  assert.deepEqual(buildPlan({ ...campaign, parts: { fusion: 1 } }, rules, { part: 'fusion' }), { ok: false, error: 'That part is unknown.' });
  // The build list's hold rows, in the hold's order.
  const { hold: rows } = buildList(campaign, rules);
  assert.deepEqual(rows.map((row) => [row.type, row.count, row.ok, row.name]), [['quarters', 1, true, 'Barracks'], ['bastion-cargo', 2, true, 'Storehouse'], ['corridor', 2, false, null]]);
  assert.equal(rows[2].error, 'Stays aboard: no use to the colony.');
});

test("one of the ship's parts is given where the player puts it, with M26's refusals", () => {
  const campaign = settled();
  const uid = uidOf(campaign, 'quarters');
  const given = build(campaign, rules, { uid }, { x: 6, y: 6, rot: 1 });
  assert.equal(given.ok, true, given.error);
  assert.deepEqual(given.campaign.colony.buildings, [{ uid: 1, type: 'quarters', x: 6, y: 6, rot: 1 }]);
  assert.equal(given.campaign.ship.modules.some((m) => m.uid === uid), false);
  assert.deepEqual([given.plan.from, given.plan.name, given.campaign.flags.partsGiven], ['ship', 'Barracks', 1]);
  // Where it can't stand, nothing comes off.
  const next = given.campaign;
  const life = uidOf(next, 'lifesupport');
  assert.deepEqual(buildPlan(next, rules, { uid: life }, { x: 8, y: 6, rot: 0 }), { ok: false, error: 'Too close to the barracks: every building needs a cell of path round it.' });
  assert.deepEqual(buildPlan(next, rules, { uid: uidOf(next, 'bridge') }, { x: 0, y: 0, rot: 0 }), { ok: false, error: 'Stays aboard: no use to the colony.' });
  // A ship already past flying (its engines refitted off) can still give
  // what breaks nothing more.
  const engines = next.ship.modules.filter((m) => m.type === 'engine').map((m) => m.uid);
  const broken = { ...next, ship: { ...next.ship, modules: next.ship.modules.filter((m) => !engines.includes(m.uid)) } };
  assert.deepEqual(shipChecklist(broken, rules).filter((line) => !line.ok).map((line) => line.id), ['thrust', 'parts']);
  assert.equal(buildPlan(broken, rules, { uid: life }).ok, true);
  assert.match(buildPlan(broken, rules, { uid: uidOf(broken, 'reactor') }).error, /^The ship couldn't fly without it: power/);
});

test('any building moves and turns, keeping its uid and its place in the order', () => {
  let campaign = build(settled(), rules, farm, { x: 0, y: 0, rot: 0 }).campaign;
  campaign = build(campaign, rules, { uid: uidOf(campaign, 'quarters') }, { x: 4, y: 0, rot: 0 }).campaign;
  const [farmUid, barracks] = campaign.colony.buildings.map((b) => b.uid);
  // A move where it overlaps only itself is fine.
  const moved = moveBuilding(campaign, rules, barracks, { x: 5, y: 0, rot: 0 });
  assert.equal(moved.ok, true, moved.error);
  assert.deepEqual(moved.campaign.colony.buildings, [{ uid: farmUid, type: 'farm', x: 0, y: 0, rot: 0 }, { uid: barracks, type: 'quarters', x: 5, y: 0, rot: 0 }]);
  assert.equal(moved.campaign.colony.nextUid, campaign.colony.nextUid);
  // Turned about its middle: 3 by 2 becomes 2 by 3.
  const spot = turnedSpot(rules, 'quarters', { x: 5, y: 0, rot: 0 });
  assert.deepEqual(spot, { x: 5, y: 0, rot: 1 });
  const turned = moveBuilding(moved.campaign, rules, barracks, spot);
  assert.deepEqual(turned.campaign.colony.buildings[1], { uid: barracks, type: 'quarters', x: 5, y: 0, rot: 1 });
  // Turned at the grid's edge, it slides back onto it.
  assert.deepEqual(turnedSpot(rules, 'quarters', { x: 17, y: 10, rot: 0 }), { x: 17, y: 9, rot: 1 });
  // Refusals: where it stands, onto another, too close, no such building.
  assert.deepEqual(movePlan(campaign, rules, barracks, { x: 4, y: 0, rot: 0 }), { ok: false, error: 'The barracks stands there already.' });
  assert.deepEqual(movePlan(campaign, rules, barracks, { x: 1, y: 0, rot: 0 }), { ok: false, error: 'The farm stands there.' });
  assert.deepEqual(movePlan(campaign, rules, barracks, { x: 2, y: 2, rot: 0 }), { ok: false, error: 'Too close to the farm: every building needs a cell of path round it.' });
  assert.deepEqual(movePlan(campaign, rules, 99, { x: 9, y: 9, rot: 0 }), { ok: false, error: "There's no such building." });
  // The order it was built in stands: the barracks still takes its power
  // second.
  assert.deepEqual(colonyStats(turned.campaign, rules).buildings.map((b) => b.uid), [farmUid, barracks]);
  // Through the game.
  const state = { ...initialState(1), screen: 'colony', campaign };
  assert.deepEqual(reduce(state, { type: 'campaign/move', uid: barracks, placement: { x: 5, y: 0, rot: 0 }, rules }).campaign, moved.campaign);
  assert.equal(reduce(state, { type: 'campaign/move', uid: barracks, placement: { x: 1, y: 0, rot: 0 }, rules }), state);
});

test('a building comes down: a part back into the hold, a farm or a mine giving back its materials up to the stores', () => {
  let campaign = settled();
  campaign = build(campaign, rules, farm).campaign;
  campaign = build(campaign, rules, { uid: uidOf(campaign, 'quarters') }).campaign;
  const [farmUid, barracks] = campaign.colony.buildings.map((b) => b.uid);
  const plan = takeDownPlan(campaign, rules, barracks);
  assert.deepEqual(plan, { ok: true, uid: barracks, type: 'quarters', name: 'Barracks', back: { part: 'quarters' }, darkens: [] });
  const down = takeDown(campaign, rules, barracks);
  assert.deepEqual(down.campaign.parts, { ...campaign.parts, quarters: 1 });
  assert.deepEqual(down.campaign.colony.buildings.map((b) => b.uid), [farmUid]);
  assert.equal(down.campaign.flags.takenDown, 1);
  // The part taken down can go back aboard: a refit at the colony.
  assert.equal(canRefit(down.campaign, rules), true);
  const placed = applyCommand(down.campaign.ship, rules, { op: 'place', type: 'quarters', x: 14, y: 3, rot: 0 });
  assert.equal(placed.ok, true, placed.message);
  const refitted = refitShip(down.campaign, placed.ship, rules);
  assert.notEqual(refitted, down.campaign);
  assert.equal(refitted.parts.quarters, undefined);
  // A farm's materials come back, as far as the stores take them.
  assert.deepEqual(takeDownPlan(campaign, rules, farmUid).back, { materials: 10, kept: 10 });
  assert.equal(takeDown(campaign, rules, farmUid).campaign.colony.materials, 20);
  const nearlyFull = { ...campaign, colony: { ...campaign.colony, materials: 26 } };
  assert.deepEqual(takeDownPlan(nearlyFull, rules, farmUid).back, { materials: 10, kept: 4 });
  assert.equal(takeDown(nearlyFull, rules, farmUid).campaign.colony.materials, 30);
  // What it would leave dark: a generator's power, then the barracks.
  const generator = { ...campaign, parts: { smallreactor: 1, shieldarray: 1 } };
  let lit = build(generator, rules, { part: 'smallreactor' }).campaign;
  lit = build(lit, rules, { part: 'shieldarray' }).campaign;
  const plant = lit.colony.buildings.find((b) => b.type === 'smallreactor').uid;
  assert.deepEqual(takeDownPlan(lit, rules, plant).darkens, ['Shield array']);
  // Refusals.
  assert.deepEqual(takeDownPlan(campaign, rules, 99), { ok: false, error: "There's no such building." });
  const { colony, ...run } = campaign;
  assert.deepEqual(takeDownPlan({ ...run, act: 2, colony: null }, rules, farmUid), { ok: false, error: 'Buildings are taken down at the colony.' });
  const state = { ...initialState(1), screen: 'colony', campaign };
  assert.deepEqual(reduce(state, { type: 'campaign/takedown', uid: barracks, rules }).campaign, down.campaign);
  assert.equal(reduce(state, { type: 'campaign/takedown', uid: 99, rules }), state);
});

test('the landed ship refits at the colony: wrecked parts stay, a ship past flying shows it, and power going short darkens buildings', () => {
  const campaign = settled();
  assert.equal(canRefit(campaign, rules), true);
  assert.equal(canRefit({ ...campaign, place: 'fight' }, rules), false);
  // A corridor from the hold fitted.
  const fitted = applyCommand(campaign.ship, rules, { op: 'place', type: 'corridor', x: 20, y: 2, rot: 0 }).ship;
  const refit = refitShip(campaign, fitted, rules);
  assert.deepEqual(refit.parts, { corridor: 1 });
  // A wrecked part can't come off.
  const quarters = uidOf(campaign, 'quarters');
  const wrecked = { ...campaign, wrecks: { [quarters]: 'fire' } };
  assert.equal(refitShip(wrecked, applyCommand(campaign.ship, rules, { op: 'remove', uid: quarters }).ship, rules), wrecked);
  // Refitted past flying: the flight checks say so (nobody aboard).
  const engines = campaign.ship.modules.filter((m) => m.type === 'engine').map((m) => m.uid);
  const grounded = refitShip(campaign, { ...campaign.ship, modules: campaign.ship.modules.filter((m) => !engines.includes(m.uid)) }, rules);
  assert.equal(grounded.parts.engine, 3);
  assert.deepEqual(shipChecklist(grounded, rules).filter((line) => line.ok !== true).map((line) => line.id), ['thrust', 'parts']);
  // The barracks runs on the ship's spare power (2, the quarters' own
  // freed): a shield generator fitted aboard takes it, and the barracks
  // goes dark.
  const housed = build(campaign, rules, { uid: quarters }).campaign;
  assert.deepEqual([colonyStats(housed, rules).power.ship, colonyStats(housed, rules).buildings.map((b) => b.powered)], [2, [true]]);
  const armed = { ...housed, parts: { shield: 1 } };
  const gunned = refitShip(armed, applyCommand(armed.ship, rules, { op: 'place', type: 'shield', x: 20, y: 4, rot: 0 }).ship, rules);
  assert.notEqual(gunned, armed);
  assert.deepEqual(colonyStats(gunned, rules).buildings.map((b) => b.powered), [false]);
  assert.deepEqual(spotFor(gunned.colony, 'farm', rules) !== null, true);
});
