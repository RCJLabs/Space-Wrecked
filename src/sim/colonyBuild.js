// Building by hand at the colony (ROADMAP §2, M27): a farm or a mine built
// from materials (data/colony.json builds; from M28 a solar array or a
// shelter too), a spare part from the hold set
// down as the building of its kind, or one of the ship's parts given
// (colony.js donate), each where the player puts it on the colony's grid;
// any building moved or turned; and any taken down, a part going back into
// the hold and a farm or a mine giving back its materials. The builder's
// rules place each one (on the grid, nothing in the way), with the site's
// path round every building (colony.js siteError), and every refusal says
// why. Spare parts follow the ship's parts' rules for what becomes a
// building. While the ship is away on a trip (M28), building waits until
// it is home. Pure.
//
// What is built is one of:
//   { build: id }    a farm, a mine, a solar array or a shelter, for its
//                    cost in materials
//   { part: type }   a spare part from the hold (campaign.parts)
//   { uid }          the ship's part uid
import { atColony } from './acts.js';
import { turnedPlacement } from './builder.js';
import { AWAY, buildGives, buildingName, buildingOf, buildOf, colonyStats, crewYields, donate, donatePlan, givesOf, makesOf, placeBuilding, SITE, siteDef, siteError, spotFor, storesOf } from './colony.js';
import { tally } from './flags.js';

// What building `what` would come to, at placement { x, y, rot }, or
// without one in the first spot that fits: { ok: true, what, from
// ('build', 'hold' or 'ship'), type, name (the building's), placement,
// cost (in materials), gives (a part's, colony.js givesOf, or a build's,
// buildGives; null for a farm or a mine), makes (a farm's or a mine's:
// { food } or { materials }, what it would make a day here; else null) },
// or { ok: false, error }.
export function buildPlan(campaign, rules, what, placement = null) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Building is done at the colony.' };
  if (campaign.colony.trip) return { ok: false, error: AWAY };
  if (what?.uid !== undefined) {
    const plan = donatePlan(campaign, rules, what.uid, placement);
    if (!plan.ok) return plan;
    return { ok: true, what, from: 'ship', type: plan.type, name: plan.building.name, placement: plan.placement, cost: 0, gives: plan.gives, makes: null };
  }
  const known = what?.build !== undefined ? buildOf(what.build, rules) : null;
  const type = known ? known.id : what?.part;
  if (what?.build !== undefined && !known) return { ok: false, error: 'Nothing by that name can be built.' };
  if (!known) {
    const def = rules.modules.get(type);
    if (!(campaign.parts[type] > 0)) return { ok: false, error: `There's no ${def ? lowerFirst(def.name) : 'such part'} in the hold.` };
    if (!def) return { ok: false, error: 'That part is unknown.' };
    if (!buildingOf(type, rules)) return { ok: false, error: 'Stays aboard: no use to the colony.' };
  }
  const cost = known ? known.cost : 0;
  const { materials } = campaign.colony;
  if (cost > materials) return { ok: false, error: `A ${lowerFirst(known.name)} takes ${cost} materials, and the stores have ${materials}.` };
  const spot = placement ?? spotFor(campaign.colony, type, rules);
  if (!spot) return { ok: false, error: "There's no room left on the colony's grid." };
  const why = placement && siteError(campaign.colony, rules, { type, ...placement });
  if (why) return { ok: false, error: why };
  return {
    ok: true,
    what,
    from: known ? 'build' : 'hold',
    type,
    name: buildingName(type, rules),
    placement: { x: spot.x, y: spot.y, rot: spot.rot },
    cost,
    gives: known ? (known.makes ? null : buildGives(known)) : givesOf(rules.modules.get(type)),
    makes: known ? makesOf(known, campaign.colony.world, crewYields(campaign, rules)) : null,
  };
}

// Builds `what` (see buildPlan). A build takes its materials; a spare part
// comes out of the hold; a ship's part comes off the ship. The flags count
// what was built and set down, and the materials spent. Returns { ok:
// true, plan, campaign } or { ok: false, error }.
export function build(campaign, rules, what, placement = null) {
  const plan = buildPlan(campaign, rules, what, placement);
  if (!plan.ok) return plan;
  if (plan.from === 'ship') {
    const given = donate(campaign, rules, what.uid, plan.placement);
    return given.ok ? { ...given, plan } : given;
  }
  const placed = placeBuilding(campaign.colony, rules, plan.type, plan.placement);
  if (!placed.ok) return placed;
  const fromHold = plan.from === 'hold';
  const colony = { ...placed.colony, materials: campaign.colony.materials - plan.cost };
  const parts = fromHold ? withPart(campaign.parts, plan.type, -1) : campaign.parts;
  const flags = tally(campaign.flags, { built: fromHold ? 0 : 1, partsSetDown: fromHold ? 1 : 0, materialsSpent: plan.cost });
  return { ok: true, plan, campaign: { ...campaign, colony, parts, flags } };
}

// What moving building uid to placement { x, y, rot } would come to: { ok:
// true, uid, type, name, placement } or { ok: false, error }. It turns the
// same way: a placement with another rot.
export function movePlan(campaign, rules, uid, placement) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Buildings are moved at the colony.' };
  if (campaign.colony.trip) return { ok: false, error: AWAY };
  const building = campaign.colony.buildings.find((b) => b.uid === uid);
  if (!building) return { ok: false, error: "There's no such building." };
  const { x, y, rot } = placement ?? {};
  if (building.x === x && building.y === y && building.rot === rot) return { ok: false, error: `The ${lowerFirst(buildingName(building.type, rules))} stands there already.` };
  const why = siteError(campaign.colony, rules, { type: building.type, x, y, rot }, uid);
  if (why) return { ok: false, error: why };
  return { ok: true, uid, type: building.type, name: buildingName(building.type, rules), placement: { x, y, rot } };
}

// Moves building uid (see movePlan). It keeps its uid and its place in the
// order built, so it takes power where it did. Returns { ok: true, plan,
// campaign } or { ok: false, error }.
export function moveBuilding(campaign, rules, uid, placement) {
  const plan = movePlan(campaign, rules, uid, placement);
  if (!plan.ok) return plan;
  const buildings = campaign.colony.buildings.map((b) => (b.uid === uid ? { uid, type: b.type, ...plan.placement } : b));
  return { ok: true, plan, campaign: { ...campaign, colony: { ...campaign.colony, buildings } } };
}

// Where a building of type at placement stands after a quarter turn
// clockwise, about its middle, slid back onto the grid if the turn takes
// it past the edge (builder.js turnedPlacement): { x, y, rot }. Whether it
// can stand there is siteError's.
export function turnedSpot(rules, type, placement) {
  const def = siteDef(type, rules);
  const { width, height } = rules.colony.site;
  const { x, y, rot } = turnedPlacement(def, placement, { id: SITE, width, height });
  return { x, y, rot };
}

// What taking building uid down would come to: { ok: true, uid, type,
// name, back, darkens }. back is what comes back: { part: type } into the
// hold, or a build's { materials (its cost), kept (what the stores take of
// them) }. darkens is the names of the buildings it would leave without
// power, in the order built. { ok: false, error } away from the colony,
// while the ship is away, or for no such building.
export function takeDownPlan(campaign, rules, uid) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Buildings are taken down at the colony.' };
  if (campaign.colony.trip) return { ok: false, error: AWAY };
  const building = campaign.colony.buildings.find((b) => b.uid === uid);
  if (!building) return { ok: false, error: "There's no such building." };
  const known = buildOf(building.type, rules);
  let back = { part: building.type };
  if (known) {
    const room = Math.max(0, storesOf(campaign, rules).total - campaign.colony.materials);
    back = { materials: known.cost, kept: Math.min(known.cost, room) };
  }
  const lit = new Set(colonyStats(campaign, rules).buildings.filter((b) => b.powered).map((b) => b.uid));
  const after = colonyStats(without(campaign, uid), rules).buildings;
  const darkens = after.filter((b) => lit.has(b.uid) && !b.powered).map((b) => b.name);
  return { ok: true, uid, type: building.type, name: buildingName(building.type, rules), back, darkens };
}

// Takes building uid down (see takeDownPlan). The flags count the
// buildings taken down. Returns { ok: true, plan, campaign } or { ok:
// false, error }.
export function takeDown(campaign, rules, uid) {
  const plan = takeDownPlan(campaign, rules, uid);
  if (!plan.ok) return plan;
  const gone = without(campaign, uid);
  const materials = gone.colony.materials + (plan.back.kept ?? 0);
  const parts = plan.back.part ? withPart(campaign.parts, plan.back.part, 1) : campaign.parts;
  return { ok: true, plan, campaign: { ...gone, colony: { ...gone.colony, materials }, parts, flags: tally(campaign.flags, { takenDown: 1 }) } };
}

// What can be built at the colony, for the colony's build list: { builds,
// hold }. builds: [{ what, id, name, cost, makes, gives, ok, error }] for
// each build, in data order: what it costs, what it would make a day here
// or give (the other null), and whether it can be built now (the
// materials, and a spot on the grid). hold: [{ what, type, count, ok, name
// (the building's), gives,
// error }] for each kind of spare part in the hold, in the hold's order:
// those that stand as buildings with what they give, the rest with why
// not. The ship's parts are colony.js shipParts's.
export function buildList(campaign, rules) {
  const builds = [...(rules.colony?.builds?.values() ?? [])].map((known) => {
    const what = { build: known.id };
    const plan = buildPlan(campaign, rules, what);
    const makes = makesOf(known, campaign.colony.world, crewYields(campaign, rules));
    return { what, id: known.id, name: known.name, cost: known.cost, makes, gives: makes ? null : buildGives(known), ok: plan.ok, error: plan.ok ? null : plan.error };
  });
  const hold = Object.entries(campaign.parts).map(([type, count]) => {
    const what = { part: type };
    const plan = buildPlan(campaign, rules, what);
    return { what, type, count, ok: plan.ok, name: buildingOf(type, rules)?.name ?? null, gives: plan.ok ? plan.gives : null, error: plan.ok ? null : plan.error };
  });
  return { builds, hold };
}

// The campaign with building uid gone from the colony.
function without(campaign, uid) {
  return { ...campaign, colony: { ...campaign.colony, buildings: campaign.colony.buildings.filter((b) => b.uid !== uid) } };
}

// Parts on hand with n more of type (or fewer), none of a kind left out.
function withPart(parts, type, n) {
  const next = { ...parts, [type]: (parts[type] ?? 0) + n };
  if (next[type] <= 0) delete next[type];
  return next;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
