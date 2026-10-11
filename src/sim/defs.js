// Lookup tables over the content files in data/. Callers load the JSON
// (fetch in the browser, fs in Node) and pass the parsed files in, so the
// simulation never does I/O.

// The content files, by name: data/<name>.json.
export const CONTENT_FILES = ['modules', 'frames', 'manufacturers', 'balance'];

export function indexDefs({ modules, frames, manufacturers, balance }) {
  return {
    balance,
    tilesPerCell: modules.tilesPerCell,
    tiles: modules.tiles,
    modules: new Map(modules.modules.map((def) => [def.id, def])),
    frames: new Map(frames.frames.map((frame) => [frame.id, frame])),
    manufacturers: new Map(manufacturers.manufacturers.map((maker) => [maker.id, maker])),
  };
}
