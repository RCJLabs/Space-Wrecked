// The campaign slots kept in a key-value store (M63): which slot is in play,
// writing its save with the backup a write calls for, opening another slot,
// restoring a backup, and the reminder's mark. The rules are slots.js's; the
// store is anything with read(name) and write(name, text), so
// the game hands it localStorage (src/platform/saves.js) and the tests a Map.
// parse and serialize turn save text into data and back (save.js).
import { ACTIVE, BACKUPS, SLOTS, activeSlot, backupFor, backupName, markFor, markName, openedData, reminderDue, saveName, slotState } from './slots.js';

export function createSaves(kv, { parse, serialize }) {
  let slot = activeSlot(kv.read(ACTIVE));
  // The data last read from or written to the slot in play, and its text:
  // what a backup keeps.
  let last = null;
  let lastText = null;

  // The slot in play's save: null if it is empty, { ok: true, data } or
  // { ok: false, error, text } if it can't be read.
  function load() {
    last = null;
    lastText = null;
    const text = kv.read(saveName(slot));
    if (text === null) return null;
    const result = parse(text);
    if (!result.ok) return { ok: false, error: result.error, text };
    last = result.save.data;
    lastText = text;
    return { ok: true, data: result.save.data };
  }

  // Writes the slot in play's save, keeping first the backup the change
  // calls for. Returns false where storage refuses the save.
  function persist(data) {
    const text = serialize(data);
    const kind = backupFor(last, data);
    if (kind && lastText !== null) kv.write(backupName(slot, kind), lastText);
    last = data;
    lastText = text;
    return kv.write(saveName(slot), text);
  }

  // Keeps the campaign in play as the slot's replaced backup, before
  // something writes over it.
  function keepReplaced() {
    if (last?.campaign && lastText !== null) kv.write(backupName(slot, 'replaced'), lastText);
  }

  // Every slot, with what it holds and which backups it has.
  function list() {
    return Array.from({ length: SLOTS }, (_, i) => {
      const n = i + 1;
      const backups = BACKUPS.map((kind) => ({ kind, state: slotState(kv.read(backupName(n, kind)), parse) })).filter((b) => b.state.kind !== 'empty');
      return { slot: n, state: slotState(kv.read(saveName(n)), parse), backups };
    });
  }

  // Puts slot n in play. game is the game's data (settings, builds); rng an
  // RNG state for a slot with none. Returns { ok: true, data } to restore,
  // or { ok: false, error } for a slot that can't be read (it stays as it
  // is, and the slot in play with it).
  function open(n, game, rng) {
    const before = slot;
    slot = n;
    const loaded = load();
    if (loaded && !loaded.ok) {
      slot = before;
      load();
      return { ok: false, error: loaded.error };
    }
    kv.write(ACTIVE, String(n));
    return { ok: true, data: openedData(loaded?.data, game, rng) };
  }

  // Brings back one of the slot in play's backups, keeping the campaign it
  // replaces. Returns { ok: true, data } to restore, or { ok: false, error }.
  function restore(kind, game) {
    const text = kv.read(backupName(slot, kind));
    if (text === null) return { ok: false, error: 'That backup is gone.' };
    const result = parse(text);
    if (!result.ok) return { ok: false, error: result.error };
    keepReplaced();
    return { ok: true, data: openedData(result.save.data, game, game.rng) };
  }

  return {
    slot: () => slot,
    load,
    persist,
    keepReplaced,
    list,
    open,
    restore,
    reminderDue: (campaign) => reminderDue(campaign, kv.read(markName(slot))),
    markDone: (campaign) => campaign && kv.write(markName(slot), markFor(campaign)),
  };
}
