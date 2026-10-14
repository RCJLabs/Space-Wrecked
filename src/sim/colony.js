// The colony (ROADMAP §2, M26): act 3's home, on the world settled. The
// ship's useful parts come off it one at a time and stand on the colony's
// grid as buildings (data/colony.json): each part becomes the building of
// its kind, and what a building gives is its part's own numbers. The crew
// lives at the colony now, so the ship's flight checks count nobody aboard
// (campaign.js crewAboard), and the landed ship's spare power runs the
// colony too. Pure.
//
// The colony (campaign.colony):
//   world      the world settled (settle.js)
//   buildings  [{ uid, type, x, y, rot }]: the parts given, in the order
//              they were given, each where it stands on the colony's grid,
//              laid out as a ship's modules are (builder.js). type is the
//              part's own (a maker's version stays one).
//   nextUid    the next building's uid
import { atColony } from './acts.js';
import { applyCommand, occupancy, placeModule } from './builder.js';
import { shipChecklist } from './campaign.js';
import { shipStats } from './constraints.js';
import { tally } from './flags.js';
import { cellAt } from './grid.js';
import { baseOf } from './makers.js';
import { healCrew } from './medbay.js';
import { footprint, hasTag } from './modules.js';

// The id the colony's grid goes by as a frame, for the builder's placement.
export const SITE = 'colony';

// A colony on the world settled, with nothing built yet.
export function newColony(world) {
  return { world, buildings: [], nextUid: 1 };
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
//   damage, shield, intercept   a defense's, for M29's raids
//   armory     true for an armory, also for the raids
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
//              make, the landed ship's spare (what its reactors make beyond
//              what its own parts use), the two together, what the powered
//              buildings take, and what is left
//   buildings  [{ uid, type, name, need, powered, gives }], in the order
//              given. Each takes the power it needs, in that order, while
//              enough is left; one it doesn't reach is dark and gives
//              nothing. One that makes power, or needs none, is never dark.
//   beds, air  from the powered buildings, one each for a crew member
//   housed     the crew with a bed and air at the colony: the first of the
//              crew, in its order. aboard is the ids of the rest, who
//              sleep aboard the landed ship.
//   storage    what the powered storehouses hold (M27)
//   defense    { damage, shield, intercept, armories } of the powered
//              defenses (M29)
//   infirmary  the best powered infirmary's heal, 0 without one
export function colonyStats(campaign, rules) {
  const { colony, crew } = campaign;
  const ship = Math.max(0, shipStats(campaign.ship, rules).power);
  const known = colony.buildings.map((building) => {
    const def = rules.modules.get(building.type);
    return { ...building, def, gives: def ? givesOf(def) : null };
  });
  const plants = known.reduce((sum, { gives }) => sum + Math.max(0, gives?.power ?? 0), 0);
  let left = plants + ship;
  const buildings = known.map(({ uid, type, def, gives }) => {
    const need = Math.max(0, -(gives?.power ?? 0));
    const powered = gives !== null && need <= left;
    if (powered) left -= need;
    return { uid, type, name: buildingOf(type, rules)?.name ?? def?.name ?? type, need, powered, gives };
  });
  const lit = buildings.filter((b) => b.powered);
  const sum = (key) => lit.reduce((total, b) => total + b.gives[key], 0);
  const [beds, air] = [sum('beds'), sum('air')];
  const housed = Math.min(crew.length, beds, air);
  return {
    power: { plants, ship, made: plants + ship, used: plants + ship - left, spare: left },
    buildings,
    beds,
    air,
    housed,
    aboard: crew.slice(housed).map((member) => member.id),
    storage: sum('storage'),
    defense: { damage: sum('damage'), shield: sum('shield'), intercept: sum('intercept'), armories: lit.filter((b) => b.gives.armory).length },
    infirmary: Math.max(0, ...lit.map((b) => b.gives.heal)),
  };
}

// The first spot on the colony's grid where a part of type stands as a
// building with a path round it (the site's gap) clear of every other:
// from the edge the ship landed at (x = 0) outward, a column at a time,
// each top to bottom, as the part is and then turned a quarter. The grid's
// own edge needs no path: past it is open ground. { x, y, rot }, or null
// when there is no room.
export function spotFor(colony, type, rules) {
  const def = rules.modules.get(type);
  if (!def || !rules.colony) return null;
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
// be given. Only at the colony; only a part with a building (the bridge,
// engines, corridors and airlocks stay aboard), never a wrecked one, never
// one the ship can't fly without (every flight check passing, counting
// nobody aboard), and never when the grid has no room.
export function donatePlan(campaign, rules, uid) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Parts are given at the colony.' };
  const module = campaign.ship.modules.find((m) => m.uid === uid);
  if (!module) return { ok: false, error: "That part isn't on the ship." };
  const def = rules.modules.get(module.type);
  if (!def) return { ok: false, error: 'That part is unknown.' };
  const building = buildingOf(module.type, rules);
  if (!building) return { ok: false, error: 'It stays aboard: the colony has no use for it.' };
  if (String(uid) in (campaign.wrecks ?? {})) return { ok: false, error: "It's wrecked: there's nothing left in it to give." };
  const removed = applyCommand(campaign.ship, rules, { op: 'remove', uid });
  const failing = shipChecklist({ ...campaign, ship: removed.ship }, rules).find((line) => line.ok !== true);
  if (failing) return { ok: false, error: `The ship couldn't fly without it: ${lowerFirst(failing.text)}.` };
  const placement = spotFor(campaign.colony, module.type, rules);
  if (!placement) return { ok: false, error: "There's no room left on the colony's grid for it." };
  return { ok: true, uid, type: module.type, building, placement, gives: givesOf(def), ship: removed.ship };
}

// Gives the ship's part uid to the colony: it comes off the ship and
// stands on the colony's grid. A powered infirmary heals the crew to full
// as it opens: given, or given the power it lacked. Returns { ok: true,
// plan, campaign, healed (hit points healed in all) } or { ok: false,
// error }.
export function donate(campaign, rules, uid) {
  const plan = donatePlan(campaign, rules, uid);
  if (!plan.ok) return plan;
  const placed = placeModule(layoutOf(campaign.colony), siteRules(rules), { type: plan.type, ...plan.placement });
  if (!placed.ok) return { ok: false, error: placed.message };
  const colony = { ...campaign.colony, buildings: placed.ship.modules, nextUid: placed.ship.nextUid };
  let next = { ...campaign, ship: plan.ship, colony, flags: tally(campaign.flags, { partsGiven: 1 }) };
  let healed = 0;
  if (opensInfirmary(campaign, next, rules)) {
    const heal = healCrew(next.crew, Infinity, rules);
    next = { ...next, crew: heal.crew };
    healed = heal.healed;
  }
  return { ok: true, plan, campaign: next, healed };
}

// The ship's parts as the colony sees them, in the ship's order: [{ uid,
// type, ...donatePlan }], each with whether it can be given, and what it
// would give or why it can't.
export function shipParts(campaign, rules) {
  return campaign.ship.modules.map((module) => ({ type: module.type, ...donatePlan(campaign, rules, module.uid), uid: module.uid }));
}

// True when an infirmary is powered after that wasn't before.
function opensInfirmary(before, after, rules) {
  const open = (campaign) => colonyStats(campaign, rules).buildings.filter((b) => b.powered && b.gives.heal > 0).map((b) => b.uid);
  const was = new Set(open(before));
  return open(after).some((uid) => !was.has(uid));
}

// The colony's buildings as the builder lays a ship out.
function layoutOf(colony) {
  return { frame: SITE, modules: colony.buildings, nextUid: colony.nextUid };
}

// The rules with the colony's grid among the frames, for the builder: a
// full rectangle that holds as many buildings as it has cells.
function siteRules(rules) {
  const { width, height } = rules.colony.site;
  return { ...rules, frames: new Map([...rules.frames, [SITE, { id: SITE, name: 'colony', width, height, maxModules: width * height }]]) };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
