#!/usr/bin/env node
// Checks the content files in data/: required fields, types, ranges and
// cross-references. Adding content never needs an engine edit, so mistakes
// in it have to be caught here instead.
//
//   node tools/validate-data.js
import { pathToFileURL } from 'node:url';
import { CAPTAIN_TRAITS } from '../src/sim/campaign.js';
import { REQUIRED_TAGS } from '../src/sim/constraints.js';
import { SITE_CHARS } from '../src/sim/gen/site.js';
import { TRAIT_STATS } from '../src/sim/traits.js';
import { TIP_IDS } from '../src/ui/tipSteps.js';
import { isIntIn, isListIn, isRange, isText, listOf, uniqueIds } from './checks.js';
import { readData } from './data.js';
import { checkCampaignFiles, checkStartShips } from './validate-campaign.js';

const SIDES = ['n', 'e', 's', 'w'];
const STATS = ['power', 'mass', 'thrust', 'berths', 'lifeSupport', 'cargo', 'hp'];
const MODULE_KEYS = ['id', 'name', 'glyph', 'manufacturer', 'size', 'rotates', 'facesSpace', 'stats', 'tags', 'interior', 'cost'];
const FRAME_KEYS = ['id', 'name', 'width', 'height', 'shape', 'maxModules', 'minThrustToMass'];
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
};
const WEAPON_KEYS = ['id', 'name', 'damage', 'accuracy', 'crit', 'critDamage', 'clip'];
const RANGE_BANDS = ['close', 'mid', 'long'];
// Crew jobs and enemies are both fighters, with the same fields.
const FIGHTER_KEYS = ['id', 'name', 'hp', 'aim', 'defense', 'mobility', 'armor', 'weapon'];
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
const SHIP_KEYS = ['id', 'name', 'frame', 'crew', 'beam', 'symmetric', 'parts', 'wrecks'];
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
];

// Returns a list of problems as "where: what" strings. Empty means valid.
export function validateData(data) {
  const { modules: moduleFile, frames: frameFile, manufacturers: makerFile, balance, weapons: weaponFile, jobs: jobFile, enemies: enemyFile, tiles: tileFile, encounters: encounterFile, ships: shipFile } = data;
  const problems = [];
  const fail = (where, message) => problems.push(`${where}: ${message}`);

  const makers = listOf(makerFile, 'manufacturers', 'manufacturers.json', fail);
  const makerIds = uniqueIds(makers, 'manufacturers.json', fail);
  makers.forEach((maker, i) => {
    if (!isText(maker.name)) fail(`manufacturers.json #${i}`, 'name must be a non-empty string');
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
    if (!(balance.rumorHeat < balance.huntHeat && balance.huntHeat < balance.raidHeat)) fail('balance.json', 'heat thresholds must rise: rumorHeat, then huntHeat, then raidHeat');
    if (!(balance.heatAfterRaid < balance.raidHeat)) fail('balance.json', 'heatAfterRaid must be under raidHeat, or one raid brings the next');
    if (balance.loudJobHeat < balance.jobHeat) fail('balance.json', 'loudJobHeat must be at least jobHeat');
    if (balance.sellPercent > balance.buyPercent) fail('balance.json', 'sellPercent must be at most buyPercent, or buying and selling makes money');
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
  jobs.forEach((job, i) => checkFighter(job, `jobs.json ${job.id ?? `#${i}`}`, weaponIds, fail));
  enemies.forEach((enemy, i) => checkFighter(enemy, `enemies.json ${enemy.id ?? `#${i}`}`, weaponIds, fail));
  const enemyIds = new Set(enemies.map((enemy) => enemy.id));
  checkTraits(data.traits, fail);
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

  const modules = listOf(moduleFile, 'modules', 'modules.json', fail);
  uniqueIds(modules, 'modules.json', fail);
  const glyphs = new Set();
  modules.forEach((def, i) => {
    const where = `modules.json ${def.id ?? `#${i}`}`;
    for (const key of Object.keys(def)) {
      if (!MODULE_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(def.name)) fail(where, 'name must be a non-empty string');
    if (typeof def.glyph !== 'string' || [...def.glyph].length !== 1 || def.glyph === '.' || def.glyph.trim() === '') {
      fail(where, 'glyph must be one visible character other than "."');
    } else if (glyphs.has(def.glyph)) {
      fail(where, `glyph "${def.glyph}" is already used`);
    } else {
      glyphs.add(def.glyph);
    }
    if (!makerIds.has(def.manufacturer)) fail(where, `unknown manufacturer "${def.manufacturer}"`);
    if (typeof def.rotates !== 'boolean') fail(where, 'rotates must be true or false');
    if (!isIntIn(def.cost, 0, Infinity)) fail(where, 'cost must be a whole number, 0 or more');

    const sizeOk = Array.isArray(def.size) && def.size.length === 2 && def.size.every((n) => isIntIn(n, 1, MAX_MODULE_SIZE));
    if (!sizeOk) {
      fail(where, `size must be [width, height] in cells, each from 1 to ${MAX_MODULE_SIZE}`);
    } else if (isIntIn(tilesPerCell, 1, 8) && tiles) {
      checkInterior(def, tilesPerCell, tiles, where, fail);
    }
    if (def.facesSpace !== undefined) checkFacesSpace(def.facesSpace, where, fail);
    checkStats(def.stats, where, fail);
    if (!Array.isArray(def.tags)) {
      fail(where, 'tags must be a list');
    } else {
      for (const tag of def.tags) {
        if (!KNOWN_TAGS.includes(tag)) fail(where, `unknown tag "${tag}"`);
      }
      if (new Set(def.tags).size !== def.tags.length) fail(where, 'tags has duplicates');
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
  const frameById = new Map(frames.map((frame) => [frame.id, frame]));
  ships.forEach((ship, i) => checkShip(ship, `ships.json ${ship.id ?? `#${i}`}`, frameById, moduleIds, fail));

  const encounterById = new Map(encounters.filter((e) => Array.isArray(e.enemies)).map((e) => [e.id, e.enemies]));
  const scripts = checkCampaignFiles(data, { jobIds, enemyIds, moduleIds, frameById, encounters: encounterById }, fail);
  // The starting ships are built only from content that checks out.
  if (!problems.length) checkStartShips(data, scripts, fail);
  return problems;
}

// A ship preset: the frame a generated ship is built on, the crew it has to
// carry (berths and life support), how many cells across it should be (its
// beam), whether it is mirrored about its middle row, its parts bow to stern
// (each a count, or [least, most]) and, for a derelict, how many rooms are
// wrecked.
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

// A weapon: damage [least, most], an accuracy change at each range band, a
// crit chance and extra damage on a crit, and the shots in a clip.
// The traits: each with a name, a line about it, and what it adds to a
// fighter's numbers, at least one of them. A captain picks CAPTAIN_TRAITS,
// so there are at least that many.
function checkTraits(file, fail) {
  const traits = listOf(file, 'traits', 'traits.json', fail);
  uniqueIds(traits, 'traits.json', fail);
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
}

// A crew job or an enemy: what it brings to a battle.
function checkFighter(fighter, where, weaponIds, fail) {
  for (const key of Object.keys(fighter)) {
    if (!FIGHTER_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
  }
  if (!isText(fighter.name)) fail(where, 'name must be a non-empty string');
  const ranges = { hp: [1, 99], aim: [0, 100], defense: [0, 100], mobility: [1, 20], armor: [0, 20] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!isIntIn(fighter[key], min, max)) fail(where, `${key} must be a whole number from ${min} to ${max}`);
  }
  if (!weaponIds.has(fighter.weapon)) fail(where, `unknown weapon "${fighter.weapon}"`);
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
      `${count(data.manufacturers.manufacturers.length, 'manufacturer')}, ${count(data.weapons.weapons.length, 'weapon')}, ` +
      `${count(data.jobs.jobs.length, 'crew job')}, ${count(data.traits.traits.length, 'trait')}, ${data.enemies.enemies.length} enem${data.enemies.enemies.length === 1 ? 'y' : 'ies'}, ` +
      `${count(data.encounters.encounters.length, 'encounter')}, ${count(data.ships.ships.length, 'ship preset')}, ` +
      `${count(data.campaign.acts.length, 'act')}, ${count(data.backgrounds.backgrounds.length, 'background')}, ` +
      `${count(data.districts.districts.length, 'district')}, ${count(data.sites.maps.length, 'site map')}, ` +
      `${count(data.contracts.jobs.length, 'job template')})`,
  );
}
