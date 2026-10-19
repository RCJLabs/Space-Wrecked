// Words for a crew job (M32): its name, and what it does besides its
// numbers: its order in a fight, its ship effect and its colony effect, from
// the numbers in data/jobs.json, at a crew member's rank (M32b), and what
// each rank gives; and a loyal companion's third rank, their talent (M33c).
// The words for each kind live here; a job made of kinds already here needs
// no code (tests/crewJobText.test.js checks every kind has its words). rules
// are the content tables (src/sim/defs.js).
import { jobAtRank, nextRankAt, rankOf } from '../../sim/ranks.js';
import { talentOrder, TALENT_RANK } from '../../sim/talents.js';

// "+10", "−30": a change, signed.
const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
const plural = (n, one, many) => (n === 1 ? one : many);

// Each order kind's words (orders.js ORDER_KINDS), from the order.
export const ORDER_WORDS = {
  suppress: (o) => `an enemy in sight shoots at ${signed(o.aim)} to hit until its side's next turn ends. It ends the turn.`,
  weld: (o) => `the door beside them is welded shut for ${o.rounds} ${plural(o.rounds, 'round', 'rounds')}: no one walks or sees through it.`,
  patch: (o) => `an ally ${o.reach ? `in sight within ${o.reach} tiles` : 'beside'} gets ${o.hp} hit points back; one who is down gets up.`,
  hustle: (o) => `${o.ap} more ${plural(o.ap, 'action', 'actions')} this turn.`,
  mark: (o) => `the crew's shots at an enemy in sight are ${signed(o.aim)} to hit until the crew's next turn ends.`,
  sedate: (o) => `a dart at an enemy in sight, at a shot's odds${o.aim ? ` ${signed(o.aim)}` : ''}: a hit puts it to sleep through its side's next turn. It ends the turn.`,
  kit: (o) => `they or an ally beside get a full clip and ${o.armor} more armor${o.aim ? `, and aim ${signed(o.aim)}` : ''}, once each.`,
};

// Each ship effect's words (edges.js STATION_EFFECTS), from its number.
export const STATION_WORDS = {
  heal: (n) => `a working med bay heals ${n} more a jump`,
  gunnery: (n) => `the ship's guns are ${signed(n)} to hit in the approach`,
  evasion: (n) => `the ship's evasion is ${signed(n)} in the approach`,
  repair: (n) => `after each jump, ${n === 1 ? 'a wrecked part is' : `${n} wrecked parts are`} fixed, the cheapest first`,
  scan: (n) => `a scan reaches ${n} more ${plural(n, 'link', 'links')}`,
  freeSurvey: () => 'a survey takes no day: no supplies, no heat',
  lockers: (n) => `the lockers hold ${n} more supplies`,
  // M39's, which only parts bring: stealth baffles and hydroponics.
  quiet: (n) => `each jump adds ${n} less heat`,
  grows: (n) => `${n} ${plural(n, 'supply grows', 'supplies grow')} aboard each jump`,
};

// Each colony effect's words (edges.js COLONY_EFFECTS), from its number.
export const COLONY_WORDS = {
  heal: (n) => `a powered infirmary heals ${n} more a day`,
  landing: (n) => `each defense's shot at a lander is ${signed(n)} to hit`,
  mines: (n) => `each mine digs ${n} more ${plural(n, 'material', 'materials')} a day`,
  tripDays: (n) => `in the squad, a trip is ${n} ${plural(n, 'day', 'days')} shorter each way, never under 1`,
  places: (n) => `${n === 1 ? 'one more place is' : `${n} more places are`} within reach`,
  farms: (n) => `each farm grows ${n} more food a day`,
  stores: (n) => `the stores keep ${n} more food and ${n} more materials`,
};

// Each order kind's number, short, for what a rank gives (rankGives).
export const ORDER_SHORT = {
  suppress: (o) => `${signed(o.aim)} aim`,
  weld: (o) => `${o.rounds} ${plural(o.rounds, 'round', 'rounds')}`,
  patch: (o) => `${o.hp} hit points${o.reach ? `, ${o.reach} tiles` : ''}`,
  hustle: (o) => `+${o.ap} ${plural(o.ap, 'action', 'actions')}`,
  mark: (o) => `${signed(o.aim)} to hit`,
  sedate: (o) => `${signed(o.aim)} to hit`,
  kit: (o) => `+${o.armor} armor${o.aim ? `, ${signed(o.aim)} aim` : ''}`,
};

// The same, short, for a crew list's line (jobBrief).
export const STATION_SHORT = {
  heal: (n) => `med bay +${n}`,
  gunnery: (n) => `guns ${signed(n)}`,
  evasion: (n) => `evasion ${signed(n)}`,
  repair: (n) => (n === 1 ? 'fixes a wreck a jump' : `fixes ${n} wrecks a jump`),
  scan: (n) => `scans +${n} ${plural(n, 'link', 'links')}`,
  freeSurvey: () => 'free surveys',
  lockers: (n) => `lockers +${n}`,
  quiet: (n) => `jumps −${n} heat`,
  grows: (n) => `grows ${n} a jump`,
};
export const COLONY_SHORT = {
  heal: (n) => `infirmary +${n}`,
  landing: (n) => `lander shots ${signed(n)}`,
  mines: (n) => `mines +${n}`,
  tripDays: (n) => `trips −${n} ${plural(n, 'day', 'days')}`,
  places: (n) => `+${n} ${plural(n, 'place', 'places')}`,
  farms: (n) => `farms +${n}`,
  stores: (n) => `stores +${n}`,
};

// A job's name, or its id for one the data no longer has.
export function jobName(job, rules) {
  return rules.jobs.get(job)?.name ?? job;
}

// "Mara the scout": a crew member by name and job.
export function byJob(member, rules) {
  return `${member.name} the ${jobName(member.job, rules).toLowerCase()}`;
}

// What a job brings besides its numbers, at `rank` (0 for none): { order
// ("Suppress, 2 a fight: ..."), ship ("Aboard: ..."), colony ("At the
// colony: ...") }, each null where the job has none.
export function jobSaid(job, rules, rank = 0) {
  const def = jobAtRank(rules.jobs.get(job), rank);
  if (!def) return { order: null, ship: null, colony: null };
  const { order } = def;
  return {
    order: order && ORDER_WORDS[order.type] ? `${order.name}, ${order.uses} a fight: ${ORDER_WORDS[order.type](order)}` : null,
    ship: effectsSaid('Aboard', def.station, STATION_WORDS),
    colony: effectsSaid('At the colony', def.colony, COLONY_WORDS),
  };
}

// What a job brings at `rank`, on one short line: "Mark ×2 · scans +1
// link · +1 place" (its order and uses, then aboard, then at the colony).
// order, if given, is the order in the job's (a talent's, M33c). '' for a
// job the data lacks.
export function jobBrief(job, rules, rank = 0, order = null) {
  const def = jobAtRank(rules.jobs.get(job), rank);
  if (!def) return '';
  const short = (effects, words) => Object.entries(effects ?? {}).filter(([key]) => words[key]).map(([key, n]) => words[key](n));
  const orders = order ?? def.order;
  return [orders ? `${orders.name} ×${orders.uses}` : null, ...short(def.station, STATION_SHORT), ...short(def.colony, COLONY_SHORT)].filter(Boolean).join(' · ');
}

// What a crew member brings, on one short line (jobBrief at their rank): a
// loyal companion's order is their talent (M33c).
export function memberBrief(member, rules) {
  return jobBrief(member.job, rules, rankOf(member, rules), talentOf(member, rules)?.order ?? null);
}

// A loyal companion's talent (M33c, talents.js): { name, order (their
// job's order at the third rank) }, or null for anyone else.
export function talentOf(member, rules) {
  if (!member?.loyal || !member.companion) return null;
  const name = rules.companions?.get(member.companion)?.talent?.name;
  const order = talentOrder(rules, member.companion);
  return name && order ? { name, order } : null;
}

// The rank a crew member shows, in chevrons and words: a loyal companion's
// is the third, their talent's (M33c); anyone else's their job's (M32b).
export function shownRank(member, rules) {
  return talentOf(member, rules) ? TALENT_RANK : rankOf(member, rules);
}

// A talent's order and its numbers, short: "Weld ×3 a fight, 8 rounds".
export function talentGives(talent) {
  const { order } = talent;
  const short = ORDER_SHORT[order.type]?.(order);
  return `${order.name} ×${order.uses} a fight${short ? `, ${short}` : ''}`;
}

// What a job's rank gives over the rank below, short: "Suppress ×3 a
// fight, −40 aim", "med bay +2 · infirmary +2". '' for a rank the job
// lacks. orders: false leaves its order out, for a loyal companion's, whose
// order is their talent (M33c).
export function rankGives(job, rank, rules, orders = true) {
  const def = rules.jobs.get(job);
  if (!def?.ranks?.[rank - 1]) return '';
  const [below, at] = [jobAtRank(def, rank - 1), jobAtRank(def, rank)];
  const said = [];
  if (orders && at.order && at.order !== below.order) {
    const changed = Object.keys(at.order).filter((key) => at.order[key] !== below.order?.[key]);
    const parts = [
      changed.includes('uses') ? `×${at.order.uses} a fight` : null,
      changed.some((key) => key !== 'uses') ? ORDER_SHORT[at.order.type]?.(at.order) : null,
    ].filter(Boolean);
    if (parts.length) said.push(`${at.order.name} ${parts.join(', ')}`);
  }
  for (const [layer, words] of [['station', STATION_SHORT], ['colony', COLONY_SHORT]]) {
    if (at[layer] === below[layer]) continue;
    for (const [key, n] of Object.entries(at[layer] ?? {})) if (n !== below[layer]?.[key] && words[key]) said.push(words[key](n));
  }
  return said.join(' · ');
}

// A crew member's rank and fights, on one line: "Rank 1, Pinning fire · 4
// fights · rank 2 at 8", "2 fights · rank 1 at 3", "Rank 2, Gun captain · 9
// fights". stood: how a recruit's fights read ("9 fights stood"). A loyal
// companion is at the third rank, their talent's, and their job's next rank
// still comes with fights, by its name (M33c): "Rank 3, Bosun's weld · 4
// fights · Running repairs at 8".
export function rankLine(member, rules, stood = false) {
  const rank = rankOf(member, rules);
  const ranks = rules.jobs.get(member.job)?.ranks ?? [];
  const name = ranks[rank - 1]?.name;
  const talent = talentOf(member, rules);
  const fights = member.fights ?? 0;
  const next = nextRankAt(member, rules);
  const nextSaid = talent ? `${ranks[rank]?.name ?? `rank ${rank + 1}`} at ${next}` : `rank ${rank + 1} at ${next}`;
  return [
    talent ? `Rank ${TALENT_RANK}, ${talent.name}` : rank ? `Rank ${rank}${name ? `, ${name}` : ''}` : null,
    `${fights} ${plural(fights, 'fight', 'fights')}${stood ? ' stood' : ''}`,
    next === null ? null : nextSaid,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Who reaches a rank as a fight ends (campaign.js rankUps), a line each:
// "Rosa Vint reaches rank 1, Pinning fire: Suppress ×3 a fight, −40 aim."
// A loyal companion, at the third rank already, reaches the rank by its
// name (M33c): "Ines Varga reaches Running repairs: fixes 2 wrecks a jump."
export function rankUpLines(ups, rules) {
  return ups.map(({ member, rank }) => {
    const name = rules.jobs.get(member.job)?.ranks?.[rank - 1]?.name;
    const loyal = Boolean(talentOf(member, rules));
    const gives = rankGives(member.job, rank, rules, !loyal);
    const reaches = loyal && name ? name : `rank ${rank}${name ? `, ${name}` : ''}`;
    return `${member.name} reaches ${reaches}${gives ? `: ${gives}` : ''}.`;
  });
}

function effectsSaid(where, effects, words) {
  const said = Object.entries(effects ?? {})
    .filter(([key]) => words[key])
    .map(([key, n]) => words[key](n));
  return said.length ? `${where}: ${said.join('; ')}.` : null;
}
