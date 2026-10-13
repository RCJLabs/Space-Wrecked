// The approach phase (ROADMAP §4.2): ship against ship, before anyone
// boards. It lasts up to approachRounds rounds. In each, the other ship's
// order is known first (its tactics, data/ships.json), then the player
// gives one: fire at a kind of module, evade, flee, or close to board.
// Every chance is worked out before its roll and is the chance shown
// (Law 4), each kept within chanceMin..chanceMax:
//   - a gun hits at gunnery less the target's evasion, and evadeBonus less
//     while the target evades;
//   - a ship's evasion is evasionPerThrust times its thrust for its mass,
//     from the engines it has working;
//   - fleeing wins at fleeChance and closing to board at closeChance, each
//     moved by fleePerThrust or closePerThrust for every point of thrust
//     for mass the ship has over the other.
// A round plays out in order: flights (the player's first), then both
// volleys at once, each from the ship as it stood when the round began, then
// boardings (the player's first), so a ship disabled by the volleys can't
// close. Every working gun fires once. A hit does
// gunDamage, less what the target's shields still hold this round
// (shieldPerGen for each working generator), to the module of the kind aimed
// at that has the fewest hit points left. A module whose damage reaches its
// hit points is wrecked: by a roll its room is on fire, open to vacuum or
// full of rubble, which is how it comes to the boarding map (mapFromShip.js).
// A ship with no working reactor or no working engine is disabled, and the
// other boards it. Until the boarding fights (M22), the player boards only a
// ship that is disabled: closing to board one that can still fight back is
// shown, but can't be ordered (PLAYER_CLOSES). A ship whose last reactor is
// wrecked blows up blowChance times in 100, which leaves only scrap; the
// player's ship never blows. After the last round, the ships part.
//
// Pure. A side is { ship, damage, wrecked }: the ship's plain data
// (builder.js), the hit points each module has lost in this approach
// ({ [uid]: hit points }), and its wrecked modules ({ [uid]: 'fire' |
// 'vacuum' | 'rubble' }), the player's from earlier approaches included.
import { percent, pick } from '../core/rng.js';
import { shipStats } from './constraints.js';
import { WRECKS } from './mapFromShip.js';
import { hasTag } from './modules.js';

// What a volley can aim at, and the tag of the modules each one hits.
export const AIM_TAGS = { weapons: 'weapon', engines: 'engine', shields: 'shield', reactor: 'reactor' };
export const AIMS = Object.keys(AIM_TAGS);
export const ORDERS = ['fire', 'evade', 'flee', 'close'];
// Whether the player can close to board a ship that isn't disabled. M22's
// boarding fights turn it on; until then a boarding is settled by a stand-in
// (encounter.js) that can't tell a crew that boards a stronger one.
export const PLAYER_CLOSES = false;
const NO_CLOSING = 'Boarding a ship that can still fight comes with the boarding fights.';
// How an approach can end: the player gets away, the other ship gets away,
// the player boards it, it boards the player, it blows up, both are
// disabled and drift apart, or the last round passes.
export const OUTCOMES = ['escaped', 'fled', 'boarded', 'boardedBy', 'destroyed', 'adrift', 'parted'];

// A side's numbers, from the modules it has working: { guns, shields (what
// they hold in a round), thrust, mass, ratio (thrust for mass), evasion,
// powered, moving, disabled }.
export function sideStats(side, rules) {
  const { balance } = rules;
  const working = side.ship.modules.filter((module) => !(module.uid in side.wrecked) && rules.modules.has(module.type));
  const count = (tag) => working.filter((module) => hasTag(rules.modules.get(module.type), tag)).length;
  const thrust = working.reduce((sum, module) => sum + rules.modules.get(module.type).stats.thrust, 0);
  const mass = massOf(side.ship, rules);
  const ratio = mass > 0 ? thrust / mass : 0;
  const powered = count('reactor') > 0;
  const moving = thrust > 0;
  return {
    guns: count('weapon'),
    shields: count('shield') * balance.shieldPerGen,
    thrust,
    mass,
    ratio,
    evasion: Math.round(balance.evasionPerThrust * ratio),
    powered,
    moving,
    disabled: !powered || !moving,
  };
}

// The working modules a volley aimed at `aim` can hit, fewest hit points
// left first (then by uid): [{ uid, type, hp, left }].
export function targetsOf(side, aim, rules) {
  const tag = AIM_TAGS[aim];
  return side.ship.modules
    .filter((module) => !(module.uid in side.wrecked) && rules.modules.has(module.type) && hasTag(rules.modules.get(module.type), tag))
    .map((module) => {
      const hp = rules.modules.get(module.type).stats.hp;
      return { uid: module.uid, type: module.type, hp, left: Math.max(0, hp - (side.damage[module.uid] ?? 0)) };
    })
    .sort((a, b) => a.left - b.left || a.uid - b.uid);
}

// The chance each gun hits a target with these stats, evading or not.
export function hitChance(target, evading, rules) {
  const { gunnery, evadeBonus } = rules.balance;
  return within(gunnery - target.evasion - (evading ? evadeBonus : 0), rules);
}

// The chance a ship gets away from another, by their thrust for mass.
export function fleeChance(mine, theirs, rules) {
  const { fleeChance: base, fleePerThrust } = rules.balance;
  return within(base + Math.round(fleePerThrust * (mine.ratio - theirs.ratio)), rules);
}

// The chance a ship closes on another and boards it.
export function closeChance(mine, theirs, rules) {
  const { closeChance: base, closePerThrust } = rules.balance;
  return within(base + Math.round(closePerThrust * (mine.ratio - theirs.ratio)), rules);
}

// How much of a side's approach hit points (its weapons, engines, shields
// and reactors) it has lost, in percent, wrecked modules counting in full.
export function lostShare(side, rules) {
  let total = 0;
  let lost = 0;
  for (const module of side.ship.modules) {
    const def = rules.modules.get(module.type);
    if (!def || !AIMS.some((aim) => hasTag(def, AIM_TAGS[aim]))) continue;
    total += def.stats.hp;
    lost += module.uid in side.wrecked ? def.stats.hp : Math.min(def.stats.hp, side.damage[module.uid] ?? 0);
  }
  return total ? Math.floor((100 * lost) / total) : 0;
}

// The other ship's order for a round, from its tactics, before the player
// gives theirs: { kind, at? }. Tactics are { aim: [kinds to fire at, first
// choice first], board?: the round it closes to board from, flee?: the share
// of its approach hit points lost, in percent, at which it runs }. It runs
// once it has lost that much, or with no guns and no wish to board; closes
// from its boarding round; or else fires at the first kind it aims at that
// the player still has working; and evades with nothing to fire.
export function enemyOrder({ you, them, round, tactics }, rules) {
  const mine = sideStats(them, rules);
  const running = tactics.flee !== undefined && lostShare(them, rules) >= tactics.flee;
  if (mine.moving && (running || (!mine.guns && tactics.board === undefined))) return { kind: 'flee' };
  if (tactics.board !== undefined && round >= tactics.board && mine.moving) return { kind: 'close' };
  if (mine.guns) {
    const at = [...tactics.aim, ...AIMS].find((aim) => targetsOf(you, aim, rules).length);
    if (at) return { kind: 'fire', at };
  }
  return { kind: 'evade' };
}

// Every order the player could give this round, against the other ship's
// order (intent), each with its odds and whether it can be given:
// [{ order, ok, why, ... }]. Fire carries guns, chance, damage and its
// targets; evade the chance the other ship's guns hit, and was (without
// evading); flee and close their chance.
export function choicesFor(state, intent, rules) {
  const you = sideStats(state.you, rules);
  const them = sideStats(state.them, rules);
  const choices = AIMS.map((at) => {
    const targets = targetsOf(state.them, at, rules);
    const why = !you.guns ? 'Your guns are out.' : !targets.length ? `They have no working ${at === 'reactor' ? 'reactor' : at}.` : null;
    return { order: { kind: 'fire', at }, ok: !why, why, guns: you.guns, chance: hitChance(them, intent.kind === 'evade', rules), damage: rules.balance.gunDamage, shields: them.shields, targets };
  });
  const theirs = intent.kind === 'fire' ? { chance: hitChance(you, true, rules), was: hitChance(you, false, rules) } : { chance: null, was: null };
  choices.push({ order: { kind: 'evade' }, ok: true, why: null, ...theirs });
  choices.push({ order: { kind: 'flee' }, ok: you.moving, why: you.moving ? null : 'Your engines are out.', chance: fleeChance(you, them, rules) });
  const closing = !PLAYER_CLOSES ? NO_CLOSING : you.moving ? null : 'Your engines are out.';
  choices.push({ order: { kind: 'close' }, ok: !closing, why: closing, chance: closeChance(you, them, rules) });
  return choices;
}

// Whether an order is one of ORDERS, well formed.
export function isOrder(order) {
  return Boolean(order) && ORDERS.includes(order.kind) && (order.kind === 'fire' ? AIMS.includes(order.at) : order.at === undefined);
}

// Plays a round. state is { you, them, round, tactics }; order is the
// player's; rng is the RNG state. Returns { ok: true, you, them, round (the
// next), rng, intent, events, fired, outcome } where outcome is null while
// the approach goes on, else { kind, how? } (how a boarding came about:
// 'closed' or 'disabled'); or { ok: false, error } for an order that can't
// be given. events, in order:
//   { kind: 'flee' | 'close', side, chance, roll, ok }
//   { kind: 'volley', side, at, chance, shots: [{ roll, hit, absorbed,
//     damage, module, wreck }] }   module: the uid hit, or null
//   { kind: 'blow', chance, roll, ok }
export function playRound(state, order, rng, rules) {
  const intent = enemyOrder(state, rules);
  const choice = isOrder(order) && choicesFor(state, intent, rules).find((c) => c.order.kind === order.kind && c.order.at === order.at);
  if (!choice) return { ok: false, error: 'That order is unknown.' };
  if (!choice.ok) return { ok: false, error: choice.why };
  const youAt = sideStats(state.you, rules);
  const themAt = sideStats(state.them, rules);
  const events = [];
  let r = rng;
  const roll = (chance) => {
    const p = percent(r, chance);
    r = p.state;
    return p;
  };
  let { you, them } = state;
  const end = (kind, how, fired = false) => ({ ok: true, you, them, round: state.round, rng: r, intent, events, fired, outcome: how ? { kind, how } : { kind } });

  // Flights, the player's first.
  for (const [side, given, mine, theirs, kind] of [['you', order, youAt, themAt, 'escaped'], ['them', intent, themAt, youAt, 'fled']]) {
    if (given.kind !== 'flee') continue;
    const chance = fleeChance(mine, theirs, rules);
    const p = roll(chance);
    events.push({ kind: 'flee', side, chance, roll: p.roll, ok: p.value });
    if (p.value) return end(kind);
  }
  // Both volleys at once, from the ships as they stood.
  let fired = false;
  if (order.kind === 'fire') {
    const shot = volley(youAt, themAt, them, order.at, intent.kind === 'evade', r, rules);
    ({ side: them, rng: r } = shot);
    events.push({ kind: 'volley', side: 'you', at: order.at, chance: shot.chance, shots: shot.shots });
    fired = fired || shot.shots.length > 0;
  }
  if (intent.kind === 'fire') {
    const shot = volley(themAt, youAt, you, intent.at, order.kind === 'evade', r, rules);
    ({ side: you, rng: r } = shot);
    events.push({ kind: 'volley', side: 'them', at: intent.at, chance: shot.chance, shots: shot.shots });
    fired = fired || shot.shots.length > 0;
  }

  // What the volleys left.
  const youNow = sideStats(you, rules);
  const themNow = sideStats(them, rules);
  if (themAt.powered && !themNow.powered) {
    const chance = rules.balance.blowChance;
    const p = roll(chance);
    events.push({ kind: 'blow', chance, roll: p.roll, ok: p.value });
    if (p.value) return end('destroyed', null, fired);
  }
  if (themNow.disabled && youNow.disabled) return end('adrift', null, fired);
  if (themNow.disabled) return end('boarded', 'disabled', fired);
  if (youNow.disabled) return end('boardedBy', 'disabled', fired);
  // Boardings, the player's first, at the odds shown before the volleys.
  for (const [side, given, mine, theirs, kind] of [['you', order, youAt, themAt, 'boarded'], ['them', intent, themAt, youAt, 'boardedBy']]) {
    if (given.kind !== 'close') continue;
    const chance = closeChance(mine, theirs, rules);
    const p = roll(chance);
    events.push({ kind: 'close', side, chance, roll: p.roll, ok: p.value });
    if (p.value) return end(kind, 'closed', fired);
  }
  if (state.round >= rules.balance.approachRounds) return end('parted', null, fired);
  return { ok: true, you, them, round: state.round + 1, rng: r, intent, events, fired, outcome: null };
}

// One ship's volley at a kind of module on the other: every working gun
// fires once, at the chance shown. Returns { side (the target after it),
// rng, chance, shots }.
function volley(shooter, target, side, aim, evading, rng, rules) {
  const { gunDamage } = rules.balance;
  const chance = hitChance(target, evading, rules);
  let r = rng;
  let hit = side;
  let shields = target.shields;
  const shots = [];
  for (let gun = 0; gun < shooter.guns; gun++) {
    const p = percent(r, chance);
    r = p.state;
    if (!p.value) {
      shots.push({ roll: p.roll, hit: false, absorbed: 0, damage: 0, module: null, wreck: null });
      continue;
    }
    const absorbed = Math.min(shields, gunDamage);
    shields -= absorbed;
    const left = gunDamage - absorbed;
    const module = left > 0 ? targetsOf(hit, aim, rules)[0] : null;
    let damage = 0;
    let wreck = null;
    if (module) {
      damage = Math.min(left, module.left);
      hit = { ...hit, damage: { ...hit.damage, [module.uid]: module.hp - module.left + damage } };
      if (damage === module.left) {
        const w = pick(r, WRECKS);
        r = w.state;
        wreck = w.value;
        hit = { ...hit, wrecked: { ...hit.wrecked, [module.uid]: wreck } };
      }
    }
    shots.push({ roll: p.roll, hit: true, absorbed, damage, module: module?.uid ?? null, wreck });
  }
  return { side: hit, rng: r, chance, shots };
}

// A ship's mass, wrecks and all, kept for each ship and rules: ships are
// never changed in place, so the same ship always has the same mass.
const masses = new WeakMap();
function massOf(ship, rules) {
  let byRules = masses.get(ship);
  if (!byRules) masses.set(ship, (byRules = new WeakMap()));
  if (!byRules.has(rules)) byRules.set(rules, shipStats(ship, rules).mass);
  return byRules.get(rules);
}

function within(chance, rules) {
  return Math.max(rules.balance.chanceMin, Math.min(rules.balance.chanceMax, chance));
}
