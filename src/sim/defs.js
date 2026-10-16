// Lookup tables over the content files in data/. Callers load the JSON
// (fetch in the browser, fs in Node) and pass the parsed files in, so the
// simulation never does I/O. A file left out (a test's tiny catalog) gives
// empty tables.

// The content files, by name: data/<name>.json.
export const CONTENT_FILES = ['modules', 'frames', 'manufacturers', 'hulls', 'styling', 'balance', 'weapons', 'jobs', 'traits', 'enemies', 'tiles', 'encounters', 'ships', 'campaign', 'backgrounds', 'districts', 'sites', 'contracts', 'sectors', 'worlds', 'colony', 'expeditions', 'events', 'recruits', 'tips', 'factions'];

export function indexDefs(files) {
  const { modules, frames, manufacturers, hulls, styling, balance, weapons, jobs, traits, enemies, tiles, encounters, ships, campaign, backgrounds, districts, sites, contracts, sectors, worlds, colony, expeditions, events, recruits, tips, factions } = files;
  return {
    balance,
    tilesPerCell: modules.tilesPerCell,
    tiles: modules.tiles,
    // The parts, each maker's versions filled in from their base parts
    // (M23g, withBases).
    modules: byId(withBases(modules.modules)),
    // The builder's drawer sorts parts into these, in this order (M23e):
    // [{ id, name }], each module naming one as its category.
    categories: modules.categories ?? [],
    frames: byId(frames.frames),
    manufacturers: byId(manufacturers?.manufacturers),
    // How a hull is shaped around the rooms (src/render/hullShape.js), by
    // id: a ship's hull names one (builder.js).
    hulls: byId(hulls?.hulls),
    // Styling (M23f, src/sim/styling.js): the pieces by id, the groups the
    // Look tab sorts them into, and the paints and trims a hull can take,
    // each in data order.
    styling: byId(styling?.pieces),
    stylingGroups: styling?.groups ?? [],
    paints: byId(styling?.paints),
    trims: byId(styling?.trims),
    // Battles: what each kind of tile does, the weapons, and who fights:
    // crew by their job, and enemies.
    tileRules: tiles?.tiles ?? {},
    weapons: byId(weapons?.weapons),
    jobs: byId(jobs?.jobs),
    // What a character can be besides their job: a captain has two traits
    // (campaign.js), each adding to their numbers in a fight.
    traits: byId(traits?.traits),
    enemies: byId(enemies?.enemies),
    // Who fights a battle: the squad (crew jobs, until a campaign has a
    // crew) and the enemies an encounter brings.
    squad: encounters?.squad ?? [],
    encounters: byId(encounters?.encounters),
    // The presets ships are generated from (src/sim/gen/ship.js).
    ships: byId(ships?.ships),
    // The campaign's acts (campaign.js), and act 1's content: the
    // backgrounds a campaign can start from (each with its start and its
    // district), the districts with their clients and job sites (ids are
    // unique across districts), the sites' map templates (gen/site.js) and
    // the jobs (contracts.js).
    acts: new Map((campaign?.acts ?? []).map((act) => [act.act, act])),
    backgrounds: byId(backgrounds?.backgrounds),
    districts: byId(districts?.districts),
    clients: byId((districts?.districts ?? []).flatMap((district) => district.clients ?? [])),
    sites: byId((districts?.districts ?? []).flatMap((district) => district.sites ?? [])),
    siteMaps: byId(sites?.maps),
    contracts: {
      boardSize: contracts?.boardSize ?? 0,
      twistChance: contracts?.twistChance ?? 0,
      missions: byId(contracts?.missions),
      twists: byId(contracts?.twists),
      jobs: byId(contracts?.jobs),
    },
    // Act 2's sectors (gen/sector.js): how one is laid out, its kinds of
    // node by id, and the names it draws on.
    sectors: sectors ?? null,
    nodeTypes: byId(sectors?.nodes),
    // The worlds past the charts (M25, gen/system.js): how many a system
    // has and its words, the words for how far a world lies from the lanes
    // (nearest first), the kinds of world by id, each with the ranges its
    // numbers roll in, and the names systems and worlds draw on.
    worlds: worlds ? { system: worlds.system, lanes: worlds.lanes ?? [], kinds: byId(worlds.kinds), names: worlds.names ?? {} } : null,
    // The colony (M26, colony.js): its grid, the tags of the parts that
    // stay aboard, its words, and the building each useful part becomes,
    // by the part's base id, in data order. From M27 (days.js), the
    // materials it starts with and what it builds from them, the farms and
    // mines, by id in data order; from M28 the solar arrays and shelters
    // too.
    colony: colony
      ? {
          site: colony.site,
          aboard: colony.aboard ?? [],
          text: colony.text,
          materials: colony.materials ?? 0,
          builds: byId(colony.builds),
          buildings: new Map((colony.buildings ?? []).map((b) => [b.part, b])),
        }
      : null,
    // The places within reach of the colony (M28, expeditions.js): how many
    // the list holds, its words, the kinds of place by id in data order
    // (each with the days it lies away, and for a derelict how often the
    // scavengers hold her), and the names each kind draws on.
    expeditions: expeditions ? { places: expeditions.places, text: expeditions.text, kinds: byId(expeditions.kinds), names: expeditions.names ?? {} } : null,
    // What happens at a sector's nodes (events.js), and from M28 at the
    // colony's places: each event by id, and the drop tables its outcomes
    // draw parts from.
    events: byId(events?.events),
    eventDrops: events?.drops ?? {},
    // The names recruits at stations draw on, and since M32b the pasts they
    // come from, by id (recruits.js): { first, last, backgrounds }.
    recruits: { first: recruits?.first ?? [], last: recruits?.last ?? [], backgrounds: byId(recruits?.backgrounds) },
    // The first-run tips' words (src/ui/tips.js), by id.
    tips: byId(tips?.tips),
    // The sides (M33, standing.js): each by id in data order, with its
    // name, words and color, and the stations that belong to one, by the
    // station's name: { sides, stations }.
    factions: { sides: byId(factions?.sides), stations: factions?.stations ?? {} },
  };
}

function byId(list = []) {
  return new Map(list.map((item) => [item.id, item]));
}

// A maker's version of a part (M23g) names the part it is a version of as
// `base` and holds only what it changes: its id, maker, name, price and
// some stats. It takes the rest from its base: footprint, interior, tags,
// category, glyph and what it does in an approach; its stats go over the
// base's. A version whose base isn't a part of the list is left as it is,
// for the validator to name.
export function withBases(list = []) {
  const bases = new Map(list.filter((def) => def?.base === undefined).map((def) => [def?.id, def]));
  return list.map((def) => {
    const base = def?.base !== undefined && bases.get(def.base);
    return base ? { ...base, ...def, stats: { ...base.stats, ...def.stats } } : def;
  });
}
