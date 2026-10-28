// Campaign slots, their backups and the reminder to export (M63): the rules,
// pure, so Node can test them. src/platform/saves.js keeps them in storage.
//
// Each slot is a whole save (save.js), stored as JSON text under its own
// key; slot 1's is the key the game has always used, so a save from before
// slots is slot 1 as it was. The settings and the sandbox's ships are the
// game's, not a slot's: whichever slot is in play writes them, and a slot
// opened takes them from the game. So does the record across runs (M64).
//
// A slot keeps up to three backups, the latest of each kind:
//   act2      the save as it stood just before the lift-off into act 2
//   act3      just before the settling into act 3
//   replaced  the campaign a New game, an import or a restore wrote over
//
// The reminder: when the campaign in play reaches an act with no save code
// made (or Later tapped) since, the title says so. The mark is the campaign's
// seed and the act it was made in, so a new campaign starts unmarked.

export const SLOTS = 3;
export const BACKUPS = ['act2', 'act3', 'replaced'];

// Storage names, before storage.js's app prefix.
export const ACTIVE = 'slot';
export function saveName(slot) {
  return slot === 1 ? 'save' : `save:${slot}`;
}
export function backupName(slot, kind) {
  return `save:${slot}:${kind}`;
}
export function markName(slot) {
  return `exported:${slot}`;
}

// The slot in play, from what storage holds: 1 to SLOTS, else 1.
export function activeSlot(text) {
  const slot = Number(text);
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOTS ? slot : 1;
}

// The backup a write calls for, going from the data last written (`prev`) to
// `next`, or null. A campaign gone, or another in its place, is replaced; the
// same campaign an act further on is that act's; the same one an act back
// (a backup restored) is replaced too.
export function backupFor(prev, next) {
  const before = prev?.campaign;
  if (!before) return null;
  const after = next?.campaign;
  if (!after || after.seed !== before.seed) return 'replaced';
  if (after.act > before.act) return BACKUPS.includes(`act${after.act}`) ? `act${after.act}` : null;
  if (after.act < before.act) return 'replaced';
  return null;
}

// The data a slot opens with: its own campaign and RNG, the game's settings,
// ships and record across runs (M64). An empty slot has no campaign and the
// RNG it is given (a fresh one, so its New game rolls its own).
export function openedData(slotData, game, freshRng) {
  return {
    settings: game.settings,
    builds: game.builds,
    profile: game.profile,
    rng: slotData?.rng ?? freshRng,
    campaign: slotData?.campaign ?? null,
  };
}

// The reminder's mark for a campaign: "seed:act".
export function markFor(campaign) {
  return `${campaign.seed}:${campaign.act}`;
}

// Whether the title reminds the player to make a save code: a campaign under
// way, and no mark for it at its act or later.
export function reminderDue(campaign, mark) {
  if (!campaign) return false;
  const [seed, act] = String(mark ?? '').split(':').map(Number);
  return !(seed === campaign.seed && act >= campaign.act);
}

// What a slot holds, from its stored text and parse (save.js parseSave):
// { kind: 'empty' } | { kind: 'campaign', campaign } | { kind: 'none' } (a
// save with no campaign: the sandbox only) | { kind: 'broken', error }.
export function slotState(text, parse) {
  if (text === null || text === undefined) return { kind: 'empty' };
  const result = parse(text);
  if (!result.ok) return { kind: 'broken', error: result.error };
  const { campaign } = result.save.data;
  return campaign ? { kind: 'campaign', campaign } : { kind: 'none' };
}

// A backup's name, for the Campaigns screen.
export const BACKUP_NAMES = { act2: 'Before act 2', act3: 'Before act 3', replaced: 'The one replaced' };
