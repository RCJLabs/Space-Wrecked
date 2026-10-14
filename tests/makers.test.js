// M23g's second manufacturer (ROADMAP §7): Bastion Arms makes a version of
// every part, on the Yard part's footprint, interior and fittings, with more
// hit points and more mass. Where the game asks for a part, any maker's
// version will do. Saves and codes name parts by id, so neither version
// changes: old ones load with the Yard's parts, and Bastion's round-trip.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUEPRINT_VERSION, decodeBlueprint, encodeBlueprint } from '../src/core/blueprint.js';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { buildShip } from '../src/sim/builder.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { withBases } from '../src/sim/defs.js';
import { baseOf, countOfAny, versionAtHand, versionsOf } from '../src/sim/makers.js';
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

test('Bastion makes every part, M23e\'s included, on its shape: tougher and heavier, and no cheaper', () => {
  assert.deepEqual([...rules.manufacturers.keys()], ['yard', 'bastion']);
  assert.equal(rules.manufacturers.get('bastion').name, 'Bastion Arms');
  assert.equal(parts.length, 21);
  for (const def of parts) {
    assert.deepEqual(versionsOf(rules, def.id), [def.id, `bastion-${def.id}`], def.id);
    const bastion = rules.modules.get(`bastion-${def.id}`);
    assert.equal(baseOf(bastion), def.id);
    for (const key of ['size', 'rotates', 'facesSpace', 'tags', 'interior', 'category', 'glyph', 'damage', 'shield', 'intercept', 'heal']) {
      assert.deepEqual(bastion[key], def[key], `${bastion.id}'s ${key} is its base part's`);
    }
    for (const key of ['power', 'thrust', 'berths', 'lifeSupport', 'cargo']) assert.equal(bastion.stats[key], def.stats[key], `${bastion.id}'s ${key}`);
    assert.ok(bastion.stats.hp > def.stats.hp && bastion.stats.mass > def.stats.mass, `${bastion.id} is tougher and heavier`);
    assert.ok(bastion.cost >= def.cost, `${bastion.id} is no cheaper`);
  }
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

test("saves and codes keep their versions: old ones load with the Yard's parts, and Bastion's parts round-trip", () => {
  assert.equal(SAVE_VERSION, 17);
  assert.equal(BLUEPRINT_VERSION, 4);
  // The example ship's code as main made it before M23g.
  const old = decodeBlueprint('wtb.4.B3N0YXJ0ZXIHcm91bmRlZAVzbGF0ZQNza3kIBmJyaWRnZQdyZWFjdG9yCHF1YXJ0ZXJzCGNvcnJpZG9yBmVuZ2luZQtsaWZlc3VwcG9ydAdhaXJsb2NrBndlYXBvbgsADxkBDBQCCRQDCRwDChwDCxwEBxgFCSAEByAGCyAHDSIAAA.b6db7753', rules);
  assert.ok(old.ok, old.error);
  assert.deepEqual(old.ship.modules.map((m) => m.type), example.map((p) => p.type));
  assert.ok(old.ship.modules.every((m) => rules.modules.get(m.type).manufacturer === 'yard'));
  // The same ship with Bastion's engines, reactor and gun.
  const swap = (type) => (['engine', 'reactor', 'weapon'].includes(type) ? `bastion-${type}` : type);
  const built = buildShip(rules, 'starter', example.map((p) => ({ ...p, type: swap(p.type) })));
  assert.deepEqual(built.rejected, []);
  const back = decodeBlueprint(encodeBlueprint(built.ship), rules);
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.ship.modules.map((m) => m.type), built.ship.modules.map((m) => m.type));
  // A campaign with Bastion's parts fitted and on hand saves and loads.
  const campaign = { ...newCampaign(rules, 5), parts: { 'bastion-engine': 1, corridor: 2 } };
  assert.deepEqual(campaignProblems(campaign), []);
  const state = { ...initialState(), campaign };
  const loaded = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign.parts, { 'bastion-engine': 1, corridor: 2 });
});
