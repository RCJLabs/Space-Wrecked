// The record across runs (M64): the game's, like the settings, shared by
// every campaign slot (src/core/slots.js). Pure.
//
//   profile.reached  { act, won }: the furthest any run has gone, the
//                    reckoning won by any; what opens the boons
//                    (modifiers.js unlocked). It never goes back.
//   profile.runs     the latest RUNS runs, newest first: { seed,
//                    background, difficulty, permadeath, modifiers, week,
//                    act (the furthest reached), won, over }
//
// noteRun keeps it as play goes: called with each campaign the game moves
// to (root.js), it updates the run's entry and the furthest reached, and
// hands back the same profile when nothing changed.
import { DIFFICULTIES } from './difficulty.js';
import { gameOver } from './campaign.js';
import { isWeek, MAX_MODIFIERS } from './modifiers.js';

export const RUNS = 20;

export function emptyProfile() {
  return { reached: { act: 0, won: false }, runs: [] };
}

// The profile with this campaign's progress in it.
export function noteRun(profile, campaign) {
  if (!campaign) return profile;
  const entry = runEntry(campaign);
  const at = profile.runs.findIndex((run) => sameRun(run, entry));
  const before = at >= 0 ? profile.runs[at] : null;
  const run = before ? { ...entry, act: Math.max(before.act, entry.act), won: before.won || entry.won, over: before.over || entry.over } : entry;
  const reached = { act: Math.max(profile.reached.act, run.act), won: profile.reached.won || run.won };
  const same = before && before.act === run.act && before.won === run.won && before.over === run.over;
  if (same && reached.act === profile.reached.act && reached.won === profile.reached.won) return profile;
  const runs = [run, ...profile.runs.filter((_, i) => i !== at)].slice(0, RUNS);
  return { reached, runs };
}

// A campaign's entry in the record.
export function runEntry(campaign) {
  return {
    seed: campaign.seed,
    background: campaign.background,
    difficulty: campaign.difficulty,
    permadeath: campaign.permadeath,
    modifiers: [...(campaign.modifiers ?? [])],
    week: campaign.week ?? null,
    act: campaign.act,
    won: campaign.ending?.won === true,
    over: gameOver(campaign),
  };
}

function sameRun(a, b) {
  return a.seed === b.seed && a.background === b.background && a.week === b.week;
}

// What is wrong with a stored profile: a list of problems, empty if none.
export function profileProblems(profile) {
  if (!isRecord(profile)) return ['The record is missing or unreadable.'];
  const problems = [];
  const { reached, runs } = profile;
  if (!isRecord(reached) || !isInt(reached.act, 0, 3) || typeof reached.won !== 'boolean') problems.push('The record\'s furthest run is unreadable.');
  if (!Array.isArray(runs) || runs.length > RUNS || !runs.every(isRun)) problems.push('The record\'s runs are unreadable.');
  return problems;
}

function isRun(run) {
  return (
    isRecord(run) &&
    isInt(run.seed, 0, 0xffffffff) &&
    typeof run.background === 'string' &&
    DIFFICULTIES.includes(run.difficulty) &&
    typeof run.permadeath === 'boolean' &&
    Array.isArray(run.modifiers) &&
    run.modifiers.length <= MAX_MODIFIERS &&
    run.modifiers.every((id) => typeof id === 'string') &&
    (run.week === null || isWeek(run.week)) &&
    isInt(run.act, 1, 3) &&
    typeof run.won === 'boolean' &&
    typeof run.over === 'boolean'
  );
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}
