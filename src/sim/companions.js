// Companions (M33c, ROADMAP §7): people with a story, one for each side
// (data/companions.json). Each is met on the run at the end of their side's
// chain (quests.js): a choice of the chain's step brings them aboard
// (events.js `joins`), given a free berth, as a recruit needs one, and at no
// fee. They come with their name, job, traits, the fights they have stood,
// their face (looks.js) and their past, and from the day they join their
// loyalty quest is open: one step, a place within reach of the colony held
// by someone from their past. Won, they are loyal (stepDone): their job's
// order is at a third rank, past rank 2, with their talent's numbers laid
// over rank 2's (talents.js), in every fight after. Let go before then,
// the loyalty quest ends (recruits.js dismissCrew).
//
// A companion aboard is a crew member with `companion` (their id), and
// `loyal: true` once their loyalty quest is done. Pure.
import { nextCrewId, voyageOf, wholeCrew } from './away.js';
import { maxHp } from './campaign.js';
import { crewRoom } from './crew.js';
import { talentOrder } from './talents.js';

export { TALENT_RANK } from './talents.js';

// The companion by id, or null.
export function companionOf(rules, id) {
  return rules.companions?.get(id) ?? null;
}

// The crew member who is companion `id`, or null when they aren't aboard:
// from M38d, aboard or at home while the ship is away on a voyage (away.js).
export function aboard(campaign, id) {
  return wholeCrew(campaign).find((member) => member.companion === id) ?? null;
}

// The berths free aboard: the crew the ship carries (crew.js crewRoom),
// less those aboard.
export function freeBerths(campaign, rules) {
  return Math.max(0, crewRoom(campaign.ship, rules) - campaign.crew.length);
}

// Companion `id` signs on: a crew member made from their data, with the
// next id, at full health, and their loyalty quest open at its first step.
// Returns { campaign, joined: the member }, or { campaign, joined: null }
// with the campaign as it was when they are aboard already, unknown, or
// there is no berth for them.
export function joinCompanion(campaign, rules, id) {
  const companion = companionOf(rules, id);
  if (!companion || aboard(campaign, id) || freeBerths(campaign, rules) < 1) return { campaign, joined: null };
  const member = {
    id: nextCrewId(campaign),
    name: companion.name,
    job: companion.job,
    hp: 1,
    traits: [...companion.traits],
    look: { ...companion.look },
    fights: companion.fights,
    companion: id,
  };
  member.hp = maxHp(member, rules);
  const quests = campaign.quests?.[companion.loyalty] ? campaign.quests : { ...campaign.quests, [companion.loyalty]: { step: 0, state: 'open' } };
  return { campaign: { ...campaign, crew: [...campaign.crew, member], quests }, joined: member };
}

// The companion whose loyalty quest `questId` is, or null.
export function loyaltyOf(rules, questId) {
  const id = rules.quests?.get(questId)?.companion;
  return id ? companionOf(rules, id) : null;
}

// The campaign with companion `id` loyal, if they are aboard: their crew
// member marked so, wherever they are on a voyage (M38d). Their order is at
// the third rank from the next fight.
export function makeLoyal(campaign, id) {
  if (!aboard(campaign, id)) return campaign;
  const loyal = (crew) => crew.map((member) => (member.companion === id ? { ...member, loyal: true } : member));
  const voyage = voyageOf(campaign);
  const side = voyage?.home ? 'home' : voyage?.aboard ? 'aboard' : null;
  const marked = { ...campaign, crew: loyal(campaign.crew) };
  return side ? { ...marked, colony: { ...marked.colony, voyage: { ...voyage, [side]: { ...voyage[side], crew: loyal(voyage[side].crew) } } } } : marked;
}

// A crew member's talent, their order past rank 2, if they are a loyal
// companion (talents.js); else null.
export function memberTalent(member, rules) {
  return member?.loyal && member.companion ? talentOrder(rules, member.companion) : null;
}
