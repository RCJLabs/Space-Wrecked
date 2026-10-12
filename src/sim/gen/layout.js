// Lays a planned list of parts out as a ship by the builder's own rules:
// every part goes in through placeModule, and the layout has to pass
// layoutProblems after each one, as if a player had built it. Pure and
// seeded (src/core/rng.js).
//
// Ships fly toward +x. The bridge goes in first, at the front, turned so
// its console row looks forward, and nothing is built ahead of it. Then the
// corridors, as a spine aft along the middle row; then the rooms, bow to
// stern; then the parts with a side that has to face space (engines, at the
// stern, then guns); and last the airlocks. Nothing goes in an engine's
// wake or a gun's line of fire, out to the edge of the yard, which is more
// than the builder asks (only the next cell has to be space there). Each
// part goes in the best of the places that join it to the ship, by a score
// (WEIGHTS) that:
//   - keeps the ship within the preset's beam, and near its middle row
//   - puts each part at its place bow to stern: the order the preset lists
//     its parts in
//   - favours places that share more wall and grow the ship less
//   - adds a seeded nudge, so no two ships come out alike
// A place that breaks a layout rule is passed over for the next best.
//
// A symmetric preset is mirrored about the middle row. Its parts go in as
// pairs, one above the middle row and its twin below, and an odd one out
// goes across the middle row (or anywhere, if it can't), as every corridor
// tries to first.
import { int, next } from '../../core/rng.js';
import { airlocksOnHullEdge, layoutProblems, newShip, placeModule } from '../builder.js';
import { inFrame } from '../frame.js';
import { cellAt, OPPOSITE, SIDES, step } from '../grid.js';
import { mapFromShip } from '../mapFromShip.js';
import { facingSide, footprint, hasTag, interiorRows, placedCells, sideCells } from '../modules.js';
import { stepsFrom } from '../moves.js';
import { walkable } from '../terrain.js';

// Lower scores win. Starting values, set by eye over many generated ships.
const WEIGHTS = {
  beam: 12, // the rows a part reaches past the beam, squared
  middle: 0.6, // each row a part is from the middle row, on average
  spine: 8, // the same, for a corridor
  zone: 7, // how far a part is from its place bow to stern, as a share of the ship's length
  touch: 0.5, // each wall a part shares with the ship, taken off
  open: 0.3, // each floor tile along its free sides (doors later parts can use), taken off...
  aft: 3, // ...this many times over on its aft side, where the ship grows on
  grow: 0.06, // each cell the ship's bounding box grows by
  chance: 2.5, // the most the seeded nudge adds
};
const FILL = 0.8; // about how much of its bounding box a ship's parts fill
const TRIES = 40; // places checked against the layout rules for one part
const AFT = 'w'; // ships fly toward +x

// Returns { ship, state }; ship is null when a part found no place, and
// state is where the random numbers got to either way.
export function layOutShip(defs, preset, types, state) {
  const frame = defs.frames.get(preset.frame);
  let s = state;
  const roll = int(s, ...preset.beam);
  s = roll.state;
  const half = (roll.value - 1) / 2; // rows either side of the middle row within the beam
  const middle = Math.floor(frame.height / 2);
  const listed = Object.keys(preset.parts);
  const zoneOf = (type) => {
    const i = listed.indexOf(type);
    return i < 0 || listed.length < 2 ? 0.5 : i / (listed.length - 1);
  };
  const area = types.reduce((sum, type) => sum + defs.modules.get(type).size[0] * defs.modules.get(type).size[1], 0);
  const length = Math.max(4, area / (roll.value * FILL)); // about how long the ship will be

  // The ship as it grows: which part is on each cell (0 for none), the
  // cells in an engine's wake or a gun's line of fire, each part by uid and
  // the side of it that has to face space, the corridors and their runs,
  // and the box round it all. front is the bridge's front edge.
  let ship = newShip(frame.id);
  const owners = new Int32Array(frame.width * frame.height);
  const inLine = new Uint8Array(frame.width * frame.height);
  const parts = new Map();
  const facing = new Map();
  const corridors = new Set();
  let runs = null; // worked out when needed (runOf)
  let box = null;
  let front = 0;
  const interiors = new Map();
  const inYard = (x, y) => x >= 0 && y >= 0 && x < frame.width && y < frame.height;
  const ownerAt = (x, y) => (inYard(x, y) ? owners[y * frame.width + x] : 0);

  for (const { type, count } of placementOrder(defs, types, zoneOf)) {
    const corridor = hasTag(defs.modules.get(type), 'corridor');
    let left = count;
    if (!ship.modules.length) {
      if (!placeBridge(type)) return { ship: null, state: s };
      left--;
    }
    while (left > 0) {
      const placed =
        (preset.symmetric && (corridor || left % 2 === 1) && placeSome(type, 'across')) ||
        (preset.symmetric && left >= 2 && placeSome(type, 'pair')) ||
        placeSome(type, 'any');
      if (!placed) return { ship: null, state: s };
      left -= placed;
    }
  }
  return { ship, state: s };

  // The bridge, at the front of the yard across the middle row. A quarter
  // turn puts its top row, the consoles, forward.
  function placeBridge(type) {
    const def = defs.modules.get(type);
    const rot = def.rotates ? 1 : 0;
    const [w, h] = footprint(def, rot);
    const at = { type, x: frame.width - w - 1, y: middle - Math.floor((h - 1) / 2), rot };
    const built = tryPlace(at, null);
    if (built) {
      take(built);
      front = at.x + w;
    }
    return Boolean(built);
  }

  // Puts in one part of this type ('any' place, or 'across' the middle row)
  // or a mirrored 'pair'. Returns how many went in: 0 if none could.
  function placeSome(type, mode) {
    for (const place of placesFor(type, mode).slice(0, TRIES)) {
      const built = tryPlace(place.at, place.twin);
      if (built) {
        take(built);
        return place.twin ? 2 : 1;
      }
    }
    return 0;
  }

  // Every place for a part of this type that joins it to the ship, best
  // first: { at, twin, score }, twin being the lower of a pair or null.
  function placesFor(type, mode) {
    const def = defs.modules.get(type);
    const places = [];
    for (const rot of def.rotates ? [0, 1, 2, 3] : [0]) {
      const [w, h] = footprint(def, rot);
      const side = facingSide(def, rot);
      // A part that faces aft (an engine's exhaust) goes at the stern: level
      // with the ship's last column or behind it.
      const last = side === AFT ? box.x0 : box.x1 + 1;
      for (let y = box.y0 - h; y <= box.y1 + 1; y++) {
        if (mode === 'pair' && y + h > middle) continue;
        if (mode === 'across' && 2 * y + h !== 2 * middle + 1) continue;
        for (let x = box.x0 - w; x <= last && x + w <= front; x++) {
          const at = { type, x, y, rot };
          const cells = placedCells(def, at);
          if (!fits(cells) || !clearAhead(def, at, side)) continue;
          const touch = sharedWalls(def, cells, side);
          if (touch < 1 || !walksIn(def, at, cells)) continue;
          let twin = null;
          let twinCells = [];
          if (mode === 'pair') {
            twin = mirrored(def, at);
            twinCells = placedCells(def, twin);
            const twinSide = facingSide(def, twin.rot);
            if (!fits(twinCells) || !clearAhead(def, twin, twinSide) || !walksIn(def, twin, twinCells)) continue;
            if (crosses(side && lineOf(def, at, side), twinCells) || crosses(twinSide && lineOf(def, twin, twinSide), cells)) continue;
          }
          const nudge = next(s);
          s = nudge.state;
          places.push({ at, twin, score: score(type, def, at, cells, touch, twinCells) + WEIGHTS.chance * nudge.value });
        }
      }
    }
    return places.sort((a, b) => a.score - b.score);
  }

  function score(type, def, at, cells, touch, twinCells) {
    let rows = 0;
    let past = 0;
    for (const [, y] of cells) {
      const off = Math.abs(y - middle);
      rows += off;
      past = Math.max(past, off - half);
    }
    const corridor = hasTag(def, 'corridor');
    // Where it is bow (0) to stern (1), against the ship's length as planned
    // or as built, whichever is longer; anywhere past the stern is the stern.
    const along = Math.min(1, (front - at.x - footprint(def, at.rot)[0] / 2) / Math.max(length, front - box.x0));
    return (
      WEIGHTS.beam * past ** 2 +
      (corridor ? WEIGHTS.spine : WEIGHTS.middle) * (rows / cells.length) +
      (corridor ? 0 : WEIGHTS.zone * Math.abs(along - zoneOf(type))) -
      WEIGHTS.touch * touch -
      WEIGHTS.open * openFloor(def, at) +
      WEIGHTS.grow * growth([...cells, ...twinCells])
    );
  }

  // The floor tiles along a part's sides with nothing beside them yet,
  // counted WEIGHTS.aft times on its aft side: where later parts could have
  // a door into it. Of a room's turns, the one with crates and lockers away
  // from its free sides, and above all from the stern, leaves the most
  // ways on.
  function openFloor(def, at) {
    if (defs.tilesPerCell !== 1) return 0;
    let count = 0;
    for (const side of SIDES) {
      for (const [x, y] of sideCells(def, at, side)) {
        if (!ownerAt(...step(x, y, side)) && floorAt(def, at, x, y)) count += side === AFT ? WEIGHTS.aft : 1;
      }
    }
    return count;
  }

  // The ship with the part (and its twin) in, if every layout rule still
  // passes, else null. The airlock rule waits until there is an airlock;
  // then every airlock has to keep a hatch, which is more than the builder
  // asks (one will do there).
  function tryPlace(at, twin) {
    let result = placeModule(ship, defs, at);
    if (result.ok && twin) result = placeModule(result.ship, defs, twin);
    if (!result.ok) return null;
    const built = result.ship;
    if (layoutProblems(built, defs).some((problem) => problem.rule !== 'airlock')) return null;
    const airlocks = built.modules.filter((m) => hasTag(defs.modules.get(m.type), 'airlock')).length;
    return airlocksOnHullEdge(built, defs).length === airlocks ? built : null;
  }

  // True if a part placed at `at` could be walked into: it has no floor (a
  // gun's room, which no one enters), or one of its doors into the ship
  // opens from floor to floor. Doors go where builder.js joins() puts them,
  // in the middle of each wall the part shares with a room, a run of
  // corridors counting as one room; the builder doesn't mind what stands
  // either side, so a door can open onto a locker or machinery. The finished
  // ship is checked on its battle map too (roomsOnFoot); this keeps a place
  // that fails it from being tried. It reads one tile a cell.
  function walksIn(def, at, cells) {
    if (defs.tilesPerCell !== 1 || !cells.some(([x, y]) => floorAt(def, at, x, y))) return true;
    const walls = new Map();
    for (const [x, y] of cells) {
      for (const dir of SIDES) {
        const [nx, ny] = step(x, y, dir);
        const other = ownerAt(nx, ny);
        if (!other) continue;
        const key = `${runOf(other)} ${dir}`;
        if (!walls.has(key)) walls.set(key, []);
        walls.get(key).push([x, y, nx, ny]);
      }
    }
    for (const edges of walls.values()) {
      edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const [x, y, nx, ny] = edges[Math.floor((edges.length - 1) / 2)];
      const other = parts.get(ownerAt(nx, ny));
      if (floorAt(def, at, x, y) && floorAt(defs.modules.get(other.type), other, nx, ny)) return true;
    }
    return false;
  }

  // True if units can stand on the tile of cell (x, y) of a part at `at`.
  function floorAt(def, at, x, y) {
    const key = `${def.id} ${at.rot}`;
    if (!interiors.has(key)) interiors.set(key, interiorRows(def, at.rot));
    const char = interiors.get(key)[y - at.y][x - at.x];
    return defs.tileRules[defs.tiles[char]]?.walk === true;
  }

  // A corridor's run: the first corridor of it, as builder.js counts runs
  // (corridors side by side make one space). Any other part is its own.
  function runOf(uid) {
    if (!corridors.has(uid)) return uid;
    if (!runs) {
      runs = new Map();
      for (const first of [...corridors].sort((a, b) => a - b)) {
        if (runs.has(first)) continue;
        runs.set(first, first);
        const queue = [first];
        while (queue.length) {
          const module = parts.get(queue.pop());
          for (const [x, y] of placedCells(defs.modules.get(module.type), module)) {
            for (const dir of SIDES) {
              const next = ownerAt(...step(x, y, dir));
              if (!corridors.has(next) || runs.has(next)) continue;
              runs.set(next, first);
              queue.push(next);
            }
          }
        }
      }
    }
    return runs.get(uid);
  }

  // Takes in the parts a placement added.
  function take(built) {
    for (const module of built.modules.slice(ship.modules.length)) {
      const def = defs.modules.get(module.type);
      const side = facingSide(def, module.rot);
      parts.set(module.uid, module);
      facing.set(module.uid, side);
      if (side) for (const [x, y] of lineOf(def, module, side)) inLine[y * frame.width + x] = 1;
      if (hasTag(def, 'corridor')) {
        corridors.add(module.uid);
        runs = null;
      }
      for (const [x, y] of placedCells(def, module)) {
        owners[y * frame.width + x] = module.uid;
        box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
      }
    }
    ship = built;
  }

  // In the frame, on empty cells, and out of every engine's wake and gun's
  // line of fire.
  function fits(cells) {
    return cells.every(([x, y]) => inFrame(frame, x, y) && !ownerAt(x, y) && !inLine[y * frame.width + x]);
  }

  // Nothing of the ship in line with the side of a part that has to face
  // space.
  function clearAhead(def, at, side) {
    return !side || lineOf(def, at, side).every(([x, y]) => !ownerAt(x, y));
  }

  // The cells in line with a side of a part, out to the edge of the yard.
  function lineOf(def, at, side) {
    const line = [];
    for (const [x0, y0] of sideCells(def, at, side)) {
      for (let [x, y] = step(x0, y0, side); inYard(x, y); [x, y] = step(x, y, side)) line.push([x, y]);
    }
    return line;
  }

  // How many walls the part would share with the ship and join it through
  // (a doorway, or corridors opening into each other), or -1 if it would
  // stand against a side that has to face space: its own, or a neighbour's.
  function sharedWalls(def, cells, side) {
    const corridor = hasTag(def, 'corridor');
    let count = 0;
    for (const [x, y] of cells) {
      for (const dir of SIDES) {
        const other = ownerAt(...step(x, y, dir));
        if (!other) continue;
        if (!(corridor && corridors.has(other)) && (dir === side || OPPOSITE[dir] === facing.get(other))) return -1;
        count++;
      }
    }
    return count;
  }

  // The part's twin across the middle row, turned so that what faces north
  // faces south (and the other way), and a room's fittings sit mirrored.
  function mirrored(def, at) {
    const [, h] = footprint(def, at.rot);
    const side = facingSide(def, at.rot);
    const rot = !def.rotates || side === 'e' || side === 'w' ? at.rot : (at.rot + 2) % 4;
    return { ...at, y: 2 * middle + 1 - at.y - h, rot };
  }

  // How many cells the box round the ship grows by with these cells in it.
  function growth(cells) {
    let { x0, y0, x1, y1 } = box;
    for (const [x, y] of cells) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return (x1 - x0 + 1) * (y1 - y0 + 1) - (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1);
  }
}

// True if every room of the ship with floor to stand on can be walked to
// from its bridge, through doors, on its battle map: a ship boarders can
// get round. (A gun's room has no floor.)
export function roomsOnFoot(ship, defs) {
  const map = mapFromShip(ship, defs);
  const field = { map, doors: [], units: [] };
  const floors = new Map();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const uid = cellAt(map.roomAt, x, y);
      if (uid === null || !walkable(field, x, y, defs)) continue;
      if (!floors.has(uid)) floors.set(uid, []);
      floors.get(uid).push([x, y]);
    }
  }
  const bridge = ship.modules.find((m) => hasTag(defs.modules.get(m.type), 'bridge'));
  const reached = stepsFrom(field, floors.get(bridge?.uid) ?? [], defs);
  return [...floors.values()].every((tiles) => tiles.some(([x, y]) => reached.has(`${x},${y}`)));
}

// True if any of the cells is on the line (a list of cells, or nothing).
function crosses(line, cells) {
  return Boolean(line) && line.some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y));
}

// The parts by type, in the order they go in: { type, count }. Bridges
// first, then corridors, rooms bow to stern, parts with a side that has to
// face space (biggest first), and airlocks; ties keep the plan's order.
function placementOrder(defs, types, zoneOf) {
  const counts = new Map();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  const rank = (def) =>
    hasTag(def, 'bridge') ? 0 : hasTag(def, 'corridor') ? 1 : hasTag(def, 'airlock') ? 4 : def.facesSpace ? 3 : 2;
  const cells = (def) => def.size[0] * def.size[1];
  const within = (a, b) => (rank(a.def) === 2 ? zoneOf(a.type) - zoneOf(b.type) : cells(b.def) - cells(a.def));
  return [...counts]
    .map(([type, count]) => ({ type, count, def: defs.modules.get(type) }))
    .sort((a, b) => rank(a.def) - rank(b.def) || within(a, b))
    .map(({ type, count }) => ({ type, count }));
}
