// The approach screen's words (src/ui/campaign/approachText.js), and the
// sector map's for hostile ships and repairs (sectorText.js): every odds the
// screen shows is the one the rules roll against.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { AIMS, choicesFor, closeChance, enemyOrder, fleeChance, sideStats, targetsOf } from '../src/sim/approach.js';
import { approachState, giveOrder } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { repairPrice } from '../src/sim/repair.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { approachText } from '../src/ui/campaign/approachText.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { nodeText, sectorText } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
function atCutter(extra = {}) {
  const fresh = onRun(extra);
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: 1 } } : node));
  return jump({ ...fresh, run: { ...fresh.run, sector: { ...sector, nodes } } }, rules, to).campaign;
}
// Plays `pick`'s orders from campaign seeds up until the approach ends in
// `kind`.
function endingIn(kind, pick, extra = {}) {
  const start = atCutter(extra);
  for (let seed = 0; seed < 3000; seed++) {
    let at = { ...start, rng: seedFrom(seed) };
    while (!at.run.approach.outcome) at = giveOrder(at, rules, pick(at)).campaign;
    if (at.run.approach.outcome.kind === kind) return at;
  }
  throw new Error(`No seed ends in ${kind}`);
}

test('an approach: the two ships, their order, and every order with the odds the rules roll against', () => {
  const campaign = atCutter();
  const text = approachText(campaign, rules);
  assert.equal(text.where, 'Hostile ship · Pirate cutter');
  assert.equal(text.round, `Round 1 of ${rules.balance.approachRounds}`);
  assert.equal(text.you.name, 'Your ship');
  assert.equal(text.them.name, 'The cutter');
  assert.deepEqual(text.you.stats.map(([label]) => label), ['Guns', 'Shields', 'Engines', 'Reactor', 'Evasion']);
  const state = approachState(campaign, rules);
  const intent = enemyOrder(state, rules);
  const choices = choicesFor(state, intent, rules);
  const evade = choices.find((c) => c.order.kind === 'evade');
  assert.match(text.intent.text, new RegExp(`^The cutter fires at your engines: 2 guns, ${evade.was}% each \\(${evade.chance}% if you evade\\)\\.$`));
  assert.equal(text.orders.length, 7);
  for (const order of text.orders) {
    const choice = choices.find((c) => c.order.kind === order.order.kind && c.order.at === order.order.at);
    assert.equal(order.ok, choice.ok);
    if (order.order.kind === 'fire' && order.ok) {
      assert.equal(order.small, `${choice.chance}% × ${choice.guns}`);
      assert.match(order.text, new RegExp(`${choice.chance}% each to hit, ${rules.balance.gunDamage} damage a hit`));
    }
    if (order.order.kind === 'flee') assert.equal(order.small, `${choice.chance}%`);
  }
  const board = text.orders.find((order) => order.key === 'close');
  assert.deepEqual([board.ok, board.why], [false, 'Boarding a ship that can still fight comes with the boarding fights.']);
  assert.equal(text.orders.find((order) => order.key === 'fire-shields').why, 'They have no working shields.');
  assert.deepEqual(text.last, []);
  assert.equal(continueText(campaign, rules), 'Act 2 · Pirate cutter, round 1');
});

test('the last round, roll by roll, and the cutter closing', () => {
  const played = giveOrder(atCutter(), rules, { kind: 'fire', at: 'engines' }).campaign;
  const text = approachText(played, rules);
  const { events } = played.run.approach.last;
  assert.equal(text.last.length, events.length);
  const ours = events.find((e) => e.side === 'you');
  assert.ok(text.last[0].startsWith(`Your gun at their engines, ${ours.chance}%: ${ours.shots.map((s) => `${s.roll} ${s.hit ? 'hit' : 'miss'}`).join(', ')}.`), text.last[0]);
  assert.equal(text.round, `Round 2 of ${rules.balance.approachRounds}`);
  const state = approachState(played, rules);
  const closing = closeChance(sideStats(state.them, rules), sideStats(state.you, rules), rules);
  assert.ok(text.intent.text.startsWith(`The cutter closes to board: ${closing}% to grapple on, after the volleys.`), text.intent.text);
  assert.equal(giveOrder(played, rules, { kind: 'evade' }).campaign.run.approach.last.events.find((e) => e.kind === 'close').chance, closing, 'the chance it rolls at');
  assert.equal(text.hint.text, '', 'past the first round, the column says what happened instead');
});

test('their flight, and the blow-up a last reactor risks, show their odds before the roll', () => {
  const at = atCutter();
  const { approach } = at.run;
  const worn = Object.fromEntries(AIMS.flatMap((aim) => targetsOf(approach.them, aim, rules)).map((t) => [t.uid, t.hp - 1]));
  const running = { ...at, run: { ...at.run, approach: { ...approach, them: { ...approach.them, damage: worn } } } };
  const state = approachState(running, rules);
  const chance = fleeChance(sideStats(state.them, rules), sideStats(state.you, rules), rules);
  const text = approachText(running, rules);
  assert.equal(text.intent.text, `The cutter is running: ${chance}% to get away, before anyone fires.`);
  const flight = giveOrder(running, rules, { kind: 'evade' }).campaign.run.approach.last.events[0];
  assert.deepEqual([flight.kind, flight.side, flight.chance], ['flee', 'them', chance]);
  // The cutter has one reactor: wrecking it rolls blowChance.
  assert.equal(targetsOf(approach.them, 'reactor', rules).length, 1);
  const reactor = text.orders.find((order) => order.key === 'fire-reactor');
  assert.ok(reactor.text.includes(`If their last reactor is wrecked, the cutter blows apart ${rules.balance.blowChance}% of the time, leaving only scrap.`), reactor.text);
  assert.ok(!text.orders.find((order) => order.key === 'fire-engines').text.includes('blows apart'));
});

test('how it ended, and what it came to', () => {
  const boarded = approachText(endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' }), { credits: 50 }), rules);
  assert.equal(boarded.outcome.title, 'The cutter is dead in space: you board her.');
  assert.equal(boarded.outcome.board, 'them');
  assert.ok(boarded.outcome.lines.some((line) => line.startsWith('Stripped: ')));
  assert.ok(boarded.outcome.lines.some((line) => /^Scrap: \d+ credits\.$/.test(line)));
  assert.deepEqual([boarded.orders, boarded.intent, boarded.round], [[], null, 'Over']);
  const lost = approachText(endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: { armory: 1 } }), rules);
  assert.equal(lost.outcome.board, 'you');
  assert.ok(lost.outcome.lines.includes('They take the Armory you had on hand.'));
  const escaped = approachText(endingIn('escaped', () => ({ kind: 'flee' })), rules);
  assert.deepEqual([escaped.outcome.title, escaped.outcome.board], ['You got away.', null]);
  const parted = endingIn('parted', () => ({ kind: 'evade' }));
  assert.equal(approachText(parted, rules).outcome.title, 'The cutter breaks off, and the ships part.');
  assert.equal(continueText(parted, rules), 'Act 2 · Pirate cutter, over');
});

test('the map: a hostile ship until it is met, the parts wrecked aboard, and what a station repairs', () => {
  const node = { name: 'Mile Forty', type: 'hostile', hostile: { ship: 'cutter', seed: 1 } };
  assert.deepEqual(nodeText(node, rules), { name: 'Mile Forty', kind: 'Hostile ship: Pirate cutter', text: rules.nodeTypes.get('hostile').text });
  assert.equal(nodeText(node, rules, { done: true }).kind, 'Hostile ship, gone');
  const campaign = onRun({ credits: 500 });
  const engine = campaign.ship.modules.find((m) => m.type === 'engine').uid;
  const station = campaign.run.sector.nodes.find((n) => n.type === 'station').id;
  const wrecked = { ...campaign, wrecks: { [engine]: 'fire' }, run: { ...campaign.run, at: station, seen: [...campaign.run.seen, station] } };
  const text = sectorText(wrecked, rules);
  assert.deepEqual(text.hold.at(-1), ['Wrecked', 'Engine']);
  const price = repairPrice('engine', rules);
  assert.deepEqual(text.repair, { ok: true, label: `Repair · ${price}`, ask: `Repair for ${price}?`, text: `Repairs the engine for ${price} credits. Tap again to repair.`, why: null });
  assert.equal(text.hint.text, 'Supplies and repairs here. A part is wrecked aboard.');
  assert.equal(sectorText({ ...wrecked, credits: 0 }, rules).repair.ok, false);
  assert.equal(sectorText({ ...wrecked, wrecks: {} }, rules).repair, null);
  assert.equal(sectorText({ ...wrecked, run: campaign.run }, rules).repair, null, 'away from a station');
});
