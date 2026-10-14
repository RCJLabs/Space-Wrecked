// Hull styles (M23d): a ship's hull has a style from data/hulls.json, which
// changes only how it looks from outside. The player picks one in the
// builder, a step undo takes back; codes and saves carry it; enemy ships
// get one at random.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BLUEPRINT_VERSION, decodeBlueprint, encodeBlueprint, encodePlacements } from '../src/core/blueprint.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand, buildShip, DEFAULT_HULL, newShip } from '../src/sim/builder.js';
import { newCampaign, refitShip } from '../src/sim/campaign.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { logFor, logMatches, openBuild, replay } from '../src/sim/replay.js';
import { initialState, saveData } from '../src/sim/root.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { rules } from './battleKit.js';

const placements = JSON.parse(readFileSync(new URL('./fixtures/example-ship.json', import.meta.url), 'utf8')).placements;
const example = buildShip(rules, 'starter', placements).ship;

test('there are the two styles Evan picked, and a new ship has the default', () => {
  assert.deepEqual([...rules.hulls.keys()], ['rounded', 'plated']);
  assert.equal(DEFAULT_HULL, 'rounded');
  assert.equal(newShip('starter').hull, 'rounded');
  assert.equal(example.hull, 'rounded');
});

test('the hull command restyles the ship and changes nothing else; a style there is none of is refused', () => {
  const plated = applyCommand(example, rules, { op: 'hull', style: 'plated' });
  assert.ok(plated.ok);
  assert.equal(plated.ship.hull, 'plated');
  assert.deepEqual({ ...plated.ship, hull: 'rounded' }, example);
  assert.equal(applyCommand(plated.ship, rules, { op: 'hull', style: 'plated' }).ship, plated.ship, 'the same style: the same ship');
  assert.deepEqual(applyCommand(example, rules, { op: 'hull', style: 'chrome' }), { ok: false, rule: 'hull', message: 'There is no hull style "chrome".' });
  // The boarding map is the layout's: the style never touches it.
  assert.deepEqual(mapFromShip(plated.ship, rules), mapFromShip(example, rules));
});

test('restyling in the builder is one step: undo takes it back, redo puts it back, and the log replays it', () => {
  const session = createSession(example, logFor(example));
  const styled = reduceSession(session, { type: 'build/hull', style: 'plated' }, rules);
  assert.equal(styled.ship.hull, 'plated');
  assert.deepEqual(styled.log.at(-1), { op: 'hull', style: 'plated' });
  assert.deepEqual(styled.notice.text, 'Plated hull.');
  assert.ok(logMatches(styled.log, styled.ship, rules));
  assert.equal(replay(styled.log, rules, 'starter').ships.at(-1).hull, 'plated');
  const undone = reduceSession(styled, { type: 'build/undo' }, rules);
  assert.equal(undone.ship.hull, 'rounded');
  assert.equal(undone.notice.text, 'Undone: plated hull.');
  assert.equal(reduceSession(undone, { type: 'build/redo' }, rules).ship.hull, 'plated');
  assert.equal(reduceSession(styled, { type: 'build/hull', style: 'plated' }, rules), styled, 'the style it has: nothing changes');
  assert.equal(reduceSession(session, { type: 'build/hull', style: 'chrome' }, rules).notice.tone, 'bad');
});

test("a ship's log keeps its style, and a log that doesn't is rebuilt", () => {
  const plated = { ...example, hull: 'plated' };
  assert.deepEqual(logFor(plated)[0], { op: 'hull', style: 'plated' });
  assert.equal(logFor(example)[0].op, 'place', 'the default style needs no step');
  assert.ok(logMatches(logFor(plated), plated, rules));
  assert.ok(!logMatches(logFor(example), plated, rules), 'a log that builds it rounded');
  const opened = openBuild(plated, logFor(example), rules);
  assert.equal(opened.ship.hull, 'plated');
  assert.ok(logMatches(opened.log, opened.ship, rules));
});

test('blueprint codes carry the style from version 3; older codes open in the default style', () => {
  const plated = { ...example, hull: 'plated' };
  const code = encodeBlueprint(plated);
  assert.match(code, new RegExp(`^wtb\\.${BLUEPRINT_VERSION}\\.`));
  const back = decodeBlueprint(code, rules);
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.ship, plated);
  const v2 = decodeBlueprint(encodePlacements('starter', example.modules, 2), rules);
  assert.ok(v2.ok, v2.error);
  assert.deepEqual(v2.ship, example);
  const unknown = decodeBlueprint(encodePlacements('starter', example.modules, 3, 'chrome'), rules);
  assert.ok(unknown.ok, 'a style this version lacks changes only the look');
  assert.equal(unknown.ship.hull, DEFAULT_HULL);
});

test('every enemy ship gets one of the styles at random, the same for the same seed, its layout as it was', () => {
  const seen = new Set();
  for (const preset of rules.ships.keys()) {
    for (let seed = 1; seed <= 20; seed++) {
      const made = generateShip(rules, preset, seed);
      assert.ok(made.ok, made.error);
      assert.ok(rules.hulls.has(made.ship.hull));
      assert.equal(generateShip(rules, preset, seed).ship.hull, made.ship.hull);
      seen.add(made.ship.hull);
    }
  }
  assert.deepEqual([...seen].sort(), ['plated', 'rounded']);
});

test('save version 16 gives every ship a style: the builder\'s, the campaign\'s and an approach\'s enemy', () => {
  const up = MIGRATIONS.find((m) => m.from === 15).up;
  const bare = ({ hull: _, ...ship }) => ship;
  const v15 = {
    builds: { active: 0, slots: [{ name: 'Ship 1', ship: bare(example), log: logFor(example) }, { name: 'Ship 2', ship: { ...example, hull: 'plated' }, log: [] }] },
    campaign: { ship: bare(example), run: { approach: { them: { ship: bare(example) } } } },
  };
  const v16 = up(v15);
  assert.equal(v16.builds.slots[0].ship.hull, 'rounded');
  assert.equal(v16.builds.slots[1].ship.hull, 'plated', 'a style it has stays');
  assert.equal(v16.campaign.ship.hull, 'rounded');
  assert.equal(v16.campaign.run.approach.them.ship.hull, 'rounded');
  assert.deepEqual(up(structuredClone(v15)), v16, 'the same on every load');
  assert.deepEqual(up({ ...v15, campaign: null }).campaign, null);
  assert.deepEqual(up({ ...v15, campaign: { ...v15.campaign, run: null } }).campaign.run, null);
  // A whole save from before opens as version 16, its ships Rounded.
  const campaign = newCampaign(rules, 7);
  const data = saveData({ ...initialState(2), campaign: { ...campaign, ship: bare(campaign.ship) } });
  const opened = parseSave(JSON.stringify({ version: 15, data }));
  assert.ok(opened.ok, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.equal(opened.save.data.campaign.ship.hull, 'rounded');
  const again = parseSave(JSON.stringify(makeSave(opened.save.data)));
  assert.deepEqual(again.save.data, opened.save.data, 'and stays that way');
});

test('restyling at the hangar takes no parts', () => {
  const campaign = newCampaign(rules, 7);
  const styled = refitShip(campaign, { ...campaign.ship, hull: 'plated' }, rules);
  assert.equal(styled.ship.hull, 'plated');
  assert.deepEqual(styled.parts, campaign.parts);
});
