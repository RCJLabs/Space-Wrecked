// All persistent storage goes through here: localStorage for now, IndexedDB if
// saves outgrow it. Every access is wrapped, because storage can throw
// (private windows, full quota, blocked site data).
//
// Keys are namespaced with config.appId, so they never collide with anything
// else stored on the same origin.
import { config } from '../config.js';
import { checksum } from '../core/codec.js';

const key = (name) => `${config.appId}:${name}`;

function get(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function set(k, value) {
  try {
    localStorage.setItem(k, value);
    return true;
  } catch {
    return false;
  }
}

function remove(k) {
  try {
    localStorage.removeItem(k);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}

// Any stored text by name: the campaign slots, their backups and marks
// (M63, named in src/core/slots.js; slot 1's is "save", as it always was).
// writeText returns false where storage is unavailable or full.
export function readText(name) {
  return get(key(name));
}

export function writeText(name, text) {
  return set(key(name), text);
}

// Keeps a copy of a save that failed to load, so writing a fresh save never
// destroys it. Returns the key it was kept under.
export function backupBrokenSave(text) {
  const backupKey = key(`save:broken:${checksum(text)}`);
  if (get(backupKey) === null) set(backupKey, text);
  return backupKey;
}

export function readFlag(name) {
  return get(key(name)) === '1';
}

export function writeFlag(name, on) {
  if (on) set(key(name), '1');
  else remove(key(name));
}

// Asks the browser not to evict our storage. Chrome decides silently (no
// prompt) and grants it to installed apps, so this runs on every launch until
// it is granted rather than only on the first one, which is usually a browser
// tab. Resolves to true or false, or null where unsupported.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
