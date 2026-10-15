import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { crosses, generateSector } from '../src/sim/gen/sector.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, knownNodes } from '../src/sim/travel.js';
import { GOLDEN_SECTORS, goldenText } from '../tools/sectors.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const spec = rules.sectors;
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

// The nodes the ship can reach from the way in, link by link.
function reached(sector) {
  const seen = new Set([sector.start]);
  const queue = [sector.start];
  while (queue.length) {
    const at = queue.shift();
    for (const [a, b] of sector.links) {
      const other = a === at ? b : b === at ? a : null;
      if (other !== null && !seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return seen;
}

test('every sector runs from its way in to its jump point, every node reached', () => {
  for (const seed of SEEDS) {
    const sector = generateSector(rules, seed, 1);
    const last = spec.columns - 1;
    assert.equal(sector.nodes[sector.start].type, 'start', `seed ${seed}`);
    assert.equal(sector.nodes[sector.start].col, 0);
    assert.equal(sector.nodes[sector.exit].type, 'exit');
    assert.equal(sector.nodes[sector.exit].col, last);
    assert.equal(reached(sector).size, sector.nodes.length, `seed ${seed}: every node can be reached`);
    for (let col = 1; col < last; col++) {
      const count = sector.nodes.filter((node) => node.col === col).length;
      assert.ok(count >= spec.rows[0] && count <= spec.rows[1], `seed ${seed}: column ${col} has ${count}`);
    }
    sector.nodes.forEach((node, id) => assert.equal(node.id, id));
  }
});

test('links join next columns only, never cross, and every node has a way on and a way back', () => {
  for (const seed of SEEDS) {
    const { nodes, links, start, exit } = generateSector(rules, seed, 1);
    const keys = links.map(([a, b]) => `${a}-${b}`);
    assert.equal(new Set(keys).size, keys.length, `seed ${seed}: no link twice`);
    for (const [a, b] of links) {
      assert.ok(a < b && nodes[b].col === nodes[a].col + 1, `seed ${seed}: ${a}-${b} joins next columns`);
      for (const other of links) {
        if (nodes[other[0]].col === nodes[a].col) assert.ok(!crosses(nodes, [a, b], other), `seed ${seed}: ${a}-${b} crosses ${other.join('-')}`);
      }
    }
    for (const node of nodes) {
      if (node.id !== exit) assert.ok(links.some(([a]) => a === node.id), `seed ${seed}: ${node.id} has a way on`);
      if (node.id !== start) assert.ok(links.some(([, b]) => b === node.id), `seed ${seed}: ${node.id} has a way back`);
    }
  }
});

test('stations as the data counts them, each in a column of its own; names never twice; the map in its margins', () => {
  const tally = new Map();
  for (const seed of SEEDS) {
    const sector = generateSector(rules, seed, 1);
    const stations = sector.nodes.filter((node) => node.type === 'station');
    const [min, max] = spec.counts.station;
    assert.ok(stations.length >= min && stations.length <= max, `seed ${seed}: ${stations.length} stations`);
    assert.equal(new Set(stations.map((node) => node.col)).size, stations.length, `seed ${seed}: stations in columns of their own`);
    assert.ok(stations.every((node) => node.col > 0 && node.col < spec.columns - 1));
    assert.equal(new Set(sector.nodes.map((node) => node.name)).size, sector.nodes.length, `seed ${seed}: no name twice`);
    assert.ok(stations.every((node) => spec.names.stations.includes(node.name)));
    assert.ok(sector.nodes.filter((node) => node.type in spec.mix).every((node) => spec.names.places.includes(node.name)));
    assert.ok(sector.nodes.every((node) => node.x >= 0.08 && node.x <= 0.92 && node.y >= 0.08 && node.y <= 0.92), `seed ${seed}: in the margins`);
    tally.set(stations.length, (tally.get(stations.length) ?? 0) + 1);
  }
  const [min, max] = spec.counts.station;
  for (let count = min; count <= max; count++) assert.ok(tally.get(count) > 50, `each count comes up: ${[...tally].join(' ')}`);
});

test('every kind the data counts comes as often as it says, each in a column of its own: since M24, a nebula in every sector, on the charts', () => {
  for (const seed of SEEDS) {
    const sector = generateSector(rules, seed, 1);
    const counted = sector.nodes.filter((node) => node.type in spec.counts);
    for (const [type, [min, max]] of Object.entries(spec.counts)) {
      const count = counted.filter((node) => node.type === type).length;
      assert.ok(count >= min && count <= max, `seed ${seed}: ${count} ${type}`);
    }
    assert.equal(new Set(counted.map((node) => node.col)).size, counted.length, `seed ${seed}: each in a column of its own`);
    const nebulae = sector.nodes.filter((node) => node.type === 'nebula');
    assert.ok(nebulae.every((node) => spec.names.nebulae.includes(node.name) && !node.event && !node.hostile), `seed ${seed}: a nebula named as one, empty`);
  }
  assert.deepEqual(spec.counts.nebula, [1, 1]);
  // On the charts: known as the ship comes into the sector.
  const { run } = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const nebula = run.sector.nodes.find((node) => node.type === 'nebula');
  assert.ok(knownNodes(run, rules).has(nebula.id));
});

test('the nodes between roll their kinds from the mix, and those that hold events get one of their kind', () => {
  const kinds = new Map();
  const events = new Set();
  for (const seed of SEEDS) {
    const sector = generateSector(rules, seed, 1);
    const last = spec.columns - 1;
    const between = sector.nodes.filter((node) => node.col > 0 && node.col < last);
    assert.ok(between.every((node) => node.type in spec.mix || node.type in spec.counts), `seed ${seed}: kinds from the mix or the counts`);
    for (const node of sector.nodes) {
      kinds.set(node.type, (kinds.get(node.type) ?? 0) + 1);
      const holds = Boolean(rules.nodeTypes.get(node.type)?.events);
      assert.equal(Boolean(node.event), holds, `seed ${seed}: node ${node.id} (${node.type}) has an event only if its kind holds them`);
      if (node.event) {
        assert.equal(rules.events.get(node.event).kind, node.type);
        events.add(node.event);
      }
    }
    // None twice in a sector while the kind's events last.
    for (const kind of Object.keys(spec.mix)) {
      const ids = sector.nodes.filter((node) => node.type === kind && node.event).map((node) => node.event);
      const pool = [...rules.events.values()].filter((event) => event.kind === kind).length;
      assert.equal(new Set(ids).size, Math.min(ids.length, pool), `seed ${seed}: ${kind} events ${ids}`);
    }
  }
  for (const kind of Object.keys(spec.mix)) assert.ok(kinds.get(kind) > 100, `${kind} comes up: ${kinds.get(kind)}`);
  // Every event of a kind of node comes up; the colony's places have the
  // rest (M28).
  assert.equal(events.size, [...rules.events.values()].filter((event) => rules.nodeTypes.get(event.kind)?.events).length, 'every event comes up');
  // The mix's weights show: empty space comes as many times as often as a
  // trader as its weight is times the trader's.
  const ratio = kinds.get('empty') / kinds.get('trader');
  const weights = rules.sectors.mix;
  const expected = weights.empty / weights.trader;
  assert.ok(ratio > expected * 0.8 && ratio < expected * 1.25, `empty to trader: ${ratio}, the mix says ${expected}`);
});

test('the same seed always gives the same sector, and names to avoid are avoided', () => {
  assert.deepEqual(generateSector(rules, 'same', 2), generateSector(rules, 'same', 2));
  assert.notDeepEqual(generateSector(rules, 1, 1), generateSector(rules, 2, 1));
  const avoid = spec.names.sectors.slice(0, -1);
  for (const seed of SEEDS.slice(0, 20)) assert.equal(generateSector(rules, seed, 3, { avoid }).name, spec.names.sectors.at(-1));
  assert.equal(generateSector(rules, 9, 4).index, 4);
});

test('fixed seeds give the golden sectors', () => {
  // To change them on purpose: node tools/sectors.js --golden, and say so in
  // PROGRESS.md.
  assert.equal(`${goldenText(rules)}\n`, readFileSync(GOLDEN_SECTORS, 'utf8'));
});
