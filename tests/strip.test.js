// M46: what a won boarding strips off her, picked (strip.js): her working
// parts to pick from, never corridors or wrecks, the dearest first; the
// picks the end panel sends, checked against what she has; her scrap as
// much as she has left working; save v42.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { beginBoarding, endBoarding, giveOrder } from '../src/sim/encounter.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launch } from '../src/sim/launch.js';
import { hasTag } from '../src/sim/modules.js';
import { initialState, reduce } from '../src/sim/root.js';
import { salvageOffer, salvagePool, scrapLeft, strippedParts } from '../src/sim/strip.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const cost = (type) => rules.modules.get(type).cost ?? 0;

test("her pool: every working part but corridors, the dearest first; the offer the dearest that many", () => {
  const { ship, wrecked } = generateShip(rules, 'cutter', CUTTER_SEED);
  const pool = salvagePool(ship, wrecked, rules);
  const working = ship.modules.filter((m) => !(m.uid in wrecked) && !hasTag(rules.modules.get(m.type), 'corridor')).map((m) => m.type);
  assert.deepEqual([...pool].sort(), [...working].sort());
  assert.ok(pool.every((type, i) => i === 0 || cost(pool[i - 1]) >= cost(type)), `${pool}`);
  // A part the volleys broke is out of it.
  const hit = ship.modules.find((m) => m.type === pool[0]);
  assert.equal(salvagePool(ship, { ...wrecked, [hit.uid]: 'fire' }, rules).filter((t) => t === pool[0]).length, pool.filter((t) => t === pool[0]).length - 1);
  assert.deepEqual(salvageOffer(ship, wrecked, 2, rules), { pool, parts: pool.slice(0, 2) });
  assert.deepEqual(salvageOffer(ship, wrecked, 0, rules).parts, []);
});

test('the picks: any of hers, as many as she gives at most; anything else takes the dearest', () => {
  const salvage = { pool: ['bridge', 'weapon', 'weapon', 'airlock'], parts: ['bridge', 'weapon'], credits: 0 };
  assert.deepEqual(strippedParts(salvage, null), ['bridge', 'weapon']);
  assert.deepEqual(strippedParts(salvage, ['weapon', 'weapon']), ['weapon', 'weapon'], 'two of a part she has two of');
  assert.deepEqual(strippedParts(salvage, ['airlock']), ['airlock'], 'fewer than she gives');
  assert.deepEqual(strippedParts(salvage, []), []);
  assert.deepEqual(strippedParts(salvage, ['airlock', 'airlock']), ['bridge', 'weapon'], 'not two of a part she has one of');
  assert.deepEqual(strippedParts(salvage, ['engine']), ['bridge', 'weapon'], 'not a part she has none of');
  assert.deepEqual(strippedParts(salvage, ['bridge', 'weapon', 'airlock']), ['bridge', 'weapon'], 'not more than she gives');
});

test("her scrap: the share of her parts still working, rounded", () => {
  const ship = { modules: [1, 2, 3, 4].map((uid) => ({ uid, type: 'corridor' })) };
  assert.equal(scrapLeft(20, ship, {}), 20);
  assert.equal(scrapLeft(20, ship, { 1: 'fire' }), 15);
  assert.equal(scrapLeft(25, ship, { 1: 'fire', 2: 'breach' }), 13);
  assert.equal(scrapLeft(20, { modules: [] }, {}), 20);
});

// A run whose first node holds the pirate cutter, played until the crew
// boards her: the campaign with the boarding fight begun.
function boardedCutter(extra = {}) {
  const fresh = beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
  const start = jump({ ...fresh, run: { ...fresh.run, sector: { ...sector, nodes } } }, rules, to).campaign;
  for (let seed = 0; seed < 3000; seed++) {
    let at = { ...start, rng: seedFrom(seed) };
    while (!at.run.approach.outcome) at = giveOrder(at, rules, { kind: 'fire', at: 'reactor' }).campaign;
    if (at.run.approach.outcome.kind !== 'boarded') continue;
    const aboard = beginBoarding(at, rules);
    assert.ok(aboard.ok, aboard.error);
    return aboard.campaign;
  }
  throw new Error('No seed boards her');
}
const won = (campaign) => ({ ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, winner: 'crew' } } });

test('a won boarding strips what the player picked, through the reducer; her scrap is what she has left', () => {
  const aboard = boardedCutter({ parts: { corridor: 2 } });
  const { salvage } = aboard.fight.boarding;
  const { them } = aboard.run.approach;
  assert.deepEqual(salvage.pool, salvagePool(them.ship, them.wrecked, rules));
  assert.deepEqual(salvage.parts, salvage.pool.slice(0, rules.ships.get('cutter').salvage));
  const [least, most] = rules.ships.get('cutter').scrap;
  assert.ok(salvage.credits >= scrapLeft(least, them.ship, them.wrecked) && salvage.credits <= scrapLeft(most, them.ship, them.wrecked), `${salvage.credits}`);
  assert.deepEqual(campaignProblems(aboard), []);
  const cheapest = salvage.pool.at(-1);
  const state = { ...initialState(1), campaign: won(aboard), screen: 'campaign-fight' };
  const picked = reduce(state, { type: 'campaign/fight/end', rules, strip: [cheapest] }).campaign;
  assert.equal(picked.parts[cheapest], (aboard.parts[cheapest] ?? 0) + 1);
  assert.equal(picked.credits, aboard.credits + salvage.credits);
  // Without picks, or with ones she can't give, the dearest.
  for (const strip of [undefined, ['no-such-part']]) {
    const dearest = reduce(state, { type: 'campaign/fight/end', rules, strip }).campaign;
    for (const type of salvage.parts) assert.equal(dearest.parts[type], (aboard.parts[type] ?? 0) + salvage.parts.filter((t) => t === type).length);
  }
  assert.deepEqual(endBoarding(won(aboard), rules, [cheapest]).parts, picked.parts);
});

test('save v42: a boarding fight saved before offers the parts it rolled, and takes them', () => {
  assert.equal(SAVE_VERSION, 52);
  const aboard = boardedCutter();
  const { pool, ...rolled } = aboard.fight.boarding.salvage;
  const before = { ...aboard, fight: { ...aboard.fight, boarding: { ...aboard.fight.boarding, salvage: rolled } } };
  const moved = migrate({ version: 41, data: { settings: null, campaign: before } });
  assert.equal(moved.version, 52);
  assert.deepEqual(moved.data.campaign.fight.boarding.salvage, { ...rolled, pool: rolled.parts });
  assert.deepEqual(campaignProblems(moved.data.campaign), []);
  // With no fight on, nothing changes.
  const calm = { settings: null, campaign: { ...aboard, fight: null } };
  assert.deepEqual(migrate({ version: 41, data: calm }).data, calm);
});
