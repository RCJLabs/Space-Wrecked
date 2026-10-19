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
// (M33c, companions.js).
// From M41, where death is permanent, act 1's hangar has a recruit too,
// one at a time, while the crew is short of the start's (hangarRecruit): a
// hand from the district in the job the crew is short of, green, signed on
// for nothing and needing no room, the hangar's bunks being the crew's
// until launch. With a fee, a crew down to one and no credits could never
// win the job to pay it. Pure.
import { int, pick, seedFrom, shuffle } from '../core/rng.js';
import { atHangar } from './acts.js';
import { nextCrewId, wholeCrew } from './away.js';
import { maxHp, MAX_CREW } from './campaign.js';
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
  if (!rules.recruits.first.length || !rules.recruits.last.length || !rules.recruits.backgrounds.size) return [];
  // On a voyage (M38d), the crew at home count too (away.js).
  const taken = new Set(wholeCrew(campaign).map((member) => member.name));
  const looks = wholeCrew(campaign).map((member) => member.look);
  const share = priceShare(campaign, rules, sector.nodes[nodeId]);
  // Each slot rolls on its own, so signing one on moves none of the rest.
  return Array.from({ length: rules.balance.recruitOffer ?? 0 }, (_, slot) => rollRecruit(seedFrom(`recruit ${campaign.seed} ${sector.index} ${sector.name} ${nodeId} ${slot}`), slot, taken, looks, rules, share));
}

// The recruit at act 1's hangar where death is permanent (M41), while the
// crew is short of the start's: one, in slot 0, in the first of the
// start's jobs the crew has fewer of than it began with; with no traits,
// no fights and no fee; named and with a look rolled from the campaign's
// seed, the fights it has stood and the crew's number, so signing them on
// brings the next, if any is still to come. Or null.
export function hangarRecruit(campaign, rules) {
  if (campaign.permadeath !== true || campaign.act !== 1 || !atHangar(campaign, rules)) return null;
  const jobs = rules.backgrounds.get(campaign.background)?.start.crew ?? [];
  const { first, last } = rules.recruits;
  if (campaign.crew.length >= jobs.length || !first.length || !last.length) return null;
  const count = (list, job) => list.filter((one) => one === job).length;
  const job = jobs.find((one) => count(campaign.crew.map((member) => member.job), one) < count(jobs, one)) ?? jobs[0];
  const fights = (campaign.flags.fightsWon ?? 0) + (campaign.flags.fightsLost ?? 0);
  const taken = new Set(campaign.crew.map((member) => member.name));
  let rng = seedFrom(`hangar recruit ${campaign.seed} ${fights} ${campaign.crew.length}`);
  let name = '';
  for (let n = 0; n < NAME_TRIES && (!name || taken.has(name)); n++) {
    const a = pick(rng, first);
    const b = pick(a.state, last);
    rng = b.state;
    name = `${a.value} ${b.value}`;
  }
  const look = rollLook(rng, campaign.crew.map((member) => member.look)).value;
  const member = { name, job, traits: [], fights: 0 };
  return { slot: 0, ...member, hp: maxHp(member, rules), look, fee: 0 };
}

// A recruit rolled from rng: a name not in `taken` where NAME_TRIES allow
// (added to it), then their background, its job, traits and fights, and a
// look apart from `looks` (added to them), at full health, with their fee
// at `share` percent.
function rollRecruit(rng, slot, taken, looks, rules, share) {
  const { first, last, backgrounds } = rules.recruits;
  let name = '';
  for (let n = 0; n < NAME_TRIES && (!name || taken.has(name)); n++) {
    const a = pick(rng, first);
    const b = pick(a.state, last);
    rng = b.state;
    name = `${a.value} ${b.value}`;
  }
  taken.add(name);
  const past = pick(rng, [...backgrounds.values()]);
  const job = pick(past.state, past.value.jobs);
  const traits = shuffle(job.state, past.value.traits);
  const fights = int(traits.state, ...past.value.fights);
  const look = rollLook(fights.state, looks).value;
  looks.push(look);
  const member = { name, job: job.value, traits: traits.value.slice(0, past.value.traitCount), fights: fights.value };
  return { slot, ...member, hp: maxHp(member, rules), look, background: past.value.id, fee: feeOf(member, rules, share) };
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
// on yet, the hangar's (hangarRecruit, M41), or [] away from them.
export function recruitOffer(campaign, rules) {
  const hangar = hangarRecruit(campaign, rules);
  if (hangar) return [hangar];
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return [];
  const { at, hired } = campaign.run;
  return recruitsAt(campaign, rules, at).filter((recruit) => !hired.some((h) => h.node === at && h.slot === recruit.slot));
}

// What signing on the recruit in `slot` takes: { ok: true, recruit, fee,
// room, dock (the heat it adds: travel.js tradeHeat) } or { ok: false,
// error }.
export function hirePlan(campaign, rules, slot) {
  const hangar = hangarRecruit(campaign, rules);
  if (hangar) {
    if (hangar.slot !== slot) return { ok: false, error: 'No one is for hire there.' };
    if (campaign.credits < hangar.fee) return { ok: false, error: `Signing on costs ${hangar.fee} credits.` };
    return { ok: true, recruit: hangar, fee: hangar.fee, room: null, dock: 0, hangar: true };
  }
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Recruits sign on at stations.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const recruit = recruitOffer(campaign, rules).find((r) => r.slot === slot);
  if (!recruit) return { ok: false, error: 'No one is for hire there.' };
  const room = crewRoom(campaign.ship, rules);
  if (campaign.crew.length >= room) return { ok: false, error: `No room aboard: the berths and life support carry ${room}.` };
  // Everyone counts, aboard, at home and at the other colonies (M38e).
  if (wholeCrew(campaign).length >= MAX_CREW) return { ok: false, error: `The crew is ${MAX_CREW} strong, at every colony and aboard: as many as it can be.` };
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
  const id = nextCrewId(campaign);
  const member = { id, name: recruit.name, job: recruit.job, hp: recruit.hp, traits: [...recruit.traits], look: { ...recruit.look }, fights: recruit.fights, ...(recruit.background ? { background: recruit.background } : {}) };
  // At the hangar (M41) no ship docks and no station keeps the hire.
  if (plan.hangar) return { ok: true, plan, campaign: { ...campaign, crew: [...campaign.crew, member], credits: campaign.credits - fee, flags: tally(campaign.flags, { recruitsHired: 1 }) } };
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
  // On a voyage the captain may be at home (M38d): someone stays to fly her.
  if (campaign.crew.length === 1) return { ok: false, error: 'Someone has to stay aboard to fly the ship.' };
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

