// Act 2's sectors (ROADMAP §4.7): a sector is a seeded map of nodes the
// ship crosses, from its way in to its jump point (data/sectors.json). The
// nodes stand in columns, left to right: the way in alone in the first, the
// jump point alone in the last, and two or three in each column between.
// Each node links to the columns either side of it, by height in its
// column, and now and then one link more; no two links cross, so every
// node can be reached and the map reads at a glance. A set number of the
// nodes between are of a kind the data counts (stations), each in a column
// of its own; the rest are the filler (empty space). Nodes are named from
// their kind's list, none twice in a sector, and the sector from its list,
// past the names to avoid (the sectors already crossed). Pure and seeded:
// the same seed and index always give the same sector.
import { int, seedFrom, shuffle } from '../../core/rng.js';

// Where nodes sit on the map, each from 0 to 1: this far from its edges.
const MARGIN = 0.08;
// How far a node may sit off the even spacing of its column, as a share of
// the spacing: up and down, and across.
const JITTER = { y: 0.18, x: 0.2 };

// rules: indexDefs (sectors, nodeTypes); seed: a number or string; index:
// the sector's place in the run, 1 up. Returns { index, name, nodes, links,
// start, exit }: nodes [{ id, col, row, x, y, type, name }] by id, 0 up,
// column by column and top down; links [[a, b]] with a < b.
export function generateSector(rules, seed, index, { avoid = [] } = {}) {
  const spec = rules.sectors;
  let rng = seedFrom(seed);
  const roll = (min, max) => {
    const r = int(rng, min, max);
    rng = r.state;
    return r.value;
  };
  const mixed = (list) => {
    const r = shuffle(rng, list);
    rng = r.state;
    return r.value;
  };

  // The columns, and the nodes in each.
  const last = spec.columns - 1;
  const columns = [];
  const nodes = [];
  for (let col = 0; col <= last; col++) {
    const count = col === 0 || col === last ? 1 : roll(spec.rows[0], spec.rows[1]);
    const across = 1 / last;
    const ids = [];
    for (let row = 0; row < count; row++) {
      const down = 1 / count;
      const dx = col === 0 || col === last ? 0 : (roll(-100, 100) / 100) * JITTER.x * across;
      const dy = count > 1 ? (roll(-100, 100) / 100) * JITTER.y * down : 0;
      ids.push(nodes.length);
      nodes.push({
        id: nodes.length,
        col,
        row,
        x: place(col * across + dx),
        y: place((row + 0.5) * down + dy),
        type: col === 0 ? 'start' : col === last ? 'exit' : spec.filler,
        name: '',
      });
    }
    columns.push(ids);
  }

  // The links between each column and the next.
  const links = [];
  for (let col = 0; col < last; col++) {
    const [left, right] = [columns[col], columns[col + 1]];
    const here = [];
    const link = (a, b) => {
      if (!here.some(([x, y]) => x === a && y === b)) here.push([a, b]);
    };
    left.forEach((a, i) => link(a, right[along(i, left.length, right.length)]));
    right.forEach((b, j) => link(left[along(j, right.length, left.length)], b));
    if (roll(0, 99) < spec.extraLinkChance) {
      const more = left.flatMap((a) => right.map((b) => [a, b])).filter(([a, b]) => !here.some(([x, y]) => (x === a && y === b) || crosses(nodes, [a, b], [x, y])));
      if (more.length) link(...more[roll(0, more.length - 1)]);
    }
    links.push(...here);
  }

  // The kinds the data counts, each in a column of its own between.
  const free = mixed(columns.slice(1, -1));
  for (const [type, [min, max]] of Object.entries(spec.counts)) {
    const count = roll(min, max);
    for (let k = 0; k < count && free.length; k++) {
      const ids = free.shift();
      nodes[ids[roll(0, ids.length - 1)]].type = type;
    }
  }

  // Names: a kind with a list draws from it, none twice; one without is
  // named for its kind.
  const lists = new Map();
  for (const node of nodes) {
    const kind = rules.nodeTypes.get(node.type);
    if (!kind?.names) {
      node.name = kind?.name ?? node.type;
      continue;
    }
    if (!lists.has(kind.names)) lists.set(kind.names, mixed(spec.names[kind.names]));
    node.name = lists.get(kind.names).shift() ?? kind.name;
  }
  const names = spec.names.sectors.filter((name) => !avoid.includes(name));
  const pool = names.length ? names : spec.names.sectors;
  return { index, name: pool[roll(0, pool.length - 1)], nodes, links, start: 0, exit: nodes.length - 1 };
}

// Where node i of a column of n lands in a column of m: as high up it, by
// share.
function along(i, n, m) {
  return n === 1 ? 0 : Math.round((i * (m - 1)) / (n - 1));
}

// Whether two links between the same two columns cross: one starts higher
// and ends lower than the other.
export function crosses(nodes, [a, b], [c, d]) {
  return (nodes[a].row - nodes[c].row) * (nodes[b].row - nodes[d].row) < 0;
}

// A share of the map from 0 to 1, kept clear of its edges and rounded to
// three places, so saves and golden files read cleanly.
function place(share) {
  return Math.round((MARGIN + (1 - 2 * MARGIN) * share) * 1000) / 1000;
}
