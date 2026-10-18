// Jobs: act 1's work (ROADMAP §2, §4.7), from data/contracts.json, and from
// M38c the stations' on the run (stationJobs.js, whose boards are rolled
// here too). In code a job's template is a contract, since data/jobs.json
// holds the crew's jobs; players only ever read "jobs".
//
// A contract is a mission at one of its sites, for one of its clients,
// against an encounter, for credits and maybe a part from its drop table
// (drops.js); objectives.js has the rules for each:
//   clear     put down everyone who isn't crew
//   grab      grab `crates` of the site's crates
//   hack      work the site's terminal for `turns` turns
//   extract   carry `crates` of them out the way the crew came in (M38)
//   escort    walk the client (a ward, people in data/contracts.json) from
//             the way in to the far gate (the site's exit tiles)
//   defend    hold the way in for `rounds` rounds
//   sabotage  set a charge by `targets` of the site's crates, with
//             balance.spareCharges charges more than that
//   rescue    free `captive` (a ward), held on one of the site's captive
//             tiles, and walk them out the way the crew came in
// A contract with once: true (a story job) never comes back once it is
// done; the campaign keeps its id in spent. Lost, it can come again.
// The job board offers boardSize contracts at a time, each with its client,
// site, twist, pay and seed rolled with the board, so an offer never
// changes once it is made. A job on the board:
//   { contract, client, site, twist, seed, credits, part }
// From M33b a quest's step in act 1 is a contract of the quest's own
// (quest), never on the board's rotation: quests.js questJobs offers it
// above the board while the step is open, with quest set to the quest's
// id, and takeQuestJob takes it. Done, the quest moves on (quests.js
// stepDone); lost, it is offered again.
// twist is null or a twist's id. credits is the pay, the twist's change
// included, and part null or a module type that comes with it. seed makes
// the fight: the site's map, who comes and where everyone starts, and
// every roll after. A twist can bring an enemy more or one fewer, lay a
// hazard on the site, cut the sight range, set a deadline and change the
// pay.
import { int, percent, shuffle } from '../core/rng.js';
import { atHangar } from './acts.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight } from './campaign.js';
import { rollDrop } from './drops.js';
import { PAY_STEP, rollArms, rollStock } from './economy.js';
import { generateSite } from './gen/site.js';
import { huntersFor, jobHeat, raidDue, withHeat } from './heat.js';
import { enemyBonus } from './settings.js';
import { questJobs, stepDone } from './quests.js';
import { jobMoves, jobPay, moveStanding } from './standing.js';

// The missions the rules know. A new one means new rules (objectives.js),
// so it is added here on purpose.
export const MISSIONS = ['clear', 'grab', 'hack', 'extract', 'escort', 'defend', 'sabotage', 'rescue'];
const MAX_SEED = 0xffffffff;

// The contracts the board can offer in a district: those at its sites,
// but a quest's own (M33b).
export function contractsIn(rules, district) {
  const sites = new Set((rules.districts.get(district)?.sites ?? []).map((site) => site.id));
  return [...rules.contracts.jobs.values()].filter((contract) => !contract.quest && contract.sites.every((site) => sites.has(site)));
}

// The twists a contract can come with: those for any mission, and those
// for its own.
export function twistsFor(contract, rules) {
  return [...rules.contracts.twists.values()].filter((twist) => !twist.missions || twist.missions.includes(contract.mission));
}

// A new board for a district: up to boardSize different contracts, none
// of them in `skip` (the ids of the jobs on the board before, so each board
// offers new work and no job comes twice in a row). rng is an RNG state.
// Returns { board, rng }.
export function rollBoard(rules, rng, district, skip = []) {
  return rollOffers(rules, rng, contractsIn(rules, district).filter((contract) => !skip.includes(contract.id)), rules.contracts.boardSize);
}

// Up to `size` of `contracts` as offers, in an order shuffled from rng,
// each with its client (one of clientsOf(contract)), site, twist, pay, part
// and seed rolled after it: a district's board, or since M38c a station's
// (stationJobs.js). Returns { board, rng }.
export function rollOffers(rules, rng, contracts, size, clientsOf = (contract) => contract.clients) {
  const { twistChance } = rules.contracts;
  const order = shuffle(rng, contracts);
  let state = order.state;
  const roll = (min, max) => {
    const r = int(state, min, max);
    state = r.state;
    return r.value;
  };
  const chance = (pct) => {
    const r = percent(state, pct);
    state = r.state;
    return r.value;
  };
  const pick = (list) => list[roll(0, list.length - 1)];
  const board = order.value.slice(0, size).map((contract) => {
    const client = pick(clientsOf(contract));
    const site = pick(contract.sites);
    const twists = twistsFor(contract, rules);
    const twist = twists.length && chance(twistChance) ? pick(twists) : null;
    const base = PAY_STEP * roll(contract.credits[0] / PAY_STEP, contract.credits[1] / PAY_STEP);
    const credits = PAY_STEP * Math.round((base * (100 + (twist?.pay ?? 0))) / 100 / PAY_STEP);
    const drop = rollDrop(state, contract.drops);
    state = drop.state;
    return { contract: contract.id, client, site, twist: twist?.id ?? null, seed: roll(0, MAX_SEED), credits, part: drop.value };
  });
  return { board, rng: state };
}

// The campaign with a board and the shop's stock (economy.js), each rolled
// from its RNG if it has none yet (a new campaign, or one saved before
// there were jobs or a shop). Only at the hangar: not during a fight, nor
// once the ship has launched.
export function withBoard(campaign, rules) {
  const district = rules.backgrounds.get(campaign.background)?.district;
  if (!atHangar(campaign, rules) || !district) return campaign;
  let next = campaign;
  if (!next.board.length) {
    const { board, rng } = rollBoard(rules, next.rng, district, next.spent);
    if (board.length) next = { ...next, board, rng };
  }
  if (next.shop === null) {
    const { stock, rng } = rollStock(rules, next.rng, district);
    next = { ...next, shop: [...stock, ...rollArms(rules, next, district)], rng };
  }
  return next;
}

// The battle a job makes, for createBattle: the site's map from its
// template and the job's seed (gen/site.js), with the twist's hazard; the
// crew (campaign crew members, in order) at the ways in and the enemies at
// the spawn tiles, both shuffled by the seed; the encounter's enemies with
// one more or fewer as the twist says, picked by the seed, and any hunters
// the pursuer sends along (heat.js huntersFor); the mission's objective,
// with its ward (M38): an escort's client at the next way in, named for
// the job's client, or a rescue's captive held on a captive tile picked by
// the seed; and the twist's sight range and deadline. The crew fight with what their
// traits add, and every enemy with what the difficulty adds (settings.js);
// forgiving odds are on or off as given. The battle's own seed is where
// the site's rolls left off. Throws if the site has too few places for
// everyone (validate-data.js checks the content).
export function jobSetup(job, rules, crew, { hunters = [], forgiving = false, difficulty = 'normal' } = {}) {
  const contract = rules.contracts.jobs.get(job.contract);
  const twist = job.twist ? rules.contracts.twists.get(job.twist) : null;
  const template = rules.siteMaps.get(rules.sites.get(job.site).map);
  const site = generateSite(template, job.seed, { hazard: twist?.hazard ?? null, patches: twist?.patches ?? 0 });
  let state = site.rng;
  const roll = (min, max) => {
    const r = int(state, min, max);
    state = r.state;
    return r.value;
  };
  const shuffled = (list) => {
    const r = shuffle(state, list);
    state = r.state;
    return r.value;
  };
  const enemies = [...rules.encounters.get(contract.encounter).enemies];
  for (let n = twist?.enemies ?? 0; n > 0; n--) enemies.push(enemies[roll(0, enemies.length - 1)]);
  for (let n = twist?.enemies ?? 0; n < 0 && enemies.length > 1; n++) enemies.splice(roll(0, enemies.length - 1), 1);
  enemies.push(...hunters);
  const entries = shuffled(site.zones.entry);
  const spawns = shuffled(site.zones.spawn);
  const comers = crew.length + (contract.mission === 'escort' ? 1 : 0);
  if (entries.length < comers || spawns.length < enemies.length) {
    throw new Error(`${template.id} has room for ${entries.length} crew and ${spawns.length} enemies, not ${comers} and ${enemies.length}`);
  }
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = [
    ...crew.map((member, i) => ({ ...crewUnit(member, rules), x: entries[i][0], y: entries[i][1] })),
    ...enemies.map((kind, i) => ({ kind, x: spawns[i][0], y: spawns[i][1], bonus })),
  ];
  const tagged = (n) => shuffled(site.zones.loot).slice(0, n).sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  let objective = null;
  switch (contract.mission) {
    case 'grab':
      objective = { type: 'grab', crates: tagged(contract.crates) };
      break;
    case 'hack':
      objective = { type: 'hack', at: site.zones.terminal[roll(0, site.zones.terminal.length - 1)], turns: contract.turns };
      break;
    case 'extract':
      objective = { type: 'extract', crates: tagged(contract.crates), exits: site.zones.entry };
      break;
    case 'sabotage':
      objective = { type: 'sabotage', targets: tagged(contract.targets), left: contract.targets + rules.balance.spareCharges };
      break;
    case 'defend':
      objective = { type: 'defend', rounds: contract.rounds, line: site.zones.entry };
      break;
    case 'escort': {
      const [x, y] = entries[crew.length];
      units.push({ kind: 'client', x, y, name: rules.clients.get(job.client)?.name ?? rules.people.get('client').name });
      objective = { type: 'escort', ward: 'w1', exits: site.zones.exit };
      break;
    }
    case 'rescue': {
      const [x, y] = site.zones.captive[roll(0, site.zones.captive.length - 1)];
      units.push({ kind: 'captive', x, y, name: contract.captive, held: true });
      objective = { type: 'rescue', ward: 'w1', exits: site.zones.entry };
      break;
    }
    default:
      break;
  }
  const options = { forgiving };
  if (twist?.sight) options.sight = twist.sight;
  if (twist?.deadline) options.deadline = twist.deadline;
  return { map: site.map, units, seed: state, options, objective };
}

// Takes the job at that place on the board: its fight begins, with the
// whole crew, and the pursuer's hunters if heat has brought them. Not
// while a raid is due. setup is what the settings make of the fight
// (settings.js fightSettings): { forgiving, difficulty }. Returns
// { ok: true, campaign } with the fight on, or { ok: false, error } saying
// why it can't.
export function takeJob(campaign, rules, index, setup = {}) {
  return startJob(campaign, rules, campaign.board[index], setup);
}

// Takes the job a quest's open step offers (quests.js questJobs, M33b): its
// fight begins, as takeJob's.
export function takeQuestJob(campaign, rules, quest, setup = {}) {
  return startJob(campaign, rules, questJobs(campaign, rules).find((offer) => offer.quest === quest), setup);
}

function startJob(campaign, rules, job, setup) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  if (!atHangar(campaign, rules)) return { ok: false, error: 'Jobs are taken from the hangar.' };
  if (raidDue(campaign, rules)) return { ok: false, error: 'Not with a raid at the door.' };
  return beginJob(campaign, rules, job, campaign.crew, { ...setup, hunters: huntersFor(campaign, rules) });
}

// The job's fight begun, with `crew` (campaign crew members, in order)
// going: the whole crew at the hangar, a squad at a station (M38c,
// stationJobs.js). setup is jobSetup's: the hunters along, and what the
// settings make of the fight. Returns { ok: true, campaign } with the fight
// on, or { ok: false, error }.
export function beginJob(campaign, rules, job, crew, setup) {
  if (!job || !rules.contracts.jobs.has(job.contract) || !rules.sites.has(job.site)) return { ok: false, error: 'That job is gone.' };
  if (!crew.length) return { ok: false, error: 'There is no one to send.' };
  const unknown = crew.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  let started;
  try {
    started = createBattle(jobSetup(job, rules, crew, setup), rules);
  } catch (err) {
    return { ok: false, error: `That job can't start: ${err.message}.` };
  }
  const { encounter } = rules.contracts.jobs.get(job.contract);
  const fight = { encounter, seed: job.seed, crew: crew.map((member) => member.id), battle: started.battle, log: started.events, job, raid: false, boarding: null };
  return { ok: true, campaign: { ...campaign, place: 'fight', fight } };
}

// After a fight with a winner, home again (campaign.js endFight: wounds,
// the dead, healing where the act heals, the fights counted). After a job,
// also its pay if it was done (with what its client's side adds,
// standing.js jobPay), its heat, done or lost (heat.js jobHeat), the
// standing it moves with the sides it was for and against (standing.js
// jobMoves, M33), and the job counted in the flags (jobsDone or
// jobsFailed). After one of act 1's, a new board with none of the old
// one's jobs and a new stock at the shop, and a quest's job done moves its
// quest on (quests.js stepDone, M33b). A station's job (M38c, with its
// station's name) is counted apart (stationJobsDone or stationJobsFailed),
// and leaves act 1's board and shop alone. A fight still going is left as
// it is.
export function endJob(campaign, rules) {
  const { fight } = campaign;
  const after = endFight(campaign, rules);
  if (after === campaign || !fight.job) return after;
  const { job } = fight;
  const won = fight.battle.winner === 'crew';
  const station = job.station !== undefined;
  const flag = `${station ? 'stationJobs' : 'jobs'}${won ? 'Done' : 'Failed'}`;
  const parts = won && job.part ? { ...after.parts, [job.part]: (after.parts[job.part] ?? 0) + 1 } : after.parts;
  const { campaign: moved } = moveStanding(after, rules, jobMoves(job, rules, won));
  const flags = { ...after.flags, [flag]: (after.flags[flag] ?? 0) + 1 };
  const paid = { ...moved, credits: after.credits + (won ? jobPay(campaign, rules, job) : 0), heat: withHeat(after.heat, jobHeat(job, rules).heat), parts, flags };
  if (station) return paid;
  const spent = won && rules.contracts.jobs.get(job.contract)?.once === true && !after.spent.includes(job.contract) ? [...after.spent, job.contract] : after.spent;
  const district = rules.backgrounds.get(after.background)?.district;
  const skip = [job.contract, ...campaign.board.map((offer) => offer.contract), ...spent];
  const rolled = district ? rollBoard(rules, after.rng, district, skip) : { board: [], rng: after.rng };
  const restocked = district ? rollStock(rules, rolled.rng, district) : { stock: after.shop, rng: rolled.rng };
  const ended = {
    ...paid,
    board: rolled.board,
    shop: district ? [...restocked.stock, ...rollArms(rules, { ...after, flags }, district)] : restocked.stock,
    spent,
    rng: restocked.rng,
  };
  return won && job.quest ? stepDone(ended, rules, job.quest).campaign : ended;
}
