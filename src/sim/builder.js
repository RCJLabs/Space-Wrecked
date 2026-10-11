// Ship layout rules on the shared grid: placing and removing modules, and
// checking a whole layout. A ship is plain data:
//   { frame, modules: [{ uid, type, x, y, rot }], nextUid }
// Every change is a command (a placement to add, a uid to remove), so a build
// can be replayed step by step. Functions return new ships and never change
// their input.
import { cellAt, createGrid, exteriorOf, inBounds, OPPOSITE, SIDES, step, withCells } from './grid.js';
import { hasTag, isRotation, placedCells, placedDoors } from './modules.js';

export function newShip(frameId) {
  return { frame: frameId, modules: [], nextUid: 1 };
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
      return { rule: 'overlap', message: `${def.name} would overlap ${describe(ship, defs, owner)}.`, uids: [owner] };
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
      add('rotation', `${describe(ship, defs, module.uid)} has a rotation it can't have.`, [module.uid]);
      if (!isRotation(module.rot)) continue;
    }
    for (const [x, y] of placedCells(def, module)) {
      if (!inBounds(area, x, y)) {
        add('bounds', `${describe(ship, defs, module.uid)} sticks out of the ${frame.name}.`, [module.uid]);
        break;
      }
      const first = owners.get(`${x},${y}`);
      if (first !== undefined) {
        add('overlap', `${describe(ship, defs, module.uid)} overlaps ${describe(ship, defs, first)}.`, [first, module.uid]);
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
      add('connected', `Not joined to the bridge by matching doors: ${loose.map((uid) => describe(ship, defs, uid)).join(', ')}.`, loose);
    }
  }
  if (airlocksOnHullEdge(ship, defs).length === 0) add('airlock', 'No airlock on the hull edge.');
  return problems;
}

// "Reactor at (0, 3)", for messages.
function describe(ship, defs, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return `module ${uid}`;
  const name = defs.modules.get(module.type)?.name ?? module.type;
  return `${name} at (${module.x}, ${module.y})`;
}
