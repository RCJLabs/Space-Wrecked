// Crew comings and goings on the run (ROADMAP §4.5, M23). Each station
// offers recruitOffer recruits (data/balance.json): each a name from
// data/recruits.json, a job and a trait, at full health. They are rolled
// from the campaign's seed, the sector and the station rather than the
// campaign's RNG, so a station offers the same recruits on every visit and
// no other roll moves; one whose name is already aboard is rolled again.
// Signing one on costs recruitFee credits and needs room aboard (crew.js
// crewRoom), and run.hired keeps who has signed on in this sector (travel.js).
// At a station the crew can also let anyone go but the captain. Pure.
import { pick, seedFrom } from '../core/rng.js';
import { maxHp } from './campaign.js';
import { crewRoom } from './crew.js';
import { tally } from './flags.js';
import { hereOf, holdOf, onTheRun } from './travel.js';

// Tries at a name not aboard before taking one that is.
const NAME_TRIES = 20;

// The recruits station `nodeId` in the ship's sector offers, hired or not:
// [{ slot, name, job, traits, hp }].
export function recruitsAt(campaign, rules, nodeId) {
  const { sector } = campaign.run;
  const { first, last } = rules.recruits;
  const jobs = [...rules.jobs.keys()];
  const traits = [...rules.traits.keys()];
  if (!first.length || !last.length || !jobs.length) return [];
  const taken = new Set(campaign.crew.map((member) => member.name));
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
    const job = pick(rng, jobs);
    const trait = traits.length ? pick(job.state, traits) : { value: null, state: job.state };
    const member = { name, job: job.value, traits: trait.value ? [trait.value] : [] };
    recruits.push({ slot, ...member, hp: maxHp(member, rules) });
  }
  return recruits;
}

// The recruits for hire where the ship is: those of a station's not signed
// on yet, or [] away from one.
export function recruitOffer(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return [];
  const { at, hired } = campaign.run;
  return recruitsAt(campaign, rules, at).filter((recruit) => !hired.some((h) => h.node === at && h.slot === recruit.slot));
}

// What signing on the recruit in `slot` takes: { ok: true, recruit, fee,
// room } or { ok: false, error }.
export function hirePlan(campaign, rules, slot) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Recruits sign on at stations.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const recruit = recruitOffer(campaign, rules).find((r) => r.slot === slot);
  if (!recruit) return { ok: false, error: 'No one is for hire there.' };
  const room = crewRoom(campaign.ship, rules);
  if (campaign.crew.length >= room) return { ok: false, error: `No room aboard: the berths and life support carry ${room}.` };
  const fee = rules.balance.recruitFee;
  if (campaign.credits < fee) return { ok: false, error: `Signing on costs ${fee} credits.` };
  return { ok: true, recruit, fee, room };
}

// Signs the recruit in `slot` on. Returns { ok: true, campaign, plan } or
// { ok: false, error }.
export function hireRecruit(campaign, rules, slot) {
  const plan = hirePlan(campaign, rules, slot);
  if (!plan.ok) return plan;
  const { recruit, fee } = plan;
  const id = Math.max(0, ...campaign.crew.map((member) => member.id)) + 1;
  const member = { id, name: recruit.name, job: recruit.job, hp: recruit.hp, traits: [...recruit.traits] };
  const { run } = campaign;
  return {
    ok: true,
    plan,
    campaign: {
      ...campaign,
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

// Lets crew member `id` go. Returns { ok: true, campaign, plan } or { ok:
// false, error }.
export function dismissCrew(campaign, rules, id) {
  const plan = dismissPlan(campaign, rules, id);
  if (!plan.ok) return plan;
  return {
    ok: true,
    plan,
    campaign: { ...campaign, crew: campaign.crew.filter((member) => member.id !== id), flags: tally(campaign.flags, { crewDismissed: 1 }) },
  };
}

