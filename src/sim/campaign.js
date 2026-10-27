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
//   crew     [{ id, name, job, hp, traits, look, fights, background?,
//            companion?, loyal?, weapon? }]:
//            everyone aboard (from M38d, while the ship is away on a voyage
//            from the colony, those in play: away.js). hp is what they have now: wounds carry from
//            fight to fight, up to the most they can have (maxHp). traits
//            are ids in data/traits.json (traits.js). look is what their
//            portrait is drawn from (looks.js). fights counts the fights they
//            have stood in, which set their job's rank (ranks.js, M32b), and
//            a recruit's background is one of data/recruits.json's. A
//            companion (M33c, companions.js) has their id as companion, and
//            loyal: true once their loyalty quest is done. weapon is the
//            weapon they carry (M37, loadout.js), once they have swapped:
//            with none, their job's own.
//   arms     { [weapon id]: count }: the spare weapons on hand (M37,
//            loadout.js), on the ship or at the hangar
//   captain  the id of the crew member who is the player's captain: named,
//            with a job and CAPTAIN_TRAITS traits, when the campaign
//            starts. Where death is permanent and the captain dies, whoever
//            has stood in the most fights takes command (M41).
//   difficulty  'easy', 'normal' or 'hard': what the enemy brings (M41,
//            difficulty.js), picked at New game and changed in Settings
//   permadeath  true where death is permanent (M41): someone who bleeds
//            out in a fight dies. Picked at New game and kept for the game.
//   fallen   [{ id, name, job, act, look }]: those who died in a fight, the
//            oldest first (M41). With no one left aboard, the game is over
//            (gameOver).
//   heat     the pursuer's meter, 0 to HEAT_MAX (§4.4)
//   standing { [side]: standing }: how each side (data/factions.json) feels
//            about the crew, from STANDING_MIN to STANDING_MAX (standing.js,
//            M33). A new campaign starts its pursuer's side hostile.
//   quests   { [id]: { step, state } }: the quests under way, done or gone
//            cold (quests.js, M33b). A new campaign starts its
//            background's thread at its first step.
//   flags    { [name]: true, a number or a short text }: what has happened
//   eventsMet  the ids of the events settled, oldest first (M36,
//            events.js metEvent)
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
//            (contracts.js) or since M38c a station's (stationJobs.js, with
//            the station's name), or null. raid is true for the pursuer's raid
//            on the hangar (raid.js). boarding is a boarding fight's, from
//            an approach (encounter.js), or null. None of them is a fight at
//            home against boarders (beginFight), which no screen starts any
//            more.
import { int, isState, pick, seedFrom } from '../core/rng.js';
import { actOf, atColony, atHangar, atPort } from './acts.js';
import { aboardOf, MAX_OUT, wholeCrew } from './away.js';
import { MAX_AT, MAX_CITIZENS, MAX_COLONIES, MAX_NEWS } from './colonies.js';
import { battleProblem } from './battleShape.js';
import { createBattle, isMachine } from './battle.js';
import { buildShip, isShipData } from './builder.js';
import { flightChecklist, partLines } from './constraints.js';
import { deploy, machinesOn } from './deploy.js';
import { isCallsign, scarredLook, shortName, wentDown } from './crewLook.js';
import { crewLook, isLook } from './looks.js';
import { MAX_STOCK } from './economy.js';
import { baseOf } from './makers.js';
import { mapFromShip, WRECKS } from './mapFromShip.js';
import { isWorld, MAX_NODES, MAX_PLACE_NAME, runProblem } from './runShape.js';
import { isPlace, MAX_PLACES, tripProblem } from './tripShape.js';
import { DIFFICULTIES, enemyBonus, fightSetup } from './difficulty.js';
import { tally } from './flags.js';
import { rankOf } from './ranks.js';
import { endCold, isQuests, startingQuests } from './questShape.js';
import { isStanding, startStanding } from './standing.js';
import { gearWon } from './gear.js';
import { handedIn, weaponOf, withArms } from './loadout.js';
import { talentOrder, TALENT_RANK } from './talents.js';
import { traitBonus } from './traits.js';
import { isIdentity, nameProblem, rollIdentity, tidyName } from './identity.js';

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
// More spares of a weapon than anyone collects: a guard on what a save can
// hold.
const MAX_ARMS = 999;
// More fights than anyone stands in: a guard on what a save can hold.
const MAX_FIGHTS = 9999;
// The fallen a campaign keeps the names of (M41): the newest, past this.
export const MAX_FALLEN = 99;
export const MAX_FLAG_TEXT = 64;
// More supplies than any ship holds: a guard on what a save can hold.
export const MAX_SUPPLIES = 9999;
// More jobs than any board offers: a guard on what a save can hold.
export const MAX_BOARD = 12;
// More one-off jobs than act 1 has: the same kind of guard.
export const MAX_SPENT = 100;
// More events than the content has: the same kind of guard (events.js
// keeps the last this many).
const MAX_MET = 500;
// More sides than the content has (data/factions.json): the same kind of
// guard.
const MAX_SIDES = 20;
// More parts than any ship could need at once (partsNeeded).
const MAX_NEEDED = 40;
// More parts than a boarding crew strips off a ship: a guard on what a save
// can hold.
const MAX_SALVAGE = 20;
// More parts than any ship has: a guard on the parts a boarding offers.
const MAX_POOL = 200;
// More buildings than the biggest colony grid has cells (40 x 30,
// tools/validate-colony.js): a guard on what a save can hold.
const MAX_BUILDINGS = 1200;
// More days and materials than a colony will count (M27): the same kind of
// guard.
const MAX_DAYS = 99999;
// More days toward the next citizen than citizenDays allows (M38f).
const MAX_GROWTH = 60;
export const MAX_MATERIALS = 9999;
// More days than a raid's lander takes to come (data/balance.json
// raidWarning, held to 10 by tools/validate-data.js): M29's guard.
const MAX_WARNING = 10;
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
// one, all from the seed (startCrew). difficulty and permadeath are the
// game's, picked at New game (M41): Normal, and death not permanent,
// unless given.
export function newCampaign(rules, seed, { background = firstBackground(rules), captain = null, difficulty = 'normal', permadeath = false, shipName = null } = {}) {
  const { start } = rules.backgrounds.get(background);
  const { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  const why = captain && captainProblem(captain, rules, background);
  if (why) throw new RangeError(`newCampaign: ${why}`);
  if (!DIFFICULTIES.includes(difficulty) || typeof permadeath !== 'boolean') throw new RangeError('newCampaign: the difficulty is Easy, Normal or Hard, and permanent death on or off.');
  // The ship's name, number and emblem (M52): rolled, the name the
  // player's if they gave one.
  const rolled = rollIdentity(rules, seed);
  if (shipName !== null && nameProblem(shipName)) throw new RangeError(`newCampaign: ${nameProblem(shipName)}`);
  const identity = shipName === null ? rolled : { ...rolled, name: tidyName(shipName) };
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
    // Spare weapons (M37, loadout.js): everyone starts with their job's.
    arms: {},
    crew,
    captain: crew[at].id,
    difficulty,
    permadeath,
    fallen: [],
    heat: 0,
    standing: startStanding(rules, background),
    quests: startingQuests(rules, background),
    flags: {},
    // The events settled so far, by id (M36, events.js metEvent): a sector
    // or a place draws one again only once its kind has no others left.
    eventsMet: [],
    ship,
    identity,
    wrecks: {},
    board: [],
    shop: null,
    spent: [],
    supplies: 0,
    run: null,
    // The colony (act 3): the world settled at the end of the run (M25,
    // settle.js), and the buildings on it (M26, colony.js). From M38e the
    // one the ship is landed at or flew from, the others in colonies
    // (colonies.js).
    colony: null,
    colonies: [],
    // The reckoning and the ending (M56, reckoning.js): when the
    // pursuer's leader is due at the founding colony, and once the
    // reckoning is won, the pursuit over.
    reckoning: null,
    ending: null,
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
    return { id, ...member, hp: maxHp(member, rules), look, fights: 0 };
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

// The background a campaign starts from when none is picked: the first in
// data/backgrounds.json, the miner.
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
// for the crew aboard (or `crew` of them, for a trip's plan, M28), and in
// an act on a planet, with what lifting off takes. Act 1's goal is every
// line passing.
export function shipChecklist(campaign, rules, crew = crewAboard(campaign)) {
  return flightChecklist(campaign.ship, rules, crew, { liftOff: actOf(campaign, rules)?.liftOff ?? null });
}

// How many fly with the ship, for its flight checks: the whole crew, until
// a world is settled. From then on the crew lives at the colony (M26), and
// only a trip's squad is aboard (M28), or a voyage's crew (M38d, away.js).
export function crewAboard(campaign) {
  if (!campaign.colony) return campaign.crew.length;
  if (campaign.colony.voyage) return aboardOf(campaign).length;
  return campaign.colony.trip?.squad.length ?? 0;
}

// The squad a trip from the colony takes at most (M28): squadSize, or the
// whole crew if it is fewer. Construction mode at the colony counts this
// many aboard, so its flight checks show what a trip needs.
export function fullSquad(campaign, rules) {
  return Math.min(rules.balance.squadSize, campaign.crew.length);
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
// where they stand: their job, name, hit points now, what their traits add,
// the weapon they carry (M37, loadout.js) and their job's rank (ranks.js);
// a loyal companion, their talent, past rank 2 (M33c, talents.js).
export function crewUnit(member, rules) {
  // A callsign stands for the name in a fight (M58).
  const unit = { kind: member.job, name: shortName(member), hp: Math.min(member.hp, maxHp(member, rules)), bonus: traitBonus(member.traits, rules), weapon: weaponOf(member, rules) };
  if (member.loyal && talentOrder(rules, member.companion)) return { ...unit, rank: TALENT_RANK, talent: member.companion };
  const rank = rankOf(member, rules);
  return rank > 0 ? { ...unit, rank } : unit;
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
// its damage moves with it, but it can't come off, except as scrap (M46):
// with a spare of the same part (any maker's) fitted in its place, the
// wreck is gone, not on hand, and its damage with it. A refit is free.
// Otherwise the campaign is left as it was.
export function refitShip(campaign, ship, rules) {
  if (!canRefit(campaign, rules) || ship === campaign.ship || !isShipData(ship) || ship.frame !== campaign.ship.frame) return campaign;
  const scrapped = scrappedWrecks(campaign, ship, rules);
  if (!scrapped) return campaign;
  const parts = onHandAfter(campaign.parts, campaign.ship, ship);
  if (!parts) return campaign;
  for (const { type } of scrapped) {
    parts[type] -= 1;
    if (!parts[type]) delete parts[type];
  }
  if (!scrapped.length) return { ...campaign, ship, parts };
  const gone = new Set(scrapped.map(({ uid }) => String(uid)));
  const wrecks = Object.fromEntries(Object.entries(campaign.wrecks ?? {}).filter(([uid]) => !gone.has(uid)));
  return { ...campaign, ship, parts, wrecks };
}

// True where the ship can be refitted: at the hangar, at a station or a
// shipyard (M37b), or at the colony, where it has landed (M27), while it is
// home (M28).
export function canRefit(campaign, rules) {
  return Boolean(rules) && (atHangar(campaign, rules) || atPort(campaign, rules) || (atColony(campaign, rules) && !campaign.colony.trip));
}

// The uids of the ship's wrecked parts: those a refit can't take off.
export function wreckedUids(campaign) {
  const uids = new Set(campaign.ship.modules.map((module) => module.uid));
  return Object.keys(campaign.wrecks ?? {}).map(Number).filter((uid) => uids.has(uid));
}

// The wrecked parts `ship` scraps, [{ uid, type }], or null if it drops
// one without a spare in its place: each wrecked part not on `ship` as the
// part it was must leave as many of that part (any maker's) aboard as
// before.
function scrappedWrecks(campaign, ship, rules) {
  const scrapped = wreckedUids(campaign).flatMap((uid) => {
    const before = campaign.ship.modules.find((module) => module.uid === uid);
    return ship.modules.some((module) => module.uid === uid && module.type === before.type) ? [] : [{ uid, type: before.type }];
  });
  const base = (type) => baseOf(rules.modules.get(type) ?? { id: type });
  const count = (modules, of) => modules.filter((module) => base(module.type) === of).length;
  return scrapped.every(({ type }) => count(ship.modules, base(type)) >= count(campaign.ship.modules, base(type))) ? scrapped : null;
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
// (settings.js fightSettings): forgiving odds; the difficulty and
// permanent death are the campaign's (M41, difficulty.js). Returns { ok:
// true, campaign } with the fight on, or { ok: false, error } saying why it
// can't start.
export function beginFight(campaign, rules, setup = {}) {
  const { forgiving, difficulty, permadeath } = fightSetup(campaign, setup);
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  if (!campaign.crew.length) return { ok: false, error: 'There is no one aboard to fight.' };
  const unknown = campaign.crew.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const map = mapFromShip(campaign.ship, rules);
  if (!map) return { ok: false, error: 'The ship has no parts yet.' };
  // The ship's working turrets (M39) fight for the crew, after everyone
  // else.
  const machines = machinesOn(map, rules, 'crew');
  const placed = deploy(map, campaign.crew.map((member) => member.job), rules.encounters.get(FIGHT_ENCOUNTER).enemies, rules, machines.map(({ x, y }) => [x, y]));
  if (!placed.ok) return placed;
  const { value: seed, state: rng } = int(campaign.rng, 0, MAX_SEED);
  // deploy lists the crew first, in the order given.
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = [
    ...placed.units.map((unit, i) => {
      const member = campaign.crew[i];
      return member ? { ...unit, ...crewUnit(member, rules) } : { ...unit, bonus };
    }),
    ...machines,
  ];
  const { battle, events } = createBattle({ map, units, seed, options: { forgiving, permadeath } }, rules);
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
// - anyone killed (only where death is permanent) leaves the crew, as
//   buried has it (M41);
// - everyone who stood in it counts it (rankUps says who reaches a rank);
// - the flags count the fights won and lost;
// - a won fight can leave one of the fallen enemies' weapons on hand (M37,
//   gear.js gearWon), counted in the flags as gearWon.
// A fight still going is left as it is. A job's pay is contracts.js's.
export function endFight(campaign, rules) {
  const { fight } = campaign;
  if (!fight?.battle.winner) return campaign;
  const heals = actOf(campaign, rules)?.heals === true;
  const stood = standing(fight, fight.battle, rules);
  const crew = campaign.crew.flatMap((member) => {
    const unit = stood.get(member.id);
    if (unit?.status === 'dead') return [];
    // Everyone who stood in it counts it, won or lost (ranks.js, M32b);
    // anyone who went down and lived bears it (crewLook.js, M58).
    const marked = wentDown(unit) ? { ...member, look: scarredLook(member.look) } : member;
    const counted = unit ? { ...marked, fights: (member.fights ?? 0) + 1 } : marked;
    if (heals) return [{ ...counted, hp: maxHp(member, rules) }];
    if (!unit) return [counted];
    return [{ ...counted, hp: Math.max(1, unit.hp) }];
  });
  const flag = fight.battle.winner === 'crew' ? 'fightsWon' : 'fightsLost';
  const gear = gearWon(fight, fight.battle, rules);
  const flags = { ...campaign.flags, [flag]: (campaign.flags[flag] ?? 0) + 1, ...(gear ? { gearWon: (campaign.flags.gearWon ?? 0) + 1 } : {}) };
  const arms = gear ? withArms(campaign.arms, gear) : campaign.arms;
  const ended = { ...campaign, place: 'hub', fight: null, crew, flags, arms };
  const dead = campaign.crew.filter((member) => stood.get(member.id)?.status === 'dead');
  return dead.length ? buried(ended, rules, dead) : ended;
}

// The campaign after a fight where death is permanent (M41), with those
// who died in it off the crew already: each hands in the weapon they
// carried, as someone let go does (loadout.js handedIn); a companion's
// loyalty quest ends (questShape.js endCold); each is named among the
// fallen, the newest MAX_FALLEN kept; and the flags count them (crewLost).
// A captain among them passes command to whoever has stood in the most
// fights, the first of them in the crew's order, those in the fight's side
// first (captainsLost); with no one left anywhere, it stays theirs, and
// the game is over (gameOver).
function buried(campaign, rules, dead) {
  let next = campaign;
  for (const member of dead) {
    next = { ...next, arms: handedIn(next, member, rules) };
    const loyalty = member.companion ? rules.companions?.get(member.companion)?.loyalty : null;
    if (loyalty) next = endCold(next, loyalty).campaign;
  }
  const act = campaign.act;
  const fallen = [...(campaign.fallen ?? []), ...dead.map(({ id, name, job, look }) => ({ id, name, job, act, look }))].slice(-MAX_FALLEN);
  const lost = dead.some((member) => member.id === campaign.captain);
  const heir = lost ? wholeCrew(next).reduce((best, member) => (!best || (member.fights ?? 0) > (best.fights ?? 0) ? member : best), null) : null;
  const flags = tally(next.flags, { crewLost: dead.length, captainsLost: lost ? 1 : 0 });
  return { ...next, fallen, flags, captain: heir ? heir.id : campaign.captain };
}

// True once the game is over (M41): where death is permanent, no one is
// left aboard, and no fight is on. The screens show its end (root.js
// campaignScreen), and New game starts another.
export function gameOver(campaign) {
  return campaign.permadeath === true && campaign.crew.length === 0 && !campaign.fight;
}

// Who reaches a new rank as the fight under way ends (ranks.js, M32b), by
// endFight's count: [{ member, rank }] in the crew's order, each standing
// in it and alive. battle is the fight's as it stands, once it has a
// winner; [] before.
export function rankUps(campaign, battle, rules) {
  const { fight } = campaign;
  if (!fight || !battle?.winner) return [];
  const stood = standing(fight, battle, rules);
  return campaign.crew.flatMap((member) => {
    const unit = stood.get(member.id);
    if (!unit || unit.status === 'dead') return [];
    const rank = rankOf({ ...member, fights: (member.fights ?? 0) + 1 }, rules);
    return rank > rankOf(member, rules) ? [{ member, rank }] : [];
  });
}

// Who bears a new mark as the fight under way ends (crewLook.js, M58), by
// endFight's: [{ member, mark }] in the crew's order, each who went down
// in it, lived, and had a mark still to take. [] before it has a winner.
export function scarsTaken(campaign, battle, rules) {
  const { fight } = campaign;
  if (!fight || !battle?.winner) return [];
  const stood = standing(fight, battle, rules);
  return campaign.crew.flatMap((member) => {
    if (!wentDown(stood.get(member.id))) return [];
    const { mark } = scarredLook(member.look);
    return mark === member.look.mark ? [] : [{ member, mark }];
  });
}

// The crew in a fight, by id: the unit each crew member is in battle
// (fight.crew lists them in the order of its crew units; the person a job
// brings out, M38, a raid's colonists, M38f, and the ship's turrets, M39,
// are on the crew's side but not of it).
function standing(fight, battle, rules) {
  const units = battle.units.filter((unit) => unit.side === 'crew' && !unit.ward && !unit.citizen && !isMachine(unit, rules));
  return new Map(fight.crew.map((id, i) => [id, units[i]]).filter(([, unit]) => unit));
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
  if (!isRecord(value.arms) || !Object.entries(value.arms).every(([id, count]) => ID.test(id) && isInt(count, 1, MAX_ARMS))) wrong('spare weapons are unreadable');
  if (!isCrew(value.crew)) wrong('crew is unreadable');
  // While the ship is away on a voyage (M38d) the captain can be at home.
  // With no one left anywhere (M41: everyone fell where death is
  // permanent), the game is over, and the captain is the last one's.
  else if (![...value.crew, ...waitingCrew(value)].some((member) => member?.id === value.captain) && !(value.permadeath === true && !value.crew.length)) wrong("captain isn't aboard");
  // The game's difficulty, permanent death and the fallen (M41).
  if (!DIFFICULTIES.includes(value.difficulty)) wrong('difficulty is invalid');
  if (typeof value.permadeath !== 'boolean') wrong('permanent death setting is invalid');
  if (!Array.isArray(value.fallen) || value.fallen.length > MAX_FALLEN || !value.fallen.every(isFallen)) wrong('fallen are unreadable');
  if (!isInt(value.heat, 0, HEAT_MAX)) wrong('heat is invalid');
  // The reckoning and the ending (M56).
  if (value.reckoning !== null && !(isRecord(value.reckoning) && isInt(value.reckoning.due, 0, MAX_DAYS))) wrong('reckoning is unreadable');
  if (value.ending !== null && !isEnding(value.ending)) wrong('ending is unreadable');
  if (!isStanding(value.standing, MAX_SIDES)) wrong('standing with the sides is unreadable');
  if (!isQuests(value.quests)) wrong('quests are unreadable');
  if (!isRecord(value.flags) || !Object.entries(value.flags).every(([name, flag]) => FLAG.test(name) && name.length <= 32 && isFlag(flag))) {
    wrong('flags are unreadable');
  }
  if (!Array.isArray(value.eventsMet) || value.eventsMet.length > MAX_MET || !value.eventsMet.every(isId) || new Set(value.eventsMet).size !== value.eventsMet.length) wrong('events met are unreadable');
  if (!isShipData(value.ship)) wrong('ship is unreadable');
  if (!isIdentity(value.identity)) wrong("ship's name, number or emblem is unreadable");
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
  else if (value.colony?.trip) {
    const why = tripProblem(value.colony.trip, shipSide(value));
    if (why) wrong(`trip ${why}`);
    else if (value.colony.voyage) wrong('trip and voyage are both under way');
  } else if (value.colony?.voyage) {
    const why = voyageProblem(value);
    if (why) wrong(`voyage ${why}`);
  }
  // The other colonies (M38e, colonies.js), none before act 3.
  if (!Array.isArray(value.colonies) || value.colonies.length >= MAX_COLONIES || (value.colonies.length > 0 && !isRecord(value.colony))) wrong('colonies are unreadable');
  else if (value.colonies.length) {
    const why = othersProblem(value);
    if (why) wrong(`colonies ${why}`);
  }
  if ((value.place === 'fight') !== isRecord(value.fight) || (value.place !== 'fight' && value.fight !== null)) {
    wrong("fight doesn't match where the player is");
  } else if (value.fight !== null) {
    const why = fightProblem(value.fight, Array.isArray(value.crew) ? value.crew : []);
    if (why) wrong(`fight ${why}`);
    else if (value.fight.boarding && !runWhy && value.run?.approach?.outcome?.boarding !== 'due' && !heldPlace(value.colony)) {
      wrong(value.colony?.trip ? 'boarding fight has no held derelict where the squad is' : 'boarding fight has no approach that ended in it');
    } else if (value.fight.raid && value.colony) {
      // At the colony the ship is at or flew from, or from M38e another.
      const at = value.fight.colony === undefined ? value.colony : (Array.isArray(value.colonies) ? value.colonies : []).find((other) => other?.id === value.fight.colony);
      if (!(at?.raid && at.day >= at.raid.lands)) wrong('raid fight has no lander down at the colony');
    }
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
  // The person a job brings out (M38) and a raid's colonists (M38f) are on
  // the crew's side, not of it. So are the ship's turrets (M39): known by
  // their kind once content has loaded, and here, without it, as the only
  // units with no moves (battle.js gives everyone else 1 at least).
  if (fight.battle.units.filter((unit) => unit.side === 'crew' && !unit.ward && !unit.citizen && unit.mobility > 0).length !== fight.crew.length) return "doesn't match its crew";
  if (!Array.isArray(fight.log) || !fight.log.every((event) => isRecord(event) && typeof event.type === 'string')) return 'has an unreadable log';
  return null;
}

// The colony (settle.js, colony.js): the world settled, with its name and
// whether it was surveyed, the buildings on it, laid out as a ship's
// modules are (builder.js), its day and its materials (M27, days.js), and
// its places within reach and the trip under way, or null (M28,
// expeditions.js; the trip's squad is checked against the crew apart); its
// system's other worlds, and the voyage under way, or null (M38d,
// voyage.js; checked apart); its number, where it lies along the line of
// systems and its own heat (M38e, colonies.js); its citizens, the days
// toward the next and its news (M38f).
function isColony(colony) {
  const world = colony?.world;
  if (!isRecord(colony) || !isWorld(world) || typeof world.name !== 'string' || world.name.trim() === '' || world.name.length > MAX_NAME || typeof world.surveyed !== 'boolean') return false;
  if (!isInt(colony.day, 1, MAX_DAYS) || !isInt(colony.materials, 0, MAX_MATERIALS)) return false;
  if (!Array.isArray(colony.places) || colony.places.length > MAX_PLACES || !colony.places.every(isPlace)) return false;
  if (colony.trip !== null && !isRecord(colony.trip)) return false;
  if (colony.raid !== null && !isRaid(colony.raid)) return false;
  if (!Array.isArray(colony.worlds) || colony.worlds.length > MAX_NODES || !colony.worlds.every((other) => isRecord(other) && isName(other.name) && isWorld(other.world))) return false;
  if (colony.voyage !== null && !isRecord(colony.voyage)) return false;
  // Its number, where it lies and its own heat (M38e, colonies.js).
  if (!isInt(colony.id, 1, MAX_COLONIES) || !isInt(colony.at, 0, MAX_AT) || !isInt(colony.heat, 0, HEAT_MAX)) return false;
  // Its citizens, the days toward the next, and its news (M38f).
  if (!isInt(colony.citizens, 0, MAX_CITIZENS) || !isInt(colony.growth, 0, MAX_GROWTH)) return false;
  if (!Array.isArray(colony.news) || colony.news.length > MAX_NEWS || !colony.news.every(isNews)) return false;
  // Lying low and a side's trader there (M53).
  if (typeof colony.lowProfile !== 'boolean' || (colony.trader !== null && !isTrader(colony.trader))) return false;
  return Array.isArray(colony.buildings) && colony.buildings.length <= MAX_BUILDINGS && isShipData({ frame: 'colony', modules: colony.buildings, nextUid: colony.nextUid });
}

// The crew a saved voyage keeps out of play (M38d, away.js), and from M38e
// those at the other colonies (colonies.js), as far as they read, for the
// save's checks: [] with none.
function waitingCrew(value) {
  const voyage = isRecord(value.colony) && isRecord(value.colony.voyage) ? value.colony.voyage : null;
  const side = voyage?.home ?? voyage?.aboard;
  const others = Array.isArray(value.colonies) ? value.colonies.filter(isRecord) : [];
  const crews = [side, ...others.map((other) => other.keep), ...others.map((other) => other.parked)].filter((one) => isRecord(one) && Array.isArray(one.crew));
  return crews.flatMap((one) => one.crew);
}

// Why the voyage under way (M38d, voyage.js; away.js) is unreadable, as
// words to follow "The campaign's voyage ", or null if it reads: how many
// systems out it is, the days a flight a lander stopped still has to fly
// (one for each system between the ship and the colony it flies to, M38e),
// where the ship is along the line and that colony, and the side not in
// play. That is those at home and the colony's food, or while those at home
// fight a raid, those aboard and the ship's supplies; never anyone twice,
// and someone always aboard. A voyage is on the run.
function voyageProblem(value) {
  const { voyage } = value.colony;
  if (!isInt(voyage.out, 1, MAX_OUT) || !(voyage.homing === null || isInt(voyage.homing, 1, MAX_AT))) return 'is unreadable';
  // Where the ship is along the line, and the colony a flight is for (M38e):
  // null for the one it flew from, else another's number.
  if (!isInt(voyage.at, 0, MAX_AT)) return 'is unreadable';
  const bound = voyage.to === null ? value.colony : (Array.isArray(value.colonies) ? value.colonies : []).find((other) => other?.id === voyage.to);
  if (!bound) return 'flies to no colony';
  // A stopped flight has a day still to fly for each system between.
  if (voyage.homing !== null && voyage.homing !== Math.abs(voyage.at - bound.at)) return 'is unreadable';
  if ((voyage.home === undefined) === (voyage.aboard === undefined)) return 'is unreadable';
  const side = voyage.home ?? voyage.aboard;
  if (!isRecord(side) || !isCrew(side.crew) || !isInt(voyage.home ? side.food : side.supplies, 0, MAX_SUPPLIES)) return 'is unreadable';
  const crew = shipSide(value);
  const ids = new Set(crew.map((member) => member?.id));
  if (side.crew.some((member) => ids.has(member.id)) || crew.length + side.crew.length > MAX_CREW) return 'names crew twice';
  if (!(voyage.home ? crew : side.crew).length) return 'has nobody aboard';
  if (voyage.aboard && !(value.place === 'fight' && value.fight?.raid && value.fight.colony === undefined)) return 'has those at home in play with no raid to fight';
  if (value.run === null) return 'is on no run';
  return null;
}

// The crew of the colony the ship is at or flew from, as far as it reads:
// the campaign's, or while those at another colony fight a raid there
// (M38e, colonies.js frontAt), the side parked there.
function shipSide(value) {
  const parked = Array.isArray(value.colonies) ? value.colonies.find((other) => isRecord(other) && isRecord(other.parked)) : null;
  const crew = parked ? parked.parked.crew : value.crew;
  return Array.isArray(crew) ? crew : [];
}

// Why the other colonies (M38e, colonies.js) are unreadable, as words to
// follow "The campaign's colonies ", or null if they read: each a colony
// with no trip or voyage of its own, numbered apart from every other, with
// whoever is there and its food; or, while they fight a raid there, the
// side they stand in for, the fight being that colony's. Nobody anywhere
// twice.
function othersProblem(value) {
  const others = value.colonies;
  if (!others.every((other) => isColony(other) && other.trip === null && other.voyage === null)) return 'are unreadable';
  const ids = [value.colony.id, ...others.map((other) => other.id)];
  if (new Set(ids).size !== ids.length) return 'are numbered twice';
  for (const other of others) {
    if ((other.keep === undefined) === (other.parked === undefined)) return 'are unreadable';
    const side = other.keep ?? other.parked;
    if (!isRecord(side) || !isCrew(side.crew) || !isInt(other.keep ? side.food : side.supplies, 0, MAX_SUPPLIES)) return 'are unreadable';
    if (other.parked && !(value.place === 'fight' && value.fight?.raid && value.fight.colony === other.id)) return 'stand in for a side with no raid to fight';
  }
  const everyone = [...(Array.isArray(value.crew) ? value.crew : []), ...waitingCrew(value)].map((member) => member?.id);
  if (new Set(everyone).size !== everyone.length || everyone.length > MAX_CREW) return 'name crew twice';
  return null;
}

// An entry in a colony's news (M38f, colonies.js): a raid fought out there,
// with the part it took or null, or its citizens grown, gone or settled.
function isNews(entry) {
  if (!isRecord(entry) || !isInt(entry.day, 1, MAX_DAYS)) return false;
  if (entry.kind === 'raid') {
    if (typeof entry.won !== 'boolean' || (entry.part !== null && (typeof entry.part !== 'string' || entry.part.length > MAX_NAME))) return false;
    return [entry.landed, entry.fell, entry.food, entry.materials].every((n) => isInt(n, 0, MAX_SUPPLIES + MAX_CITIZENS));
  }
  return ['grew', 'left', 'settled'].includes(entry.kind) && isInt(entry.citizens, 0, MAX_CITIZENS);
}

// A raid coming (M29, raids.js): the day the pursuer found the colony and
// the day its lander comes down, after it.
function isTrader(trader) {
  return isRecord(trader) && typeof trader.side === 'string' && isInt(trader.day, 1, MAX_DAYS) && (trader.part === null || typeof trader.part === 'string') && typeof trader.bought === 'boolean' && isInt(trader.sold, 0, 100);
}

// The reckoning won (M56, reckoning.js): { day, colony (its name, or
// null), won: true, seen }.
function isEnding(ending) {
  return isRecord(ending) && isInt(ending.day, 0, MAX_DAYS) && (ending.colony === null || (typeof ending.colony === 'string' && ending.colony.length <= 60)) && ending.won === true && typeof ending.seen === 'boolean';
}

function isRaid(raid) {
  return isRecord(raid) && isInt(raid.found, 1, MAX_DAYS) && isInt(raid.lands, raid.found + 1, MAX_DAYS + MAX_WARNING) && (raid.extra === undefined || isInt(raid.extra, 0, 4)) && (raid.reckoning === undefined || raid.reckoning === true);
}

// True when the colony's trip is at a place the scavengers hold, not yet
// fought for: where a boarding fight on a trip comes from (M28).
function heldPlace(colony) {
  return Boolean(colony?.trip?.place?.held) && colony.trip.done === false;
}

// The ship's wrecked modules: each a module it has, with how it is wrecked.
function isWrecks(wrecks, ship) {
  const uids = new Set(ship.modules.map((module) => String(module.uid)));
  return isRecord(wrecks) && Object.entries(wrecks).every(([uid, wreck]) => uids.has(uid) && WRECKS.includes(wreck));
}

// A boarding fight's (encounter.js): which way it goes, and what a win
// pays, set as it began: her working parts to pick from (M46, strip.js),
// the dearest of them as many as she gives, and credits, and at a place the
// scavengers hold (M28, expeditions.js) materials.
function isBoarding(boarding) {
  const { salvage } = boarding ?? {};
  return (
    isRecord(boarding) && (boarding.dir === 'them' || boarding.dir === 'you') && isRecord(salvage) &&
    Array.isArray(salvage.pool) && salvage.pool.length <= MAX_POOL && salvage.pool.every(isId) &&
    Array.isArray(salvage.parts) && salvage.parts.length <= MAX_SALVAGE && salvage.parts.every((type) => salvage.pool.includes(type)) && isInt(salvage.credits, 0, Number.MAX_SAFE_INTEGER) &&
    (salvage.materials === undefined || isInt(salvage.materials, 0, MAX_MATERIALS))
  );
}

// A job on the board (contracts.js): its ids, seed and pay; a quest's
// (M33b, quests.js questJobs) names its quest.
function isJob(job) {
  return (
    isRecord(job) && isId(job.contract) && isId(job.client) && isId(job.site) && (job.twist === null || isId(job.twist)) &&
    isState(job.seed) && isInt(job.credits, 0, Number.MAX_SAFE_INTEGER) && (job.part === null || isId(job.part)) && (job.quest === undefined || isId(job.quest)) &&
    (job.station === undefined || (typeof job.station === 'string' && job.station.length > 0 && job.station.length <= MAX_PLACE_NAME && job.quest === undefined))
  );
}

// A part for sale (economy.js): its type and price.
// A part for sale, or a weapon (M37).
function isStockItem(item) {
  return isRecord(item) && (isId(item.part) || isId(item.weapon)) && !(item.part !== undefined && item.weapon !== undefined) && isInt(item.price, 0, Number.MAX_SAFE_INTEGER);
}

function isId(value) {
  return typeof value === 'string' && ID.test(value);
}

// One of the fallen (M41): { id, name, job, act, look }.
function isFallen(member) {
  return isRecord(member) && isInt(member.id, 1, Number.MAX_SAFE_INTEGER) && isName(member.name) && typeof member.job === 'string' && ID.test(member.job) && isInt(member.act, 1, ACTS) && isLook(member.look);
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
      isLook(member.look) && isInt(member.fights, 0, MAX_FIGHTS) && (member.background === undefined || isId(member.background)) &&
      (member.companion === undefined || isId(member.companion)) && (member.loyal === undefined || (member.loyal === true && member.companion !== undefined)) &&
      (member.weapon === undefined || isId(member.weapon)) && (member.callsign === undefined || isCallsign(member.callsign))
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
