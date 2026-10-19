// The campaign's content, for validate-data.js: its acts (campaign.json),
// act 2's sectors (sectors.json, validate-sectors.js) and the worlds past
// them (worlds.json, validate-worlds.js, M25), the names its
// recruits draw on (recruits.json), the backgrounds a
// campaign starts from (backgrounds.json), act 1's
// districts with their clients and job sites (districts.json), the sites'
// map templates (sites.json) and the jobs (contracts.json); from M28 the
// places within reach of the colony (expeditions.json,
// validate-expeditions.js), whose events are events.json's; and from M38c
// the stations' clients and sites, whose jobs are contracts.json's too
// (docks.json).
import { lookProblems } from '../src/render/figures/looks.js';
import { SITE_LOOKS } from '../src/render/palette.js';
import { SCENES } from '../src/render/scenes/scenes.js';
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { ACTS, CAPTAIN_TRAITS, MAX_NAME } from '../src/sim/campaign.js';
import { MISSIONS } from '../src/sim/contracts.js';
import { MAX_STOCK, PAY_STEP } from '../src/sim/economy.js';
import { indexDefs } from '../src/sim/defs.js';
import { HAZARDS, siteMarks, siteProblems } from '../src/sim/gen/site.js';
import { isId, isIntIn, isListIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';
import { checkColony } from './validate-colony.js';
import { checkEvents } from './validate-events.js';
import { checkExpeditions } from './validate-expeditions.js';
import { checkArms } from './validate-factions.js';
import { checkSectors } from './validate-sectors.js';
import { checkWorlds } from './validate-worlds.js';

const CAMPAIGN_KEYS = ['acts'];
const ACT_KEYS = ['act', 'name', 'hub', 'home', 'heals', 'liftOff', 'scene', 'sectors', 'ahead'];
// A run (act 2) crosses up to this many sectors.
const MAX_SECTORS = 20;
// Lifting off takes thrust for each unit of mass: up to this many.
const MAX_LIFT_OFF = 4;
// An act's words for what is still to come fit a panel's line or two.
const MAX_AHEAD = 240;
const BACKGROUND_KEYS = ['id', 'name', 'blurb', 'pursuer', 'launch', 'captains', 'district', 'start'];
// Recruits' names (recruits.js): a first and a last name, each list of 2
// or more, and each name short enough that the two fit a crew member's.
// And since M32b the backgrounds they come from.
const RECRUIT_KEYS = ['first', 'last', 'backgrounds'];
const NAME_KEYS = ['first', 'last'];
const MAX_RECRUIT_NAMES = 200;
// A recruit's background (M32b): a line about it, the jobs and traits it
// rolls from, how many traits each recruit takes from them (no more than a
// captain picks, CAPTAIN_TRAITS), and the fights already stood, [least,
// most].
const PAST_KEYS = ['id', 'name', 'text', 'jobs', 'traits', 'traitCount', 'fights'];
const MAX_PASTS = 40;
const MAX_PAST_TEXT = 140;
const MAX_PAST_FIGHTS = 99;
// Names the captain's name field offers, each a name a captain can have.
const MAX_CAPTAINS = 20;
// The words as the ship lifts off (launch.js), and the pursuer's when it
// lifts off with a raid at the door.
const LAUNCH_KEYS = ['text', 'escaped'];
const PURSUER_KEYS = ['name', 'side', 'blurb', 'levels', 'hunters', 'raiders', 'payment', 'run', 'colony'];
// Heat's levels (src/sim/heat.js), each with the pursuer's words for it:
// act 1's, and on the run (act 2) its own.
const HEAT_LEVELS = ['calm', 'rumors', 'hunters', 'raid'];
const RUN_LEVELS = ['calm', 'rumors', 'hunters', 'taskForce', 'cornered'];
// On the run: its words for each level, the ships its hunters fly from the
// hunters' level and from the task force's (ship presets with tactics and
// a party), and its words once they have been faced (src/sim/hunt.js).
const RUN_KEYS = ['levels', 'hunters', 'taskForce', 'faced'];
// At the colony (act 3, src/sim/raids.js, M29): its words for each of the
// run's levels of heat, the encounter its lander brings down, and its words
// as it finds the colony, as the lander comes down, and once a raid has
// been faced.
const COLONY_KEYS = ['levels', 'raiders', 'found', 'landing', 'faced'];
const PAYMENT_KEYS = ['name', 'text', 'credits', 'heat'];
const MAX_HUNTERS = 2;
// A raid's raiders, at the hangar's doors (hangarMap.js).
const MAX_RAIDERS = 8;
const START_KEYS = ['credits', 'parts', 'crew', 'ship'];
const SCRIPT_KEYS = ['frame', 'placements'];
const PLACEMENT_KEYS = ['type', 'x', 'y', 'rot'];
const DISTRICT_KEYS = ['id', 'name', 'blurb', 'clients', 'sites', 'shop'];
const SHOP_KEYS = ['name', 'dealer', 'pitch', 'size', 'parts', 'armsSize', 'arms'];
const CLIENT_KEYS = ['id', 'name', 'title', 'blurb', 'side'];
const SITE_KEYS = ['id', 'name', 'map', 'blurb'];
// A site map can name its look (M38c): a skin of its own for the fight
// (src/render/palette.js). Without one, it is the ground's.
const MAP_KEYS = ['id', 'name', 'look', 'rows'];
// The stations' work on the run (M38c, stationJobs.js): how many jobs a
// board posts, the clients there and the sites at their docks and on the
// rocks nearby. Their jobs are contracts.json's, at these sites, with their
// home as STATIONS, which no district's id can be.
const DOCKS_KEYS = ['board', 'clients', 'sites'];
const STATIONS = 'the stations';
const CONTRACTS_KEYS = ['boardSize', 'twistChance', 'missions', 'people', 'twists', 'jobs'];
const MISSION_KEYS = ['id', 'name', 'brief', 'loud'];
const TWIST_KEYS = ['id', 'name', 'text', 'enemies', 'hazard', 'patches', 'sight', 'deadline', 'pay', 'missions', 'loud'];
// A quest's job (M33b, validate-quests.js) names its quest and is never on
// the board's rotation.
const JOB_KEYS = ['id', 'title', 'mission', 'crates', 'turns', 'targets', 'rounds', 'captive', 'clients', 'sites', 'encounter', 'against', 'credits', 'drops', 'once', 'quest', 'pitch'];
const DROPS_KEYS = ['chance', 'parts'];
// A drop table's weights (drops.js): whole numbers up to this.
const MAX_WEIGHT = 100;
// A twist's numbers, each one's allowed range. A twist sets at least one
// of them, or a hazard.
const TWIST_NUMBERS = { enemies: [-2, 2], patches: [1, 2], sight: [2, 20], deadline: [3, 30], pay: [-90, 200] };
// What each mission needs of a job, and each number's range: grab and
// extract the crates, hack the turns of work on the terminal, sabotage the
// targets and defend the rounds to hold (M38). A rescue names its captive
// (CAPTIVE_NAME).
const MISSION_NEEDS = {
  grab: { crates: [1, 3] },
  hack: { turns: [1, 5] },
  extract: { crates: [1, 3] },
  sabotage: { targets: [1, 3] },
  defend: { rounds: [3, 10] },
};
const MISSION_NUMBERS = ['crates', 'turns', 'targets', 'rounds'];
const CAPTIVE_NAME = 24;
// The people a job brings out (M38, battle.js wards): an escort's client
// and a rescue's captive, each with its numbers and look.
const PEOPLE = ['client', 'captive'];
const PERSON_KEYS = ['id', 'name', 'hp', 'defense', 'mobility', 'armor', 'look'];
const PERSON_NUMBERS = { hp: [1, 20], defense: [0, 50], mobility: [1, 8], armor: [0, 3] };
// The {words} each text may use, filled in when it is shown.
const BRIEF_WORDS = { clear: [], grab: ['crates'], hack: ['turns'], extract: ['crates'], escort: ['client'], defend: ['rounds'], sabotage: ['targets'], rescue: ['captive'] };
const PITCH_WORDS = ['client', 'site'];
// A station's job can name the station too (M38c).
const STATION_PITCH_WORDS = ['client', 'site', 'station'];
// Everyone aboard fights, so a starting crew is a squad's size.
const MAX_SQUAD = 5;
const MAX_BOARD = 5;
const MAX_CREDITS = 9995;

// Checks every campaign file. ids: the content the campaign refers to, as
// { jobIds, moduleIds, frameById, encounters (id -> enemy list), presets,
// sides (the sides' ids, validate-factions.js) }. Returns
// the starting ships that are well formed, as [where, script], for
// checkStartShips.
export function checkCampaignFiles(data, ids, fail) {
  checkActs(data.campaign, fail);
  const holding = checkSectors(data.sectors, data.campaign?.acts, ids.presets ?? new Map(), fail);
  checkWorlds(data.worlds, data.sectors, fail);
  checkColony(data.colony, data.modules?.modules, fail, data.weapons?.weapons);
  // A battle unit's kind is its job's, an enemy's, a person's a job brings
  // out, or else the colonist's (M38f, battle.js): none of them may share it.
  const colonist = data.colony?.citizen?.id;
  const people = new Set((data.contracts?.people ?? []).map((person) => person?.id));
  if (typeof colonist === 'string' && (ids.jobIds?.has(colonist) || ids.enemyIds?.has(colonist) || people.has(colonist))) {
    fail('colony.json citizen', `id: "${colonist}" is a job's, an enemy's or a person's: a colonist needs an id of its own`);
  }
  const nodeKinds = new Set((data.sectors?.nodes ?? []).map((node) => node?.id));
  const places = checkExpeditions(data.expeditions, nodeKinds, ids, fail);
  const sides = ids.sides ?? new Set();
  const backgrounds = new Set((data.backgrounds?.backgrounds ?? []).map((background) => background?.id));
  const held = new Set((data.expeditions?.kinds ?? []).filter((kind) => kind?.held).map((kind) => kind.id));
  const weapons = new Set((data.weapons?.weapons ?? []).map((weapon) => weapon?.id));
  const more = { jobs: ids.jobIds ?? new Set(), traits: ids.traitIds ?? new Set(), backgrounds, presets: ids.presets ?? new Map(), held, weapons };
  const covered = checkEvents(data.events, holding, ids.moduleIds, fail, places, sides, ids.companions ?? new Set(), more);
  for (const kind of holding) if (!covered.has(kind)) fail(`sectors.json node ${kind}`, 'holds events, but events.json has none of its kind');
  for (const kind of data.expeditions?.kinds ?? []) {
    if (kind?.held?.chance !== 100 && !covered.has(kind?.id)) fail(`expeditions.json kind ${kind?.id}`, 'has places with events, but events.json has none of its kind');
  }
  checkRecruits(data.recruits, ids, fail);
  const maps = checkSiteMaps(data.sites, fail);
  const weaponIds = new Set((data.weapons?.weapons ?? []).map((weapon) => weapon.id));
  const districts = checkDistricts(data.districts, maps, { ...ids, sides, weaponIds }, fail);
  const scripts = checkBackgrounds(data.backgrounds, districts, { ...ids, sides }, fail);
  const stationBoard = checkDocks(data.docks, maps, districts, sides, fail);
  // Hunters join every job's fight once heat is high enough.
  const hunters = Math.max(0, ...(data.backgrounds?.backgrounds ?? []).map((b) => (Array.isArray(b?.pursuer?.hunters) ? b.pursuer.hunters.length : 0)));
  // An escort's client comes in beside the crew, the biggest start's.
  const crew = Math.max(0, ...(data.backgrounds?.backgrounds ?? []).map((b) => (Array.isArray(b?.start?.crew) ? b.start.crew.length : 0)));
  checkContracts(data.contracts, districts, maps, { ...ids, hunters, sides, crew, stationBoard }, fail);
  return scripts;
}

// The names recruits draw on: lists of first and last names, none twice;
// and the backgrounds they come from, each rolling from jobs and traits
// that exist.
function checkRecruits(file, ids, fail) {
  const where = 'recruits.json';
  if (!isObject(file)) {
    fail(where, 'must be an object of first and last names and backgrounds');
    return;
  }
  knownKeys(file, RECRUIT_KEYS, where, fail);
  const most = Math.floor((MAX_NAME - 1) / 2);
  for (const key of NAME_KEYS) {
    const names = file[key];
    if (!isListIn(names, 2, MAX_RECRUIT_NAMES) || !names.every((name) => isText(name) && name === name.trim() && name.length <= most)) {
      fail(where, `${key} must be a list of 2 to ${MAX_RECRUIT_NAMES} names of up to ${most} letters`);
    } else if (new Set(names).size !== names.length) {
      fail(where, `${key} has a name twice`);
    }
  }
  const pasts = listOf(file, 'backgrounds', where, fail);
  if (!pasts.length || pasts.length > MAX_PASTS) fail(where, `backgrounds must be a list of 1 to ${MAX_PASTS}`);
  uniqueIds(pasts, `${where} backgrounds`, fail);
  pasts.forEach((past, i) => checkPast(past, `${where} background ${past.id ?? `#${i}`}`, ids, fail));
}

// One background recruits come from.
function checkPast(past, where, { jobIds, traitIds }, fail) {
  knownKeys(past, PAST_KEYS, where, fail);
  if (!isText(past.name) || past.name.length > MAX_NAME) fail(where, `name must be a non-empty string of up to ${MAX_NAME} letters`);
  if (!isText(past.text) || past.text.length > MAX_PAST_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_PAST_TEXT} letters`);
  if (!isListIn(past.jobs, 1, jobIds.size) || new Set(past.jobs).size !== past.jobs.length) fail(where, 'jobs must be a list of crew jobs, none twice');
  else for (const job of past.jobs) if (!jobIds.has(job)) fail(where, `jobs: unknown job "${job}"`);
  if (!isListIn(past.traits, 0, traitIds.size) || new Set(past.traits).size !== past.traits.length) fail(where, 'traits must be a list of traits, none twice');
  else for (const trait of past.traits) if (!traitIds.has(trait)) fail(where, `traits: unknown trait "${trait}"`);
  if (!isIntIn(past.traitCount, 0, Math.min(CAPTAIN_TRAITS, Array.isArray(past.traits) ? past.traits.length : 0))) {
    fail(where, `traitCount must be a whole number from 0 to ${CAPTAIN_TRAITS}, and no more than its traits`);
  }
  if (!isRange(past.fights, 0, MAX_PAST_FIGHTS)) fail(where, `fights must be [least, most], whole numbers from 0 to ${MAX_PAST_FIGHTS}`);
}

// Each starting ship builds part by part with the builder's rules, and its
// layout breaks none of them. Unfinished is fine: act 1 is about finishing
// it. Only for content that checks out, since the rules index it.
export function checkStartShips(data, scripts, fail) {
  let defs;
  try {
    defs = indexDefs(data);
  } catch (err) {
    fail('backgrounds.json', `the content can't be indexed: ${err.message}`);
    return;
  }
  for (const [at, script] of scripts) {
    try {
      const { ship, rejected } = buildShip(defs, script.frame, script.placements);
      for (const r of rejected) fail(at, `placement ${r.index + 1} (${r.placement.type}) is rejected: ${r.message}`);
      if (!rejected.length) for (const p of layoutProblems(ship, defs)) fail(at, p.message);
    } catch (err) {
      fail(at, `can't be built: ${err.message}`);
    }
  }
}

// The acts in order, each with its name, its home (the hub: an id, and
// words for the player), whether coming home heals the crew, for an act on
// a planet, the thrust for each unit of mass lifting off takes, and for an
// act not built yet, the words that stand in for it.
function checkActs(file, fail) {
  const where = 'campaign.json';
  if (!isObject(file)) {
    fail(where, 'must be an object with "acts"');
    return;
  }
  knownKeys(file, CAMPAIGN_KEYS, where, fail);
  const acts = listOf(file, 'acts', where, fail);
  acts.forEach((act, i) => {
    const at = `${where} act #${i + 1}`;
    knownKeys(act, ACT_KEYS, at, fail);
    if (!isText(act.name) || !isText(act.home)) fail(at, 'name and home must be non-empty strings');
    if (!isId(act.hub)) fail(at, 'hub must be lowercase letters, digits and dashes');
    if (typeof act.heals !== 'boolean') fail(at, 'heals must be true or false');
    if (act.liftOff !== undefined && !(typeof act.liftOff === 'number' && act.liftOff > 0 && act.liftOff <= MAX_LIFT_OFF)) {
      fail(at, `liftOff must be a number above 0, up to ${MAX_LIFT_OFF}`);
    }
    // The scene the ship lifts off from (M34), drawn in code.
    if (act.scene !== undefined && !SCENES.includes(act.scene)) fail(at, `scene must be one drawn: ${SCENES.join(', ')}`);
    if (act.sectors !== undefined && !isIntIn(act.sectors, 1, MAX_SECTORS)) fail(at, `sectors must be a whole number from 1 to ${MAX_SECTORS}`);
    // What is still to come in an act not finished yet (act 3's, M26).
    if (act.ahead !== undefined && !(isText(act.ahead) && act.ahead.length <= MAX_AHEAD)) fail(at, `ahead must be a non-empty string of up to ${MAX_AHEAD} letters`);
  });
  if (acts.length !== ACTS || acts.some((act, i) => act.act !== i + 1)) fail(where, `acts must be acts 1 to ${ACTS} in order`);
}

// The sites' map templates, each with no problem gen/site.js can find.
// Returns each good template's mark counts, by id.
function checkSiteMaps(file, fail) {
  const maps = listOf(file, 'maps', 'sites.json', fail);
  uniqueIds(maps, 'sites.json', fail);
  const marks = new Map();
  maps.forEach((map, i) => {
    const where = `sites.json ${map.id ?? `#${i}`}`;
    knownKeys(map, MAP_KEYS, where, fail);
    if (!isText(map.name)) fail(where, 'name must be a non-empty string');
    if (map.look !== undefined && !SITE_LOOKS.includes(map.look)) fail(where, `look must be one of ${SITE_LOOKS.join(', ')}, or left out for the ground's`);
    if (!Array.isArray(map.rows) || !map.rows.every((row) => typeof row === 'string')) {
      fail(where, 'rows must be a list of lines in the battle map text format');
      return;
    }
    const problems = siteProblems(map);
    for (const problem of problems) fail(where, problem);
    if (!problems.length && isId(map.id)) marks.set(map.id, siteMarks(map));
  });
  return marks;
}

// The districts: their clients and their sites, each site on a map
// template, and the shop if there is one. Client and site ids are unique
// across districts and the stations (checkDocks), so a job can name them
// alone. Returns { districts: id -> { clients, sites }, sites: id -> {
// district, map }, clientSides: client id -> the side they work for,
// clients: every client's id }.
function checkDistricts(file, maps, { moduleIds, sides, weaponIds }, fail) {
  const districts = listOf(file, 'districts', 'districts.json', fail);
  uniqueIds(districts, 'districts.json', fail);
  const homes = { districts: new Map(), sites: new Map(), clientSides: new Map(), clients: new Set() };
  districts.forEach((district, i) => {
    const where = `districts.json ${district.id ?? `#${i}`}`;
    knownKeys(district, DISTRICT_KEYS, where, fail);
    if (!isText(district.name) || !isText(district.blurb)) fail(where, 'name and blurb must be non-empty strings');
    const own = { clients: new Set(), sites: new Set() };
    checkClients(listOf(district, 'clients', where, fail), where, own, homes, sides, fail);
    checkSites(listOf(district, 'sites', where, fail), where, district.id, own, homes, maps, fail);
    if (!own.clients.size || !own.sites.size) fail(where, 'needs at least one client and one site');
    if (district.shop !== undefined) checkShop(district.shop, `${where} shop`, own.clients, moduleIds, weaponIds, fail);
    if (isId(district.id)) homes.districts.set(district.id, own);
  });
  return homes;
}

// The stations' work on the run (M38c): how many jobs a board posts, the
// clients at the stations (each a side's, or nobody's) and the sites at
// their docks and on the rocks nearby, each on a map template. They join
// `homes` (checkDistricts's) as a district's do, under STATIONS. Returns
// the board's size, or 0 when it isn't one.
function checkDocks(file, maps, homes, sides, fail) {
  const where = 'docks.json';
  if (!isObject(file)) {
    fail(where, 'must be an object with the board, clients and sites');
    return 0;
  }
  knownKeys(file, DOCKS_KEYS, where, fail);
  const board = isIntIn(file.board, 1, MAX_BOARD) ? file.board : 0;
  if (!board) fail(where, `board must be a whole number from 1 to ${MAX_BOARD}`);
  const own = { clients: new Set(), sites: new Set() };
  checkClients(listOf(file, 'clients', where, fail), where, own, homes, sides, fail);
  checkSites(listOf(file, 'sites', where, fail), where, STATIONS, own, homes, maps, fail);
  if (!own.clients.size || !own.sites.size) fail(where, 'needs at least one client and one site');
  homes.districts.set(STATIONS, own);
  return board;
}

// A home's clients (a district's or the stations'), each id unique across
// every home, and the side each works for, if any (M33): the jobs they
// offer are for it.
function checkClients(clients, where, own, homes, sides, fail) {
  for (const client of clients) {
    const at = `${where} client ${client.id ?? '?'}`;
    knownKeys(client, CLIENT_KEYS, at, fail);
    if (!isId(client.id)) {
      fail(at, 'id must be lowercase letters, digits and dashes');
    } else if (homes.clients.has(client.id)) {
      fail(at, `duplicate client id "${client.id}"`);
    } else {
      homes.clients.add(client.id);
      own.clients.add(client.id);
    }
    if (!isText(client.name) || !isText(client.title) || !isText(client.blurb)) fail(at, 'name, title and blurb must be non-empty strings');
    if (client.side !== undefined) {
      if (!sides.has(client.side)) fail(at, `side: unknown side "${client.side}" (factions.json)`);
      else if (isId(client.id)) homes.clientSides.set(client.id, client.side);
    }
  }
}

// A home's job sites, each id unique across every home, on a map template
// that checks out.
function checkSites(sites, where, home, own, homes, maps, fail) {
  for (const site of sites) {
    const at = `${where} site ${site.id ?? '?'}`;
    knownKeys(site, SITE_KEYS, at, fail);
    if (!isId(site.id)) {
      fail(at, 'id must be lowercase letters, digits and dashes');
    } else if (homes.sites.has(site.id)) {
      fail(at, `duplicate site id "${site.id}"`);
    } else {
      homes.sites.set(site.id, { district: home, map: site.map });
      own.sites.add(site.id);
    }
    if (!isText(site.name) || !isText(site.blurb)) fail(at, 'name and blurb must be non-empty strings');
    if (!maps.has(site.map)) fail(at, `unknown or broken map "${site.map}" (sites.json)`);
  }
}

// A district's shop (src/sim/economy.js): its name, the client who runs
// it, the words on its screen, how many parts it has for sale at a time,
// and the table they are picked from, with enough parts in it to fill a
// stock.
function checkShop(shop, where, clients, moduleIds, weaponIds, fail) {
  if (!isObject(shop)) {
    fail(where, 'must be { name, dealer, pitch, size, parts }');
    return;
  }
  knownKeys(shop, SHOP_KEYS, where, fail);
  if (!isText(shop.name) || !isText(shop.pitch)) fail(where, 'name and pitch must be non-empty strings');
  if (!clients.has(shop.dealer)) fail(where, `dealer "${shop.dealer}" isn't one of the district's clients`);
  checkTable(shop.parts, `${where} parts`, moduleIds, fail);
  if (!isIntIn(shop.size, 1, MAX_STOCK)) fail(where, `size must be a whole number from 1 to ${MAX_STOCK}`);
  else if (isObject(shop.parts) && shop.size > Object.keys(shop.parts).length) fail(where, `a stock of ${shop.size} needs as many different parts in its table`);
  // Weapons (M37): armsSize of them with each stock, from its own table.
  if ((shop.arms === undefined) !== (shop.armsSize === undefined)) fail(where, 'armsSize and arms come together');
  if (shop.armsSize !== undefined) {
    if (!isIntIn(shop.armsSize, 1, MAX_STOCK - (shop.size ?? 0))) fail(where, `armsSize must be a whole number from 1 to ${MAX_STOCK - (shop.size ?? 0)}, with its parts no more than ${MAX_STOCK}`);
    checkArms(shop.arms, `${where} arms`, weaponIds, shop.armsSize, fail);
  }
}

// The backgrounds: who the player was, the pursuer after them, the words
// as they lift off, their district, and what a campaign from it starts
// with: credits, parts held, the crew by job, and the ship as a script of
// placements (tools/build-ship.js).
function checkBackgrounds(file, { districts }, { jobIds, enemyIds, moduleIds, frameById, encounters, presets = new Map(), sides }, fail) {
  const backgrounds = listOf(file, 'backgrounds', 'backgrounds.json', fail);
  uniqueIds(backgrounds, 'backgrounds.json', fail);
  if (!backgrounds.length) fail('backgrounds.json', 'needs at least one background');
  const scripts = [];
  backgrounds.forEach((background, i) => {
    const where = `backgrounds.json ${background.id ?? `#${i}`}`;
    knownKeys(background, BACKGROUND_KEYS, where, fail);
    if (!isText(background.name) || !isText(background.blurb)) fail(where, 'name and blurb must be non-empty strings');
    checkPursuer(background.pursuer, `${where} pursuer`, { enemyIds, encounters, presets, sides }, fail);
    if (!isListIn(background.captains, 1, MAX_CAPTAINS) || !background.captains.every((name) => isText(name) && name.trim().length <= MAX_NAME)) {
      fail(where, `captains must be a list of 1 to ${MAX_CAPTAINS} names of up to ${MAX_NAME} letters`);
    }
    const { launch } = background;
    if (!isObject(launch)) fail(`${where} launch`, 'must be { text, escaped }');
    else {
      knownKeys(launch, LAUNCH_KEYS, `${where} launch`, fail);
      if (!LAUNCH_KEYS.every((key) => isText(launch[key]))) fail(`${where} launch`, 'text and escaped must be non-empty strings');
    }
    if (!districts.has(background.district)) fail(where, `unknown district "${background.district}"`);
    const script = checkStart(background.start, `${where} start`, { jobIds, moduleIds, frameById }, fail);
    if (script) scripts.push([`${where} start.ship`, script]);
  });
  return scripts;
}

// The pursuer: who they are and the side they are on (M33: a campaign
// starts hostile with it), their words for each level of heat, the hunters
// they send along on jobs once heat is high, the encounter they raid the
// hangar with, the payment that buys some heat off (none for a pursuer that
// takes no payments, M30), and how they hunt the ship on the run.
function checkPursuer(pursuer, where, { enemyIds, encounters, presets, sides }, fail) {
  if (!isObject(pursuer)) {
    fail(where, 'must be { name, side, blurb, levels, hunters, raiders, payment?, run, colony }');
    return;
  }
  if (!sides.has(pursuer.side)) fail(where, 'side must be one of the sides in factions.json: the one a campaign starts hostile with');
  checkRun(pursuer.run, `${where} run`, presets, pursuer.side, fail);
  checkPursuerColony(pursuer.colony, `${where} colony`, encounters, fail);
  knownKeys(pursuer, PURSUER_KEYS, where, fail);
  if (!isText(pursuer.name) || !isText(pursuer.blurb)) fail(where, 'name and blurb must be non-empty strings');
  const { levels } = pursuer;
  if (!isObject(levels) || Object.keys(levels).length !== HEAT_LEVELS.length || !HEAT_LEVELS.every((level) => isText(levels[level]))) {
    fail(where, `levels must say something for each of ${HEAT_LEVELS.join(', ')}`);
  }
  if (!isListIn(pursuer.hunters, 1, MAX_HUNTERS) || !pursuer.hunters.every((id) => enemyIds.has(id))) fail(where, `hunters must be a list of 1 to ${MAX_HUNTERS} enemies`);
  const raiders = encounters.get(pursuer.raiders);
  if (!raiders) fail(where, `unknown raiders encounter "${pursuer.raiders}"`);
  else if (raiders.length > MAX_RAIDERS) fail(where, `a raid of ${raiders.length}: the hangar's doors take ${MAX_RAIDERS}`);
  const { payment } = pursuer;
  if (payment === undefined) return;
  if (!isObject(payment)) {
    fail(where, 'payment must be { name, text, credits, heat }, or left out for a pursuer that takes none');
    return;
  }
  knownKeys(payment, PAYMENT_KEYS, `${where} payment`, fail);
  if (!isText(payment.name) || !isText(payment.text)) fail(`${where} payment`, 'name and text must be non-empty strings');
  if (!isIntIn(payment.credits, PAY_STEP, MAX_CREDITS) || payment.credits % PAY_STEP) fail(`${where} payment`, `credits must be a multiple of ${PAY_STEP} from ${PAY_STEP} to ${MAX_CREDITS}`);
  if (!isIntIn(payment.heat, 1, 100)) fail(`${where} payment`, 'heat must be a whole number from 1 to 100');
}

// The pursuer on the run (act 2, src/sim/hunt.js): its words for each of
// the run's levels of heat, the ship presets its hunters and its task force
// fly (each with tactics for the approach and a party to board with, and on
// the pursuer's side), and its words once they have been faced.
function checkRun(run, where, presets, side, fail) {
  if (!isObject(run)) {
    fail(where, 'must be { levels, hunters, taskForce, faced }');
    return;
  }
  knownKeys(run, RUN_KEYS, where, fail);
  const { levels } = run;
  if (!isObject(levels) || Object.keys(levels).length !== RUN_LEVELS.length || !RUN_LEVELS.every((level) => isText(levels[level]))) {
    fail(where, `levels must say something for each of ${RUN_LEVELS.join(', ')}`);
  }
  for (const key of ['hunters', 'taskForce']) {
    const preset = presets.get(run[key]);
    if (!preset) fail(where, `${key}: unknown ship preset "${run[key]}"`);
    else if (!preset.tactics || !preset.party) fail(where, `${key}: the ${preset.name} needs tactics for the approach and a party for the boardings`);
    else if (preset.side !== side) fail(where, `${key}: the ${preset.name} must be on the pursuer's side, "${side}" (ships.json side)`);
  }
  if (!isText(run.faced)) fail(where, 'faced must be a non-empty string');
}

// The pursuer at the colony (act 3, src/sim/raids.js): its words for each
// of the run's levels of heat, the encounter its lander brings down (the
// raiders, at the colony grid's far edge), and its words as it finds the
// colony, as the lander comes down and once a raid has been faced.
function checkPursuerColony(colony, where, encounters, fail) {
  if (!isObject(colony)) {
    fail(where, `must be { ${COLONY_KEYS.join(', ')} }`);
    return;
  }
  knownKeys(colony, COLONY_KEYS, where, fail);
  const { levels } = colony;
  if (!isObject(levels) || Object.keys(levels).length !== RUN_LEVELS.length || !RUN_LEVELS.every((level) => isText(levels[level]))) {
    fail(where, `levels must say something for each of ${RUN_LEVELS.join(', ')}`);
  }
  const raiders = encounters.get(colony.raiders);
  if (!raiders) fail(where, `unknown raiders encounter "${colony.raiders}"`);
  else if (raiders.length > MAX_RAIDERS) fail(where, `a raid of ${raiders.length}: a lander brings ${MAX_RAIDERS} at most`);
  for (const key of ['found', 'landing', 'faced']) {
    if (!isText(colony[key])) fail(where, `${key} must be a non-empty string`);
  }
}

// Returns the start's ship script if it is well formed, else null.
function checkStart(start, where, { jobIds, moduleIds, frameById }, fail) {
  if (!isObject(start)) {
    fail(where, 'must be { credits, parts, crew, ship }');
    return null;
  }
  knownKeys(start, START_KEYS, where, fail);
  if (!isIntIn(start.credits, 0, Infinity)) fail(where, 'credits must be a whole number, 0 or more');
  if (!isObject(start.parts)) {
    fail(where, 'parts must be an object of module types and counts');
  } else {
    for (const [type, count] of Object.entries(start.parts)) {
      if (!moduleIds.has(type)) fail(`${where}.parts`, `unknown module "${type}"`);
      if (!isIntIn(count, 1, Infinity)) fail(`${where}.parts`, `${type} must be a whole number, 1 or more`);
    }
  }
  if (!isListIn(start.crew, 1, MAX_SQUAD)) fail(where, `crew must be a list of 1 to ${MAX_SQUAD} crew jobs`);
  else for (const id of start.crew) if (!jobIds.has(id)) fail(`${where}.crew`, `unknown job "${id}"`);

  const script = start.ship;
  const at = `${where}.ship`;
  if (!isObject(script) || !Array.isArray(script.placements)) {
    fail(at, 'must be { frame, placements: [{ type, x, y, rot }] }');
    return null;
  }
  knownKeys(script, SCRIPT_KEYS, at, fail);
  let readable = frameById.has(script.frame);
  if (!readable) fail(at, `unknown frame "${script.frame}"`);
  script.placements.forEach((placement, i) => {
    const ok = isObject(placement) && Object.keys(placement).every((key) => PLACEMENT_KEYS.includes(key)) && moduleIds.has(placement.type) &&
      Number.isInteger(placement.x) && Number.isInteger(placement.y) && [0, 1, 2, 3].includes(placement.rot);
    if (!ok) {
      fail(at, `placement ${i + 1} must be { type, x, y, rot } with a known module, whole numbers and a quarter turn`);
      readable = false;
    }
  });
  return readable ? script : null;
}

// The jobs (contracts.js): the board's size and how often a job comes with
// a twist; the missions the rules know, each with a brief; the twists; and
// the jobs themselves, each a mission at its sites for its clients, all in
// one district or all at the stations (M38c), against an encounter that
// fits every site's spawn tiles (with any twist's extra enemy, and at a
// district the pursuer's hunters), for credits in steps of PAY_STEP and
// maybe a part from its drop table.
function checkContracts(file, { districts, sites, clientSides }, maps, { moduleIds, encounters, hunters, sides, crew = 0, stationBoard = 0 }, fail) {
  const where = 'contracts.json';
  if (!isObject(file)) {
    fail(where, 'must be an object with the board, missions, twists and jobs');
    return;
  }
  knownKeys(file, CONTRACTS_KEYS, where, fail);
  if (!isIntIn(file.boardSize, 1, MAX_BOARD)) fail(where, `boardSize must be a whole number from 1 to ${MAX_BOARD}`);
  if (!isIntIn(file.twistChance, 0, 100)) fail(where, 'twistChance must be a whole number from 0 to 100');

  const missions = listOf(file, 'missions', where, fail);
  const missionIds = uniqueIds(missions, `${where} missions`, fail);
  missions.forEach((mission, i) => {
    const at = `${where} mission ${mission.id ?? `#${i}`}`;
    knownKeys(mission, MISSION_KEYS, at, fail);
    if (!MISSIONS.includes(mission.id)) fail(at, `unknown mission: the rules know ${MISSIONS.join(', ')}`);
    if (!isText(mission.name)) fail(at, 'name must be a non-empty string');
    if (mission.loud !== undefined && typeof mission.loud !== 'boolean') fail(at, 'loud must be true or false');
    checkWords(mission.brief, BRIEF_WORDS[mission.id] ?? [], `${at} brief`, fail);
  });

  const people = listOf(file, 'people', where, fail);
  const personIds = uniqueIds(people, `${where} people`, fail);
  for (const id of PEOPLE) if (!personIds.has(id)) fail(`${where} people`, `needs "${id}", whom the rules bring out`);
  people.forEach((person, i) => {
    const at = `${where} person ${person.id ?? `#${i}`}`;
    knownKeys(person, PERSON_KEYS, at, fail);
    if (!PEOPLE.includes(person.id)) fail(at, `unknown person: the rules bring out ${PEOPLE.join(' and ')}`);
    if (!isText(person.name)) fail(at, 'name must be a non-empty string');
    for (const [key, [min, max]] of Object.entries(PERSON_NUMBERS)) {
      if (!isIntIn(person[key], min, max)) fail(at, `${key} must be a whole number from ${min} to ${max}`);
    }
    for (const problem of lookProblems(person.look)) fail(at, problem);
  });

  const twists = listOf(file, 'twists', where, fail);
  uniqueIds(twists, `${where} twists`, fail);
  twists.forEach((twist, i) => {
    const at = `${where} twist ${twist.id ?? `#${i}`}`;
    knownKeys(twist, TWIST_KEYS, at, fail);
    if (!isText(twist.name)) fail(at, 'name must be a non-empty string');
    for (const [key, [min, max]] of Object.entries(TWIST_NUMBERS)) {
      if (twist[key] !== undefined && !isIntIn(twist[key], min, max)) fail(at, `${key} must be a whole number from ${min} to ${max}`);
    }
    if (twist.enemies === 0 || twist.pay === 0) fail(at, 'enemies and pay, where set, change something');
    if (twist.hazard !== undefined && !HAZARDS.includes(twist.hazard)) fail(at, `hazard must be one of ${HAZARDS.join(', ')}`);
    if ((twist.hazard === undefined) !== (twist.patches === undefined)) fail(at, 'a hazard comes with its patches, and patches with a hazard');
    if (twist.loud !== undefined && typeof twist.loud !== 'boolean') fail(at, 'loud must be true or false');
    if (!['enemies', 'hazard', 'sight', 'deadline', 'pay'].some((key) => twist[key] !== undefined)) fail(at, 'does nothing: set enemies, a hazard, sight, a deadline or pay');
    if (twist.missions !== undefined && (!isListIn(twist.missions, 1, MISSIONS.length) || !twist.missions.every((id) => missionIds.has(id)) || new Set(twist.missions).size !== twist.missions.length)) {
      fail(at, 'missions must be a list of the missions it can come with');
    }
    checkWords(twist.text, ['deadline', 'sight'].filter((key) => twist[key] !== undefined), `${at} text`, fail);
  });

  const jobs = listOf(file, 'jobs', where, fail);
  uniqueIds(jobs, `${where} jobs`, fail);
  const perDistrict = new Map();
  jobs.forEach((job, i) => {
    const at = `${where} job ${job.id ?? `#${i}`}`;
    knownKeys(job, JOB_KEYS, at, fail);
    if (!isText(job.title)) fail(at, 'title must be a non-empty string');
    if (!missionIds.has(job.mission)) fail(at, `unknown mission "${job.mission}"`);
    const needs = MISSION_NEEDS[job.mission] ?? {};
    for (const key of MISSION_NUMBERS) {
      if (needs[key]) {
        const [min, max] = needs[key];
        if (!isIntIn(job[key], min, max)) fail(at, `a ${job.mission} job needs ${key}, a whole number from ${min} to ${max}`);
      } else if (job[key] !== undefined) {
        const missions = Object.keys(MISSION_NEEDS).filter((id) => MISSION_NEEDS[id][key]);
        fail(at, `${key} is only for ${missions.join(' and ')} jobs`);
      }
    }
    if (job.mission === 'rescue' && !(isText(job.captive) && job.captive.length <= CAPTIVE_NAME)) fail(at, `a rescue job needs its captive's name, up to ${CAPTIVE_NAME} letters`);
    if (job.mission !== 'rescue' && job.captive !== undefined) fail(at, 'captive is only for rescue jobs');
    // Where: its sites, all in one district with its clients.
    const homes = new Set();
    if (!isListIn(job.sites, 1, Infinity)) {
      fail(at, 'sites must be a list of sites');
    } else {
      for (const id of job.sites) {
        if (sites.has(id)) homes.add(sites.get(id).district);
        else fail(at, `unknown site "${id}"`);
      }
    }
    const [home] = homes;
    const station = homes.size === 1 && home === STATIONS;
    if (homes.size > 1) fail(at, 'its sites must all be in one district, or all at the stations');
    if (!isListIn(job.clients, 1, Infinity)) fail(at, 'clients must be a list of clients');
    else if (home) for (const id of job.clients) if (!districts.get(home)?.clients.has(id)) fail(at, `client "${id}" isn't ${station ? "one of the stations' (docks.json)" : "in its sites' district"}`);
    if (homes.size === 1 && job.quest === undefined) perDistrict.set(home, (perDistrict.get(home) ?? 0) + 1);
    if (job.quest !== undefined && !isText(job.quest)) fail(at, 'quest must be the id of the quest whose step it is');
    if (station && (job.quest !== undefined || job.once !== undefined)) fail(at, "a station's job comes back with every board: it can't be a quest's or done once");
    if (new Set(job.sites).size !== job.sites?.length || new Set(job.clients).size !== job.clients?.length) fail(at, 'sites and clients are listed once each');
    // The side its enemies are on (M33): never a side one of its clients
    // works for.
    if (job.against !== undefined) {
      if (!sides.has(job.against)) fail(at, `against: unknown side "${job.against}" (factions.json)`);
      else if (Array.isArray(job.clients) && job.clients.some((id) => clientSides.get(id) === job.against)) fail(at, `is against ${job.against}, the side one of its clients works for`);
    }
    // Who: the encounter, at its biggest with a twist, fits every site.
    const enemies = encounters.get(job.encounter);
    if (!enemies) fail(at, `unknown encounter "${job.encounter}"`);
    else if (Array.isArray(job.sites)) {
      const extra = Math.max(0, ...twists.filter((t) => !t.missions || t.missions.includes(job.mission)).map((t) => (isIntIn(t.enemies, -2, 2) ? t.enemies : 0)));
      for (const id of job.sites) {
        const marks = maps.get(sites.get(id)?.map);
        if (!marks) continue;
        // No hunters join a station's job (M38c).
        const most = enemies.length + extra + (station ? 0 : hunters);
        if (most > marks.spawn) fail(at, `${most} enemies with a twist and the hunters, but ${id}'s map has ${marks.spawn} spawn tiles`);
        if (MAX_SQUAD > marks.entry) fail(at, `${id}'s map has ${marks.entry} ways in for a squad of up to ${MAX_SQUAD}`);
        if ((job.mission === 'grab' || job.mission === 'extract') && job.crates > marks.loot) fail(at, `${job.crates} crates, but ${id}'s map has ${marks.loot}`);
        if (job.mission === 'sabotage' && job.targets > marks.loot) fail(at, `${job.targets} targets, but ${id}'s map has ${marks.loot} tagged crates`);
        if (job.mission === 'hack' && !marks.terminal) fail(at, `${id}'s map has no terminal`);
        if (job.mission === 'escort' && !marks.exit) fail(at, `${id}'s map has no far gate`);
        if (job.mission === 'escort' && crew + 1 > marks.entry) fail(at, `${id}'s map has ${marks.entry} ways in for a crew of ${crew} and the client`);
        if (job.mission === 'rescue' && !marks.captive) fail(at, `${id}'s map has nowhere to hold a captive`);
      }
    }
    // The pay.
    if (!isRange(job.credits, 0, MAX_CREDITS) || job.credits.some((n) => n % PAY_STEP)) {
      fail(at, `credits must be [least, most], multiples of ${PAY_STEP} from 0 to ${MAX_CREDITS}`);
    }
    if (job.drops !== undefined) {
      if (!isObject(job.drops)) {
        fail(at, 'drops must be { chance, parts }, or left out for no part');
      } else {
        knownKeys(job.drops, DROPS_KEYS, `${at} drops`, fail);
        if (!isIntIn(job.drops.chance, 1, 100)) fail(`${at} drops`, 'chance must be a whole number from 1 to 100');
        checkTable(job.drops.parts, `${at} drops parts`, moduleIds, fail);
      }
    }
    if (job.once !== undefined && typeof job.once !== 'boolean') fail(at, 'once must be true or false');
    checkWords(job.pitch, station ? STATION_PITCH_WORDS : PITCH_WORDS, `${at} pitch`, fail);
  });
  for (const id of districts.keys()) {
    if (id === STATIONS) continue;
    const count = perDistrict.get(id) ?? 0;
    // A new board offers none of the old board's jobs, and a job done once
    // never comes back.
    const lasting = jobs.filter((job) => job.once !== true && job.quest === undefined && Array.isArray(job.sites) && job.sites.every((site) => districts.get(id)?.sites.has(site))).length;
    if (isIntIn(file.boardSize, 1, MAX_BOARD) && lasting < 2 * file.boardSize) {
      fail(where, `district "${id}" has ${lasting} jobs that come back${lasting < count ? ` (of ${count})` : ''}: a board of ${file.boardSize} needs ${2 * file.boardSize}, as each board offers none of the last one's`);
    }
  }
  // Each side's stations, and nobody's, post the jobs their clients offer
  // (M38c): at least twice a board's, so that one visit's board needn't be
  // the last one's.
  const docks = districts.get(STATIONS);
  if (!docks || !stationBoard) return;
  const atStations = jobs.filter((job) => isListIn(job.sites, 1, Infinity) && job.sites.every((site) => docks.sites.has(site)) && Array.isArray(job.clients));
  for (const side of [...sides, null]) {
    const count = atStations.filter((job) => job.clients.some((id) => docks.clients.has(id) && (clientSides.get(id) ?? null) === side)).length;
    if (count < 2 * stationBoard) fail('docks.json', `${side ? `the stations of side "${side}"` : "nobody's stations"} have ${count} jobs to post: a board of ${stationBoard} needs ${2 * stationBoard}`);
  }
}

// A drop table (drops.js): known module types, each with a whole-number
// weight, at least one.
export function checkTable(table, where, moduleIds, fail) {
  if (!isObject(table) || !Object.keys(table).length) {
    fail(where, 'must be an object of module types and weights, with at least one');
    return;
  }
  for (const [type, weight] of Object.entries(table)) {
    if (!moduleIds.has(type)) fail(where, `unknown module "${type}"`);
    if (!isIntIn(weight, 1, MAX_WEIGHT)) fail(where, `${type}'s weight must be a whole number from 1 to ${MAX_WEIGHT}`);
  }
}

// A text for the player, using only the {words} allowed.
function checkWords(text, allowed, where, fail) {
  if (!isText(text)) {
    fail(where, 'must be a non-empty string');
    return;
  }
  for (const [, word] of text.matchAll(/\{([^}]*)\}/g)) {
    if (!allowed.includes(word)) fail(where, `"{${word}}" can't be filled in${allowed.length ? `: use ${allowed.map((w) => `{${w}}`).join(', ')}` : ''}`);
  }
}
