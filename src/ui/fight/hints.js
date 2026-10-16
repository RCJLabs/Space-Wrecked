// Text for the Fight screen: the status line, the round chip, the odds
// card, and what a crew member's button says about them.
import { describeEvent } from '../../sim/battleLog.js';
import { orderOf } from '../../sim/orders.js';
import { rankNameFor } from '../../sim/ranks.js';
import { ORDER_SHORT } from '../campaign/crewJobText.js';

// The status line while an event plays out: the log's words (battleLog.js),
// with a walk told without its tiles.
export function eventText(event, battle) {
  if (event.type === 'move') {
    const unit = battle.units.find((u) => u.id === event.unit);
    return { tone: 'info', text: `${unit.name} ${unit.id} moves.` };
  }
  const tone = event.type === 'shot' ? (event.hit ? 'good' : 'info') : event.type === 'down' || event.type === 'bled out' ? 'bad' : 'info';
  return { tone, text: describeEvent(event, battle) };
}

// How a boarding fight ended, for the end panel: { tone, title, text }.
// A job's fight says it its own way (../campaign/jobText.js jobOutcome).
export function endingFor(battle) {
  return battle.winner === 'crew'
    ? { tone: 'good', title: 'The crew holds the ship.', text: '' }
    : { tone: 'bad', title: 'The boarders have the ship.', text: '' };
}

// What the player can do next, as { tone, text }. orders: fight.js
// ordersFor(fight). ending: how the fight ended, once it has (endingFor, or
// the source's own).
export function hintFor(fight, orders, ending = null) {
  const { battle, preview } = fight;
  if (battle.winner && ending?.text) return { tone: ending.tone, text: `${ending.title.replace(/\.$/, '')} · ${ending.text}` };
  if (battle.winner) return battle.winner === 'crew' ? { tone: 'good', text: 'The boarders are down: the crew holds the ship.' } : { tone: 'bad', text: 'The crew is down: the boarders have the ship.' };
  if (battle.side !== 'crew') return { tone: 'info', text: 'Enemy turn.' };
  if (!orders) return { tone: 'info', text: 'No one can act: tap End turn.' };
  const { unit } = orders;
  if (preview?.type === 'move') {
    const how = preview.dash ? 'Dash here: both actions' : 'Move here: 1 action';
    return { tone: preview.dash ? 'warn' : 'good', text: `${how}. Tap the tile again to go.` };
  }
  if (preview?.type === 'shoot') {
    const target = battle.units.find((u) => u.id === preview.target);
    return { tone: 'good', text: `${preview.odds.hit}% to hit ${target.name} ${target.id}. Tap Fire, or the target again.` };
  }
  if (preview?.type === 'order' && orders.order) return { tone: 'good', text: orderHint(battle, unit, orders.order, preview) };
  if (orders.grab) return { tone: 'good', text: `${unit.name} can reach a crate: tap Grab, or a tile to move.` };
  if (orders.hack) return { tone: 'good', text: `${unit.name} can reach the terminal: tap Hack to work it. It takes the rest of the turn.` };
  const shoot = orders.targets.length ? ', or an enemy to shoot' : '';
  return { tone: 'info', text: `${unit.name}: tap a tile to move${shoot}.` };
}

// What an order shown will do, and how to give it (M32): short enough for
// the cover screen's hint line, with the second tap last.
function orderHint(battle, unit, order, preview) {
  const { name, def } = order;
  const target = battle.units.find((u) => u.id === preview.at);
  const who = target ? `${target.name} ${target.id}` : '';
  const again = `Tap ${name} again.`;
  const change = preview.change;
  switch (preview.kind) {
    case 'suppress':
      return `Suppress ${who}: its shots ${signed(def.aim)} till its turn ends${change ? ` (${change.was}% → ${change.now}%)` : ''}. Ends the turn. ${again}`;
    case 'weld':
      return `Weld the ${SIDE_NAMES[preview.at]} door shut till round ${battle.round + def.rounds}. ${again}`;
    case 'patch': {
      const up = target.status !== 'active';
      return up ? `Patch ${who}: up again with ${Math.min(target.maxHp, def.hp)} hit points. ${again}` : `Patch ${who}: ${target.hp} → ${Math.min(target.maxHp, target.hp + def.hp)} hit points. ${again}`;
    }
    case 'hustle':
      return `Hustle: ${def.ap} more action${def.ap === 1 ? '' : 's'} this turn, ${unit.ap + def.ap} in all. ${again}`;
    case 'mark':
      return `Mark ${who}: the crew's shots at it ${signed(def.aim)} till your next turn${change ? ` (${change.was}% → ${change.now}%)` : ''}. ${again}`;
    case 'sedate':
      return `${preview.odds.hit}% to put ${who} to sleep for its next turn. Ends the turn. ${again}`;
    case 'kit':
      return `Kit out ${target.id === unit.id ? unit.name : who}: a full clip and ${signed(def.armor)} armor for the fight. ${again}`;
    default:
      return again;
  }
}

const SIDE_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' };

// Round and whose turn it is, for the chip on the board.
export function chipFor(battle) {
  if (battle.winner) return { tone: battle.winner === 'crew' ? 'good' : 'bad', text: `Round ${battle.round} · ${battle.winner === 'crew' ? 'Crew wins' : 'Enemy wins'}` };
  return { tone: 'info', text: `Round ${battle.round} · ${battle.side === 'crew' ? 'Your turn' : 'Enemy turn'}` };
}

// A shot's odds for its card: { title, hit, rows: [[label, value]], note,
// crit, damage }. The rows add up to the hit chance, kept within 0 to 100
// (note says so when it was).
export function oddsText(shooter, target, odds, rules) {
  const weapon = rules.weapons.get(shooter.weapon);
  const label = {
    aim: () => `${shooter.name}'s aim`,
    weapon: (part) => `${weapon.name}, ${part.band} range`,
    cover: (part) => `${part.cover === 'full' ? 'Full' : 'Half'} cover`,
    defense: () => 'Defense',
    overwatch: () => 'Overwatch',
    suppressed: () => `${shooter.name} suppressed`,
    marked: () => `${target.name} marked`,
    forgiving: () => 'Forgiving odds',
    // A dart's rank (orders.js dartOdds, M32b), by the rank's name; a loyal
    // companion's, by their talent's (M33c).
    steady: () => talentName(shooter, rules) ?? rankNameFor(rules.jobs.get(shooter.kind), shooter.rank ?? 0, 'order') ?? 'Rank',
  };
  const rows = odds.hitParts.map((part) => [label[part.why](part), signed(part.value, part.why === 'aim')]);
  const sum = odds.hitParts.reduce((total, part) => total + part.value, 0);
  const crit = odds.critParts.map((part) => (part.why === 'flanked' ? `flanked +${part.value}` : `${part.value}`)).join(', ');
  const [least, most] = weapon.damage;
  const armor = target.armor ? `, less ${target.armor} armor` : '';
  return {
    title: `${target.name} ${target.id}`,
    hit: odds.hit,
    rows,
    note: sum === odds.hit ? null : `${sum} in all, kept to ${odds.hit}.`,
    crit: `Crit ${odds.crit}% (${crit})`,
    damage: `Damage ${least}–${most}${weapon.critDamage ? `, +${weapon.critDamage} on a crit` : ''}${armor}`,
  };
}

// A unit's state in a few words: actions and shots left, or how hurt.
export function stateText(unit) {
  if (unit.status === 'down') return `Down · ${unit.bleed} turn${unit.bleed === 1 ? '' : 's'}`;
  if (unit.status === 'stable') return 'Stable';
  if (unit.status === 'out') return 'Out of the fight';
  if (unit.status === 'dead') return 'Dead';
  if (unit.overwatch) return 'Overwatch';
  return `${unit.ap} AP · ${unit.ammo} shot${unit.ammo === 1 ? '' : 's'}`;
}

// A unit's card: { title, lines }: its numbers, its rank (M32b), a loyal
// companion's the third, by their talent's name (M33c), its job's order
// and the uses left (M32), and what orders left on it.
export function unitText(unit, rules) {
  const weapon = rules.weapons.get(unit.weapon);
  const side = unit.side === 'crew' ? 'Crew' : 'Enemy';
  const order = orderOf(unit, rules);
  const rank = talentName(unit, rules) ?? (unit.rank ? rules.jobs.get(unit.kind)?.ranks?.[unit.rank - 1]?.name : null);
  return {
    title: `${unit.name} ${unit.id}`,
    lines: [
      `${side}${unit.rank ? ` · rank ${unit.rank}${rank ? `, ${rank}` : ''}` : ''} · ${unit.hp}/${unit.maxHp} hit points · ${stateText(unit)}.`,
      `Aim ${unit.aim} · defense ${unit.defense} · armor ${unit.armor} · moves ${unit.mobility}.`,
      `${weapon.name}: damage ${weapon.damage[0]}–${weapon.damage[1]}, crit ${weapon.crit}%, ${unit.ammo}/${weapon.clip} shots.`,
      ...(order ? [`${order.name}: ${unit.uses} of ${order.uses} left this fight${unit.talent && ORDER_SHORT[order.type] ? `, ${ORDER_SHORT[order.type](order)} each` : ''}.`] : []),
      ...ordersOn(unit),
    ],
  };
}

// A loyal companion's talent's name (M33c, battle.js `talent`), or null.
function talentName(unit, rules) {
  return unit.talent ? (rules.companions?.get(unit.talent)?.talent?.name ?? null) : null;
}

// What orders left on a unit, a line each.
function ordersOn(unit) {
  const lines = [];
  if (unit.mark) lines.push(`Marked: the crew's shots at it +${unit.mark.aim}, ${unit.mark.turns === 1 ? 'until your turn ends' : 'through your next turn'}.`);
  if (unit.suppressed) lines.push(`Suppressed: its shots ${signed(unit.suppressed.aim)} to hit until its turn ends.`);
  if (unit.asleep) lines.push('Asleep: it loses its next turn.');
  if (unit.kitted) lines.push('Kitted out for the fight.');
  return lines;
}

function signed(value, bare) {
  if (bare) return String(value);
  return value < 0 ? `−${-value}` : `+${value}`;
}
