// A colony layout that matters (M54): neighbours that give (a mine by a
// machine shop, a farm by an air plant, a storehouse by a farm or a mine),
// shown on the ghost and the buildings; and survivors from an event who
// settle at the colony a voyage flew from.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colonyStats } from '../src/sim/colony.js';
import { applyEffects } from '../src/sim/events.js';
import { gainsOf, ghostNeighbours, kindOf, neighbourGains, nextTo } from '../src/sim/neighbours.js';
import { settleSurvivors } from '../src/sim/settlers.js';
import { voyageOut } from '../src/sim/voyage.js';
import { placeText } from '../src/ui/campaign/colonyText.js';
import { changesText, effectsText } from '../src/ui/campaign/eventText.js';
import { ghostNearText, nearLine, namesOf } from '../src/ui/campaign/neighbourText.js';
import { buildPlan } from '../src/sim/colonyBuild.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const at = (list) => list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
function withBuildings(campaign, list) {
  const buildings = at(list);
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

// A reactor in the far corner to light them. Mine 2 stands a path from the
// machine shop (3), mine 4 at its corner, mine 5 two cells off; farm 6 a
// path from the air plant (7); the storehouse (8) a path under the farm.
const LAYOUT = [['reactor', 17, 9], ['mine', 0, 0], ['workshop', 3, 0], ['mine', 6, 3], ['mine', 0, 4], ['farm', 10, 0], ['lifesupport', 13, 0], ['cargo', 10, 3]];

test('neighbours: only the path between, side or corner; the kinds by build and by base part', () => {
  const b = at(LAYOUT);
  assert.equal(nextTo(b[1], b[2], rules), true, 'a cell of path between, side by side');
  assert.equal(nextTo(b[3], b[2], rules), true, 'a cell of path between, at the corner');
  assert.equal(nextTo(b[4], b[2], rules), false, 'two cells off');
  assert.equal(nextTo(b[4], b[1], rules), false);
  assert.equal(kindOf('farm', rules), 'farm');
  assert.equal(kindOf('kestrel-cargo', rules), 'cargo');
  assert.deepEqual(rules.colony.neighbours.map((rule) => rule.id), ['pithead', 'fresh-air', 'stores']);
});

test('a mine by a machine shop digs 1 more, a farm by an air plant grows 1 more, a storehouse by a farm or a mine holds 10 more; once each, and a dark partner gives nothing', () => {
  const colony = withBuildings(settled(), LAYOUT);
  const stats = colonyStats(colony, rules);
  const byUid = new Map(stats.buildings.map((b) => [b.uid, b]));
  const plain = byUid.get(5).makes.materials;
  assert.equal(byUid.get(2).makes.materials, plain + 1);
  assert.equal(byUid.get(4).makes.materials, plain + 1);
  assert.deepEqual(byUid.get(2).near.map((gain) => [gain.rule, gain.by]), [['pithead', 3]]);
  const bare = colonyStats(withBuildings(settled(), [['reactor', 17, 9], ['farm', 10, 0]]), rules).buildings[1].makes.food;
  assert.equal(byUid.get(6).makes.food, bare + 1);
  assert.equal(byUid.get(8).gives.storage, rules.modules.get('cargo').stats.cargo + 10);
  // The colony's sums carry them.
  const without = colonyStats(withBuildings(settled(), LAYOUT.filter(([type]) => type !== 'workshop')), rules);
  assert.equal(stats.made.materials - without.made.materials, 3 * rules.colony.buildings.get('workshop').effects.mines + 2);
  // Two machine shops by one mine: still 1 more.
  const two = at([...LAYOUT, ['workshop', 0, 7]]);
  assert.equal(gainsOf(two[4], two, rules).length, 1);
  // A dark partner gives nothing.
  const b = at(LAYOUT);
  assert.deepEqual(gainsOf(b[1], b, rules, (uid) => uid !== 3), []);
  assert.equal(neighbourGains(b, rules).get(5).length, 0);
});

test("the ghost's line says what it gains where it stands and what it gives the buildings round it", () => {
  const colony = withBuildings(settled(), [['reactor', 17, 9], ['workshop', 3, 0], ['farm', 10, 0]]);
  const mine = ghostNeighbours(colony.colony.buildings, { uid: null, type: 'mine', x: 7, y: 0, rot: 0 }, rules);
  assert.deepEqual(mine.gains.map((gain) => [gain.rule, gain.by]), [['pithead', 2]]);
  const store = ghostNeighbours(colony.colony.buildings, { uid: null, type: 'cargo', x: 10, y: 3, rot: 0 }, rules);
  assert.deepEqual(store.gains.map((gain) => gain.rule), ['stores']);
  assert.deepEqual(ghostNeighbours(colony.colony.buildings, { uid: null, type: 'mine', x: 0, y: 6, rot: 0 }, rules), { gains: [], gives: [] });
  // A farm set down by a storehouse gives it 10 more.
  const stored = withBuildings(settled(), [['reactor', 17, 9], ['cargo', 10, 3]]);
  const farm = ghostNeighbours(stored.colony.buildings, { uid: null, type: 'farm', x: 10, y: 0, rot: 0 }, rules);
  assert.deepEqual(farm.gives.map(({ uid, gain }) => [uid, gain.rule]), [[2, 'stores']]);
  // In words.
  assert.equal(ghostNearText(colony, rules, { uid: null, type: 'mine', x: 7, y: 0, rot: 0 }), ' By the machine shop: +1 materials.');
  assert.equal(ghostNearText(stored, rules, { uid: null, type: 'farm', x: 10, y: 0, rot: 0 }), ' The storehouse by it: stores +10.');
  const plan = buildPlan(colony, rules, { build: 'mine' }, { x: 7, y: 0, rot: 0 });
  assert.equal(plan.ok, true, plan.error);
  assert.match(placeText(plan, { near: ' By the machine shop: +1 materials.' }).text, /: materials \+\d a day\. By the machine shop: \+1 materials\. Tap it again to build it/);
  // A building's row names what its neighbours give it.
  const stats = colonyStats(withBuildings(settled(), LAYOUT), rules);
  assert.equal(nearLine(stats.buildings[1], namesOf(stats)), '+1 materials by the machine shop');
  assert.equal(nearLine(stats.buildings[7], namesOf(stats)), 'stores +10 by the farm');
});

test('survivors from an event settle at the colony a voyage flew from, as far as its beds and air go; elsewhere they are set down at the next station', () => {
  const roomy = withBuildings(settled(), [['farm', 4, 0], ['mine', 7, 0], ['farm', 10, 0], ['solar', 13, 0], ['shelter', 4, 4], ['shelter', 7, 4], ['shelter', 10, 4]]);
  const flown = voyageOut({ ...roomy, supplies: 30 }, rules, [1, 2]).campaign;
  const free = colonyStats(flown, rules).citizens.free;
  assert.ok(free >= 2, `room for ${free}`);
  const two = settleSurvivors(flown, rules, 2);
  assert.deepEqual([two.settled, two.home, two.campaign.colony.citizens, two.campaign.flags.survivorsSettled], [2, true, 2, 2]);
  assert.deepEqual(two.campaign.colony.news.map((entry) => [entry.kind, entry.citizens]), [['settled', 1], ['settled', 2]]);
  // Past the room, the rest go their way.
  const crowded = { ...flown, colony: { ...flown.colony, citizens: free - 1 } };
  assert.equal(settleSurvivors(crowded, rules, 2).settled, 1);
  assert.equal(settleSurvivors({ ...flown, colony: { ...flown.colony, citizens: free } }, rules, 2).settled, 0);
  // Landed at home or before act 3: nobody settles.
  assert.deepEqual([settleSurvivors(roomy, rules, 2).settled, settleSurvivors(roomy, rules, 2).home], [0, false]);
  // The event's effect does it, and says so.
  const applied = applyEffects(flown, rules, { credits: 20, settlers: 2 });
  assert.deepEqual(applied.changes.settlers, { came: 2, settled: 2, home: true });
  assert.match(changesText(applied.changes, applied.campaign, rules), /All 2 settle at Copperhill: 2 citizens more\./);
  assert.match(effectsText({ settlers: 2 }, flown, rules), /2 survivors to settle at Copperhill/);
  const away = applyEffects(roomy, rules, { settlers: 1 });
  assert.match(changesText(away.changes, away.campaign, rules), /The survivor is set down at the next station\./);
  // Five rescues carry them.
  const carrying = [...rules.events.values()].filter((event) => event.choices.some((choice) => choice.outcomes.some((outcome) => outcome.effects.settlers)));
  assert.deepEqual(carrying.map((event) => event.id).sort(), ['burning-barge', 'fever-ship', 'jammed-airlock', 'lifeboat-beacon', 'stalled-miner']);
});

test('the neighbour pairings are checked: kinds that exist, makes or storage, ids once', async () => {
  const { checkColony } = await import('../tools/validate-colony.js');
  const { readData } = await import('../tools/data.js');
  const data = readData();
  const problems = (neighbours) => {
    const found = [];
    checkColony({ ...data.colony, neighbours }, data.modules.modules, (where, what) => found.push(`${where}: ${what}`), data.weapons.weapons);
    return found;
  };
  assert.deepEqual(problems(data.colony.neighbours), []);
  assert.ok(problems([{ id: 'x', who: ['nothing'], by: ['farm'], storage: 5 }]).some((p) => p.includes('who must be')));
  assert.ok(problems([{ id: 'x', who: ['mine'], by: ['farm'], storage: 5, makes: { food: 1 } }]).some((p) => p.includes('makes or storage')));
  assert.ok(problems([{ id: 'x', who: ['mine'], by: ['farm'], storage: 5 }, { id: 'x', who: ['farm'], by: ['mine'], storage: 5 }]).some((p) => p.includes('used twice')));
});

test("building's words name what its neighbours give it", async () => {
  const { build } = await import('../src/sim/colonyBuild.js');
  const { builtText } = await import('../src/ui/campaign/colonyText.js');
  const colony = withBuildings({ ...settled(), colony: { ...settled().colony, materials: 30 } }, [['workshop', 3, 0], ['reactor', 17, 9]]);
  const result = build({ ...colony, colony: { ...colony.colony, materials: 30 } }, rules, { build: 'mine' }, { x: 0, y: 0, rot: 0 });
  assert.equal(result.ok, true, result.error);
  assert.match(builtText(result, rules).text, /^The mine stands at the colony: materials \+\d a day, \+1 materials by the machine shop\. \d+ materials left\.$/);
  assert.doesNotMatch(builtText(result).text, /machine shop/);
});
