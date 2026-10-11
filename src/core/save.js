// Save format, versioning and export codes.
//
// A save is { version, data }. Loading always runs parse -> migrate ->
// validate. SAVE_VERSION gates the schema: never change what goes into `data`
// without bumping SAVE_VERSION and adding a migration. Never reset saves.
import { config } from '../config.js';
import { checksum, fromBase64Url, toBase64Url } from './codec.js';
import { isState } from './rng.js';
import { isShipData } from '../sim/builder.js';
import { FPS_CAPS } from '../sim/settings.js';

// History:
//   0  settings and RNG state (M0)
//   1  plus the builder's ship, or null before one is started (M3)
export const SAVE_VERSION = 1;

// Ordered list. Each step takes `data` from version `from` to `from + 1` and
// returns the new data. Never edit a shipped step; add a new one instead.
export const MIGRATIONS = [
  // The ship joins the save. Saves from before M3 have none yet.
  { from: 0, up: (data) => (isObject(data) ? { ...data, ship: null } : data) },
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
  if (data.ship !== null && !isShipData(data.ship)) problems.push('The ship is missing or unreadable.');
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
