// More colonies (M38e): from a voyage the ship can settle another world,
// and another. The colony it is landed at, or flew from, is
// campaign.colony, as since M26; the others wait in campaign.colonies, each
// keeping whoever was left there and its food:
//   keep   { crew, food }: those at the colony and its food (away.js has
//          the colony the ship flew from keep them in its voyage instead)
//   parked { crew, supplies }: while those at the colony fight a raid, the
//          side they stand in for (raids.js frontAt), else absent
// Every colony has, beside M26's to M38d's fields:
//   id     its number, 1 for the first and up in the order they were
//          settled
//   at     where it lies along the line of systems: the first at 0, and
//          one settled on a voyage as many systems past the colony the
//          ship flew from as the voyage had gone
//   heat   its own trail (Evan's pick): the heat the ship left it with,
//          falling a day; while the ship is landed there the campaign's
//          heat is the colony's, and this is unused
// Plain data; imports nothing, so every part of the sim can ask.

// More colonies than a run settles, and a place along the line farther than
// a run flies: guards on what a save can hold.
export const MAX_COLONIES = 12;
export const MAX_AT = 99999;

// Every colony: the one the ship is at or flew from first, then the others
// in the order settled. [] before act 3.
export function allColonies(campaign) {
  return campaign.colony ? [campaign.colony, ...(campaign.colonies ?? [])] : [];
}

// The colony numbered id, or null.
export function colonyById(campaign, id) {
  return allColonies(campaign).find((colony) => colony.id === id) ?? null;
}

// The number the next colony settled takes.
export function nextColonyId(campaign) {
  return Math.max(0, ...allColonies(campaign).map((colony) => colony.id)) + 1;
}

// Where the ship is along the line of systems: at the colony it is landed
// at, or out on a voyage where the voyage has taken it (voyage.js).
export function shipAt(campaign) {
  const { colony } = campaign;
  return colony?.voyage ? colony.voyage.at : colony?.at ?? 0;
}

// The days the ship needs to reach a colony, flying straight there (Evan's
// pick): one a system between, one at least; 0 for the one it is landed at.
export function reachOf(campaign, colony) {
  if (colony === campaign.colony && !colony.voyage) return 0;
  return Math.max(1, Math.abs(shipAt(campaign) - colony.at));
}

// Those at the other colonies, and those standing in for a side that
// fights a raid there, in the colonies' order.
export function othersCrew(campaign) {
  return (campaign.colonies ?? []).flatMap((colony) => [...(colony.keep?.crew ?? []), ...(colony.parked?.crew ?? [])]);
}

// The heat the pursuer hunts a colony by (its own trail, Evan's pick): the
// campaign's while the ship is landed there, else the colony's own.
export function heatAt(campaign, colony) {
  return colony === campaign.colony && !colony.voyage ? campaign.heat : colony.heat;
}

// The campaign with the other colony numbered id as fn makes it.
export function withOther(campaign, id, fn) {
  return { ...campaign, colonies: campaign.colonies.map((colony) => (colony.id === id ? fn(colony) : colony)) };
}

// The campaign as another colony lives it, for the rules a colony's day
// and its raid run by (days.js, raids.js): its own the campaign's colony,
// crew and supplies, the ship away from it as on a voyage with its side
// out of play (so it runs on its own power, and keeps its materials past
// the storehouses), where the ship is now, and no colonies of its own.
// thereFrom takes it back.
export function thereAt(campaign, id) {
  const { keep, ...colony } = campaign.colonies.find((other) => other.id === id);
  const away = { out: 1, homing: null, at: shipAt(campaign), to: null, aboard: { crew: [], supplies: 0 } };
  return { ...campaign, crew: keep.crew, supplies: keep.food, colony: { ...colony, voyage: away }, colonies: [] };
}

// The campaign once another colony has lived what thereAt gave it: that
// colony as it came out, with whoever is there and its food, and the
// rolls and the flags it made.
export function thereFrom(campaign, there) {
  const { voyage, ...colony } = there.colony;
  const back = { ...colony, voyage: null, keep: { crew: there.crew, food: there.supplies } };
  return { ...withOther(campaign, colony.id, () => back), rng: there.rng, flags: there.flags };
}

// Those at another colony in play to fight a raid there (raids.js): its
// crew and food the campaign's, and the side that was in play parked at it
// until the fight is over (backFrom).
export function frontAt(campaign, id) {
  const { keep, ...colony } = campaign.colonies.find((other) => other.id === id);
  const parked = { crew: campaign.crew, supplies: campaign.supplies };
  return withOther({ ...campaign, crew: keep.crew, supplies: keep.food }, id, () => ({ ...colony, parked }));
}

// The parked side back in play once a raid fight at another colony is over
// (see frontAt): the colony keeps whoever fought there and its food.
export function backFrom(campaign, id) {
  const { parked, ...colony } = campaign.colonies.find((other) => other.id === id);
  const keep = { crew: campaign.crew, food: campaign.supplies };
  return withOther({ ...campaign, crew: parked.crew, supplies: parked.supplies }, id, () => ({ ...colony, keep }));
}

// The colony whose raid fight is on, its side parked (frontAt), or null.
export function frontOf(campaign) {
  return (campaign.colonies ?? []).find((colony) => colony.parked) ?? null;
}
