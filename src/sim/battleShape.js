// Whether a battle saved mid-fight reads back: the shape battle.js gives a
// battle, and mapFromShip.js its map, field by field. Whether the battle
// still makes sense under the rules is battle.js's business, not this; a
// save only has to be readable without anything throwing.
import { isState } from '../core/rng.js';
import { SIDES } from './grid.js';
import { WRECKS } from './mapFromShip.js';

export const STATUSES = ['active', 'down', 'stable', 'dead', 'out', 'held'];
const TEAMS = ['crew', 'enemy'];
const EDGES = [null, 'wall', 'hull', 'door', 'hatch'];
const STATS = ['aim', 'defense', 'mobility', 'armor'];
const MAX = 100000; // past any count or stat a battle can reach
const MAX_TILES = 512; // tiles across a map

// Null if value reads as a battle, or else what is wrong with it, in words
// that follow "the fight": "has an unreadable map".
export function battleProblem(value) {
  if (!isRecord(value)) return 'is unreadable';
  const { map } = value;
  if (!isMap(map)) return 'has an unreadable map';
  if (!Array.isArray(value.units) || !value.units.length) return 'has no units';
  const ids = new Set();
  for (const unit of value.units) {
    if (!isUnit(unit, map) || ids.has(unit.id)) return 'has an unreadable unit';
    ids.add(unit.id);
  }
  if (!Array.isArray(value.doors) || !value.doors.every((key) => typeof key === 'string')) return 'has unreadable doors';
  if (!Array.isArray(value.welds) || !value.welds.every((weld) => isRecord(weld) && typeof weld.key === 'string' && isInt(weld.until, 1, MAX))) return 'has unreadable welds';
  // Fires a weapon set (M37): absent until the first.
  const onMap = (at) => Array.isArray(at) && at.length === 2 && isInt(at[0], 0, map.width - 1) && isInt(at[1], 0, map.height - 1);
  if (value.fires !== undefined && !(Array.isArray(value.fires) && value.fires.every((fire) => isRecord(fire) && onMap(fire.at) && isInt(fire.until, 1, MAX)))) return 'has unreadable fires';
  if (!TEAMS.includes(value.side) || !TEAMS.includes(value.first) || !isInt(value.round, 1, MAX) || !isState(value.rng)) {
    return 'has an unreadable turn';
  }
  if (!isRecord(value.misses) || !TEAMS.every((side) => isInt(value.misses[side], 0, MAX))) return 'has unreadable misses';
  if (!isOptions(value.options)) return 'has unreadable options';
  if (value.objective !== null && !isObjective(value.objective, map)) return 'has an unreadable objective';
  if (value.winner !== null && !TEAMS.includes(value.winner)) return 'has an unreadable winner';
  return null;
}

function isOptions(options) {
  return (
    isRecord(options) && typeof options.forgiving === 'boolean' && typeof options.permadeath === 'boolean' &&
    (options.sight === undefined || isInt(options.sight, 1, MAX_TILES)) &&
    (options.deadline === undefined || isInt(options.deadline, 1, MAX)) &&
    (options.press === undefined || typeof options.press === 'boolean')
  );
}

// The objectives objectives.js knows, each as it gives them.
function isObjective(objective, map) {
  if (!isRecord(objective)) return false;
  const isTile = (at) => Array.isArray(at) && at.length === 2 && isInt(at[0], 0, map.width - 1) && isInt(at[1], 0, map.height - 1);
  const tiles = (list) => Array.isArray(list) && list.length > 0 && list.every(isTile) && new Set(list.map(String)).size === list.length;
  const within = (list, of) => Array.isArray(list) && list.every(isTile) && new Set(list.map(String)).size === list.length && list.every((at) => of.some((o) => String(o) === String(at)));
  const isWard = (id) => typeof id === 'string' && id !== '';
  switch (objective.type) {
    case 'grab':
      return tiles(objective.crates) && within(objective.taken, objective.crates);
    case 'hack':
      return isTile(objective.at) && isInt(objective.turns, 1, MAX) && isInt(objective.progress, 0, MAX) && isInt(objective.worked, 0, MAX);
    case 'extract':
      return tiles(objective.crates) && within(objective.taken, objective.crates) && within(objective.out, objective.taken) && tiles(objective.exits);
    case 'escort':
      return isWard(objective.ward) && tiles(objective.exits) && typeof objective.out === 'boolean';
    case 'rescue':
      return isWard(objective.ward) && tiles(objective.exits) && typeof objective.freed === 'boolean' && typeof objective.out === 'boolean';
    case 'sabotage':
      return (
        tiles(objective.targets) && within(objective.blown, objective.targets) && isInt(objective.left, 0, MAX) && Array.isArray(objective.charges) &&
        objective.charges.every((charge) => isRecord(charge) && within([charge.at], objective.targets) && isInt(charge.blows, 1, MAX))
      );
    case 'defend':
      return isInt(objective.rounds, 1, MAX) && tiles(objective.line) && typeof objective.held === 'boolean' && (objective.through === null || isWard(objective.through));
    default:
      return false;
  }
}

function isMap(map) {
  if (!isRecord(map) || !isInt(map.width, 1, MAX_TILES) || !isInt(map.height, 1, MAX_TILES) || !isInt(map.tilesPerCell, 1, 8)) return false;
  // A job's site has no space around it, and its template's id; the
  // hangar has no space around it either.
  if ((map.margin !== undefined && !isInt(map.margin, 0, MAX_TILES)) || (map.site !== undefined && typeof map.site !== 'string')) return false;
  if (map.hangar !== undefined && typeof map.hangar !== 'boolean') return false;
  if (!Array.isArray(map.origin) || map.origin.length !== 2 || !map.origin.every(Number.isInteger)) return false;
  const fits = (grid, ok) =>
    isRecord(grid) && grid.width === map.width && grid.height === map.height &&
    Array.isArray(grid.cells) && grid.cells.length === map.width * map.height && grid.cells.every(ok);
  const onMap = (thing) => isInt(thing.x, 0, map.width - 1) && isInt(thing.y, 0, map.height - 1);
  return (
    fits(map.tiles, (tile) => typeof tile === 'string' && tile !== '') &&
    fits(map.roomAt, (uid) => uid === null || isInt(uid, 1, MAX)) &&
    fits(map.hazards, (wreck) => wreck === null || WRECKS.includes(wreck)) &&
    isRecord(map.walls) && fits(map.walls.n, (edge) => EDGES.includes(edge)) && fits(map.walls.w, (edge) => EDGES.includes(edge)) &&
    Array.isArray(map.rooms) &&
    map.rooms.every((room) =>
      isRecord(room) && isInt(room.uid, 1, MAX) && typeof room.type === 'string' && onMap(room) &&
      isInt(room.w, 1, map.width) && isInt(room.h, 1, map.height) && (room.wreck === null || WRECKS.includes(room.wreck)),
    ) &&
    Array.isArray(map.hatches) &&
    map.hatches.every((hatch) => isRecord(hatch) && isInt(hatch.uid, 1, MAX) && onMap(hatch) && SIDES.includes(hatch.side))
  );
}

// A unit; a ward (M38) is on the crew's side with no weapon, and a carrier
// has a crate's tile in hand.
function isUnit(unit, map) {
  const onMap = (at) => Array.isArray(at) && at.length === 2 && isInt(at[0], 0, map.width - 1) && isInt(at[1], 0, map.height - 1);
  return (
    isRecord(unit) && typeof unit.id === 'string' && unit.id !== '' && TEAMS.includes(unit.side) &&
    typeof unit.kind === 'string' && typeof unit.name === 'string' &&
    isInt(unit.x, 0, map.width - 1) && isInt(unit.y, 0, map.height - 1) &&
    isInt(unit.maxHp, 1, MAX) && isInt(unit.hp, 0, unit.maxHp) &&
    STATS.every((key) => isInt(unit[key], -MAX, MAX)) &&
    (unit.ward === undefined || (unit.ward === true && unit.side === 'crew')) &&
    (unit.ward ? unit.weapon === null : typeof unit.weapon === 'string') && isInt(unit.ammo, 0, MAX) && isInt(unit.ap, 0, MAX) &&
    (unit.status !== 'held' || unit.ward === true) &&
    (unit.carrying === undefined || (unit.side === 'crew' && onMap(unit.carrying))) &&
    (unit.hauled === undefined || unit.hauled === true) &&
    typeof unit.overwatch === 'boolean' && STATUSES.includes(unit.status) &&
    isInt(unit.bleed, 0, MAX) && isInt(unit.air, 0, MAX) &&
    isInt(unit.uses, 0, MAX) && (unit.mark === null || (isRecord(unit.mark) && isInt(unit.mark.aim, -MAX, MAX) && isInt(unit.mark.turns, 1, MAX))) &&
    (unit.suppressed === null || (isRecord(unit.suppressed) && isInt(unit.suppressed.aim, -MAX, MAX))) &&
    typeof unit.asleep === 'boolean' && typeof unit.kitted === 'boolean' &&
    (unit.rank === undefined || (unit.side === 'crew' && isInt(unit.rank, 1, MAX))) &&
    (unit.talent === undefined || (unit.side === 'crew' && typeof unit.talent === 'string' && unit.talent !== ''))
  );
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
