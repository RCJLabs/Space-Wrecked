// M26: the colony. At act 3's home the ship's useful parts come off one at
// a time and stand on the colony's grid as buildings, laid out by
// themselves; the colony's power, beds and air against what the crew needs,
// buildings taking power in the order given; a powered infirmary heals the
// crew as it opens; and the ship's flight checks count nobody aboard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pick } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand, buildShip } from '../src/sim/builder.js';
import { campaignProblems, crewAboard, maxHp, shipChecklist } from '../src/sim/campaign.js';
import { colonyStats, donate, donatePlan, newColony, shipParts, spotFor } from '../src/sim/colony.js';
import { nextDay } from '../src/sim/days.js';
import { footprint } from '../src/sim/modules.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const site = rules.colony.site;

test('a part given comes off the ship and stands at the colony as the building of its kind', () => {
  const campaign = settled();
  const uid = uidOf(campaign, 'quarters');
  const plan = donatePlan(campaign, rules, uid);
  assert.equal(plan.ok, true, plan.error);
  assert.deepEqual([plan.type, plan.building.name, plan.placement], ['quarters', 'Barracks', { x: 0, y: 0, rot: 0 }]);
  assert.deepEqual(plan.gives, { power: -1, beds: 4, air: 0, storage: 0, heal: 0, damage: 0, shield: 0, intercept: 0, armory: false });
  const { campaign: after } = donate(campaign, rules, uid);
  assert.equal(after.ship.modules.some((module) => module.uid === uid), false);
  assert.equal(after.ship.modules.length, campaign.ship.modules.length - 1);
  assert.deepEqual(after.colony.buildings, [{ uid: 1, type: 'quarters', x: 0, y: 0, rot: 0 }]);
  assert.equal(after.colony.nextUid, 2);
  assert.equal(after.colony.world, campaign.colony.world);
  assert.equal(after.flags.partsGiven, 1);
  for (const key of ['act', 'place', 'crew', 'credits', 'parts', 'heat', 'wrecks', 'run', 'rng', 'supplies']) assert.deepEqual(after[key], campaign[key], key);
  assert.deepEqual(campaignProblems(after), []);
  // Its only berths gone, the ship still flies: nobody is aboard in act 3.
  assert.equal(crewAboard(after), 0);
  assert.equal(crewAboard({ ...after, colony: null }), after.crew.length);
  assert.ok(shipChecklist(after, rules).every((line) => line.ok === true));
  // A maker's version stands as the same building, with its own numbers.
  const bastion = { ...campaign, ship: { ...campaign.ship, modules: campaign.ship.modules.map((m) => (m.uid === uid ? { ...m, type: 'bastion-quarters' } : m)) } };
  const given = donate(bastion, rules, uid);
  assert.deepEqual([given.plan.building.name, given.campaign.colony.buildings[0].type], ['Barracks', 'bastion-quarters']);
});

test('each refusal says why: parts that stay aboard, wrecks, a ship that could not fly, no room, away from the colony', () => {
  const campaign = settled();
  for (const type of ['bridge', 'engine', 'corridor', 'airlock']) {
    assert.deepEqual(donatePlan(campaign, rules, uidOf(campaign, type)), { ok: false, error: 'Stays aboard: no use to the colony.' }, type);
  }
  const quarters = uidOf(campaign, 'quarters');
  assert.deepEqual(donatePlan({ ...campaign, wrecks: { [quarters]: 'fire' } }, rules, quarters), { ok: false, error: "Wrecked: there's nothing left to give." });
  // The one reactor: without it the ship has no power.
  assert.deepEqual(donatePlan(campaign, rules, uidOf(campaign, 'reactor')), { ok: false, error: "The ship couldn't fly without it: power −7 (0 made, 7 used)." });
  // Quarters that join the reactor to the bridge.
  const { ship, rejected } = buildShip(rules, 'starter', [
    { type: 'bridge', x: 10, y: 5, rot: 0 },
    { type: 'quarters', x: 13, y: 5, rot: 0 },
    { type: 'reactor', x: 16, y: 4, rot: 0 },
    { type: 'engine', x: 8, y: 5, rot: 0 },
    { type: 'airlock', x: 10, y: 7, rot: 0 },
  ]);
  assert.deepEqual(rejected, []);
  const joined = { ...campaign, ship, wrecks: {} };
  assert.ok(shipChecklist(joined, rules).every((line) => line.ok === true));
  assert.deepEqual(donatePlan(joined, rules, uidOf(joined, 'quarters')), { ok: false, error: "The ship couldn't fly without it: 1 part not joined to the bridge." });
  // No room: a grid that holds the barracks and nothing else.
  const small = { ...rules, colony: { ...rules.colony, site: { width: 3, height: 2, gap: 1 } } };
  const first = donate(campaign, small, quarters);
  assert.equal(first.ok, true, first.error);
  assert.deepEqual(donatePlan(first.campaign, small, uidOf(campaign, 'lifesupport')), { ok: false, error: "There's no room left on the colony's grid." });
  // Not a part of the ship, or not at the colony.
  assert.deepEqual(donatePlan(campaign, rules, 99), { ok: false, error: "That part isn't on the ship." });
  assert.deepEqual(donatePlan({ ...campaign, act: 2, colony: null }, rules, quarters), { ok: false, error: 'Parts are given at the colony.' });
  // The list the colony shows: every part, with what it would give or why not.
  const parts = shipParts(campaign, rules);
  assert.deepEqual(parts.map((part) => part.uid), campaign.ship.modules.map((module) => module.uid));
  assert.deepEqual(parts.filter((part) => part.ok).map((part) => part.type), ['weapon', 'quarters', 'lifesupport']);
  assert.ok(parts.every((part) => part.ok || part.error));
});

test('buildings are laid out by themselves: the first spot that fits with a path round it, from the edge the ship landed at', () => {
  // By hand: down the first column, then on to the next, each with a cell
  // of path round it.
  let colony = newColony(null);
  const expect = [['reactor', 0, 0], ['quarters', 0, 4], ['lifesupport', 0, 7], ['cargo', 0, 9], ['medbay', 4, 0]];
  for (const [type, x, y] of expect) {
    const spot = spotFor(colony, type, rules);
    assert.deepEqual(spot, { x, y, rot: 0 }, type);
    colony = withBuilding(colony, type, spot);
  }
  // Over many orders: every building on the grid, a path round each, and
  // the same buildings in the same order always in the same places.
  const types = [...rules.colony.buildings.keys()];
  let state = 7;
  for (let n = 0; n < 60; n++) {
    let colony = newColony(null);
    const order = [];
    for (;;) {
      const roll = pick(state, types);
      state = roll.state;
      const spot = spotFor(colony, roll.value, rules);
      if (!spot) break;
      order.push(roll.value);
      colony = withBuilding(colony, roll.value, spot);
    }
    assert.ok(order.length >= 6, `order ${n}: ${order.length} buildings`);
    const boxes = colony.buildings.map((b) => {
      const [w, h] = footprint(rules.modules.get(b.type), b.rot);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + w <= site.width && b.y + h <= site.height, `order ${n}: ${b.type} on the grid`);
      return { x0: b.x, y0: b.y, x1: b.x + w, y1: b.y + h };
    });
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const apart = a.x1 + site.gap <= b.x0 || b.x1 + site.gap <= a.x0 || a.y1 + site.gap <= b.y0 || b.y1 + site.gap <= a.y0;
        assert.ok(apart, `order ${n}: a path between buildings`);
      }),
    );
    let again = newColony(null);
    for (const type of order) again = withBuilding(again, type, spotFor(again, type, rules));
    assert.deepEqual(again, colony, `order ${n}: the same places`);
  }
});

test('what the colony gives: power taken in the order given, the dark ones, beds and air, and who sleeps aboard', () => {
  const campaign = settled();
  // The landed ship makes 8 and uses 7: 1 to spare for the colony.
  const at = (types) => ({ ...campaign, colony: { ...campaign.colony, buildings: types.map((type, i) => ({ uid: i + 1, type, x: 0, y: 0, rot: 0 })), nextUid: types.length + 1 } });
  const stats = colonyStats(at(['quarters', 'lifesupport', 'shieldarray', 'cargo', 'smallreactor']), rules);
  assert.deepEqual(stats.power, { plants: 4, ship: 1, made: 5, used: 2, spare: 3 });
  assert.deepEqual(stats.buildings.map((b) => [b.name, b.need, b.powered]), [
    ['Barracks', 1, true],
    ['Air plant', 1, true],
    ['Shield array', 4, false],
    ['Storehouse', 0, true],
    ['Generator', 0, true],
  ]);
  assert.deepEqual([stats.beds, stats.air, stats.housed, stats.aboard], [4, 4, 3, []]);
  assert.deepEqual([stats.storage, stats.defense, stats.infirmary], [20, { damage: 0, shield: 0, intercept: 0, armories: 0 }, 0]);
  // The shield array given first takes the power the air plant needed:
  // nobody has air, so all three sleep aboard.
  const first = colonyStats(at(['shieldarray', 'quarters', 'lifesupport', 'smallreactor']), rules);
  assert.deepEqual(first.buildings.map((b) => b.powered), [true, true, false, true]);
  assert.deepEqual([first.beds, first.air, first.housed, first.aboard], [4, 0, 0, [1, 2, 3]]);
  assert.equal(first.defense.shield, 25);
  // Bunks bed and breathe for two: the third sleeps aboard.
  const bunks = colonyStats(at(['bunks']), rules);
  assert.deepEqual([bunks.beds, bunks.air, bunks.housed, bunks.aboard], [2, 2, 2, [3]]);
  // Guns, armories and infirmaries, powered; a dark gun guards nothing.
  const guarded = colonyStats(at(['weapon', 'armory', 'surgery', 'pointdefense', 'medbay']), rules);
  assert.deepEqual(guarded.buildings.map((b) => b.powered), [true, true, false, false, false]);
  assert.deepEqual([guarded.defense, guarded.infirmary], [{ damage: 15, shield: 0, intercept: 0, armories: 1 }, 0]);
  const plant = colonyStats(at(['reactor', 'weapon', 'armory', 'surgery', 'pointdefense']), rules);
  // 8 made and 1 from the ship; 1, 2 and 1 taken.
  assert.deepEqual([plant.defense, plant.infirmary, plant.power.spare], [{ damage: 15, shield: 0, intercept: 10, armories: 1 }, 2, 5]);
  // With nothing given, the ship's spare power waits for the colony.
  assert.deepEqual(colonyStats(campaign, rules).power, { plants: 0, ship: 1, made: 1, used: 0, spare: 1 });
});

test('an infirmary heals a day at a time: one opening heals nobody (M28)', () => {
  const campaign = settled();
  const ship = applyCommand(campaign.ship, rules, { op: 'place', type: 'medbay', x: 12, y: 3, rot: 0 }).ship;
  const hurt = { ...campaign, ship, crew: campaign.crew.map((member) => ({ ...member, hp: 3 })) };
  assert.ok(shipChecklist(hurt, rules).every((line) => line.ok === true));
  // M26 healed everyone to full as an infirmary opened, which taking it down
  // and setting it down again could have again; since M28 it doesn't.
  const opened = donate(hurt, rules, uidOf(hurt, 'medbay'));
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(opened.campaign.crew, hurt.crew);
  assert.equal(colonyStats(opened.campaign, rules).infirmary, 1);
  // The day heals a day's rest and the infirmary's heal, the medic adding
  // theirs, up to each one's most.
  const { regroupHp } = rules.balance;
  const day = nextDay(opened.campaign, rules);
  assert.deepEqual(day.campaign.crew.map((member) => member.hp), hurt.crew.map((member) => Math.min(maxHp(member, rules), 3 + regroupHp + 1 + 1)));
});

test('a v19 save in act 3 opens at the colony with no buildings yet and every part still aboard', () => {
  const now = settled();
  const { buildings, nextUid, ...v19colony } = now.colony;
  assert.deepEqual([buildings, nextUid], [[], 1]);
  const v19 = { ...now, colony: v19colony };
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  const step = MIGRATIONS.find((s) => s.from === 19);
  assert.deepEqual(step.up(old(v19)).campaign, now);
  // Before settling, and with no campaign, nothing changes.
  const { colony, ...rest } = now;
  const onRun = { ...rest, act: 2, colony: null };
  assert.deepEqual(step.up(old(onRun)).campaign, onRun);
  assert.equal(step.up(old(null)).campaign, null);
  // Through the front door.
  const opened = parseSave(JSON.stringify({ version: 19, data: old(v19) }));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 20);
  const campaign = opened.save.data.campaign;
  assert.equal(campaignScreen(campaign), 'colony');
  assert.deepEqual(campaign.ship, now.ship);
  assert.deepEqual(campaign.colony.buildings, []);
  assert.equal(donate(campaign, rules, uidOf(campaign, 'quarters')).ok, true);
});

test('a colony with buildings saves and reads back the same; unreadable buildings are caught', () => {
  const campaign = settled();
  const given = donate(donate(campaign, rules, uidOf(campaign, 'quarters')).campaign, rules, uidOf(campaign, 'lifesupport')).campaign;
  const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(3), campaign: given }))));
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, given);
  const unreadable = ["The campaign's colony is unreadable."];
  const [one, two] = given.colony.buildings;
  const broken = (colony) => campaignProblems({ ...given, colony: { ...given.colony, ...colony } });
  assert.deepEqual(broken({ buildings: [one, { ...two, uid: one.uid }] }), unreadable, 'a uid twice');
  assert.deepEqual(broken({ nextUid: 2 }), unreadable, 'a uid past nextUid');
  assert.deepEqual(broken({ buildings: [{ ...one, rot: 5 }] }), unreadable, 'a turn it cannot have');
  assert.deepEqual(broken({ buildings: [{ ...one, x: 1.5 }] }), unreadable, 'half a cell');
  assert.deepEqual(broken({ buildings: null }), unreadable, 'no list');
  assert.deepEqual(broken({ nextUid: undefined }), unreadable, 'no next uid');
});

test('through the game: Give in two taps is the donate action; a refusal changes nothing', () => {
  const campaign = settled();
  const state = { ...initialState(1), screen: 'colony', campaign };
  const given = reduce(state, { type: 'campaign/donate', uid: uidOf(campaign, 'quarters'), rules });
  assert.equal(given.screen, 'colony');
  assert.equal(given.campaign.colony.buildings.length, 1);
  assert.equal(reduce(state, { type: 'campaign/donate', uid: uidOf(campaign, 'bridge'), rules }), state);
  assert.equal(reduce({ ...state, campaign: null }, { type: 'campaign/donate', uid: 1, rules }).campaign, null);
});

// The colony with a building of type at spot, as donate places it.
function withBuilding(colony, type, spot) {
  const uid = colony.nextUid;
  return { ...colony, buildings: [...colony.buildings, { uid, type, ...spot }], nextUid: uid + 1 };
}
