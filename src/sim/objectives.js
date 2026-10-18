// A job's objective in a battle (battle.js): what the crew came for besides
// the fight (ROADMAP §4.3). contracts.js makes it from the job's mission;
// these are its rules, and battle.js calls them. Each works on the draft
// battle it is given, replacing the objective rather than changing it, and
// gives back an error in words, or null.
//
// An objective, as a battle holds it:
//   { type: 'grab', crates, taken }       grab every crate, each from beside
//                                         it (M14)
//   { type: 'hack', at, turns, progress, worked }   work the terminal for
//                                         `turns` turns, once a round (M14)
//   { type: 'extract', crates, taken, out, exits }  carry every crate out to
//                                         a way out (the way in, exits):
//                                         taken are the crates picked up, out
//                                         those carried out; a crate in hand
//                                         is its carrier's `carrying` (M38)
//   { type: 'escort', ward, exits, out }  walk the ward (a unit's id) to the
//                                         far gate (exits); out once they
//                                         stand on it
//   { type: 'rescue', ward, exits, freed, out }   free the ward, held deep in
//                                         the site, and walk them out the way
//                                         the crew came in (exits)
//   { type: 'sabotage', targets, charges, blown }  a charge by every target:
//                                         charges [{ at, blows }] are those
//                                         set, each with the round it blows
//                                         in, at the start of the crew's
//                                         turn; blown the targets that have
//   { type: 'defend', rounds, line, held, through }  hold the way in (line)
//                                         to the end of round `rounds`: held
//                                         once it has, through the id of the
//                                         enemy that stepped onto it, or null
// The ward is the person the crew brings out (M38): a unit on the crew's
// side with `ward` set, moved as the crew are, with no gun. Held (rescue),
// their status is 'held' until freed. They are not crew: the crew wins or
// loses by its own, and the job is lost if the ward bleeds out.
import { inReach } from './terrain.js';

// The objective types the rules know, and the actions that work them.
export const OBJECTIVES = ['grab', 'hack', 'extract', 'escort', 'rescue', 'sabotage', 'defend'];
export const OBJECTIVE_ACTIONS = ['grab', 'hack', 'free', 'plant', 'pull'];

// An objective with nothing done yet, from what contracts.js gives: a grab
// or extract its crates (and an extract its exits), a hack its terminal and
// turns, an escort or rescue its ward and exits, a sabotage its targets and
// a defense its rounds and line.
export function startObjective(objective) {
  if (!objective) return null;
  const tiles = (list) => list.map(([x, y]) => [x, y]);
  switch (objective.type) {
    case 'grab':
      return { type: 'grab', crates: tiles(objective.crates), taken: [] };
    case 'hack':
      return { type: 'hack', at: [...objective.at], turns: objective.turns, progress: 0, worked: 0 };
    case 'extract':
      return { type: 'extract', crates: tiles(objective.crates), taken: [], out: [], exits: tiles(objective.exits) };
    case 'escort':
      return { type: 'escort', ward: objective.ward, exits: tiles(objective.exits), out: false };
    case 'rescue':
      return { type: 'rescue', ward: objective.ward, exits: tiles(objective.exits), freed: false, out: false };
    case 'sabotage':
      return { type: 'sabotage', targets: tiles(objective.targets), charges: [], blown: [] };
    case 'defend':
      return { type: 'defend', rounds: objective.rounds, line: tiles(objective.line), held: false, through: null };
    default:
      throw new Error(`createBattle: no objective "${objective.type}"`);
  }
}

// True once an objective is done: every crate grabbed, or carried out; every
// turn of work on the terminal had; the ward out; every target blown; the
// way in held to the last round.
export function objectiveDone(objective) {
  switch (objective?.type) {
    case 'grab':
      return objective.taken.length >= objective.crates.length;
    case 'hack':
      return objective.progress >= objective.turns;
    case 'extract':
      return objective.out.length >= objective.crates.length;
    case 'escort':
    case 'rescue':
      return objective.out === true;
    case 'sabotage':
      return objective.blown.length >= objective.targets.length;
    case 'defend':
      return objective.held === true;
    default:
      return false;
  }
}

// The battle's ward, or null.
export function wardOf(battle) {
  const id = battle.objective?.ward;
  return id ? battle.units.find((u) => u.id === id) ?? null : null;
}

// True once the ward has bled out, or died: the job is lost.
export function wardLost(battle) {
  const ward = wardOf(battle);
  return ward !== null && (ward.status === 'out' || ward.status === 'dead');
}

// An objective action by a unit with an action left (battle.js readyToAct):
//   { type: 'grab', unit, at }   grab a crate in reach; on an extract, or
//                                take the crate from a fallen carrier
//                                there
//   { type: 'hack', unit }       work the terminal in reach: its whole turn
//   { type: 'free', unit }       free the held ward in reach (rescue)
//   { type: 'plant', unit, at }  set a charge by a target in reach
//   { type: 'pull', unit, at }   an enemy pulls the charge set there
// Returns an error, or null.
export function objectiveAction(battle, unit, action, events) {
  const { objective } = battle;
  switch (action.type) {
    case 'grab':
      return objective?.type === 'extract' ? carry(battle, unit, action.at, events) : grab(battle, unit, action.at, events);
    case 'hack':
      return hack(battle, unit, events);
    case 'free':
      return free(battle, unit, events);
    case 'plant':
      return plant(battle, unit, action.at, events);
    case 'pull':
      return pull(battle, unit, action.at, events);
    default:
      return `Unknown action "${action.type}".`;
  }
}

function grab(battle, unit, at, events) {
  const { objective } = battle;
  const tile = asTile(at);
  if (unit.side !== 'crew' || objective?.type !== 'grab' || !tile || !has(objective.crates, tile)) return 'There is no crate to grab there.';
  if (has(objective.taken, tile)) return 'That crate is grabbed already.';
  if (!inReach(battle, [unit.x, unit.y], tile)) return `${unit.name} has to be next to the crate.`;
  unit.ap -= 1;
  const taken = [...objective.taken, tile];
  battle.objective = { ...objective, taken };
  events.push({ type: 'grab', unit: unit.id, at: tile, left: objective.crates.length - taken.length });
  return null;
}

function hack(battle, unit, events) {
  const { objective } = battle;
  if (unit.side !== 'crew' || objective?.type !== 'hack') return 'There is no terminal to work.';
  if (!inReach(battle, [unit.x, unit.y], objective.at)) return `${unit.name} has to be next to the terminal.`;
  if (objective.worked === battle.round) return 'The terminal has been worked this turn.';
  unit.ap = 0;
  const progress = objective.progress + 1;
  battle.objective = { ...objective, progress, worked: battle.round };
  events.push({ type: 'hack', unit: unit.id, progress, turns: objective.turns });
  return null;
}

// Extract: a crate off the ground, or out of a fallen carrier's hands, into
// the unit's. One at a time.
function carry(battle, unit, at, events) {
  const { objective } = battle;
  const tile = asTile(at);
  if (unit.side !== 'crew' || !tile) return 'There is no crate to grab there.';
  if (unit.carrying) return `${unit.name} has a crate in hand already.`;
  const fallen = battle.units.find((u) => u.carrying && u.status !== 'active' && u.x === tile[0] && u.y === tile[1]);
  if (fallen) {
    if (!inReach(battle, [unit.x, unit.y], tile)) return `${unit.name} has to be next to ${fallen.name}.`;
    unit.ap -= 1;
    unit.carrying = fallen.carrying;
    delete fallen.carrying;
    events.push({ type: 'grab', unit: unit.id, at: tile, from: fallen.id, left: cratesLeft(objective) });
    putOut(battle, unit, events);
    return null;
  }
  if (!has(objective.crates, tile)) return 'There is no crate to grab there.';
  if (has(objective.taken, tile)) return 'That crate has been picked up already.';
  if (!inReach(battle, [unit.x, unit.y], tile)) return `${unit.name} has to be next to the crate.`;
  unit.ap -= 1;
  unit.carrying = tile;
  battle.objective = { ...objective, taken: [...objective.taken, tile] };
  events.push({ type: 'grab', unit: unit.id, at: tile, left: cratesLeft(battle.objective) });
  putOut(battle, unit, events);
  return null;
}

// The crates not yet picked up.
function cratesLeft(objective) {
  return objective.crates.length - objective.taken.length;
}

function free(battle, unit, events) {
  const { objective } = battle;
  const ward = wardOf(battle);
  if (unit.side !== 'crew' || objective?.type !== 'rescue' || !ward || ward.status !== 'held') return 'There is no one to free.';
  if (!inReach(battle, [unit.x, unit.y], [ward.x, ward.y])) return `${unit.name} has to be next to ${ward.name}.`;
  unit.ap -= 1;
  // Freed, they act from the crew's next turn.
  ward.status = 'active';
  ward.ap = 0;
  battle.objective = { ...objective, freed: true };
  events.push({ type: 'free', unit: unit.id, target: ward.id });
  return null;
}

function plant(battle, unit, at, events) {
  const { objective } = battle;
  const tile = asTile(at);
  if (unit.side !== 'crew' || objective?.type !== 'sabotage' || !tile || !has(objective.targets, tile)) return 'There is no target there.';
  if (has(objective.blown, tile)) return 'That target has blown already.';
  if (objective.charges.some((charge) => same(charge.at, tile))) return 'A charge is set there already.';
  if (!inReach(battle, [unit.x, unit.y], tile)) return `${unit.name} has to be next to the target.`;
  unit.ap -= 1;
  const charge = { at: tile, blows: battle.round + 1 };
  battle.objective = { ...objective, charges: [...objective.charges, charge] };
  events.push({ type: 'plant', unit: unit.id, at: tile, blows: charge.blows });
  return null;
}

function pull(battle, unit, at, events) {
  const { objective } = battle;
  const tile = asTile(at);
  const charge = tile && objective?.type === 'sabotage' ? objective.charges.find((c) => same(c.at, tile)) : null;
  if (unit.side !== 'enemy' || !charge) return 'There is no charge there to pull.';
  if (!inReach(battle, [unit.x, unit.y], tile)) return `${unit.name} has to be next to the charge.`;
  unit.ap -= 1;
  battle.objective = { ...objective, charges: objective.charges.filter((c) => c !== charge) };
  events.push({ type: 'pull', unit: unit.id, at: tile });
  return null;
}

// After a unit's move, still standing: a carrier on a way out puts its
// crate out; the ward on theirs is out.
export function afterMove(battle, unit, events) {
  const { objective } = battle;
  if (unit.status !== 'active' || !objective) return;
  if (objective.type === 'extract') putOut(battle, unit, events);
  else if ((objective.type === 'escort' || objective.type === 'rescue') && objective.ward === unit.id && has(objective.exits, [unit.x, unit.y])) {
    battle.objective = { ...objective, out: true };
    events.push({ type: 'out', unit: unit.id, at: [unit.x, unit.y] });
  }
}

// A carrier standing on a way out: its crate is out.
function putOut(battle, unit, events) {
  const { objective } = battle;
  if (!unit.carrying || unit.status !== 'active' || !has(objective.exits, [unit.x, unit.y])) return;
  const crate = unit.carrying;
  delete unit.carrying;
  battle.objective = { ...objective, out: [...objective.out, crate] };
  events.push({ type: 'out', unit: unit.id, at: [unit.x, unit.y], crate, left: objective.crates.length - objective.out.length - 1 });
}

// Defending: true if an enemy stepping onto `at` breaks through, onto the
// way in (the line).
export function steppedThrough(battle, unit, at) {
  const { objective } = battle;
  return objective?.type === 'defend' && unit.side === 'enemy' && !objective.through && has(objective.line, at);
}

// The enemy has broken through at `at`: the defense is lost.
export function breakThrough(battle, unit, at, events) {
  battle.objective = { ...battle.objective, through: unit.id };
  events.push({ type: 'through', unit: unit.id, at: [at[0], at[1]] });
}

// Defending: as a round's last turn ends, the way in held to the last
// round. True if it has been.
export function holdOut(battle) {
  const { objective } = battle;
  if (objective?.type !== 'defend' || battle.side === battle.first || battle.round < objective.rounds) return false;
  battle.objective = { ...objective, held: true };
  return true;
}

// Sabotage: the charges due to blow as the crew's turn starts, taken off
// and counted blown. Returns their tiles, in the order they were set.
export function chargesDue(battle) {
  const { objective } = battle;
  if (objective?.type !== 'sabotage' || battle.side !== 'crew') return [];
  const due = objective.charges.filter((charge) => charge.blows <= battle.round);
  if (!due.length) return [];
  battle.objective = { ...objective, charges: objective.charges.filter((charge) => !due.includes(charge)), blown: [...objective.blown, ...due.map((charge) => charge.at)] };
  return due.map((charge) => [...charge.at]);
}

// The units a blast at `at` hurts: everyone standing beside it, on either
// side, with nothing between (terrain.js inReach).
export function blastHits(battle, at) {
  return battle.units.filter((u) => u.status === 'active' && inReach(battle, [u.x, u.y], at));
}

function asTile(at) {
  return Array.isArray(at) && at.length === 2 && Number.isInteger(at[0]) && Number.isInteger(at[1]) ? [at[0], at[1]] : null;
}

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function has(list, tile) {
  return list.some((at) => same(at, tile));
}
