// Lookup tables over the content files in data/. Callers load the JSON
// (fetch in the browser, fs in Node) and pass the parsed files in, so the
// simulation never does I/O.

export function indexDefs({ modules, frames, manufacturers }) {
  return {
    tilesPerCell: modules.tilesPerCell,
    tiles: modules.tiles,
    modules: new Map(modules.modules.map((def) => [def.id, def])),
    frames: new Map(frames.frames.map((frame) => [frame.id, frame])),
    manufacturers: new Map(manufacturers.manufacturers.map((maker) => [maker.id, maker])),
  };
}
