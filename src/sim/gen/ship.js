// Ships generated from a preset (data/ships.json) and a seed: a pirate
// cutter, a patrol corvette, a derelict hauler. They are built by the
// builder's own rules (layout.js), so each one passes the flight checklist
// for the crew its preset names, converts to a battle map like any ship,
// and opens in the builder. Pure and seeded: the same preset and seed
// always give the same ship.
//
// First the parts: the preset's counts, rolled where a count is a range,
// then whatever the flight checklist still asks for. Its fixes name the
// part to add: a reactor for power, an engine for thrust, quarters for
// berths. Then the layout. A layout that runs into a dead end starts over
// from the parts, with the random numbers where they got to. Last, a
// preset with wrecks gets some of its rooms wrecked: a derelict. Its hull
// gets one of the styles at random (M23d), and it wears its side's look:
// paint, trim and styling pieces (look.js, M23f).
import { int, pick, seedFrom, shuffle } from '../../core/rng.js';
import { DEFAULT_HULL, layoutProblems } from '../builder.js';
import { canLaunch, flightChecklist, partLines } from '../constraints.js';
import { WRECKS } from '../mapFromShip.js';
import { hasTag, interiorRows, placedCells } from '../modules.js';
import { layOutShip, roomsOnFoot } from './layout.js';
import { dressShip } from './look.js';

const ATTEMPTS = 20; // layouts tried before the preset is given up on

// Returns { ok: true, ship, preset, crew, wrecked } or { ok: false, error }.
// The ship is plain ship data (builder.js) in the middle of its frame, its
// parts numbered in the order they went in and its styling pieces after
// them, so logFor(ship) (replay.js) builds it again step by step. wrecked is { [uid]: 'fire' | 'vacuum' |
// 'rubble' }, ready for mapFromShip: empty unless the preset has wrecks.
export function generateShip(defs, presetId, seed) {
  const preset = defs.ships.get(presetId);
  if (!preset) return { ok: false, error: `Unknown ship preset "${presetId}".` };
  let state = seedFrom(seed);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const plan = planParts(defs, preset, state);
    if (!plan.ok) return plan;
    const laid = layOutShip(defs, preset, plan.types, plan.state);
    state = laid.state;
    if (!laid.ship) continue;
    const ship = centered(laid.ship, defs);
    // The layout checked every part as it went in; this is the whole ship,
    // and every room of it boarders can walk into.
    if (layoutProblems(ship, defs).length || !canLaunch(flightChecklist(ship, defs, preset.crew)) || !roomsOnFoot(ship, defs)) continue;
    const dressed = dressShip(defs, preset, { ...ship, hull: hullStyle(defs, presetId, seed) }, seed);
    return { ok: true, ship: dressed, preset: preset.id, crew: preset.crew, wrecked: wreckRooms(defs, preset, ship, state) };
  }
  return { ok: false, error: `No layout for a ${preset.name} in ${ATTEMPTS} tries.` };
}

// The parts a ship of this preset carries, as module types: the preset's
// counts in its order, rolled where a count is a range, then each part the
// flight checklist's part lines ask for, one at a time (an engine brings
// mass and uses power, so the lines are checked again after each). A
// symmetric ship's parts are mirrored about its middle row, so a part that
// can't sit across that row comes in pairs: an odd count gets one more.
// Returns { ok: true, types, state } or { ok: false, error }.
export function planParts(defs, preset, state) {
  const types = [];
  let s = state;
  for (const [type, count] of Object.entries(preset.parts)) {
    const roll = int(s, ...(Array.isArray(count) ? count : [count, count]));
    s = roll.state;
    for (let i = 0; i < roll.value; i++) types.push(type);
  }
  const cap = defs.frames.get(preset.frame).maxModules;
  for (;;) {
    if (types.length > cap) return { ok: false, error: `A ${preset.name} needs more than the ${cap} parts its frame holds.` };
    const ship = { frame: preset.frame, modules: types.map((type) => ({ type })) };
    const failing = partLines(ship, defs, preset.crew).find((line) => !line.ok);
    const unpaired = preset.symmetric ? types.find((type) => !acrossTheMiddle(defs.modules.get(type), defs) && types.filter((t) => t === type).length % 2) : null;
    if (!failing && !unpaired) return { ok: true, types, state: s };
    if (failing && !failing.add) return { ok: false, error: `A ${preset.name} can't pass "${failing.text}": ${failing.fix}.` };
    types.push(failing ? failing.add : unpaired);
  }
}

// True if the part can sit across a ship's middle row, in the line of parts
// along it from the bridge, with the way on open: some turn of it is an odd
// number of cells high with floor at both ends of its middle row (doors
// between parts in that line fall on it). A part that needs a side on space
// (a gun's barrel, an engine's exhaust, an airlock's hatch) can't: in that
// line its sides face the bridge's way, where nothing goes ahead of it, the
// engines' at the stern, or the parts beside it.
function acrossTheMiddle(def, defs) {
  if (def.facesSpace || hasTag(def, 'airlock')) return false;
  const floor = (char) => defs.tileRules[defs.tiles[char]]?.walk === true;
  return (def.rotates ? [0, 1, 2, 3] : [0]).some((rot) => {
    const rows = interiorRows(def, rot);
    const row = rows.length % 2 === 1 ? rows[(rows.length - 1) / 2] : null;
    return row !== null && floor(row[0]) && floor(row.at(-1));
  });
}

// The rooms a derelict comes with wrecked: between the preset's least and
// most, never the bridge or an airlock, each on fire, open to vacuum or full
// of rubble.
function wreckRooms(defs, preset, ship, state) {
  if (!preset.wrecks) return {};
  let s = state;
  const count = int(s, ...preset.wrecks);
  s = count.state;
  const rooms = ship.modules.filter((m) => {
    const def = defs.modules.get(m.type);
    return !hasTag(def, 'bridge') && !hasTag(def, 'airlock');
  });
  const order = shuffle(s, rooms);
  s = order.state;
  const wrecked = {};
  for (const room of order.value.slice(0, count.value)) {
    const wreck = pick(s, WRECKS);
    s = wreck.state;
    wrecked[room.uid] = wreck.value;
  }
  return wrecked;
}

// The ship moved to the middle of its frame.
// The hull's style (data/hulls.json), one of them at random: from a roll of
// its own, so the layout is what it was before ships had styles, and the
// same seed always gives the same style.
function hullStyle(defs, presetId, seed) {
  const styles = [...(defs.hulls?.keys() ?? [])];
  return styles.length ? pick(seedFrom(`hull ${presetId} ${seed}`), styles).value : DEFAULT_HULL;
}

function centered(ship, defs) {
  const frame = defs.frames.get(ship.frame);
  const cells = ship.modules.flatMap((m) => placedCells(defs.modules.get(m.type), m));
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const dx = Math.floor((frame.width - (Math.max(...xs) - x0 + 1)) / 2) - x0;
  const dy = Math.floor((frame.height - (Math.max(...ys) - y0 + 1)) / 2) - y0;
  return { ...ship, modules: ship.modules.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy })) };
}
