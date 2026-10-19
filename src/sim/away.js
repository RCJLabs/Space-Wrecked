// The ship away on a voyage from the colony (M38d, voyage.js): the crew and
// the food are split. Those aboard and the ship's holds are the campaign's
// crew and supplies, so all of act 2's run counts only them; those at home
// and the colony's food wait in the voyage (colony.voyage home). While
// those at home fight a raid the two change places (homeFront): the
// campaign's crew and supplies are the colony's, and the ship's wait in the
// voyage (colony.voyage aboard) until the fight is over (backAboard). From
// M38e the other colonies keep their own (colonies.js). Plain data.
import { frontOf, othersCrew } from './colonies.js';

// More systems out from the colony than a voyage goes: a guard on what a
// save can hold (campaign.js), and past it no chart reaches (travel.js).
export const MAX_OUT = 999;

// The voyage under way, or null with the ship home.
export function voyageOf(campaign) {
  return campaign.colony?.voyage ?? null;
}

// Everyone in the crew, those in play first: while the ship is away, those
// aboard and those at home; then those at the other colonies (M38e).
export function wholeCrew(campaign) {
  const voyage = voyageOf(campaign);
  return [...campaign.crew, ...(voyage?.home?.crew ?? voyage?.aboard?.crew ?? []), ...othersCrew(campaign)];
}

// The id the next crew member signs on with: past everyone's, aboard, at
// home or at another colony, and from M41 the fallen's.
export function nextCrewId(campaign) {
  return Math.max(0, ...wholeCrew(campaign).map((member) => member.id), ...(campaign.fallen ?? []).map((member) => member.id)) + 1;
}

// Those at home while the ship is away, in the crew's order: waiting in the
// voyage, or in play while they fight a raid. Null with the ship home.
export function homeOf(campaign) {
  const voyage = voyageOf(campaign);
  return voyage ? voyage.home?.crew ?? campaign.crew : null;
}

// Those aboard while the ship is away: in play, or waiting in the voyage
// while those at home fight a raid, or parked at another colony while
// those there fight one (M38e, colonies.js frontAt). Null with the ship
// home.
export function aboardOf(campaign) {
  const voyage = voyageOf(campaign);
  return voyage ? voyage.aboard?.crew ?? frontOf(campaign)?.parked.crew ?? campaign.crew : null;
}

// The colony's food: with the ship home one store with its holds, the
// campaign's supplies; while it is away the colony's own.
export function colonyFood(campaign) {
  return voyageOf(campaign)?.home?.food ?? campaign.supplies;
}

// The campaign with the colony's food at `food` (see colonyFood).
export function withColonyFood(campaign, food) {
  const voyage = voyageOf(campaign);
  if (!voyage?.home) return { ...campaign, supplies: food };
  return { ...campaign, colony: { ...campaign.colony, voyage: { ...voyage, home: { ...voyage.home, food } } } };
}

// The colony's side in play while the ship is away: those at home are the
// campaign's crew and the colony's food its supplies, and those aboard and
// the ship's holds wait in the voyage. Else the campaign as it is.
export function homeFront(campaign) {
  const voyage = voyageOf(campaign);
  if (!voyage?.home) return campaign;
  const { home, ...rest } = voyage;
  return { ...campaign, crew: home.crew, supplies: home.food, colony: { ...campaign.colony, voyage: { ...rest, aboard: { crew: campaign.crew, supplies: campaign.supplies } } } };
}

// The ship's side back in play (see homeFront). Else the campaign as it is.
export function backAboard(campaign) {
  const voyage = voyageOf(campaign);
  if (!voyage?.aboard) return campaign;
  const { aboard, ...rest } = voyage;
  return { ...campaign, crew: aboard.crew, supplies: aboard.supplies, colony: { ...campaign.colony, voyage: { ...rest, home: { crew: campaign.crew, food: campaign.supplies } } } };
}
