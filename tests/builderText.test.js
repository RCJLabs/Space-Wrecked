import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newShip } from '../src/sim/builder.js';
import { flightChecklist } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { cardFor, pieceCard } from '../src/ui/builder/card.js';
import { flightSummary, hintFor } from '../src/ui/builder/hints.js';
import { EXAMPLE_SCRIPT, runScript } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';
import { readFileSync } from 'node:fs';
import { readyToLaunch } from './launchKit.js';

const defs = indexDefs(readData());
const act = (session, action) => reduceSession(session, action, defs);
const start = () => createSession(newShip('starter'));

test('the hint follows what the player is doing', () => {
  let s = start();
  assert.match(hintFor(s, defs).text, /Drag a part onto the grid/);
  s = act(s, { type: 'build/arm', moduleType: 'reactor' });
  assert.equal(hintFor(s, defs).text, 'Tap the grid where the Reactor goes.');
  s = act(s, { type: 'build/tap', x: 2, y: 1 });
  assert.deepEqual(hintFor(s, defs), { tone: 'good', text: 'Tap the Reactor again to place it.' });
  s = act(act(s, { type: 'build/tap', x: 2, y: 1 }), { type: 'build/tap', x: 2.5, y: 1.5 });
  assert.equal(hintFor(s, defs).tone, 'bad', 'a preview over the placed reactor says why it is blocked');
  assert.match(hintFor(s, defs).text, /would overlap Reactor at \(1, 0\)/);
  s = act(act(s, { type: 'build/cancel' }), { type: 'build/tap', x: 1.5, y: 0.5 });
  assert.equal(hintFor(s, defs).text, 'Reactor: tap where to move it, or Turn or Delete.');
  const moving = act(s, { type: 'build/tap', x: 7.5, y: 4.5 });
  assert.deepEqual(hintFor(moving, defs), { tone: 'good', text: 'Tap the Reactor again to move it here.' });
  const blocked = act(act(act(s, { type: 'build/cancel' }), { type: 'build/drop', placement: { type: 'corridor', x: 7, y: 4, rot: 0 } }), { type: 'build/tap', x: 1.5, y: 0.5 });
  assert.match(hintFor(act(blocked, { type: 'build/tap', x: 6.5, y: 4.5 }), defs).text, /would overlap Corridor at \(7, 4\)/, 'a move onto another part says why not');
  const drag = { kind: 'part', type: 'corridor', placement: null };
  assert.equal(hintFor(s, defs, drag).text, 'Let go off the grid to cancel.');
  assert.equal(hintFor(s, defs, { ...drag, placement: { x: 3, y: 0 } }).text, 'Let go to place the Corridor here.');
  assert.equal(hintFor(s, defs, { ...drag, kind: 'placed', placement: { x: 3, y: 0 } }).text, 'Let go to move the Corridor here.');
});

test('from outside, the hint and the card speak of styling pieces', () => {
  let s = act(createSession(readyToLaunch().ship), { type: 'build/layer', layer: 'styling' });
  assert.match(hintFor(s, defs).text, /^Drag a piece beside the hull/);
  s = act(s, { type: 'build/arm', moduleType: 'antenna' });
  assert.equal(hintFor(s, defs).text, 'Tap beside the hull where the Antenna goes.');
  s = act(s, { type: 'build/tap', x: 12.5, y: 4.5 });
  assert.deepEqual(hintFor(s, defs), { tone: 'good', text: 'Tap the Antenna again to place it, or Turn it.' });
  assert.deepEqual(hintFor(act(s, { type: 'build/tap', x: 12.5, y: 6.5 }), defs), { tone: 'bad', text: 'Antenna goes beside the hull, not over a room.' });
  s = act(act(act(s, { type: 'build/tap', x: 12.5, y: 4.5 }), { type: 'build/cancel' }), { type: 'build/tap', x: 12.5, y: 4.5 });
  assert.equal(hintFor(s, defs).text, 'Antenna: tap where to move it, or Turn or Delete.');
  assert.deepEqual(pieceCard(defs.styling.get('sweptwing')), {
    title: 'Swept wing',
    lines: ['2×2 squares · flips to either side', "Goes beside the hull, its root all along a room's side.", 'Looks only: no mass, power or cost, and no parts used. A room change that leaves it nothing to hold it takes it off.'],
  });
  const curve = pieceCard(defs.styling.get('curve'), { x: 15, y: 5, rot: 1 });
  assert.deepEqual([curve.lines[0], curve.lines[1], curve.lines.at(-1)], ['1×2 squares · turns and flips', 'Shapes the hull: a room all along one straight side, its curved side to open space.', 'At (15, 5)']);
  assert.equal(pieceCard(defs.styling.get('antenna')).lines[0], '1×1 squares · turns');
});

test('the chip counts parts and gives the first fix, or says the ship is ready', () => {
  const summary = (ship) => flightSummary(ship, defs, flightChecklist(ship, defs, 4));
  assert.equal(summary(newShip('starter')), null);
  const s = act(start(), { type: 'build/drop', placement: { type: 'corridor', x: 1, y: 0, rot: 0 } });
  assert.deepEqual(summary(s.ship), { tone: 'bad', text: '1/40 parts · 5 to fix: Add Engine (+12 thrust)' });
  const script = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
  const { ship } = runScript(script, defs);
  assert.deepEqual(summary(ship), { tone: 'good', text: '11/40 parts · Ready to launch' });
});

test('the details card lists size, what faces space, stats and where a placed part sits', () => {
  const reactor = defs.modules.get('reactor');
  assert.deepEqual(cardFor(defs, reactor), {
    title: 'Reactor',
    lines: ['3×3 squares · turns', 'Power +8 · Mass 6 · Hull points 30', 'Cost 200 · Yard standard'],
  });
  const engine = defs.modules.get('engine');
  const placed = cardFor(defs, engine, { module: { uid: 4, type: 'engine', x: 0, y: 2, rot: 0 }, joined: false });
  assert.deepEqual(placed.lines, [
    "2×2 squares · doesn't turn · exhaust must face space",
    'Power −1 · Thrust 12 · Mass 3 · Hull points 15',
    'Cost 200 · Yard standard',
    'At (0, 2) · not joined to the bridge',
  ]);
  const quarters = cardFor(defs, defs.modules.get('quarters'), { module: { uid: 1, type: 'quarters', x: 4, y: 0, rot: 1 }, joined: null });
  assert.equal(quarters.lines[0], '2×3 squares · turns', 'size as placed');
  assert.equal(quarters.lines.at(-1), 'At (4, 0) · no bridge yet');
});

test("the details card says what a gun, a shield and point defense do in an approach, from the part's own numbers (M23e)", () => {
  const line = (type) => cardFor(defs, defs.modules.get(type)).lines[2];
  assert.equal(line('weapon'), 'In an approach: 15 damage a hit, one shot a round.');
  assert.equal(line('cannon'), 'In an approach: 30 damage a hit, one shot a round.');
  assert.equal(line('shield'), 'In an approach: holds off 10 damage a round, from the first hits.');
  assert.equal(line('shieldarray'), 'In an approach: holds off 25 damage a round, from the first hits.');
  assert.equal(line('pointdefense'), `In an approach: the other ship's guns hit 10 in 100 less, up to ${defs.balance.interceptMax} with more turrets. Their volleys at your guns hit it too.`);
  assert.equal(cardFor(defs, defs.modules.get('cannon')).lines[0], '2×1 squares · turns · barrel must face space');
  assert.equal(cardFor(defs, defs.modules.get('surgery')).lines[2], 'On the run: heals each of the wounded 2 a jump, 3 with a medic aboard. Wrecked, it heals no one.');
});

test('the details card says what quarters, life support and the med bay do on the run', () => {
  const room = 'On the run: the ship carries as many crew as its berths and life support both cover. Recruits sign on at stations.';
  assert.equal(cardFor(defs, defs.modules.get('quarters')).lines[2], room);
  assert.equal(cardFor(defs, defs.modules.get('lifesupport')).lines[2], room);
  const medbay = cardFor(defs, defs.modules.get('medbay')).lines;
  assert.equal(medbay[2], 'On the run: heals each of the wounded 1 a jump, 2 with a medic aboard. Wrecked, it heals no one.');
  assert.match(medbay[3], /^Cost /);
  // The rest say nothing of the run.
  assert.equal(cardFor(defs, defs.modules.get('reactor')).lines.length, 3);
});

test("a Bastion part's card has its maker's word and how it differs from the Yard's (M23g)", () => {
  assert.deepEqual(cardFor(defs, defs.modules.get('bastion-engine')), {
    title: 'Bastion engine',
    lines: [
      "2×2 squares · doesn't turn · exhaust must face space",
      'Power −1 · Thrust 12 · Mass 4 · Hull points 23',
      "Built to take a beating: tougher than the yard's, and heavier.",
      "Next to the Yard's: Mass +1 · Hull points +8 · Cost +20",
      'Cost 220 · Bastion Arms',
    ],
  });
  // What a gun does in an approach is its base part's; the corridor costs the same.
  const gun = cardFor(defs, defs.modules.get('bastion-weapon')).lines;
  assert.equal(gun[2], 'In an approach: 15 damage a hit, one shot a round.');
  assert.equal(cardFor(defs, defs.modules.get('bastion-corridor')).lines.at(-2), "Next to the Yard's: Mass +1 · Hull points +5");
  // A Yard part's card has neither line.
  assert.equal(cardFor(defs, defs.modules.get('engine')).lines.length, 3);
});

test("a wrecked part's card says it stays on until a station repairs it, and the run's chip says Ready to jump (M23h)", () => {
  const engine = defs.modules.get('engine');
  const card = cardFor(defs, engine, { module: { uid: 4, type: 'engine', x: 0, y: 2, rot: 0 }, joined: true, wrecked: true });
  assert.equal(card.lines.at(-1), 'Wrecked in an approach: it comes off once the station repairs it, and it can still move.');
  assert.ok(!cardFor(defs, engine, { module: { uid: 4, type: 'engine', x: 0, y: 2, rot: 0 }, joined: true }).lines.some((line) => line.startsWith('Wrecked')));
  const ship = readyToLaunch().ship;
  const lines = flightChecklist(ship, defs, 3);
  assert.match(flightSummary(ship, defs, lines).text, / · Ready to launch$/);
  assert.match(flightSummary(ship, defs, lines, undefined, 'Ready to jump').text, / · Ready to jump$/);
});
