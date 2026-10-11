import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BLUEPRINT_VERSION, decodeBlueprint, encodeBlueprint, encodePlacements } from '../src/core/blueprint.js';
import { checksum } from '../src/core/codec.js';
import { exportSave, makeSave } from '../src/core/save.js';
import { buildShip, newShip, removeModule } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { EXAMPLE_SCRIPT, renderShip } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const script = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
const example = () => buildShip(defs, 'starter', script.placements).ship;
const layout = (ship) => ship.modules.map(({ type, x, y, rot }) => ({ type, x, y, rot }));
const error = (code) => {
  const result = decodeBlueprint(code, defs);
  assert.equal(result.ok, false, `expected ${code} to fail`);
  return result.error;
};

test('a code rebuilds the identical ship, in the same build order', () => {
  const ship = example();
  const code = encodeBlueprint(ship);
  assert.match(code, new RegExp(`^wtb\\.${BLUEPRINT_VERSION}\\.[A-Za-z0-9_-]+\\.[0-9a-f]{8}$`));
  assert.ok(code.length < 200, `${code.length} characters for 14 parts`);
  const result = decodeBlueprint(code, defs);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.ship, ship);
  assert.equal(renderShip(result.ship, defs), renderShip(ship, defs));
  assert.equal(encodeBlueprint(result.ship), code, 'and makes the same code again');
});

test('a ship with gaps in its uids comes back numbered from 1, laid out the same', () => {
  const ship = removeModule(example(), 3);
  const result = decodeBlueprint(encodeBlueprint(ship), defs);
  assert.deepEqual(layout(result.ship), layout(ship));
  assert.deepEqual(result.ship.modules.map((m) => m.uid), ship.modules.map((_, i) => i + 1));
  assert.equal(result.ship.nextUid, ship.modules.length + 1);
});

test('an empty ship has a code too', () => {
  const result = decodeBlueprint(encodeBlueprint(newShip('starter')), defs);
  assert.deepEqual(result, { ok: true, ship: newShip('starter') });
});

test('spaces and line breaks pasted into a code are ignored', () => {
  const code = encodeBlueprint(example());
  const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 50)} \r\n${code.slice(50)}\t`;
  assert.equal(decodeBlueprint(mangled, defs).ok, true);
});

test('every way a code can be wrong gets a message, not a crash', () => {
  const code = encodeBlueprint(example());
  const [prefix, version, payload, sum] = code.split('.');
  const signed = (v, p) => `${prefix}.${v}.${p}.${checksum(`${prefix}.${v}.${p}`)}`;
  assert.equal(error(''), 'Paste a blueprint code first.');
  assert.equal(error(exportSave(makeSave({ settings: { fpsCap: 60 }, rng: 1, ship: null }))), "That's a save code, not a ship blueprint.");
  assert.match(error('hello there'), /^That isn't a ship blueprint\. Blueprint codes start with "wtb\."/);
  assert.match(error(`${prefix}.${version}.${payload}`), /incomplete/);
  assert.match(error(`${code}.extra`), /incomplete/);
  assert.match(error(`${prefix}.x.${payload}.${sum}`), /version number is unreadable/);
  assert.match(error(`${prefix}.${version}.${payload.slice(0, -1)}.${sum}`), /checksum doesn't match/);
  const flipped = payload.slice(0, 10) + (payload[10] === 'A' ? 'B' : 'A') + payload.slice(11);
  assert.match(error(`${prefix}.${version}.${flipped}.${sum}`), /checksum doesn't match/);
  assert.match(error(signed(BLUEPRINT_VERSION + 1, payload)), /newer version of the game/);
  assert.match(error(signed(0, payload)), /version 0 can't be read/);
  assert.match(error(signed(version, 'AAAA')), /damaged and can't be read/);
  assert.match(error(signed(version, `${payload}AA`)), /damaged and can't be read/, 'trailing bytes');
  assert.match(error(encodePlacements('cruiser', [])), /hull this version of the game doesn't have \("cruiser"\)/);
  assert.match(error(encodePlacements('starter', [{ type: 'warpcore', x: 1, y: 1, rot: 0 }, { type: 'galley', x: 2, y: 1, rot: 0 }])), /parts this version of the game doesn't have: warpcore, galley\./);
  const overlap = [{ type: 'reactor', x: 1, y: 0, rot: 0 }, { type: 'corridor', x: 2, y: 1, rot: 0 }];
  assert.equal(error(encodePlacements('starter', overlap)), "This blueprint doesn't fit together: Corridor would overlap Reactor at (1, 0).");
  assert.match(error(encodePlacements('starter', [{ type: 'corridor', x: 0, y: 0, rot: 0 }])), /doesn't fit together: Corridor doesn't fit inside the Starter hull there/, 'a cut-away cell');
});

test('no input makes decoding throw', () => {
  const code = encodeBlueprint(example());
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 2000; i++) {
    const chars = [...code];
    const edits = 1 + Math.floor(random() * 4);
    for (let e = 0; e < edits; e++) chars[Math.floor(random() * chars.length)] = String.fromCharCode(32 + Math.floor(random() * 95));
    const result = decodeBlueprint(chars.join(''), defs);
    assert.equal(typeof result.ok, 'boolean');
    if (!result.ok) assert.equal(typeof result.error, 'string');
  }
  for (const odd of [null, undefined, 42, {}, [], 'wtb', 'wtb...', 'wtb.1..00000000']) assert.equal(decodeBlueprint(odd, defs).ok, false);
});
