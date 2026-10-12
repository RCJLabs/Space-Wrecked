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
      const shot = `${who} ${event.overwatch ? 'fires on overwatch at' : 'shoots'} ${name(event.target)}: ${event.chance}%, rolled ${event.roll}`;
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
    case 'over':
      return `${event.winner === 'crew' ? 'The crew wins' : 'The enemy wins'}${REASON[event.reason] ?? ''}.`;
    default:
      return JSON.stringify(event);
  }
}

const SIDE_NAME = { n: 'north', e: 'east', s: 'south', w: 'west' };
const REASON = { objective: ': the job is done', deadline: ': the deadline has passed' };
