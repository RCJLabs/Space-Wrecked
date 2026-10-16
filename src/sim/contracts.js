// Jobs: act 1's work (ROADMAP §2, §4.7), from data/contracts.json. In code
// a job's template is a contract, since data/jobs.json holds the crew's
// jobs; players only ever read "jobs".
//
// A contract is a mission at one of its sites, for one of its clients,
// against an encounter, for credits and maybe a part from its drop table
// (drops.js):
//   clear  put down everyone who isn't crew
//   grab   grab `crates` of the site's crates (battle.js objectives)
//   hack   work the site's terminal for `turns` turns
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
import { PAY_STEP, rollStock } from './economy.js';
import { generateSite } from './gen/site.js';
import { huntersFor, jobHeat, raidDue, withHeat } from './heat.js';
import { enemyBonus } from './settings.js';
import { questJobs, stepDone } from './quests.js';
import { jobMoves, jobPay, moveStanding } from './standing.js';

// The missions the rules know. A new one means new rules (battle.js), so
// it is added here on purpose.
export const MISSIONS = ['clear', 'grab', 'hack'];
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
  const { boardSize, twistChance } = rules.contracts;
  const order = shuffle(rng, contractsIn(rules, district).filter((contract) => !skip.includes(contract.id)));
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
  const board = order.value.slice(0, boardSize).map((contract) => {
    const client = pick(contract.clients);
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
    next = { ...next, shop: stock, rng };
  }
  return next;
}

// The battle a job makes, for createBattle: the site's map from its
// template and the job's seed (gen/site.js), with the twist's hazard; the
// crew (campaign crew members, in order) at the ways in and the enemies at
// the spawn tiles, both shuffled by the seed; the encounter's enemies with
// one more or fewer as the twist says, picked by the seed, and any hunters
// the pursuer sends along (heat.js huntersFor); the mission's objective;
// and the twist's sight range and deadline. The crew fight with what their
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
  if (entries.length < crew.length || spawns.length < enemies.length) {
    throw new Error(`${template.id} has room for ${entries.length} crew and ${spawns.length} enemies, not ${crew.length} and ${enemies.length}`);
  }
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = [
    ...crew.map((member, i) => ({ ...crewUnit(member, rules), x: entries[i][0], y: entries[i][1] })),
    ...enemies.map((kind, i) => ({ kind, x: spawns[i][0], y: spawns[i][1], bonus })),
  ];
  let objective = null;
  if (contract.mission === 'grab') {
    const crates = shuffled(site.zones.loot).slice(0, contract.crates).sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
    objective = { type: 'grab', crates };
  } else if (contract.mission === 'hack') {
    objective = { type: 'hack', at: site.zones.terminal[roll(0, site.zones.terminal.length - 1)], turns: contract.turns };
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
  if (!job || !rules.contracts.jobs.has(job.contract) || !rules.sites.has(job.site)) return { ok: false, error: 'That job is gone.' };
  if (!campaign.crew.length) return { ok: false, error: 'There is no one to send.' };
  const unknown = campaign.crew.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  let started;
  try {
    started = createBattle(jobSetup(job, rules, campaign.crew, { ...setup, hunters: huntersFor(campaign, rules) }), rules);
  } catch (err) {
    return { ok: false, error: `That job can't start: ${err.message}.` };
  }
  const { encounter } = rules.contracts.jobs.get(job.contract);
  const fight = { encounter, seed: job.seed, crew: campaign.crew.map((member) => member.id), battle: started.battle, log: started.events, job, raid: false, boarding: null };
  return { ok: true, campaign: { ...campaign, place: 'fight', fight } };
}

// After a fight with a winner, home again (campaign.js endFight: wounds,
// the dead, healing where the act heals, the fights counted). After a job,
// also its pay if it was done (with what its client's side adds,
// standing.js jobPay), its heat, done or lost (heat.js jobHeat), the
// standing it moves with the sides it was for and against (standing.js
// jobMoves, M33), the job counted in the flags (jobsDone or jobsFailed), a
// new board with none of the old one's jobs, and a new stock at the shop.
// A quest's job done moves its quest on (quests.js stepDone, M33b). A
// fight still going is left as it is.
export function endJob(campaign, rules) {
  const { fight } = campaign;
  const after = endFight(campaign, rules);
  if (after === campaign || !fight.job) return after;
  const { job } = fight;
  const won = fight.battle.winner === 'crew';
  const flag = won ? 'jobsDone' : 'jobsFailed';
  const parts = won && job.part ? { ...after.parts, [job.part]: (after.parts[job.part] ?? 0) + 1 } : after.parts;
  const spent = won && rules.contracts.jobs.get(job.contract)?.once === true && !after.spent.includes(job.contract) ? [...after.spent, job.contract] : after.spent;
  const district = rules.backgrounds.get(after.background)?.district;
  const skip = [job.contract, ...campaign.board.map((offer) => offer.contract), ...spent];
  const rolled = district ? rollBoard(rules, after.rng, district, skip) : { board: [], rng: after.rng };
  const restocked = district ? rollStock(rules, rolled.rng, district) : { stock: after.shop, rng: rolled.rng };
  const { campaign: moved } = moveStanding(after, rules, jobMoves(job, rules, won));
  const ended = {
    ...moved,
    credits: after.credits + (won ? jobPay(campaign, rules, job) : 0),
    heat: withHeat(after.heat, jobHeat(job, rules).heat),
    parts,
    flags: { ...after.flags, [flag]: (after.flags[flag] ?? 0) + 1 },
    board: rolled.board,
    shop: restocked.stock,
    spent,
    rng: restocked.rng,
  };
  return won && job.quest ? stepDone(ended, rules, job.quest).campaign : ended;
}
