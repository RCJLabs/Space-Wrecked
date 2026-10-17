// Crew comings and goings on the run (ROADMAP §4.5, M23). Each station
// offers recruitOffer recruits (data/balance.json): each a name from
// data/recruits.json, a background from it (M32b), and from the background
// a job, its count of traits, the fights already stood (ranks.js) and a
// look (looks.js, M23c), at full health. They are rolled from the
// campaign's seed, the sector and the station rather than the campaign's
// RNG, so a station offers the same recruits on every visit and no other
// roll moves; one whose name is already aboard is rolled again, and a look
// too close to one aboard or offered before is rolled again. The look is
// rolled last, so it moves none of the rest.
// Signing one on costs their fee (feeOf: more for each trait and rank, and
// at a station of a side its level's share, M33) and needs room aboard
// (crew.js crewRoom), and run.hired keeps who has signed on in this sector
// (travel.js). They keep their background aboard. Signing one on docks the
// ship at the station (travel.js dockShip).
// At a station the crew can also let anyone go but the captain, which docks
// nothing: no one is paid. A companion let go ends their loyalty quest
// (M33c, companions.js). Pure.
import { int, pick, seedFrom, shuffle } from '../core/rng.js';
import { maxHp } from './campaign.js';
import { companionOf } from './companions.js';
import { crewRoom } from './crew.js';
import { tally } from './flags.js';
import { rollLook } from './looks.js';
import { handedIn } from './loadout.js';
import { endCold } from './quests.js';
import { rankOf } from './ranks.js';
import { costAt, priceShare } from './standing.js';
import { dockShip, hereOf, holdOf, onTheRun, tradeHeat } from './travel.js';

// Tries at a name not aboard before taking one that is.
const NAME_TRIES = 20;

// The recruits station `nodeId` in the ship's sector offers, hired or not:
// [{ slot, name, job, traits, hp, look, fights, background, fee }]:
// fights they have already stood in, and their background's id.
export function recruitsAt(campaign, rules, nodeId) {
  const { sector } = campaign.run;
  const { first, last, backgrounds } = rules.recruits;
  const pasts = [...backgrounds.values()];
  if (!first.length || !last.length || !pasts.length) return [];
  const taken = new Set(campaign.crew.map((member) => member.name));
  const looks = campaign.crew.map((member) => member.look);
  const share = priceShare(campaign, rules, sector.nodes[nodeId]);
  const recruits = [];
  for (let slot = 0; slot < (rules.balance.recruitOffer ?? 0); slot++) {
    // Each slot rolls on its own, so signing one on moves none of the rest.
    let rng = seedFrom(`recruit ${campaign.seed} ${sector.index} ${sector.name} ${nodeId} ${slot}`);
    let name = '';
    for (let n = 0; n < NAME_TRIES && (!name || taken.has(name)); n++) {
      const a = pick(rng, first);
      const b = pick(a.state, last);
      rng = b.state;
      name = `${a.value} ${b.value}`;
    }
    taken.add(name);
    const past = pick(rng, pasts);
    const job = pick(past.state, past.value.jobs);
    const traits = shuffle(job.state, past.value.traits);
    const fights = int(traits.state, ...past.value.fights);
    const look = rollLook(fights.state, looks).value;
    looks.push(look);
    const member = { name, job: job.value, traits: traits.value.slice(0, past.value.traitCount), fights: fights.value };
    recruits.push({ slot, ...member, hp: maxHp(member, rules), look, background: past.value.id, fee: feeOf(member, rules, share) });
  }
  return recruits;
}

// What a recruit asks to sign on (M32b): recruitFee, with recruitTraitFee
// more for each trait and recruitRankFee more for each rank their fights
// have reached (data/balance.json); at a station charging `share` percent
// of the price (M33, standing.js), that share of it, in whole credits.
export function feeOf(recruit, rules, share = 100) {
  const { recruitFee, recruitTraitFee = 0, recruitRankFee = 0 } = rules.balance;
  return costAt(1, recruitFee + recruitTraitFee * recruit.traits.length + recruitRankFee * rankOf(recruit, rules), share);
}

// The recruits for hire where the ship is: those of a station's not signed
// on yet, or [] away from one.
export function recruitOffer(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return [];
  const { at, hired } = campaign.run;
  return recruitsAt(campaign, rules, at).filter((recruit) => !hired.some((h) => h.node === at && h.slot === recruit.slot));
}

// What signing on the recruit in `slot` takes: { ok: true, recruit, fee,
// room, dock (the heat it adds: travel.js tradeHeat) } or { ok: false,
// error }.
export function hirePlan(campaign, rules, slot) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Recruits sign on at stations.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const recruit = recruitOffer(campaign, rules).find((r) => r.slot === slot);
  if (!recruit) return { ok: false, error: 'No one is for hire there.' };
  const room = crewRoom(campaign.ship, rules);
  if (campaign.crew.length >= room) return { ok: false, error: `No room aboard: the berths and life support carry ${room}.` };
  const { fee } = recruit;
  if (campaign.credits < fee) return { ok: false, error: `Signing on costs ${fee} credits.` };
  return { ok: true, recruit, fee, room, dock: tradeHeat(campaign, rules) };
}

// Signs the recruit in `slot` on. Returns { ok: true, campaign, plan } or
// { ok: false, error }.
export function hireRecruit(campaign, rules, slot) {
  const plan = hirePlan(campaign, rules, slot);
  if (!plan.ok) return plan;
  const { recruit, fee } = plan;
  const id = Math.max(0, ...campaign.crew.map((member) => member.id)) + 1;
  const member = { id, name: recruit.name, job: recruit.job, hp: recruit.hp, traits: [...recruit.traits], look: { ...recruit.look }, fights: recruit.fights, background: recruit.background };
  const docked = dockShip(campaign, rules);
  const { run } = docked;
  return {
    ok: true,
    plan,
    campaign: {
      ...docked,
      crew: [...campaign.crew, member],
      credits: campaign.credits - fee,
      flags: tally(campaign.flags, { recruitsHired: 1 }),
      run: { ...run, hired: [...run.hired, { node: run.at, slot: recruit.slot }] },
    },
  };
}

// What letting crew member `id` go takes: { ok: true, member } or { ok:
// false, error }. At a station, anyone but the captain.
export function dismissPlan(campaign, rules, id) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Crew are let go at stations.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const member = campaign.crew.find((m) => m.id === id);
  if (!member) return { ok: false, error: 'No one aboard goes by that.' };
  if (member.id === campaign.captain) return { ok: false, error: 'The captain stays with the ship.' };
  return { ok: true, member };
}

// Lets crew member `id` go: they hand in the weapon they carry (M37,
// loadout.js). Returns { ok: true, campaign, plan } or { ok: false, error }.
export function dismissCrew(campaign, rules, id) {
  const plan = dismissPlan(campaign, rules, id);
  if (!plan.ok) return plan;
  const left = { ...campaign, crew: campaign.crew.filter((member) => member.id !== id), arms: handedIn(campaign, plan.member, rules), flags: tally(campaign.flags, { crewDismissed: 1 }) };
  // A companion let go ends their loyalty quest, if it is open (M33c).
  const loyalty = plan.member.companion ? companionOf(rules, plan.member.companion)?.loyalty : null;
  return { ok: true, plan, campaign: loyalty ? endCold(left, loyalty).campaign : left };
}

