// Ship layout rules on the shared grid: placing, moving and removing modules,
// and checking a whole layout. A ship is plain data:
//   { frame, modules: [{ uid, type, x, y, rot }], nextUid }
// Every change is a command (see applyCommand), so a build can be replayed
// step by step. Functions return new ships and never change their input.
import { cellAt, createGrid, exteriorOf, inBounds, OPPOSITE, SIDES, step, withCells } from './grid.js';
import { footprint, hasTag, isRotation, placedCells, placedDoors } from './modules.js';

export function newShip(frameId) {
  return { frame: frameId, modules: [], nextUid: 1 };
}

// True if value has a ship's shape: whole-number positions, quarter-turn
// rotations, and unique uids below nextUid. Whether the parts exist and fit
// is the layout rules' business, not this; a save only has to be readable.
export function isShipData(value) {
  if (!isRecord(value) || typeof value.frame !== 'string' || !value.frame || !Array.isArray(value.modules)) return false;
  if (!Number.isInteger(value.nextUid) || value.nextUid < 1) return false;
  const uids = new Set();
  for (const m of value.modules) {
    if (!isRecord(m) || !Number.isInteger(m.uid) || m.uid < 1 || m.uid >= value.nextUid || uids.has(m.uid)) return false;
    if (typeof m.type !== 'string' || !m.type || !Number.isInteger(m.x) || !Number.isInteger(m.y) || !isRotation(m.rot)) return false;
    uids.add(m.uid);
  }
  return true;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Why a placement can't be made, as { rule, message, uids? }, or null if it
// can. Connectivity and the airlock rule are not checked here: a ship is
// allowed to be unfinished while it is being built.
export function placementError(ship, defs, placement) {
  const frame = defs.frames.get(ship.frame);
  if (!frame) return { rule: 'frame', message: `Unknown hull frame "${ship.frame}".` };
  const def = defs.modules.get(placement.type);
  if (!def) return { rule: 'type', message: `Unknown module type "${placement.type}".` };
  if (!isRotation(placement.rot)) {
    return { rule: 'rotation', message: `Rotation must be 0 to 3 quarter turns, not ${placement.rot}.` };
  }
  if (placement.rot !== 0 && !def.rotates) return { rule: 'rotation', message: `${def.name} can't be rotated.` };
  if (ship.modules.length >= frame.maxModules) {
    return { rule: 'cap', message: `The ${frame.name} holds at most ${frame.maxModules} modules.` };
  }
  const grid = occupancy(ship, defs);
  for (const [x, y] of placedCells(def, placement)) {
    if (!inBounds(grid, x, y)) {
      return { rule: 'bounds', message: `${def.name} doesn't fit inside the ${frame.name} there.` };
    }
    const owner = cellAt(grid, x, y);
    if (owner !== null) {
      return { rule: 'overlap', message: `${def.name} would overlap ${describeModule(ship, defs, owner)}.`, uids: [owner] };
    }
  }
  return null;
}

// Returns { ok: true, ship, uid } or { ok: false, rule, message }.
export function placeModule(ship, defs, placement) {
  const error = placementError(ship, defs, placement);
  if (error) return { ok: false, ...error };
  const { type, x, y, rot } = placement;
  const uid = ship.nextUid;
  return { ok: true, uid, ship: { ...ship, modules: [...ship.modules, { uid, type, x, y, rot }], nextUid: uid + 1 } };
}

export function removeModule(ship, uid) {
  const modules = ship.modules.filter((module) => module.uid !== uid);
  return modules.length === ship.modules.length ? ship : { ...ship, modules };
}

// Moves a placed module to { x, y, rot }, keeping its uid and its place in
// the build order. The module doesn't block itself. Returns { ok: true, ship }
// or { ok: false, rule, message }.
export function moveModule(ship, defs, uid, { x, y, rot }) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return { ok: false, rule: 'missing', message: `There is no module ${uid}.` };
  const next = { uid, type: module.type, x, y, rot };
  const error = placementError(removeModule(ship, uid), defs, next);
  if (error) return { ok: false, ...error };
  if (module.x === x && module.y === y && module.rot === rot) return { ok: true, ship };
  return { ok: true, ship: { ...ship, modules: ship.modules.map((m) => (m.uid === uid ? next : m)) } };
}

// Where a placement lands after one quarter turn clockwise. It turns about
// its middle: the top-left moves by half the difference between width and
// height, rounded toward zero so four turns bring it back exactly. If the
// turn pushes it past the frame's edge, it slides back inside.
export function turnedPlacement(def, placement, frame) {
  const [w, h] = footprint(def, placement.rot);
  const x = placement.x + Math.trunc((w - h) / 2);
  const y = placement.y + Math.trunc((h - w) / 2);
  return {
    ...placement,
    x: Math.max(0, Math.min(x, frame.width - h)),
    y: Math.max(0, Math.min(y, frame.height - w)),
    rot: (placement.rot + 1) % 4,
  };
}

// Turns a placed module a quarter clockwise, in place (see turnedPlacement).
// Returns what moveModule returns, plus the new placement when it worked.
export function rotateModule(ship, defs, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return { ok: false, rule: 'missing', message: `There is no module ${uid}.` };
  const def = defs.modules.get(module.type);
  if (!def) return { ok: false, rule: 'type', message: `Unknown module type "${module.type}".` };
  if (!def.rotates) return { ok: false, rule: 'rotation', message: `${def.name} can't be rotated.` };
  const frame = defs.frames.get(ship.frame);
  if (!frame) return { ok: false, rule: 'frame', message: `Unknown hull frame "${ship.frame}".` };
  const turned = turnedPlacement(def, module, frame);
  const result = moveModule(ship, defs, uid, turned);
  return result.ok ? { ...result, placement: turned } : result;
}

// Applies one build command:
//   { op: 'place', type, x, y, rot }   adds a module with the next uid
//   { op: 'move', uid, x, y, rot }     moves or turns one
//   { op: 'remove', uid }              takes one out
// Returns { ok: true, ship, uid? } or { ok: false, rule, message }.
export function applyCommand(ship, defs, command) {
  if (command.op === 'place') return placeModule(ship, defs, command);
  if (command.op === 'move') return moveModule(ship, defs, command.uid, command);
  if (command.op === 'remove') {
    const next = removeModule(ship, command.uid);
    if (next === ship) return { ok: false, rule: 'missing', message: `There is no module ${command.uid}.` };
    return { ok: true, ship: next };
  }
  return { ok: false, rule: 'command', message: `Unknown build command "${command.op}".` };
}

// The uid of the module covering cell (x, y), or null.
export function moduleAt(ship, defs, x, y) {
  return cellAt(occupancy(ship, defs), x, y) ?? null;
}

// Applies placements in order, as a script or a replay does. A rejected
// placement is skipped and reported with its index.
export function buildShip(defs, frameId, placements) {
  let ship = newShip(frameId);
  const rejected = [];
  placements.forEach((placement, index) => {
    const result = placeModule(ship, defs, placement);
    if (result.ok) ship = result.ship;
    else rejected.push({ index, placement, rule: result.rule, message: result.message });
  });
  return { ship, rejected };
}

// The frame's grid with each cell holding the uid of the module on it, or
// null. Unknown types and cells outside the frame are left out;
// layoutProblems reports them.
export function occupancy(ship, defs) {
  const frame = defs.frames.get(ship.frame);
  if (!frame) throw new Error(`occupancy: unknown hull frame "${ship.frame}"`);
  let grid = createGrid(frame.width, frame.height, null);
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def || !isRotation(module.rot)) continue;
    const cells = placedCells(def, module).filter(([x, y]) => inBounds(grid, x, y));
    grid = withCells(grid, cells, module.uid);
  }
  return grid;
}

// Which modules are joined: a door socket on each side of the same cell
// edge. Returns a Map from each uid to the Set of uids it links to.
export function connections(ship, defs) {
  const links = new Map(ship.modules.map((module) => [module.uid, new Set()]));
  const doors = [];
  const owners = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def || !isRotation(module.rot)) continue;
    for (const [x, y, side] of placedDoors(def, module)) {
      doors.push([x, y, side, module.uid]);
      owners.set(`${x},${y},${side}`, module.uid);
    }
  }
  for (const [x, y, side, uid] of doors) {
    const [nx, ny] = step(x, y, side);
    const other = owners.get(`${nx},${ny},${OPPOSITE[side]}`);
    if (other !== undefined && other !== uid) {
      links.get(uid).add(other);
      links.get(other).add(uid);
    }
  }
  return links;
}

// Every door socket on the ship, as { uid, x, y, side, state }, where state
// says what the door opens onto:
//   linked   a matching socket across the edge: a real doorway
//   open     an empty cell on the frame, where a part could join
//   blocked  another module with no socket there
//   outside  past the frame's edge
export function doorStates(ship, defs) {
  const grid = occupancy(ship, defs);
  const sockets = new Set();
  const doors = [];
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def || !isRotation(module.rot)) continue;
    for (const [x, y, side] of placedDoors(def, module)) {
      doors.push({ uid: module.uid, x, y, side });
      sockets.add(`${x},${y},${side}`);
    }
  }
  return doors.map((door) => {
    const [nx, ny] = step(door.x, door.y, door.side);
    const owner = cellAt(grid, nx, ny);
    let state = 'blocked';
    if (owner === undefined) state = 'outside';
    else if (owner === null) state = 'open';
    else if (sockets.has(`${nx},${ny},${OPPOSITE[door.side]}`)) state = 'linked';
    return { ...door, state };
  });
}

// The first bridge's uid, and every module reachable from it through joined
// doors. Without a bridge, nothing is reachable.
export function reachableFromBridge(ship, defs) {
  const bridge = ship.modules.find((module) => {
    const def = defs.modules.get(module.type);
    return def && hasTag(def, 'bridge');
  });
  if (!bridge) return { bridge: null, reachable: new Set() };
  const links = connections(ship, defs);
  const reachable = new Set([bridge.uid]);
  const queue = [bridge.uid];
  while (queue.length) {
    for (const next of links.get(queue.shift())) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return { bridge: bridge.uid, reachable };
}

// Uids of airlocks with at least one side facing open space outside the hull.
export function airlocksOnHullEdge(ship, defs) {
  const grid = occupancy(ship, defs);
  const isOutside = exteriorOf(grid, (owner) => owner === null);
  return ship.modules
    .filter((module) => {
      const def = defs.modules.get(module.type);
      if (!def || !hasTag(def, 'airlock') || !isRotation(module.rot)) return false;
      return placedCells(def, module).some(([x, y]) =>
        SIDES.some((side) => isOutside(...step(x, y, side))),
      );
    })
    .map((module) => module.uid);
}

// Everything wrong with a layout under the placement rules, as
// { rule, message, uids }. An empty list means every rule passes.
export function layoutProblems(ship, defs) {
  const frame = defs.frames.get(ship.frame);
  if (!frame) return [{ rule: 'frame', message: `Unknown hull frame "${ship.frame}".`, uids: [] }];
  const problems = [];
  const add = (rule, message, uids = []) => problems.push({ rule, message, uids });

  const area = createGrid(frame.width, frame.height);
  const owners = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) {
      add('type', `Unknown module type "${module.type}".`, [module.uid]);
      continue;
    }
    if (!isRotation(module.rot) || (module.rot !== 0 && !def.rotates)) {
      add('rotation', `${describeModule(ship, defs, module.uid)} has a rotation it can't have.`, [module.uid]);
      if (!isRotation(module.rot)) continue;
    }
    for (const [x, y] of placedCells(def, module)) {
      if (!inBounds(area, x, y)) {
        add('bounds', `${describeModule(ship, defs, module.uid)} sticks out of the ${frame.name}.`, [module.uid]);
        break;
      }
      const first = owners.get(`${x},${y}`);
      if (first !== undefined) {
        add('overlap', `${describeModule(ship, defs, module.uid)} overlaps ${describeModule(ship, defs, first)}.`, [first, module.uid]);
        break;
      }
      owners.set(`${x},${y}`, module.uid);
    }
  }
  if (ship.modules.length > frame.maxModules) {
    add('cap', `${ship.modules.length} modules, but the ${frame.name} holds at most ${frame.maxModules}.`);
  }

  const { bridge, reachable } = reachableFromBridge(ship, defs);
  if (bridge === null) {
    add('bridge', 'No bridge. Every module has to connect to one.');
  } else {
    const loose = ship.modules.filter((module) => !reachable.has(module.uid)).map((module) => module.uid);
    if (loose.length) {
      add('connected', `Not joined to the bridge by matching doors: ${loose.map((uid) => describeModule(ship, defs, uid)).join(', ')}.`, loose);
    }
  }
  if (airlocksOnHullEdge(ship, defs).length === 0) add('airlock', 'No airlock on the hull edge.');
  return problems;
}

// "Reactor at (0, 3)", for messages.
export function describeModule(ship, defs, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return `module ${uid}`;
  const name = defs.modules.get(module.type)?.name ?? module.type;
  return `${name} at (${module.x}, ${module.y})`;
}
