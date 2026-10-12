// The campaign: the act, what the player owns and who they have aboard, the
// pursuer's heat and the story's flags (ROADMAP §2, §4.4 to §4.8). Plain
// data, saved with the game after every change, so quitting anywhere and
// reopening picks up where the player was. Pure: content comes in as rules
// (data/campaign.json and the rest), and every roll comes from the
// campaign's own RNG state, so reloading never rerolls.
//
// A campaign:
//   seed     the seed it began from
//   rng      its RNG state now (core/rng.js)
//   act      1, 2 or 3; data/campaign.json names each act and its home
//   place    where the player is: 'hub', or 'fight' while a fight is on
//   credits  money, a whole number
//   parts    { [module type]: count }: parts on hand in the hangar, not on
//            the ship. Refitting the ship (construction mode) takes parts
//            from here and puts back what comes off.
//   crew     [{ id, name, job, hp }]: everyone aboard. hp is what they have
//            now: wounds carry from fight to fight, up to the job's hp.
//   heat     the pursuer's meter, 0 to HEAT_MAX (§4.4)
//   flags    { [name]: true, a number or a short text }: what has happened
//   ship     the ship (builder.js)
//   fight    null, or the fight on now: { encounter, seed, crew, battle,
//            log }. crew is who fights, by id, in the battle's order (c1,
//            c2...). battle and log are the fight as it stands (battle.js,
//            fight.js), saved after every order: the start of each of the
//            crew's turns is saved, and so is every order in between.
//
// For now a fight is the crew against a boarding party on their own ship,
// standing in for M14's jobs and M15's raids.
import { int, isState } from '../core/rng.js';
import { battleProblem } from './battleShape.js';
import { createBattle } from './battle.js';
import { buildShip, isShipData } from './builder.js';
import { deploy } from './deploy.js';
import { mapFromShip } from './mapFromShip.js';

export const PLACES = ['hub', 'fight'];
export const ACTS = 3;
export const HEAT_MAX = 100;
export const MAX_CREW = 20;
export const MAX_NAME = 24;
export const MAX_FLAG_TEXT = 64;
// Who boards the ship in a fight (data/encounters.json).
export const FIGHT_ENCOUNTER = 'boarders';
const MAX_SEED = 0xffffffff;
const ID = /^[a-z][a-z0-9-]*$/;
const FLAG = /^[a-zA-Z][a-zA-Z0-9]*$/;

// A new campaign from the start in data/campaign.json: act 1, at home, with
// its ship, crew, credits and parts. seed is a whole number (a uint32).
export function newCampaign(rules, seed) {
  const { start } = rules;
  const { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  return {
    seed,
    rng: seed,
    act: 1,
    place: 'hub',
    credits: start.credits,
    parts: { ...start.parts },
    crew: start.crew.map((job, i) => {
      const { name, hp } = rules.jobs.get(job);
      return { id: i + 1, name, job, hp };
    }),
    heat: 0,
    flags: {},
    ship,
    fight: null,
  };
}

// The act's entry in data/campaign.json: { act, name, hub, home }.
export function actOf(campaign, rules) {
  return rules.acts.get(campaign.act) ?? null;
}

// A crew member's most hit points: their job's.
export function maxHp(member, rules) {
  return rules.jobs.get(member.job)?.hp ?? member.hp;
}

// Every part the campaign has, on the ship or on hand: what construction
// mode can build with (session.js stock).
export function stockOf(campaign) {
  const stock = { ...campaign.parts };
  for (const module of campaign.ship.modules) stock[module.type] = (stock[module.type] ?? 0) + 1;
  return stock;
}

// The ship after a refit in the hangar, and the parts on hand after it: a
// part fitted comes out of the hangar, one taken off goes back. Only at the
// hub, on the same frame, and only with the parts the campaign has;
// otherwise the campaign is left as it was.
export function refitShip(campaign, ship) {
  if (campaign.place !== 'hub' || ship === campaign.ship || !isShipData(ship) || ship.frame !== campaign.ship.frame) return campaign;
  const parts = onHandAfter(campaign.parts, campaign.ship, ship);
  return parts ? { ...campaign, ship, parts } : campaign;
}

// The parts on hand once ship `before` becomes `after`, or null if `after`
// needs parts that aren't there.
export function onHandAfter(parts, before, after) {
  const held = { ...parts };
  for (const module of before.modules) held[module.type] = (held[module.type] ?? 0) + 1;
  for (const module of after.modules) held[module.type] = (held[module.type] ?? 0) - 1;
  for (const [type, count] of Object.entries(held)) {
    if (count < 0) return null;
    if (count === 0) delete held[type];
  }
  return held;
}

// Starts a fight: the whole crew against the boarders, on the ship. Its
// seed is the campaign's next roll. Returns { ok: true, campaign } with the
// fight on, or { ok: false, error } saying why it can't start.
export function beginFight(campaign, rules) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  if (!campaign.crew.length) return { ok: false, error: 'There is no one aboard to fight.' };
  const unknown = campaign.crew.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const map = mapFromShip(campaign.ship, rules);
  if (!map) return { ok: false, error: 'The ship has no parts yet.' };
  const placed = deploy(map, campaign.crew.map((member) => member.job), rules.encounters.get(FIGHT_ENCOUNTER).enemies, rules);
  if (!placed.ok) return placed;
  const { value: seed, state: rng } = int(campaign.rng, 0, MAX_SEED);
  // deploy lists the crew first, in the order given.
  const units = placed.units.map((unit, i) => {
    const member = campaign.crew[i];
    return member ? { ...unit, name: member.name, hp: Math.min(member.hp, maxHp(member, rules)) } : unit;
  });
  const { battle, events } = createBattle({ map, units, seed }, rules);
  const fight = { encounter: FIGHT_ENCOUNTER, seed, crew: campaign.crew.map((member) => member.id), battle, log: events };
  return { ok: true, campaign: { ...campaign, rng, place: 'fight', fight } };
}

// The fight as it stands after an order: the battle and every event so far.
export function saveFight(campaign, battle, log) {
  if (!campaign.fight || (campaign.fight.battle === battle && campaign.fight.log === log)) return campaign;
  return { ...campaign, fight: { ...campaign.fight, battle, log } };
}

// After a fight with a winner, back to the hub with what it left behind:
// - each crew member keeps the hit points they ended with; anyone down,
//   stabilized or bled out comes back with 1, badly hurt;
// - anyone killed (only where death is permanent) leaves the crew;
// - the flags count the fights won and lost.
// A fight still going is left as it is.
export function endFight(campaign) {
  const { fight } = campaign;
  if (!fight?.battle.winner) return campaign;
  const fought = fight.battle.units.filter((unit) => unit.side === 'crew');
  const crew = campaign.crew.flatMap((member) => {
    const unit = fought[fight.crew.indexOf(member.id)];
    if (!unit) return [member];
    if (unit.status === 'dead') return [];
    return [{ ...member, hp: Math.max(1, unit.hp) }];
  });
  const flag = fight.battle.winner === 'crew' ? 'fightsWon' : 'fightsLost';
  const flags = { ...campaign.flags, [flag]: (campaign.flags[flag] ?? 0) + 1 };
  return { ...campaign, place: 'hub', fight: null, crew, flags };
}

// What is wrong with a saved campaign, as sentences for the player; an
// empty list means it is readable. Whether its parts and jobs still exist
// is for the screens to say when content has loaded: a save only has to be
// readable.
export function campaignProblems(value) {
  if (!isRecord(value)) return ['The campaign is unreadable.'];
  const problems = [];
  const wrong = (what) => problems.push(`The campaign's ${what}.`);
  if (!isState(value.seed) || !isState(value.rng)) wrong('seed or RNG state is invalid');
  if (!isInt(value.act, 1, ACTS)) wrong('act is invalid');
  if (!PLACES.includes(value.place)) wrong('place is invalid');
  if (!isInt(value.credits, 0, Number.MAX_SAFE_INTEGER)) wrong('credits are invalid');
  if (!isRecord(value.parts) || !Object.entries(value.parts).every(([type, count]) => ID.test(type) && isInt(count, 1, Number.MAX_SAFE_INTEGER))) {
    wrong('parts are unreadable');
  }
  if (!isCrew(value.crew)) wrong('crew is unreadable');
  if (!isInt(value.heat, 0, HEAT_MAX)) wrong('heat is invalid');
  if (!isRecord(value.flags) || !Object.entries(value.flags).every(([name, flag]) => FLAG.test(name) && name.length <= 32 && isFlag(flag))) {
    wrong('flags are unreadable');
  }
  if (!isShipData(value.ship)) wrong('ship is unreadable');
  if ((value.place === 'fight') !== isRecord(value.fight) || (value.place !== 'fight' && value.fight !== null)) {
    wrong("fight doesn't match where the player is");
  } else if (value.fight !== null) {
    const why = fightProblem(value.fight, Array.isArray(value.crew) ? value.crew : []);
    if (why) wrong(`fight ${why}`);
  }
  return problems;
}

function fightProblem(fight, crew) {
  if (typeof fight.encounter !== 'string' || !ID.test(fight.encounter) || !isState(fight.seed)) return 'is unreadable';
  const ids = new Set(crew.map((member) => member?.id));
  if (!Array.isArray(fight.crew) || new Set(fight.crew).size !== fight.crew.length || !fight.crew.every((id) => ids.has(id))) {
    return "names crew who aren't aboard";
  }
  const battle = battleProblem(fight.battle);
  if (battle) return battle;
  if (fight.battle.units.filter((unit) => unit.side === 'crew').length !== fight.crew.length) return "doesn't match its crew";
  if (!Array.isArray(fight.log) || !fight.log.every((event) => isRecord(event) && typeof event.type === 'string')) return 'has an unreadable log';
  return null;
}

function isCrew(crew) {
  if (!Array.isArray(crew) || crew.length > MAX_CREW) return false;
  const ids = new Set();
  return crew.every((member) => {
    if (!isRecord(member) || !isInt(member.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(member.id)) return false;
    ids.add(member.id);
    return isName(member.name) && typeof member.job === 'string' && ID.test(member.job) && isInt(member.hp, 1, 999);
  });
}

function isFlag(value) {
  return typeof value === 'boolean' || Number.isFinite(value) || (typeof value === 'string' && value.length <= MAX_FLAG_TEXT);
}

function isName(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_NAME;
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
