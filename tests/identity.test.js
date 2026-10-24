// The ship's identity (M52): her name, hull number and emblem, rolled at
// New game, renamed and her emblem picked in the Look tab, a save from
// before given hers when a screen wants them, and enemies wearing their
// side's emblem; the number and emblem painted on her roof.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { decalFaces, LETTERING } from '../src/render/decals.js';
import { EMBLEMS } from '../src/render/emblems.js';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { skins } from '../src/render/palette.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { hullIdentity, isIdentity, MAX_NAME, nameProblem, presetIdentity, renameShip, rollIdentity, setEmblem, shipName, tidyName, withIdentity } from '../src/sim/identity.js';
import { initialState, reduce } from '../src/sim/root.js';
import { rules } from './battleKit.js';

test('a new ship is named from the list and numbered from the seed alone, with no emblem', () => {
  const a = rollIdentity(rules, 77);
  assert.deepEqual(rollIdentity(rules, 77), a, 'the same seed, the same ship');
  assert.ok(rules.shipNames.includes(a.name));
  assert.match(a.number, /^[A-HJ-NP-Z]{2}-\d{3}$/);
  assert.equal(a.emblem, null);
  const names = new Set(Array.from({ length: 200 }, (_, seed) => rollIdentity(rules, seed).name));
  const numbers = new Set(Array.from({ length: 200 }, (_, seed) => rollIdentity(rules, seed).number));
  assert.ok(names.size >= rules.shipNames.length - 2, `the names come round: ${names.size}`);
  assert.ok(numbers.size >= 195, `numbers seldom repeat: ${numbers.size} of 200`);
});

test("the name doesn't move the campaign's rolls", () => {
  const plain = newCampaign(rules, 5);
  const named = newCampaign(rules, 5, { shipName: '  Night   Ferry ' });
  assert.equal(named.identity.name, 'Night Ferry');
  assert.equal(named.identity.number, plain.identity.number);
  assert.deepEqual({ ...named, identity: null }, { ...plain, identity: null });
  assert.throws(() => newCampaign(rules, 5, { shipName: '' }), RangeError);
});

test('a name is tidied, and must be there and short', () => {
  assert.equal(tidyName('  Grey   Heron '), 'Grey Heron');
  assert.equal(nameProblem(''), 'Give the ship a name.');
  assert.equal(nameProblem('   '), 'Give the ship a name.');
  assert.match(nameProblem('x'.repeat(MAX_NAME + 1)), /24 letters at most/);
  assert.equal(nameProblem('x'.repeat(MAX_NAME)), null);
});

test('rename keeps her number and emblem; an emblem must be on offer', () => {
  const campaign = newCampaign(rules, 9);
  const renamed = renameShip(campaign, ' Wren ', rules);
  assert.equal(renamed.ok, true);
  assert.deepEqual(renamed.campaign.identity, { ...campaign.identity, name: 'Wren' });
  assert.deepEqual(renameShip(campaign, '', rules), { ok: false, error: 'Give the ship a name.' });
  const starred = setEmblem(campaign, 'star', rules);
  assert.equal(starred.campaign.identity.emblem, 'star');
  assert.equal(setEmblem(starred.campaign, null, rules).campaign.identity.emblem, null, 'taken off');
  // A side's own emblem is not on offer, nor one that isn't drawn.
  assert.equal(setEmblem(campaign, 'anchor', rules).ok, false);
  assert.equal(setEmblem(campaign, 'nope', rules).ok, false);
  assert.equal([...rules.emblems.values()].filter((e) => e.offered).length, 6);
});

test('the actions rename her and pick her emblem, and refuse what will not do', () => {
  const state = reduce(initialState(4), { type: 'campaign/new', rules, shipName: 'Copper Vow' });
  assert.equal(state.campaign.identity.name, 'Copper Vow');
  const renamed = reduce(state, { type: 'campaign/rename', name: 'Rust Saint', rules });
  assert.equal(renamed.campaign.identity.name, 'Rust Saint');
  assert.equal(reduce(state, { type: 'campaign/rename', name: '', rules }), state);
  const badged = reduce(renamed, { type: 'campaign/emblem', emblem: 'ring', rules });
  assert.equal(badged.campaign.identity.emblem, 'ring');
  assert.equal(reduce(badged, { type: 'campaign/emblem', emblem: 'gear', rules }), badged);
  assert.equal(reduce(state, { type: 'campaign/new', rules, shipName: 'x'.repeat(30) }), state, 'a New game with a name too long');
  assert.deepEqual(campaignProblems(badged.campaign, rules), []);
});

test('a save from before M52 has no identity until a screen rolls hers, the one a new game would', () => {
  assert.equal(SAVE_VERSION, 47);
  const campaign = newCampaign(rules, 31);
  const old = { version: 45, data: { ...initialState(2), campaign: { ...campaign, identity: undefined } } };
  delete old.data.campaign.identity;
  const loaded = parseSave(JSON.stringify(old));
  assert.equal(loaded.ok, true, loaded.error);
  assert.equal(loaded.save.data.campaign.identity, null);
  assert.deepEqual(withIdentity(loaded.save.data.campaign, rules).identity, campaign.identity);
  assert.equal(shipName(loaded.save.data.campaign, rules), campaign.identity.name);
  assert.deepEqual(hullIdentity(loaded.save.data.campaign, rules), { number: campaign.identity.number, emblem: null });
  const rolled = reduce({ ...initialState(2), campaign: loaded.save.data.campaign }, { type: 'campaign/identity', rules });
  assert.deepEqual(rolled.campaign.identity, campaign.identity);
  assert.equal(reduce(rolled, { type: 'campaign/identity', rules }), rolled, 'once rolled, kept');
  // A save already at 46 keeps hers as it is.
  const named = { ...campaign, identity: { ...campaign.identity, name: 'Wren', emblem: 'eye' } };
  const kept = parseSave(JSON.stringify(makeSave({ ...initialState(2), campaign: named })));
  assert.deepEqual(kept.save.data.campaign.identity, named.identity);
});

test('an identity is checked as a save loads', () => {
  const good = { name: 'Wren', number: 'KR-482', emblem: null };
  assert.equal(isIdentity(null), true);
  assert.equal(isIdentity(good), true);
  assert.equal(isIdentity({ ...good, emblem: 'star' }), true);
  for (const bad of [{ ...good, name: '' }, { ...good, name: ' Wren' }, { ...good, number: 'KI-482' }, { ...good, number: 'KR482' }, { ...good, extra: 1 }, { ...good, emblem: 3 }, 'Wren']) {
    assert.equal(isIdentity(bad), false, JSON.stringify(bad));
  }
});

test("a side's ships wear its emblem, and a ship of no side none", () => {
  for (const preset of rules.ships.values()) {
    const worn = presetIdentity(preset.id, rules);
    const side = preset.side && rules.factions.sides.get(preset.side);
    if (side?.emblem) assert.deepEqual(worn, { number: null, emblem: side.emblem }, preset.id);
    else assert.equal(worn, null, preset.id);
  }
  assert.deepEqual(presetIdentity('corvette', rules), { number: null, emblem: 'anchor' });
});

test('every character a hull number can hold, and every emblem, is drawn', () => {
  for (const ch of 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789-') assert.ok(LETTERING.includes(ch), ch);
  for (const emblem of rules.emblems.values()) {
    const drawing = EMBLEMS[emblem.id];
    assert.ok(drawing?.length, emblem.id);
    for (const shape of drawing) assert.ok(shape.pts.length >= 3 && shape.pts.flat().every((v) => Math.abs(v) <= 1.05), emblem.id);
  }
});

test("the number and emblem lie flat on her roof, on the hull and clear of what stands tall on it", () => {
  for (const id of rules.ships.keys()) {
    const ship = generateShip(rules, id, 'decals').ship;
    const hull = traceHull(ship, rules);
    const scene = exteriorScene({ ship, defs: rules, hull, skin: skins.yard, identity: { number: 'KR-482', emblem: 'star' } });
    assert.ok(scene.decals.length > 10, `${id}: ${scene.decals.length} decal faces`);
    const cells = new Set(hull.cells.map(([x, y]) => `${x},${y}`));
    const tall = scene.faces.filter((f) => f.pts.some((p) => p[2] > HULL + 0.06));
    for (const face of scene.decals) {
      assert.ok(face.pts.every((p) => p[2] > HULL && p[2] < HULL + 0.02), `${id}: flat, just over the roof`);
      const [cx, cy] = [0, 1].map((k) => face.pts.reduce((sum, p) => sum + p[k], 0) / face.pts.length);
      assert.ok(cells.has(`${Math.floor(cx)},${Math.floor(cy)}`), `${id}: on the hull at ${cx},${cy}`);
      // Its middle under no tall fitting.
      const under = tall.some((t) => {
        const xs = t.pts.map((p) => p[0]);
        const ys = t.pts.map((p) => p[1]);
        return cx > Math.min(...xs) && cx < Math.max(...xs) && cy > Math.min(...ys) && cy < Math.max(...ys);
      });
      assert.ok(!under, `${id}: clear of the tall fittings at ${cx.toFixed(2)},${cy.toFixed(2)}`);
    }
  }
  // Nothing asked, nothing painted; an emblem alone is the emblem alone.
  const ship = generateShip(rules, 'cutter', 'decals').ship;
  const hull = traceHull(ship, rules);
  assert.deepEqual(exteriorScene({ ship, defs: rules, hull, skin: skins.yard }).decals, []);
  const emblem = decalFaces({ hull, fitted: [], identity: { number: null, emblem: 'ring' }, colors: { mark: '#ffffff', cut: '#000000' }, z: HULL });
  assert.equal(emblem.length, 1 + EMBLEMS.ring.length, 'its panel and its shapes');
  assert.deepEqual(emblem.slice(1).map((f) => f.color), ['#ffffff', '#000000', '#ffffff']);
});

test('the number goes by the bow, the emblem nearer the middle', () => {
  const ship = generateShip(rules, 'hauler', 'decals').ship;
  const hull = traceHull(ship, rules);
  const faces = decalFaces({ hull, fitted: [], identity: { number: 'KR-482', emblem: 'star' }, colors: { mark: '#ffffff', cut: '#000000' }, z: HULL });
  const xs = hull.cells.map(([x]) => x);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs) + 1];
  const midX = (face) => face.pts.reduce((sum, p) => sum + p[0], 0) / face.pts.length;
  const numberPanel = faces[0];
  const emblemPanel = faces.find((f, i) => i > 0 && f.pts.length === 8);
  assert.ok(midX(numberPanel) > x0 + (x1 - x0) * 0.6, 'the number in the front of her');
  assert.ok(Math.abs(midX(emblemPanel) - (x0 + x1) / 2) < (x1 - x0) * 0.25, 'the emblem near her middle');
});
