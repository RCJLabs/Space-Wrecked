import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  airlocksOnHullEdge,
  applyCommand,
  blockedFacings,
  buildShip,
  connections,
  layoutProblems,
  moduleAt,
  moveModule,
  newShip,
  openings,
  placeModule,
  placementError,
  reachableFromBridge,
  removeModule,
  rotateModule,
  spaceTest,
  turnedPlacement,
} from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { EXAMPLE_SCRIPT, renderShip, runScript } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

// A tiny catalog for rule tests, so content changes don't break them.
const mod = (id, size, tags = [], rotates = true, facesSpace = undefined) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  size,
  rotates,
  tags,
  ...(facesSpace && { facesSpace }),
});
const defs = indexDefs({
  modules: {
    tilesPerCell: 1,
    tiles: { '.': 'floor' },
    modules: [
      mod('bridge', [1, 1], ['bridge']),
      mod('hall', [1, 1]),
      mod('duct', [1, 1], ['corridor']),
      mod('lock', [1, 1], ['airlock']),
      mod('long', [2, 1]),
      mod('fixed', [1, 2], [], false),
      mod('beam', [3, 1]),
      mod('jet', [1, 1], [], false, { side: 'w', what: 'exhaust' }),
      mod('gun', [1, 1], [], true, { side: 'n', what: 'barrel' }),
    ],
  },
  frames: {
    frames: [
      { id: 'small', name: 'Small frame', width: 4, height: 3, maxModules: 8 },
      { id: 'ring', name: 'Ring frame', width: 3, height: 3, maxModules: 9 },
      { id: 'open', name: 'Open frame', width: 8, height: 8, maxModules: 20 },
      { id: 'shaped', name: 'Shaped frame', width: 4, height: 3, maxModules: 9, shape: ['.##.', '####', '.##.'] },
      { id: 'holed', name: 'Holed frame', width: 5, height: 4, maxModules: 20, shape: ['#####', '#####', '##.##', '#####'] },
      { id: 'window', name: 'Window frame', width: 6, height: 6, maxModules: 20, shape: ['######', '######', '##..##', '##..##', '######', '######'] },
    ],
  },
  manufacturers: { manufacturers: [] },
});

// Builds from [type, x, y, rot] entries and fails the test on any rejection.
function build(frame, entries) {
  const placements = entries.map(([type, x, y, rot = 0]) => ({ type, x, y, rot }));
  const { ship, rejected } = buildShip(defs, frame, placements);
  assert.deepEqual(rejected, []);
  return ship;
}
const rules = (ship) => layoutProblems(ship, defs).map((p) => p.rule);
const place = (ship, type, x, y, rot = 0) => placementError(ship, defs, { type, x, y, rot });

test('placing returns a new ship with the next uid and leaves the old one alone', () => {
  const ship = newShip('small');
  const result = placeModule(ship, defs, { type: 'bridge', x: 0, y: 0, rot: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.uid, 1);
  assert.deepEqual(result.ship.modules, [{ uid: 1, type: 'bridge', x: 0, y: 0, rot: 0 }]);
  assert.equal(result.ship.nextUid, 2);
  assert.deepEqual(ship, newShip('small'));
});

test('bounds: every cell of the footprint must be inside the frame', () => {
  const ship = newShip('small'); // 4 wide, 3 tall
  assert.equal(place(ship, 'long', 2, 0), null, 'flush with the right edge fits');
  assert.equal(place(ship, 'long', 3, 0)?.rule, 'bounds', 'one cell past the right edge');
  assert.equal(place(ship, 'long', -1, 0)?.rule, 'bounds');
  assert.equal(place(ship, 'long', 0, 2, 1)?.rule, 'bounds', 'upright, it runs off the bottom');
  assert.equal(place(ship, 'long', 0, 1, 1), null);
  assert.equal(place(ship, 'hall', 0.5, 0)?.rule, 'bounds', 'positions are whole cells');
});

test('overlap: no cell holds two modules', () => {
  const ship = build('small', [['long', 0, 0]]); // covers (0,0) and (1,0)
  const error = place(ship, 'hall', 1, 0);
  assert.equal(error.rule, 'overlap');
  assert.deepEqual(error.uids, [1]);
  assert.match(error.message, /Long at \(0, 0\)/);
  assert.equal(place(ship, 'long', 1, 0, 1)?.rule, 'overlap', 'a rotated footprint overlaps too');
  assert.equal(place(ship, 'hall', 2, 0), null, 'touching is fine');
});

test('rotation: quarter turns only, and only for modules that rotate', () => {
  const ship = newShip('small');
  assert.equal(place(ship, 'fixed', 0, 0, 0), null);
  assert.equal(place(ship, 'fixed', 0, 0, 1)?.rule, 'rotation');
  for (const rot of [4, -1, 1.5, undefined]) {
    assert.equal(placementError(ship, defs, { type: 'hall', x: 0, y: 0, rot })?.rule, 'rotation', String(rot));
  }
  const upright = build('small', [['long', 0, 0, 1]]); // turned: covers (0,0) and (0,1)
  assert.equal(place(upright, 'hall', 0, 1)?.rule, 'overlap');
  assert.equal(place(upright, 'hall', 1, 0), null);
});

test('the frame caps the module count, and unknown types and frames are refused', () => {
  const halls = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]].map(([x, y]) => ['hall', x, y]);
  const full = build('small', halls); // 8, the cap
  assert.equal(place(full, 'hall', 0, 2)?.rule, 'cap');
  assert.equal(place(newShip('small'), 'ghost', 0, 0)?.rule, 'type');
  assert.equal(place(newShip('nowhere'), 'hall', 0, 0)?.rule, 'frame');
});

test('removing frees the cells, and uids never repeat', () => {
  const ship = build('small', [['hall', 0, 0], ['hall', 1, 0]]);
  const fewer = removeModule(ship, 1);
  assert.deepEqual(fewer.modules.map((m) => m.uid), [2]);
  assert.equal(ship.modules.length, 2, 'the input is unchanged');
  assert.equal(removeModule(ship, 99), ship, 'removing a missing uid changes nothing');
  const again = placeModule(fewer, defs, { type: 'hall', x: 0, y: 0, rot: 0 });
  assert.equal(again.ok, true);
  assert.equal(again.uid, 3);
});

test('moving keeps the uid and build order, and a module never blocks itself', () => {
  const ship = build('small', [['long', 0, 0], ['hall', 3, 0]]);
  const moved = moveModule(ship, defs, 1, { x: 1, y: 0, rot: 0 }); // overlaps its own old cell
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.ship.modules.map((m) => [m.uid, m.x, m.y]), [[1, 1, 0], [2, 3, 0]]);
  assert.equal(moveModule(ship, defs, 1, { x: 2, y: 0, rot: 0 }).rule, 'overlap');
  assert.equal(moveModule(ship, defs, 1, { x: 0, y: 2, rot: 1 }).rule, 'bounds');
  assert.equal(moveModule(ship, defs, 9, { x: 0, y: 0, rot: 0 }).rule, 'missing');
  assert.equal(moveModule(ship, defs, 1, { x: 0, y: 0, rot: 0 }).ship, ship, 'staying put changes nothing');
  assert.equal(ship.modules[0].x, 0, 'the input is unchanged');
});

test('turning happens about the middle, slides back inside at an edge, and four turns come back', () => {
  const open = defs.frames.get('open');
  const beam = defs.modules.get('beam');
  assert.deepEqual(
    turnedPlacement(beam, { type: 'beam', x: 2, y: 3, rot: 0 }, open),
    { type: 'beam', x: 3, y: 2, rot: 1 },
    'the middle cell stays put',
  );
  for (const id of ['hall', 'long', 'beam']) {
    const def = defs.modules.get(id);
    let placement = { type: id, x: 3, y: 3, rot: 0 };
    for (let i = 0; i < 4; i++) placement = turnedPlacement(def, placement, open);
    assert.deepEqual(placement, { type: id, x: 3, y: 3, rot: 0 }, id);
  }
  const small = defs.frames.get('small'); // 3 tall: standing up at the bottom, it slides up a cell
  assert.deepEqual(turnedPlacement(defs.modules.get('long'), { type: 'long', x: 0, y: 2, rot: 0 }, small), {
    type: 'long',
    x: 0,
    y: 1,
    rot: 1,
  });
});

test('rotateModule turns a placed module in place, or says why not', () => {
  const free = build('small', [['long', 1, 0]]);
  const turned = rotateModule(free, defs, 1);
  assert.equal(turned.ok, true);
  assert.deepEqual(turned.placement, { uid: 1, type: 'long', x: 1, y: 0, rot: 1 });
  assert.deepEqual(turned.ship.modules, [{ uid: 1, type: 'long', x: 1, y: 0, rot: 1 }]);
  assert.equal(rotateModule(build('small', [['long', 0, 0], ['hall', 0, 1]]), defs, 1).rule, 'overlap');
  assert.equal(rotateModule(build('small', [['fixed', 0, 0]]), defs, 1).rule, 'rotation');
  assert.equal(rotateModule(free, defs, 7).rule, 'missing');
});

test('applyCommand runs place, move and remove, and refuses anything else', () => {
  let ship = newShip('small');
  for (const command of [
    { op: 'place', type: 'long', x: 0, y: 0, rot: 0 },
    { op: 'place', type: 'hall', x: 3, y: 2, rot: 0 },
    { op: 'move', uid: 1, x: 1, y: 1, rot: 1 },
    { op: 'remove', uid: 2 },
  ]) {
    const result = applyCommand(ship, defs, command);
    assert.equal(result.ok, true, JSON.stringify(command));
    ship = result.ship;
  }
  assert.deepEqual(ship.modules, [{ uid: 1, type: 'long', x: 1, y: 1, rot: 1 }]);
  assert.equal(applyCommand(ship, defs, { op: 'remove', uid: 2 }).rule, 'missing');
  assert.equal(applyCommand(ship, defs, { op: 'fly' }).rule, 'command');
  assert.equal(moduleAt(ship, defs, 1, 2), 1);
  assert.equal(moduleAt(ship, defs, 0, 0), null);
  assert.equal(moduleAt(ship, defs, -1, 0), null, 'off the frame');
});

// Openings as "uid@x,y side kind", sorted, for comparing.
const gaps = (ship) => openings(ship, defs).map((o) => `${o.uid}@${o.x},${o.y}${o.side} ${o.kind}`).sort();

test('rooms that share a wall join, through one doorway in its middle', () => {
  // A bridge and a long room side by side, and a beam under both.
  const ship = build('small', [['bridge', 0, 0], ['long', 1, 0], ['beam', 0, 1]]);
  assert.deepEqual([...connections(ship, defs).get(3)].sort(), [1, 2]);
  assert.deepEqual(gaps(ship), [
    '1@0,0e door', '1@0,0s door', // bridge: into the long room, and down into the beam
    '2@1,0s door', '2@1,0w door', // long: the left of its two shared edges with the beam
    '3@0,1n door', '3@1,1n door',
  ]);
  assert.deepEqual(rules(ship), ['airlock']);
});

test('rooms that only touch at a corner, or not at all, are not joined', () => {
  const ship = build('small', [['bridge', 0, 0], ['hall', 1, 1], ['hall', 3, 0]]);
  assert.deepEqual([...reachableFromBridge(ship, defs).reachable], [1]);
  const problem = layoutProblems(ship, defs).find((p) => p.rule === 'connected');
  assert.deepEqual(problem.uids, [2, 3]);
  assert.match(problem.message, /shared wall: Hall at \(1, 1\), Hall at \(3, 0\)/);
});

test('corridors side by side open into each other and count as one room', () => {
  // Three ducts in a row under a beam: open between them, and one doorway
  // into the beam, not three.
  const ship = build('small', [['beam', 0, 0], ['duct', 0, 1], ['duct', 1, 1], ['duct', 2, 1]]);
  assert.deepEqual(gaps(ship), [
    '1@1,0s door',
    '2@0,1e open',
    '3@1,1e open', '3@1,1n door', '3@1,1w open',
    '4@2,1w open',
  ]);
  assert.deepEqual([...connections(ship, defs).get(2)], [3], 'the far duct reaches the beam through the run');
  const bent = build('open', [['bridge', 2, 2], ['duct', 3, 2], ['duct', 3, 3], ['duct', 2, 3]]);
  assert.deepEqual(gaps(bent).filter((g) => g.startsWith('1@')), ['1@2,2e door', '1@2,2s door'], 'one doorway per side the run touches');
});

test("a part's side that has to face space gets no doorway, and is a problem when blocked", () => {
  // The jet's exhaust faces west, onto the bridge: no way through, and blocked.
  const blocked = build('small', [['bridge', 0, 0], ['jet', 1, 0]]);
  assert.deepEqual([...connections(blocked, defs).get(1)], []);
  assert.deepEqual(blockedFacings(blocked, defs), [{ uid: 2, what: 'exhaust' }]);
  const problem = layoutProblems(blocked, defs).find((p) => p.rule === 'faces');
  assert.deepEqual(problem.uids, [2]);
  assert.equal(problem.message, 'Jet at (1, 0) has its exhaust blocked: it has to face space.');
  // With the bridge on its east side instead, the jet joins and blows clear.
  const clear = build('small', [['bridge', 1, 0], ['jet', 0, 0]]);
  assert.deepEqual([...connections(clear, defs).get(1)], [2]);
  assert.deepEqual(blockedFacings(clear, defs), []);
  // A gun's barrel turns with it: turned to face east, a hall to its north joins it.
  const gun = build('small', [['hall', 1, 0], ['gun', 1, 1, 1]]);
  assert.deepEqual([...connections(gun, defs).get(2)], [1]);
  assert.deepEqual(blockedFacings(gun, defs), []);
  assert.deepEqual(blockedFacings(build('small', [['hall', 1, 0], ['gun', 1, 1]]), defs), [{ uid: 2, what: 'barrel' }]);
});

test('space is outside the ship, but not a notch the hull closes over', () => {
  // A U of halls around (1, 1): parts on three sides, so the hull fills it.
  const ship = build('open', [['hall', 0, 0], ['hall', 1, 0], ['hall', 2, 0], ['hall', 0, 1], ['hall', 2, 1]]);
  const isSpace = spaceTest(ship, defs);
  assert.equal(isSpace(1, 1), false, 'the notch');
  assert.equal(isSpace(1, 2), true, 'below it');
  assert.equal(isSpace(1, 0), false, 'a part');
  assert.equal(isSpace(-1, 0), true, 'past the edge of the yard');
  const sealed = build('open', [['hall', 1, 0], ['hall', 0, 1], ['hall', 2, 1], ['hall', 1, 2], ['hall', 3, 1], ['hall', 3, 0], ['hall', 3, 2]]);
  assert.equal(spaceTest(sealed, defs)(1, 1), false, 'a hole closed in on all four sides');
});

test("each side of an airlock that faces space has a hatch in its middle", () => {
  const ship = build('small', [['bridge', 0, 0], ['lock', 1, 0], ['hall', 2, 0]]);
  assert.deepEqual(gaps(ship).filter((g) => g.endsWith('hatch')), ['2@1,0n hatch', '2@1,0s hatch']);
  assert.deepEqual(airlocksOnHullEdge(ship, defs), [2]);
});

test('connectivity: without a bridge there is nothing to connect to', () => {
  const ship = build('small', [['hall', 0, 0], ['lock', 1, 0]]);
  assert.equal(reachableFromBridge(ship, defs).bridge, null);
  assert.deepEqual(rules(ship), ['bridge']);
});

test('airlock: it must touch open space outside the hull', () => {
  // Halls all around the airlock: it joins, but no side faces space.
  const ring = build('ring', [
    ['bridge', 0, 0], ['hall', 1, 0], ['hall', 2, 0],
    ['hall', 0, 1], ['lock', 1, 1], ['hall', 2, 1],
    ['hall', 0, 2], ['hall', 1, 2], ['hall', 2, 2],
  ]);
  assert.deepEqual(airlocksOnHullEdge(ring, defs), []);
  assert.deepEqual(rules(ring), ['airlock']);
  const notched = removeModule(ring, 8); // the hall below the airlock
  assert.deepEqual(airlocksOnHullEdge(notched, defs), [], 'a one-cell notch is hull, not space');
  const opened = removeModule(notched, 9); // and the one beside that
  assert.deepEqual(airlocksOnHullEdge(opened, defs), [5]);
  assert.deepEqual(rules(opened), []);
});

test('layoutProblems also catches bad data in a loaded ship', () => {
  const ship = {
    frame: 'small',
    nextUid: 6,
    modules: [
      { uid: 1, type: 'bridge', x: 0, y: 0, rot: 0 },
      { uid: 2, type: 'hall', x: 0, y: 0, rot: 0 },
      { uid: 3, type: 'long', x: 3, y: 2, rot: 0 },
      { uid: 4, type: 'ghost', x: 1, y: 1, rot: 0 },
      { uid: 5, type: 'fixed', x: 2, y: 0, rot: 2 },
    ],
  };
  const found = rules(ship);
  for (const rule of ['overlap', 'bounds', 'type', 'rotation']) assert.ok(found.includes(rule), `${rule} in ${found}`);
  assert.deepEqual(rules({ ...ship, frame: 'nowhere' }), ['frame']);
});

test('a full starter ship builds from a script with the real data and passes every rule', () => {
  const real = indexDefs(readData());
  const script = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
  const { ship, rejected, problems } = runScript(script, real);
  assert.deepEqual(rejected, []);
  assert.deepEqual(problems, []);
  // Nose to the right: engines at the back (left), bridge at the front.
  assert.equal(renderShip(ship, real), ['..QQQRRR..', 'EEQQQRRRBB', 'EE+++RRRBB', 'EELLAAW.BB', 'EE........'].join('\n'));

  const extra = { ...script, placements: [...script.placements, { type: 'corridor', x: 10, y: 7, rot: 0 }] };
  const bad = runScript(extra, real);
  assert.equal(bad.rejected.length, 1);
  assert.equal(bad.rejected[0].index, script.placements.length);
  assert.equal(bad.rejected[0].rule, 'overlap');
});

test('the build-ship tool runs a script from the command line', () => {
  const tool = fileURLToPath(new URL('../tools/build-ship.js', import.meta.url));
  const run = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^\.\.QQQRRR\.\.$/m);
  assert.match(run.stdout, /All placement rules pass/);
  assert.match(run.stdout, /Flight check: all 6 lines pass/);
});

test("a shaped frame's cut-away cells are space: nothing goes there", async () => {
  const { frameCells, inFrame } = await import('../src/sim/frame.js');
  const shaped = defs.frames.get('shaped');
  assert.equal(frameCells(shaped).length, 8);
  assert.equal(inFrame(shaped, 0, 0), false);
  assert.equal(inFrame(shaped, 1, 0), true);
  assert.equal(frameCells(defs.frames.get('small')).length, 12, 'a frame without a shape is all hull');
  const ship = newShip('shaped');
  assert.equal(place(ship, 'hall', 0, 0)?.rule, 'bounds');
  assert.equal(place(ship, 'hall', 1, 0), null);
  assert.equal(place(ship, 'long', 2, 0)?.rule, 'bounds', 'half on the hull is not enough');
  assert.equal(place(ship, 'long', 0, 1), null);
});

test('an airlock beside a cut-away cell opens onto space', () => {
  const ship = build('shaped', [['lock', 1, 0], ['hall', 2, 0], ['hall', 1, 1]]);
  assert.deepEqual(gaps(ship).filter((g) => g.endsWith('hatch')), ['1@1,0n hatch', '1@1,0w hatch']);
  // An airlock whose only open side faces a hole cut in the middle of the
  // frame: walled in by parts, but still open to space...
  const window = build('window', [['lock', 2, 1], ['hall', 2, 0], ['hall', 1, 1], ['hall', 3, 1], ['hall', 1, 2], ['hall', 1, 3], ['hall', 4, 2], ['hall', 4, 3], ['hall', 2, 4], ['hall', 3, 4]]);
  assert.deepEqual(airlocksOnHullEdge(window, defs), [1]);
  // ...unless the hole is one cell with parts on every side: the hull
  // closes over that.
  const holed = build('holed', [['lock', 2, 1], ['hall', 2, 0], ['hall', 1, 1], ['hall', 3, 1], ['hall', 1, 2], ['hall', 3, 2], ['hall', 2, 3]]);
  assert.deepEqual(airlocksOnHullEdge(holed, defs), []);
});

test('a part saved where the frame no longer reaches is reported, not moved', () => {
  const ship = { frame: 'shaped', nextUid: 3, modules: [{ uid: 1, type: 'bridge', x: 1, y: 1, rot: 0 }, { uid: 2, type: 'hall', x: 0, y: 0, rot: 0 }] };
  const problems = layoutProblems(ship, defs).filter((p) => p.rule === 'bounds');
  assert.deepEqual(problems.map((p) => [p.uids, p.message]), [[[2], 'Hall at (0, 0) sticks out of the build area.']]);
  assert.deepEqual(ship.modules[1], { uid: 2, type: 'hall', x: 0, y: 0, rot: 0 });
});
