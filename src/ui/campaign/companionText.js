// Words for the companions (M33c, src/sim/companions.js): who one is where
// they offer to come aboard (their face, name, side, job and past), what a
// choice signing them on says, their loyalty on the crew card, and the line
// as they turn loyal. rules are the content tables (src/sim/defs.js).
import { crewColor } from '../../render/units.js';
import { aboard, companionOf, freeBerths } from '../../sim/companions.js';
import { talentOrder, TALENT_RANK } from '../../sim/talents.js';
import { supplyCapacity } from '../../sim/travel.js';
import { jobName, talentGives, talentOf } from './crewJobText.js';
import { sideName } from './standingText.js';

// A companion as the event card shows them: { id, name, about ("Engineer ·
// The Fleet"), past, face (what their portrait is drawn from, in the trim
// of the place they take in the crew), line (all of it, for a screen
// reader) }.
export function companionCard(companion, campaign, rules) {
  const member = aboard(campaign, companion.id);
  const place = member ? campaign.crew.indexOf(member) : campaign.crew.length;
  const about = companionAbout(companion, rules);
  return {
    id: companion.id,
    name: companion.name,
    about,
    past: companion.past,
    face: { look: companion.look, job: rules.jobs.get(companion.job)?.look ?? null, trim: crewColor(place) },
    line: `${companion.name}, ${about}. ${companion.past}`,
  };
}

// "Engineer · The Fleet": a companion's job and side.
export function companionAbout(companion, rules) {
  return `${jobName(companion.job, rules)} · ${sideName(companion.side, rules)}`;
}

// The companion a choice of `event` would sign on, unless they are aboard
// already: their companionCard, or null.
export function offeredBy(event, campaign, rules) {
  for (const choice of event.choices) {
    for (const outcome of choice.outcomes) {
      const companion = companionOf(rules, outcome.effects?.joins);
      if (companion && !aboard(campaign, companion.id)) return companionCard(companion, campaign, rules);
    }
  }
  return null;
}

// What signing on does, among an outcome's effects: "Ines Varga signs on,
// in a free berth".
export function joinsSaid(id, rules) {
  return `${companionOf(rules, id)?.name ?? 'Someone'} signs on, in a free berth`;
}

// Under a choice that needs a berth: "Takes a berth · 1 free".
export function berthSaid(campaign, rules) {
  return `Takes a berth · ${freeBerths(campaign, rules)} free`;
}

// What the crew eats with companion `id` aboard, their lockers counted, as
// a recruit's sign-on says it (crewText.js): "A crew of 4 eats 4 supplies a
// jump, and full holds last 7 jumps."
export function feedSaid(id, campaign, rules) {
  const companion = companionOf(rules, id);
  if (!companion) return '';
  const crew = [...campaign.crew, { job: companion.job, fights: companion.fights, traits: companion.traits }];
  const each = rules.balance.jumpSupplies * crew.length;
  const jumps = Math.floor(supplyCapacity(campaign.ship, rules, crew) / Math.max(1, each));
  return `A crew of ${crew.length} eats ${each} supplies a jump, and full holds last ${jumps} jumps.`;
}

// A companion signed on, for the event's result: "Ines Varga signs on.",
// and their loyalty quest, opened.
export function joinedLines(id, rules) {
  const companion = companionOf(rules, id);
  if (!companion) return [];
  const loyalty = rules.quests.get(companion.loyalty);
  return [`${companion.name} signs on.`, ...(loyalty ? [`A new quest: ${loyalty.name}. ${loyalty.steps[0]?.next ?? ''}`.trim()] : [])];
}

// A companion's loyalty, for the crew card: loyal, their talent and its
// numbers ("Loyal: Bosun's weld, Weld ×3 a fight, 8 rounds."); before, what
// earns it ("Loyal once Varga's tender is done: rank 3, Bosun's weld.");
// null for anyone else, and once their loyalty quest is no longer open.
export function loyaltyLine(member, campaign, rules) {
  const companion = companionOf(rules, member.companion);
  if (!companion) return null;
  const talent = talentOf(member, rules);
  if (talent) return `Loyal: ${talent.name}, ${talentGives(talent)}.`;
  const quest = rules.quests.get(companion.loyalty);
  if (!quest || campaign.quests?.[quest.id]?.state !== 'open') return null;
  return `Loyal once ${quest.name} is done: rank ${TALENT_RANK}, ${companion.talent.name}.`;
}

// As a companion turns loyal, for the fight's end and the homecoming:
// "Ines Varga is loyal: rank 3, Bosun's weld (Weld ×3 a fight, 8 rounds),
// from the next fight."
export function loyalSaid(companion, rules) {
  const order = talentOrder(rules, companion.id);
  if (!order) return `${companion.name} is loyal.`;
  return `${companion.name} is loyal: rank ${TALENT_RANK}, ${companion.talent.name} (${talentGives({ order })}), from the next fight.`;
}
