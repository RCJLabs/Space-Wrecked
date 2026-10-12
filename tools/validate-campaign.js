// The campaign's content, for validate-data.js: its acts (campaign.json),
// act 2's sectors (sectors.json, validate-sectors.js), the backgrounds a
// campaign starts from (backgrounds.json), act 1's
// districts with their clients and job sites (districts.json), the sites'
// map templates (sites.json) and the jobs (contracts.json).
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { ACTS, MAX_NAME } from '../src/sim/campaign.js';
import { MISSIONS } from '../src/sim/contracts.js';
import { MAX_STOCK, PAY_STEP } from '../src/sim/economy.js';
import { indexDefs } from '../src/sim/defs.js';
import { HAZARDS, siteMarks, siteProblems } from '../src/sim/gen/site.js';
import { isId, isIntIn, isListIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';
import { checkSectors } from './validate-sectors.js';

const CAMPAIGN_KEYS = ['acts'];
const ACT_KEYS = ['act', 'name', 'hub', 'home', 'heals', 'liftOff', 'sectors', 'stub'];
// A run (act 2) crosses up to this many sectors.
const MAX_SECTORS = 20;
// Lifting off takes thrust for each unit of mass: up to this many.
const MAX_LIFT_OFF = 4;
const BACKGROUND_KEYS = ['id', 'name', 'blurb', 'pursuer', 'launch', 'captains', 'district', 'start'];
// Names the captain's name field offers, each a name a captain can have.
const MAX_CAPTAINS = 20;
// The words as the ship lifts off (launch.js), and the pursuer's when it
// lifts off with a raid at the door.
const LAUNCH_KEYS = ['text', 'escaped'];
const PURSUER_KEYS = ['name', 'blurb', 'levels', 'hunters', 'raiders', 'payment'];
// Heat's levels (src/sim/heat.js), each with the pursuer's words for it.
const HEAT_LEVELS = ['calm', 'rumors', 'hunters', 'raid'];
const PAYMENT_KEYS = ['name', 'text', 'credits', 'heat'];
const MAX_HUNTERS = 2;
// A raid's raiders, at the hangar's doors (hangarMap.js).
const MAX_RAIDERS = 8;
const START_KEYS = ['credits', 'parts', 'crew', 'ship'];
const SCRIPT_KEYS = ['frame', 'placements'];
const PLACEMENT_KEYS = ['type', 'x', 'y', 'rot'];
const DISTRICT_KEYS = ['id', 'name', 'blurb', 'clients', 'sites', 'shop'];
const SHOP_KEYS = ['name', 'dealer', 'pitch', 'size', 'parts'];
const CLIENT_KEYS = ['id', 'name', 'title', 'blurb'];
const SITE_KEYS = ['id', 'name', 'map', 'blurb'];
const MAP_KEYS = ['id', 'name', 'rows'];
const CONTRACTS_KEYS = ['boardSize', 'twistChance', 'missions', 'twists', 'jobs'];
const MISSION_KEYS = ['id', 'name', 'brief', 'loud'];
const TWIST_KEYS = ['id', 'name', 'text', 'enemies', 'hazard', 'patches', 'sight', 'deadline', 'pay', 'missions', 'loud'];
const JOB_KEYS = ['id', 'title', 'mission', 'crates', 'turns', 'clients', 'sites', 'encounter', 'credits', 'drops', 'once', 'pitch'];
const DROPS_KEYS = ['chance', 'parts'];
// A drop table's weights (drops.js): whole numbers up to this.
const MAX_WEIGHT = 100;
// A twist's numbers, each one's allowed range. A twist sets at least one
// of them, or a hazard.
const TWIST_NUMBERS = { enemies: [-2, 2], patches: [1, 2], sight: [2, 20], deadline: [3, 30], pay: [-90, 200] };
// What each mission needs of a job, and its range: grab the crates to
// grab, hack the turns of work on the terminal.
const MISSION_NEEDS = { grab: ['crates', 1, 3], hack: ['turns', 1, 5] };
// The {words} each text may use, filled in when it is shown.
const BRIEF_WORDS = { clear: [], grab: ['crates'], hack: ['turns'] };
const PITCH_WORDS = ['client', 'site'];
// Everyone aboard fights, so a starting crew is a squad's size.
const MAX_SQUAD = 5;
const MAX_BOARD = 5;
const MAX_CREDITS = 9995;

// Checks every campaign file. ids: the content the campaign refers to, as
// { jobIds, moduleIds, frameById, encounters (id -> enemy list) }. Returns
// the starting ships that are well formed, as [where, script], for
// checkStartShips.
export function checkCampaignFiles(data, ids, fail) {
  checkActs(data.campaign, fail);
  checkSectors(data.sectors, data.campaign?.acts, fail);
  const maps = checkSiteMaps(data.sites, fail);
  const districts = checkDistricts(data.districts, maps, ids, fail);
  const scripts = checkBackgrounds(data.backgrounds, districts, ids, fail);
  // Hunters join every job's fight once heat is high enough.
  const hunters = Math.max(0, ...(data.backgrounds?.backgrounds ?? []).map((b) => (Array.isArray(b?.pursuer?.hunters) ? b.pursuer.hunters.length : 0)));
  checkContracts(data.contracts, districts, maps, { ...ids, hunters }, fail);
  return scripts;
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
    if (act.sectors !== undefined && !isIntIn(act.sectors, 1, MAX_SECTORS)) fail(at, `sectors must be a whole number from 1 to ${MAX_SECTORS}`);
    if (act.stub !== undefined && !isText(act.stub)) fail(at, 'stub must be a non-empty string');
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
// across districts, so a job can name them alone. Returns { districts:
// id -> { clients, sites }, sites: id -> { district, map } }.
function checkDistricts(file, maps, { moduleIds }, fail) {
  const districts = listOf(file, 'districts', 'districts.json', fail);
  uniqueIds(districts, 'districts.json', fail);
  const byId = new Map();
  const sites = new Map();
  const clients = new Set();
  districts.forEach((district, i) => {
    const where = `districts.json ${district.id ?? `#${i}`}`;
    knownKeys(district, DISTRICT_KEYS, where, fail);
    if (!isText(district.name) || !isText(district.blurb)) fail(where, 'name and blurb must be non-empty strings');
    const own = { clients: new Set(), sites: new Set() };
    for (const client of listOf(district, 'clients', where, fail)) {
      const at = `${where} client ${client.id ?? '?'}`;
      knownKeys(client, CLIENT_KEYS, at, fail);
      if (!isId(client.id)) {
        fail(at, 'id must be lowercase letters, digits and dashes');
      } else if (clients.has(client.id)) {
        fail(at, `duplicate client id "${client.id}"`);
      } else {
        clients.add(client.id);
        own.clients.add(client.id);
      }
      if (!isText(client.name) || !isText(client.title) || !isText(client.blurb)) fail(at, 'name, title and blurb must be non-empty strings');
    }
    for (const site of listOf(district, 'sites', where, fail)) {
      const at = `${where} site ${site.id ?? '?'}`;
      knownKeys(site, SITE_KEYS, at, fail);
      if (!isId(site.id)) {
        fail(at, 'id must be lowercase letters, digits and dashes');
      } else if (sites.has(site.id)) {
        fail(at, `duplicate site id "${site.id}"`);
      } else {
        sites.set(site.id, { district: district.id, map: site.map });
        own.sites.add(site.id);
      }
      if (!isText(site.name) || !isText(site.blurb)) fail(at, 'name and blurb must be non-empty strings');
      if (!maps.has(site.map)) fail(at, `unknown or broken map "${site.map}" (sites.json)`);
    }
    if (!own.clients.size || !own.sites.size) fail(where, 'needs at least one client and one site');
    if (district.shop !== undefined) checkShop(district.shop, `${where} shop`, own.clients, moduleIds, fail);
    if (isId(district.id)) byId.set(district.id, own);
  });
  return { districts: byId, sites };
}

// A district's shop (src/sim/economy.js): its name, the client who runs
// it, the words on its screen, how many parts it has for sale at a time,
// and the table they are picked from, with enough parts in it to fill a
// stock.
function checkShop(shop, where, clients, moduleIds, fail) {
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
}

// The backgrounds: who the player was, the pursuer after them, the words
// as they lift off, their district, and what a campaign from it starts
// with: credits, parts held, the crew by job, and the ship as a script of
// placements (tools/build-ship.js).
function checkBackgrounds(file, { districts }, { jobIds, enemyIds, moduleIds, frameById, encounters }, fail) {
  const backgrounds = listOf(file, 'backgrounds', 'backgrounds.json', fail);
  uniqueIds(backgrounds, 'backgrounds.json', fail);
  if (!backgrounds.length) fail('backgrounds.json', 'needs at least one background');
  const scripts = [];
  backgrounds.forEach((background, i) => {
    const where = `backgrounds.json ${background.id ?? `#${i}`}`;
    knownKeys(background, BACKGROUND_KEYS, where, fail);
    if (!isText(background.name) || !isText(background.blurb)) fail(where, 'name and blurb must be non-empty strings');
    checkPursuer(background.pursuer, `${where} pursuer`, { enemyIds, encounters }, fail);
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

// The pursuer: who they are, their words for each level of heat, the
// hunters they send along on jobs once heat is high, the encounter they
// raid the hangar with, and the payment that buys some heat off.
function checkPursuer(pursuer, where, { enemyIds, encounters }, fail) {
  if (!isObject(pursuer)) {
    fail(where, 'must be { name, blurb, levels, hunters, raiders, payment }');
    return;
  }
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
  if (!isObject(payment)) {
    fail(where, 'payment must be { name, text, credits, heat }');
    return;
  }
  knownKeys(payment, PAYMENT_KEYS, `${where} payment`, fail);
  if (!isText(payment.name) || !isText(payment.text)) fail(`${where} payment`, 'name and text must be non-empty strings');
  if (!isIntIn(payment.credits, PAY_STEP, MAX_CREDITS) || payment.credits % PAY_STEP) fail(`${where} payment`, `credits must be a multiple of ${PAY_STEP} from ${PAY_STEP} to ${MAX_CREDITS}`);
  if (!isIntIn(payment.heat, 1, 100)) fail(`${where} payment`, 'heat must be a whole number from 1 to 100');
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
// one district, against an encounter that fits every site's spawn tiles
// (with any twist's extra enemy), for credits in steps of PAY_STEP and
// maybe a part from its drop table.
function checkContracts(file, { districts, sites }, maps, { moduleIds, encounters, hunters }, fail) {
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
    for (const [mission, [key, min, max]] of Object.entries(MISSION_NEEDS)) {
      if (job.mission === mission && !isIntIn(job[key], min, max)) fail(at, `a ${mission} job needs ${key}, a whole number from ${min} to ${max}`);
      if (job.mission !== mission && job[key] !== undefined) fail(at, `${key} is only for ${mission} jobs`);
    }
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
    if (homes.size > 1) fail(at, 'its sites must all be in one district');
    if (!isListIn(job.clients, 1, Infinity)) fail(at, 'clients must be a list of clients');
    else if (home) for (const id of job.clients) if (!districts.get(home)?.clients.has(id)) fail(at, `client "${id}" isn't in its sites' district`);
    if (homes.size === 1) perDistrict.set(home, (perDistrict.get(home) ?? 0) + 1);
    if (new Set(job.sites).size !== job.sites?.length || new Set(job.clients).size !== job.clients?.length) fail(at, 'sites and clients are listed once each');
    // Who: the encounter, at its biggest with a twist, fits every site.
    const enemies = encounters.get(job.encounter);
    if (!enemies) fail(at, `unknown encounter "${job.encounter}"`);
    else if (Array.isArray(job.sites)) {
      const extra = Math.max(0, ...twists.filter((t) => !t.missions || t.missions.includes(job.mission)).map((t) => (isIntIn(t.enemies, -2, 2) ? t.enemies : 0)));
      for (const id of job.sites) {
        const marks = maps.get(sites.get(id)?.map);
        if (!marks) continue;
        const most = enemies.length + extra + hunters;
        if (most > marks.spawn) fail(at, `${most} enemies with a twist and the hunters, but ${id}'s map has ${marks.spawn} spawn tiles`);
        if (MAX_SQUAD > marks.entry) fail(at, `${id}'s map has ${marks.entry} ways in for a squad of up to ${MAX_SQUAD}`);
        if (job.mission === 'grab' && job.crates > marks.loot) fail(at, `${job.crates} crates, but ${id}'s map has ${marks.loot}`);
        if (job.mission === 'hack' && !marks.terminal) fail(at, `${id}'s map has no terminal`);
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
    checkWords(job.pitch, PITCH_WORDS, `${at} pitch`, fail);
  });
  for (const id of districts.keys()) {
    const count = perDistrict.get(id) ?? 0;
    // A new board offers none of the old board's jobs, and a job done once
    // never comes back.
    const lasting = jobs.filter((job) => job.once !== true && Array.isArray(job.sites) && job.sites.every((site) => districts.get(id)?.sites.has(site))).length;
    if (isIntIn(file.boardSize, 1, MAX_BOARD) && lasting < 2 * file.boardSize) {
      fail(where, `district "${id}" has ${lasting} jobs that come back${lasting < count ? ` (of ${count})` : ''}: a board of ${file.boardSize} needs ${2 * file.boardSize}, as each board offers none of the last one's`);
    }
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
