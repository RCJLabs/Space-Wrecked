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
//   background  who the player was before (data/backgrounds.json): where
//            act 1 starts and its district
//   act      1, 2 or 3; data/campaign.json names each act and its home.
//            Launching (launch.js) moves it on from act 1.
//   place    where the player is: 'hub', or 'fight' while a fight is on
//   credits  money, a whole number
//   parts    { [module type]: count }: parts on hand, not fitted: in the
//            hangar in act 1, in the holds on the run. Refitting the ship
//            (construction mode, at the hangar or a station) takes parts
//            from here and puts back what comes off.
//   crew     [{ id, name, job, hp, traits, look }]: everyone aboard. hp is
//            what they have now: wounds carry from fight to fight, up to
//            the most they can have (maxHp). traits are ids in
//            data/traits.json (traits.js). look is what their portrait is
//            drawn from (looks.js).
//   captain  the id of the crew member who is the player's captain: named,
//            with a job and CAPTAIN_TRAITS traits, when the campaign
//            starts
//   heat     the pursuer's meter, 0 to HEAT_MAX (§4.4)
//   flags    { [name]: true, a number or a short text }: what has happened
//   ship     the ship (builder.js)
//   wrecks   { [uid]: 'fire' | 'vacuum' | 'rubble' }: the ship's modules
//            wrecked in approaches (encounter.js), until a station repairs
//            them (repair.js)
//   board    the jobs on offer at the hangar (contracts.js): [] until one
//            is rolled, and from launch on
//   shop     the shop's stock (economy.js): [{ part, price }], null until
//            one is rolled, and [] from launch on
//   spent    the ids of jobs done that are only done once (contracts.js)
//   supplies what the ship carries for the run (travel.js): 0 until the
//            run begins, when the holds are filled
//   run      null until the run (act 2) begins at its first visit home,
//            then the sector the ship is in, where on its map, and the
//            sectors behind it (travel.js, runShape.js)
//   fight    null, or the fight on now: { encounter, seed, crew, battle,
//            log, job, raid, boarding }. crew is who fights, by id, in the
//            battle's order (c1, c2...). battle and log are the fight as it
//            stands (battle.js, fight.js), saved after every order: the
//            start of each of the crew's turns is saved, and so is every
//            order in between. job is the job it is, off the board
//            (contracts.js), or null. raid is true for the pursuer's raid
//            on the hangar (raid.js). boarding is a boarding fight's, from
//            an approach (encounter.js), or null. None of them is a fight at
//            home against boarders (beginFight), which no screen starts any
//            more.
import { int, isState, pick, seedFrom } from '../core/rng.js';
import { actOf, atColony, atHangar, atStation } from './acts.js';
import { battleProblem } from './battleShape.js';
import { createBattle } from './battle.js';
import { buildShip, isShipData } from './builder.js';
import { flightChecklist, partLines } from './constraints.js';
import { deploy } from './deploy.js';
import { crewLook, isLook } from './looks.js';
import { MAX_STOCK } from './economy.js';
import { mapFromShip, WRECKS } from './mapFromShip.js';
import { isWorld, runProblem } from './runShape.js';
import { enemyBonus } from './settings.js';
import { traitBonus } from './traits.js';

export { actOf } from './acts.js';

export const PLACES = ['hub', 'fight'];
export const ACTS = 3;
// The act of the colony, whose world the run settles (M25).
export const COLONY_ACT = 3;
export const HEAT_MAX = 100;
export const MAX_CREW = 20;
export const MAX_NAME = 24;
// The captain's traits, chosen when a campaign starts.
export const CAPTAIN_TRAITS = 2;
// More traits than anyone has: a guard on what a save can hold.
const MAX_TRAITS = 4;
export const MAX_FLAG_TEXT = 64;
// More supplies than any ship holds: a guard on what a save can hold.
const MAX_SUPPLIES = 9999;
// More jobs than any board offers: a guard on what a save can hold.
export const MAX_BOARD = 12;
// More one-off jobs than act 1 has: the same kind of guard.
export const MAX_SPENT = 100;
// More parts than any ship could need at once (partsNeeded).
const MAX_NEEDED = 40;
// More parts than a boarding crew strips off a ship: a guard on what a save
// can hold.
const MAX_SALVAGE = 20;
// More buildings than the biggest colony grid has cells (40 x 30,
// tools/validate-colony.js): a guard on what a save can hold.
const MAX_BUILDINGS = 1200;
// More days and materials than a colony will count (M27): the same kind of
// guard.
const MAX_DAYS = 99999;
const MAX_MATERIALS = 9999;
// Who boards the ship in a fight (data/encounters.json).
export const FIGHT_ENCOUNTER = 'boarders';
const MAX_SEED = 0xffffffff;
const ID = /^[a-z][a-z0-9-]*$/;
const FLAG = /^[a-zA-Z][a-zA-Z0-9]*$/;

// A new campaign from a background's start (data/backgrounds.json; the
// first one unless named): act 1, at home, with its ship, crew, credits and
// parts. seed is a whole number (a uint32). captain is { name, job, traits,
// look? } (captainProblem says what it takes): the crew member with that
// job becomes the captain, named, with those traits and that look. Without
// one, the first crew member is captain, with no traits. The rest of the
// crew are named from data/recruits.json, and everyone without a look gets
// one, all from the seed (startCrew).
export function newCampaign(rules, seed, { background = firstBackground(rules), captain = null } = {}) {
  const { start } = rules.backgrounds.get(background);
  const { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  const why = captain && captainProblem(captain, rules, background);
  if (why) throw new RangeError(`newCampaign: ${why}`);
  const at = captain ? start.crew.indexOf(captain.job) : 0;
  const crew = startCrew(rules, seed, start.crew, at, captain);
  return {
    seed,
    rng: seed,
    background,
    act: 1,
    place: 'hub',
    credits: start.credits,
    parts: { ...start.parts },
    crew,
    captain: crew[at].id,
    heat: 0,
    flags: {},
    ship,
    wrecks: {},
    board: [],
    shop: null,
    spent: [],
    supplies: 0,
    run: null,
    // The colony (act 3): the world settled at the end of the run (M25,
    // settle.js), and the buildings on it (M26, colony.js).
    colony: null,
    fight: null,
  };
}

// The start crew, ids 1 up in the background's order of jobs. The one at
// `at` is the captain: named, with their traits and look, when given. The
// rest are named from data/recruits.json (their jobs' names if it has
// none), a name each, none the captain's. Looks come from the seed and each
// id (looks.js crewLook), the captain's first, each LOOKS_APART layers from
// those before it. Nothing here moves the campaign's RNG.
function startCrew(rules, seed, jobs, at, captain) {
  const names = new Set(captain ? [captain.name.trim()] : []);
  const captainLook = captain?.look ?? crewLook(seed, at + 1);
  const looks = [captainLook];
  return jobs.map((job, i) => {
    const id = i + 1;
    const isCaptain = i === at;
    const name = isCaptain && captain ? captain.name.trim() : startName(rules, seed, id, job, names);
    const member = { name, job, traits: isCaptain && captain ? [...captain.traits] : [] };
    let look = captainLook;
    if (!isCaptain) {
      look = crewLook(seed, id, looks);
      looks.push(look);
    }
    return { id, ...member, hp: maxHp(member, rules), look };
  });
}

// A start crew member's name from data/recruits.json, rolled from the
// seed and their id, its first name none in `taken` has when 20 rolls can
// find one: the lists that show first names only tell them apart.
function startName(rules, seed, id, job, taken) {
  const { first = [], last = [] } = rules.recruits ?? {};
  if (!first.length || !last.length) return rules.jobs.get(job).name;
  const firsts = new Set([...taken].map((name) => name.split(' ')[0]));
  let rng = seedFrom(`crew ${seed} ${id}`);
  let name = '';
  for (let tries = 0; tries < 20 && (!name || firsts.has(name.split(' ')[0])); tries++) {
    const a = pick(rng, first);
    const b = pick(a.state, last);
    rng = b.state;
    name = `${a.value} ${b.value}`;
  }
  taken.add(name);
  return name;
}

// The background a campaign starts from when none is chosen: v0.1 has one.
export function firstBackground(rules) {
  return rules.backgrounds.keys().next().value;
}

// Why a captain can't lead a campaign from the background, or null. A
// captain is { name, job, traits, look? }: a name of 1 to MAX_NAME letters
// once trimmed, one of the start's crew jobs, CAPTAIN_TRAITS different
// traits that exist, and a look (looks.js) if one is given.
export function captainProblem(captain, rules, background = firstBackground(rules)) {
  const name = typeof captain?.name === 'string' ? captain.name.trim() : '';
  if (!name) return 'Give your captain a name.';
  if (name.length > MAX_NAME) return `A name fits ${MAX_NAME} letters.`;
  if (!rules.backgrounds.get(background)?.start.crew.includes(captain.job)) return 'Pick a job for your captain.';
  const { traits } = captain;
  if (!Array.isArray(traits) || traits.length !== CAPTAIN_TRAITS || new Set(traits).size !== traits.length) return `Pick ${CAPTAIN_TRAITS} traits.`;
  const unknown = traits.find((id) => !rules.traits?.has(id));
  if (unknown) return `There is no trait "${unknown}".`;
  if (captain.look !== undefined && !isLook(captain.look)) return 'Pick a look for your captain.';
  return null;
}

// The ship's flight checklist (constraints.js) as the campaign asks it:
// for the crew aboard, and in an act on a planet, with what lifting off
// takes. Act 1's goal is every line passing.
export function shipChecklist(campaign, rules) {
  return flightChecklist(campaign.ship, rules, crewAboard(campaign), { liftOff: actOf(campaign, rules)?.liftOff ?? null });
}

// How many fly with the ship, for its flight checks: the whole crew, until
// a world is settled. From then on the crew lives at the colony (M26), and
// nobody is aboard until M28's expeditions.
export function crewAboard(campaign) {
  return campaign.colony ? 0 : campaign.crew.length;
}

// The parts the ship still needs for the checklist, by type: { [type]:
// count }. Each failing part line (power, thrust, berths, life support,
// the parts every ship has) asks for its part, and that part is added
// until none asks, as each brings stats of its own (an engine its mass).
// Where parts go doesn't change those lines, so they are added nowhere.
export function partsNeeded(campaign, rules) {
  const options = { liftOff: actOf(campaign, rules)?.liftOff ?? null };
  const needed = {};
  let ship = campaign.ship;
  for (let n = 0; n < MAX_NEEDED; n++) {
    const line = partLines(ship, rules, crewAboard(campaign), options).find((l) => l.ok === false && l.add);
    if (!line) break;
    needed[line.add] = (needed[line.add] ?? 0) + 1;
    ship = { ...ship, modules: [...ship.modules, { uid: -1 - n, type: line.add, x: 0, y: 0, rot: 0 }] };
  }
  return needed;
}

// A crew member's most hit points: their job's, and what their traits add.
export function maxHp(member, rules) {
  const job = rules.jobs.get(member.job);
  return job ? Math.max(1, job.hp + traitBonus(member.traits, rules).hp) : member.hp;
}

// A crew member as a battle unit starts (battle.js createBattle), less
// where they stand: their job, name, hit points now and what their traits
// add.
export function crewUnit(member, rules) {
  return { kind: member.job, name: member.name, hp: Math.min(member.hp, maxHp(member, rules)), bonus: traitBonus(member.traits, rules) };
}

// Every part the campaign has, on the ship or on hand: what construction
// mode can build with (session.js stock).
export function stockOf(campaign) {
  const stock = { ...campaign.parts };
  for (const module of campaign.ship.modules) stock[module.type] = (stock[module.type] ?? 0) + 1;
  return stock;
}

// The ship after a refit, and the parts on hand after it: a part fitted
// comes out of the parts on hand, one taken off goes back. Only at the
// hangar (act 1), at a station on the run (act 2) or at the colony (act 3,
// M27), on the same frame, and only with the parts the campaign has. A wrecked part stays aboard, as
// the same part, until a station repairs it (repair.js): it can move, and
// its damage moves with it, but it can't come off. A refit is free.
// Otherwise the campaign is left as it was.
export function refitShip(campaign, ship, rules) {
  if (!canRefit(campaign, rules) || ship === campaign.ship || !isShipData(ship) || ship.frame !== campaign.ship.frame) return campaign;
  if (!keepsWrecks(campaign, ship)) return campaign;
  const parts = onHandAfter(campaign.parts, campaign.ship, ship);
  return parts ? { ...campaign, ship, parts } : campaign;
}

// True where the ship can be refitted: at the hangar, at a station, or at
// the colony, where it has landed (M27).
export function canRefit(campaign, rules) {
  return Boolean(rules) && (atHangar(campaign, rules) || atStation(campaign, rules) || atColony(campaign, rules));
}

// The uids of the ship's wrecked parts: those a refit can't take off.
export function wreckedUids(campaign) {
  const uids = new Set(campaign.ship.modules.map((module) => module.uid));
  return Object.keys(campaign.wrecks ?? {}).map(Number).filter((uid) => uids.has(uid));
}

// True when every wrecked part is still on `ship`, as the part it was.
function keepsWrecks(campaign, ship) {
  return wreckedUids(campaign).every((uid) => {
    const before = campaign.ship.modules.find((module) => module.uid === uid);
    return ship.modules.some((module) => module.uid === uid && module.type === before.type);
  });
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
// seed is the campaign's next roll. setup is what the settings make of it
// (settings.js fightSettings): forgiving odds, and the difficulty. Returns
// { ok: true, campaign } with the fight on, or { ok: false, error } saying
// why it can't start.
export function beginFight(campaign, rules, { forgiving = false, difficulty = 'normal' } = {}) {
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
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = placed.units.map((unit, i) => {
    const member = campaign.crew[i];
    return member ? { ...unit, ...crewUnit(member, rules) } : { ...unit, bonus };
  });
  const { battle, events } = createBattle({ map, units, seed, options: { forgiving } }, rules);
  const fight = { encounter: FIGHT_ENCOUNTER, seed, crew: campaign.crew.map((member) => member.id), battle, log: events, job: null, raid: false, boarding: null };
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
// - in an act whose home heals (act 1's hangar), everyone heals fully;
// - anyone killed (only where death is permanent) leaves the crew;
// - the flags count the fights won and lost.
// A fight still going is left as it is. A job's pay is contracts.js's.
export function endFight(campaign, rules) {
  const { fight } = campaign;
  if (!fight?.battle.winner) return campaign;
  const heals = actOf(campaign, rules)?.heals === true;
  const fought = fight.battle.units.filter((unit) => unit.side === 'crew');
  const crew = campaign.crew.flatMap((member) => {
    const unit = fought[fight.crew.indexOf(member.id)];
    if (unit?.status === 'dead') return [];
    if (heals) return [{ ...member, hp: maxHp(member, rules) }];
    if (!unit) return [member];
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
  if (!isId(value.background)) wrong('background is invalid');
  if (!isInt(value.act, 1, ACTS)) wrong('act is invalid');
  if (!PLACES.includes(value.place)) wrong('place is invalid');
  if (!isInt(value.credits, 0, Number.MAX_SAFE_INTEGER)) wrong('credits are invalid');
  if (!isRecord(value.parts) || !Object.entries(value.parts).every(([type, count]) => ID.test(type) && isInt(count, 1, Number.MAX_SAFE_INTEGER))) {
    wrong('parts are unreadable');
  }
  if (!isCrew(value.crew)) wrong('crew is unreadable');
  else if (!value.crew.some((member) => member.id === value.captain)) wrong("captain isn't aboard");
  if (!isInt(value.heat, 0, HEAT_MAX)) wrong('heat is invalid');
  if (!isRecord(value.flags) || !Object.entries(value.flags).every(([name, flag]) => FLAG.test(name) && name.length <= 32 && isFlag(flag))) {
    wrong('flags are unreadable');
  }
  if (!isShipData(value.ship)) wrong('ship is unreadable');
  else if (!isWrecks(value.wrecks, value.ship)) wrong('wrecks are unreadable');
  if (!Array.isArray(value.board) || value.board.length > MAX_BOARD || !value.board.every(isJob)) wrong('job board is unreadable');
  if (value.shop !== null && !(Array.isArray(value.shop) && value.shop.length <= MAX_STOCK && value.shop.every(isStockItem))) wrong("shop's stock is unreadable");
  if (!Array.isArray(value.spent) || value.spent.length > MAX_SPENT || !value.spent.every(isId) || new Set(value.spent).size !== value.spent.length) wrong('jobs done once are unreadable');
  if (!isInt(value.supplies, 0, MAX_SUPPLIES)) wrong('supplies are invalid');
  const runWhy = value.run === null ? null : runProblem(value.run);
  if (runWhy) wrong(`run ${runWhy}`);
  else if (value.run !== null && value.act === 1) wrong('run has begun before launch');
  // The colony is the act after the run's: it has its world from settling.
  if (value.colony !== null && !isColony(value.colony)) wrong('colony is unreadable');
  else if ((value.colony !== null) !== (value.act >= COLONY_ACT)) wrong("colony doesn't match the act");
  if ((value.place === 'fight') !== isRecord(value.fight) || (value.place !== 'fight' && value.fight !== null)) {
    wrong("fight doesn't match where the player is");
  } else if (value.fight !== null) {
    const why = fightProblem(value.fight, Array.isArray(value.crew) ? value.crew : []);
    if (why) wrong(`fight ${why}`);
    else if (value.fight.boarding && !runWhy && value.run?.approach?.outcome?.boarding !== 'due') wrong('boarding fight has no approach that ended in it');
  }
  return problems;
}

function fightProblem(fight, crew) {
  if (typeof fight.encounter !== 'string' || !ID.test(fight.encounter) || !isState(fight.seed)) return 'is unreadable';
  const ids = new Set(crew.map((member) => member?.id));
  if (!Array.isArray(fight.crew) || new Set(fight.crew).size !== fight.crew.length || !fight.crew.every((id) => ids.has(id))) {
    return "names crew who aren't aboard";
  }
  if (fight.job !== null && !isJob(fight.job)) return 'has an unreadable job';
  if (typeof fight.raid !== 'boolean' || (fight.raid && fight.job !== null)) return 'is unreadable';
  if (fight.boarding !== null && !(isBoarding(fight.boarding) && !fight.raid && fight.job === null)) return 'has an unreadable boarding';
  const battle = battleProblem(fight.battle);
  if (battle) return battle;
  if (fight.battle.units.filter((unit) => unit.side === 'crew').length !== fight.crew.length) return "doesn't match its crew";
  if (!Array.isArray(fight.log) || !fight.log.every((event) => isRecord(event) && typeof event.type === 'string')) return 'has an unreadable log';
  return null;
}

// The colony (settle.js, colony.js): the world settled, with its name and
// whether it was surveyed, the buildings on it, laid out as a ship's
// modules are (builder.js), its day and its materials (M27, days.js).
function isColony(colony) {
  const world = colony?.world;
  if (!isRecord(colony) || !isWorld(world) || typeof world.name !== 'string' || world.name.trim() === '' || world.name.length > MAX_NAME || typeof world.surveyed !== 'boolean') return false;
  if (!isInt(colony.day, 1, MAX_DAYS) || !isInt(colony.materials, 0, MAX_MATERIALS)) return false;
  return Array.isArray(colony.buildings) && colony.buildings.length <= MAX_BUILDINGS && isShipData({ frame: 'colony', modules: colony.buildings, nextUid: colony.nextUid });
}

// The ship's wrecked modules: each a module it has, with how it is wrecked.
function isWrecks(wrecks, ship) {
  const uids = new Set(ship.modules.map((module) => String(module.uid)));
  return isRecord(wrecks) && Object.entries(wrecks).every(([uid, wreck]) => uids.has(uid) && WRECKS.includes(wreck));
}

// A boarding fight's (encounter.js): which way it goes, and what a win
// pays, rolled as it began.
function isBoarding(boarding) {
  const { salvage } = boarding ?? {};
  return (
    isRecord(boarding) && (boarding.dir === 'them' || boarding.dir === 'you') && isRecord(salvage) &&
    Array.isArray(salvage.parts) && salvage.parts.length <= MAX_SALVAGE && salvage.parts.every(isId) && isInt(salvage.credits, 0, Number.MAX_SAFE_INTEGER)
  );
}

// A job on the board (contracts.js): its ids, seed and pay.
function isJob(job) {
  return (
    isRecord(job) && isId(job.contract) && isId(job.client) && isId(job.site) && (job.twist === null || isId(job.twist)) &&
    isState(job.seed) && isInt(job.credits, 0, Number.MAX_SAFE_INTEGER) && (job.part === null || isId(job.part))
  );
}

// A part for sale (economy.js): its type and price.
function isStockItem(item) {
  return isRecord(item) && isId(item.part) && isInt(item.price, 0, Number.MAX_SAFE_INTEGER);
}

function isId(value) {
  return typeof value === 'string' && ID.test(value);
}

function isCrew(crew) {
  if (!Array.isArray(crew) || crew.length > MAX_CREW) return false;
  const ids = new Set();
  return crew.every((member) => {
    if (!isRecord(member) || !isInt(member.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(member.id)) return false;
    ids.add(member.id);
    return (
      isName(member.name) && typeof member.job === 'string' && ID.test(member.job) && isInt(member.hp, 1, 999) &&
      Array.isArray(member.traits) && member.traits.length <= MAX_TRAITS && member.traits.every(isId) && new Set(member.traits).size === member.traits.length &&
      isLook(member.look)
    );
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
