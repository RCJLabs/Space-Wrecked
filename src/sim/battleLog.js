// A battle's events (battle.js) in words, one line each: for the log tool,
// the golden battle and, later, the battle screen. Units are named with
// their ids ("Pirate e2"), since two can share a name; any version of the
// battle will do for the names.
const SIDE = { crew: 'the crew', enemy: 'the enemy' };

export function describeEvent(event, battle) {
  const name = (id) => {
    const unit = battle.units.find((u) => u.id === id);
    return unit ? `${unit.name} ${unit.id}` : id;
  };
  const who = name(event.unit);
  const turns = (n) => `${n} turn${n === 1 ? '' : 's'}`;
  switch (event.type) {
    case 'turn':
      return `Round ${event.round}: ${SIDE[event.side]}'s turn.`;
    case 'end':
      return `End of ${SIDE[event.side]}'s turn.`;
    case 'move':
      return `${who} moves ${event.path.map(([x, y]) => `(${x}, ${y})`).join(' to ')}.`;
    case 'door':
      return `${who} opens the door on the ${SIDE_NAME[event.side]} side of (${event.at[0]}, ${event.at[1]}).`;
    case 'shot': {
      // A burst's shots say their place in it (weapons.js, M37).
      const burst = event.burst ? ` (burst, shot ${event.burst})` : '';
      const shot = `${who} ${event.overwatch ? 'fires on overwatch at' : 'shoots'} ${name(event.target)}${burst}: ${event.chance}%, rolled ${event.roll}`;
      if (!event.hit) return `${shot}, missed.`;
      const crit = event.crit ? `, crit (${event.critChance}%, rolled ${event.critRoll})` : '';
      return `${shot}, hit${crit} for ${event.damage}.`;
    }
    case 'down':
      return `${who} is down, bleeding out in ${turns(event.bleed)}.`;
    case 'dead':
      return `${who} is dead.`;
    case 'bleed':
      return `${who} is bleeding out: ${turns(event.bleed)} left.`;
    case 'bled out':
      return event.dead ? `${who} bled out and died.` : `${who} bled out: out of the fight, badly hurt.`;
    case 'stabilize':
      return `${who} stabilizes ${name(event.target)}.`;
    case 'overwatch':
      return `${who} goes on overwatch.`;
    case 'reload':
      return `${who} reloads: ${event.ammo} shots.`;
    case 'air':
      return `${who} breathes suit air: ${turns(event.air)} left.`;
    case 'hazard':
      return event.hazard === 'fire' ? `${who} burns for ${event.damage}.` : `${who} has no air left and takes ${event.damage}.`;
    case 'grab':
      return `${who} grabs the crate at (${event.at[0]}, ${event.at[1]}): ${event.left ? `${event.left} to go` : 'that was the last one'}.`;
    case 'hack':
      return `${who} works the terminal: ${event.progress} of ${turns(event.turns)}.`;
    case 'order':
      return orderLine(event, who, name);
    case 'asleep':
      return `${who} is asleep and does nothing.`;
    case 'awake':
      return `${who} wakes up.`;
    case 'stun':
      return `${who} is stunned.`;
    case 'fire':
      return `(${event.at[0]}, ${event.at[1]}) catches fire, to round ${event.until}.`;
    case 'fire out':
      return `The fire at (${event.at[0]}, ${event.at[1]}) burns out.`;
    case 'unweld': {
      const [x, y, side] = event.key.split(',');
      return `The weld on the door on the ${SIDE_NAME[side]} side of (${x}, ${y}) gives way: the door is shut.`;
    }
    case 'over':
      return `${event.winner === 'crew' ? 'The crew wins' : 'The enemy wins'}${REASON[event.reason] ?? ''}.`;
    default:
      return JSON.stringify(event);
  }
}

// An order's line (orders.js): who did what to whom, and what it left.
function orderLine(event, who, name) {
  const them = name(event.target);
  switch (event.order) {
    case 'suppress':
      return `${who} suppresses ${them}: its shots ${event.aim} until its side's turn ends.`;
    case 'weld':
      return `${who} welds the door on the ${SIDE_NAME[event.side]} side of (${event.at[0]}, ${event.at[1]}) shut, to round ${event.until}.`;
    case 'patch':
      return event.up ? `${who} patches ${them} up: back on their feet with ${event.hp}.` : `${who} patches ${them}: ${event.healed} back, ${event.hp} now.`;
    case 'hustle':
      return `${who} hustles: ${event.ap} more action${event.ap === 1 ? '' : 's'} this turn.`;
    case 'mark':
      return `${who} marks ${them}: the crew's shots at it +${event.aim}.`;
    case 'sedate': {
      const dart = `${who} darts ${them}: ${event.chance}%, rolled ${event.roll}`;
      return event.hit ? `${dart}, asleep.` : `${dart}, missed.`;
    }
    case 'kit':
      return `${who} kits ${event.target === event.unit ? 'up' : `${them} out`}: armor +${event.armor}, ${event.ammo} shots.`;
    default:
      return JSON.stringify(event);
  }
}

const SIDE_NAME = { n: 'north', e: 'east', s: 'south', w: 'west' };
const REASON = { objective: ': the job is done', deadline: ': the deadline has passed' };
