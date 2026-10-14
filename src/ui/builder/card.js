// The details a long press shows for a part: size, what has to face space,
// stats, what it does in an approach (a gun's damage, a shield's strength,
// point defense) and for the crew on the run (quarters, life support and
// the med bay), its maker's word on it and how a maker's version differs
// from its base part (M23g), and cost; and for a placed part, where it is
// and whether it reaches the bridge. For a styling piece (M23f), pieceCard.
import { footprint } from '../../sim/modules.js';
import { pieceFootprint } from '../../sim/styling.js';

const STATS = [
  ['power', 'Power'],
  ['thrust', 'Thrust'],
  ['berths', 'Berths'],
  ['lifeSupport', 'Life support'],
  ['cargo', 'Cargo'],
  ['mass', 'Mass'],
  ['hp', 'Hull points'],
];
const ALWAYS = new Set(['mass', 'hp']);

// placed: { module, joined } for a part on the hull, where joined is true,
// false, or null when there is no bridge yet.
export function cardFor(defs, def, placed = null) {
  const [w, h] = footprint(def, placed?.module.rot ?? 0);
  const faces = def.facesSpace ? ` · ${def.facesSpace.what} must face space` : '';
  const lines = [
    `${w}×${h} squares · ${def.rotates ? 'turns' : "doesn't turn"}${faces}`,
    STATS.filter(([key]) => ALWAYS.has(key) || def.stats[key] !== 0)
      .map(([key, label]) => `${label} ${key === 'power' ? signed(def.stats[key]) : def.stats[key]}`)
      .join(' · '),
    ...approachLine(defs, def),
    ...runLine(defs, def),
    ...makerLines(defs, def),
    `Cost ${def.cost} · ${defs.manufacturers.get(def.manufacturer)?.name ?? def.manufacturer}`,
  ];
  if (placed) {
    const where = `At (${placed.module.x}, ${placed.module.y})`;
    const joined = placed.joined === null ? 'no bridge yet' : placed.joined ? 'joined to the bridge' : 'not joined to the bridge';
    lines.push(`${where} · ${joined}`);
  }
  return { title: def.name, lines };
}

// What a part does in an approach (src/sim/approach.js), as a line, or
// none: the numbers its part gives the rules, as the odds use them.
function approachLine(defs, def) {
  if (def.damage) return [`In an approach: ${def.damage} damage a hit, one shot a round.`];
  if (def.shield) return [`In an approach: holds off ${def.shield} damage a round, from the first hits.`];
  if (def.intercept) return [`In an approach: the other ship's guns hit ${def.intercept} in 100 less, up to ${defs.balance.interceptMax} with more turrets. Their volleys at your guns hit it too.`];
  return [];
}

// What a part does for the crew on the run (src/sim/crew.js, medbay.js), as
// a line, or none: a med bay's healing, with the best healer's job aboard
// (the medic's, data/jobs.json); berths and life support, the crew's room.
function runLine(defs, def) {
  if (def.heal) {
    const healer = [...defs.jobs.values()].reduce((best, job) => ((job.station?.heal ?? 0) > (best?.station?.heal ?? 0) ? job : best), null);
    const more = healer?.station?.heal ? `, ${def.heal + healer.station.heal} with a ${healer.name.toLowerCase()} aboard` : '';
    return [`On the run: heals each of the wounded ${def.heal} a jump${more}. Wrecked, it heals no one.`];
  }
  if (def.stats.berths || def.stats.lifeSupport) return ['On the run: the ship carries as many crew as its berths and life support both cover. Recruits sign on at stations.'];
  return [];
}

// Its maker's word on a part (data/manufacturers.json blurb), and for a
// maker's version, how it differs from the part it is a version of:
// "Next to the Yard's: Mass +1 · Hull points +8 · Cost +20".
function makerLines(defs, def) {
  const lines = [];
  const blurb = defs.manufacturers.get(def.manufacturer)?.blurb;
  if (blurb) lines.push(blurb);
  const base = def.base !== undefined && defs.modules.get(def.base);
  if (base) {
    const changes = STATS.filter(([key]) => def.stats[key] !== base.stats[key]).map(([key, label]) => `${label} ${signed(def.stats[key] - base.stats[key])}`);
    if (def.cost !== base.cost) changes.push(`Cost ${signed(def.cost - base.cost)}`);
    const by = defs.manufacturers.get(base.manufacturer)?.short ?? base.manufacturer;
    if (changes.length) lines.push(`Next to the ${by}'s: ${changes.join(' · ')}`);
  }
  return lines;
}

// A styling piece's card: its size and turns, where it goes, and that it
// is only looks; for a placed one, where it is.
export function pieceCard(def, placed = null) {
  const [w, h] = pieceFootprint(def, placed?.rot ?? def.turns[0]);
  const flips = def.turns.some((rot) => rot >= 4);
  const turns = def.turns.length === 2 && flips ? 'flips to either side' : def.turns.length > 1 ? `turns${flips ? ' and flips' : ''}` : "doesn't turn";
  const lines = [
    `${w}×${h} squares · ${turns}`,
    def.shape
      ? `Shapes the hull: a room all along one straight side, its ${def.shape === 'curve' ? 'curved' : 'sloped'} side to open space.`
      : 'Goes beside the hull, its root all along a room\'s side.',
    'Looks only: no mass, power or cost, and no parts used. A room change that leaves it nothing to hold it takes it off.',
  ];
  if (placed) lines.push(`At (${placed.x}, ${placed.y})`);
  return { title: def.name, lines };
}

function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}
