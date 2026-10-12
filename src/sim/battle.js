// A squad battle on a battle map (mapFromShip.js), as plain data. Every
// action turns a battle into a new one plus the events it caused, and the
// events are the battle's log (battleLog.js tells them in words). Seeded:
// every roll comes from battle.rng (core/rng.js), so the same battle and the
// same actions always play out the same way. Functions never change their
// input. ROADMAP §4.3 has the rules.
//
// A battle:
//   map      the battle map; it never changes
//   units    [{ id, side, kind, name, x, y, hp, maxHp, aim, defense,
//              mobility, armor, weapon, ammo, ap, overwatch, status,
//              bleed, air }]
//            side is 'crew' or 'enemy'. status is 'active', 'down'
//            (bleeding out: `bleed` more of its side's turns), 'stable',
//            'dead', or 'out' (bled out where death isn't permanent). ap is
//            the actions left this turn and air the suit air left, in turns.
//   doors    the keys of the doors opened so far (mapFromShip.js edgeKey)
//   side     whose turn it is; first, the side that started
//   round    from 1; a round is both sides' turns
//   rng      the RNG state
//   misses   { crew, enemy }: shots missed in a row (forgiving odds)
//   options  { forgiving, permadeath, sight?, deadline? }. sight, where a
//            job's twist sets it, is how far anyone sees, in tiles, in
//            place of balance.sightRange. deadline is the last round the
//            crew has: if it hasn't won by the end of its turn then, it has
//            lost.
//   objective  null, or what the crew came for besides the fight (a job's
//            mission, contracts.js); once it is done, the crew has won:
//              { type: 'grab', crates: [[x, y]...], taken: [[x, y]...] }
//                the crates to grab, and those grabbed so far
//              { type: 'hack', at: [x, y], turns, progress, worked }
//                the terminal, the turns of work it needs and has had,
//                and the round it was last worked in (0 for never)
//   winner   null, or the side that won: the one still standing, or the
//            crew once its objective is done, or the enemy once the
//            crew's deadline has passed
//
// Actions, each by a unit of the side whose turn it is (act):
//   { type: 'move', unit, to: [x, y] }   1 action within its mobility, or
//                                        2 within twice that (a dash)
//   { type: 'shoot', unit, target }      ends the unit's turn
//   { type: 'overwatch', unit }          ends the unit's turn; it shoots the
//                                        first enemy that moves in its sight
//   { type: 'reload', unit }             1 action
//   { type: 'stabilize', unit, target }  1 action: a downed ally beside it
//                                        stops bleeding
//   { type: 'open', unit, side }         1 action: opens the door on that
//                                        side of its tile ('n', 'e', 's', 'w')
//   { type: 'grab', unit, at: [x, y] }   1 action: the crew grabs a crate of
//                                        the objective's in its reach
//                                        (terrain.js inReach)
//   { type: 'hack', unit }               ends the unit's turn: the crew works
//                                        the terminal in its reach, a turn of
//                                        work, once a round
//   { type: 'end' }                      ends the side's turn
// A side's turn also ends by itself once none of its units has an action
// left.
import { int, percent, seedFrom } from '../core/rng.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { reachable, sideToward } from './moves.js';
import { shotOdds } from './odds.js';
import { canSee } from './sight.js';
import { hazardAt, inReach, walkable } from './terrain.js';

// setup: { map, units: [{ kind, x, y, name?, hp? }], seed, first?,
// options?, objective? }. kind is a crew job (data/jobs.json), which puts
// the unit on the crew's side, or an enemy (data/enemies.json). A unit
// starts with its kind's hit points, or with hp if given: a wounded crew
// member's, from 1 up to its kind's. Units get ids by side in order: c1,
// c2... and e1, e2... seed is a number or a string. The objective starts
// with nothing done: give a grab its crates and a hack its terminal and
// turns. The first side's turn starts at once. Returns { battle, events }.
export function createBattle({ map, units, seed, first = 'crew', options = {}, objective = null }, rules) {
  const counts = { crew: 0, enemy: 0 };
  const battle = {
    map,
    units: units.map(({ kind, x, y, name, hp: wounded }) => {
      const job = rules.jobs.get(kind);
      const template = job ?? rules.enemies.get(kind);
      if (!template) throw new Error(`createBattle: no job or enemy "${kind}"`);
      const side = job ? 'crew' : 'enemy';
      counts[side] += 1;
      const { hp, aim, defense, mobility, armor, weapon } = template;
      if (wounded !== undefined && !(Number.isInteger(wounded) && wounded >= 1 && wounded <= hp)) {
        throw new RangeError(`createBattle: ${name ?? template.name} can't start with ${wounded} hit points (1 to ${hp})`);
      }
      return {
        id: `${side === 'crew' ? 'c' : 'e'}${counts[side]}`,
        side,
        kind,
        name: name ?? template.name,
        x,
        y,
        hp: wounded ?? hp,
        maxHp: hp,
        aim,
        defense,
        mobility,
        armor,
        weapon,
        ammo: rules.weapons.get(weapon).clip,
        ap: 0,
        overwatch: false,
        status: 'active',
        bleed: 0,
        air: rules.balance.suitAir,
      };
    }),
    doors: [],
    side: first,
    first,
    round: 1,
    rng: seedFrom(seed),
    misses: { crew: 0, enemy: 0 },
    options: { forgiving: false, permadeath: false, ...options },
    objective: startObjective(objective),
    winner: null,
  };
  const taken = new Set();
  for (const unit of battle.units) {
    if (!walkable(battle, unit.x, unit.y, rules)) throw new RangeError(`createBattle: ${unit.name} can't stand at (${unit.x}, ${unit.y})`);
    if (taken.has(`${unit.x},${unit.y}`)) throw new RangeError(`createBattle: two units at (${unit.x}, ${unit.y})`);
    taken.add(`${unit.x},${unit.y}`);
  }
  const events = [];
  startTurn(battle, events, rules);
  return { battle, events };
}

function startObjective(objective) {
  if (!objective) return null;
  if (objective.type === 'grab') return { type: 'grab', crates: objective.crates.map(([x, y]) => [x, y]), taken: [] };
  if (objective.type === 'hack') return { type: 'hack', at: [...objective.at], turns: objective.turns, progress: 0, worked: 0 };
  throw new Error(`createBattle: no objective "${objective.type}"`);
}

// Applies one action. Returns { ok: true, battle, events } or
// { ok: false, error }, leaving the battle as it was.
export function act(battle, action, rules) {
  if (battle.winner) return { ok: false, error: 'The battle is over.' };
  const next = draft(battle);
  const events = [];
  let error = null;
  if (action.type === 'end') {
    endTurn(next, events, rules);
  } else {
    const unit = next.units.find((u) => u.id === action.unit);
    error = readyToAct(next, unit, action);
    if (!error) error = doAction(next, unit, action, events, rules);
    if (!error && !next.winner && !next.units.some((u) => u.side === next.side && u.status === 'active' && u.ap > 0)) {
      endTurn(next, events, rules);
    }
  }
  return error ? { ok: false, error } : { ok: true, battle: next, events };
}

// Plays a list of actions from a setup. Returns { battle, events, error }:
// error is null, or { index, message } for the first action that failed.
export function playBattle(setup, actions, rules) {
  let { battle, events } = createBattle(setup, rules);
  events = [...events];
  for (const [index, action] of actions.entries()) {
    const result = act(battle, action, rules);
    if (!result.ok) return { battle, events, error: { index, message: result.error } };
    battle = result.battle;
    events.push(...result.events);
  }
  return { battle, events, error: null };
}

// The enemies a unit could shoot now, with the odds: [{ target, odds }].
export function targetsFor(battle, unit, rules) {
  return battle.units
    .filter((u) => u.side !== unit.side && u.status === 'active' && canSee(battle, [unit.x, unit.y], [u.x, u.y], rules))
    .map((target) => ({ target, odds: shotOdds(battle, unit, target, rules) }));
}

function draft(battle) {
  return { ...battle, units: battle.units.map((u) => ({ ...u })), doors: [...battle.doors], misses: { ...battle.misses } };
}

function readyToAct(battle, unit, action) {
  if (!unit) return `There is no unit "${action.unit}".`;
  if (unit.side !== battle.side) return `It isn't the ${unit.side}'s turn.`;
  if (unit.status !== 'active') return `${unit.name} is ${unit.status}.`;
  if (unit.ap < 1) return `${unit.name} has no actions left this turn.`;
  return null;
}

// Carries out a unit's action on the draft. Returns an error, or null.
function doAction(battle, unit, action, events, rules) {
  switch (action.type) {
    case 'move':
      return move(battle, unit, action.to, events, rules);
    case 'shoot': {
      const target = battle.units.find((u) => u.id === action.target);
      if (!target || target.side === unit.side) return `${unit.name} can't shoot that.`;
      if (target.status !== 'active') return `${target.name} is already down.`;
      if (unit.ammo < 1) return `${unit.name} has to reload first.`;
      if (!canSee(battle, [unit.x, unit.y], [target.x, target.y], rules)) return `${unit.name} can't see ${target.name}.`;
      unit.ap = 0;
      fire(battle, unit, target, false, events, rules);
      return null;
    }
    case 'overwatch':
      if (unit.ammo < 1) return `${unit.name} has to reload first.`;
      unit.ap = 0;
      unit.overwatch = true;
      events.push({ type: 'overwatch', unit: unit.id });
      return null;
    case 'reload': {
      const weapon = rules.weapons.get(unit.weapon);
      if (unit.ammo >= weapon.clip) return `${unit.name}'s ${weapon.name.toLowerCase()} is full.`;
      unit.ap -= 1;
      unit.ammo = weapon.clip;
      events.push({ type: 'reload', unit: unit.id, ammo: weapon.clip });
      return null;
    }
    case 'stabilize': {
      const target = battle.units.find((u) => u.id === action.target);
      if (!target || target.side !== unit.side || target.status !== 'down') return `${unit.name} can only stabilize an ally who is down.`;
      if (Math.max(Math.abs(target.x - unit.x), Math.abs(target.y - unit.y)) > 1) return `${unit.name} has to be next to ${target.name}.`;
      unit.ap -= 1;
      target.status = 'stable';
      target.bleed = 0;
      events.push({ type: 'stabilize', unit: unit.id, target: target.id });
      return null;
    }
    case 'open': {
      if (!SIDES.includes(action.side) || wallAt(battle.map, unit.x, unit.y, action.side) !== 'door') return `There's no door on that side of ${unit.name}.`;
      const key = edgeKey(unit.x, unit.y, action.side);
      if (battle.doors.includes(key)) return 'That door is open already.';
      unit.ap -= 1;
      battle.doors = [...battle.doors, key].sort();
      events.push({ type: 'door', unit: unit.id, at: [unit.x, unit.y], side: action.side });
      return null;
    }
    case 'grab': {
      const { objective } = battle;
      const at = Array.isArray(action.at) ? action.at : [];
      const same = ([x, y]) => x === at[0] && y === at[1];
      if (unit.side !== 'crew' || objective?.type !== 'grab' || !objective.crates.some(same)) return 'There is no crate to grab there.';
      if (objective.taken.some(same)) return 'That crate is grabbed already.';
      if (!inReach(battle, [unit.x, unit.y], at)) return `${unit.name} has to be next to the crate.`;
      unit.ap -= 1;
      const taken = [...objective.taken, [at[0], at[1]]];
      battle.objective = { ...objective, taken };
      events.push({ type: 'grab', unit: unit.id, at: [at[0], at[1]], left: objective.crates.length - taken.length });
      decide(battle, events);
      return null;
    }
    case 'hack': {
      const { objective } = battle;
      if (unit.side !== 'crew' || objective?.type !== 'hack') return 'There is no terminal to work.';
      if (!inReach(battle, [unit.x, unit.y], objective.at)) return `${unit.name} has to be next to the terminal.`;
      if (objective.worked === battle.round) return 'The terminal has been worked this turn.';
      unit.ap = 0;
      const progress = objective.progress + 1;
      battle.objective = { ...objective, progress, worked: battle.round };
      events.push({ type: 'hack', unit: unit.id, progress, turns: objective.turns });
      decide(battle, events);
      return null;
    }
    default:
      return `Unknown action "${action.type}".`;
  }
}

function move(battle, unit, to, events, rules) {
  const [x, y] = to ?? [];
  if (x === unit.x && y === unit.y) return `${unit.name} is already there.`;
  const spot = reachable(battle, unit, unit.mobility * Math.min(unit.ap, 2), rules).get(`${x},${y}`);
  if (!spot) return `${unit.name} can't get to (${x}, ${y}) this turn.`;
  unit.ap -= spot.cost <= unit.mobility ? 1 : 2;
  walk(battle, unit, spot.path, events, rules);
  return null;
}

// Walks a unit along its path a step at a time: doors open as it passes,
// and every enemy on overwatch that can see the tile it steps onto fires,
// in turn. If it goes down it stops there, so overwatch holds fire while it
// passes through an ally's tile: two units never share one. The walk is
// told as legs: a 'move' event for each stretch between doors and shots.
function walk(battle, unit, path, events, rules) {
  let leg = [path[0]];
  const tell = () => {
    if (leg.length > 1) events.push({ type: 'move', unit: unit.id, path: leg });
    leg = [leg.at(-1)];
  };
  for (let i = 1; i < path.length; i++) {
    const [from, to] = [path[i - 1], path[i]];
    const side = sideToward(from, to);
    const key = edgeKey(from[0], from[1], side);
    if (wallAt(battle.map, from[0], from[1], side) === 'door' && !battle.doors.includes(key)) {
      tell();
      battle.doors = [...battle.doors, key].sort();
      events.push({ type: 'door', unit: unit.id, at: from, side });
    }
    unit.x = to[0];
    unit.y = to[1];
    leg.push(to);
    const shared = battle.units.some((u) => u !== unit && u.status !== 'dead' && u.x === to[0] && u.y === to[1]);
    for (const watcher of shared ? [] : battle.units) {
      if (watcher.side === unit.side || watcher.status !== 'active' || !watcher.overwatch) continue;
      if (!canSee(battle, [watcher.x, watcher.y], to, rules)) continue;
      tell();
      watcher.overwatch = false;
      fire(battle, watcher, unit, true, events, rules);
      if (unit.status !== 'active') break;
    }
    if (unit.status !== 'active') break;
  }
  tell();
}

// One shot, rolled: hit, then crit, then damage, each from the battle's RNG.
function fire(battle, shooter, target, overwatch, events, rules) {
  const odds = shotOdds(battle, shooter, target, rules, { overwatch });
  const weapon = rules.weapons.get(shooter.weapon);
  shooter.ammo -= 1;
  const hit = percent(battle.rng, odds.hit);
  battle.rng = hit.state;
  const shot = { type: 'shot', unit: shooter.id, target: target.id, overwatch, chance: odds.hit, roll: hit.roll, hit: hit.value, band: odds.band, cover: odds.cover };
  if (!hit.value) {
    battle.misses[shooter.side] += 1;
    events.push(shot);
    return;
  }
  battle.misses[shooter.side] = 0;
  const crit = percent(battle.rng, odds.crit);
  const roll = int(crit.state, weapon.damage[0], weapon.damage[1]);
  battle.rng = roll.state;
  const damage = Math.max(1, roll.value + (crit.value ? weapon.critDamage : 0) - target.armor);
  events.push({ ...shot, critChance: odds.crit, critRoll: crit.roll, crit: crit.value, damage });
  hurt(battle, target, damage, events, rules);
}

// Takes damage off a unit. At 0, crew go down and bleed out; enemies die.
function hurt(battle, unit, damage, events, rules) {
  unit.hp = Math.max(0, unit.hp - damage);
  if (unit.hp > 0) return;
  unit.ap = 0;
  unit.overwatch = false;
  if (unit.side === 'crew') {
    unit.status = 'down';
    unit.bleed = rules.balance.bleedOutTurns;
    events.push({ type: 'down', unit: unit.id, bleed: unit.bleed });
  } else {
    unit.status = 'dead';
    events.push({ type: 'dead', unit: unit.id });
  }
  decide(battle, events);
}

// A side's turn ends. The crew's, in its deadline's round, ends the battle.
function endTurn(battle, events, rules) {
  events.push({ type: 'end', side: battle.side });
  for (const unit of battle.units) if (unit.side === battle.side) unit.ap = 0;
  const { deadline } = battle.options;
  if (deadline && battle.side === 'crew' && battle.round >= deadline) {
    win(battle, 'enemy', events, 'deadline');
    return;
  }
  battle.side = battle.side === 'crew' ? 'enemy' : 'crew';
  if (battle.side === battle.first) battle.round += 1;
  startTurn(battle, events, rules);
}

// A side's turn begins: its units' overwatch ends and their actions come
// back; then, unit by unit, fire burns, suits use air in vacuum, and the
// downed bleed.
function startTurn(battle, events, rules) {
  const { balance } = rules;
  events.push({ type: 'turn', side: battle.side, round: battle.round });
  for (const unit of battle.units) {
    if (unit.side !== battle.side || battle.winner) continue;
    if (unit.status === 'active') {
      unit.overwatch = false;
      unit.ap = balance.actionPoints;
      const hazard = hazardAt(battle, unit.x, unit.y);
      if (hazard === 'fire' && balance.fireDamage > 0) {
        events.push({ type: 'hazard', unit: unit.id, hazard, damage: balance.fireDamage });
        hurt(battle, unit, balance.fireDamage, events, rules);
      } else if (hazard === 'vacuum') {
        if (unit.air > 0) {
          unit.air -= 1;
          events.push({ type: 'air', unit: unit.id, air: unit.air });
        } else if (balance.airlessDamage > 0) {
          events.push({ type: 'hazard', unit: unit.id, hazard, damage: balance.airlessDamage });
          hurt(battle, unit, balance.airlessDamage, events, rules);
        }
      }
    } else if (unit.status === 'down') {
      unit.bleed -= 1;
      if (unit.bleed > 0) {
        events.push({ type: 'bleed', unit: unit.id, bleed: unit.bleed });
      } else {
        unit.status = battle.options.permadeath ? 'dead' : 'out';
        events.push({ type: 'bled out', unit: unit.id, dead: battle.options.permadeath });
      }
    }
  }
  decide(battle, events);
}

// The battle is over when one side has no one active left, or when the
// crew has done what it came for.
function decide(battle, events) {
  if (battle.winner) return;
  const standing = (side) => battle.units.some((u) => u.side === side && u.status === 'active');
  if (!standing('enemy')) win(battle, 'crew', events);
  else if (!standing('crew')) win(battle, 'enemy', events);
  else if (objectiveDone(battle.objective)) win(battle, 'crew', events, 'objective');
}

// True once an objective is done: every crate grabbed, or every turn of
// work on the terminal had.
export function objectiveDone(objective) {
  if (objective?.type === 'grab') return objective.taken.length >= objective.crates.length;
  if (objective?.type === 'hack') return objective.progress >= objective.turns;
  return false;
}

// The 'over' event says why only when it wasn't a side left standing.
function win(battle, winner, events, reason = null) {
  battle.winner = winner;
  events.push(reason ? { type: 'over', winner, reason } : { type: 'over', winner });
}
