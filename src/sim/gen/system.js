// The system past the charts (M25, ROADMAP §4.7): where act 2's run ends,
// past the last sector's jump point. Its way in, and the worlds a colony
// could take root on (data/worlds.json): each of a kind of its own, rolled
// by weight, with act 3's numbers rolled within its kind's ranges: soil,
// water, ore and danger, each 0 to MAX_RATING, and how far it lies from
// the lanes, 1 (near) to LANES (far). The worlds are named from their list,
// none twice, and the system from its own. It has a sector's shape
// (sector.js), so the run plays on it as on any map: the way in on the
// left, linked to every world, and each world to the one beside it; there
// is no jump point. Pure and seeded: the same seed always gives the same
// system.
import { int, seedFrom, shuffle } from '../../core/rng.js';
import { pickWeighted } from '../drops.js';
import { place } from './sector.js';

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
    const world = { kind: kind.id };
    for (const rating of RATINGS) world[rating] = roll(kind[rating][0], kind[rating][1]);
    world.lanes = roll(1, LANES);
    const dy = ((roll(-100, 100) / 100) * JITTER) / kinds.length;
    nodes.push({ id: row + 1, col: 1, row, x: place(ACROSS), y: place((row + 0.5) / kinds.length + dy), type: 'world', name: names.value[row], world });
  });

  const links = [];
  for (let id = 1; id < nodes.length; id++) links.push([0, id]);
  for (let id = 1; id < nodes.length - 1; id++) links.push([id, id + 1]);
  const systems = spec.names.systems;
  return { index, name: systems[roll(0, systems.length - 1)], system: true, nodes, links, start: 0, exit: null };
}
