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
//              bleed, air, uses, mark, suppressed, asleep, kitted, rank?,
//              talent?, ward?, carrying?, hauled? }]
//            side is 'crew' or 'enemy'. status is 'active', 'down'
//            (bleeding out: `bleed` more of its side's turns), 'stable',
//            'dead', 'out' (bled out where death isn't permanent), or
//            'held' (a rescue's captive, until freed). ap is the actions
//            left this turn and air the suit air left, in turns. uses,
//            mark, suppressed, asleep and kitted are what the crew's orders
//            leave (orders.js, M32). A ward (M38, objectives.js) is the
//            person the crew brings out: on the crew's side, with no weapon
//            (null). carrying is the crate a carrier has in hand on an
//            extract, and hauled is set once it has moved this turn
//   doors    the keys of the doors opened so far (mapFromShip.js edgeKey)
//   welds    the doors welded shut, [{ key, until }] (orders.js)
//   fires    absent until a weapon's hit sets a tile burning (weapons.js
//            burn, M37), then [{ at: [x, y], until }]: each burns as a
//            wrecked room's fire does through round `until`
//   side     whose turn it is; first, the side that started
//   round    from 1; a round is both sides' turns
//   rng      the RNG state
//   misses   { crew, enemy }: shots missed in a row (forgiving odds)
//   options  { forgiving, permadeath, sight?, deadline?, press? }. sight,
//            where a job's twist sets it, is how far anyone sees, in tiles,
//            in place of balance.sightRange. deadline is the last round the
//            crew has: if it hasn't won by the end of its turn then, it has
//            lost. press: the enemy presses on (press.js), as a raid's
//            raiders do, rather than playing as the AI alone.
//   objective  null, or what the crew came for besides the fight (a job's
//            mission, contracts.js), as objectives.js has it: a grab, a
//            hack, an extract, an escort, a rescue, a sabotage or a
//            defense. Once it is done, the crew has won
//   winner   null, or the side that won: the one still standing, or the
//            crew once its objective is done, or the enemy once the
//            crew's deadline has passed, the ward is lost or an enemy has
//            broken through
//
// Actions, each by a unit of the side whose turn it is (act):
//   { type: 'move', unit, to: [x, y] }   1 action within its mobility, or
//                                        2 within twice that (a dash)
//   { type: 'shoot', unit, target }      ends the unit's turn; a burst is
//                                        several shots (weapons.js)
//   { type: 'overwatch', unit }          ends the unit's turn; it shoots the
//                                        first enemy that moves in its sight
//   { type: 'reload', unit }             1 action
//   { type: 'stabilize', unit, target }  1 action: a downed ally beside it
//                                        stops bleeding
//   { type: 'open', unit, side }         1 action: opens the door on that
//                                        side of its tile ('n', 'e', 's', 'w')
//   { type: 'grab', unit, at: [x, y] }   1 action: the crew grabs a crate of
//                                        the objective's in its reach
//                                        (terrain.js inReach), or on an
//                                        extract picks one up to carry
//   { type: 'hack', unit }               ends the unit's turn: the crew works
//                                        the terminal in its reach, a turn of
//                                        work, once a round
//   { type: 'free', unit }               1 action: frees the held ward in its
//                                        reach (a rescue)
//   { type: 'plant', unit, at: [x, y] }  1 action: sets a charge by a target
//                                        in its reach (a sabotage)
//   { type: 'pull', unit, at: [x, y] }   1 action: an enemy pulls the charge
//                                        set there
//   (objectives.js has the rules for these five.)
//   { type: 'order', unit, target?, side? }  the unit's job's order, at a
//                                        unit or a door's side (orders.js)
//   { type: 'end' }                      ends the side's turn
// A side's turn also ends by itself once none of its units has an action
// left. A ward can only move.
import { int, percent, seedFrom } from '../core/rng.js';
import { godMode } from './god.js';
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { moveRange, reachable, sideToward } from './moves.js';
import { afterMove, blastHits, breakThrough, chargesDue, holdOut, OBJECTIVE_ACTIONS, objectiveAction, objectiveDone, startObjective, steppedThrough, wardLost } from './objectives.js';
import { shotOdds } from './odds.js';
import { doOrder, endOrders, endWelds, freshOrders, wakeTurn } from './orders.js';
import { jobAtRank } from './ranks.js';
import { talentOrder } from './talents.js';
import { canSee } from './sight.js';
import { hazardAt, walkable, weldedAt } from './terrain.js';
import { armorAgainst, outOfReach, shotsOf, withinReach } from './weapons.js';

// setup: { map, units: [{ kind, x, y, name?, hp?, bonus?, rank?, talent?,
// weapon?, held? }], seed, first?, options?, objective? }. kind is a crew job
// (data/jobs.json), which puts the unit on the crew's side, an enemy
// (data/enemies.json), or a person the crew brings out (`people` in
// data/contracts.json, M38): a ward, on the crew's side with no weapon, id
// w1, w2..., held if `held` (a rescue's captive).
// bonus adds to its kind's numbers: { hp, aim, defense, mobility, armor },
// each optional (a captain's traits, the difficulty), with at least 1 hit
// point and 1 of mobility left. rank is a crew member's job rank (ranks.js,
// M32b): their order is the rank's, and a unit above rank 0 keeps it as
// `rank`. talent is a loyal companion's id (M33c, talents.js): their order is
// their talent, past rank 2, and the unit keeps it as `talent`. weapon is
// the weapon a crew member carries (M37, loadout.js), in place of their
// kind's. A unit starts
// with all its hit points, or with hp if given: a wounded crew member's, from
// 1 up. Units get ids by side in order: c1, c2... and e1,
// e2... seed is a number or a string. The
// objective starts with nothing done: give a grab its crates and a hack its
// terminal and turns. The first side's turn starts at once. Returns
// { battle, events }.
export function createBattle({ map, units, seed, first = 'crew', options = {}, objective = null }, rules) {
  const counts = { crew: 0, enemy: 0, ward: 0 };
  const battle = {
    map,
    units: units.map(({ kind, x, y, name, hp: wounded, bonus = {}, rank = 0, talent = null, weapon: carried = null, held = false }) => {
      const job = rules.jobs.get(kind);
      const person = job ? null : rules.people?.get(kind) ?? null;
      const template = job ?? person ?? rules.enemies.get(kind);
      if (!template) throw new Error(`createBattle: no job, person or enemy "${kind}"`);
      const side = job || person ? 'crew' : 'enemy';
      const team = person ? 'ward' : side;
      counts[team] += 1;
      const add = (key) => (template[key] ?? 0) + (bonus[key] ?? 0);
      const hp = Math.max(1, add('hp'));
      const [aim, defense, mobility, armor] = [add('aim'), add('defense'), Math.max(1, add('mobility')), add('armor')];
      const weapon = person ? null : carried ?? template.weapon;
      if (!person && !rules.weapons.has(weapon)) throw new Error(`createBattle: no weapon "${weapon}"`);
      if (wounded !== undefined && !(Number.isInteger(wounded) && wounded >= 1 && wounded <= hp)) {
        throw new RangeError(`createBattle: ${name ?? template.name} can't start with ${wounded} hit points (1 to ${hp})`);
      }
      return {
        id: `${{ crew: 'c', enemy: 'e', ward: 'w' }[team]}${counts[team]}`,
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
        ammo: weapon ? rules.weapons.get(weapon).clip : 0,
        ap: 0,
        overwatch: false,
        status: person && held ? 'held' : 'active',
        bleed: 0,
        air: rules.balance.suitAir,
        ...freshOrders(job && talent ? talentOrder(rules, talent) : jobAtRank(job, rank)?.order),
        ...(job && rank > 0 ? { rank } : {}),
        ...(job && talent ? { talent } : {}),
        ...(person ? { ward: true } : {}),
      };
    }),
    doors: [],
    welds: [],
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

// The enemies a unit could shoot now, with the odds: [{ target, odds }]:
// those it can see, within its weapon's reach. None for a ward, who has no
// weapon.
export function targetsFor(battle, unit, rules) {
  const weapon = rules.weapons.get(unit.weapon);
  if (!weapon) return [];
  return battle.units
    .filter((u) => u.side !== unit.side && u.status === 'active' && withinReach(weapon, [unit.x, unit.y], [u.x, u.y]) && canSee(battle, [unit.x, unit.y], [u.x, u.y], rules))
    .map((target) => ({ target, odds: shotOdds(battle, unit, target, rules) }));
}

function draft(battle) {
  const copy = { ...battle, units: battle.units.map((u) => ({ ...u })), doors: [...battle.doors], welds: [...(battle.welds ?? [])], misses: { ...battle.misses } };
  if (battle.fires) copy.fires = [...battle.fires];
  return copy;
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
  if (unit.ward && action.type !== 'move') return `${unit.name} has no gun: they can only move.`;
  if (OBJECTIVE_ACTIONS.includes(action.type)) {
    const error = objectiveAction(battle, unit, action, events, rules);
    if (!error) decide(battle, events);
    return error;
  }
  switch (action.type) {
    case 'move':
      return move(battle, unit, action.to, events, rules);
    case 'shoot': {
      const target = battle.units.find((u) => u.id === action.target);
      if (!target || target.side === unit.side) return `${unit.name} can't shoot that.`;
      if (target.status !== 'active') return `${target.name} is already down.`;
      if (unit.ammo < 1) return `${unit.name} has to reload first.`;
      if (!canSee(battle, [unit.x, unit.y], [target.x, target.y], rules)) return `${unit.name} can't see ${target.name}.`;
      const weapon = rules.weapons.get(unit.weapon);
      if (!withinReach(weapon, [unit.x, unit.y], [target.x, target.y])) return outOfReach(unit, target, weapon);
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
      if (weldedAt(battle, unit.x, unit.y, action.side)) return 'That door is welded shut.';
      unit.ap -= 1;
      battle.doors = [...battle.doors, key].sort();
      events.push({ type: 'door', unit: unit.id, at: [unit.x, unit.y], side: action.side });
      return null;
    }
    case 'order':
      return doOrder(battle, unit, action, events, rules);
    default:
      return `Unknown action "${action.type}".`;
  }
}

// A move, or a dash; a carrier (objectives.js) walks once a turn, and never
// dashes (moves.js moveRange).
function move(battle, unit, to, events, rules) {
  const [x, y] = to ?? [];
  if (x === unit.x && y === unit.y) return `${unit.name} is already there.`;
  if (unit.carrying && unit.hauled) return `${unit.name} has a crate in hand: one move a turn.`;
  const spot = reachable(battle, unit, moveRange(unit), rules).get(`${x},${y}`);
  if (!spot) return `${unit.name} can't get to (${x}, ${y}) this turn.`;
  unit.ap -= spot.cost <= unit.mobility ? 1 : 2;
  if (unit.carrying) unit.hauled = true;
  walk(battle, unit, spot.path, events, rules);
  afterMove(battle, unit, events);
  decide(battle, events);
  return null;
}

// Walks a unit along its path a step at a time: doors open as it passes,
// and every enemy on overwatch that can see the tile it steps onto fires,
// in turn. If it goes down it stops there, so overwatch holds fire while it
// passes through an ally's tile: two units never share one. An enemy that
// steps onto the way in a defense holds stops there too: it has broken
// through (objectives.js). The walk is told as legs: a 'move' event for
// each stretch between doors and shots.
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
      if (!withinReach(rules.weapons.get(watcher.weapon), [watcher.x, watcher.y], to) || !canSee(battle, [watcher.x, watcher.y], to, rules)) continue;
      tell();
      watcher.overwatch = false;
      fire(battle, watcher, unit, true, events, rules);
      if (unit.status !== 'active') break;
    }
    if (unit.status !== 'active') break;
    if (steppedThrough(battle, unit, to)) {
      tell();
      breakThrough(battle, unit, to, events);
      break;
    }
  }
  tell();
}

// A shot: a burst's shots (weapons.js), or one. Each is rolled at the same
// odds, the ones shown, until the target drops or the clip runs dry.
function fire(battle, shooter, target, overwatch, events, rules) {
  const odds = shotOdds(battle, shooter, target, rules, { overwatch });
  const weapon = rules.weapons.get(shooter.weapon);
  const shots = shotsOf(weapon, overwatch);
  for (let n = 1; n <= shots && shooter.ammo > 0 && target.status === 'active'; n++) {
    fireOnce(battle, shooter, target, overwatch, odds, weapon, shots > 1 ? n : 0, events, rules);
  }
}

// One shot, rolled: hit, then crit, then damage, each from the battle's RNG.
// burst is the shot's place in a burst, from 1, or 0. A hit's stun and fire
// follow its damage (weapons.js).
function fireOnce(battle, shooter, target, overwatch, odds, weapon, burst, events, rules) {
  shooter.ammo -= 1;
  const hit = percent(battle.rng, odds.hit);
  battle.rng = hit.state;
  const shot = { type: 'shot', unit: shooter.id, target: target.id, overwatch, chance: odds.hit, roll: hit.roll, hit: hit.value, band: odds.band, cover: odds.cover, ...(burst ? { burst } : {}) };
  if (!hit.value) {
    battle.misses[shooter.side] += 1;
    events.push(shot);
    return;
  }
  battle.misses[shooter.side] = 0;
  const crit = percent(battle.rng, odds.crit);
  const roll = int(crit.state, weapon.damage[0], weapon.damage[1]);
  battle.rng = roll.state;
  // God mode (god.js) spares the crew: the hit lands and does nothing.
  const damage = spared(target, rules) ? 0 : Math.max(1, roll.value + (crit.value ? weapon.critDamage : 0) - armorAgainst(target.armor, weapon));
  events.push({ ...shot, critChance: odds.crit, critRoll: crit.roll, crit: crit.value, damage });
  if (damage > 0) hurt(battle, target, damage, events, rules);
  if (weapon.stun && target.status === 'active' && !spared(target, rules)) {
    target.asleep = true;
    target.overwatch = false;
    target.ap = 0;
    events.push({ type: 'stun', unit: target.id });
  }
  if (weapon.burn) ignite(battle, [target.x, target.y], weapon.burn, events);
}

// A weapon's fire (weapons.js burn) sets the tile at `at` burning for
// `rounds` rounds, this one counted, unless it has a hazard already: a
// wrecked room's, or a fire burning.
function ignite(battle, [x, y], rounds, events) {
  if (hazardAt(battle, x, y)) return;
  const until = battle.round + rounds - 1;
  battle.fires = [...(battle.fires ?? []), { at: [x, y], until }];
  events.push({ type: 'fire', at: [x, y], until });
}

// A new round begins: the fires past their last round go out.
function endFires(battle, events) {
  const fires = battle.fires ?? [];
  const out = fires.filter((f) => f.until < battle.round);
  if (!out.length) return;
  battle.fires = fires.filter((f) => f.until >= battle.round);
  for (const { at } of out) events.push({ type: 'fire out', at: [...at] });
}

// True for a crew member while God mode is on (god.js).
function spared(unit, rules) {
  return unit.side === 'crew' && godMode(rules);
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

// A side's turn ends, and with it what the other side's orders left on it
// (orders.js). The crew's, in its deadline's round, ends the battle; and
// the round's last, once a defense has held to its last round.
function endTurn(battle, events, rules) {
  events.push({ type: 'end', side: battle.side });
  for (const unit of battle.units) if (unit.side === battle.side) unit.ap = 0;
  endOrders(battle, battle.side, events);
  if (holdOut(battle)) {
    win(battle, 'crew', events, 'held');
    return;
  }
  const { deadline } = battle.options;
  if (deadline && battle.side === 'crew' && battle.round >= deadline) {
    win(battle, 'enemy', events, 'deadline');
    return;
  }
  battle.side = battle.side === 'crew' ? 'enemy' : 'crew';
  if (battle.side === battle.first) {
    battle.round += 1;
    endWelds(battle, events);
    endFires(battle, events);
  }
  startTurn(battle, events, rules);
}

// A side's turn begins: on a sabotage, the crew's charges due blow first;
// then its units' overwatch ends and their actions come back, but for
// those asleep; then, unit by unit, fire burns, suits use air in vacuum,
// and the downed bleed.
function startTurn(battle, events, rules) {
  const { balance } = rules;
  events.push({ type: 'turn', side: battle.side, round: battle.round });
  for (const at of chargesDue(battle)) blast(battle, at, events, rules);
  for (const unit of battle.units) {
    if (unit.side !== battle.side || battle.winner) continue;
    delete unit.hauled;
    if (unit.status === 'active') {
      unit.overwatch = false;
      unit.ap = balance.actionPoints;
      wakeTurn(battle, unit, events);
      const hazard = hazardAt(battle, unit.x, unit.y);
      if (hazard === 'fire' && balance.fireDamage > 0 && !spared(unit, rules)) {
        events.push({ type: 'hazard', unit: unit.id, hazard, damage: balance.fireDamage });
        hurt(battle, unit, balance.fireDamage, events, rules);
      } else if (hazard === 'vacuum') {
        if (unit.air > 0) {
          unit.air -= 1;
          events.push({ type: 'air', unit: unit.id, air: unit.air });
        } else if (balance.airlessDamage > 0 && !spared(unit, rules)) {
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

// A charge blowing by `at` (a sabotage, objectives.js): everyone standing
// beside it takes balance.blastDamage, on either side, armor or none.
function blast(battle, at, events, rules) {
  const hit = blastHits(battle, at);
  const damage = rules.balance.blastDamage;
  events.push({ type: 'blast', at, units: hit.map((u) => u.id), damage });
  for (const unit of hit) {
    if (unit.status === 'active' && damage > 0 && !spared(unit, rules)) hurt(battle, unit, damage, events, rules);
  }
  decide(battle, events);
}

// The battle is over when one side has no one active left (a ward doesn't
// count for the crew), when the ward is lost, when an enemy has broken
// through, or when the crew has done what it came for.
function decide(battle, events) {
  if (battle.winner) return;
  const standing = (side) => battle.units.some((u) => u.side === side && u.status === 'active' && !u.ward);
  if (wardLost(battle)) win(battle, 'enemy', events, 'ward');
  else if (battle.objective?.through) win(battle, 'enemy', events, 'through');
  else if (!standing('enemy')) win(battle, 'crew', events);
  else if (!standing('crew')) win(battle, 'enemy', events);
  else if (objectiveDone(battle.objective)) win(battle, 'crew', events, 'objective');
}

// True once an objective is done (objectives.js).
export { objectiveDone };

// The 'over' event says why only when it wasn't a side left standing.
function win(battle, winner, events, reason = null) {
  battle.winner = winner;
  events.push(reason ? { type: 'over', winner, reason } : { type: 'over', winner });
}
