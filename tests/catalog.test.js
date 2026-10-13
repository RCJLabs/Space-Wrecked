// M23e's catalog (ROADMAP §5): the parts drawer's categories and the part
// variants in data/modules.json. Each new part has its own footprint,
// interior, model and icon; no part is worse than another in every way;
// and the flight checklist's fixes still name the base parts. What each
// does in play is tests/approach.test.js's (the approach) and
// tests/voyage.test.js's (the voyage).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROOFED } from '../src/render/exterior.js';
import { DRAWN as ICONS } from '../src/render/parts/blueprint.js';
import { DRAWN as PROPS } from '../src/render/props.js';
import { buildShip } from '../src/sim/builder.js';
import { newCampaign, partsNeeded } from '../src/sim/campaign.js';
import { partLines } from '../src/sim/constraints.js';
import { ALL, catalogOrder, catalogView, nextSize, SIZES } from '../src/ui/builder/catalog.js';
import { rules } from './battleKit.js';

const defs = [...rules.modules.values()];
// The nine (Evan's pick, 2026-10-13), and the part each varies.
const NEW = { lightengine: 'engine', heavyengine: 'engine', smallreactor: 'reactor', pointdefense: null, cannon: 'weapon', shieldarray: 'shield', bunks: 'quarters', surgery: 'medbay', largehold: 'cargo' };
const BASE = defs.slice(0, 12).map((def) => def.id);

test('the nine new parts come after the base parts, each with its own footprint, interior, model and icon', () => {
  assert.deepEqual(defs.slice(12).map((def) => def.id).sort(), Object.keys(NEW).sort());
  for (const [id, varies] of Object.entries(NEW)) {
    const def = rules.modules.get(id);
    assert.ok(ICONS.includes(id) && PROPS.includes(id) && ROOFED.includes(id), `${id} has a drawing of its own in the drawer, on the plans and outside`);
    // No other part has the same room: footprint and tiles.
    const room = (d) => JSON.stringify([d.size, d.interior]);
    assert.ok(defs.every((other) => other === def || room(other) !== room(def)), `${id}'s room is its own`);
    if (varies) assert.equal(def.category, rules.modules.get(varies).category, `${id} sits with the ${varies}`);
  }
});

// B is worse than A in no way and better in one: it has every tag A has
// (it does what A does), costs no more, takes no more cells, weighs no more,
// draws no more power, has no fewer hit points, gives no less of anything
// (thrust, berths, life support, cargo, a gun's damage, a shield's
// strength, point defense, healing), needs space only where A does, and
// turns where A turns.
function betterInEveryWay(b, a) {
  const at = (def, key) => def.stats[key] ?? def[key] ?? 0;
  const higher = ['power', 'hp', 'thrust', 'berths', 'lifeSupport', 'cargo', 'damage', 'shield', 'intercept', 'heal'];
  const lower = [(def) => def.cost, (def) => def.size[0] * def.size[1], (def) => def.stats.mass, (def) => (def.facesSpace ? 1 : 0), (def) => (def.rotates ? 0 : 1)];
  if (!a.tags.every((tag) => b.tags.includes(tag))) return false;
  if (higher.some((key) => at(b, key) < at(a, key)) || lower.some((of) => of(b) > of(a))) return false;
  return higher.some((key) => at(b, key) > at(a, key)) || lower.some((of) => of(b) < of(a));
}

test('no part is worse than another in every way: cost, size, mass, power, hit points and what it does', () => {
  for (const a of defs) {
    for (const b of defs) assert.ok(a === b || !betterInEveryWay(b, a), `${b.id} beats ${a.id} in every way`);
  }
  // The check finds one where there is one.
  const cheaper = { ...rules.modules.get('cannon'), id: 'bargain', cost: 1 };
  assert.ok(betterInEveryWay({ ...cheaper, stats: { ...cheaper.stats, mass: 1 } }, rules.modules.get('cannon')));
  assert.ok(!betterInEveryWay(rules.modules.get('heavyengine'), rules.modules.get('engine')));
});

test("the checklist's fixes and act 1's goal still ask for the base parts, not their variants", () => {
  // A bridge alone: short of power, thrust, berths and life support.
  const { ship } = buildShip(rules, 'starter', [{ type: 'bridge', x: 10, y: 5, rot: 1 }]);
  const adds = Object.fromEntries(partLines(ship, rules, 4).filter((line) => line.add).map((line) => [line.id, line.add]));
  assert.deepEqual(adds, { power: 'reactor', thrust: 'engine', berths: 'quarters', lifeSupport: 'lifesupport', parts: 'reactor' });
  const needed = Object.keys(partsNeeded(newCampaign(rules, 1), rules));
  assert.ok(needed.length > 0 && needed.every((type) => BASE.includes(type)), `act 1 needs ${needed}`);
});

test("every part is in one of the drawer's categories, in the order they are shown", () => {
  assert.deepEqual(rules.categories.map((category) => category.id), ['command', 'power', 'engines', 'weapons', 'defense', 'crew', 'cargo', 'utility']);
  const ids = new Set(rules.categories.map((category) => category.id));
  for (const def of defs) assert.ok(ids.has(def.category), def.id);
  for (const category of rules.categories) assert.ok(defs.some((def) => def.category === category.id), `${category.id} has parts`);
});

test('the Parts tab: all the parts by category, base parts first; one category; a size; only those on hand', () => {
  const order = catalogOrder(rules);
  assert.deepEqual(order.slice(0, 6), ['bridge', 'reactor', 'smallreactor', 'engine', 'lightengine', 'heavyengine']);
  assert.equal(order.length, rules.modules.size);
  // All, at any size: every part, and each category's count.
  const all = catalogView(rules);
  assert.deepEqual([all.shown, all.empty], [order, null]);
  assert.equal(all.counts[ALL], rules.modules.size);
  for (const { id } of rules.categories) assert.equal(all.counts[id], defs.filter((def) => def.category === id).length, id);
  // One category, then a size within it: the counts follow the size.
  assert.deepEqual(catalogView(rules, { category: 'engines' }).shown, ['engine', 'lightengine', 'heavyengine']);
  const medium = catalogView(rules, { category: 'engines', size: 'medium' });
  assert.deepEqual(medium.shown, ['engine', 'heavyengine']);
  assert.equal(medium.counts[ALL], defs.filter((def) => def.size[0] * def.size[1] > 2 && def.size[0] * def.size[1] <= 6).length);
  assert.deepEqual(catalogView(rules, { size: 'large' }).shown, ['reactor', 'cargo', 'largehold']);
  assert.deepEqual(catalogView(rules, { category: 'command', size: 'small' }), { shown: [], counts: catalogView(rules, { size: 'small' }).counts, empty: 'No parts that size here.' });
  // Construction mode: only what is on hand.
  const onHand = (type) => ({ engine: 3, quarters: 1, corridor: 2 })[type] ?? 0;
  const stocked = catalogView(rules, { onHand });
  assert.deepEqual(stocked.shown, ['engine', 'quarters', 'corridor']);
  assert.deepEqual([stocked.counts.engines, stocked.counts.weapons], [1, 0]);
  assert.equal(catalogView(rules, { category: 'weapons', onHand }).empty, 'Nothing on hand here.');
  assert.equal(catalogView(rules, { onHand: () => 0 }).empty, 'Nothing on hand to fit.');
  // The size filter goes round, a step a tap.
  let size = SIZES[0].id;
  const seen = [];
  for (let i = 0; i < SIZES.length; i++) seen.push((size = nextSize(size)));
  assert.deepEqual(seen, ['small', 'medium', 'large', 'any']);
});
