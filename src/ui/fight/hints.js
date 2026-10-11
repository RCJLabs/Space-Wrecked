// Text for the Fight screen: the status line, the round chip, the odds
// card, and what a crew member's button says about them.
import { describeEvent } from '../../sim/battleLog.js';

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

// What the player can do next, as { tone, text }. orders: fight.js
// ordersFor(fight).
export function hintFor(fight, orders) {
  const { battle, preview } = fight;
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
  const shoot = orders.targets.length ? ', or an enemy to shoot' : '';
  return { tone: 'info', text: `${unit.name}: tap a tile to move${shoot}.` };
}

// Round and whose turn it is, for the chip on the board.
export function chipFor(battle) {
  if (battle.winner) return { tone: battle.winner === 'crew' ? 'good' : 'bad', text: `Round ${battle.round} · ${battle.winner === 'crew' ? 'Crew wins' : 'Boarders win'}` };
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
    forgiving: () => 'Forgiving odds',
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

// A unit's card: { title, lines }.
export function unitText(unit, rules) {
  const weapon = rules.weapons.get(unit.weapon);
  const side = unit.side === 'crew' ? 'Crew' : 'Boarder';
  return {
    title: `${unit.name} ${unit.id}`,
    lines: [
      `${side} · ${unit.hp}/${unit.maxHp} hit points · ${stateText(unit)}.`,
      `Aim ${unit.aim} · defense ${unit.defense} · armor ${unit.armor} · moves ${unit.mobility}.`,
      `${weapon.name}: damage ${weapon.damage[0]}–${weapon.damage[1]}, crit ${weapon.crit}%, ${unit.ammo}/${weapon.clip} shots.`,
    ],
  };
}

function signed(value, bare) {
  if (bare) return String(value);
  return value < 0 ? `−${-value}` : `+${value}`;
}
