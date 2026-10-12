import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cellAt } from '../src/sim/grid.js';
import { generateSite, HAZARDS, SITE_CHARS, SITE_NEEDS, siteMarks, siteProblems } from '../src/sim/gen/site.js';
import { wallAt } from '../src/sim/mapFromShip.js';
import { flipMapText, readMapText } from '../src/sim/mapText.js';
import { stepsFrom } from '../src/sim/moves.js';
import { besideClear, walkable } from '../src/sim/terrain.js';
import { GOLDEN_SITES, goldenText } from '../tools/jobs.js';
import { rules } from './battleKit.js';

const templates = [...rules.siteMaps.values()];
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const key = ([x, y]) => `${x},${y}`;

test('every shipped site template makes good maps', () => {
  assert.ok(templates.length >= 4);
  for (const template of templates) {
    assert.deepEqual(siteProblems(template), [], template.id);
    const marks = siteMarks(template);
    for (const [mark, least] of Object.entries(SITE_NEEDS)) assert.ok(marks[mark] >= least, `${template.id}: ${mark}`);
  }
});

test('the same template, seed and hazard always give the same map', () => {
  for (const template of templates) {
    for (const seed of [1, 'pit', 99]) {
      const options = { hazard: 'fire', patches: 2 };
      assert.deepEqual(generateSite(template, seed, options), generateSite(structuredClone(template), seed, options), `${template.id} ${seed}`);
    }
  }
});

test('seeds turn a template every way, and roll its props', () => {
  for (const template of templates) {
    const flips = new Set(SEEDS.map((seed) => JSON.stringify(generateSite(template, seed).flip)));
    assert.equal(flips.size, 4, `${template.id}: turned all four ways`);
    const props = new Set(SEEDS.map((seed) => generateSite(template, seed).map.tiles.cells.join()));
    assert.ok(props.size > 4, `${template.id}: more than the turns alone`);
  }
});

// A map turned is the template's text turned, tile for tile and edge for
// edge, with its marks where the template put them.
test('a site is its template turned over, with the marks in place', () => {
  for (const template of templates) {
    for (const seed of SEEDS.slice(0, 8)) {
      const { map, zones, flip } = generateSite(template, seed);
      const turned = readMapText(flipMapText(template.rows, flip));
      assert.deepEqual(map.walls, turned.walls, `${template.id} ${seed}: walls`);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const char = cellAt(turned.chars, x, y);
          const tile = cellAt(map.tiles, x, y);
          if (char === '?') assert.ok(['floor', 'half cover', 'full cover'].includes(tile), `a prop slot is floor, a crate or a container: ${tile}`);
          else assert.equal(tile, SITE_CHARS[char].tile, `${template.id} ${seed} (${x}, ${y})`);
        }
      }
      for (const [zone, mark] of [['entry', 'entry'], ['spawn', 'spawn'], ['loot', 'loot'], ['terminal', 'terminal']]) {
        const marked = [];
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (SITE_CHARS[cellAt(turned.chars, x, y)].mark === mark) marked.push([x, y]);
        assert.deepEqual(zones[zone], marked, `${template.id} ${seed}: ${zone} in reading order`);
      }
      assert.equal(map.margin, 0);
      assert.equal(map.site, template.id);
      assert.deepEqual(map.rooms, []);
      assert.deepEqual(map.hatches, []);
    }
  }
});

// Whatever the props roll: everyone can walk from the way in to every tile
// there is to stand on, and to beside every crate and the terminal.
test('every tile, crate and terminal can be got to from the way in', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { map, zones } = generateSite(template, seed);
      const battle = { map, doors: [], units: [] };
      const away = stepsFrom(battle, zones.entry, rules);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (walkable(battle, x, y, rules)) assert.ok(away.has(key([x, y])), `${template.id} seed ${seed}: (${x}, ${y})`);
        }
      }
      const open = (x, y, side) => wallAt(map, x, y, side) !== 'wall';
      for (const at of [...zones.loot, ...zones.terminal]) {
        const near = [...away.keys()].map((k) => k.split(',').map(Number)).some((from) => besideClear(from, at, open));
        assert.ok(near, `${template.id} seed ${seed}: (${at.join(', ')}) out of reach`);
      }
      for (const at of [...zones.entry, ...zones.spawn]) assert.ok(walkable(battle, ...at, rules), `${template.id}: (${at.join(', ')}) stands`);
    }
  }
});

test('a hazard lies in patches on open floor, never where anyone starts', () => {
  for (const template of templates) {
    for (const hazard of HAZARDS) {
      for (const seed of SEEDS.slice(0, 10)) {
        const { map, zones } = generateSite(template, seed, { hazard, patches: 2 });
        const starts = new Set([...zones.entry, ...zones.spawn].map(key));
        const laid = [];
        map.hazards.cells.forEach((cell, i) => cell && laid.push([i % map.width, Math.floor(i / map.width), cell]));
        assert.ok(laid.length >= 2 && laid.length <= 10, `${template.id} ${hazard} ${seed}: ${laid.length} tiles`);
        for (const [x, y, cell] of laid) {
          assert.equal(cell, hazard);
          assert.equal(cellAt(map.tiles, x, y), 'floor', `${template.id} ${seed}: on floor`);
          assert.ok(!starts.has(key([x, y])), `${template.id} ${seed}: not where anyone starts`);
        }
      }
      assert.ok(generateSite(template, 1).map.hazards.cells.every((cell) => cell === null), 'no hazard, none laid');
    }
  }
});

test('the site checker names what is wrong with a template', () => {
  const yard = rules.siteMaps.get('yard');
  const rows = (change) => {
    const copy = [...yard.rows];
    change(copy);
    return { id: 'test', rows: copy };
  };
  const cases = [
    [{ id: 'test', rows: ['', ' e', ''] }, /1 × 1 tiles: it has to be 8 to 24 across/],
    [{ id: 'test', rows: ['x'] }, /expected 2 × height \+ 1 lines/],
    [rows((r) => (r[1] = r[1].replace('k', 'Q'))), /"Q" is no site tile/],
    [rows((r) => (r[1] = r[1].replace('k', '.'))), /0 terminal tiles: it needs 1/],
    [rows((r) => (r[3] = r[3].replace(' e', ' .'))), /4 entry tiles: it needs 5/],
    [rows((r) => (r[0] = ` o${r[0].slice(2)}`)), /a hatch on an edge/],
    // The corner with the terminal fenced off: both its doors walled up.
    [rows((r) => (r[6] = '                    +-+-+-+-+') && (r[3] = r[3].replace('./.', '.|.'))), /can't be walked to from where the crew comes in/],
    [rows((r) => (r[6] = '                    +-+-+-+-+') && (r[3] = r[3].replace('./.', '.|.'))), /the terminal at \(11, 0\) can't be reached/],
  ];
  for (const [template, expected] of cases) {
    const problems = siteProblems(template);
    assert.ok(problems.some((p) => expected.test(p)), `${expected}: got ${JSON.stringify(problems)}`);
  }
});

test('flipping map text twice gives it back, and reads as the map mirrored', () => {
  const { rows } = rules.siteMaps.get('depot');
  const plain = readMapText(rows);
  for (const flip of [{ x: true }, { y: true }, { x: true, y: true }]) {
    const once = flipMapText(rows, flip);
    assert.deepEqual(readMapText(flipMapText(once, flip)), plain);
    const turned = readMapText(once);
    for (let y = 0; y < plain.height; y++) {
      for (let x = 0; x < plain.width; x++) {
        const [mx, my] = [flip.x ? plain.width - 1 - x : x, flip.y ? plain.height - 1 - y : y];
        assert.equal(cellAt(turned.chars, mx, my), cellAt(plain.chars, x, y));
      }
    }
  }
});

test('fixed seeds give the golden site maps', () => {
  // To change them on purpose: node tools/jobs.js --golden, and say so in
  // PROGRESS.md.
  assert.equal(`${goldenText(rules)}\n`, readFileSync(GOLDEN_SITES, 'utf8'));
});
