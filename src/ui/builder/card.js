// The details a long press shows for a part: size, doors, stats and cost,
// and for a placed part, where it is and whether it reaches the bridge.
import { footprint } from '../../sim/modules.js';

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
  const doors = def.doors.length;
  const lines = [
    `${w}×${h} cells · ${doors} door${doors === 1 ? '' : 's'} · ${def.rotates ? 'turns' : "doesn't turn"}`,
    STATS.filter(([key]) => ALWAYS.has(key) || def.stats[key] !== 0)
      .map(([key, label]) => `${label} ${key === 'power' ? signed(def.stats[key]) : def.stats[key]}`)
      .join(' · '),
    `Cost ${def.cost} · ${defs.manufacturers.get(def.manufacturer)?.name ?? def.manufacturer}`,
  ];
  if (placed) {
    const where = `At (${placed.module.x}, ${placed.module.y})`;
    const joined = placed.joined === null ? 'no bridge yet' : placed.joined ? 'joined to the bridge' : 'not joined to the bridge';
    lines.push(`${where} · ${joined}`);
  }
  return { title: def.name, lines };
}

function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}
