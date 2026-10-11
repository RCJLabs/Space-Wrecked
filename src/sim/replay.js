// Builds played back. A ship's build log is every command that made it from
// an empty frame, in order (session.js keeps it as the player builds), so
// replaying the log shows the build step by step: the timelapse. Pure.
import { applyCommand, newShip } from './builder.js';

// The ship after each step: ships[0] is the empty frame, ships[n] the ship
// after n commands. A command that no longer applies (content changed since
// it was recorded) stops the replay there, with { index, message }.
export function replay(log, defs, frameId) {
  const ships = [newShip(frameId)];
  for (const [index, command] of log.entries()) {
    const result = applyCommand(ships.at(-1), defs, command);
    if (!result.ok || (command.op === 'place' && command.uid !== undefined && command.uid !== result.uid)) {
      return { ships, error: { index, message: result.message ?? `Step ${index + 1} placed a different part.` } };
    }
    ships.push(result.ship);
  }
  return { ships, error: null };
}

// A log that builds the ship part by part in its build order. It only
// reproduces the ship exactly when its uids run 1, 2, 3...: see renumbered.
export function logFor(ship) {
  return ship.modules.map(({ uid, type, x, y, rot }) => ({ op: 'place', uid, type, x, y, rot }));
}

// The ship with its parts numbered 1, 2, 3... in build order.
export function renumbered(ship) {
  const modules = ship.modules.map((m, i) => (m.uid === i + 1 ? m : { ...m, uid: i + 1 }));
  const nextUid = modules.length + 1;
  if (modules.every((m, i) => m === ship.modules[i]) && ship.nextUid === nextUid) return ship;
  return { ...ship, modules, nextUid };
}

// True if replaying the log makes exactly this ship.
export function logMatches(log, ship, defs) {
  const { ships, error } = replay(log, defs, ship.frame);
  return !error && JSON.stringify(ships.at(-1)) === JSON.stringify(ship);
}

// Logs longer than this are shortened when a ship is opened: to a part-by-
// part build of what is there now. The timelapse loses the detours; the
// save stays small.
export const LOG_LIMIT = 600;

// A ship and a log that replays to it, ready for a builder session. A log
// that doesn't match its ship (damaged, or made before logs were kept) or is
// too long is rebuilt from the ship as it is, renumbering its parts. The
// ship's layout never changes.
export function openBuild(ship, log, defs) {
  if (Array.isArray(log) && log.length <= LOG_LIMIT && logMatches(log, ship, defs)) return { ship, log };
  const tidy = renumbered(ship);
  return { ship: tidy, log: logFor(tidy) };
}

// True if value has the shape of a build command (see applyCommand).
export function isCommand(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const whole = (n) => Number.isInteger(n);
  if (value.op === 'remove') return whole(value.uid) && value.uid > 0;
  if (value.op !== 'place' && value.op !== 'move') return false;
  if (value.op === 'move' && !(whole(value.uid) && value.uid > 0)) return false;
  if (value.op === 'place' && value.uid !== undefined && !(whole(value.uid) && value.uid > 0)) return false;
  return (value.op === 'move' || (typeof value.type === 'string' && value.type !== '')) && whole(value.x) && whole(value.y) && [0, 1, 2, 3].includes(value.rot);
}
