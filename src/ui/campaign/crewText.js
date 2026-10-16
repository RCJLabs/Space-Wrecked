// Words for the crew on the run (M23): the crew card on the sector map
// (crewCard.js), with who is aboard, the room the ship has, what the med
// bay heals, and at a station the recruits for hire and letting crew go;
// the crew panel's heading; what a first tap on the card says; and the
// squad a boarding takes, for the approach screen's picker (approach.js).
// From M33c the crew card opens at the colony too, and a companion's row
// has their side, past and loyalty. rules are the content tables
// (src/sim/defs.js).
import { crewColor } from '../../render/units.js';
import { maxHp } from '../../sim/campaign.js';
import { companionOf } from '../../sim/companions.js';
import { crewRoom, defaultSquad } from '../../sim/crew.js';
import { healRate } from '../../sim/medbay.js';
import { rankOf } from '../../sim/ranks.js';
import { dismissPlan, hirePlan, recruitOffer } from '../../sim/recruits.js';
import { hereOf, onTheRun, supplyCapacity } from '../../sim/travel.js';
import { companionAbout, loyaltyLine } from './companionText.js';
import { jobBrief, memberBrief, rankLine, shownRank } from './crewJobText.js';
import { dockSaid } from './standingText.js';

// How a trait's numbers read: "aim +5", "hit points +2".
const STAT_NAMES = { hp: 'hit points', aim: 'aim', defense: 'defense', mobility: 'mobility', armor: 'armor' };

// The crew card:
//   title    "Crew · 3 aboard, room for 4", at the colony "Crew · 3 at the
//            colony"
//   text     the room, what the med bay heals, where crew come and go
//   members  [{ id, name, about, past, rank, rankLine, loyalty, traits,
//            brief, hp, max, face, dismiss }]: about is "Captain · Marine",
//            or the job unless it is the name, and a recruit's background
//            (M32b), or a companion's side (M33c: "Engineer · The Fleet");
//            past a companion's, none for anyone else; rank their rank, 0
//            for none, a loyal companion's the third (crewJobText.js
//            shownRank), and rankLine it with their fights (rankLine);
//            loyalty a companion's (companionText.js loyaltyLine), or null;
//            brief what the job brings at their rank (memberBrief, M32);
//            face is what their portrait is drawn from (faceOf); dismiss {
//            key, ok, label, ask, text, why } at a station, null elsewhere
//            and for the captain
//   hire     null away from a station, else { title, line, recruits: [{
//            key, slot, name, about, past, rank, rankLine, traits, brief,
//            hp, max, face, ok, label, ask, text, why }] }: past is the
//            line about their background, the label their fee; line says
//            why no one can sign on, or that no one is left, or is null
//   hint     { tone, text } for the foot while nothing has had a first tap
export function crewCardText(campaign, rules) {
  const room = crewRoom(campaign.ship, rules);
  const atStation = onTheRun(campaign, rules) && hereOf(campaign)?.type === 'station';
  // At the colony (M33c) the card is the crew's, with no berths to fill.
  const home = Boolean(campaign.colony);
  const lines = home ? ['Everyone at the colony, and what each brings to it.'] : [`The berths and life support carry ${room}.`, medbayLine(campaign, rules)];
  if (!atStation && !home) lines.push('Crew sign on and are let go at stations.');
  const members = campaign.crew.map((member, i) => {
    const job = jobName(member.job, rules);
    const captain = member.id === campaign.captain;
    const companion = companionOf(rules, member.companion);
    return {
      id: member.id,
      name: member.name,
      about: [captain ? 'Captain' : null, companion ? companionAbout(companion, rules) : job === member.name ? null : job, pastOf(member, rules)?.name].filter(Boolean).join(' · '),
      past: companion?.past,
      rank: shownRank(member, rules),
      rankLine: rankLine(member, rules),
      loyalty: loyaltyLine(member, campaign, rules),
      traits: traitsText(member.traits, rules),
      brief: memberBrief(member, rules),
      hp: member.hp,
      max: maxHp(member, rules),
      face: faceOf(member, rules, i),
      dismiss: atStation && !captain ? dismissText(campaign, rules, member) : null,
    };
  });
  const recruits = atStation ? recruitOffer(campaign, rules).map((recruit, i) => recruitText(campaign, rules, recruit, campaign.crew.length + i)) : [];
  const line = !recruits.length ? 'No one else is for hire here.' : (recruits.find((recruit) => !recruit.ok)?.why ?? null);
  return {
    title: home ? `Crew · ${campaign.crew.length} at the colony` : `Crew · ${campaign.crew.length} aboard, room for ${room}`,
    text: lines.join(' '),
    members,
    hire: atStation ? { title: `For hire at ${hereOf(campaign).name}`, line, recruits } : null,
    hint: home ? { tone: 'info', text: 'Tap Done for the colony.' } : cardHint(atStation, recruits, members),
  };
}

// The crew panel's heading: { text, hire }: "Crew", and at a station with
// recruits for hire and room for them, how many (hire).
export function crewHeading(campaign, rules) {
  const offer = recruitOffer(campaign, rules);
  const hire = offer.length > 0 && campaign.crew.length < crewRoom(campaign.ship, rules);
  return { text: hire ? `Crew · ${offer.length} for hire` : 'Crew', hire };
}

// What the foot says after a first tap on the card's button keyed `armed`
// ('hire:<slot>' or 'let:<id>'): { tone, text }, or null for any other key
// or a button that can't be pressed.
export function crewSaid(card, armed) {
  if (!card || typeof armed !== 'string') return null;
  const entry = [...(card.hire?.recruits ?? []), ...card.members.map((member) => member.dismiss).filter(Boolean)].find((each) => each.key === armed);
  return entry?.ok ? { tone: 'warn', text: entry.text } : null;
}

// The squad picker, for a boarding: { show (more aboard than a squad
// takes), size, label, line, title, text, members: [{ id, name, about,
// rank, hp, max, face, going }] }: about is the job, rank their rank (M32b,
// 0 for none; a loyal companion's the third, M33c). line says who goes and
// who sits it out. picked: the crew ids picked, or null for the default
// (crew.js).
export function squadText(campaign, rules, picked = null) {
  const size = rules.balance.squadSize;
  const going = new Set(picked ?? defaultSquad(campaign.crew, rules));
  const names = (keep) => listed(campaign.crew.filter((member) => going.has(member.id) === keep).map((member) => member.name));
  const staying = campaign.crew.length - going.size;
  return {
    show: campaign.crew.length > size,
    size,
    label: `Squad · ${going.size} of ${campaign.crew.length}`,
    line: `Going: ${names(true)}.${staying ? ` ${names(false)} ${staying === 1 ? 'sits' : 'sit'} this one out: tap Squad to change who.` : ''}`,
    title: `Who goes: up to ${size}`,
    text: 'Tap someone to take them or leave them aboard. The rest sit this one out.',
    members: campaign.crew.map((member, i) => {
      const job = jobName(member.job, rules);
      return { id: member.id, name: member.name, about: job === member.name ? '' : job, rank: shownRank(member, rules), hp: member.hp, max: maxHp(member, rules), face: faceOf(member, rules, i), going: going.has(member.id) };
    }),
  };
}

// What a portrait (src/ui/portrait.js) is drawn from: { look, job, trim }:
// the crew member's look, their job's helmet and suit (data/jobs.json), and
// the trim of the place they hold in the crew.
export function faceOf(member, rules, index) {
  return { look: member.look, job: rules.jobs.get(member.job)?.look ?? null, trim: crewColor(index) };
}

// What the med bay does for the crew, as a line.
function medbayLine(campaign, rules) {
  const rate = healRate(campaign, rules);
  const hasBay = campaign.ship.modules.some((module) => rules.modules.get(module.type)?.heal);
  if (rate) return `The med bay heals each of the wounded ${rate} a jump.`;
  if (hasBay) return 'The med bay is wrecked: it heals no one until a station repairs it.';
  return 'With no med bay aboard, wounds heal only when a station patches the crew.';
}

// A recruit for hire, as the card offers them, in the trim of the place
// they would take in the crew. At a station of the pursuer's side, signing
// on can be the trade that logs the ship (M33's fix).
function recruitText(campaign, rules, recruit, place) {
  const plan = hirePlan(campaign, rules, recruit.slot);
  const { fee } = recruit;
  const crew = campaign.crew.length + 1;
  const each = rules.balance.jumpSupplies * crew;
  const jumps = Math.floor(supplyCapacity(campaign.ship, rules, [...campaign.crew, recruit]) / Math.max(1, each));
  const past = pastOf(recruit, rules);
  return {
    key: `hire:${recruit.slot}`,
    slot: recruit.slot,
    name: recruit.name,
    about: [jobName(recruit.job, rules), past?.name].filter(Boolean).join(' · '),
    past: past?.text ?? null,
    rank: rankOf(recruit, rules),
    rankLine: rankLine(recruit, rules, true),
    traits: traitsText(recruit.traits, rules),
    brief: jobBrief(recruit.job, rules, rankOf(recruit, rules)),
    hp: recruit.hp,
    max: recruit.hp,
    face: faceOf(recruit, rules, place),
    ok: plan.ok,
    label: `Sign on · ${fee}`,
    ask: `Sign on for ${fee}?`,
    text: `Sign ${recruit.name} on for ${fee} credits.${dockSaid(campaign, rules, plan.dock)} A crew of ${crew} eats ${each} supplies a jump, and full holds last ${jumps} jumps. Tap again to sign on.`,
    why: plan.ok ? null : plan.error,
  };
}

// Letting a crew member go, as the card offers it.
function dismissText(campaign, rules, member) {
  const plan = dismissPlan(campaign, rules, member.id);
  return {
    key: `let:${member.id}`,
    ok: plan.ok,
    label: 'Let go',
    ask: 'Let go?',
    text: `Let ${member.name} go here, with nothing paid back: a crew of ${campaign.crew.length - 1}. Tap again to let them go.`,
    why: plan.ok ? null : plan.error,
  };
}

// What the foot says while the card is open and nothing has had a tap.
function cardHint(atStation, recruits, members) {
  if (!atStation) return { tone: 'info', text: 'Crew sign on and are let go at stations. Tap Done for the chart.' };
  if (recruits.some((recruit) => recruit.ok)) return { tone: 'good', text: 'Tap Sign on to see what a recruit takes, and again to sign them on.' };
  if (members.some((member) => member.dismiss?.ok)) return { tone: 'info', text: 'Tap Let go to see what it leaves, and again to let them go.' };
  return { tone: 'info', text: 'Tap Done for the chart.' };
}

// "A", "A and B", "A, B and C".
function listed(names) {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function jobName(job, rules) {
  return rules.jobs.get(job)?.name ?? job;
}

// A recruit's background (data/recruits.json, M32b), or null for the start
// crew and one the data no longer has.
function pastOf(member, rules) {
  return rules.recruits.backgrounds.get(member.background) ?? null;
}

// "Steady hands: aim +5", traits joined.
function traitsText(ids, rules) {
  return ids
    .map((id) => {
      const trait = rules.traits.get(id);
      if (!trait) return id;
      const effects = Object.entries(trait.effects).map(([key, n]) => `${STAT_NAMES[key] ?? key} ${n > 0 ? '+' : '−'}${Math.abs(n)}`);
      return `${trait.name}: ${effects.join(', ')}`;
    })
    .join('; ');
}
