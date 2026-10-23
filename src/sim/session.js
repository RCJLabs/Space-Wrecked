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
// the hull's style (build/hull), paint and trim included, kept in the
// history. The session
// also keeps the build log: every command that made the ship from an empty
// frame, in order, which undo and redo keep exact and the replay plays back
// (replay.js). Launch only goes ahead when every line of the flight
// checklist passes (constraints.js).
//
// In construction mode (a campaign's hangar, or a station on the run), the
// session has a stock: how many of each part there are in all, on the ship
// and on hand. A part only goes on while one is on hand, and taking one off
// puts it back, so undo and redo keep the count too. Without a stock (the
// sandbox), parts are endless. Styling pieces (styling.js, M23f) are
// endless either way. On the run, the parts an approach wrecked stay aboard
// until a station repairs them (campaign.js refitShip): they move and turn,
// but Delete leaves them on.
//
// The session works on one layer at a time: the rooms (the plans) or the
// styling (the Look, from outside). Taps pick out what is on its layer, and
// the Turn and Delete buttons act on it; a piece picked from the Look tab
// takes the session to the styling layer. A piece placed by a tap fits
// itself to the hull where it can: turned the way it was, else another way
// it takes (fitPiece), and Turn shows it the next way round.
//
// M44: a run of corridors laid by a drag (build/run), another maker's
// version swapped in for a placed part (build/swap) and Suggest (the
// fitter's spot for the armed part's ghost, build/suggest). A run and a
// swap are one undo step each, but the log keeps their commands one by one
// (a run's places; a swap's remove and place), so a log reads as it always
// has.
import { applyCommand, moduleAt, rotateModule, turnedPlacement } from './builder.js';
import { flightChecklist } from './constraints.js';
import { suggestSpot } from './fit.js';
import { baseOf } from './makers.js';
import { footprint } from './modules.js';
import { fitPiece, nextTurn, pieceAt, pieceFootprint } from './styling.js';

// Undo steps kept; older ones are dropped.
export const HISTORY_LIMIT = 500;
// How far off the frame, in cells, a tap or drag still lands on it.
export const EDGE_GRACE = 1;
// How far, in cells, a styling piece looks round a tap for a spot that fits
// when none covers the tapped cell: a tap on the hull's roof by its side.
export const PIECE_REACH = 1;

// log: the commands that built `ship` from an empty frame (see replay.js).
// stock: { [type]: count } of every part there is, on the ship or on hand,
// or null for no limit. wrecked: the uids of the parts that can't come off
// (wrecked, until a station repairs them, or scrapped for a spare: swap).
// rearrange: true between jumps (M46, rearrange.js): parts move and turn,
// but none comes off.
export function createSession(ship, log = [], stock = null, wrecked = [], { rearrange = false } = {}) {
  return { ship, log, stock, wrecked, ...(rearrange ? { rearrange } : {}), layer: 'rooms', past: [], future: [], selected: null, armed: null, ghost: null, notice: null };
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
  return session.past.flatMap((entry) => entry.commands ?? [entry.command]);
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
    case 'build/run':
      return run(session, defs, action.cells);
    case 'build/swap':
      return swap(session, defs, action.uid, action.moduleType);
    case 'build/suggest':
      return suggest(session, defs);
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
    case 'build/hull':
      return restyle(session, defs, action.style);
    case 'build/paint':
    case 'build/trim':
      return paint(session, defs, action.type === 'build/paint' ? 'paint' : 'trim', action.color);
    case 'build/layer':
      return layer(session, action.layer);
    // A ship from elsewhere (another slot, a pasted blueprint, an imported
    // save) replaces this one with its log and stock, and the history
    // starts over, on the same layer.
    case 'build/load':
      return action.ship === session.ship ? session : { ...createSession(action.ship, action.log ?? [], action.stock ?? null), layer: session.layer };
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

// True if the placement's footprint covers cell (x, y). It may be a part's
// or a styling piece's.
export function covers(defs, placement, x, y) {
  const [w, h] = sizeOf(defs, placement);
  return x >= placement.x && y >= placement.y && x < placement.x + w && y < placement.y + h;
}

// A placement's footprint, [w, h], a part's or a styling piece's.
export function sizeOf(defs, { type, rot }) {
  const piece = defs.styling?.get(type);
  return piece ? pieceFootprint(piece, rot) : footprint(defs.modules.get(type), rot);
}

function isPiece(defs, type) {
  return Boolean(defs.styling?.has(type));
}

// Picking the armed part again stops placing, unless toggle is false (a
// checklist fix that picks the part for you). A styling piece takes the
// session to the styling layer, a part to the rooms.
function arm(session, defs, type, toggle) {
  const piece = defs.styling?.get(type);
  if (!piece && !defs.modules.has(type)) return session;
  if (session.armed?.type === type) return toggle ? { ...session, armed: null, ghost: null } : session;
  if (!piece && partsLeft(session, type) < 1) return withNotice(session, 'bad', noneLeft(defs, type));
  return { ...session, layer: piece ? 'styling' : 'rooms', armed: { type, rot: piece ? piece.turns[0] : 0 }, ghost: null, selected: null };
}

// Works on the rooms or on the styling: what is picked out on the other
// layer is let go.
function layer(session, next) {
  if (next !== 'rooms' && next !== 'styling') return session;
  if (session.layer === next) return session;
  return { ...session, layer: next, armed: null, ghost: null, selected: null };
}

function cancel(session) {
  if (!session.armed && !session.ghost && session.selected === null) return session;
  return { ...session, armed: null, ghost: null, selected: null };
}

// Whether a tap at (px, py) lands on the ghost, so would put the part down or
// move it there (M47: with holds confirming, the screen asks for a hold
// instead).
export function tapOnGhost(session, defs, px, py) {
  return Boolean(session.ghost) && covers(defs, session.ghost, Math.floor(px), Math.floor(py));
}

function tap(session, defs, px, py) {
  const { ship, armed, ghost, selected } = session;
  const frame = defs.frames.get(ship.frame);
  if (!frame) return session;
  const x = Math.floor(px);
  const y = Math.floor(py);
  if (armed) {
    if (ghost && covers(defs, ghost, x, y)) return place(session, defs, ghost);
    const next = isPiece(defs, armed.type) ? pieceGhost(session, defs, armed.type, armed.rot, px, py) : snapPlacement(defs, frame, armed.type, armed.rot, px, py);
    if (!next) return ghost ? { ...session, ghost: null } : session;
    if (ghost && ghost.x === next.x && ghost.y === next.y && ghost.rot === next.rot) return session;
    return { ...session, ghost: next };
  }
  if (ghost && covers(defs, ghost, x, y)) return moveTo(session, defs, ghost);
  const styling = session.layer === 'styling';
  const uid = styling ? pieceAt(ship, defs, x, y) : moduleAt(ship, defs, x, y);
  if (uid !== null && uid === selected) return ghost ? { ...session, ghost: null } : { ...session, selected: null };
  if (uid !== null) return { ...session, selected: uid, ghost: null };
  const item = (styling ? ship.styling ?? [] : ship.modules).find((m) => m.uid === selected);
  if (!item || !(styling ? defs.styling?.has(item.type) : defs.modules.has(item.type))) return session;
  // Empty grid with a part selected: show the part there, to move it.
  const next = styling ? pieceGhost(session, defs, item.type, ghost?.rot ?? item.rot, px, py, item.uid) : snapPlacement(defs, frame, item.type, ghost?.rot ?? item.rot, px, py);
  if (!next) return ghost ? { ...session, ghost: null } : session;
  if (ghost && ghost.x === next.x && ghost.y === next.y && ghost.rot === next.rot) return session;
  return { ...session, ghost: { ...next, uid: item.uid } };
}

// Where a styling piece would go for a tap or a finger at (px, py): fitted
// to the hull there, or as near as PIECE_REACH (fitPiece), or null off the
// frame. It keeps the point, so a turn can fit it again round the same
// spot. ignore: a piece being moved; site: hullSite(ship, defs), if the
// caller has it (a drag asks again at every cell).
export function snapPiece(ship, defs, type, rot, px, py, { ignore = null, site = null } = {}) {
  const frame = defs.frames.get(ship.frame);
  if (px < -EDGE_GRACE || py < -EDGE_GRACE || px >= frame.width + EDGE_GRACE || py >= frame.height + EDGE_GRACE) return null;
  const at = [Math.max(0, Math.min(frame.width - 0.01, px)), Math.max(0, Math.min(frame.height - 0.01, py))];
  return { ...fitPiece(ship, defs, type, rot, ...at, { ignore, site, reach: PIECE_REACH }), at };
}

function pieceGhost(session, defs, type, rot, px, py, ignore = null) {
  return snapPiece(session.ship, defs, type, rot, px, py, { ignore });
}

// Moves a selected part to its ghost. A move it can't make leaves the ghost
// where it is, and the notice says why.
function moveTo(session, defs, ghost) {
  const { uid, x, y, rot } = ghost;
  const item = itemOf(session.ship, uid);
  if (!item) return { ...session, ghost: null };
  const command = { op: 'move', uid, x, y, rot };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return { ...session, ghost: null };
  const name = nameOf(defs, item.type);
  return withNotice({ ...record(session, result.ship, command, `move ${name}`), selected: uid, ghost: null }, 'good', `Moved ${name}.${cameOff(defs, result.removed)}`);
}

// A module or a styling piece by uid.
function itemOf(ship, uid) {
  return ship.modules.find((m) => m.uid === uid) ?? (ship.styling ?? []).find((p) => p.uid === uid) ?? null;
}

// What a room change took off with it, for its notice.
function cameOff(defs, removed = []) {
  if (!removed.length) return '';
  return removed.length === 1 ? ` The ${nameOf(defs, removed[0].type)} came off.` : ` ${removed.length} styling pieces came off.`;
}

// Places a part from a confirmed ghost or a drop. A part placed while it is
// armed stays armed for the next one, while there is one; otherwise the new
// module is selected.
function place(session, defs, placement) {
  const piece = defs.styling?.get(placement.type);
  const def = piece ?? defs.modules.get(placement.type);
  if (!def) return session;
  const { type, x, y, rot } = placement;
  if (!piece && partsLeft(session, type) < 1) return withNotice({ ...session, armed: null, ghost: null }, 'bad', noneLeft(defs, type));
  const result = applyCommand(session.ship, defs, { op: 'place', type, x, y, rot });
  if (!result.ok) {
    const ghost = { type, x, y, rot, ...(placement.at ? { at: placement.at } : {}) };
    return withNotice({ ...session, layer: piece ? 'styling' : 'rooms', armed: { type, rot }, ghost, selected: null }, 'bad', result.message);
  }
  const next = record(session, result.ship, { op: 'place', uid: result.uid, type, x, y, rot }, `place ${def.name}`);
  const stayArmed = session.armed?.type === type && (piece || partsLeft(next, type) > 0);
  return withNotice(
    { ...next, layer: piece ? 'styling' : 'rooms', armed: stayArmed ? { type, rot } : null, ghost: null, selected: stayArmed ? null : result.uid },
    'good',
    `Placed ${def.name}.${cameOff(defs, result.removed)}`,
  );
}

// A run of the armed part (a corridor, M44): one placed on each cell in
// turn, as one undo step, stopping short at the first cell that can't take
// one or when none is left on hand. cells: [[x, y], ...] in the order the
// finger crossed them.
function run(session, defs, cells) {
  const type = session.armed?.type;
  const def = type && defs.modules.get(type);
  if (!def || baseOf(def) !== 'corridor' || !Array.isArray(cells) || !cells.length) return session;
  const { rot } = session.armed;
  let ship = session.ship;
  const commands = [];
  let stop = null;
  for (const [x, y] of cells) {
    if (partsLeft({ ...session, ship }, type) < 1) {
      stop = noneLeft(defs, type);
      break;
    }
    const result = applyCommand(ship, defs, { op: 'place', type, x, y, rot });
    if (!result.ok) {
      stop = result.message;
      break;
    }
    ship = result.ship;
    commands.push({ op: 'place', uid: result.uid, type, x, y, rot });
  }
  if (!commands.length) return withNotice({ ...session, ghost: null }, 'bad', stop ?? `No ${def.name} placed.`);
  const next = record(session, ship, commands, `place ${commands.length} × ${def.name}`);
  const stayArmed = partsLeft(next, type) > 0;
  const said = `Placed ${commands.length === 1 ? def.name : `${commands.length} × ${def.name}`}.`;
  return withNotice({ ...next, armed: stayArmed ? session.armed : null, ghost: null, selected: null }, stop ? 'info' : 'good', stop ? `${said} Stopped: ${stop}` : said);
}

// Another maker's version of a placed part, on hand, swapped in where it
// stands (M44): the same spot and turn, one undo step, the old one back on
// hand. The log keeps a remove and a place, and any styling piece the
// remove took off goes back on after. A wrecked part is scrapped for the
// spare (M46), any maker's version of it, the same one too: the wreck is
// gone, not back on hand, and as that can't be taken back (the campaign
// keeps no wreck to return), the history starts over. Between jumps
// nothing is swapped.
function swap(session, defs, uid, type) {
  const item = session.ship.modules.find((m) => m.uid === uid);
  const def = defs.modules.get(type);
  const wrecked = Boolean(session.wrecked?.includes(uid));
  if (!item || !def || (item.type === type && !wrecked)) return session;
  const old = defs.modules.get(item.type);
  if (session.rearrange) return withNotice(session, 'bad', `Between jumps parts only move and turn: swap the ${old.name} at a station or a shipyard.`);
  if (baseOf(old) !== baseOf(def)) return withNotice(session, 'bad', `A ${def.name} can't stand in for the ${old.name}.`);
  if (partsLeft(session, type) < 1) return withNotice(session, 'bad', noneLeft(defs, type));
  const removed = applyCommand(session.ship, defs, { op: 'remove', uid });
  const { x, y, rot } = item;
  const placed = applyCommand(removed.ship, defs, { op: 'place', type, x, y, rot });
  if (!placed.ok) return withNotice(session, 'bad', placed.message);
  let ship = placed.ship;
  const commands = [{ op: 'remove', uid }, { op: 'place', uid: placed.uid, type, x, y, rot }];
  for (const piece of removed.removed ?? []) {
    const back = applyCommand(ship, defs, { op: 'place', type: piece.type, x: piece.x, y: piece.y, rot: piece.rot });
    if (!back.ok) continue;
    ship = back.ship;
    commands.push({ op: 'place', uid: back.uid, type: piece.type, x: piece.x, y: piece.y, rot: piece.rot });
  }
  if (wrecked) {
    const stock = { ...session.stock, [item.type]: (session.stock?.[item.type] ?? 1) - 1 };
    if (!stock[item.type]) delete stock[item.type];
    const scrapped = { ...record(session, ship, commands, `scrap ${old.name} for ${def.name}`), stock, wrecked: session.wrecked.filter((w) => w !== uid), past: [], future: [] };
    return withNotice({ ...scrapped, selected: placed.uid, ghost: null }, 'good', `Scrapped the wrecked ${old.name}: a ${def.name} in its place. A scrap can't be undone.`);
  }
  const next = record(session, ship, commands, `swap ${old.name} for ${def.name}`);
  return withNotice({ ...next, selected: placed.uid, ghost: null }, 'good', `Swapped the ${old.name} for a ${def.name}.`);
}

// Suggest (M44): the armed part's ghost where the fitter finds best
// (fit.js suggestSpot), for a second tap to place.
function suggest(session, defs) {
  const type = session.armed?.type;
  if (!type || !defs.modules.has(type)) return session;
  const at = suggestSpot(session.ship, defs, type);
  const name = nameOf(defs, type);
  if (!at) return withNotice({ ...session, ghost: null }, 'bad', `No spot for the ${name} joins the ship as it stands.`);
  return withNotice({ ...session, armed: { ...session.armed, rot: at.rot }, ghost: { type, ...at } }, 'info', `The ${name} fits best here: tap it to place it.`);
}

// rot: the turn it ends up with (a turned ghost's), or as it is.
function move(session, defs, uid, x, y, rot) {
  const item = itemOf(session.ship, uid);
  if (!item) return session;
  const command = { op: 'move', uid, x, y, rot: rot ?? item.rot };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return session.ghost?.uid === undefined ? session : { ...session, ghost: null };
  const next = { ...record(session, result.ship, command, `move ${nameOf(defs, item.type)}`), selected: uid, ghost: null };
  return result.removed?.length ? withNotice(next, 'info', `Moved ${nameOf(defs, item.type)}.${cameOff(defs, result.removed)}`) : next;
}

function rotate(session, defs) {
  const { armed, ghost, ship, selected } = session;
  const pieceType = armed?.type ?? ghost?.type ?? (ship.styling ?? []).find((p) => p.uid === selected)?.type;
  if (pieceType && isPiece(defs, pieceType)) return turnPiece(session, defs);
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
  const next = record(session, result.ship, { op: 'move', uid: selected, x, y, rot }, `turn ${name}`);
  return result.removed?.length ? withNotice(next, 'info', `Turned ${name}.${cameOff(defs, result.removed)}`) : next;
}

// Turn for a styling piece: one being placed or moved shows its next turn
// round the spot it was tapped at, fitted there if it can be; a placed one
// takes the next turn that fits where it is, if any does.
function turnPiece(session, defs) {
  const { armed, ghost, ship, selected } = session;
  if (armed || ghost) {
    const type = (armed ?? ghost).type;
    const def = defs.styling.get(type);
    if (def.turns.length < 2) return withNotice(session, 'bad', `${def.name} doesn't turn.`);
    const rot = nextTurn(def, (ghost ?? armed).rot);
    const next = { ...session, ...(armed ? { armed: { ...armed, rot } } : {}) };
    if (!ghost) return next;
    const [gw, gh] = sizeOf(defs, ghost);
    const at = ghost.at ?? [ghost.x + gw / 2, ghost.y + gh / 2];
    return { ...next, ghost: { ...fitPiece(ship, defs, type, rot, ...at, { ignore: ghost.uid ?? null, turnsToo: false, reach: PIECE_REACH }), at, ...(ghost.uid === undefined ? {} : { uid: ghost.uid }) } };
  }
  const piece = (ship.styling ?? []).find((p) => p.uid === selected);
  const def = defs.styling.get(piece.type);
  const [w, h] = pieceFootprint(def, piece.rot);
  const at = [piece.x + w / 2, piece.y + h / 2];
  for (let rot = nextTurn(def, piece.rot); rot !== piece.rot; rot = nextTurn(def, rot)) {
    const turned = fitPiece(ship, defs, piece.type, rot, ...at, { ignore: piece.uid, turnsToo: false });
    const result = applyCommand(ship, defs, { op: 'move', uid: piece.uid, x: turned.x, y: turned.y, rot: turned.rot });
    if (result.ok) return record(session, result.ship, { op: 'move', uid: piece.uid, x: turned.x, y: turned.y, rot: turned.rot }, `turn ${def.name}`);
  }
  return withNotice(session, 'bad', `The ${def.name} can't turn here.`);
}

function remove(session, defs) {
  const item = itemOf(session.ship, session.selected);
  if (!item) return session;
  const name = nameOf(defs, item.type);
  if (session.rearrange && session.ship.modules.includes(item)) return withNotice(session, 'bad', `Between jumps parts only move and turn: the ${name} comes off at a station or a shipyard.`);
  if (session.wrecked?.includes(item.uid)) return withNotice(session, 'bad', `The ${name} is wrecked: it comes off once the station repairs it, or scrap it for a spare on hand. It can still move.`);
  const result = applyCommand(session.ship, defs, { op: 'remove', uid: item.uid });
  const next = record(session, result.ship, { op: 'remove', uid: item.uid }, `remove ${name}`);
  return withNotice({ ...next, selected: null, ghost: null }, 'info', `Removed ${name}.${cameOff(defs, result.removed)}`);
}

function undo(session) {
  const entry = session.past.at(-1);
  if (!entry) return session;
  const next = { ...session, ship: entry.before, log: session.log.slice(0, session.log.length - (entry.commands?.length ?? 1)), past: session.past.slice(0, -1), future: [...session.future, entry], ghost: placing(session) };
  return withNotice(focus(next, entry), 'info', `Undone: ${entry.label}.`);
}

function redo(session) {
  const entry = session.future.at(-1);
  if (!entry) return session;
  const next = { ...session, ship: entry.after, log: [...session.log, ...(entry.commands ?? [entry.command])], past: [...session.past, entry], future: session.future.slice(0, -1), ghost: placing(session) };
  return withNotice(focus(next, entry), 'info', `Redone: ${entry.label}.`);
}

// Gives the hull another style (data/hulls.json), a step undo takes back.
// It changes how the ship looks from outside, and nothing else.
function restyle(session, defs, style) {
  const command = { op: 'hull', style };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return session;
  const name = defs.hulls.get(style).name;
  return withNotice(record(session, result.ship, command, `${name.toLowerCase()} hull`), 'good', `${name} hull.`);
}

// Paints the hull or its trim (data/styling.json), a step undo takes back.
function paint(session, defs, op, color) {
  const command = { op, color };
  const result = applyCommand(session.ship, defs, command);
  if (!result.ok) return withNotice(session, 'bad', result.message);
  if (result.ship === session.ship) return session;
  const name = (op === 'paint' ? defs.paints : defs.trims).get(color).name;
  return withNotice(record(session, result.ship, command, `${name.toLowerCase()} ${op}`), 'good', `${name} ${op}.`);
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
  const onLayer = session.layer === 'styling' ? session.ship.styling ?? [] : session.ship.modules;
  const selected = onLayer.some((m) => m.uid === uid) ? uid : null;
  return selected === session.selected ? session : { ...session, selected };
}

// The ghost of a part being placed survives undo and redo; the ghost of a
// part being moved doesn't, as the part may have gone or moved.
function placing(session) {
  return session.ghost?.uid === undefined ? session.ghost : null;
}

// One undo step. commands: the build commands it took, one or several (a
// run, a swap); the entry's command is the last, which undo and redo focus.
function record(session, ship, commands, label) {
  const list = Array.isArray(commands) ? commands : [commands];
  const entry = { before: session.ship, after: ship, command: list.at(-1), label, ...(list.length > 1 ? { commands: list } : {}) };
  const past = [...session.past, entry];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { ...session, ship, log: [...session.log, ...list], past, future: [] };
}

function withNotice(session, tone, text) {
  return { ...session, notice: { id: (session.notice?.id ?? 0) + 1, tone, text } };
}

function nameOf(defs, type) {
  return defs.modules.get(type)?.name ?? defs.styling?.get(type)?.name ?? type;
}

function noneLeft(defs, type) {
  return `No ${nameOf(defs, type)} on hand.`;
}
