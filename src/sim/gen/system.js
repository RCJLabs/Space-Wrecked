// The system past the charts (M25, ROADMAP §4.7): where act 2's run ends,
// past the last sector's jump point. Its way in, and the worlds a colony
// could take root on (data/worlds.json): each of a kind of its own, rolled
// by weight, with act 3's numbers rolled within its kind's ranges: soil,
// water, ore and danger, each 0 to MAX_RATING, and how far it lies from
// the lanes, 1 (near) to LANES (far). The worlds are named from their list,
// none twice, and the system from its own. It has a sector's shape
// (sector.js), so the run plays on it as on any map: the way in on the
// left, linked to every world, and each world to the one beside it; there
// is no jump point. From M38d a voyage from the colony crosses systems past
// it (beyondSystem): charts as act 2's sectors are, with worlds among their
// nodes. Pure and seeded: the same seed always gives the same system.
import { int, seedFrom, shuffle } from '../../core/rng.js';
import { pickWeighted } from '../drops.js';
import { generateSector, place } from './sector.js';

// A world's numbers for act 3, each 0 to MAX_RATING, and how far it lies
// from the lanes, 1 to LANES.
export const RATINGS = ['soil', 'water', 'ore', 'danger'];
export const MAX_RATING = 3;
export const LANES = 3;
// The worlds stand in a column this far across the map, each up to this
// share of the spacing off its place, up or down.
const ACROSS = 0.72;
const JITTER = 0.15;

// rules: indexDefs (worlds, nodeTypes); seed: a number or string; index:
// its place in the run (the last sector's, and one more). Returns { index,
// name, system: true, nodes, links, start, exit: null }: nodes [{ id, col,
// row, x, y, type, name, world? }] by id, the way in first and then the
// worlds top down, world being { kind, soil, water, ore, danger, lanes };
// links [[a, b]] with a < b.
export function generateSystem(rules, seed, index) {
  const spec = rules.worlds;
  let rng = seedFrom(seed);
  const roll = (min, max) => {
    const r = int(rng, min, max);
    rng = r.state;
    return r.value;
  };

  // The worlds' kinds, none twice.
  const table = Object.fromEntries([...spec.kinds.values()].map((kind) => [kind.id, kind.weight]));
  const kinds = [];
  for (let k = 0; k < spec.system.worlds && Object.keys(table).length; k++) {
    const kind = pickWeighted(rng, table);
    rng = kind.state;
    kinds.push(spec.kinds.get(kind.value));
    delete table[kind.value];
  }
  const names = shuffle(rng, spec.names.worlds);
  rng = names.state;

  const nodes = [{ id: 0, col: 0, row: 0, x: place(0), y: place(0.5), type: 'start', name: rules.nodeTypes.get('start')?.name ?? 'Way in' }];
  kinds.forEach((kind, row) => {
    const world = worldOf(kind, roll);
    const dy = ((roll(-100, 100) / 100) * JITTER) / kinds.length;
    nodes.push({ id: row + 1, col: 1, row, x: place(ACROSS), y: place((row + 0.5) / kinds.length + dy), type: 'world', name: names.value[row], world });
  });

  const links = [];
  for (let id = 1; id < nodes.length; id++) links.push([0, id]);
  for (let id = 1; id < nodes.length - 1; id++) links.push([id, id + 1]);
  const systems = spec.names.systems;
  return { index, name: systems[roll(0, systems.length - 1)], system: true, nodes, links, start: 0, exit: null };
}

// A system past the colony's (M38d), which a voyage crosses: a chart as act
// 2's sectors are (sector.js), from its way in to its jump point on to the
// next, with the voyage's count of worlds (data/worlds.json voyage) among
// the nodes between of the mix's kinds. Each is made a world rolled as the
// system's are, none of a kind twice, its event and ship gone, and named
// from the worlds' list past the names taken (the colony's) and those on
// the chart. The system is named from the systems' list past the names to
// avoid (the run's before it); once every name has been, any but the last.
// rules: indexDefs (sectors, nodeTypes, worlds); seed, index, background
// and met as for generateSector, whose rolls it leaves as they are. Returns
// the sector, named for the system.
export function beyondSystem(rules, seed, index, { avoid = [], taken = [], background = null, met = [] } = {}) {
  const sector = generateSector(rules, seed, index, { background, met });
  const spec = rules.worlds;
  let rng = seedFrom(`${seed}:beyond`);
  const roll = (min, max) => {
    const r = int(rng, min, max);
    rng = r.state;
    return r.value;
  };
  const mixed = new Set(Object.keys(rules.sectors.mix));
  const open = sector.nodes.filter((node) => mixed.has(node.type));
  const used = new Set([...taken, ...sector.nodes.map((node) => node.name)]);
  const names = shuffle(rng, spec.names.worlds.filter((name) => !used.has(name)));
  rng = names.state;
  const table = Object.fromEntries([...spec.kinds.values()].map((kind) => [kind.id, kind.weight]));
  const worlds = new Map();
  for (let k = 0; k < (spec.voyage?.worlds ?? 0) && open.length && k < names.value.length && Object.keys(table).length; k++) {
    const [node] = open.splice(roll(0, open.length - 1), 1);
    const kind = pickWeighted(rng, table);
    rng = kind.state;
    delete table[kind.value];
    worlds.set(node.id, { name: names.value[k], world: worldOf(spec.kinds.get(kind.value), roll) });
  }
  const nodes = sector.nodes.map((node) => {
    const made = worlds.get(node.id);
    if (!made) return node;
    const { event, hostile, ...rest } = node;
    return { ...rest, type: 'world', name: made.name, world: made.world };
  });
  const { systems } = spec.names;
  const fresh = systems.filter((name) => !avoid.includes(name));
  const others = systems.filter((name) => name !== avoid.at(-1));
  const pool = fresh.length ? fresh : others.length ? others : systems;
  return { ...sector, name: pool[roll(0, pool.length - 1)], nodes };
}

// A world of kind's, its numbers for act 3 each rolled within the kind's
// range, and then how far it lies from the lanes: { kind, soil, water,
// ore, danger, lanes }.
function worldOf(kind, roll) {
  const world = { kind: kind.id };
  for (const rating of RATINGS) world[rating] = roll(kind[rating][0], kind[rating][1]);
  world.lanes = roll(1, LANES);
  return world;
}
