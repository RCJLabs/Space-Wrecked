import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildShip, newShip, removeModule } from '../src/sim/builder.js';
import { canLaunch, flightChecklist, REQUIRED_TAGS, shipStats } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const script = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
const build = (placements) => {
  const { ship, rejected } = buildShip(defs, 'starter', placements);
  assert.deepEqual(rejected, []);
  return ship;
};
const example = () => build(script.placements);
// The example with a cargo hold out in the yard: 3 more mass, so one engine
// short is too little thrust.
const laden = () => build([...script.placements, { type: 'cargo', x: 1, y: 1, rot: 0 }]);
const lines = (ship, crew = defs.balance.startingCrew) => Object.fromEntries(flightChecklist(ship, defs, crew).map((l) => [l.id, l]));
const line = (l) => [l.ok, l.text, l.fix];

test('stats add up the parts, with power split into made and used', () => {
  assert.deepEqual(shipStats(example(), defs), {
    parts: 11, power: 2, powerMade: 8, powerUsed: 6,
    thrust: 24, mass: 27, berths: 4, lifeSupport: 4, cargo: 0, hp: 164,
  });
});

test('the example ship passes all six lines and can launch', () => {
  const checklist = flightChecklist(example(), defs, 4);
  assert.deepEqual(checklist.map((l) => [l.id, l.ok, l.text]), [
    ['power', true, 'Power +2 (8 made, 6 used)'],
    ['thrust', true, 'Thrust 24 for mass 27: 0.89, needs 0.50'],
    ['berths', true, 'Berths 4 of 4 crew'],
    ['lifeSupport', true, 'Life support 4 of 4 crew'],
    ['parts', true, 'Bridge, reactor, engine and airlock on board'],
    ['layout', true, 'Every part joined to the bridge, airlock on the hull edge'],
  ]);
  assert.ok(checklist.every((l) => l.fix === null));
  assert.equal(canLaunch(checklist), true);
});

test('each failing line names its fix', () => {
  const ship = example();
  const noReactor = lines({ ...ship, modules: ship.modules.filter((m) => m.type !== 'reactor') });
  assert.deepEqual(line(noReactor.power), [false, 'Power −6 (0 made, 6 used)', 'Add Reactor (+8 power)']);
  assert.deepEqual(line(noReactor.parts), [false, 'Missing reactor', 'Add Reactor']);

  const heavy = laden();
  const lastEngine = heavy.modules.findLast((m) => m.type === 'engine').uid;
  assert.deepEqual(line(lines(removeModule(heavy, lastEngine)).thrust), [false, 'Thrust 12 for mass 27: 0.44, needs 0.50', 'Add Engine (+12 thrust)']);

  const bigCrew = lines(ship, 9);
  assert.deepEqual(line(bigCrew.berths), [false, 'Berths 4 of 9 crew', 'Add 2 × Crew quarters (+4 berths each)']);
  assert.deepEqual(line(bigCrew.lifeSupport), [false, 'Life support 4 of 9 crew', 'Add 2 × Life support (+4 crew each)']);
  assert.equal(canLaunch(Object.values(bigCrew)), false);
});

test('a fix that adds a part says which part, so the builder can pick it', () => {
  const ship = example();
  const noReactor = lines({ ...ship, modules: ship.modules.filter((m) => m.type !== 'reactor') });
  assert.deepEqual([noReactor.power.add, noReactor.parts.add], ['reactor', 'reactor']);
  const empty = lines(newShip('starter'));
  assert.deepEqual([empty.thrust.add, empty.berths.add, empty.lifeSupport.add, empty.parts.add], ['engine', 'quarters', 'lifesupport', 'bridge']);
  const turned = { ...ship, modules: ship.modules.map((m) => (m.type === 'weapon' ? { ...m, rot: 0 } : m)) };
  assert.equal(lines(turned).layout.ok, false);
  assert.equal(lines(turned).layout.add, null, 'a layout is fixed by moving parts, not adding one');
  assert.ok(flightChecklist(ship, defs, 4).every((l) => l.add === null), 'passing lines add nothing');
});

test('the engine count in a thrust fix allows for each engine\'s own mass', () => {
  // 24 mass and no engines: one engine gives 12 for 27 (0.44), two give 24 for 30.
  const ship = laden();
  const noEngines = { ...ship, modules: ship.modules.filter((m) => m.type !== 'engine') };
  assert.deepEqual(line(lines(noEngines).thrust), [false, 'No thrust', 'Add 2 × Engine (+12 thrust each)']);
});

test('the layout line names parts not joined to the bridge', () => {
  const ship = example();
  const weapon = ship.modules.find((m) => m.type === 'weapon');
  const away = { ...ship, modules: ship.modules.map((m) => (m === weapon ? { ...m, x: 20, y: 2 } : m)) };
  assert.deepEqual(line(lines(away).layout), [
    false,
    '1 part not joined to the bridge',
    'Join Weapon mount at (20, 2) to the bridge: rooms join where they share a wall',
  ]);
});

test('the layout line names an exhaust or barrel that does not face space', () => {
  const ship = example();
  // Turned back to point north, the gun points into the reactor.
  const turned = { ...ship, modules: ship.modules.map((m) => (m.type === 'weapon' ? { ...m, rot: 0 } : m)) };
  assert.deepEqual(line(lines(turned).layout), [false, 'Weapon mount barrel blocked', 'Move Weapon mount at (13, 8) so its barrel faces space']);
  // A corridor from the quarters round to right behind the first engine's
  // exhaust: joined, but in the way.
  const run = [[6, 5], [7, 5], [8, 5], [6, 6]].map(([x, y]) => ({ type: 'corridor', x, y, rot: 0 }));
  const plugged = build([...script.placements, ...run]);
  assert.deepEqual(line(lines(plugged).layout), [false, 'Engine exhaust blocked', 'Move Engine at (7, 6) so its exhaust faces space']);
});

test('an airlock with no side open to space fails the layout line', () => {
  // Corridors all around the airlock at (2, 1) to (3, 1); the bridge joins on the east.
  const ring = [[1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2]];
  const ship = build([
    ...ring.map(([x, y]) => ({ type: 'corridor', x, y, rot: 0 })),
    { type: 'airlock', x: 2, y: 1, rot: 0 },
    { type: 'bridge', x: 5, y: 0, rot: 0 },
  ]);
  assert.deepEqual(line(lines(ship).layout), [false, 'No airlock on the hull edge', 'Move an airlock to the edge of the hull, with a side open to space']);
});

test('a part saved past the edge of the build area keeps its place but cannot launch', () => {
  const ship = example();
  const odd = { ...ship, modules: [...ship.modules, { uid: 12, type: 'cargo', x: 22, y: 0, rot: 0 }], nextUid: 13 };
  // It is also cut off from the bridge, hence "+1 more".
  assert.deepEqual(line(lines(odd).layout), [false, 'Cargo hold at (22, 0) sticks out of the build area (+1 more)', 'Move it inside the build area, or remove it']);
  assert.deepEqual(odd.modules.at(-1), { uid: 12, type: 'cargo', x: 22, y: 0, rot: 0 });
});

test('an empty ship fails what it lacks, and the layout waits for a bridge', () => {
  const empty = lines(newShip('starter'));
  assert.deepEqual(line(empty.power), [true, 'Power 0 (0 made, 0 used)', null]);
  assert.deepEqual(line(empty.thrust), [false, 'No thrust', 'Add Engine (+12 thrust)']);
  assert.deepEqual(line(empty.parts), [false, 'Missing bridge, reactor, engine and airlock', 'Add Bridge, Reactor, Engine and Airlock']);
  assert.deepEqual(line(empty.layout), [null, 'Joins are checked once there is a bridge', null]);
  assert.equal(canLaunch(Object.values(empty)), false, 'a line still waiting blocks launch too');
});

test('every failing line names a fix, at every stage of a build and for any crew', () => {
  const ship = example();
  const stages = script.placements.map((_, n) => build(script.placements.slice(0, n)));
  const singlesRemoved = ship.modules.map((m) => removeModule(ship, m.uid));
  for (const stage of [...stages, ...singlesRemoved]) {
    for (const crew of [1, 4, 9]) {
      for (const l of flightChecklist(stage, defs, crew)) {
        assert.ok(l.text, l.id);
        if (l.ok === false) assert.ok(l.fix, `${stage.modules.length} parts, crew ${crew}: ${l.id} "${l.text}" has no fix`);
        else assert.equal(l.fix, null, l.id);
      }
    }
  }
});

test('a part type missing from the data fails the layout line and counts for nothing', () => {
  const ship = example();
  const odd = { ...ship, modules: [...ship.modules, { uid: 99, type: 'teleporter', x: 0, y: 0, rot: 0 }], nextUid: 100 };
  assert.deepEqual(shipStats(odd, defs).thrust, 24);
  // It is also cut off from the bridge, hence "+1 more".
  assert.deepEqual(line(lines(odd).layout), [false, 'Unknown module type "teleporter" (+1 more)', 'Remove it']);
});

test('the thrust minimum holds exactly at the line despite floating point', () => {
  const tiny = indexDefs({
    modules: {
      tilesPerCell: 1,
      tiles: { '.': 'floor' },
      modules: [{ id: 'jet', name: 'Jet', size: [1, 1], rotates: true, tags: [], cost: 1,
        stats: { power: 0, mass: 10, thrust: 7, berths: 0, lifeSupport: 0, cargo: 0, hp: 1 } }],
    },
    frames: { frames: [{ id: 'f', name: 'F', width: 3, height: 3, maxModules: 9, minThrustToMass: 0.7 }] },
    manufacturers: { manufacturers: [] },
    balance: { startingCrew: 1 },
  });
  const ship = { frame: 'f', modules: [{ uid: 1, type: 'jet', x: 0, y: 0, rot: 0 }], nextUid: 2 };
  assert.equal(flightChecklist(ship, tiny, 1)[1].ok, true, '7 thrust for 10 mass meets 0.7');
});

test('the parts the checklist requires all exist in the data', () => {
  for (const tag of REQUIRED_TAGS) assert.ok([...defs.modules.values()].some((d) => d.tags.includes(tag)), tag);
});

test('launch goes ahead only when every line passes, and otherwise names a fix', () => {
  const act = (session) => reduceSession(session, { type: 'build/launch', crew: 4 }, defs);
  const failing = act(createSession(build(script.placements.slice(0, 5))));
  assert.equal(failing.notice.tone, 'bad');
  assert.match(failing.notice.text, /^Can't launch: \d flight checks to fix\. Add .+\.$/);
  const passing = act(createSession(example()));
  assert.deepEqual([passing.notice.tone, passing.notice.text], ['good', 'Every flight check passes: cleared for launch.']);
  const ship = example();
  assert.equal(act(createSession(ship)).ship, ship, 'launch never changes the ship');
});

test('loading a ship replaces the session and starts the history over', () => {
  let s = reduceSession(createSession(newShip('starter')), { type: 'build/drop', placement: { type: 'corridor', x: 0, y: 0, rot: 0 } }, defs);
  const other = example();
  s = reduceSession(s, { type: 'build/load', ship: other }, defs);
  assert.equal(s.ship, other);
  assert.deepEqual([s.past.length, s.future.length, s.selected, s.armed], [0, 0, null, null]);
  assert.equal(reduceSession(s, { type: 'build/load', ship: other }, defs), s, 'the same ship changes nothing');
});
