// Lookup tables over the content files in data/. Callers load the JSON
// (fetch in the browser, fs in Node) and pass the parsed files in, so the
// simulation never does I/O. A file left out (a test's tiny catalog) gives
// empty tables.

// The content files, by name: data/<name>.json.
export const CONTENT_FILES = ['modules', 'frames', 'manufacturers', 'balance', 'weapons', 'jobs', 'enemies', 'tiles', 'encounters', 'ships'];

export function indexDefs({ modules, frames, manufacturers, balance, weapons, jobs, enemies, tiles, encounters, ships }) {
  return {
    balance,
    tilesPerCell: modules.tilesPerCell,
    tiles: modules.tiles,
    modules: byId(modules.modules),
    frames: byId(frames.frames),
    manufacturers: byId(manufacturers?.manufacturers),
    // Battles: what each kind of tile does, the weapons, and who fights:
    // crew by their job, and enemies.
    tileRules: tiles?.tiles ?? {},
    weapons: byId(weapons?.weapons),
    jobs: byId(jobs?.jobs),
    enemies: byId(enemies?.enemies),
    // Who fights a battle: the squad (crew jobs, until a campaign has a
    // crew) and the enemies an encounter brings.
    squad: encounters?.squad ?? [],
    encounters: byId(encounters?.encounters),
    // The presets ships are generated from (src/sim/gen/ship.js).
    ships: byId(ships?.ships),
  };
}

function byId(list = []) {
  return new Map(list.map((item) => [item.id, item]));
}
