// M23f's styling (ROADMAP §7): pieces on the hull's side and shaped pieces
// the hull wraps, paint and trim. Where a piece can go, the build commands,
// that a room change takes off what no longer fits, that looks change no
// stat, rule or boarding map, and that saves (v17) and codes (v4) carry
// them. How they look is tests/stylingDraw.test.js's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUEPRINT_VERSION, decodeBlueprint, encodeBlueprint, encodePlacements } from '../src/core/blueprint.js';
import { base64UrlToBytes, bytesToBase64Url, checksum } from '../src/core/codec.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand, DEFAULT_PAINT, DEFAULT_TRIM, isShipData, layoutProblems, openings } from '../src/sim/builder.js';
import { sideStats } from '../src/sim/approach.js';
import { refitShip } from '../src/sim/campaign.js';
import { flightChecklist, shipStats } from '../src/sim/constraints.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { logFor, logMatches, openBuild, renumbered, replay } from '../src/sim/replay.js';
import { initialState, saveData } from '../src/sim/root.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { fitPiece, mirroredPiece, misfits, mountSide, pieceCells, pieceError, pieceShape } from '../src/sim/styling.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

// The launched start ship, rooms by cell (x 7 to 16, y 4 to 9):
//    4 .......EE.........
//    5 .......EEQQQRRR...
//    6 .......EEQQQRRRBB.
//    7 .......EE+++RRRBB.
//    8 .......EELLAAW.BB.   (14, 8) is a gap the hull fills
//    9 .......EE.........
// Engines blow west; the gun at (13, 8) points south; the airlock's hatch
// opens south at (11, 8).
const start = readyToLaunch().ship;
const P = (type, x, y, rot = 0) => ({ type, x, y, rot });
const uidOf = (ship, type) => ship.modules.find((m) => m.type === type).uid;

function dress(ship, pieces) {
  for (const piece of pieces) {
    const result = applyCommand(ship, rules, { op: 'place', ...piece });
    assert.ok(result.ok, `${piece.type} at (${piece.x}, ${piece.y}): ${result.message}`);
    ship = result.ship;
  }
  return ship;
}

// Nine pieces on the start ship, one of most kinds, and a wedge and curve.
const DRESSED = [P('sweptwing', 9, 3, 0), P('sweptwing', 9, 9, 4), P('tailfin', 7, 10, 4), P('antenna', 13, 4), P('dish', 12, 4), P('lightstrip', 15, 9, 2), P('floodlight', 14, 4), P('wedge', 7, 3), P('curve', 15, 5)];

test('the data: 12 pieces in three groups, six paints and six trims, the yard\'s first', () => {
  assert.deepEqual(rules.stylingGroups.map((g) => g.id), ['wings', 'gear', 'sculpt']);
  assert.deepEqual([...rules.styling.keys()], ['sweptwing', 'deltawing', 'tailfin', 'spoiler', 'antenna', 'dish', 'floodlight', 'lightstrip', 'armorplate', 'wedge', 'longwedge', 'curve']);
  assert.deepEqual([...rules.styling.values()].filter((p) => p.shape).map((p) => p.id), ['wedge', 'longwedge', 'curve']);
  assert.equal(rules.paints.size, 6);
  assert.equal(rules.trims.size, 6);
  assert.equal([...rules.paints.keys()][0], DEFAULT_PAINT);
  assert.equal([...rules.trims.keys()][0], DEFAULT_TRIM);
  assert.equal(rules.frames.get('starter').maxStyling, 24);
  for (const id of rules.styling.keys()) assert.ok(!rules.modules.has(id), `${id} is a piece's id and not a part's`);
});

test('a piece goes on open cells against the hull: never over a room, in a gap the hull fills, on another piece or turned a way it does not take', () => {
  assert.equal(pieceError(start, rules, P('sweptwing', 9, 3, 0)), null, 'along the quarters, north');
  assert.equal(pieceError(start, rules, P('sweptwing', 9, 9, 4)), null, 'mirrored, south');
  assert.equal(pieceError(start, rules, P('sweptwing', 12, 4, 0)).rule, 'room');
  assert.equal(pieceError(start, rules, P('floodlight', 14, 8, 2)).rule, 'hull', 'the gap at (14, 8) is the hull\'s');
  assert.equal(pieceError(start, rules, P('sweptwing', 9, 2, 0)).rule, 'hull', 'a cell short of the hull');
  assert.equal(pieceError(start, rules, P('sweptwing', 9, 3, 1)).rule, 'rotation', 'a wing only flips sides');
  const winged = dress(start, [P('sweptwing', 9, 3, 0)]);
  assert.equal(pieceError(winged, rules, P('antenna', 10, 4)).rule, 'overlap');
  assert.equal(pieceError(start, rules, P('nothing', 9, 3)).rule, 'type');
});

test('never ahead of the bow, nor in the cell in front of an exhaust, a barrel or a hatch', () => {
  const bow = pieceError(start, rules, P('floodlight', 17, 7, 1));
  assert.equal(bow.rule, 'bow');
  for (const [piece, what] of [[P('floodlight', 6, 4, 3), "Engine's exhaust"], [P('floodlight', 13, 9, 2), "Weapon mount's barrel"], [P('floodlight', 11, 9, 2), "Airlock's hatch"]]) {
    const error = pieceError(start, rules, piece);
    assert.equal(error?.rule, 'clear', JSON.stringify(piece));
    assert.match(error.message, new RegExp(what));
  }
});

test('a wedge or a curve has a room all along a leg and its slope facing open space', () => {
  assert.equal(pieceError(start, rules, P('wedge', 7, 3, 0)), null, 'a rake at the stern\'s top corner');
  assert.equal(pieceError(start, rules, P('curve', 9, 4, 0)), null, 'rounding the step behind the quarters');
  assert.equal(pieceError(start, rules, P('longwedge', 9, 4, 0)), null);
  assert.equal(pieceError(start, rules, P('wedge', 7, 2, 0)).rule, 'hull', 'no room along a leg');
  assert.equal(pieceError(start, rules, P('wedge', 15, 5, 1)).rule, 'open', 'its slope against the bridge');
  const raked = dress(start, [P('wedge', 7, 3, 0)]);
  assert.equal(pieceError(raked, rules, P('antenna', 8, 3)).rule, 'open', 'nothing across its slope');
});

test('a ship takes at most its frame\'s styling pieces', () => {
  const frame = rules.frames.get('starter');
  const tight = { ...rules, frames: new Map([['starter', { ...frame, maxStyling: 1 }]]) };
  const one = dress(start, [P('antenna', 13, 4)]);
  assert.equal(pieceError(one, tight, P('dish', 12, 4)).rule, 'cap');
  assert.equal(pieceError(one, tight, P('dish', 12, 4), one.styling[0].uid), null, 'moving the one it has is fine');
});

test('the commands place, move, turn and remove pieces, and paint and trim the hull', () => {
  let ship = dress(start, [P('sweptwing', 9, 3, 0)]);
  const wing = ship.styling[0];
  assert.equal(wing.uid, start.nextUid, 'pieces share the ship\'s count of uids');
  assert.equal(ship.nextUid, start.nextUid + 1);
  ship = applyCommand(ship, rules, { op: 'move', uid: wing.uid, x: 9, y: 9, rot: 4 }).ship;
  assert.deepEqual(ship.styling, [{ uid: wing.uid, type: 'sweptwing', x: 9, y: 9, rot: 4 }]);
  assert.equal(applyCommand(ship, rules, { op: 'move', uid: wing.uid, x: 12, y: 4, rot: 0 }).rule, 'room');
  ship = applyCommand(ship, rules, { op: 'paint', color: 'rust' }).ship;
  ship = applyCommand(ship, rules, { op: 'trim', color: 'amber' }).ship;
  assert.deepEqual([ship.paint, ship.trim], ['rust', 'amber']);
  assert.equal(applyCommand(ship, rules, { op: 'paint', color: 'gold' }).rule, 'paint');
  ship = applyCommand(ship, rules, { op: 'remove', uid: wing.uid }).ship;
  assert.deepEqual(ship.styling, []);
  assert.deepEqual(ship.modules, start.modules, 'the rooms never moved');
});

test('a room change takes off the pieces it leaves with nothing to hold them, and undo puts them back', () => {
  const dressed = dress(start, [P('sweptwing', 9, 3, 0), P('antenna', 12, 4), P('floodlight', 16, 5)]);
  const [wing, antenna, light] = dressed.styling.map((p) => p.uid);
  // The room it was against goes.
  const gone = applyCommand(dressed, rules, { op: 'remove', uid: uidOf(dressed, 'quarters') });
  assert.deepEqual(gone.removed.map((p) => p.uid), [wing]);
  assert.deepEqual(gone.ship.styling.map((p) => p.uid), [antenna, light]);
  // A room built over it.
  const over = applyCommand(dressed, rules, { op: 'place', type: 'corridor', x: 12, y: 4, rot: 0 });
  assert.deepEqual(over.removed.map((p) => p.uid), [antenna]);
  // An exhaust now pointing at it: an engine whose west side is beside it.
  const blown = applyCommand(dressed, rules, { op: 'place', type: 'engine', x: 13, y: 3, rot: 0 });
  assert.ok(blown.ok, blown.message);
  assert.deepEqual(blown.removed.map((p) => p.uid), [antenna]);
  assert.deepEqual(misfits(blown.ship, rules), []);
  // In the builder: the notice says so, and undo brings both back.
  let session = createSession(dressed, logFor(dressed));
  session = reduceSession(session, { type: 'build/tap', x: 10.5, y: 5.5 }, rules);
  session = reduceSession(session, { type: 'build/delete' }, rules);
  assert.equal(session.notice.text, 'Removed Crew quarters. The Swept wing came off.');
  assert.equal(session.ship.styling.length, 2);
  session = reduceSession(session, { type: 'build/undo' }, rules);
  assert.equal(session.ship, dressed);
  // Paint, trim and the hull's style never take a piece off.
  for (const command of [{ op: 'paint', color: 'bone' }, { op: 'trim', color: 'lime' }, { op: 'hull', style: 'plated' }]) {
    assert.equal(applyCommand(dressed, rules, command).ship.styling.length, 3);
  }
});

test('looks change no stat, rule or boarding map: the start ship dressed and painted against it bare', () => {
  const dressed = applyCommand(applyCommand(dress(start, DRESSED), rules, { op: 'paint', color: 'olive' }).ship, rules, { op: 'trim', color: 'violet' }).ship;
  assert.equal(dressed.styling.length, DRESSED.length);
  const crew = readyToLaunch().crew;
  assert.deepEqual(shipStats(dressed, rules), shipStats(start, rules));
  assert.deepEqual(flightChecklist(dressed, rules, crew), flightChecklist(start, rules, crew));
  assert.deepEqual(layoutProblems(dressed, rules), layoutProblems(start, rules));
  assert.deepEqual(openings(dressed, rules), openings(start, rules));
  assert.deepEqual(mapFromShip(dressed, rules), mapFromShip(start, rules));
  const side = (ship) => ({ ship, damage: {}, wrecked: {} });
  assert.deepEqual(sideStats(side(dressed), rules), sideStats(side(start), rules));
  // A refit at the hangar that only styles takes no parts.
  const campaign = readyToLaunch();
  assert.deepEqual(refitShip(campaign, dressed).parts, campaign.parts);
});

test('a piece fits itself to the hull where it is tapped, and Turn shows it the next way round', () => {
  // A wing tapped below the ship turns to face up into it.
  const flipped = fitPiece(start, rules, 'sweptwing', 0, 10.5, 10.5);
  assert.deepEqual([flipped.rot, pieceError(start, rules, flipped)], [4, null]);
  // In the builder: two taps to place, from outside.
  let session = createSession(start, logFor(start));
  session = reduceSession(session, { type: 'build/arm', moduleType: 'sweptwing' }, rules);
  assert.equal(session.layer, 'styling');
  session = reduceSession(session, { type: 'build/tap', x: 10.3, y: 3.6 }, rules);
  assert.equal(session.ship, start, 'the first tap only shows it');
  assert.deepEqual([session.ghost.x, session.ghost.y, session.ghost.rot], [9, 3, 0], 'centred under the finger, along the quarters');
  session = reduceSession(session, { type: 'build/rotate' }, rules);
  assert.equal(session.ghost.rot, 4, 'turned, it flips sides');
  session = reduceSession(session, { type: 'build/rotate' }, rules);
  session = reduceSession(session, { type: 'build/tap', x: session.ghost.x + 0.5, y: session.ghost.y + 0.5 }, rules);
  assert.equal(session.ship.styling.length, 1);
  assert.equal(session.notice.text, 'Placed Swept wing.');
  // Taps on the styling layer pick pieces, not rooms; Turn and Delete act on them.
  session = reduceSession(session, { type: 'build/cancel' }, rules);
  session = reduceSession(session, { type: 'build/tap', x: 12.5, y: 6.5 }, rules);
  assert.equal(session.selected, null, 'a room is not on this layer');
  const uid = session.ship.styling[0].uid;
  session = reduceSession(session, { type: 'build/tap', x: 10.5, y: 4.5 }, rules);
  assert.equal(session.selected, uid);
  session = reduceSession(session, { type: 'build/delete' }, rules);
  assert.deepEqual(session.ship.styling, []);
  // Paint, one tap and undoable.
  session = reduceSession(session, { type: 'build/paint', color: 'navy' }, rules);
  assert.deepEqual([session.ship.paint, session.notice.text], ['navy', 'Navy paint.']);
  session = reduceSession(session, { type: 'build/undo' }, rules);
  assert.equal(session.ship.paint, DEFAULT_PAINT);
  // The rooms' layer again lets go of what was picked out.
  session = reduceSession(session, { type: 'build/layer', layer: 'rooms' }, rules);
  assert.deepEqual([session.layer, session.selected, session.armed], ['rooms', null, null]);
});

test('a tap on the hull by its side finds the side; a ship loaded from elsewhere opens on the same layer', () => {
  const onRoom = fitPiece(start, rules, 'antenna', 0, 12.5, 5.2);
  assert.equal(pieceError(start, rules, onRoom).rule, 'room', 'nothing fits on the room itself');
  const near = fitPiece(start, rules, 'antenna', 0, 12.5, 5.2, { reach: 1 });
  assert.deepEqual([near.x, near.y, near.rot, pieceError(start, rules, near)], [12, 4, 0, null]);
  assert.deepEqual(fitPiece(start, rules, 'antenna', 0, 12.5, 6.5, { reach: 1 }), P('antenna', 12, 6, 0), 'out of reach, the first try says why');
  let session = createSession(start, logFor(start));
  session = reduceSession(session, { type: 'build/arm', moduleType: 'antenna' }, rules);
  session = reduceSession(session, { type: 'build/tap', x: 12.5, y: 5.2 }, rules);
  assert.deepEqual([session.ghost.x, session.ghost.y, session.ghost.rot], [12, 4, 0]);
  session = reduceSession(session, { type: 'build/load', ship: { ...start } }, rules);
  assert.deepEqual([session.layer, session.armed, session.past.length], ['styling', null, 0]);
});

test("a piece mirrored across a ship's middle is the same piece flipped: its cells, the side it is against the hull by, a wedge's or a curve's outline", () => {
  const across = 4 + 9; // a ship on rows 4 to 9
  const MIRROR = { n: 's', s: 'n', e: 'e', w: 'w' };
  const at = (list) => list.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).sort();
  for (const def of rules.styling.values()) {
    for (const rot of def.turns) {
      const placement = P(def.id, 10, 2, rot);
      const mirror = mirroredPiece(def, placement, across);
      assert.ok(mirror && def.turns.includes(mirror.rot), `${def.id} turned ${rot}`);
      assert.deepEqual(at(pieceCells(def, mirror)), at(pieceCells(def, placement).map(([x, y]) => [x, across - y])), `${def.id} turned ${rot}: its cells`);
      if (def.shape) assert.deepEqual(at(pieceShape(def, mirror).region), at(pieceShape(def, placement).region.map(([x, y]) => [x, across + 1 - y])), `${def.id} turned ${rot}: its outline`);
      else assert.equal(mountSide(mirror.rot), MIRROR[mountSide(rot)], `${def.id} turned ${rot}: its side`);
      assert.deepEqual(mirroredPiece(def, mirror, across), placement, `${def.id} turned ${rot}: mirrored twice, as it was`);
    }
  }
});

test('build logs replay looks and pieces, and a ship renumbers with its pieces after its parts', () => {
  const dressed = applyCommand(dress(start, DRESSED), rules, { op: 'paint', color: 'bone' }).ship;
  const tidy = renumbered(dressed);
  assert.ok(logMatches(logFor(tidy), tidy, rules));
  assert.deepEqual(replay(logFor(tidy), rules, 'starter').ships.at(-1), tidy);
  assert.equal(tidy.styling[0].uid, tidy.modules.length + 1);
  const opened = openBuild(dressed, [], rules);
  assert.equal(opened.ship.styling.length, DRESSED.length);
  assert.ok(isShipData(dressed));
  assert.ok(!isShipData({ ...dressed, styling: [{ ...dressed.styling[0], rot: 8 }] }));
  assert.ok(!isShipData({ ...dressed, styling: [{ ...dressed.styling[0], uid: dressed.modules[0].uid }] }), 'a piece\'s uid isn\'t a part\'s');
});

test('save version 17 gives every ship the yard\'s paint and trim and no pieces, the same on every load', () => {
  const up = MIGRATIONS.find((m) => m.from === 16).up;
  const bare = ({ paint: _, trim: __, styling: ___, ...ship }) => ship;
  const plain = bare(start);
  const v16 = {
    builds: { active: 0, slots: [{ name: 'Ship 1', ship: plain, log: logFor(plain) }] },
    campaign: { ship: plain, run: { approach: { them: { ship: plain } } }, fight: { boarding: { dir: 'in', ship: plain } } },
  };
  const v17 = up(v16);
  for (const ship of [v17.builds.slots[0].ship, v17.campaign.ship, v17.campaign.run.approach.them.ship, v17.campaign.fight.boarding.ship]) {
    assert.deepEqual([ship.paint, ship.trim, ship.styling], ['slate', 'sky', []]);
  }
  assert.deepEqual(up(structuredClone(v16)), v17, 'the same on every load');
  assert.deepEqual(up({ ...v16, campaign: null }).campaign, null);
  // A whole save from before opens as version 17, looks and all.
  const data = saveData({ ...initialState(2), campaign: { ...readyToLaunch(), ship: plain } });
  const opened = parseSave(JSON.stringify({ version: 16, data }));
  assert.ok(opened.ok, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.deepEqual(opened.save.data.campaign.ship.styling, []);
  const again = parseSave(JSON.stringify(makeSave(opened.save.data)));
  assert.deepEqual(again.save.data, opened.save.data, 'and stays that way');
});

test('codes carry paint, trim and pieces from version 4; older codes open in the yard\'s colors with none', () => {
  assert.equal(BLUEPRINT_VERSION, 4);
  const dressed = renumbered(applyCommand(applyCommand(dress(start, DRESSED), rules, { op: 'paint', color: 'rust' }).ship, rules, { op: 'trim', color: 'signal' }).ship);
  const code = encodeBlueprint(dressed);
  assert.match(code, /^wtb\.4\./);
  const back = decodeBlueprint(code, rules);
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.ship, dressed);
  const v3 = decodeBlueprint(encodePlacements('starter', start.modules, 3, 'plated'), rules);
  assert.ok(v3.ok, v3.error);
  assert.deepEqual([v3.ship.hull, v3.ship.paint, v3.ship.trim, v3.ship.styling], ['plated', 'slate', 'sky', []]);
  // Looks this version doesn't have change only the look.
  const odd = decodeBlueprint(encodePlacements('starter', start.modules, 4, 'rounded', { paint: 'gold', trim: 'pink', styling: [P('antenna', 13, 4), P('banner', 12, 4), P('dish', 12, 5)] }), rules);
  assert.ok(odd.ok, odd.error);
  assert.deepEqual([odd.ship.paint, odd.ship.trim, odd.ship.styling.map((p) => p.type)], ['slate', 'sky', ['antenna']], 'an unknown piece, and one over a room, are left off');
  // A code cut short is damaged, not a ship without its last piece.
  const [prefix, version, payload] = code.split('.');
  const bytes = base64UrlToBytes(payload);
  const cut = `${prefix}.${version}.${bytesToBase64Url(bytes.subarray(0, bytes.length - 1))}`;
  assert.equal(decodeBlueprint(`${cut}.${checksum(cut)}`, rules).ok, false);
});
