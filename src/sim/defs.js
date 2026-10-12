// Lookup tables over the content files in data/. Callers load the JSON
// (fetch in the browser, fs in Node) and pass the parsed files in, so the
// simulation never does I/O. A file left out (a test's tiny catalog) gives
// empty tables.

// The content files, by name: data/<name>.json.
export const CONTENT_FILES = ['modules', 'frames', 'manufacturers', 'balance', 'weapons', 'jobs', 'traits', 'enemies', 'tiles', 'encounters', 'ships', 'campaign', 'backgrounds', 'districts', 'sites', 'contracts', 'sectors', 'events', 'tips'];

export function indexDefs(files) {
  const { modules, frames, manufacturers, balance, weapons, jobs, traits, enemies, tiles, encounters, ships, campaign, backgrounds, districts, sites, contracts, sectors, events, tips } = files;
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
    // What happens at a sector's nodes (events.js): each event by id, and
    // the drop tables its outcomes draw parts from.
    events: byId(events?.events),
    eventDrops: events?.drops ?? {},
    // The first-run tips' words (src/ui/tips.js), by id.
    tips: byId(tips?.tips),
  };
}

function byId(list = []) {
  return new Map(list.map((item) => [item.id, item]));
}
