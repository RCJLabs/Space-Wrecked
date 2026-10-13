import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { canLaunch, flightChecklist, partLines } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { deploy } from '../src/sim/deploy.js';
import { generateShip, planParts } from '../src/sim/gen/ship.js';
import { step } from '../src/sim/grid.js';
import { mapFromShip, WRECKS } from '../src/sim/mapFromShip.js';
import { facingSide, footprint, hasTag, placedCells, sideCells } from '../src/sim/modules.js';
import { stepsFrom } from '../src/sim/moves.js';
import { logFor, replay } from '../src/sim/replay.js';
import { walkable } from '../src/sim/terrain.js';
import { renderShip } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';
import { GOLDEN_SHIPS, goldenText } from '../tools/gen-ship.js';

const defs = indexDefs(readData());
const def = (module) => defs.modules.get(module.type);
// Seeds 1 to 100 of every preset, made once for the tests that look at them all.
const fleet = [...defs.ships.keys()].flatMap((id) =>
  Array.from({ length: 100 }, (_, i) => ({ id, seed: i + 1, result: generateShip(defs, id, i + 1) })),
);
const name = ({ id, seed }) => `${id} seed ${seed}`;

test('100 generated ships of each preset all pass the flight checklist', () => {
  assert.equal(fleet.length, 300);
  for (const ship of fleet) {
    const { result } = ship;
    assert.ok(result.ok, `${name(ship)}: ${result.error}`);
    assert.deepEqual(layoutProblems(result.ship, defs), [], name(ship));
    assert.equal(result.crew, defs.ships.get(ship.id).crew);
    const lines = flightChecklist(result.ship, defs, result.crew);
    assert.ok(canLaunch(lines), `${name(ship)}: ${lines.filter((line) => !line.ok).map((line) => line.text).join('; ')}`);
  }
});

test("each ship builds again part by part, and every step keeps the builder's rules", () => {
  for (const ship of fleet) {
    const built = ship.result.ship;
    const again = buildShip(defs, built.frame, built.modules);
    assert.deepEqual(again.rejected, [], name(ship));
    assert.deepEqual({ ...again.ship, hull: built.hull }, built, name(ship));
    // Its build log replays in the builder, and every ship on the way has
    // each part joined to the bridge and nothing facing space blocked (the
    // airlock comes last, so that rule waits for it).
    // A step that gives the hull its style (M23d) changes no part.
    const log = logFor(built);
    const { ships, error } = replay(log, defs, built.frame);
    assert.equal(error, null, name(ship));
    assert.deepEqual(ships.at(-1), built, name(ship));
    for (const [i, partway] of ships.slice(1).entries()) {
      if (log[i].op === 'hull') continue;
      assert.deepEqual(layoutProblems(partway, defs).filter((p) => p.rule !== 'airlock'), [], `${name(ship)}, step ${i + 1}`);
    }
  }
});

test('the same preset and seed always give the same ship, and seeds give different ones', () => {
  assert.deepEqual(generateShip(defs, 'corvette', 42), generateShip(defs, 'corvette', 42));
  assert.deepEqual(generateShip(defs, 'hauler', 'Mary Celeste'), generateShip(defs, 'hauler', 'Mary Celeste'));
  assert.notDeepEqual(generateShip(defs, 'cutter', 1).ship, generateShip(defs, 'cutter', 2).ship);
  for (const id of defs.ships.keys()) {
    const layouts = new Set(fleet.filter((ship) => ship.id === id).map(({ result }) => renderShip(result.ship, defs)));
    assert.ok(layouts.size >= 50, `${id}: only ${layouts.size} different layouts in 100 seeds`);
  }
});

test("the bridge is at the front, and nothing stands in an engine's wake or a gun's line of fire", () => {
  for (const ship of fleet) {
    const { modules } = ship.result.ship;
    const taken = new Set(modules.flatMap((m) => placedCells(def(m), m).map(([x, y]) => `${x},${y}`)));
    const [bridge] = modules;
    assert.ok(hasTag(def(bridge), 'bridge'), `${name(ship)}: the bridge goes in first`);
    const front = bridge.x + footprint(def(bridge), bridge.rot)[0];
    assert.ok([...taken].every((key) => Number(key.split(',')[0]) < front), `${name(ship)}: something is ahead of the bridge`);
    const frame = defs.frames.get(ship.result.ship.frame);
    for (const m of modules) {
      const side = facingSide(def(m), m.rot);
      if (!side) continue;
      for (const [x0, y0] of sideCells(def(m), m, side)) {
        for (let [x, y] = step(x0, y0, side); x >= 0 && y >= 0 && x < frame.width && y < frame.height; [x, y] = step(x, y, side)) {
          assert.ok(!taken.has(`${x},${y}`), `${name(ship)}: (${x}, ${y}) is in line with the ${def(m).facesSpace.what} of ${m.type} ${m.uid}`);
        }
      }
    }
    // Engines blow aft: the exhaust side faces the stern.
    for (const m of modules.filter((m) => hasTag(def(m), 'engine'))) assert.equal(facingSide(def(m), m.rot), 'w');
  }
});

test("a symmetric preset's ships are mirrored about the middle row, most of them all through", () => {
  for (const id of defs.ships.keys()) {
    if (!defs.ships.get(id).symmetric) continue;
    let mirrored = 0;
    for (const ship of fleet.filter((s) => s.id === id)) {
      // Pairs come in twos, so only the parts in the line along the middle
      // row can be odd ones out.
      const counts = new Map();
      for (const m of ship.result.ship.modules) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
      for (const type of ['engine', 'weapon', 'airlock', 'quarters', 'lifesupport', 'armory', 'shield']) {
        assert.equal((counts.get(type) ?? 0) % 2, 0, `${name(ship)}: ${counts.get(type)} ${type}`);
      }
      const rows = renderShip(ship.result.ship, defs).split('\n');
      if (rows.join() !== [...rows].reverse().join()) continue;
      // Guns facing one way above the middle row face the other way below it.
      const facings = ship.result.ship.modules.filter((m) => def(m).facesSpace).map((m) => facingSide(def(m), m.rot));
      const count = (side) => facings.filter((f) => f === side).length;
      assert.equal(count('n'), count('s'), name(ship));
      mirrored++;
    }
    // Where no mirrored place is left for a part, it goes in off true.
    assert.ok(mirrored >= 80, `${id}: ${mirrored} of 100 mirrored`);
  }
});

test('every ship is a boarding map boarders can get round: in at its hatches, on foot to every room', () => {
  const boarders = defs.encounters.get('boarders').enemies;
  for (const ship of fleet) {
    const map = mapFromShip(ship.result.ship, defs, { wrecked: ship.result.wrecked });
    assert.ok(map.hatches.length > 0, name(ship));
    const placed = deploy(map, defs.squad, boarders, defs);
    assert.ok(placed.ok, `${name(ship)}: ${placed.error}`);
    // From the hatches, through the doors, to a floor tile of every room
    // that has one (a gun's room has none). A door the builder puts in
    // front of a locker or machinery can cut a room off; not here.
    const field = { map, doors: [], units: [] };
    const reached = stepsFrom(field, map.hatches.map(({ x, y }) => [x, y]), defs);
    for (const room of map.rooms) {
      const floor = [];
      for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (walkable(field, x, y, defs)) floor.push(`${x},${y}`);
      assert.ok(!floor.length || floor.some((key) => reached.has(key)), `${name(ship)}: the ${room.type} can't be walked to from a hatch`);
    }
  }
});

test('a derelict comes with rooms wrecked, never its bridge or an airlock; the others with none', () => {
  for (const ship of fleet) {
    const { result } = ship;
    const [least, most] = defs.ships.get(ship.id).wrecks ?? [0, 0];
    const wrecks = Object.entries(result.wrecked);
    assert.ok(wrecks.length >= least && wrecks.length <= most, `${name(ship)}: ${wrecks.length} wrecked`);
    for (const [uid, wreck] of wrecks) {
      const room = result.ship.modules.find((m) => m.uid === Number(uid));
      assert.ok(room, `${name(ship)}: no room ${uid}`);
      assert.ok(!hasTag(def(room), 'bridge') && !hasTag(def(room), 'airlock'), `${name(ship)}: ${room.type} wrecked`);
      assert.ok(WRECKS.includes(wreck));
    }
    const map = mapFromShip(result.ship, defs, { wrecked: result.wrecked });
    assert.equal(map.rooms.filter((room) => room.wreck).length, wrecks.length, name(ship));
  }
  assert.ok(fleet.some(({ id, result }) => id === 'hauler' && Object.keys(result.wrecked).length));
});

test("a plan is the preset's counts, topped up with what the flight checklist asks for", () => {
  const gunboat = { id: 'gunboat', name: 'Gunboat', frame: 'starter', crew: 2, beam: [5, 5], symmetric: false, parts: { bridge: 1, weapon: 6, quarters: 1, lifesupport: 1, airlock: 1, engine: 1 } };
  const plan = planParts(defs, gunboat, seedFrom(1));
  assert.ok(plan.ok);
  // Short of power (8 a reactor, 10 used), then of thrust for the reactors'
  // mass: two reactors, then an engine.
  assert.deepEqual(plan.types.slice(0, 11), ['bridge', ...Array(6).fill('weapon'), 'quarters', 'lifesupport', 'airlock', 'engine']);
  assert.deepEqual(plan.types.slice(11), ['reactor', 'reactor', 'engine']);
  const lines = (types) => partLines({ frame: 'starter', modules: types.map((type) => ({ type })) }, defs, gunboat.crew);
  assert.ok(lines(plan.types).every((line) => line.ok));
  assert.ok(!lines(plan.types.slice(0, -1)).every((line) => line.ok));

  // A preset that passes as it is gets just its counts; ranges roll within
  // their bounds.
  const ready = { ...gunboat, parts: { bridge: 1, reactor: 1, engine: 2, airlock: 1, quarters: 1, lifesupport: 1 } };
  assert.deepEqual(planParts(defs, ready, seedFrom(1)).types, ['bridge', 'reactor', 'engine', 'engine', 'airlock', 'quarters', 'lifesupport']);
  for (let seed = 1; seed <= 20; seed++) {
    const types = planParts(defs, { ...ready, parts: { ...ready.parts, corridor: [2, 5] } }, seedFrom(seed)).types;
    const corridors = types.filter((type) => type === 'corridor').length;
    assert.ok(corridors >= 2 && corridors <= 5);
  }

  // Mirrored, a part comes in pairs unless it can sit in the line along the
  // middle row with the way on open: not an engine, gun or airlock (they
  // need a side on space), nor quarters or life support (a crate or locker
  // ends their middle row), but a cargo hold can. (The pairs use more
  // power, so the checklist adds a reactor too.)
  const parts = { bridge: 1, reactor: 1, cargo: 3, engine: 3, weapon: 1, airlock: 1, quarters: 1, lifesupport: 1 };
  const twin = planParts(defs, { ...ready, symmetric: true, parts }, seedFrom(1));
  const count = (type) => twin.types.filter((t) => t === type).length;
  assert.deepEqual(['engine', 'weapon', 'airlock', 'quarters', 'lifesupport', 'cargo', 'reactor'].map(count), [4, 2, 2, 2, 2, 3, 2]);
  assert.ok(partLines({ frame: 'starter', modules: twin.types.map((type) => ({ type })) }, defs, ready.crew).every((line) => line.ok));
});

test('fixed seeds give the golden ships', () => {
  // To change them on purpose: node tools/gen-ship.js --golden, and say so
  // in PROGRESS.md.
  assert.equal(goldenText(defs), readFileSync(GOLDEN_SHIPS, 'utf8'));
});

test("an unknown preset, or one that can't be built, says so", () => {
  assert.deepEqual(generateShip(defs, 'dreadnought', 1), { ok: false, error: 'Unknown ship preset "dreadnought".' });
  const yard = (frame, preset) => ({ ...defs, frames: new Map([...defs.frames, [frame.id, frame]]), ships: new Map([[preset.id, preset]]) });
  const brick = { id: 'brick', name: 'Brick', frame: 'tiny', crew: 4, beam: [5, 5], symmetric: false, parts: { bridge: 1, cargo: 6, reactor: 1, engine: 2, airlock: 1, quarters: 1, lifesupport: 1 } };
  const tiny = { id: 'tiny', name: 'Tiny yard', width: 7, height: 5, maxModules: 40, minThrustToMass: 0.5 };
  assert.deepEqual(generateShip(yard(tiny, brick), 'brick', 1), { ok: false, error: 'No layout for a Brick in 20 tries.' });
  const capped = { ...tiny, width: 24, height: 14, maxModules: 3 };
  assert.deepEqual(generateShip(yard(capped, brick), 'brick', 1), { ok: false, error: 'A Brick needs more than the 3 parts its frame holds.' });
});
