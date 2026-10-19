// The colony (ROADMAP §2, M26): act 3's home, on the world settled. The
// ship's useful parts come off it one at a time and stand on the colony's
// grid as buildings (data/colony.json): each part becomes the building of
// its kind, and what a building gives is its part's own numbers. The crew
// lives at the colony now, so the ship's flight checks count nobody aboard
// (campaign.js crewAboard), and the landed ship's spare power runs the
// colony too. From M27 the colony also builds from its materials: farms
// that grow food and mines that dig materials, each day by the world's
// numbers (days.js), placed by hand like every other building
// (colonyBuild.js). From M28 the ship flies out on trips with a squad
// (expeditions.js): while it is away the colony runs on its own power, and
// materials build what keeps it going alone, a solar array and shelters.
// From M32 the crew's jobs help (edges.js): a xenobiologist at home makes
// each farm grow more, an engineer each mine dig more, and a quartermaster
// anywhere in the crew makes the stores keep more. From M39 a part's
// building can bring a colony effect too, while it is powered (its
// `effects` in data/colony.json: a sensor mast's to hit at a lander, a
// machine shop's materials from each mine, a field station's places), added
// to the best job's within the effect's cap (colonyEffect); and one can
// make food (its `makes`: hydroponics' greenhouse). From M38d the ship flies
// out on voyages too (voyage.js): while it is away those at home are the
// colony's crew, its quartermaster only one at home, and its stores are its
// storehouses alone, the ship's holds being with the ship.
// Pure.
//
// The colony (campaign.colony):
//   world      the world settled (settle.js)
//   worlds     the other worlds of its system (M38d): [{ name, world }],
//              which its trips' places can be (expeditions.js otherWorlds)
//   buildings  [{ uid, type, x, y, rot }]: in the order they were built,
//              each where it stands on the colony's grid, laid out as a
//              ship's modules are (builder.js). type is a part's own (a
//              maker's version stays one), or a build's id (a farm or a
//              mine, data/colony.json builds).
//   nextUid    the next building's uid
//   day        the colony's day: 1 at the landing (M27, days.js)
//   materials  what it builds with (M27): rules.colony.materials at the
//              landing, salvaged from it
//   places     the places within reach (M28, expeditions.js): [] until
//              they are rolled, and after each trip until the next list
//   trip       the trip under way (M28), or null while the ship is home
//   raid       the raid coming (M29, raids.js): { found, lands }, or null
//   voyage     the voyage under way (M38d, voyage.js), or null while the
//              ship is home
import { atColony } from './acts.js';
import { homeOf } from './away.js';
import { applyCommand, occupancy, placeModule } from './builder.js';
import { shipChecklist } from './campaign.js';
import { shipStats } from './constraints.js';
import { COLONY_EFFECTS, colonyEdge } from './edges.js';
import { tally } from './flags.js';
import { cellAt } from './grid.js';
import { baseOf } from './makers.js';
import { footprint, hasTag, isRotation } from './modules.js';
import { supplyCapacity } from './travel.js';

// The id the colony's grid goes by as a frame, for the builder's placement.
export const SITE = 'colony';
// What the colony's builds make (M27): food, which is the run's supplies,
// or materials; and the world's numbers they make it from (M25's).
export const MAKES = ['food', 'materials'];
export const RESOURCES = ['soil', 'water', 'ore'];
// What a build can give as a building (M28, data/colony.json builds'
// gives), as a part's numbers give it (givesOf): power it makes (above 0)
// or needs (below), beds, air and storage.
export const BUILD_GIVES = ['power', 'beds', 'air', 'storage'];

// A colony on the world settled, with nothing built yet: day 1, with the
// materials the landing salvaged, no places rolled, the ship home and no
// raid coming; worlds, the other worlds of its system. From M38e its number,
// where it lies along the line of systems and its own heat (colonies.js):
// the first is 1, at 0. From M38f no citizens yet, none on the way and no
// news.
export function newColony(world, materials = 0, worlds = [], { id = 1, at = 0, heat = 0 } = {}) {
  return { world, buildings: [], nextUid: 1, day: 1, materials, places: [], trip: null, raid: null, worlds, voyage: null, id, at, heat, citizens: 0, growth: 0, news: [] };
}

// What the colony's citizens eat a day (M38f): a jump's supplies each, as a
// crew member does.
export function citizenEats(colony, rules) {
  return (colony?.citizens ?? 0) * rules.balance.jumpSupplies;
}

// The colony's build of id type (data/colony.json builds: a farm, a mine,
// a solar array or a shelter), or null.
export function buildOf(type, rules) {
  return rules.colony?.builds?.get(type) ?? null;
}

// What a building of type is as the builder places it: its part's
// definition, or a build's as a part of its size that turns. Null for one
// the content doesn't have.
export function siteDef(type, rules) {
  const def = rules.modules.get(type);
  if (def) return def;
  const build = buildOf(type, rules);
  return build ? { id: build.id, name: build.name, size: build.size, rotates: true, tags: [], stats: {} } : null;
}

// What a build makes a day on the world: the world's numbers it makes from,
// added up, and at least its least. Null for a build that makes nothing.
export function yieldOf(build, world) {
  if (!build.makes) return null;
  return Math.max(build.least, build.from.reduce((sum, rating) => sum + (world?.[rating] ?? 0), 0));
}

// What a build makes a day here, as colonyStats has it: { food } or
// { materials }, or null for one that makes nothing (a solar array, a
// shelter). more: what the crew adds to each (crewYields).
export function makesOf(build, world, more = {}) {
  return build.makes ? { [build.makes]: yieldOf(build, world) + (more[build.makes] ?? 0) } : null;
}

// What the crew at home, and from M39 the powered buildings' effects
// (builtEffects), add to each farm's food and each mine's materials a day,
// each within its effect's cap: { food, materials }.
export function crewYields(campaign, rules, effects = builtEffects(campaign, rules)) {
  const home = homeCrew(campaign);
  return { food: colonyEffect(home, rules, 'farms', effects), materials: colonyEffect(home, rules, 'mines', effects) };
}

// Colony effect key (edges.js COLONY_EFFECTS) as the colony stands (M39):
// the best job's among members, and what its powered buildings bring
// (effects, builtEffects's), within the effect's cap.
export function colonyEffect(members, rules, key, effects = {}) {
  return Math.min(COLONY_EFFECTS[key][1], colonyEdge(members, rules, key) + (effects[key] ?? 0));
}

// What the colony's powered buildings bring as colony effects (M39), their
// parts' buildings' `effects` (data/colony.json) added up: { [key]: n }.
export function builtEffects(campaign, rules) {
  return effectsOf(poweredOf(campaign, rules).buildings, rules);
}

function effectsOf(buildings, rules) {
  const effects = {};
  for (const building of buildings) {
    if (!building.powered) continue;
    for (const [key, n] of Object.entries(buildingOf(building.type, rules)?.effects ?? {})) effects[key] = (effects[key] ?? 0) + n;
  }
  return effects;
}

// What a part's building makes a day (M39, its data/colony.json `makes`: a
// greenhouse's food), or null.
function partMakes(type, rules) {
  const makes = buildingOf(type, rules)?.makes;
  return makes ? { ...makes } : null;
}

// The crew at home: all but the squad on a trip, or while the ship is away
// on a voyage, those at home (away.js).
export function homeCrew(campaign) {
  const home = homeOf(campaign);
  if (home) return home;
  const away = new Set(campaign.colony?.trip?.squad ?? []);
  return campaign.crew.filter((member) => !away.has(member.id));
}

// What a build gives as a building, as givesOf has a part's: its gives
// (M28: a solar array's power, a shelter's beds and air and the power it
// needs), the rest none.
export function buildGives(build) {
  const gives = build.gives ?? {};
  return { ...givesOf({ tags: [] }), power: gives.power ?? 0, beds: gives.beds ?? 0, air: gives.air ?? 0, storage: gives.storage ?? 0 };
}

// The name a building goes by: its build's or its part's building's
// (data/colony.json), else its part's own.
export function buildingName(type, rules) {
  return buildOf(type, rules)?.name ?? buildingOf(type, rules)?.name ?? rules.modules.get(type)?.name ?? type;
}

// The building a part becomes (data/colony.json), by its base part: { part,
// name, text }, or null for a part that stays aboard.
export function buildingOf(type, rules) {
  const def = rules.modules.get(type);
  return (def && rules.colony?.buildings.get(baseOf(def))) ?? null;
}

// What a part gives as a building: its own numbers.
//   power      what it makes (above 0) or needs (below)
//   beds, air  the crew it beds and breathes for (berths, life support)
//   storage    what it holds (cargo), for M27's production
//   heal       an infirmary's (a med bay's or surgery's)
//   damage, shield, intercept   a defense's part's own numbers; in a
//              raid (M29, raids.js) a defense fires its data/colony.json
//              shots, and any shield guards the defenders
//   armory     true for an armory, which arms the defenders in a raid
export function givesOf(def) {
  const stats = def.stats ?? {};
  return {
    power: stats.power ?? 0,
    beds: stats.berths ?? 0,
    air: stats.lifeSupport ?? 0,
    storage: stats.cargo ?? 0,
    heal: def.heal ?? 0,
    damage: def.damage ?? 0,
    shield: def.shield ?? 0,
    intercept: def.intercept ?? 0,
    armory: hasTag(def, 'armory'),
  };
}

// What the colony has and gives:
//   power      { plants, ship, made, used, spare }: what its power plants
//              make (a solar array is one), the landed ship's spare (what
//              its reactors make beyond what its own parts use; none while
//              the ship is away, M28), the two together, what the powered
//              buildings take, and what is left
//   buildings  [{ uid, type, name, need, powered, gives, makes, worked }],
//              in the order built. Each takes the power it needs, in that
//              order, while enough is left; one it doesn't reach is dark and
//              gives nothing. One that makes power, or needs none, is never
//              dark, and farms and mines need none. makes is a farm's or a
//              mine's ({ food } or { materials }: what it makes a day), or
//              from M39 a part's building's that makes food (a greenhouse),
//              else null; worked, whether a citizen works it (M38f): one to
//              each farm and mine in the order built, for citizenWork more a
//              day.
//   beds, air  from the powered buildings, one each for a crew member
//   housed     the crew at home with a bed and air at the colony: the first
//              of those at home, in the crew's order. The rest sleep aboard
//              the landed ship (aboard: their ids), or while it is away go
//              without (rough: their ids, M28). The squad on a trip is
//              neither (away: their ids).
//   storage    what the powered storehouses hold, and what a quartermaster
//              anywhere in the crew adds (M32): at home, while the ship is
//              away on a voyage (M38d)
//   made       { food, materials }: what the farms and mines make a day,
//              with what the crew at home adds (crewYields) and the
//              citizens working them (M38f)
//   citizens   { count, housed, free, working } (M38f): how many, how many
//              have a bed and air (after the crew at home), the beds and
//              air free for more, and how many work a farm or a mine
//   defense    { damage, shield, intercept, armories } of the powered
//              defenses (M29)
//   infirmary  the best powered infirmary's heal, 0 without one
//   effects    what the powered buildings bring as colony effects (M39,
//              builtEffects): { [key]: n }
export function colonyStats(campaign, rules) {
  const { colony } = campaign;
  const trip = colony.trip ?? null;
  // The ship away, on a trip or a voyage (M38d).
  const gone = Boolean(trip || colony.voyage);
  const { buildings: lighted, plants, ship, left } = poweredOf(campaign, rules);
  const effects = effectsOf(lighted, rules);
  const more = crewYields(campaign, rules, effects);
  // The citizens' hands (M38f): one to each farm and mine, in the order
  // built.
  const work = rules.balance.citizenWork ?? 0;
  let hands = colony.citizens ?? 0;
  const buildings = lighted.map(({ uid, type, build, gives, need, powered }) => {
    const own = build ? makesOf(build, colony.world, more) : partMakes(type, rules);
    const worked = Boolean(build) && Boolean(own) && hands > 0;
    if (worked) hands -= 1;
    const makes = worked ? Object.fromEntries(Object.entries(own).map(([what, n]) => [what, n + work])) : own;
    return { uid, type, name: buildingName(type, rules), need, powered, gives, makes, worked };
  });
  const lit = buildings.filter((b) => b.powered);
  const sum = (key) => lit.reduce((total, b) => total + b.gives[key], 0);
  const made = (what) => lit.reduce((total, b) => total + (b.makes?.[what] ?? 0), 0);
  const [beds, air] = [sum('beds'), sum('air')];
  const away = new Set(trip?.squad ?? []);
  const home = homeCrew(campaign);
  const housed = Math.min(home.length, beds, air);
  const without = home.slice(housed).map((member) => member.id);
  // The citizens (M38f), bedded after the crew at home.
  const count = colony.citizens ?? 0;
  const room = Math.max(0, Math.min(beds, air) - home.length);
  return {
    power: { plants, ship, made: plants + ship, used: plants + ship - left, spare: left },
    buildings,
    beds,
    air,
    housed,
    aboard: gone ? [] : without,
    rough: gone ? without : [],
    away: [...away],
    storage: sum('storage') + colonyEdge(colony.voyage ? home : campaign.crew, rules, 'stores'),
    made: { food: made('food'), materials: made('materials') },
    citizens: { count, housed: Math.min(count, room), free: Math.max(0, room - count), working: count - hands },
    defense: { damage: sum('damage'), shield: sum('shield'), intercept: sum('intercept'), armories: lit.filter((b) => b.gives.armory).length },
    infirmary: Math.max(0, ...lit.map((b) => b.gives.heal)),
    effects,
  };
}

// The colony's buildings, each with what it gives and the power it takes,
// in the order built, and whether it is powered (see colonyStats): {
// buildings: [{ uid, type, build, gives, need, powered }], plants, ship,
// left }.
function poweredOf(campaign, rules) {
  const { colony } = campaign;
  const ship = colony.trip || colony.voyage ? 0 : Math.max(0, shipStats(campaign.ship, rules).power);
  const known = colony.buildings.map((building) => {
    const build = buildOf(building.type, rules);
    const def = build ? null : rules.modules.get(building.type);
    return { uid: building.uid, type: building.type, build, gives: build ? buildGives(build) : def ? givesOf(def) : null };
  });
  const plants = known.reduce((sum, { gives }) => sum + Math.max(0, gives?.power ?? 0), 0);
  let left = plants + ship;
  const buildings = known.map((building) => {
    const need = Math.max(0, -(building.gives?.power ?? 0));
    const powered = building.gives !== null && need <= left;
    if (powered) left -= need;
    return { ...building, need, powered };
  });
  return { buildings, plants, ship, left };
}

// What the colony keeps of food and of materials, each up to its stores:
// { ship (the landed ship's holds, as on the run: travel.js
// supplyCapacity; none while it is away on a voyage, M38d), colony (its
// powered storehouses), total }.
export function storesOf(campaign, rules, stats = colonyStats(campaign, rules)) {
  const ship = campaign.colony.voyage ? 0 : supplyCapacity(campaign.ship, rules);
  return { ship, colony: stats.storage, total: ship + stats.storage };
}

// The first spot on the colony's grid where a part of type stands as a
// building with a path round it (the site's gap) clear of every other:
// from the edge the ship landed at (x = 0) outward, a column at a time,
// each top to bottom, as the part is and then turned a quarter. The grid's
// own edge needs no path: past it is open ground. { x, y, rot }, or null
// when there is no room.
export function spotFor(colony, type, rules) {
  const def = rules.colony ? siteDef(type, rules) : null;
  if (!def) return null;
  const { width, height, gap } = rules.colony.site;
  const grid = occupancy(layoutOf(colony), siteRules(rules));
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (const rot of def.rotates ? [0, 1] : [0]) {
        if (isClear(grid, def, { x, y, rot }, gap)) return { x, y, rot };
      }
    }
  }
  return null;
}

// Why a building of type can't stand at { x, y, rot } on the colony's
// grid, or null if it can: a turn it can't take, past the grid's edge, on
// another building, or too close to one for the path round it (the site's
// gap). except is the uid of a building being moved: it isn't in its own
// way.
export function siteError(colony, rules, { type, x, y, rot }, except = null) {
  const def = siteDef(type, rules);
  if (!def || !rules.colony) return 'That building is unknown.';
  const name = lowerFirst(buildingName(type, rules));
  if (!isRotation(rot) || (rot !== 0 && !def.rotates)) return `The ${name} can't be turned.`;
  const { width, height, gap } = rules.colony.site;
  const [w, h] = footprint(def, rot);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + w > width || y + h > height) return `The ${name} would stand past the edge of the colony's grid.`;
  const others = { ...layoutOf(colony), modules: colony.buildings.filter((b) => b.uid !== except) };
  const grid = occupancy(others, siteRules(rules));
  const owner = (i, j) => cellAt(grid, i, j) ?? null;
  const nameOf = (uid) => lowerFirst(buildingName(colony.buildings.find((b) => b.uid === uid).type, rules));
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) if (owner(i, j) !== null) return `The ${nameOf(owner(i, j))} stands there.`;
  }
  for (let j = y - gap; j < y + h + gap; j++) {
    for (let i = x - gap; i < x + w + gap; i++) {
      if (owner(i, j) !== null) return `Too close to the ${nameOf(owner(i, j))}: every building needs ${gap === 1 ? 'a cell' : `${gap} cells`} of path round it.`;
    }
  }
  return null;
}

// True when the placement is on the grid with nothing on it or within gap
// cells of it.
function isClear(grid, def, { x, y, rot }, gap) {
  const [w, h] = footprint(def, rot);
  if (x + w > grid.width || y + h > grid.height) return false;
  for (let j = y - gap; j < y + h + gap; j++) {
    for (let i = x - gap; i < x + w + gap; i++) {
      if ((cellAt(grid, i, j) ?? null) !== null) return false;
    }
  }
  return true;
}

// What giving the ship's part uid to the colony would come to: { ok: true,
// uid, type, building (data/colony.json's), placement { x, y, rot },
// gives, ship (without it) }, or { ok: false, error } saying why it can't
// be given. Only at the colony, with the ship home; only a part with a
// building (the bridge,
// engines, corridors and airlocks stay aboard), never a wrecked one, never
// one the ship can't fly without (a flight check that passes failing
// without it, counting nobody aboard), and only where it can stand: at
// placement, or without one in the first spot that fits.
export function donatePlan(campaign, rules, uid, placement = null) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Parts are given at the colony.' };
  if (campaign.colony.trip) return { ok: false, error: AWAY };
  const module = campaign.ship.modules.find((m) => m.uid === uid);
  if (!module) return { ok: false, error: "That part isn't on the ship." };
  const def = rules.modules.get(module.type);
  if (!def) return { ok: false, error: 'That part is unknown.' };
  const building = buildingOf(module.type, rules);
  if (!building) return { ok: false, error: 'Stays aboard: no use to the colony.' };
  if (String(uid) in (campaign.wrecks ?? {})) return { ok: false, error: "Wrecked: there's nothing left to give." };
  const removed = applyCommand(campaign.ship, rules, { op: 'remove', uid });
  // A ship refitted past flying (M27) can still give what breaks nothing
  // more.
  const failing = new Set(shipChecklist(campaign, rules).filter((line) => line.ok !== true).map((line) => line.id));
  const broken = shipChecklist({ ...campaign, ship: removed.ship }, rules).find((line) => line.ok !== true && !failing.has(line.id));
  if (broken) return { ok: false, error: `The ship couldn't fly without it: ${lowerFirst(broken.text)}.` };
  const spot = placement ?? spotFor(campaign.colony, module.type, rules);
  if (!spot) return { ok: false, error: "There's no room left on the colony's grid." };
  const why = placement && siteError(campaign.colony, rules, { type: module.type, ...placement });
  if (why) return { ok: false, error: why };
  return { ok: true, uid, type: module.type, building, placement: { x: spot.x, y: spot.y, rot: spot.rot }, gives: givesOf(def), ship: removed.ship };
}

// Gives the ship's part uid to the colony: it comes off the ship and
// stands on the colony's grid, at placement or in the first spot that
// fits. An infirmary heals a day at a time (days.js); since M28 one that
// opens no longer heals everyone to full. Returns { ok: true, plan,
// campaign } or { ok: false, error }.
export function donate(campaign, rules, uid, placement = null) {
  const plan = donatePlan(campaign, rules, uid, placement);
  if (!plan.ok) return plan;
  const placed = placeBuilding(campaign.colony, rules, plan.type, plan.placement);
  if (!placed.ok) return placed;
  return { ok: true, plan, campaign: { ...campaign, ship: plan.ship, colony: placed.colony, flags: tally(campaign.flags, { partsGiven: 1 }) } };
}

// What every change to the colony's buildings says while the ship is away
// (M28): they wait for it to come home.
export const AWAY = 'The ship is away: building waits until it is home.';

// The colony with a building of type standing at placement, laid out as
// the builder lays a ship's modules out, with the next uid: { ok: true,
// colony, uid } or { ok: false, error }. Where it stands is the caller's
// to have checked (siteError, spotFor).
export function placeBuilding(colony, rules, type, placement) {
  const placed = placeModule(layoutOf(colony), siteRules(rules), { type, ...placement });
  if (!placed.ok) return { ok: false, error: placed.message };
  return { ok: true, uid: placed.uid, colony: { ...colony, buildings: placed.ship.modules, nextUid: placed.ship.nextUid } };
}

// The ship's parts as the colony sees them, in the ship's order: [{ uid,
// type, ...donatePlan }], each with whether it can be given, and what it
// would give or why it can't.
export function shipParts(campaign, rules) {
  return campaign.ship.modules.map((module) => ({ type: module.type, ...donatePlan(campaign, rules, module.uid), uid: module.uid }));
}

// The colony's buildings as the builder lays a ship out.
export function layoutOf(colony) {
  return { frame: SITE, modules: colony.buildings, nextUid: colony.nextUid };
}

// The rules for the builder on the colony's grid: the grid among the
// frames, a full rectangle that holds as many buildings as it has cells,
// and the builds (farms, mines, solar arrays and shelters) among the
// parts, each as siteDef has it.
export function siteRules(rules) {
  const { width, height } = rules.colony.site;
  const builds = [...(rules.colony.builds?.keys() ?? [])].map((id) => [id, siteDef(id, rules)]);
  return {
    ...rules,
    frames: new Map([...rules.frames, [SITE, { id: SITE, name: 'colony', width, height, maxModules: width * height }]]),
    modules: builds.length ? new Map([...rules.modules, ...builds]) : rules.modules,
  };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
