// Who they are and the ship's colors (M58): a crew member's look and
// callsign changed from the crew card, the scars a fight leaves, the
// crew's suits in the ship's paint, and the ship's pattern, second color
// and glow, through the builder, its log, the codes and the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeBlueprint, encodeBlueprint, encodePlacements } from '../src/core/blueprint.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand, DEFAULT_ACCENT, DEFAULT_GLOW, DEFAULT_PATTERN, isShipData, newShip } from '../src/sim/builder.js';
import { beginFight, campaignProblems, endFight, newCampaign, scarsTaken } from '../src/sim/campaign.js';
import { callsignProblem, fullName, MAX_CALLSIGN, scarredLook, setCrewLook, shortName, tidyCallsign } from '../src/sim/crewLook.js';
import { isIdentity, setSuits, suitsOf, withIdentity } from '../src/sim/identity.js';
import { stepLook } from '../src/sim/looks.js';
import { isCommand, logFor, replay } from '../src/sim/replay.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { reduceSession, createSession } from '../src/sim/session.js';
import { cellBounds, flameColor, PATTERNS, plateColor } from '../src/render/livery.js';
import { glows, paints } from '../src/render/palette.js';
import { rules } from './battleKit.js';

const defs = rules;

test("any crew member's look and callsign change from the crew card: kept, tidied, checked", () => {
  const campaign = newCampaign(rules, 5);
  const member = campaign.crew[1];
  const look = stepLook(stepLook(member.look, 'hair'), 'face');
  const set = setCrewLook(campaign, member.id, look, '  "Rook"  ');
  assert.equal(set.ok, true);
  const after = set.campaign.crew[1];
  assert.deepEqual(after.look, look);
  assert.equal(after.callsign, 'Rook');
  assert.deepEqual(campaignProblems(set.campaign), []);
  // Taken off with an empty one; the others untouched.
  const cleared = setCrewLook(set.campaign, member.id, look, '').campaign;
  assert.equal('callsign' in cleared.crew[1], false);
  assert.deepEqual(cleared.crew[0], campaign.crew[0]);
  // Refused: someone not aboard, a look the game can't draw, a long or odd callsign.
  assert.equal(setCrewLook(campaign, 99, look).ok, false);
  assert.equal(setCrewLook(campaign, member.id, { ...look, hair: 'feathers' }).ok, false);
  assert.match(setCrewLook(campaign, member.id, look, 'X'.repeat(MAX_CALLSIGN + 1)).error, /12 letters at most/);
  assert.ok(callsignProblem('Rook<b>'));
  assert.equal(tidyCallsign('  Old   Man '), 'Old Man');
  // Through the root reducer, saved and read back.
  const state = { ...initialState(4), campaign };
  const next = reduce(state, { type: 'campaign/crew/look', rules, id: member.id, look, callsign: 'Rook' });
  assert.equal(next.campaign.crew[1].callsign, 'Rook');
  const read = parseSave(JSON.stringify(makeSave(saveData(next))));
  assert.equal(read.ok, true, read.error);
  assert.equal(read.save.data.campaign.crew[1].callsign, 'Rook');
  assert.equal(reduce(state, { type: 'campaign/crew/look', rules, id: member.id, look, callsign: 'Way too long callsign' }), state);
});

test('a callsign in the full name and on the fight\'s buttons', () => {
  assert.equal(fullName({ name: 'Fen Lindqvist', callsign: 'Rook' }), "Fen 'Rook' Lindqvist");
  assert.equal(fullName({ name: 'Teo', callsign: 'Ledger' }), "Teo 'Ledger'");
  assert.equal(fullName({ name: 'Fen Lindqvist' }), 'Fen Lindqvist');
  assert.equal(shortName({ name: 'Fen Lindqvist', callsign: 'Rook' }), 'Rook');
  assert.equal(shortName({ name: 'Fen Lindqvist' }), 'Fen Lindqvist');
});

test('going down in a fight and living leaves a scar, then a jaw plate where it was; any other mark stays; the dead bear nothing', () => {
  assert.equal(scarredLook({ mark: 'none' }).mark, 'scar');
  assert.equal(scarredLook({ mark: 'scar' }).mark, 'jawplate');
  assert.equal(scarredLook({ mark: 'jawplate' }).mark, 'jawplate');
  assert.equal(scarredLook({ mark: 'freckles' }).mark, 'freckles');
  const start = newCampaign(rules, 5);
  const plain = { ...start, crew: start.crew.map((m) => ({ ...m, look: { ...m.look, mark: 'none' } })) };
  const fighting = beginFight(plain, rules).campaign;
  const units = fighting.fight.battle.units.map((u) => (u.id === 'c1' ? { ...u, status: 'stable', hp: 0 } : u.id === 'c2' ? { ...u, status: 'down', hp: 0 } : u));
  const battle = { ...fighting.fight.battle, units, winner: 'crew' };
  assert.deepEqual(scarsTaken(fighting, battle, rules).map(({ member, mark }) => [member.id, mark]), [[1, 'scar'], [2, 'scar']]);
  assert.deepEqual(scarsTaken(fighting, { ...battle, winner: null }, rules), [], 'not over yet');
  const after = endFight({ ...fighting, fight: { ...fighting.fight, battle } }, rules);
  assert.deepEqual(after.crew.map((m) => m.look.mark), ['scar', 'scar', 'none']);
  assert.deepEqual(campaignProblems(after), []);
  // Down again: the jaw plate.
  const again = beginFight(after, rules).campaign;
  const second = { ...again.fight.battle, units: again.fight.battle.units.map((u) => (u.id === 'c1' ? { ...u, status: 'down', hp: 0 } : u)), winner: 'enemy' };
  assert.deepEqual(scarsTaken(again, second, rules).map(({ member, mark }) => [member.id, mark]), [[1, 'jawplate']]);
  assert.equal(endFight({ ...again, fight: { ...again.fight, battle: second } }, rules).crew[0].look.mark, 'jawplate');
});

test("the crew's suits in the ship's paint or their own: standard until picked, kept in the identity", () => {
  const campaign = withIdentity(newCampaign(rules, 5), rules);
  assert.equal(suitsOf(campaign), 'standard');
  const set = setSuits(campaign, 'ship', rules);
  assert.equal(set.ok, true);
  assert.equal(suitsOf(set.campaign), 'ship');
  assert.equal(isIdentity(set.campaign.identity), true);
  assert.equal(setSuits(campaign, 'gold', rules).ok, false);
  assert.equal(isIdentity({ ...set.campaign.identity, suits: 'gold' }), false);
  const state = { ...initialState(4), campaign };
  assert.equal(reduce(state, { type: 'campaign/suits', rules, suits: 'ship' }).campaign.identity.suits, 'ship');
});

test("the ship's pattern, second color and glow: commands, refusals, the log that rebuilds her", () => {
  const ship = newShip('starter');
  assert.deepEqual([ship.pattern, ship.accent, ship.glow], [DEFAULT_PATTERN, DEFAULT_ACCENT, DEFAULT_GLOW]);
  let next = applyCommand(ship, defs, { op: 'pattern', pattern: 'band' }).ship;
  next = applyCommand(next, defs, { op: 'accent', color: 'rust' }).ship;
  next = applyCommand(next, defs, { op: 'glow', glow: 'plasma' }).ship;
  assert.deepEqual([next.pattern, next.accent, next.glow], ['band', 'rust', 'plasma']);
  assert.equal(isShipData(next), true);
  for (const bad of [{ op: 'pattern', pattern: 'tartan' }, { op: 'accent', color: 'sky' }, { op: 'glow', glow: 'disco' }]) {
    const refused = applyCommand(ship, defs, bad);
    assert.equal(refused.ok, false, bad.op);
    assert.equal(refused.rule, bad.op);
  }
  const log = logFor(next);
  assert.ok(log.every(isCommand));
  assert.deepEqual(log.slice(0, 3), [{ op: 'pattern', pattern: 'band' }, { op: 'accent', color: 'rust' }, { op: 'glow', glow: 'plasma' }]);
  const built = replay(log, defs, 'starter').ships.at(-1);
  assert.deepEqual([built.pattern, built.accent, built.glow], ['band', 'rust', 'plasma']);
});

test('the builder session picks them, a step each that undo takes back', () => {
  let session = createSession(newShip('starter'));
  session = reduceSession(session, { type: 'build/pattern', pattern: 'split' }, defs);
  session = reduceSession(session, { type: 'build/glow', glow: 'ice' }, defs);
  assert.deepEqual([session.ship.pattern, session.ship.glow], ['split', 'ice']);
  assert.match(session.notice.text, /Ice glow/);
  session = reduceSession(session, { type: 'build/undo' }, defs);
  assert.equal(session.ship.glow, DEFAULT_GLOW);
  assert.equal(reduceSession(session, { type: 'build/accent', color: 'nope' }, defs).notice.tone, 'bad');
});

test('blueprint codes v5 carry them; a v4 code opens plain with the maker\'s glow; one this version doesn\'t know opens as the default', () => {
  const ship = { ...newShip('starter'), pattern: 'blocks', accent: 'olive', glow: 'ember' };
  const read = decodeBlueprint(encodeBlueprint(ship), defs);
  assert.equal(read.ok, true, read.error);
  assert.deepEqual([read.ship.pattern, read.ship.accent, read.ship.glow], ['blocks', 'olive', 'ember']);
  const old = decodeBlueprint(encodePlacements('starter', [], 4), defs);
  assert.equal(old.ok, true, old.error);
  assert.deepEqual([old.ship.pattern, old.ship.accent, old.ship.glow], [DEFAULT_PATTERN, DEFAULT_ACCENT, DEFAULT_GLOW]);
  const unknown = decodeBlueprint(encodePlacements('starter', [], 5, 'rounded', { pattern: 'tartan', accent: 'gold', glow: 'disco' }), defs);
  assert.deepEqual([unknown.ship.pattern, unknown.ship.accent, unknown.ship.glow], [DEFAULT_PATTERN, DEFAULT_ACCENT, DEFAULT_GLOW]);
});

test('save v49: an old save\'s ships plain, bone, the maker\'s glow; its identity standard-suited; no one with a callsign', () => {
  assert.equal(SAVE_VERSION, 49);
  const step = MIGRATIONS.find((m) => m.from === 48);
  const ship = { frame: 'starter', hull: 'rounded', paint: 'rust', trim: 'sky', modules: [], styling: [], nextUid: 1 };
  const data = { builds: { slots: [{ ship }] }, campaign: { ship, identity: { name: 'Iron Psalm', number: 'FJ-897', emblem: null }, crew: [] } };
  const up = step.up(data);
  for (const s of [up.builds.slots[0].ship, up.campaign.ship]) assert.deepEqual([s.pattern, s.accent, s.glow, s.paint], ['plain', 'bone', 'maker', 'rust']);
  assert.equal(up.campaign.identity.suits, 'standard');
  assert.equal(step.up({ ...data, campaign: { ...data.campaign, identity: null } }).campaign.identity, null);
});

test('the livery drawn: the second color only where the pattern puts it, the glow over the maker\'s flame', () => {
  const bounds = cellBounds([[0, 0], [9, 3]]);
  assert.deepEqual(bounds, { x0: 0, y0: 0, x1: 10, y1: 4 });
  const skin = { plates: ['#111111'] };
  const plate = (pattern, at) => plateColor({ pattern, accent: 'bone' }, skin, bounds, at, 0);
  const fore = [8, 1, 9, 2];
  const aft = [0, 1, 1, 2];
  assert.equal(plate('plain', fore), '#111111');
  assert.equal(plate('split', fore), paints.bone.plates[0]);
  assert.equal(plate('split', aft), '#111111');
  assert.equal(plate('band', [4, 0, 5, 1]), paints.bone.plates[0]);
  assert.equal(plate('band', fore), '#111111');
  assert.notEqual(plate('blocks', [0, 0, 1, 1]), plate('blocks', [2, 0, 3, 1]));
  assert.deepEqual(Object.keys(PATTERNS).sort(), defs.patterns ? [...defs.patterns.keys()].sort() : []);
  assert.equal(flameColor({ glow: 'maker' }, '#abcdef'), '#abcdef');
  assert.equal(flameColor({ glow: 'ice' }, '#abcdef'), glows.ice);
  assert.equal(flameColor(undefined, '#abcdef'), '#abcdef');
});
