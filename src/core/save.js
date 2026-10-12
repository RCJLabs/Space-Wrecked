// Save format, versioning and export codes.
//
// A save is { version, data }. Loading always runs parse -> migrate ->
// validate. SAVE_VERSION gates the schema: never change what goes into `data`
// without bumping SAVE_VERSION and adding a migration. Never reset saves.
import { config } from '../config.js';
import { checksum, fromBase64Url, toBase64Url } from './codec.js';
import { isState } from './rng.js';
import { isShipData } from '../sim/builder.js';
import { emptyBuilds, isBuilds } from '../sim/builds.js';
import { campaignProblems } from '../sim/campaign.js';
import { regridCommand, regridShip } from '../sim/regrid.js';
import { isCommand, logFor, renumbered } from '../sim/replay.js';
import { FPS_CAPS } from '../sim/settings.js';

// History:
//   0  settings and RNG state (M0)
//   1  plus the builder's ship, or null before one is started (M3)
//   2  the ship becomes saved slots with build logs (builds.js) (M5)
//   3  the builder's cells split in four: ships and logs move to the fine
//      grid (regrid.js) (M5b)
//   4  plus the campaign (campaign.js), or null before one starts (M12)
//   5  the campaign's background, its job board, and jobs as fights: a
//      fight's job and its battle's objective (M14)
//   6  raids: a fight says whether it is the pursuer's raid (M15)
//   7  the shop: the campaign's stock at the shop, or null until one is
//      rolled, and the jobs done that only come once (M16)
export const SAVE_VERSION = 7;

// Ordered list. Each step takes `data` from version `from` to `from + 1` and
// returns the new data. Never edit a shipped step; add a new one instead.
export const MIGRATIONS = [
  // The ship joins the save. Saves from before M3 have none yet.
  { from: 0, up: (data) => (isObject(data) ? { ...data, ship: null } : data) },
  // The one ship becomes slot 1, numbered in build order with a log that
  // builds it part by part. No ship yet: no slots.
  {
    from: 1,
    up: (data) => {
      if (!isObject(data)) return data;
      const { ship, ...rest } = data;
      if (ship === null || ship === undefined) return { ...rest, builds: emptyBuilds() };
      const tidy = isShipData(ship) ? renumbered(ship) : ship;
      return { ...rest, builds: { active: 0, slots: [{ name: 'Ship 1', ship: tidy, log: isShipData(ship) ? logFor(tidy) : [] }] } };
    },
  },
  // Every slot's ship and build log move to the fine grid, part for part.
  // Anything unreadable is left as it is for validate to report.
  {
    from: 2,
    up: (data) => {
      if (!isObject(data) || !isObject(data.builds) || !Array.isArray(data.builds.slots)) return data;
      const slots = data.builds.slots.map((slot) => {
        if (!isObject(slot)) return slot;
        const ship = isShipData(slot.ship) ? regridShip(slot.ship) : slot.ship;
        const log = Array.isArray(slot.log) ? slot.log.map((command) => (isCommand(command) ? regridCommand(command) : command)) : slot.log;
        return { ...slot, ship, log };
      });
      return { ...data, builds: { ...data.builds, slots } };
    },
  },
  // The campaign joins the save. Saves from before M12 have none yet.
  { from: 3, up: (data) => (isObject(data) ? { ...data, campaign: null } : data) },
  // Jobs join the campaign. Every campaign so far began as the debt-bound
  // miner, the only start there was, and has no board yet (the hub rolls
  // one); a fight on is a fight at home, with no job and no objective.
  {
    from: 4,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { fight } = data.campaign;
      const job = isObject(fight) ? { ...fight, job: null, battle: isObject(fight.battle) ? { ...fight.battle, objective: null } : fight.battle } : fight;
      return { ...data, campaign: { ...data.campaign, background: 'miner', board: [], fight: job } };
    },
  },
  // Raids join the campaign. A fight on from before was a job or a fight
  // at home, never a raid.
  {
    from: 5,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.fight)) return data;
      return { ...data, campaign: { ...data.campaign, fight: { ...data.campaign.fight, raid: false } } };
    },
  },
  // The shop opens. A campaign from before has no stock yet: the hangar
  // rolls one, as it rolled a board for saves from before jobs. No job
  // was only done once before.
  {
    from: 6,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, shop: null, spent: [] } } : data),
  },
];

const PREFIX = config.appId;

export class SaveError extends Error {}

export function makeSave(data) {
  return { version: SAVE_VERSION, data };
}

// Runs every migration step from save.version up to `target`, in version
// order. Throws SaveError if a step is missing or the save is newer than the
// game. The input is not changed.
export function migrate(save, { migrations = MIGRATIONS, target = SAVE_VERSION } = {}) {
  if (!Number.isInteger(save.version) || save.version < 0) {
    throw new SaveError('The save has no valid version number.');
  }
  if (save.version > target) {
    throw new SaveError(
      `This save is from a newer version of the game (save v${save.version}, game v${target}). Update the game and try again.`,
    );
  }
  let version = save.version;
  let data = clone(save.data);
  while (version < target) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new SaveError(`No migration from save v${version} to v${version + 1}.`);
    data = step.up(data);
    version += 1;
  }
  return { version, data };
}

// Checks a save against the current schema. Returns a list of problems;
// an empty list means the save is valid.
export function validate(save) {
  if (!isObject(save)) return ['The save is not an object.'];
  const problems = [];
  if (save.version !== SAVE_VERSION) problems.push(`Its version is ${save.version}, expected ${SAVE_VERSION}.`);
  const data = save.data;
  if (!isObject(data)) return [...problems, 'It has no data.'];
  if (!isState(data.rng)) problems.push('The RNG state is missing or invalid.');
  if (!isObject(data.settings)) problems.push('Settings are missing.');
  else if (!FPS_CAPS.includes(data.settings.fpsCap)) problems.push('The frame cap setting is invalid.');
  if (!isBuilds(data.builds)) problems.push('The saved ships are missing or unreadable.');
  if (data.campaign === undefined) problems.push('The campaign is missing.');
  else if (data.campaign !== null) problems.push(...campaignProblems(data.campaign));
  return problems;
}

// Loads a save stored as JSON text. Returns { ok: true, save } or
// { ok: false, error } with a message for the player. Never throws.
export function parseSave(text, options) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    return fail('The save is not valid JSON.');
  }
  return checkSave(save, options);
}

export function exportSave(save) {
  const body = `${PREFIX}.${save.version}.${toBase64Url(JSON.stringify(save))}`;
  return `${body}.${checksum(body)}`;
}

// Reads a code made by exportSave. Whitespace and line breaks are ignored, so
// codes survive being pasted through chat apps. Returns { ok: true, save } or
// { ok: false, error }. Never throws.
export function importSave(text, options) {
  const code = String(text ?? '').replace(/\s+/g, '');
  if (!code) return fail('Paste a save code first.');
  const parts = code.split('.');
  if (parts[0] !== PREFIX) {
    return fail(`That isn't a save code for this game. Save codes start with "${PREFIX}.".`);
  }
  if (parts.length !== 4) return fail('The code is incomplete or has extra text. Copy the whole code and try again.');
  const [, versionText, payload, sum] = parts;
  if (!/^\d+$/.test(versionText)) return fail('The code is damaged: its version number is unreadable.');
  if (checksum(`${PREFIX}.${versionText}.${payload}`) !== sum.toLowerCase()) {
    return fail("The code is damaged: its checksum doesn't match. Copy the whole code again.");
  }
  let save;
  try {
    save = JSON.parse(fromBase64Url(payload));
  } catch {
    return fail("The code is damaged and can't be read.");
  }
  if (!isObject(save) || save.version !== Number(versionText)) {
    return fail("The code is damaged: its version doesn't match its contents.");
  }
  return checkSave(save, options);
}

function checkSave(save, { validate: check = validate, ...migrateOptions } = {}) {
  if (!isObject(save)) return fail('The save is not an object.');
  let migrated;
  try {
    migrated = migrate(save, migrateOptions);
  } catch (err) {
    return fail(err instanceof SaveError ? err.message : `Updating the save failed: ${err.message}`);
  }
  const problems = check(migrated);
  if (problems.length) return fail(`The save is damaged. ${problems.join(' ')}`);
  return { ok: true, save: migrated };
}

function fail(error) {
  return { ok: false, error };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
