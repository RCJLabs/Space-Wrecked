import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  airlocksOnHullEdge,
  applyCommand,
  buildShip,
  connections,
  doorStates,
  layoutProblems,
  moduleAt,
  moveModule,
  newShip,
  placeModule,
  placementError,
  reachableFromBridge,
  removeModule,
  rotateModule,
  turnedPlacement,
} from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { EXAMPLE_SCRIPT, renderShip, runScript } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

// A tiny catalog for rule tests, so content changes don't break them.
const ALL_SIDES = ['n', 'e', 's', 'w'].map((side) => ({ side, at: 0 }));
const mod = (id, size, doors, tags = [], rotates = true) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  size,
  rotates,
  doors,
  tags,
});
const defs = indexDefs({
  modules: {
    tilesPerCell: 2,
    tiles: { '.': 'floor' },
    modules: [
      mod('bridge', [1, 1], ALL_SIDES, ['bridge']),
      mod('hall', [1, 1], ALL_SIDES),
      mod('lock', [1, 1], ALL_SIDES, ['airlock']),
      mod('long', [2, 1], [{ side: 's', at: 1 }, { side: 'w', at: 0 }]),
      mod('fixed', [1, 2], [{ side: 'n', at: 0 }], [], false),
      mod('blind', [1, 1], [{ side: 'n', at: 0 }]),
      mod('beam', [3, 1], [{ side: 'w', at: 0 }]),
    ],
  },
  frames: {
    frames: [
      { id: 'small', name: 'Small frame', width: 4, height: 3, maxModules: 8 },
      { id: 'ring', name: 'Ring frame', width: 3, height: 3, maxModules: 9 },
      { id: 'open', name: 'Open frame', width: 8, height: 8, maxModules: 20 },
      { id: 'shaped', name: 'Shaped frame', width: 4, height: 3, maxModules: 9, shape: ['.##.', '####', '.##.'] },
      { id: 'holed', name: 'Holed frame', width: 5, height: 4, maxModules: 20, shape: ['#####', '#####', '##.##', '#####'] },
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
  assert.equal(applyCommand(ship, defs, { op: 'paint' }).rule, 'command');
  assert.equal(moduleAt(ship, defs, 1, 2), 1);
  assert.equal(moduleAt(ship, defs, 0, 0), null);
  assert.equal(moduleAt(ship, defs, -1, 0), null, 'off the frame');
});

test('connectivity: a door joins two modules only when both have a socket on that edge', () => {
  // bridge - hall - blind - lock in a row. blind's only door faces north, so
  // neither the hall's east door nor the airlock's west door has a partner.
  const ship = build('small', [['bridge', 0, 0], ['hall', 1, 0], ['blind', 2, 0], ['lock', 3, 0]]);
  const links = connections(ship, defs);
  assert.deepEqual([...links.get(1)], [2]);
  assert.deepEqual([...links.get(3)], []);
  assert.deepEqual([...reachableFromBridge(ship, defs).reachable].sort(), [1, 2]);
  const problem = layoutProblems(ship, defs).find((p) => p.rule === 'connected');
  assert.deepEqual(problem.uids, [3, 4]);
  assert.match(problem.message, /Blind at \(2, 0\), Lock at \(3, 0\)/);
});

test('connectivity: turning a module can join it, and a detour reaches the rest', () => {
  const turned = build('small', [['bridge', 0, 0], ['hall', 1, 0], ['blind', 2, 0, 3], ['lock', 3, 0]]);
  assert.deepEqual([...connections(turned, defs).get(3)], [2], 'turned to face west, blind joins the hall');
  assert.deepEqual(rules(turned), ['connected'], 'the airlock is still cut off');
  const routed = build('small', [
    ['bridge', 0, 0], ['hall', 1, 0], ['blind', 2, 0, 3], ['lock', 3, 0],
    ['hall', 1, 1], ['hall', 2, 1], ['hall', 3, 1],
  ]);
  assert.deepEqual(rules(routed), []);
});

test('doorStates says what each door opens onto', () => {
  // bridge (1) and hall (2) side by side, a north-only blind (3) under the
  // bridge, and another blind (4) east of the hall, which shows it a wall.
  const ship = build('small', [['bridge', 0, 0], ['hall', 1, 0], ['blind', 0, 1], ['blind', 2, 0]]);
  const states = Object.fromEntries(doorStates(ship, defs).map((d) => [`${d.uid}${d.side}`, d.state]));
  assert.deepEqual(states, {
    '1n': 'outside', '1e': 'linked', '1s': 'linked', '1w': 'outside',
    '2n': 'outside', '2e': 'blocked', '2s': 'open', '2w': 'linked',
    '3n': 'linked',
    '4n': 'outside',
  });
});

test('connectivity: without a bridge there is nothing to connect to', () => {
  const ship = build('small', [['hall', 0, 0], ['lock', 1, 0]]);
  assert.equal(reachableFromBridge(ship, defs).bridge, null);
  assert.deepEqual(rules(ship), ['bridge']);
});

test('airlock: it must touch open space outside the hull', () => {
  // Halls all around the airlock: it connects, but no side faces space.
  const ring = build('ring', [
    ['bridge', 0, 0], ['hall', 1, 0], ['hall', 2, 0],
    ['hall', 0, 1], ['lock', 1, 1], ['hall', 2, 1],
    ['hall', 0, 2], ['hall', 1, 2], ['hall', 2, 2],
  ]);
  assert.deepEqual(airlocksOnHullEdge(ring, defs), []);
  assert.deepEqual(rules(ring), ['airlock']);
  const opened = removeModule(ring, 8); // the hall below the airlock
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
  assert.equal(renderShip(ship, real), ['.QQRR..', 'EE+RR+B', 'EE++++B', '..LAW..'].join('\n'));

  const extra = { ...script, placements: [...script.placements, { type: 'corridor', x: 5, y: 1, rot: 0 }] };
  const bad = runScript(extra, real);
  assert.equal(bad.rejected.length, 1);
  assert.equal(bad.rejected[0].index, script.placements.length);
  assert.equal(bad.rejected[0].rule, 'overlap');
});

test('the build-ship tool runs a script from the command line', () => {
  const tool = fileURLToPath(new URL('../tools/build-ship.js', import.meta.url));
  const run = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^\.QQRR\.\.$/m);
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

test('doors onto cut-away cells open onto space, and an airlock there is on the hull edge', () => {
  const ship = build('shaped', [['hall', 1, 0]]);
  const states = Object.fromEntries(doorStates(ship, defs).map((d) => [d.side, d.state]));
  assert.deepEqual(states, { n: 'outside', e: 'open', s: 'open', w: 'outside' });
  // An airlock whose only open side faces a hole cut in the middle of the
  // frame: walled in by parts, but still open to space.
  const holed = build('holed', [['lock', 2, 1], ['hall', 2, 0], ['hall', 1, 1], ['hall', 3, 1], ['hall', 1, 2], ['hall', 3, 2], ['hall', 2, 3]]);
  assert.deepEqual(airlocksOnHullEdge(holed, defs), [1]);
});

test('a part saved where the frame no longer reaches is reported, not moved', () => {
  const ship = { frame: 'shaped', nextUid: 3, modules: [{ uid: 1, type: 'bridge', x: 1, y: 1, rot: 0 }, { uid: 2, type: 'hall', x: 0, y: 0, rot: 0 }] };
  const problems = layoutProblems(ship, defs).filter((p) => p.rule === 'bounds');
  assert.deepEqual(problems.map((p) => [p.uids, p.message]), [[[2], 'Hall at (0, 0) sticks out of the Shaped frame.']]);
  assert.deepEqual(ship.modules[1], { uid: 2, type: 'hall', x: 0, y: 0, rot: 0 });
});
