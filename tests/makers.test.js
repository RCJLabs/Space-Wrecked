// The makers (ROADMAP §7): M23g's Bastion Arms makes a version of every
// part, on the Yard part's footprint, interior and fittings, with more hit
// points and more mass; M31's Kestrel Dynamics, of every part that weighs 2
// or more but the reactor, lighter, frailer and dearer; and M31's Scrapline,
// of every part,
// cheaper and frailer, each drawing 1 more power and each reactor making 1
// less. Where the game asks for a part, any maker's version will do. Saves
// and codes name parts by id, so neither version changes: old ones load
// with the Yard's parts, and every maker's round-trip.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUEPRINT_VERSION, decodeBlueprint, encodeBlueprint } from '../src/core/blueprint.js';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { buildShip } from '../src/sim/builder.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { withBases } from '../src/sim/defs.js';
import { baseOf, countOfAny, versionAtHand, versionBy, versionsOf } from '../src/sim/makers.js';
import { initialState, saveData } from '../src/sim/root.js';
import { hangarText } from '../src/ui/campaign/hubText.js';
import { offerText, shopText } from '../src/ui/campaign/shopText.js';
import { rules } from './battleKit.js';
import { readFileSync } from 'node:fs';

const parts = [...rules.modules.values()].filter((def) => def.base === undefined);
const example = JSON.parse(readFileSync(new URL('./fixtures/example-ship.json', import.meta.url), 'utf8')).placements;

test("a maker's version takes everything from its base part but what it changes, its stats over the base's", () => {
  const engine = { id: 'engine', name: 'Engine', glyph: 'E', size: [2, 2], tags: ['engine'], interior: ['##', '..'], manufacturer: 'yard', stats: { power: -1, mass: 3, thrust: 12, hp: 15 }, cost: 200 };
  const [base, version, stray] = withBases([
    engine,
    { id: 'bastion-engine', base: 'engine', manufacturer: 'bastion', name: 'Bastion engine', stats: { mass: 4, hp: 23 }, cost: 220 },
    { id: 'bastion-galley', base: 'galley', manufacturer: 'bastion', name: 'Bastion galley', stats: {}, cost: 1 },
  ]);
  assert.equal(base, engine);
  assert.deepEqual(version, { ...engine, id: 'bastion-engine', base: 'engine', manufacturer: 'bastion', name: 'Bastion engine', stats: { power: -1, mass: 4, thrust: 12, hp: 23 }, cost: 220 });
  assert.equal(stray.size, undefined, 'a version of nothing is left for the validator to name');
});

// What each maker makes, and how its version differs from the Yard's part:
// the stats it changes, and those it keeps.
const LINES = {
  bastion: {
    name: 'Bastion Arms',
    makes: () => true,
    keeps: ['power', 'thrust', 'berths', 'lifeSupport', 'cargo'],
    differs: (made, def) => made.stats.hp > def.stats.hp && made.stats.mass > def.stats.mass && made.cost >= def.cost,
  },
  // About a third less mass, half the hit points (Evan's call, 2026-10-15:
  // the trade has to show on a shielded ship) and a fifth dearer. The four
  // parts that weigh 1 can't get lighter in whole numbers, and it makes no
  // reactor (Evan's call, 2026-10-15): at half the hit points one gun hit
  // disabled every ship that flew one.
  kestrel: {
    name: 'Kestrel Dynamics',
    makes: (def) => def.stats.mass >= 2 && def.id !== 'reactor',
    keeps: ['power', 'thrust', 'berths', 'lifeSupport', 'cargo'],
    differs: (made, def) =>
      made.stats.mass < def.stats.mass && made.stats.mass <= Math.ceil(def.stats.mass * 0.75) &&
      made.stats.hp < def.stats.hp && made.stats.hp <= Math.ceil(def.stats.hp / 2) &&
      made.cost > def.cost && made.cost <= def.cost * 1.25,
  },
  // About a third off the price, a quarter fewer hit points; 1 more power
  // drawn by each part that draws any, and 1 less made by each reactor.
  scrapline: {
    name: 'Scrapline',
    makes: () => true,
    keeps: ['mass', 'thrust', 'berths', 'lifeSupport', 'cargo'],
    differs: (made, def) =>
      made.stats.hp < def.stats.hp && made.cost < def.cost && made.cost <= def.cost * 0.7 &&
      made.stats.power === def.stats.power - (def.stats.power === 0 ? 0 : 1),
  },
};

test("each maker makes its line of parts on the Yard part's shape: Bastion's tougher and heavier, Kestrel's lighter, frailer and dearer, Scrapline's cheaper, frailer and hungrier for power (M23g, M31)", () => {
  assert.deepEqual([...rules.manufacturers.keys()], ['yard', ...Object.keys(LINES)]);
  assert.equal(parts.length, 21);
  const made = Object.fromEntries(Object.keys(LINES).map((maker) => [maker, 0]));
  for (const def of parts) {
    const makers = Object.keys(LINES).filter((maker) => LINES[maker].makes(def));
    assert.deepEqual(versionsOf(rules, def.id), [def.id, ...makers.map((maker) => `${maker}-${def.id}`)], def.id);
    for (const maker of makers) {
      const version = rules.modules.get(`${maker}-${def.id}`);
      assert.equal(baseOf(version), def.id);
      assert.equal(version.manufacturer, maker);
      for (const key of ['size', 'rotates', 'facesSpace', 'tags', 'interior', 'category', 'glyph', 'damage', 'shield', 'intercept', 'heal']) {
        assert.deepEqual(version[key], def[key], `${version.id}'s ${key} is its base part's`);
      }
      for (const key of LINES[maker].keeps) assert.equal(version.stats[key], def.stats[key], `${version.id}'s ${key}`);
      assert.ok(LINES[maker].differs(version, def), `${version.id}: ${JSON.stringify(version.stats)} for ${version.cost}, against ${JSON.stringify(def.stats)} for ${def.cost}`);
      made[maker] += 1;
    }
  }
  assert.deepEqual(made, { bastion: 21, kestrel: 16, scrapline: 21 });
  for (const [maker, line] of Object.entries(LINES)) assert.equal(rules.manufacturers.get(maker).name, line.name);
});

test("a part asked for is any maker's: counted on hand, and the one at hand fitted", () => {
  const onHand = { 'bastion-engine': 2, quarters: 1 };
  const count = (type) => onHand[type] ?? 0;
  assert.equal(countOfAny(rules, 'engine', count), 2);
  assert.equal(countOfAny(rules, 'bastion-engine', count), 2);
  assert.equal(countOfAny(rules, 'reactor', count), 0);
  assert.equal(versionAtHand(rules, 'engine', count), 'bastion-engine');
  assert.equal(versionAtHand(rules, 'quarters', count), 'quarters');
  assert.equal(versionAtHand(rules, 'reactor', count), 'reactor', 'none at hand: the part asked for');
  assert.equal(versionAtHand(rules, 'engine', null), 'engine', 'endless parts (the sandbox): the base part');
  // Every maker's counts (M31).
  const mixed = { 'kestrel-engine': 1, 'scrapline-engine': 2, 'scrapline-reactor': 1 };
  assert.equal(countOfAny(rules, 'engine', (type) => mixed[type] ?? 0), 3);
  assert.equal(versionAtHand(rules, 'reactor', (type) => mixed[type] ?? 0), 'scrapline-reactor');
  assert.deepEqual(versionsOf(rules, 'galley'), ['galley'], 'an unknown part is its own');
});

test("act 1's goal and the shop count either maker's part", () => {
  // No shop stock to start with: the goal lines name an offer when there is one.
  const campaign = { ...withBoard(newCampaign(rules, 77), rules), shop: [] };
  const goal = (c) => hangarText(c, rules).goal.lines.filter((line) => /Engine/.test(line.fix ?? '')).map((line) => line.fix);
  assert.deepEqual(goal(campaign), ['Add 2 × Engine (+12 thrust each): none on hand', 'Add Engine: none on hand']);
  const bastion = { ...campaign, parts: { ...campaign.parts, 'bastion-engine': 2 } };
  assert.deepEqual(goal(bastion), ['Add 2 × Engine (+12 thrust each): 2 on hand', 'Add Engine: 2 on hand']);
  assert.equal(hangarText({ ...bastion, parts: { 'bastion-engine': 1 } }, rules).build, true, 'a Bastion engine on hand is a part to fit');
  // At the shop: the Bastion engine is needed for launch, and the goal line
  // names it where the shop has no Yard engine.
  const stocked = { ...campaign, shop: [{ part: 'cargo', price: 60 }, { part: 'bastion-engine', price: 220 }], credits: 500 };
  const text = shopText(stocked, rules);
  assert.deepEqual(text.stock.map((item) => [item.name, item.needed]), [['Bastion engine', 'Needed for launch: 3, none on hand'], ['Cargo hold', null]]);
  assert.equal(offerText(stocked, rules, 'engine'), "Bastion engine 220 at Dutch's yard");
  assert.equal(offerText({ ...stocked, shop: [...stocked.shop, { part: 'engine', price: 200 }] }, rules, 'engine'), "200 at Dutch's yard", "the Yard's own first");
  assert.match(hangarText({ ...stocked, parts: {} }, rules).hint.text, /Dutch's yard has the Bastion engine the ship needs, for 220/);
  assert.equal(shopText({ ...stocked, parts: { 'bastion-engine': 1 } }, rules).held[0].warn, 'The ship needs the Bastion engine');
});

test("saves and codes keep their versions: old ones load with the Yard's parts, and every maker's parts round-trip", () => {
  // Neither number was bumped for M23g (saves were 17 then) or M31 (23
  // then, since M29's raids); saves are 24 since M32's orders in a fight,
  // and 25 since M32b's ranks.
  assert.equal(SAVE_VERSION, 26);
  assert.equal(BLUEPRINT_VERSION, 4);
  // The example ship's code as main made it before M23g.
  const old = decodeBlueprint('wtb.4.B3N0YXJ0ZXIHcm91bmRlZAVzbGF0ZQNza3kIBmJyaWRnZQdyZWFjdG9yCHF1YXJ0ZXJzCGNvcnJpZG9yBmVuZ2luZQtsaWZlc3VwcG9ydAdhaXJsb2NrBndlYXBvbgsADxkBDBQCCRQDCRwDChwDCxwEBxgFCSAEByAGCyAHDSIAAA.b6db7753', rules);
  assert.ok(old.ok, old.error);
  assert.deepEqual(old.ship.modules.map((m) => m.type), example.map((p) => p.type));
  assert.ok(old.ship.modules.every((m) => rules.modules.get(m.type).manufacturer === 'yard'));
  // The same ship with each maker's engines, reactor and gun (Kestrel makes
  // no reactor: the Yard's stays).
  for (const maker of Object.keys(LINES)) {
    const swap = (type) => (['engine', 'reactor', 'weapon'].includes(type) ? versionBy(rules, type, maker) : type);
    const built = buildShip(rules, 'starter', example.map((p) => ({ ...p, type: swap(p.type) })));
    assert.deepEqual(built.rejected, [], maker);
    const back = decodeBlueprint(encodeBlueprint(built.ship), rules);
    assert.ok(back.ok, back.error);
    assert.deepEqual(back.ship.modules.map((m) => m.type), built.ship.modules.map((m) => m.type));
  }
  // A campaign with every maker's parts fitted and on hand saves and loads.
  const onHand = { 'bastion-engine': 1, 'kestrel-weapon': 1, 'scrapline-reactor': 2, corridor: 2 };
  const campaign = { ...newCampaign(rules, 5), parts: onHand };
  campaign.ship = { ...campaign.ship, modules: campaign.ship.modules.map((m) => (m.type === 'bridge' ? { ...m, type: 'kestrel-bridge' } : m)) };
  assert.ok(campaign.ship.modules.some((m) => m.type === 'kestrel-bridge'));
  assert.deepEqual(campaignProblems(campaign), []);
  const state = { ...initialState(), campaign };
  const loaded = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign.parts, onHand);
  assert.deepEqual(loaded.save.data.campaign.ship, campaign.ship);
});

// Each side's ships and the maker that fits it (M23g's corvettes, M31's
// cutters, runners and haulers).
const SIDES = { corvette: 'bastion', cutter: 'kestrel', runner: 'kestrel', hauler: 'scrapline' };

test("enemy ships fly their side's maker for most of the parts it makes, mirrored pairs alike, their layouts as they were, and still pass their flight checklists (M23g, M31)", async () => {
  const { generateShip } = await import('../src/sim/gen/ship.js');
  const { canLaunch, flightChecklist } = await import('../src/sim/constraints.js');
  const noMakers = { ...rules, ships: new Map([...rules.ships].map(([id, preset]) => [id, { ...preset, makers: undefined }])) };
  const makerOf = (m) => rules.modules.get(m.type).manufacturer;
  const baseType = (m) => baseOf(rules.modules.get(m.type));
  for (const [id, maker] of Object.entries(SIDES)) {
    const preset = rules.ships.get(id);
    assert.deepEqual(Object.keys(preset.makers), [maker], id);
    let theirs = 0;
    let could = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const made = generateShip(rules, id, seed);
      const plain = generateShip(noMakers, id, seed);
      assert.ok(made.ok && plain.ok);
      assert.deepEqual(made, generateShip(rules, id, seed), 'the same seed, the same makers');
      // The same parts in the same places; only some types are the maker's.
      assert.deepEqual(made.ship.modules.map((m) => ({ ...m, type: baseType(m) })), plain.ship.modules);
      assert.deepEqual([made.ship.styling, made.ship.hull, made.wrecked], [plain.ship.styling, plain.ship.hull, plain.wrecked]);
      assert.ok(made.ship.modules.every((m) => [maker, 'yard'].includes(makerOf(m))), `${id} ${seed}: ${maker}'s or the Yard's`);
      // A version that would leave her failing her checklist stays the Yard's.
      assert.ok(canLaunch(flightChecklist(made.ship, rules, preset.crew)), `${id} ${seed} passes her checklist`);
      // A part and its mirror image are one maker's.
      const rows = made.ship.modules.flatMap((m) => [m.y, m.y + (m.rot % 2 ? rules.modules.get(m.type).size[0] : rules.modules.get(m.type).size[1]) - 1]);
      const across = Math.min(...rows) + Math.max(...rows);
      for (const m of made.ship.modules) {
        const h = (m.rot % 2 ? rules.modules.get(m.type).size[0] : rules.modules.get(m.type).size[1]);
        const twin = made.ship.modules.find((o) => o !== m && baseType(o) === baseType(m) && o.x === m.x && o.y === across - m.y - h + 1);
        if (preset.symmetric && twin) assert.equal(makerOf(twin), makerOf(m), `${id} ${seed}: ${m.type} and its mirror`);
      }
      theirs += made.ship.modules.filter((m) => makerOf(m) === maker).length;
      could += made.ship.modules.filter((m) => rules.modules.has(`${maker}-${baseType(m)}`)).length;
    }
    // Most, not all: each part rolls for it.
    assert.ok(theirs / could > 0.5 && theirs / could < 0.95, `${id}: ${theirs} of the ${could} parts ${maker} makes`);
  }
  // The repo tug flies the Yard's.
  assert.equal(rules.ships.get('repotug').makers, undefined);
  for (let seed = 1; seed <= 10; seed++) assert.ok(generateShip(rules, 'repotug', seed).ship.modules.every((m) => makerOf(m) === 'yard'), `repotug ${seed}`);
});

test("Bastion's mass counts in thrust for mass, lift-off included: the launched start ship made by Bastion needs another engine to lift off", async () => {
  const { launchedShip, madeBy } = await import('../tools/approach.js');
  const { flightChecklist } = await import('../src/sim/constraints.js');
  const yard = launchedShip(rules);
  const bastion = madeBy(yard, rules, 'bastion');
  assert.ok(bastion.modules.every((m) => rules.modules.get(m.type).manufacturer === 'bastion'));
  const failing = (ship) => flightChecklist(ship, rules, 3, { liftOff: rules.acts.get(1).liftOff }).filter((line) => line.ok !== true);
  assert.deepEqual(failing(yard), []);
  assert.deepEqual(failing(bastion).map((line) => [line.text, line.add]), [['Thrust 36 for mass 43: 0.84, needs 1.00 to lift off', 'engine']]);
});

test("Scrapline's power counts in the flight checklist: the launched start ship with Scrapline's engines is short of power, and the fix asks for a reactor (M31)", async () => {
  const { launchedShip, madeBy, madeToFly } = await import('../tools/approach.js');
  const { flightChecklist, shipStats } = await import('../src/sim/constraints.js');
  const yard = launchedShip(rules);
  const failing = (ship) => flightChecklist(ship, rules, 3, { liftOff: rules.acts.get(1).liftOff }).filter((line) => line.ok !== true);
  const engines = { ...yard, modules: yard.modules.map((m) => (m.type === 'engine' ? { ...m, type: 'scrapline-engine' } : m)) };
  assert.deepEqual(failing(engines).map((line) => [line.text, line.add]), [['Power −2 (8 made, 10 used)', 'reactor']]);
  // Made all by Scrapline it is 7 short, and its own reactor makes it fly;
  // Kestrel's is lighter, and flies as it is.
  const scrapline = madeBy(yard, rules, 'scrapline');
  assert.equal(shipStats(scrapline, rules).power, -7);
  const flies = madeToFly(yard, rules, 'scrapline');
  assert.deepEqual(flies.modules.slice(yard.modules.length).map((m) => m.type), ['scrapline-reactor']);
  assert.deepEqual(failing(flies), []);
  const kestrel = madeToFly(yard, rules, 'kestrel');
  assert.deepEqual([kestrel.modules.length, shipStats(kestrel, rules).mass, shipStats(yard, rules).mass], [yard.modules.length, 23, 30]);
  assert.deepEqual(failing(kestrel), []);
});
