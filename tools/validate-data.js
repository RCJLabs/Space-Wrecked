#!/usr/bin/env node
// Checks the content files in data/: required fields, types, ranges and
// cross-references. Adding content never needs an engine edit, so mistakes
// in it have to be caught here instead.
//
//   node tools/validate-data.js
import { pathToFileURL } from 'node:url';
import { heldProblems, lookProblems } from '../src/render/figures/looks.js';
import { MARKED } from '../src/render/exterior.js';
import { hullStyleProblems } from '../src/render/hullShape.js';
import { paints as PAINT_COLORS, skins as SKINS, trims as TRIM_COLORS } from '../src/render/palette.js';
import { MODELED } from '../src/render/pieces.js';
import { AIMS } from '../src/sim/approach.js';
import { DEFAULT_HULL, DEFAULT_PAINT, DEFAULT_TRIM } from '../src/sim/builder.js';
import { CAPTAIN_TRAITS } from '../src/sim/campaign.js';
import { REQUIRED_TAGS } from '../src/sim/constraints.js';
import { withBases } from '../src/sim/defs.js';
import { COLONY_EFFECTS, STATION_EFFECTS } from '../src/sim/edges.js';
import { SITE_CHARS } from '../src/sim/gen/site.js';
import { ORDER_KINDS } from '../src/sim/orders.js';
import { jobAtRank, RANK_LAYERS } from '../src/sim/ranks.js';
import { TRAIT_STATS } from '../src/sim/traits.js';
import { TIP_IDS } from '../src/ui/tipSteps.js';
import { isId, isIntIn, isListIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';
import { readData } from './data.js';
import { checkCampaignFiles, checkStartShips } from './validate-campaign.js';
import { checkFactions } from './validate-factions.js';

const SIDES = ['n', 'e', 's', 'w'];
const STATS = ['power', 'mass', 'thrust', 'berths', 'lifeSupport', 'cargo', 'hp'];
const MODULE_KEYS = ['id', 'base', 'name', 'glyph', 'category', 'manufacturer', 'size', 'rotates', 'facesSpace', 'stats', 'tags', 'damage', 'shield', 'intercept', 'interior', 'cost', 'heal'];
// A maker's version of a part (M23g) holds only what it changes; the rest
// comes from its base part (src/sim/defs.js withBases).
const VERSION_KEYS = ['id', 'base', 'manufacturer', 'name', 'stats', 'cost'];
// A manufacturer: its name, a short one for the drawer's maker buttons, and
// maybe a line for its parts' cards and the mark on its parts' roofs
// outside (exterior.js draws the marks; its skin is in palette.js).
const MAKER_KEYS = ['id', 'name', 'short', 'blurb', 'mark'];
const MAX_MAKER_SHORT = 9;
// What a med bay heals each of the wounded in a jump (medbay.js): up to this.
const MAX_HEAL = 10;
// What a part does in the approach phase (src/sim/approach.js), by the tag
// that has it: a gun's damage a hit, what a shield holds a round, and what
// point defense takes off the other ship's hit chance. Every part with the
// tag has the number, and no other part does.
const APPROACH_NUMBERS = { damage: ['weapon', 100], shield: ['shield', 100], intercept: ['pointdefense', 50] };
const CATEGORY_KEYS = ['id', 'name'];
const FRAME_KEYS = ['id', 'name', 'width', 'height', 'shape', 'maxModules', 'maxStyling', 'minThrustToMass'];
// Styling (M23f, src/sim/styling.js): a piece's footprint is up to this many
// cells a side, and a frame takes up to this many pieces (a blueprint code
// counts them in a byte).
const STYLING_KEYS = ['groups', 'pieces', 'paints', 'trims'];
const PIECE_KEYS = ['id', 'name', 'group', 'size', 'turns', 'shape'];
const SHAPES = ['wedge', 'curve'];
const MAX_PIECE_SIZE = 4;
const MAX_STYLING = 255;
// A hull style (src/render/hullShape.js checks the shapes it asks for).
const HULL_KEYS = ['id', 'name', 'margin', 'corners', 'outer', 'stern', 'inner', 'steps', 'profile', 'stripe', 'smooth', 'roof', 'nose'];
const NOSE_KEYS = ['base', 'perWidth', 'max', 'tip', 'blunt', 'rings'];
const MAX_HULL_NAME = 16;
// balance.json: each number's allowed range.
const BALANCE = {
  startingCrew: [1, 100],
  actionPoints: [1, 4],
  halfCover: [0, 100],
  fullCover: [0, 100],
  overwatchPenalty: [0, 100],
  flankCrit: [0, 100],
  closeRange: [1, 30],
  midRange: [1, 30],
  sightRange: [1, 60],
  bleedOutTurns: [1, 10],
  fireDamage: [0, 20],
  rubbleMoveCost: [1, 5],
  suitAir: [0, 20],
  airlessDamage: [0, 20],
  forgivingStep: [0, 50],
  forgivingMax: [0, 100],
  // Heat (src/sim/heat.js): what a job adds, and the thresholds.
  jobHeat: [0, 100],
  loudJobHeat: [0, 100],
  rumorHeat: [1, 100],
  huntHeat: [1, 100],
  raidHeat: [1, 100],
  heatAfterRaid: [0, 100],
  // Prices (src/sim/economy.js): a part's cost, in percent, to buy and to
  // sell.
  buyPercent: [1, 1000],
  sellPercent: [0, 100],
  // Difficulty (src/sim/settings.js): what each enemy brings on easy and on
  // hard, added to its aim and hit points. Normal adds nothing.
  easyEnemyAim: [-50, 0],
  easyEnemyHp: [-5, 0],
  hardEnemyAim: [0, 50],
  hardEnemyHp: [0, 10],
  // The run (src/sim/run.js): the supplies a ship carries without a cargo
  // hold, what a crew member eats in a jump, a long jump's cost in jumps,
  // the price of one, the hit points a jump short of them costs, and the
  // heat a jump and a long jump add (a long jump sheds it).
  baseSupplies: [0, 999],
  jumpSupplies: [0, 20],
  longJumpFactor: [1, 10],
  supplyPrice: [1, 1000],
  hungerHp: [0, 20],
  jumpHeat: [0, 50],
  longJumpHeat: [-100, 50],
  scanHeat: [0, 50],
  scanRange: [1, 4],
  // The approach phase (src/sim/approach.js): its rounds, a gun's chance
  // against a ship that doesn't move and what a ship's thrust for its mass
  // and evading take off it, the bounds on every chance, the most a ship's
  // point defense takes off (a gun's damage, a shield's strength and each
  // turret's cut are its part's, data/modules.json), fleeing's and closing's
  // chances and what thrust for mass moves them, a wrecked reactor's chance
  // of blowing, the heat an approach with shots in it adds, and a repair's
  // price, in percent of the part's cost (src/sim/repair.js). What a
  // station charges to patch up a hit point of the crew's (src/sim/patch.js).
  approachRounds: [1, 10],
  gunnery: [0, 100],
  evasionPerThrust: [0, 100],
  evadeBonus: [0, 100],
  chanceMin: [0, 50],
  chanceMax: [50, 100],
  interceptMax: [0, 100],
  fleeChance: [0, 100],
  fleePerThrust: [0, 200],
  closeChance: [0, 100],
  closePerThrust: [0, 200],
  blowChance: [0, 100],
  approachHeat: [0, 50],
  repairPercent: [0, 100],
  patchPrice: [0, 100],
  // Crew on the run (src/sim/recruits.js, crew.js): what a recruit asks to
  // sign on (the fee, and on top of it a price for each trait and each
  // rank, M32b), how many a station offers, and the squad a boarding takes
  // (up to MAX_SQUAD).
  recruitFee: [0, 1000],
  recruitTraitFee: [0, 1000],
  recruitRankFee: [0, 1000],
  recruitOffer: [0, 4],
  squadSize: [1, 5],
  // Job ranks (src/sim/ranks.js, M32b): the fights a crew member stands in
  // to reach their job's rank 1 and rank 2.
  rankOneFights: [1, 99],
  rankTwoFights: [1, 999],
  // Heat on the run (src/sim/hunt.js, regroup.js): the chance the
  // pursuer's hunters wait where a jump comes out, from huntHeat, and the
  // task force's from raidHeat (certain at the most heat); a day's rest's
  // hit points and heat, and the heat a day hidden in a nebula sheds; a
  // transponder swap's heat and price; and a day surveying a world (M25).
  huntChance: [0, 100],
  taskForceChance: [0, 100],
  regroupHp: [0, 20],
  regroupHeat: [0, 50],
  hideHeat: [-100, 0],
  swapHeat: [-100, 0],
  swapPrice: [0, 1000],
  surveyHeat: [0, 50],
  // Raids on the colony (src/sim/raids.js, M29): the heat a colony day
  // sheds and a trip adds, off the lanes; what lying near the lanes and far
  // from them makes of that and of the odds, in percent; the odds a day of
  // the pursuer finding the colony, off the lanes, at each level of heat;
  // the days its lander takes to come; a defense's chance of hitting the
  // lander; and what a powered shield and armory give the defenders.
  colonyHeatFall: [0, 20],
  tripHeat: [0, 50],
  lanesNear: [100, 400],
  lanesFar: [0, 100],
  raidOddsRumors: [0, 100],
  raidOddsHunters: [0, 100],
  raidOddsTaskForce: [0, 100],
  raidOddsCornered: [0, 100],
  raidWarning: [1, 10],
  landingHit: [0, 100],
  raidShieldArmor: [0, 5],
  raidArmoryAim: [0, 50],
  // Standing with the sides (src/sim/standing.js, M33), from -10 to 10:
  // where the pursuer's side starts a campaign; where each level above
  // hostile begins (cold, neutral, friendly, then trusted); what a job done
  // moves it for its client's side and against its enemies' side, what a
  // job lost moves it against them, and what a side's ship boarded, blown
  // up or left adrift costs with its side; what a station of a side
  // charges at each level, in percent of the price; how much more a job
  // for a friendly and a trusted side pays, in percent; and the heat of
  // docking at a station of the pursuer's side.
  pursuerStanding: [-10, 10],
  coldStanding: [-10, 10],
  neutralStanding: [-10, 10],
  friendlyStanding: [-10, 10],
  trustedStanding: [-10, 10],
  jobStanding: [0, 10],
  lostStanding: [0, 10],
  shipStanding: [0, 10],
  hostilePrice: [1, 1000],
  coldPrice: [1, 1000],
  neutralPrice: [1, 1000],
  friendlyPrice: [1, 1000],
  trustedPrice: [1, 1000],
  friendlyPay: [0, 100],
  trustedPay: [0, 100],
  dockHeat: [0, 50],
};
// A weapon's held shape and a fighter's look are how the fight draws them
// (src/render/figures/looks.js).
const WEAPON_KEYS = ['id', 'name', 'damage', 'accuracy', 'crit', 'critDamage', 'clip', 'held'];
const RANGE_BANDS = ['close', 'mid', 'long'];
// Crew jobs and enemies are both fighters, with the same fields. A job
// can also have an order in a fight (src/sim/orders.js), a ship effect
// (station) and a colony effect (colony, src/sim/edges.js) (§4.5, M32), and
// its ranks (src/sim/ranks.js, M32b): one for each of the balance's rank
// fights, each { name, text } and the numbers it lays over the job's order,
// station or colony.
const FIGHTER_KEYS = ['id', 'name', 'hp', 'aim', 'defense', 'mobility', 'armor', 'weapon', 'look'];
const JOB_KEYS = ['order', 'station', 'colony', 'ranks'];
const RANK_KEYS = ['name', 'text', ...RANK_LAYERS];
const RANKS = 2;
const MAX_USES = 9;
const TILE_RULE_KEYS = ['walk', 'cover', 'blocksSight'];
// Traits (src/sim/traits.js): what each can add to a fighter's numbers, up
// or down, and how far.
const TRAIT_KEYS = ['id', 'name', 'text', 'effects'];
const TRAIT_RANGES = { hp: [-5, 5], aim: [-30, 30], defense: [-30, 30], mobility: [-2, 2], armor: [-2, 2] };
// Tips (src/ui/tips.js): words short enough for a card on the cover
// screen. Which tips there are is the game's: src/ui/tipSteps.js.
const TIP_KEYS = ['id', 'text'];
const MAX_TIP = 200;
const ENCOUNTER_KEYS = ['id', 'name', 'enemies'];
// Ship presets (src/sim/gen/ship.js).
const SHIP_KEYS = ['id', 'name', 'side', 'frame', 'crew', 'beam', 'symmetric', 'parts', 'makers', 'wrecks', 'tactics', 'scrap', 'party', 'salvage', 'look'];
const LOOK_KEYS = ['paint', 'trim', 'pieces'];
// A hostile preset's tactics in the approach phase (src/sim/approach.js).
const TACTIC_KEYS = ['aim', 'board', 'flee'];
const MAX_SCRAP = 9999;
// The most parts a boarding crew strips off a ship it wins (encounter.js).
const MAX_SALVAGE = 5;
const MAX_CREW = 20;
// Squads of 3 to start, up to 5 later; 4 to 8 enemies (ROADMAP §4.3). Fewer
// are allowed, for small tests.
const MAX_SQUAD = 5;
const MAX_ENEMIES = 8;
// Tiles every battle map has, besides the interior templates'
// (mapFromShip.js), the hangar's deck (hangarMap.js), and those of the job
// sites' maps (gen/site.js).
const MAP_TILES = ['space', 'hull', 'deck', ...new Set(Object.values(SITE_CHARS).map((kind) => kind.tile))];
const MAX_MODULE_SIZE = 4;
const MAX_FRAME_SIZE = 32;

// Tags the rules read. A new tag means new rules, so it is added here on purpose.
export const KNOWN_TAGS = [
  'bridge', 'reactor', 'engine', 'corridor', 'airlock', 'quarters',
  'lifesupport', 'cargo', 'medbay', 'armory', 'weapon', 'shield',
  'pointdefense',
];

// Returns a list of problems as "where: what" strings. Empty means valid.
export function validateData(data) {
  const { modules: moduleFile, frames: frameFile, manufacturers: makerFile, hulls: hullFile, balance, weapons: weaponFile, jobs: jobFile, enemies: enemyFile, tiles: tileFile, encounters: encounterFile, ships: shipFile } = data;
  const problems = [];
  const fail = (where, message) => problems.push(`${where}: ${message}`);

  const makers = listOf(makerFile, 'manufacturers', 'manufacturers.json', fail);
  const makerIds = uniqueIds(makers, 'manufacturers.json', fail);
  makers.forEach((maker, i) => {
    const where = `manufacturers.json ${maker.id ?? `#${i}`}`;
    knownKeys(maker, MAKER_KEYS, where, fail);
    if (!isText(maker.name)) fail(where, 'name must be a non-empty string');
    if (!isText(maker.short) || maker.short.length > MAX_MAKER_SHORT) fail(where, `short must be a name of up to ${MAX_MAKER_SHORT} letters`);
    if (maker.blurb !== undefined && !isText(maker.blurb)) fail(where, 'blurb must be a non-empty string');
    if (maker.mark !== undefined && !MARKED.includes(maker.mark)) fail(where, `mark must be one of ${MARKED.join(', ')}`);
    if (isId(maker.id) && !Object.hasOwn(SKINS, maker.id)) fail(where, 'has no skin in src/render/palette.js');
  });

  // Hull styles (M23d): ships saved before them have the default one.
  const hulls = listOf(hullFile, 'hulls', 'hulls.json', fail);
  const hullIds = uniqueIds(hulls, 'hulls.json', fail);
  if (!hullIds.has(DEFAULT_HULL)) fail('hulls.json', `there must be a "${DEFAULT_HULL}" style: ships from before hull styles have it`);
  hulls.forEach((hull, i) => {
    const where = `hulls.json ${hull.id ?? `#${i}`}`;
    knownKeys(hull, HULL_KEYS, where, fail);
    if (isObject(hull.nose)) knownKeys(hull.nose, NOSE_KEYS, `${where} nose`, fail);
    if (!isText(hull.name) || hull.name.length > MAX_HULL_NAME) fail(where, `name must be up to ${MAX_HULL_NAME} letters`);
    for (const problem of hullStyleProblems(hull)) fail(where, problem);
  });

  const frames = listOf(frameFile, 'frames', 'frames.json', fail);
  uniqueIds(frames, 'frames.json', fail);
  frames.forEach((frame, i) => {
    const where = `frames.json ${frame.id ?? `#${i}`}`;
    for (const key of Object.keys(frame)) {
      if (!FRAME_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(frame.name)) fail(where, 'name must be a non-empty string');
    if (!(Number.isFinite(frame.minThrustToMass) && frame.minThrustToMass >= 0 && frame.minThrustToMass <= 10)) {
      fail(where, 'minThrustToMass must be a number from 0 to 10');
    }
    for (const key of ['width', 'height']) {
      if (!isIntIn(frame[key], 1, MAX_FRAME_SIZE)) fail(where, `${key} must be an integer from 1 to ${MAX_FRAME_SIZE}`);
    }
    if (!isIntIn(frame.maxModules, 1, Infinity)) fail(where, 'maxModules must be a positive integer');
    if (!isIntIn(frame.maxStyling, 0, MAX_STYLING)) fail(where, `maxStyling must be a whole number from 0 to ${MAX_STYLING}`);
    if (frame.shape !== undefined) checkShape(frame, where, fail);
  });

  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) {
    fail('balance.json', 'must be an object of named numbers');
  } else {
    for (const key of Object.keys(balance)) {
      if (!(key in BALANCE)) fail('balance.json', `unknown number "${key}"`);
    }
    for (const [key, [min, max]] of Object.entries(BALANCE)) {
      if (!isIntIn(balance[key], min, max)) fail('balance.json', `${key} must be a whole number from ${min} to ${max}`);
    }
    if (balance.midRange < balance.closeRange) fail('balance.json', 'midRange must be at least closeRange');
    if (!(balance.rankOneFights < balance.rankTwoFights)) fail('balance.json', 'rankTwoFights must be more than rankOneFights');
    if (!(balance.rumorHeat < balance.huntHeat && balance.huntHeat < balance.raidHeat)) fail('balance.json', 'heat thresholds must rise: rumorHeat, then huntHeat, then raidHeat');
    if (!(balance.heatAfterRaid < balance.raidHeat)) fail('balance.json', 'heatAfterRaid must be under raidHeat, or one raid brings the next');
    if (!(balance.heatAfterRaid < balance.huntHeat)) fail('balance.json', 'heatAfterRaid must be under huntHeat, or facing the hunters leaves them on the trail');
    if (balance.taskForceChance < balance.huntChance) fail('balance.json', 'taskForceChance must be at least huntChance: the chance rises with heat');
    if (!(balance.raidOddsRumors <= balance.raidOddsHunters && balance.raidOddsHunters <= balance.raidOddsTaskForce && balance.raidOddsTaskForce <= balance.raidOddsCornered)) {
      fail('balance.json', 'the raid odds must rise with heat: raidOddsRumors, raidOddsHunters, raidOddsTaskForce, then raidOddsCornered');
    }
    if (Math.round((balance.raidOddsCornered * balance.lanesNear) / 100) > 100) fail('balance.json', 'raidOddsCornered near the lanes (lanesNear) must be at most 100');
    if (balance.loudJobHeat < balance.jobHeat) fail('balance.json', 'loudJobHeat must be at least jobHeat');
    if (balance.sellPercent > balance.buyPercent) fail('balance.json', 'sellPercent must be at most buyPercent, or buying and selling makes money');
    if (!(-10 < balance.coldStanding && balance.coldStanding < balance.neutralStanding && balance.neutralStanding < balance.friendlyStanding && balance.friendlyStanding < balance.trustedStanding)) {
      fail('balance.json', 'the levels of standing must rise from above -10: coldStanding, neutralStanding, friendlyStanding, then trustedStanding');
    }
    if (!(balance.neutralStanding <= 0 && 0 < balance.friendlyStanding)) fail('balance.json', 'a side a campaign starts at 0 with must be neutral: neutralStanding at most 0, friendlyStanding over it');
    if (!(balance.pursuerStanding < balance.coldStanding)) fail('balance.json', "pursuerStanding must be under coldStanding: the pursuer's side starts hostile");
    if (!(balance.trustedPrice <= balance.friendlyPrice && balance.friendlyPrice <= balance.neutralPrice && balance.neutralPrice <= balance.coldPrice && balance.coldPrice <= balance.hostilePrice)) {
      fail('balance.json', "a station's prices must fall as standing rises: hostilePrice, coldPrice, neutralPrice, friendlyPrice, then trustedPrice");
    }
    if (balance.friendlyPay > balance.trustedPay) fail('balance.json', 'trustedPay must be at least friendlyPay');
  }

  const weapons = listOf(weaponFile, 'weapons', 'weapons.json', fail);
  const weaponIds = uniqueIds(weapons, 'weapons.json', fail);
  weapons.forEach((weapon, i) => checkWeapon(weapon, `weapons.json ${weapon.id ?? `#${i}`}`, fail));

  // Jobs and enemies share one set of ids: a battle names a fighter by it.
  const jobs = listOf(jobFile, 'jobs', 'jobs.json', fail);
  const enemies = listOf(enemyFile, 'enemies', 'enemies.json', fail);
  const jobIds = uniqueIds(jobs, 'jobs.json', fail);
  uniqueIds(enemies, 'enemies.json', fail);
  for (const enemy of enemies) {
    if (jobIds.has(enemy.id)) fail('enemies.json', `id "${enemy.id}" is also a job's`);
  }
  jobs.forEach((job, i) => checkFighter(job, `jobs.json ${job.id ?? `#${i}`}`, weaponIds, fail, { job: true }));
  enemies.forEach((enemy, i) => checkFighter(enemy, `enemies.json ${enemy.id ?? `#${i}`}`, weaponIds, fail));
  const enemyIds = new Set(enemies.map((enemy) => enemy.id));
  const traitIds = checkTraits(data.traits, fail);
  checkTips(data.tips, fail);

  // Who fights: the squad by job, and each encounter's enemies.
  const squad = encounterFile?.squad;
  if (!isListIn(squad, 1, MAX_SQUAD)) fail('encounters.json', `squad must be a list of 1 to ${MAX_SQUAD} crew jobs`);
  else for (const id of squad) if (!jobIds.has(id)) fail('encounters.json squad', `unknown job "${id}"`);
  const encounters = listOf(encounterFile, 'encounters', 'encounters.json', fail);
  uniqueIds(encounters, 'encounters.json', fail);
  encounters.forEach((encounter, i) => {
    const where = `encounters.json ${encounter.id ?? `#${i}`}`;
    for (const key of Object.keys(encounter)) {
      if (!ENCOUNTER_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(encounter.name)) fail(where, 'name must be a non-empty string');
    if (!isListIn(encounter.enemies, 1, MAX_ENEMIES)) fail(where, `enemies must be a list of 1 to ${MAX_ENEMIES} enemies`);
    else for (const id of encounter.enemies) if (!enemyIds.has(id)) fail(where, `unknown enemy "${id}"`);
  });

  const tileRules = tileFile?.tiles;
  if (!tileRules || typeof tileRules !== 'object' || Array.isArray(tileRules)) {
    fail('tiles.json', '"tiles" must be an object of tile names');
  } else {
    for (const [name, rule] of Object.entries(tileRules)) checkTileRule(rule, `tiles.json "${name}"`, fail);
    const names = [...MAP_TILES, ...Object.values(moduleFile?.tiles ?? {})];
    for (const name of names) {
      if (!(name in tileRules)) fail('tiles.json', `no rules for the tile "${name}"`);
    }
  }

  const tilesPerCell = moduleFile?.tilesPerCell;
  if (!isIntIn(tilesPerCell, 1, 8)) fail('modules.json', 'tilesPerCell must be an integer from 1 to 8');
  const tiles = moduleFile?.tiles;
  if (!tiles || typeof tiles !== 'object' || Array.isArray(tiles)) {
    fail('modules.json', 'tiles must be an object mapping one character to a tile name');
  } else {
    for (const [char, name] of Object.entries(tiles)) {
      if ([...char].length !== 1 || !isText(name)) fail('modules.json tiles', `"${char}" must map one character to a name`);
    }
  }

  // The drawer's categories (M23e), each with a name, every one with parts.
  const categories = listOf(moduleFile, 'categories', 'modules.json', fail);
  const categoryIds = uniqueIds(categories, 'modules.json categories', fail);
  categories.forEach((category, i) => {
    const where = `modules.json category ${category.id ?? `#${i}`}`;
    knownKeys(category, CATEGORY_KEYS, where, fail);
    if (!isText(category.name)) fail(where, 'name must be a non-empty string');
  });

  const listed = listOf(moduleFile, 'modules', 'modules.json', fail);
  uniqueIds(listed, 'modules.json', fail);
  // The parts as the game has them: each maker's version filled in from its
  // base, checked as a part from here on, less any that can't be.
  const versions = checkVersions(listed, fail);
  const modules = withBases(listed).filter((def) => def.base === undefined || versions.has(def.id));
  for (const id of categoryIds) {
    if (!modules.some((def) => def.category === id)) fail(`modules.json category ${id}`, 'no part is in it');
  }
  const glyphs = new Set();
  modules.forEach((def, i) => {
    const where = `modules.json ${def.id ?? `#${i}`}`;
    for (const key of Object.keys(def)) {
      if (!MODULE_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(def.name)) fail(where, 'name must be a non-empty string');
    // A version prints as its base part does (tools/build-ship.js).
    const glyphOk = typeof def.glyph === 'string' && [...def.glyph].length === 1 && def.glyph !== '.' && def.glyph.trim() !== '';
    if (!glyphOk) {
      fail(where, 'glyph must be one visible character other than "."');
    } else if (def.base === undefined && glyphs.has(def.glyph)) {
      fail(where, `glyph "${def.glyph}" is already used`);
    } else {
      glyphs.add(def.glyph);
    }
    if (!makerIds.has(def.manufacturer)) fail(where, `unknown manufacturer "${def.manufacturer}"`);
    if (!categoryIds.has(def.category)) fail(where, `category must be one of ${[...categoryIds].join(', ')}`);
    if (typeof def.rotates !== 'boolean') fail(where, 'rotates must be true or false');
    if (!isIntIn(def.cost, 0, Infinity)) fail(where, 'cost must be a whole number, 0 or more');

    const sizeOk = Array.isArray(def.size) && def.size.length === 2 && def.size.every((n) => isIntIn(n, 1, MAX_MODULE_SIZE));
    if (!sizeOk) {
      fail(where, `size must be [width, height] in cells, each from 1 to ${MAX_MODULE_SIZE}`);
    } else if (isIntIn(tilesPerCell, 1, 8) && tiles) {
      checkInterior(def, tilesPerCell, tiles, where, fail);
    }
    if (def.facesSpace !== undefined) checkFacesSpace(def.facesSpace, where, fail);
    if (def.heal !== undefined && !isIntIn(def.heal, 1, MAX_HEAL)) fail(where, `heal must be the hit points it heals each of the wounded a jump, 1 to ${MAX_HEAL}`);
    checkStats(def.stats, where, fail);
    if (!Array.isArray(def.tags)) {
      fail(where, 'tags must be a list');
    } else {
      for (const tag of def.tags) {
        if (!KNOWN_TAGS.includes(tag)) fail(where, `unknown tag "${tag}"`);
      }
      if (new Set(def.tags).size !== def.tags.length) fail(where, 'tags has duplicates');
      for (const [key, [tag, max]] of Object.entries(APPROACH_NUMBERS)) {
        if (!def.tags.includes(tag)) {
          if (def[key] !== undefined) fail(where, `only a part tagged "${tag}" has ${key}`);
        } else if (!isIntIn(def[key], 1, max)) {
          fail(where, `${key} must be a whole number from 1 to ${max}`);
        }
      }
    }
  });
  for (const tag of REQUIRED_TAGS) {
    if (!modules.some((def) => Array.isArray(def.tags) && def.tags.includes(tag))) {
      fail('modules.json', `no module is tagged "${tag}", which the flight checklist needs`);
    }
  }

  const ships = listOf(shipFile, 'ships', 'ships.json', fail);
  uniqueIds(ships, 'ships.json', fail);
  const moduleIds = new Set(modules.map((def) => def.id));
  checkStyling(data.styling, moduleIds, fail);
  const frameById = new Map(frames.map((frame) => [frame.id, frame]));
  ships.forEach((ship, i) => checkShip(ship, `ships.json ${ship.id ?? `#${i}`}`, frameById, moduleIds, fail));
  ships.forEach((ship, i) => ship?.look !== undefined && checkLook(ship.look, `ships.json ${ship.id ?? `#${i}`}`, data.styling, frameById.get(ship.frame), fail));
  ships.forEach((ship, i) => ship?.makers !== undefined && checkMakers(ship.makers, `ships.json ${ship.id ?? `#${i}`}`, makerIds, fail));

  const encounterById = new Map(encounters.filter((e) => Array.isArray(e.enemies)).map((e) => [e.id, e.enemies]));
  const presets = new Map(ships.filter((ship) => typeof ship?.id === 'string').map((ship) => [ship.id, ship]));
  // A hostile preset's crew fights the boardings (encounter.js): its party
  // is an encounter, and one with tactics has to have one.
  for (const ship of presets.values()) {
    const where = `ships.json ${ship.id}`;
    if (ship.party !== undefined && !encounterById.has(ship.party)) fail(where, `party: unknown encounter "${ship.party}"`);
    if (ship.tactics !== undefined && ship.party === undefined) fail(where, 'a preset with tactics needs a party for the boarding fights');
  }
  const sides = checkFactions(data, presets, fail);
  const scripts = checkCampaignFiles(data, { jobIds, enemyIds, traitIds, moduleIds, frameById, encounters: encounterById, presets, sides }, fail);
  // The starting ships are built only from content that checks out.
  if (!problems.length) checkStartShips(data, scripts, fail);
  return problems;
}

// Each maker's version of a part (M23g): only what it changes
// (VERSION_KEYS), of a part earlier in the file that isn't a version
// itself, by another maker than its base's, and one version a maker for
// each part. Returns the ids of the versions that name a base.
function checkVersions(list, fail) {
  const bases = new Map();
  const taken = new Set();
  const named = new Set();
  list.forEach((def, i) => {
    if (def.base === undefined) {
      bases.set(def.id, def);
      return;
    }
    const where = `modules.json ${def.id ?? `#${i}`}`;
    knownKeys(def, VERSION_KEYS, where, fail);
    const base = bases.get(def.base);
    if (!base) {
      fail(where, `base "${def.base}" must be a part earlier in the file that isn't a version itself`);
      return;
    }
    named.add(def.id);
    if (def.manufacturer === base.manufacturer) fail(where, `a version is by another maker than its base part's ("${base.manufacturer}")`);
    const key = `${def.manufacturer} ${def.base}`;
    if (taken.has(key)) fail(where, `${def.manufacturer} has a version of ${def.base} already`);
    taken.add(key);
    if (!isObject(def.stats)) fail(where, 'stats must be an object of the stats it changes');
  });
  return named;
}

// A ship preset: the frame a generated ship is built on, the crew it has to
// carry (berths and life support), how many cells across it should be (its
// beam), whether it is mirrored about its middle row, its parts bow to stern
// (each a count, or [least, most]) and, for a derelict, how many rooms are
// wrecked. A hostile one also has its tactics in the approach phase, its
// scrap in credits, the party that fights its boardings and the parts a
// crew that wins aboard her strips off (salvage). Any may have a look
// (checkLook).
// Styling (M23f): the pieces and the groups the Look tab sorts them into,
// and the paints and trims, each with a color in src/render/palette.js. A
// piece that stands on the hull has a model of its own (src/render/
// pieces.js); a wedge or a curve is the hull's, by its shape.
function checkStyling(file, moduleIds, fail) {
  if (!isObject(file)) {
    fail('styling.json', 'must be an object');
    return;
  }
  knownKeys(file, STYLING_KEYS, 'styling.json', fail);
  const groups = listOf(file, 'groups', 'styling.json', fail);
  const groupIds = uniqueIds(groups, 'styling.json groups', fail);
  groups.forEach((group, i) => {
    knownKeys(group, ['id', 'name'], `styling.json group ${group.id ?? `#${i}`}`, fail);
    if (!isText(group.name)) fail(`styling.json group ${group.id ?? `#${i}`}`, 'name must be a non-empty string');
  });
  const pieces = listOf(file, 'pieces', 'styling.json', fail);
  uniqueIds(pieces, 'styling.json pieces', fail);
  pieces.forEach((piece, i) => {
    const where = `styling.json ${piece.id ?? `#${i}`}`;
    knownKeys(piece, PIECE_KEYS, where, fail);
    if (moduleIds.has(piece.id)) fail(where, "id must differ from every module's: a build command names one or the other");
    if (!isText(piece.name)) fail(where, 'name must be a non-empty string');
    if (!groupIds.has(piece.group)) fail(where, `group must be one of ${[...groupIds].join(', ')}`);
    if (!(Array.isArray(piece.size) && piece.size.length === 2 && piece.size.every((n) => isIntIn(n, 1, MAX_PIECE_SIZE)))) fail(where, `size must be [w, h], each 1 to ${MAX_PIECE_SIZE} cells`);
    if (!(isListIn(piece.turns, 1, 8) && piece.turns.every((t) => isIntIn(t, 0, 7)) && new Set(piece.turns).size === piece.turns.length)) fail(where, 'turns must list different turns, each 0 to 7');
    if (piece.shape !== undefined && !SHAPES.includes(piece.shape)) fail(where, `shape must be one of ${SHAPES.join(', ')}`);
    if (piece.shape === undefined && !MODELED.includes(piece.id)) fail(where, 'a piece without a shape needs a model of its own in src/render/pieces.js');
  });
  for (const id of groupIds) if (!pieces.some((piece) => piece.group === id)) fail(`styling.json group ${id}`, 'every group must have pieces');
  for (const [key, colors, first] of [['paints', PAINT_COLORS, DEFAULT_PAINT], ['trims', TRIM_COLORS, DEFAULT_TRIM]]) {
    const list = listOf(file, key, 'styling.json', fail);
    const ids = uniqueIds(list, `styling.json ${key}`, fail);
    list.forEach((item, i) => {
      const where = `styling.json ${item.id ?? `#${i}`}`;
      knownKeys(item, ['id', 'name'], where, fail);
      if (!isText(item.name)) fail(where, 'name must be a non-empty string');
      if (isId(item.id) && !(item.id in colors)) fail(where, `has no color in src/render/palette.js ${key}`);
    });
    if (!ids.has(first)) fail('styling.json', `${key} must have "${first}": ships from before paint have it`);
  }
}

function checkShip(ship, where, frameById, moduleIds, fail) {
  for (const key of Object.keys(ship)) {
    if (!SHIP_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
  }
  if (!isText(ship.name)) fail(where, 'name must be a non-empty string');
  const frame = frameById.get(ship.frame);
  if (!frame) fail(where, `unknown frame "${ship.frame}"`);
  if (!isIntIn(ship.crew, 1, MAX_CREW)) fail(where, `crew must be a whole number from 1 to ${MAX_CREW}`);
  const across = frame?.height ?? MAX_FRAME_SIZE;
  if (!isRange(ship.beam, 1, across)) fail(where, `beam must be [least, most] cells across, from 1 to ${across}`);
  if (typeof ship.symmetric !== 'boolean') fail(where, 'symmetric must be true or false');
  if (ship.wrecks !== undefined && !isRange(ship.wrecks, 0, 99)) fail(where, 'wrecks must be [least, most] rooms');
  if (ship.tactics !== undefined) checkTactics(ship.tactics, `${where} tactics`, fail);
  if (ship.scrap !== undefined && !isRange(ship.scrap, 0, MAX_SCRAP)) fail(where, `scrap must be [least, most] credits, up to ${MAX_SCRAP}`);
  if (ship.salvage !== undefined && !isIntIn(ship.salvage, 0, MAX_SALVAGE)) fail(where, `salvage must be the parts stripped from her, 0 to ${MAX_SALVAGE}`);
  const { parts } = ship;
  if (!parts || typeof parts !== 'object' || Array.isArray(parts) || !Object.keys(parts).length) {
    fail(where, 'parts must be an object of module types and counts');
    return;
  }
  let most = 0;
  for (const [type, count] of Object.entries(parts)) {
    if (!moduleIds.has(type)) fail(where, `parts: unknown module "${type}"`);
    if (isIntIn(count, 0, Infinity)) most += count;
    else if (isRange(count, 0, Infinity)) most += count[1];
    else fail(where, `parts.${type} must be a whole number, or [least, most]`);
  }
  if (frame && most > frame.maxModules) fail(where, `parts: up to ${most}, but the ${frame.name} holds at most ${frame.maxModules}`);
}

// What a generated ship of the preset wears (M23f): its side's paint and
// trim, and styling pieces, each a count or [least, most], put on at random
// where they fit (src/sim/gen/look.js; on a symmetric ship in pairs, so an
// odd count gets one more).
function checkLook(look, where, styling, frame, fail) {
  if (!isObject(look)) {
    fail(where, 'look must be an object');
    return;
  }
  knownKeys(look, LOOK_KEYS, `${where} look`, fail);
  const ids = (key) => new Set((Array.isArray(styling?.[key]) ? styling[key] : []).map((item) => item?.id));
  if (!ids('paints').has(look.paint)) fail(where, 'look.paint must be one of the paints in styling.json');
  if (!ids('trims').has(look.trim)) fail(where, 'look.trim must be one of the trims in styling.json');
  if (!isObject(look.pieces)) {
    fail(where, 'look.pieces must be an object of styling pieces and counts');
    return;
  }
  const pieces = ids('pieces');
  let most = 0;
  for (const [type, count] of Object.entries(look.pieces)) {
    if (!pieces.has(type)) fail(where, `look.pieces: unknown styling piece "${type}"`);
    if (isIntIn(count, 0, Infinity)) most += count;
    else if (isRange(count, 0, Infinity)) most += count[1];
    else fail(where, `look.pieces.${type} must be a whole number, or [least, most]`);
  }
  if (frame && most > frame.maxStyling) fail(where, `look.pieces: up to ${most}, but the ${frame.name} takes at most ${frame.maxStyling}`);
}

// Who makes a generated ship's parts (M23g): for each maker, the chance in
// 100 that a part, or a mirrored pair, is its version (src/sim/gen/ship.js
// makersOf); the rest are the base parts. Together no more than 100.
function checkMakers(makers, where, makerIds, fail) {
  if (!isObject(makers)) {
    fail(where, 'makers must be an object of manufacturers and chances in 100');
    return;
  }
  let sum = 0;
  for (const [id, chance] of Object.entries(makers)) {
    if (!makerIds.has(id)) fail(where, `makers: unknown manufacturer "${id}"`);
    if (isIntIn(chance, 1, 100)) sum += chance;
    else fail(where, `makers.${id} must be a chance in 100, from 1 to 100`);
  }
  if (sum > 100) fail(where, `makers: the chances add up to ${sum}, more than 100`);
}

// How a hostile preset plays the approach: the kinds of module it fires at,
// first choice first, and, if it does either, the round it closes to board
// from and the share of its approach hit points lost, in percent, at which
// it runs.
function checkTactics(tactics, where, fail) {
  if (!tactics || typeof tactics !== 'object' || Array.isArray(tactics)) {
    fail(where, 'must be an object');
    return;
  }
  for (const key of Object.keys(tactics)) if (!TACTIC_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
  const { aim } = tactics;
  if (!Array.isArray(aim) || !aim.length || !aim.every((kind) => AIMS.includes(kind)) || new Set(aim).size !== aim.length) {
    fail(where, `aim must list kinds to fire at, each once: ${AIMS.join(', ')}`);
  }
  if (tactics.board !== undefined && !isIntIn(tactics.board, 1, 10)) fail(where, 'board must be the round it closes from, 1 to 10');
  if (tactics.flee !== undefined && !isIntIn(tactics.flee, 1, 100)) fail(where, 'flee must be a share lost, in percent, from 1 to 100');
}

// A weapon: damage [least, most], an accuracy change at each range band, a
// crit chance and extra damage on a crit, and the shots in a clip.
// The traits: each with a name, a line about it, and what it adds to a
// fighter's numbers, at least one of them. A captain picks CAPTAIN_TRAITS,
// so there are at least that many. Returns their ids, for the recruits'
// backgrounds (validate-campaign.js).
function checkTraits(file, fail) {
  const traits = listOf(file, 'traits', 'traits.json', fail);
  const ids = uniqueIds(traits, 'traits.json', fail);
  if (traits.length < CAPTAIN_TRAITS) fail('traits.json', `needs at least ${CAPTAIN_TRAITS} traits for a captain to pick`);
  traits.forEach((trait, i) => {
    const where = `traits.json ${trait.id ?? `#${i}`}`;
    for (const key of Object.keys(trait)) if (!TRAIT_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    if (!isText(trait.name) || !isText(trait.text)) fail(where, 'name and text must be non-empty strings');
    const { effects } = trait;
    if (typeof effects !== 'object' || effects === null || Array.isArray(effects)) {
      fail(where, `effects must be an object of ${TRAIT_STATS.join(', ')}`);
      return;
    }
    for (const [key, value] of Object.entries(effects)) {
      if (!TRAIT_STATS.includes(key)) fail(where, `effects: unknown number "${key}"`);
      else if (!isIntIn(value, ...TRAIT_RANGES[key]) || value === 0) fail(where, `effects.${key} must be a whole number from ${TRAIT_RANGES[key][0]} to ${TRAIT_RANGES[key][1]}, not 0`);
    }
    if (!Object.keys(effects).length) fail(where, 'effects must change something');
  });
  return ids;
}

// The tips: one for each step the game has (TIP_IDS), and no others.
function checkTips(file, fail) {
  const tips = listOf(file, 'tips', 'tips.json', fail);
  const ids = uniqueIds(tips, 'tips.json', fail);
  tips.forEach((tip, i) => {
    const where = `tips.json ${tip.id ?? `#${i}`}`;
    for (const key of Object.keys(tip)) if (!TIP_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    if (!isText(tip.text) || tip.text.length > MAX_TIP) fail(where, `text must be a non-empty string of up to ${MAX_TIP} letters`);
    if (!TIP_IDS.includes(tip.id)) fail(where, 'no step of the game shows this tip');
  });
  for (const id of TIP_IDS) if (!ids.has(id)) fail('tips.json', `the tip "${id}" has no words`);
}

function checkWeapon(weapon, where, fail) {
  for (const key of Object.keys(weapon)) {
    if (!WEAPON_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
  }
  if (!isText(weapon.name)) fail(where, 'name must be a non-empty string');
  const { damage, accuracy } = weapon;
  if (!Array.isArray(damage) || damage.length !== 2 || !damage.every((n) => isIntIn(n, 1, 99)) || damage[0] > damage[1]) {
    fail(where, 'damage must be [least, most], whole numbers from 1 to 99');
  }
  if (!accuracy || typeof accuracy !== 'object' || Array.isArray(accuracy)) {
    fail(where, `accuracy must be { ${RANGE_BANDS.join(', ')} }`);
  } else {
    for (const key of Object.keys(accuracy)) {
      if (!RANGE_BANDS.includes(key)) fail(where, `accuracy: unknown range band "${key}"`);
    }
    for (const band of RANGE_BANDS) {
      if (!isIntIn(accuracy[band], -100, 100)) fail(where, `accuracy.${band} must be a whole number from -100 to 100`);
    }
  }
  if (!isIntIn(weapon.crit, 0, 100)) fail(where, 'crit must be a whole number from 0 to 100');
  if (!isIntIn(weapon.critDamage, 0, 99)) fail(where, 'critDamage must be a whole number from 0 to 99');
  if (!isIntIn(weapon.clip, 1, 99)) fail(where, 'clip must be a whole number from 1 to 99');
  for (const problem of heldProblems(weapon.held)) fail(where, problem);
}

// A crew job or an enemy: what it brings to a battle, and its look. A job
// (job: true) can also have an order, a ship effect and a colony effect.
function checkFighter(fighter, where, weaponIds, fail, { job = false } = {}) {
  for (const key of Object.keys(fighter)) {
    if (!FIGHTER_KEYS.includes(key) && !(job && JOB_KEYS.includes(key))) fail(where, `unknown field "${key}"`);
  }
  if (job && fighter.order !== undefined) checkOrder(fighter.order, `${where} order`, fail);
  if (job && fighter.station !== undefined) checkEffects(fighter.station, STATION_EFFECTS, `${where} station`, fail);
  if (job && fighter.colony !== undefined) checkEffects(fighter.colony, COLONY_EFFECTS, `${where} colony`, fail);
  if (job && fighter.ranks !== undefined) checkRanks(fighter, `${where} ranks`, fail);
  if (!isText(fighter.name)) fail(where, 'name must be a non-empty string');
  const ranges = { hp: [1, 99], aim: [0, 100], defense: [0, 100], mobility: [1, 20], armor: [0, 20] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!isIntIn(fighter[key], min, max)) fail(where, `${key} must be a whole number from ${min} to ${max}`);
  }
  if (!weaponIds.has(fighter.weapon)) fail(where, `unknown weapon "${fighter.weapon}"`);
  for (const problem of lookProblems(fighter.look)) fail(where, problem);
}

// A job's order: { type, name, uses, ...its kind's numbers }.
function checkOrder(order, where, fail) {
  if (!isObject(order)) {
    fail(where, 'must be { type, name, uses, ... }');
    return;
  }
  const kind = ORDER_KINDS[order.type];
  if (!kind) {
    fail(where, `type must be one of ${Object.keys(ORDER_KINDS).join(', ')}`);
    return;
  }
  for (const key of Object.keys(order)) {
    if (!['type', 'name', 'uses', ...Object.keys(kind.fields)].includes(key)) fail(where, `unknown field "${key}" for ${order.type}`);
  }
  if (!isText(order.name)) fail(where, 'name must be a non-empty string');
  if (!isIntIn(order.uses, 1, MAX_USES)) fail(where, `uses must be a whole number from 1 to ${MAX_USES}`);
  for (const [key, [min, max]] of Object.entries(kind.fields)) {
    if (!isIntIn(order[key], min, max)) fail(where, `${key} must be a whole number from ${min} to ${max}`);
  }
}

// A job's ranks: RANKS of them, each a name, words and at least one layer
// of numbers. A rank sharpens what the job already does: its order's uses
// and numbers, and the effects the job has, each still within its range
// once laid over the job's (ranks.js jobAtRank).
function checkRanks(job, where, fail) {
  if (!Array.isArray(job.ranks) || job.ranks.length !== RANKS) {
    fail(where, `must be a list of ${RANKS} ranks, one for each of the balance's rank fights`);
    return;
  }
  job.ranks.forEach((rank, i) => {
    const at = `${where} ${i + 1}`;
    if (!isObject(rank)) {
      fail(at, 'must be { name, text, order?, station?, colony? }');
      return;
    }
    for (const key of Object.keys(rank)) if (!RANK_KEYS.includes(key)) fail(at, `unknown field "${key}"`);
    if (!isText(rank.name)) fail(at, 'name must be a non-empty string');
    if (!isText(rank.text)) fail(at, 'text must be a non-empty string');
    if (!RANK_LAYERS.some((layer) => rank[layer] !== undefined)) fail(at, `must sharpen at least one of ${RANK_LAYERS.join(', ')}`);
    for (const layer of RANK_LAYERS) {
      if (rank[layer] === undefined) continue;
      if (!isObject(rank[layer]) || !isObject(job[layer])) {
        fail(at, `${layer} must be numbers for the job's own ${layer}`);
        continue;
      }
      for (const key of Object.keys(rank[layer])) {
        if (key === 'type' || key === 'name' || !(key in job[layer])) fail(at, `${layer} can't set "${key}": the job's ${layer} has no such number`);
      }
    }
    const ranked = jobAtRank(job, i + 1);
    if (rank.order && job.order) checkOrder(ranked.order, `${at} order`, fail);
    if (rank.station && job.station) checkEffects(ranked.station, STATION_EFFECTS, `${at} station`, fail);
    if (rank.colony && job.colony) checkEffects(ranked.colony, COLONY_EFFECTS, `${at} colony`, fail);
  });
}

// A job's ship or colony effects: { effect: amount }, each known, within
// its range.
function checkEffects(effects, known, where, fail) {
  if (!isObject(effects) || !Object.keys(effects).length) {
    fail(where, `must be an object of ${Object.keys(known).join(', ')}`);
    return;
  }
  for (const [key, value] of Object.entries(effects)) {
    if (!known[key]) fail(where, `unknown effect "${key}"`);
    else if (!isIntIn(value, ...known[key])) fail(where, `${key} must be a whole number from ${known[key][0]} to ${known[key][1]}`);
  }
}

// What a kind of tile does in a battle: whether units can stand on it, the
// cover it gives a unit beside it, and whether it blocks the line of sight.
function checkTileRule(rule, where, fail) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    fail(where, 'must be an object');
    return;
  }
  for (const key of Object.keys(rule)) {
    if (!TILE_RULE_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
  }
  for (const key of ['walk', 'blocksSight']) {
    if (rule[key] !== undefined && typeof rule[key] !== 'boolean') fail(where, `${key} must be true or false`);
  }
  if (rule.cover !== undefined && rule.cover !== 'half' && rule.cover !== 'full') fail(where, 'cover must be "half" or "full"');
  if (rule.walk && rule.cover) fail(where, 'a tile units stand on gives no cover');
}

// The side a part needs open to space (an engine's exhaust, a gun's
// barrel): { side, what }, where `what` names it in messages.
function checkFacesSpace(facesSpace, where, fail) {
  if (!facesSpace || typeof facesSpace !== 'object' || Array.isArray(facesSpace)) {
    fail(where, 'facesSpace must be { side, what }');
    return;
  }
  for (const key of Object.keys(facesSpace)) {
    if (key !== 'side' && key !== 'what') fail(where, `facesSpace: unknown field "${key}"`);
  }
  if (!SIDES.includes(facesSpace.side)) fail(where, 'facesSpace.side must be one of n, e, s, w');
  if (!isText(facesSpace.what)) fail(where, 'facesSpace.what must name what faces space, like "exhaust"');
}

function checkInterior(def, tilesPerCell, tiles, where, fail) {
  const [w, h] = def.size;
  const rows = h * tilesPerCell;
  const cols = w * tilesPerCell;
  if (!Array.isArray(def.interior) || def.interior.length !== rows) {
    fail(where, `interior must have ${rows} rows of tiles`);
    return;
  }
  def.interior.forEach((row, y) => {
    if (typeof row !== 'string' || [...row].length !== cols) {
      fail(where, `interior row ${y} must be ${cols} tiles wide`);
      return;
    }
    for (const char of row) {
      if (!(char in tiles)) fail(where, `interior row ${y}: "${char}" is not in the tiles legend`);
    }
  });
}

// A frame's shape: one row per cell row, '#' for hull and '.' for space,
// and every hull cell reachable from every other through hull cells (a ship
// in two pieces can't be joined to its bridge).
function checkShape(frame, where, fail) {
  const { shape, width, height } = frame;
  if (!Array.isArray(shape) || shape.length !== height) {
    fail(where, `shape must be a list of ${height} rows`);
    return;
  }
  const cells = [];
  for (const [y, row] of shape.entries()) {
    if (typeof row !== 'string' || row.length !== width || /[^#.]/.test(row)) {
      fail(where, `shape row ${y} must be ${width} characters of "#" (hull) and "." (space)`);
      return;
    }
    for (let x = 0; x < width; x++) if (row[x] === '#') cells.push(`${x},${y}`);
  }
  if (!cells.length) {
    fail(where, 'shape has no hull cells');
    return;
  }
  const hull = new Set(cells);
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop().split(',').map(Number);
    for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (hull.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  if (seen.size !== hull.size) fail(where, 'shape must be one piece: every "#" joined to the rest by its sides');
}

function checkStats(stats, where, fail) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    fail(where, 'stats must be an object');
    return;
  }
  for (const key of Object.keys(stats)) {
    if (!STATS.includes(key)) fail(where, `unknown stat "${key}"`);
  }
  for (const key of STATS) {
    const min = key === 'power' ? -Infinity : key === 'hp' ? 1 : 0;
    if (!isIntIn(stats[key], min, Infinity)) {
      fail(where, `stats.${key} must be a whole number${min === -Infinity ? '' : `, ${min} or more`}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let data;
  try {
    data = readData();
  } catch (err) {
    console.error(`validate-data: ${err.message}`);
    process.exit(1);
  }
  const problems = validateData(data);
  if (problems.length) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`validate-data: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    process.exit(1);
  }
  const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  console.log(
    `validate-data: OK (${count(data.modules.modules.length, 'module')}, ${count(data.frames.frames.length, 'frame')}, ` +
      `${count(data.manufacturers.manufacturers.length, 'manufacturer')}, ${count(data.hulls.hulls.length, 'hull style')}, ${count(data.styling.pieces.length, 'styling piece')}, ${count(data.weapons.weapons.length, 'weapon')}, ` +
      `${count(data.jobs.jobs.length, 'crew job')}, ${count(data.traits.traits.length, 'trait')}, ${count(data.recruits.backgrounds.length, "recruits' background")}, ${data.enemies.enemies.length} enem${data.enemies.enemies.length === 1 ? 'y' : 'ies'}, ` +
      `${count(data.encounters.encounters.length, 'encounter')}, ${count(data.ships.ships.length, 'ship preset')}, ` +
      `${count(data.campaign.acts.length, 'act')}, ${count(data.backgrounds.backgrounds.length, 'background')}, ` +
      `${count(data.districts.districts.length, 'district')}, ${count(data.sites.maps.length, 'site map')}, ` +
      `${count(data.contracts.jobs.length, 'job template')}, ${count(data.sectors.nodes.length, 'kind')} of sector node, ${count(data.worlds.kinds.length, 'kind')} of world, ${count(data.colony.buildings.length, 'colony building')}, ${count(data.colony.builds.length, 'colony build')}, ${count(data.expeditions.kinds.length, 'kind')} of place, ${count(data.events.events.length, 'event')}, ${count(data.factions.sides.length, 'side')})`,
  );
}
