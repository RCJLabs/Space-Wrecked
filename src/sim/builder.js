// Ship layout rules on the shared grid: placing, moving and removing modules,
// and checking a whole layout. A ship is plain data:
//   { frame, hull, paint, trim, modules: [{ uid, type, x, y, rot }],
//     styling: [{ uid, type, x, y, rot }], nextUid }
// hull is its hull's style (data/hulls.json, M23d); paint, trim and the
// styling pieces (data/styling.json, styling.js, M23f) are its looks. None
// of them changes anything but how it looks from outside. Modules and
// pieces share one count of uids. Every change is a command (see
// applyCommand), so a build can be replayed step by step. Functions return
// new ships and never change their input.
//
// Rooms join where they share a wall: each wall two rooms share gets one
// doorway in its middle, and corridors side by side open into each other,
// so a run of corridor cells is one space. An engine's exhaust and a gun's
// barrel (a part's facesSpace side) get no doorway and have to face space.
import { inFrame } from './frame.js';
import { cellAt, createGrid, exteriorOf, inBounds, OPPOSITE, SIDES, step, withCells } from './grid.js';
import { facingSide, footprint, hasTag, isRotation, placedCells, sideCells } from './modules.js';
import { misfits, pieceError } from './styling.js';

// The hull style a ship has until the player picks another, and the one
// ships saved before M23d were given.
export const DEFAULT_HULL = 'rounded';
// The paint and trim a ship has until it is painted, the yard's, and the
// ones ships saved before M23f were given.
export const DEFAULT_PAINT = 'slate';
export const DEFAULT_TRIM = 'sky';

export function newShip(frameId, hull = DEFAULT_HULL) {
  return { frame: frameId, hull, paint: DEFAULT_PAINT, trim: DEFAULT_TRIM, modules: [], styling: [], nextUid: 1 };
}

// True if value has a ship's shape: whole-number positions, quarter-turn
// rotations (a styling piece's 0 to 7), uids unique across its modules and
// pieces and below nextUid, and names for its hull style, paint and trim if
// it has them. A ship has a style from M23d on (save version 16) and its
// looks from M23f on (17), but the migrations from before then check ships
// with this too, so it can't insist. Whether the parts exist and fit is the
// layout rules' business, not this; a save only has to be readable.
export function isShipData(value) {
  if (!isRecord(value) || typeof value.frame !== 'string' || !value.frame || !Array.isArray(value.modules)) return false;
  for (const name of ['hull', 'paint', 'trim']) {
    if (value[name] !== undefined && (typeof value[name] !== 'string' || !value[name])) return false;
  }
  if (value.styling !== undefined && !Array.isArray(value.styling)) return false;
  if (!Number.isInteger(value.nextUid) || value.nextUid < 1) return false;
  const uids = new Set();
  const placed = (m, turns) => {
    if (!isRecord(m) || !Number.isInteger(m.uid) || m.uid < 1 || m.uid >= value.nextUid || uids.has(m.uid)) return false;
    if (typeof m.type !== 'string' || !m.type || !Number.isInteger(m.x) || !Number.isInteger(m.y) || !turns(m.rot)) return false;
    uids.add(m.uid);
    return true;
  };
  return value.modules.every((m) => placed(m, isRotation)) && (value.styling ?? []).every((p) => placed(p, isPieceTurn));
}

function isPieceTurn(rot) {
  return Number.isInteger(rot) && rot >= 0 && rot <= 7;
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
    if (!inFrame(frame, x, y)) {
      return { rule: 'bounds', message: `${def.name} would go past the edge of the build area.` };
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
// Returns what applyCommand's move returns, plus the new placement when it
// worked.
export function rotateModule(ship, defs, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return { ok: false, rule: 'missing', message: `There is no module ${uid}.` };
  const def = defs.modules.get(module.type);
  if (!def) return { ok: false, rule: 'type', message: `Unknown module type "${module.type}".` };
  if (!def.rotates) return { ok: false, rule: 'rotation', message: `${def.name} can't be rotated.` };
  const frame = defs.frames.get(ship.frame);
  if (!frame) return { ok: false, rule: 'frame', message: `Unknown hull frame "${ship.frame}".` };
  const turned = turnedPlacement(def, module, frame);
  const result = tidied(moveModule(ship, defs, uid, turned), defs);
  return result.ok ? { ...result, placement: turned } : result;
}

// Applies one build command:
//   { op: 'place', type, x, y, rot }   adds a module, or a styling piece,
//                                      with the next uid
//   { op: 'move', uid, x, y, rot }     moves or turns one
//   { op: 'remove', uid }              takes one out
//   { op: 'hull', style }              gives the hull a style
//   { op: 'paint', color }             paints the hull (data/styling.json)
//   { op: 'trim', color }              and its trim
// Returns { ok: true, ship, uid?, removed? } or { ok: false, rule,
// message }. A change to the rooms takes off the styling pieces it leaves
// with nothing to hold them (styling.js misfits): removed lists them.
export function applyCommand(ship, defs, command) {
  const piece = (uid) => (ship.styling ?? []).find((p) => p.uid === uid);
  if (command.op === 'place') return defs.styling?.has(command.type) ? placePiece(ship, defs, command) : tidied(placeModule(ship, defs, command), defs);
  if (command.op === 'move') return piece(command.uid) ? movePiece(ship, defs, command.uid, command) : tidied(moveModule(ship, defs, command.uid, command), defs);
  if (command.op === 'remove') {
    if (piece(command.uid)) return { ok: true, ship: { ...ship, styling: ship.styling.filter((p) => p.uid !== command.uid) } };
    const next = removeModule(ship, command.uid);
    if (next === ship) return { ok: false, rule: 'missing', message: `There is no module ${command.uid}.` };
    return tidied({ ok: true, ship: next }, defs);
  }
  if (command.op === 'hull') {
    if (!defs.hulls?.has(command.style)) return { ok: false, rule: 'hull', message: `There is no hull style "${command.style}".` };
    return { ok: true, ship: ship.hull === command.style ? ship : { ...ship, hull: command.style } };
  }
  if (command.op === 'paint' || command.op === 'trim') {
    const known = command.op === 'paint' ? defs.paints : defs.trims;
    if (!known?.has(command.color)) return { ok: false, rule: command.op, message: `There is no ${command.op} "${command.color}".` };
    return { ok: true, ship: ship[command.op] === command.color ? ship : { ...ship, [command.op]: command.color } };
  }
  return { ok: false, rule: 'command', message: `Unknown build command "${command.op}".` };
}

// Adds a styling piece. Returns { ok: true, ship, uid } or { ok: false,
// rule, message, uids? }.
export function placePiece(ship, defs, placement) {
  const error = pieceError(ship, defs, placement);
  if (error) return { ok: false, ...error };
  const { type, x, y, rot } = placement;
  const uid = ship.nextUid;
  return { ok: true, uid, ship: { ...ship, styling: [...(ship.styling ?? []), { uid, type, x, y, rot }], nextUid: uid + 1 } };
}

// Moves or turns a styling piece, keeping its uid and place in the order.
function movePiece(ship, defs, uid, { x, y, rot }) {
  const piece = ship.styling.find((p) => p.uid === uid);
  const next = { uid, type: piece.type, x, y, rot };
  const error = pieceError(ship, defs, next, uid);
  if (error) return { ok: false, ...error };
  if (piece.x === x && piece.y === y && piece.rot === rot) return { ok: true, ship };
  return { ok: true, ship: { ...ship, styling: ship.styling.map((p) => (p.uid === uid ? next : p)) } };
}

// A room change's result with the styling pieces it left with nothing to
// hold them taken off.
function tidied(result, defs) {
  if (!result.ok || !result.ship.styling?.length) return result;
  const gone = misfits(result.ship, defs);
  if (!gone.length) return result;
  const removed = result.ship.styling.filter((p) => gone.includes(p.uid));
  return { ...result, ship: { ...result.ship, styling: result.ship.styling.filter((p) => !gone.includes(p.uid)) }, removed };
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

// How the rooms join. Returns { links, openings }:
//   links     Map from each uid to the Set of uids it opens into
//   openings  every gap in the room walls, as { uid, x, y, side, kind }:
//             the cell of module uid and the side of it the gap is on.
//             kind is 'door' (a doorway into the next room), 'open' (no
//             wall: corridors side by side) or 'hatch' (an airlock's outer
//             door, onto space).
// A wall is the run of cell edges one room shares with another along one
// of its sides; its doorway goes on the middle edge (the left or upper one
// of two). A run of corridors counts as one room, so a room beside a long
// corridor gets one doorway per side, not one per corridor cell.
export function joins(ship, defs) {
  const grid = occupancy(ship, defs);
  const placed = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (def && isRotation(module.rot)) placed.set(module.uid, { module, def, facing: facingSide(def, module.rot) });
  }
  const links = new Map(ship.modules.map((module) => [module.uid, new Set()]));
  const openings = [];
  const link = (a, b) => {
    links.get(a).add(b);
    links.get(b).add(a);
  };
  const corridor = (uid) => hasTag(placed.get(uid).def, 'corridor');
  const space = corridorSpaces(placed, grid);

  // Walls: per room and side, the edges it shares with each other room.
  const walls = new Map();
  for (const { module, def, facing } of placed.values()) {
    for (const [x, y] of placedCells(def, module)) {
      for (const side of SIDES) {
        const other = cellAt(grid, ...step(x, y, side));
        if (other === null || other === undefined || other === module.uid) continue;
        if (corridor(module.uid) && corridor(other)) {
          openings.push({ uid: module.uid, x, y, side, kind: 'open' });
          link(module.uid, other);
          continue;
        }
        if (side === facing || OPPOSITE[side] === placed.get(other).facing) continue;
        // Each wall is collected once, from the room that isn't a corridor
        // (the lower uid when neither is).
        if (corridor(module.uid) || (!corridor(other) && other < module.uid)) continue;
        const key = `${module.uid}|${space.get(other) ?? other}|${side}`;
        if (!walls.has(key)) walls.set(key, []);
        walls.get(key).push({ x, y, side, other });
      }
    }
  }
  for (const [key, edges] of walls) {
    const uid = Number(key.split('|')[0]);
    edges.sort((a, b) => a.x - b.x || a.y - b.y);
    const { x, y, side, other } = edges[Math.floor((edges.length - 1) / 2)];
    const [ox, oy] = step(x, y, side);
    openings.push({ uid, x, y, side, kind: 'door' }, { uid: other, x: ox, y: oy, side: OPPOSITE[side], kind: 'door' });
    link(uid, other);
  }

  // Each side of an airlock that faces space has a hatch in its middle.
  const isSpace = spaceTest(ship, defs);
  for (const { module, def } of placed.values()) {
    if (!hasTag(def, 'airlock')) continue;
    for (const side of SIDES) {
      const out = sideCells(def, module, side).filter(([x, y]) => isSpace(...step(x, y, side)));
      if (!out.length) continue;
      const [x, y] = out[Math.floor((out.length - 1) / 2)];
      openings.push({ uid: module.uid, x, y, side, kind: 'hatch' });
    }
  }
  return { links, openings };
}

// Which modules are joined: a Map from each uid to the Set of uids it opens
// into (see joins).
export function connections(ship, defs) {
  return joins(ship, defs).links;
}

// Every gap in the room walls (see joins).
export function openings(ship, defs) {
  return joins(ship, defs).openings;
}

// Corridors side by side make one space: a Map from each corridor's uid to
// the uid of the first corridor of its run in build order.
function corridorSpaces(placed, grid) {
  const space = new Map();
  for (const [uid, { def }] of placed) {
    if (!hasTag(def, 'corridor') || space.has(uid)) continue;
    space.set(uid, uid);
    const queue = [uid];
    while (queue.length) {
      const { module, def: here } = placed.get(queue.pop());
      for (const [x, y] of placedCells(here, module)) {
        for (const side of SIDES) {
          const next = cellAt(grid, ...step(x, y, side));
          if (next === null || next === undefined || space.has(next) || !hasTag(placed.get(next).def, 'corridor')) continue;
          space.set(next, uid);
          queue.push(next);
        }
      }
    }
  }
  return space;
}

// A predicate for open space around the ship: an empty cell joined to the
// outside through empty cells (or off the frame's shape), unless the hull
// closes over it: an empty cell with parts on three or four sides is a
// notch the hull fills (hull.js calls it a pocket).
export function spaceTest(ship, defs) {
  const frame = defs.frames.get(ship.frame);
  const grid = occupancy(ship, defs);
  const outside = exteriorOf(grid, (owner) => owner === null);
  const taken = (x, y) => {
    const owner = cellAt(grid, x, y);
    return owner !== null && owner !== undefined;
  };
  return (x, y) => {
    if (taken(x, y)) return false;
    if (!outside(x, y) && inFrame(frame, x, y)) return false;
    return SIDES.filter((side) => taken(...step(x, y, side))).length < 3;
  };
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

// Uids of airlocks with at least one side facing open space (spaceTest).
export function airlocksOnHullEdge(ship, defs) {
  const isSpace = spaceTest(ship, defs);
  return ship.modules
    .filter((module) => {
      const def = defs.modules.get(module.type);
      if (!def || !hasTag(def, 'airlock') || !isRotation(module.rot)) return false;
      return SIDES.some((side) => sideCells(def, module, side).some(([x, y]) => isSpace(...step(x, y, side))));
    })
    .map((module) => module.uid);
}

// Parts whose facesSpace side doesn't face space all along it, as
// { uid, what }: an engine's exhaust or a gun's barrel with the hull or
// another part in front of it.
export function blockedFacings(ship, defs) {
  const isSpace = spaceTest(ship, defs);
  const blocked = [];
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    const side = def && isRotation(module.rot) ? facingSide(def, module.rot) : null;
    if (!side) continue;
    if (!sideCells(def, module, side).every(([x, y]) => isSpace(...step(x, y, side)))) blocked.push({ uid: module.uid, what: def.facesSpace.what });
  }
  return blocked;
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
      if (!inBounds(area, x, y) || !inFrame(frame, x, y)) {
        add('bounds', `${describeModule(ship, defs, module.uid)} sticks out of the build area.`, [module.uid]);
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
      add('connected', `Not joined to the bridge by a shared wall: ${loose.map((uid) => describeModule(ship, defs, uid)).join(', ')}.`, loose);
    }
  }
  if (airlocksOnHullEdge(ship, defs).length === 0) add('airlock', 'No airlock on the hull edge.');
  for (const { uid, what } of blockedFacings(ship, defs)) {
    add('faces', `${describeModule(ship, defs, uid)} has its ${what} blocked: it has to face space.`, [uid]);
  }
  return problems;
}

// "Reactor at (0, 3)", for messages.
export function describeModule(ship, defs, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  if (!module) return `module ${uid}`;
  const name = defs.modules.get(module.type)?.name ?? module.type;
  return `${name} at (${module.x}, ${module.y})`;
}
