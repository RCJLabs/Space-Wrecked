// The ship on the builder screen, with undo and redo, the selected module and
// the part picked from the palette. Pure: reduceSession(session, action, defs)
// returns a new session, or the same one when nothing changed.
//
// Points arrive in cells (fractions allowed); the screen converts from
// pixels. These rules keep a stray tap from changing the ship:
// - With a part picked from the palette ("armed"), a tap shows it there as a
//   ghost, and only a second tap on the ghost places it. A tap anywhere else
//   moves the ghost. Picking the part again, or Done, stops placing.
// - Tapping a placed part selects it, and a part on the ship moves the same
//   way: with one selected, a tap on the grid shows it there as a ghost
//   (the ghost carries its uid), Turn turns the ghost, and only a tap on the
//   ghost moves it. Tapping another part selects that one instead; tapping
//   the selected part drops the ghost, or lets go of the part.
// - A drag released on the grid places or moves at once. A part that can't
//   go there stays as a ghost, and the notice says why.
// Every change to the ship is a build command (applyCommand in builder.js),
// kept in the history. The session also keeps the build log: every command
// that made the ship from an empty frame, in order, which undo and redo keep
// exact and the replay plays back (replay.js). Launch only goes ahead when
// every line of the flight checklist passes (constraints.js).
//
// In construction mode (a campaign's hangar), the session has a stock: how
// many of each part there are in all, on the ship and on hand. A part only
// goes on while one is on hand, and taking one off puts it back, so undo and
// redo keep the count too. Without a stock (the sandbox), parts are endless.
import { applyCommand, moduleAt, rotateModule, turnedPlacement } from './builder.js';
import { flightChecklist } from './constraints.js';
import { footprint } from './modules.js';

// Undo steps kept; older ones are dropped.
export const HISTORY_LIMIT = 500;
// How far off the frame, in cells, a tap or drag still lands on it.
export const EDGE_GRACE = 1;

// log: the commands that built `ship` from an empty frame (see replay.js).
// stock: { [type]: count } of every part there is, on the ship or on hand,
// or null for no limit.
export function createSession(ship, log = [], stock = null) {
  return { ship, log, stock, past: [], future: [], selected: null, armed: null, ghost: null, notice: null };
}

// How many of a part are on hand to put on the ship: Infinity without a
// stock.
export function partsLeft(session, type) {
  if (!session.stock) return Infinity;
  const fitted = session.ship.modules.filter((m) => m.type === type).length;
  return Math.max(0, (session.stock[type] ?? 0) - fitted);
}

// The commands that built the current ship, oldest first (while the history
// is under HISTORY_LIMIT).
export function commandsOf(session) {
  return session.past.map((entry) => entry.command);
}

export function reduceSession(session, action, defs) {
  switch (action.type) {
    case 'build/arm':
      return arm(session, defs, action.moduleType, action.toggle ?? true);
    case 'build/cancel':
      return cancel(session);
    case 'build/tap':
      return tap(session, defs, action.x, action.y);
    case 'build/drop':
      return place(session, defs, action.placement);
    case 'build/move':
      return move(session, defs, action.uid, action.x, action.y, action.rot);
    case 'build/rotate':
      return rotate(session, defs);
    case 'build/delete':
      return remove(session, defs);
    case 'build/undo':
      return undo(session);
    case 'build/redo':
      return redo(session);
    case 'build/launch':
      return launch(session, defs, action.crew);
    // A ship from elsewhere (another slot, a pasted blueprint, an imported
    // save) replaces this one with its log and stock, and the history
    // starts over.
    case 'build/load':
      return action.ship === session.ship ? session : createSession(action.ship, action.log ?? [], action.stock ?? null);
    default:
      return session;
  }
}

// The placement of `type`, turned `rot`, under point (px, py): held at grab
// (cells from its top-left; its middle by default), snapped to whole cells,
// and slid inside the frame. Null when the point is more than EDGE_GRACE
// cells off the frame. A footprint centered this way always covers the cell
// under the point when that cell is on the frame.
export function snapPlacement(defs, frame, type, rot, px, py, grab) {
  if (px < -EDGE_GRACE || py < -EDGE_GRACE || px >= frame.width + EDGE_GRACE || py >= frame.height + EDGE_GRACE) {
    return null;
  }
  const [w, h] = footprint(defs.modules.get(type), rot);
  const [gx, gy] = grab ?? [w / 2, h / 2];
  return {
    type,
    x: Math.max(0, Math.min(Math.round(px - gx), frame.width - w)),
    y: Math.max(0, Math.min(Math.round(py - gy), frame.height - h)),
    rot,
  };
}

// True if the placement's footprint covers cell (x, y).
export function covers(defs, placement, x, y) {
  const [w, h] = footprint(defs.modules.get(placement.type), placement.rot);
  return x >= placement.x && y >= placement.y && x < placement.x + w && y < placement.y + h;
}

// Picking the armed part again stops placing, unless toggle is false (a
// checklist fix that picks the part for you).
function arm(session, defs, type, toggle) {
  if (!defs.modules.has(type)) return session;
  if (session.armed?.type === type) return toggle ? { ...session, armed: null, ghost: null } : session;
  if (partsLeft(session, type) < 1) return withNotice(session, 'bad', noneLeft(defs, type));
  return { ...session, armed: { type, rot: 0 }, ghost: null, selected: null };
}

function cancel(session) {
  if (!session.armed && !session.ghost && session.selected === null) return session;
  return { ...session, armed: null, ghost: null, selected: null };
}

function tap(session, defs, px, py) {
  const { ship, armed, ghost, selected } = session;
  const frame = defs.frames.get(ship.frame);
  if (!frame) return session;
  const x = Math.floor(px);
  const y = Math.floor(py);
  if (armed) {
    if (ghost && covers(defs, ghost, x, y)) return place(session, defs, ghost);
    const next = snapPlacement(defs, frame, armed.type, armed.rot, px, py);
    if (!next) return ghost ? { ...session, ghost: null } : session;
    if (ghost && ghost.x === next.x && ghost.y === next.y) return session;
    return { ...session, ghost: next };
  }
  if (ghost && covers(defs, ghost, x, y)) return moveTo(session, defs, ghost);
  const uid = moduleAt(ship, defs, x, y);
  if (uid !== null && uid === selected) return ghost ? { ...session, ghost: null } : { ...session, selected: null };
  if (uid !== null) return { ...session, selected: uid, ghost: null };
  const module = ship.modules.find((m) => m.uid === selected);
  if (!module || !defs.modules.has(module.type)) return session;
  // Empty grid with a part selected: show the part there, to move it.
  const next = snapPlacement(defs, frame, module.type, ghost?.rot ?? module.rot, px, py);
  if (!next) return ghost ? { ...session, ghost: null } : session;
  if (ghost && ghost.x === next.x && ghost.y === next.y) return session;
  return { ...session, ghost: { ...next, uid: module.uid } };
}

// Moves a selected part to its ghost. A move it can't make leaves the ghost
// where it is, and the notice says why.
function moveTo(session, defs, ghost) {
  const { uid, x, y, rot } = ghost;
  const module = session.ship.modules.find((m) => m.uid === uid);
  if (!module) return { ...session, ghost: null };
  const command = { op: 'move', uid, x, y, rot };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return { ...session, ghost: null };
  const name = nameOf(defs, module.type);
  return withNotice({ ...record(session, result.ship, command, `move ${name}`), selected: uid, ghost: null }, 'good', `Moved ${name}.`);
}

// Places a part from a confirmed ghost or a drop. A part placed while it is
// armed stays armed for the next one, while there is one; otherwise the new
// module is selected.
function place(session, defs, placement) {
  const def = defs.modules.get(placement.type);
  if (!def) return session;
  const { type, x, y, rot } = placement;
  if (partsLeft(session, type) < 1) return withNotice({ ...session, armed: null, ghost: null }, 'bad', noneLeft(defs, type));
  const result = applyCommand(session.ship, defs, { op: 'place', type, x, y, rot });
  if (!result.ok) {
    const ghost = { type, x, y, rot };
    return withNotice({ ...session, armed: { type, rot }, ghost, selected: null }, 'bad', result.message);
  }
  const next = record(session, result.ship, { op: 'place', uid: result.uid, type, x, y, rot }, `place ${def.name}`);
  const stayArmed = session.armed?.type === type && partsLeft(next, type) > 0;
  return withNotice(
    { ...next, armed: stayArmed ? { type, rot } : null, ghost: null, selected: stayArmed ? null : result.uid },
    'good',
    `Placed ${def.name}.`,
  );
}

// rot: the turn it ends up with (a turned ghost's), or as it is.
function move(session, defs, uid, x, y, rot) {
  const module = session.ship.modules.find((m) => m.uid === uid);
  if (!module) return session;
  const command = { op: 'move', uid, x, y, rot: rot ?? module.rot };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return session.ghost?.uid === undefined ? session : { ...session, ghost: null };
  return { ...record(session, result.ship, command, `move ${nameOf(defs, module.type)}`), selected: uid, ghost: null };
}

function rotate(session, defs) {
  const { armed, ghost, ship, selected } = session;
  if (armed) {
    const def = defs.modules.get(armed.type);
    if (!def.rotates) return withNotice(session, 'bad', `${def.name} can't be rotated.`);
    const frame = defs.frames.get(ship.frame);
    return {
      ...session,
      armed: { ...armed, rot: (armed.rot + 1) % 4 },
      ghost: ghost && turnedPlacement(def, ghost, frame),
    };
  }
  if (ghost) {
    // A part being moved: its ghost turns, and the move takes the turn too.
    const def = defs.modules.get(ghost.type);
    if (!def.rotates) return withNotice(session, 'bad', `${def.name} can't be rotated.`);
    return { ...session, ghost: { ...turnedPlacement(def, ghost, defs.frames.get(ship.frame)), uid: ghost.uid } };
  }
  if (selected === null) return session;
  const result = rotateModule(ship, defs, selected);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  const { x, y, rot } = result.placement;
  const name = nameOf(defs, result.placement.type);
  return record(session, result.ship, { op: 'move', uid: selected, x, y, rot }, `turn ${name}`);
}

function remove(session, defs) {
  const module = session.ship.modules.find((m) => m.uid === session.selected);
  if (!module) return session;
  const result = applyCommand(session.ship, defs, { op: 'remove', uid: module.uid });
  const name = nameOf(defs, module.type);
  const next = record(session, result.ship, { op: 'remove', uid: module.uid }, `remove ${name}`);
  return withNotice({ ...next, selected: null, ghost: null }, 'info', `Removed ${name}.`);
}

function undo(session) {
  const entry = session.past.at(-1);
  if (!entry) return session;
  const next = { ...session, ship: entry.before, log: session.log.slice(0, -1), past: session.past.slice(0, -1), future: [...session.future, entry], ghost: placing(session) };
  return withNotice(focus(next, entry), 'info', `Undone: ${entry.label}.`);
}

function redo(session) {
  const entry = session.future.at(-1);
  if (!entry) return session;
  const next = { ...session, ship: entry.after, log: [...session.log, entry.command], past: [...session.past, entry], future: session.future.slice(0, -1), ghost: placing(session) };
  return withNotice(focus(next, entry), 'info', `Redone: ${entry.label}.`);
}

// The launch itself is act 1's (M17); for now the check is the point: a
// ship that fails any line can't go, and the notice names the first fix.
function launch(session, defs, crew) {
  const open = flightChecklist(session.ship, defs, crew).filter((line) => line.ok !== true);
  if (!open.length) return withNotice(session, 'good', 'Every flight check passes: cleared for launch.');
  const count = `${open.length} flight check${open.length === 1 ? '' : 's'}`;
  return withNotice(session, 'bad', `Can't launch: ${count} to fix. ${open.find((line) => line.fix).fix}.`);
}

// After an undo or redo, select the module it changed so the player can see
// what happened (unless a part is armed, which can't share the screen with a
// selection).
function focus(session, entry) {
  if (session.armed) return session.selected === null ? session : { ...session, selected: null };
  const uid = entry.command.uid;
  const selected = session.ship.modules.some((m) => m.uid === uid) ? uid : null;
  return selected === session.selected ? session : { ...session, selected };
}

// The ghost of a part being placed survives undo and redo; the ghost of a
// part being moved doesn't, as the part may have gone or moved.
function placing(session) {
  return session.ghost?.uid === undefined ? session.ghost : null;
}

function record(session, ship, command, label) {
  const past = [...session.past, { before: session.ship, after: ship, command, label }];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { ...session, ship, log: [...session.log, command], past, future: [] };
}

function withNotice(session, tone, text) {
  return { ...session, notice: { id: (session.notice?.id ?? 0) + 1, tone, text } };
}

function nameOf(defs, type) {
  return defs.modules.get(type)?.name ?? type;
}

function noneLeft(defs, type) {
  return `No ${nameOf(defs, type)} on hand.`;
}
