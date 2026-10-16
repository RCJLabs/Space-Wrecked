// Words for a crew job (M32): its name, and what it does besides its
// numbers: its order in a fight, its ship effect and its colony effect, from
// the numbers in data/jobs.json. The words for each kind live here; a job
// made of kinds already here needs no code (tests/crewJobText.test.js checks
// every kind has its words). rules are the content tables (src/sim/defs.js).

// "+10", "−30": a change, signed.
const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
const plural = (n, one, many) => (n === 1 ? one : many);

// Each order kind's words (orders.js ORDER_KINDS), from the order.
export const ORDER_WORDS = {
  suppress: (o) => `an enemy in sight shoots at ${signed(o.aim)} to hit until its side's next turn ends. It ends the turn.`,
  weld: (o) => `the door beside them is welded shut for ${o.rounds} ${plural(o.rounds, 'round', 'rounds')}: no one walks or sees through it.`,
  patch: (o) => `an ally beside gets ${o.hp} hit points back; one who is down gets up.`,
  hustle: (o) => `${o.ap} more ${plural(o.ap, 'action', 'actions')} this turn.`,
  mark: (o) => `the crew's shots at an enemy in sight are ${signed(o.aim)} to hit until the crew's next turn ends.`,
  sedate: () => "a dart at an enemy in sight, at a shot's odds: a hit puts it to sleep through its side's next turn. It ends the turn.",
  kit: (o) => `they or an ally beside get a full clip and ${o.armor} more armor, once each.`,
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

// The same, short, for a crew list's line (jobBrief).
export const STATION_SHORT = {
  heal: (n) => `med bay +${n}`,
  gunnery: (n) => `guns ${signed(n)}`,
  evasion: (n) => `evasion ${signed(n)}`,
  repair: (n) => (n === 1 ? 'fixes a wreck a jump' : `fixes ${n} wrecks a jump`),
  scan: (n) => `scans +${n} ${plural(n, 'link', 'links')}`,
  freeSurvey: () => 'free surveys',
  lockers: (n) => `lockers +${n}`,
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

// What a job brings besides its numbers: { order ("Suppress, 2 a fight:
// ..."), ship ("Aboard: ..."), colony ("At the colony: ...") }, each null
// where the job has none.
export function jobSaid(job, rules) {
  const def = rules.jobs.get(job);
  if (!def) return { order: null, ship: null, colony: null };
  const { order } = def;
  return {
    order: order && ORDER_WORDS[order.type] ? `${order.name}, ${order.uses} a fight: ${ORDER_WORDS[order.type](order)}` : null,
    ship: effectsSaid('Aboard', def.station, STATION_WORDS),
    colony: effectsSaid('At the colony', def.colony, COLONY_WORDS),
  };
}

// What a job brings, on one short line: "Mark ×2 · scans +1 link · +1
// place" (its order and uses, then aboard, then at the colony). '' for a
// job the data lacks.
export function jobBrief(job, rules) {
  const def = rules.jobs.get(job);
  if (!def) return '';
  const short = (effects, words) => Object.entries(effects ?? {}).filter(([key]) => words[key]).map(([key, n]) => words[key](n));
  return [def.order ? `${def.order.name} ×${def.order.uses}` : null, ...short(def.station, STATION_SHORT), ...short(def.colony, COLONY_SHORT)].filter(Boolean).join(' · ');
}

function effectsSaid(where, effects, words) {
  const said = Object.entries(effects ?? {})
    .filter(([key]) => words[key])
    .map(([key, n]) => words[key](n));
  return said.length ? `${where}: ${said.join('; ')}.` : null;
}
