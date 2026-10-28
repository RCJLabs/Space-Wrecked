// Run modifiers and the week's run (M64). Pure.
//
// A modifier (data/modifiers.json) changes a new campaign's start only: its
// credits, heat, standing, crew or parts. A burden is open from the first
// game; a boon opens once the record (record.js) has gone far enough: an
// act reached by any run, or the reckoning won. The campaign keeps the ids
// it started with (campaign.modifiers).
//
// The week's run is made from the ISO week alone (weekKey, "2026-W44"):
// its seed and two modifiers, a burden and one other, the same for every
// player that week. The campaign keeps the week (campaign.week).
import { pick, seedFrom } from '../core/rng.js';
import { STANDING_MAX, STANDING_MIN } from './standing.js';

export const MAX_MODIFIERS = 6;

// Whether a modifier is open to a record's reached ({ act, won }).
export function unlocked(def, reached) {
  const { unlock } = def;
  if (!unlock) return true;
  if (unlock.won) return reached?.won === true;
  return (reached?.act ?? 0) >= unlock.act;
}

// Why these modifiers can't start a game for this record, or null.
export function modifiersProblem(rules, ids, reached) {
  if (!Array.isArray(ids) || ids.length > MAX_MODIFIERS || new Set(ids).size !== ids.length) return 'Pick each modifier once.';
  for (const id of ids) {
    const def = rules.modifiers.get(id);
    if (!def) return `There is no modifier "${id}".`;
    if (!unlocked(def, reached)) return `${def.name} isn't open yet.`;
  }
  return null;
}

// A new campaign with its modifiers' starts applied, in data order.
export function withModifiers(campaign, rules, ids) {
  let next = { ...campaign, modifiers: [...ids] };
  for (const def of rules.modifiers.values()) {
    if (!ids.includes(def.id)) continue;
    const { credits = 0, heat = 0, standing = 0, crew = 0, parts = 0 } = def.start;
    next = { ...next, credits: next.credits + credits, heat: Math.max(next.heat, heat) };
    if (standing) next = { ...next, standing: Object.fromEntries(Object.entries(next.standing).map(([side, value]) => [side, Math.max(STANDING_MIN, Math.min(STANDING_MAX, value + standing))])) };
    if (parts) next = { ...next, parts: Object.fromEntries(Object.entries(next.parts).map(([type, count]) => [type, count + parts])) };
    // The crew left behind: the last who isn't the captain, while at least
    // one would stay with them.
    for (let n = crew; n < 0 && next.crew.length > 1; n++) {
      const left = next.crew.findLast((member) => member.id !== next.captain);
      next = { ...next, crew: next.crew.filter((member) => member !== left) };
    }
  }
  return next;
}

// The ISO week ("2026-W44") of a calendar day: weeks start on Monday, and
// week 1 is the one with the year's first Thursday. year, month (1-12) and
// day are numbers; the phone's date is the UI's to read. Day counts, no
// clock.
export function weekKey(year, month, day) {
  const days = daysFrom(year, month, day);
  const weekday = (((days + 3) % 7) + 7) % 7; // Monday 0 (1970-01-01 a Thursday)
  const thursday = days + 3 - weekday;
  const isoYear = yearOf(thursday);
  const week = 1 + Math.floor((thursday - daysFrom(isoYear, 1, 1)) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

// Days from 1970-01-01 to a calendar day, and the year a day count falls
// in (the civil calendar's arithmetic, for any year from 1 on).
function daysFrom(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function yearOf(days) {
  let year = Math.floor(days / 365.2425) + 1970;
  while (daysFrom(year, 1, 1) > days) year--;
  while (daysFrom(year + 1, 1, 1) <= days) year++;
  return year;
}

const WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

export function isWeek(value) {
  return typeof value === 'string' && WEEK.test(value);
}

// The week's run: { seed, modifiers }, from the week alone: a burden, then
// one more of any kind.
export function weeklyRun(rules, week) {
  const all = [...rules.modifiers.values()];
  const rng = seedFrom(`week ${week}`);
  const first = pick(rng, all.filter((def) => def.kind === 'burden'));
  const second = pick(first.state, all.filter((def) => def !== first.value));
  const seed = seedFrom(`week seed ${week}`) >>> 0;
  return { seed, modifiers: all.filter((def) => def === first.value || def === second.value).map((def) => def.id) };
}
