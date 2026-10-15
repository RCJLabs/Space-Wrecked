// M27: the colony's days. Next day passes one: the farms grow food and the
// mines dig materials by the world's numbers, the crew eats a food each and
// rests, or goes hungry, food and materials are kept up to the stores, and
// the day count rises. Saves from before keep their colony, on day 1.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems, maxHp } from '../src/sim/campaign.js';
import { colonyStats, newColony, storesOf, yieldOf } from '../src/sim/colony.js';
import { dayPlan, MAX_DAYS, nextDay } from '../src/sim/days.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const { regroupHp, hungerHp } = rules.balance;

// The campaign with these buildings at the colony: [type, x, y], each
// turned none, in this order.
function withBuildings(campaign, list) {
  const buildings = list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

test('a day: farms grow food and mines dig materials by the world, the crew eats a food each, and the day count rises', () => {
  const landed = settled();
  // Copperhill, a desert: soil 1, water 0, ore 2. A crew of three.
  assert.deepEqual([landed.colony.world.soil, landed.colony.world.water, landed.colony.world.ore, landed.crew.length], [1, 0, 2, 3]);
  assert.deepEqual([landed.colony.day, landed.colony.materials, landed.supplies], [1, rules.colony.materials, 27]);
  assert.equal(rules.colony.materials, 20);
  const campaign = withBuildings(landed, [['farm', 4, 0], ['mine', 4, 3], ['farm', 7, 0]]);
  const stats = colonyStats(campaign, rules);
  assert.deepEqual(stats.buildings.map((b) => [b.name, b.need, b.powered, b.makes]), [
    ['Farm', 0, true, { food: 1 }],
    ['Mine', 0, true, { materials: 2 }],
    ['Farm', 0, true, { food: 1 }],
  ]);
  assert.deepEqual(stats.made, { food: 2, materials: 2 });
  // Farms and mines take no power: the ship's spare is still there.
  assert.equal(stats.power.spare, colonyStats(landed, rules).power.spare);
  const plan = dayPlan(campaign, rules);
  assert.deepEqual(plan, { ok: true, day: 1, made: { food: 2, materials: 2 }, eats: 3, fed: true, heal: regroupHp, hunger: 0, food: [27, 26], materials: [20, 22], lost: { food: 0, materials: 0 }, stores: 30 });
  const { campaign: after, healed, hurt } = nextDay(campaign, rules);
  assert.deepEqual([after.colony.day, after.supplies, after.colony.materials, healed, hurt], [2, 26, 22, 0, 0]);
  assert.deepEqual(after.flags, { ...campaign.flags, colonyDays: 1, foodGrown: 2, materialsDug: 2 });
  for (const key of ['act', 'place', 'ship', 'parts', 'credits', 'heat', 'run', 'rng', 'wrecks']) assert.deepEqual(after[key], campaign[key], key);
  assert.deepEqual(after.colony.buildings, campaign.colony.buildings);
  assert.deepEqual(campaignProblems(after), []);
  // Thirty days on: food falls by one a day until it runs out, then the
  // crew goes hungry; the materials fill the stores. Nothing is rolled.
  let later = after;
  for (let n = 0; n < 30; n++) later = nextDay(later, rules).campaign;
  assert.deepEqual([later.colony.day, later.supplies, later.colony.materials, later.flags.hungryDays], [32, 0, 30, 4]);
});

test('what a farm and a mine make: the world numbers they make from, added up, and at least one', () => {
  const farm = rules.colony.builds.get('farm');
  const mine = rules.colony.builds.get('mine');
  assert.deepEqual([farm.cost, farm.size, farm.makes, farm.from, mine.cost, mine.size, mine.makes, mine.from], [10, [2, 2], 'food', ['soil', 'water'], 10, [2, 2], 'materials', ['ore']]);
  const world = (soil, water, ore) => ({ kind: 'rock', soil, water, ore, danger: 0, lanes: 1 });
  assert.deepEqual([yieldOf(farm, world(3, 2, 0)), yieldOf(farm, world(0, 3, 1)), yieldOf(farm, world(0, 0, 3)), yieldOf(farm, world(1, 0, 0))], [5, 3, 1, 1]);
  assert.deepEqual([yieldOf(mine, world(3, 3, 3)), yieldOf(mine, world(3, 3, 0))], [3, 1]);
  // On the colony's own world.
  const jungle = settled(2);
  assert.equal(jungle.colony.world.kind, 'jungle');
  assert.deepEqual(colonyStats(withBuildings(jungle, [['farm', 0, 0], ['mine', 3, 0]]), rules).made, { food: 5, materials: 1 });
});

test('a fed crew rests; short of food everyone goes hungry, never below 1, and the infirmary still heals', () => {
  const landed = settled();
  const most = landed.crew.map((member) => maxHp(member, rules));
  const hurt = { ...landed, crew: landed.crew.map((member) => ({ ...member, hp: 2 })) };
  // Fed: a day's regroup.
  const fed = nextDay(hurt, rules);
  assert.deepEqual(fed.campaign.crew.map((member) => member.hp), most.map((hp) => Math.min(hp, 2 + regroupHp)));
  assert.equal(fed.healed, 3 * regroupHp);
  assert.equal(fed.campaign.flags.colonyHealed, 3 * regroupHp);
  // Short of food: hunger, never the last hit point, and no rest.
  const starving = { ...hurt, supplies: 2, crew: [{ ...hurt.crew[0], hp: 1 }, { ...hurt.crew[1], hp: 5 }, hurt.crew[2]] };
  const plan = dayPlan(starving, rules);
  assert.deepEqual([plan.fed, plan.heal, plan.hunger, plan.food, plan.eats], [false, 0, hungerHp, [2, 0], 3]);
  const hungry = nextDay(starving, rules);
  assert.deepEqual(hungry.campaign.crew.map((member) => member.hp), [1, 5 - hungerHp, 1]);
  assert.deepEqual([hungry.hurt, hungry.healed, hungry.campaign.supplies], [0 + hungerHp + 1, 0, 0]);
  assert.deepEqual([hungry.campaign.flags.hungryDays, hungry.campaign.flags.hungerHurt], [1, hungerHp + 1]);
  // A farm's harvest feeds the same day: two food and one grown cover three.
  const harvest = withBuildings(starving, [['farm', 4, 0]]);
  assert.equal(dayPlan(harvest, rules).fed, true);
  assert.equal(nextDay(harvest, rules).campaign.supplies, 0);
  // A powered infirmary heals its rate on top, a medic adding theirs (as to
  // a med bay on the run), and still heals the hungry.
  const ward = withBuildings(hurt, [['medbay', 4, 0]]);
  assert.equal(colonyStats(ward, rules).infirmary, 1);
  assert.ok(ward.crew.some((member) => member.job === 'medic'));
  assert.equal(dayPlan(ward, rules).heal, regroupHp + 1 + 1);
  const hungryWard = { ...ward, supplies: 0, crew: ward.crew.map((member) => ({ ...member, hp: 1 })) };
  assert.deepEqual([dayPlan(hungryWard, rules).heal, dayPlan(hungryWard, rules).hunger], [2, hungerHp]);
  assert.deepEqual(nextDay(hungryWard, rules).campaign.crew.map((member) => member.hp), [3, 3, 3]);
  // A dark infirmary heals nothing: the gun before it takes the power.
  const dark = withBuildings(hurt, [['weapon', 4, 0], ['medbay', 4, 4]]);
  assert.deepEqual([colonyStats(dark, rules).infirmary, dayPlan(dark, rules).heal], [0, regroupHp]);
});

test('food and materials are kept up to the stores, the landed ship holds and the storehouses: the rest is lost', () => {
  const landed = settled();
  assert.deepEqual(storesOf(landed, rules), { ship: 30, colony: 0, total: 30 });
  const full = withBuildings({ ...landed, supplies: 30, colony: { ...landed.colony, materials: 29 } }, [['farm', 4, 0], ['farm', 7, 0], ['farm', 10, 0], ['farm', 13, 0], ['mine', 4, 3]]);
  const plan = dayPlan(full, rules);
  assert.deepEqual([plan.food, plan.materials, plan.lost], [[30, 30], [29, 30], { food: 1, materials: 1 }]);
  const after = nextDay(full, rules).campaign;
  assert.deepEqual([after.supplies, after.colony.materials, after.flags.foodLost, after.flags.materialsLost], [30, 30, 1, 1]);
  // A storehouse keeps 20 more of each.
  const stored = withBuildings(full, [['farm', 4, 0], ['farm', 7, 0], ['farm', 10, 0], ['farm', 13, 0], ['mine', 4, 3], ['cargo', 8, 4]]);
  assert.deepEqual(storesOf(stored, rules), { ship: 30, colony: 20, total: 50 });
  assert.deepEqual(dayPlan(stored, rules).lost, { food: 0, materials: 0 });
  // A refit that took a hold off the ship leaves food past the stores: it
  // is lost at the day's end, after the crew eats.
  const over = { ...landed, supplies: 40 };
  assert.deepEqual([dayPlan(over, rules).food, dayPlan(over, rules).lost.food], [[40, 30], 7]);
});

test('days pass only at the colony, through the game; a save keeps the day', () => {
  const landed = settled();
  const { colony, ...run } = landed;
  assert.deepEqual(dayPlan({ ...run, act: 2, colony: null }, rules), { ok: false, error: 'Days pass at the colony.' });
  assert.deepEqual(dayPlan({ ...landed, place: 'fight' }, rules).ok, false);
  assert.deepEqual(dayPlan({ ...landed, colony: { ...landed.colony, day: MAX_DAYS } }, rules), { ok: false, error: 'The colony has counted all the days it can.' });
  const state = { ...initialState(1), screen: 'colony', campaign: landed };
  const next = reduce(state, { type: 'campaign/day', rules });
  assert.equal(next.screen, 'colony');
  assert.equal(next.campaign.colony.day, 2);
  assert.equal(reduce({ ...state, campaign: { ...run, act: 2, colony: null } }, { type: 'campaign/day', rules }).campaign.act, 2);
  // Quit and reopen on the same day.
  const loaded = parseSave(JSON.stringify(makeSave(saveData(next))));
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, next.campaign);
  // A day or materials a save can't hold.
  const broken = (change) => campaignProblems({ ...landed, colony: { ...landed.colony, ...change } });
  assert.deepEqual(broken({ day: 0 }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ day: 1.5 }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ materials: -1 }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ materials: undefined }), ["The campaign's colony is unreadable."]);
});

test('a v20 save in act 3 opens on day 1 with 20 materials, its buildings standing', () => {
  const now = settled();
  const given = withBuildings(now, [['quarters', 0, 0]]);
  const { day, materials, ...v20colony } = given.colony;
  assert.deepEqual([day, materials], [1, 20]);
  const v20 = { ...given, colony: v20colony };
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  const step = MIGRATIONS.find((s) => s.from === 20);
  assert.deepEqual(step.up(old(v20)).campaign, given);
  // Before settling, and with no campaign, nothing changes.
  const { colony, ...rest } = now;
  const onRun = { ...rest, act: 2, colony: null };
  assert.deepEqual(step.up(old(onRun)).campaign, onRun);
  assert.equal(step.up(old(null)).campaign, null);
  const opened = parseSave(JSON.stringify({ version: 20, data: old(v20) }));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 21);
  const campaign = opened.save.data.campaign;
  assert.equal(campaignScreen(campaign), 'colony');
  assert.deepEqual(campaign.colony, given.colony);
  assert.equal(nextDay(campaign, rules).campaign.colony.day, 2);
  // A new colony starts the same way.
  assert.deepEqual(newColony(now.colony.world, 20), { world: now.colony.world, buildings: [], nextUid: 1, day: 1, materials: 20 });
});
