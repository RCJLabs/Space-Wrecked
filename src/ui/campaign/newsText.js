// Text for a colony's news (src/sim/colonies.js `news`, M38f): what
// happened there while the ship was away, the raids fought out without it
// and the citizens who came, settled and left. The colony screen's hint
// once the ship has landed there, the last of it on the chart's colony
// panels, and a trip's legs. rules are the content tables (src/sim/defs.js).
import { pursuerOf } from '../../sim/heat.js';
import { takenText } from './raidText.js';

// What the colony's news says, for the hint: { text, tone }, or null with
// none. "While the ship was away, Con-Reg Recovery's raiders were fought
// off on day 34; 1 colonist fell." tone: 'bad' with a raid lost, 'warn'
// with a colonist fallen or a citizen gone, else 'good'.
export function newsText(colony, campaign, rules) {
  const said = newsSaid(colony?.news ?? [], colony, campaign, rules);
  return said ? { text: `While the ship was away, ${said}.`, tone: newsTone(colony.news) } : null;
}

// The entries in words, joined by semicolons: each raid in turn, then the
// citizens who came, settled and left, and how many there are now; or
// null with none.
export function newsSaid(entries, colony, campaign, rules) {
  if (!entries.length) return null;
  const name = pursuerOf(campaign, rules)?.name ?? 'the pursuer';
  const raids = entries.filter((entry) => entry.kind === 'raid').map((entry) => raidSaid(entry, name, rules));
  const people = peopleSaid(entries, colony.citizens ?? 0);
  return [...raids, ...(people ? [people] : [])].join('; ');
}

// The tone of entries: see newsText.
export function newsTone(entries) {
  if (entries.some((entry) => entry.kind === 'raid' && !entry.won)) return 'bad';
  if (entries.some((entry) => entry.kind === 'left' || (entry.kind === 'raid' && entry.fell))) return 'warn';
  return 'good';
}

// The last entry, short, for a colony's panel on the chart: "Raid fought
// off, day 34 · 1 fell", or null with none.
export function newsLine(colony) {
  const last = colony?.news?.at(-1);
  if (!last) return null;
  if (last.kind !== 'raid') return `${{ grew: 'A citizen came', left: 'A citizen left', settled: 'A captive settled' }[last.kind]}, day ${last.day}`;
  const what = !last.landed ? 'Raid stopped landing' : last.won ? 'Raid fought off' : 'Raid lost';
  return `${what}, day ${last.day}${last.fell ? ` · ${last.fell} fell` : ''}`;
}

// A raid fought out, in words.
function raidSaid(entry, name, rules) {
  const fell = entry.fell ? `; ${entry.fell} colonist${entry.fell === 1 ? '' : 's'} fell` : '';
  if (!entry.landed) return `the guns stopped every one of ${name}'s raiders on day ${entry.day}`;
  if (entry.won) return `${name}'s raiders were fought off on day ${entry.day}${fell}`;
  return `${name}'s raiders won on day ${entry.day} and took ${takenText(entry, rules)}${fell}`;
}

// The citizens who came, settled and left, and how many there are now:
// "2 citizens came and 1 left, short of food: 3 now", or null with none.
function peopleSaid(entries, now) {
  const count = (kind) => entries.filter((entry) => entry.kind === kind).length;
  const [grew, settled, left] = [count('grew'), count('settled'), count('left')];
  const said = [
    ...(grew ? [grew === 1 ? 'a citizen came' : `${grew} citizens came`] : []),
    ...(settled ? [settled === 1 ? 'a freed captive settled' : `${settled} freed captives settled`] : []),
    ...(left ? [`${left === 1 ? 'one' : left} left, short of food`] : []),
  ];
  return said.length ? `${listed(said)}: ${now} now` : null;
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
