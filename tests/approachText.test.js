// The approach screen's words (src/ui/campaign/approachText.js), the
// boarding fights' (boardingText.js), and the sector map's for hostile
// ships, repairs and patching up (sectorText.js): every odds the screen
// shows is the one the rules roll against.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { AIMS, choicesFor, closeChance, enemyOrder, fleeChance, sideStats, targetsOf } from '../src/sim/approach.js';
import { maxHp } from '../src/sim/campaign.js';
import { approachState, beginBoarding, giveOrder } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { repairPrice } from '../src/sim/repair.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { approachText, damageText } from '../src/ui/campaign/approachText.js';
import { boardingObjective, boardingOutcome } from '../src/ui/campaign/boardingText.js';
import { scrapLeft } from '../src/sim/strip.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { nodeText, sectorText } from '../src/ui/campaign/sectorText.js';
import { withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
function atCutter(extra = {}) {
  const fresh = onRun(extra);
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
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
  // The crew's edge shows as it counts (M32): the miner's marine aboard
  // makes the guns surer; the cutter's crew has none.
  assert.deepEqual(text.you.stats.map(([label]) => label), ['Guns', 'Shields', 'Engines', 'Reactor', 'Evasion', 'Crew']);
  assert.deepEqual(text.you.stats.at(-1), ['Crew', 'guns +10']);
  assert.ok(!text.them.stats.some(([label]) => label === 'Crew'));
  const state = approachState(campaign, rules);
  const intent = enemyOrder(state, rules);
  const choices = choicesFor(state, intent, rules);
  const evade = choices.find((c) => c.order.kind === 'evade');
  assert.match(text.intent.text, new RegExp(`^The cutter fires at your engines: 2 guns, ${evade.was}% each \\(${evade.chance}% if you evade\\), 15 damage a hit\\.$`));
  assert.equal(text.orders.length, 7);
  for (const order of text.orders) {
    const choice = choices.find((c) => c.order.kind === order.order.kind && c.order.at === order.order.at);
    assert.equal(order.ok, choice.ok);
    if (order.order.kind === 'fire' && order.ok) {
      assert.equal(order.small, `${choice.chance}% × ${choice.guns}`);
      assert.match(order.text, new RegExp(`${choice.chance}% each to hit, ${damageText(choice.damages)} damage a hit`));
    }
    if (order.order.kind === 'flee') assert.equal(order.small, `${choice.chance}%`);
  }
  const board = text.orders.find((order) => order.key === 'close');
  assert.deepEqual([board.ok, board.why], [true, null]);
  assert.match(board.text, /^Close to board the cutter: \d+% to grapple on, after the volleys, then a fight with her crew aboard her\./);
  assert.equal(text.orders.find((order) => order.key === 'fire-shields').why, 'They have no working shields.');
  assert.deepEqual(text.last, []);
  assert.equal(continueText(campaign, rules), 'Act 2 · Pirate cutter, round 1');
});

// M39: a ship with a torpedo bay and a grapple. The odds count the bays
// among the ship's numbers and give the grapple's pull; Board says what the
// grapple adds; and a torpedo that hits says it went through the shields.
test("a torpedo bay and a grapple in the approach's words (M39)", () => {
  const fresh = onRun();
  const ship = withPart(withPart(withPart(fresh.ship, rules, 'smallreactor'), rules, 'torpedobay'), rules, 'grapple');
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
  const campaign = jump({ ...fresh, ship, run: { ...fresh.run, sector: { ...sector, nodes } } }, rules, to).campaign;
  const text = approachText(campaign, rules);
  assert.deepEqual(text.you.stats.slice(0, 3), [['Guns', '2 of 2'], ['Torpedo bays', '1 of 1'], ['Grapple', `+${rules.modules.get('grapple').grapple}`]]);
  assert.ok(!text.them.stats.some(([label]) => label === 'Torpedo bays' || label === 'Grapple'), 'the cutter has neither');
  assert.match(text.orders.find((order) => order.key === 'close').text, new RegExp(`Your grapple adds ${rules.modules.get('grapple').grapple}\\.`));
  // A round fired at her engines in which the torpedo hits.
  for (let seed = 0; seed < 500; seed++) {
    const played = giveOrder({ ...campaign, rng: seedFrom(seed) }, rules, { kind: 'fire', at: 'engines' }).campaign;
    const torpedo = (played.run.approach.last?.events ?? []).some((e) => e.kind === 'volley' && e.side === 'you' && e.shots.some((shot) => shot.torpedo && shot.hit && shot.module));
    if (!torpedo) continue;
    assert.ok(approachText(played, rules).last.some((line) => line.includes('(a torpedo, through the shields)')), approachText(played, rules).last.join(' | '));
    return;
  }
  assert.fail('no seed puts a torpedo on her');
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
  assert.equal(text.hint.text, 'Next round: tap an order to see its odds.', 'past the first round, the column says what happened, and a short line what is next (M43)');
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

test('how it ended, and the boarding fight it ended in', () => {
  const ended = endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' }), { credits: 50 });
  const boarded = approachText(ended, rules);
  const cutter = rules.ships.get('cutter');
  // M46: the parts picked, her scrap as much as she has left working.
  const { them } = ended.run.approach;
  const [least, most] = cutter.scrap.map((credits) => scrapLeft(credits, them.ship, them.wrecked));
  assert.equal(boarded.outcome.title, 'The cutter is dead in space.');
  assert.equal(boarded.outcome.board, 'them');
  assert.ok(boarded.outcome.lines.includes('Her crew: Pirate ×2, Pirate gunner, Pirate brute.'), boarded.outcome.lines.join(' | '));
  assert.ok(most < cutter.scrap[1], 'the volleys broke some of her');
  assert.ok(boarded.outcome.lines.includes(`Win aboard her: strip 1 part you pick off her, and her scrap, ${least} to ${most} credits, what the volleys left of it.`), boarded.outcome.lines.join(' | '));
  assert.ok(boarded.outcome.lines.includes('Win: 30% to pick up one of their weapons.'), 'M37: what a win can leave');
  assert.ok(boarded.outcome.lines.includes('Lose: the crew is beaten back to your ship, hurt.'));
  assert.deepEqual([boarded.outcome.boarding.begin.label, boarded.outcome.boarding.leave.label, boarded.hint.text], ['Board her', 'Leave her', 'Board her, or leave her.']);
  assert.deepEqual([boarded.orders, boarded.intent, boarded.round], [[], null, 'Over']);
  const lost = approachText(endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: { armory: 1 } }), rules);
  assert.equal(lost.outcome.board, 'you');
  assert.ok(lost.outcome.lines.includes('Lose: they take the Armory you have on hand.'), lost.outcome.lines.join(' | '));
  assert.deepEqual([lost.outcome.boarding.begin.label, lost.outcome.boarding.leave, lost.hint.tone], ['Fight them off', null, 'bad']);
  const escaped = approachText(endingIn('escaped', () => ({ kind: 'flee' })), rules);
  assert.deepEqual([escaped.outcome.title, escaped.outcome.board, escaped.outcome.boarding, escaped.hint.text], ['You got away.', null, null, 'Carry on to the chart.']);
  const parted = endingIn('parted', () => ({ kind: 'evade' }));
  assert.equal(approachText(parted, rules).outcome.title, 'The cutter breaks off, and the ships part.');
  assert.equal(continueText(parted, rules), 'Act 2 · Pirate cutter, over');
});

test('a boarding fight: the line under the round, how it ended, and Continue', () => {
  const aboard = beginBoarding(endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' })), rules).campaign;
  const { battle, boarding } = aboard.fight;
  assert.deepEqual(boardingObjective(battle, aboard), { title: 'Aboard the cutter', progress: '4 of hers left', done: false, deadline: null });
  assert.equal(continueText(aboard, rules), `Act 2 · Aboard the Pirate cutter, round ${battle.round}`);
  const won = boardingOutcome({ ...battle, winner: 'crew' }, aboard, rules);
  assert.deepEqual([won.tone, won.title], ['good', 'The cutter is yours']);
  // M46: the parts to strip are picked on the end panel.
  assert.equal(won.text, `Strip a part off her: the dearest is picked, tap to pick others. Scrap: ${boarding.salvage.credits} credits.`);
  assert.deepEqual(boardingOutcome({ ...battle, winner: 'enemy' }, aboard, rules), { tone: 'bad', title: 'Beaten back', text: 'The crew falls back to your ship, hurt. Nothing taken.' });
  const home = beginBoarding(endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: { armory: 1 } }), rules).campaign;
  assert.deepEqual(boardingObjective(home.fight.battle, home), { title: 'Boarders', progress: '4 left', done: false, deadline: null });
  assert.equal(continueText(home, rules), `Act 2 · Boarders from the Pirate cutter, round ${home.fight.battle.round}`);
  assert.deepEqual(boardingOutcome({ ...home.fight.battle, winner: 'crew' }, home, rules), { tone: 'good', title: 'Boarders thrown off', text: `Their gear: ${home.fight.boarding.salvage.credits} credits of scrap.` });
  assert.deepEqual(boardingOutcome({ ...home.fight.battle, winner: 'enemy' }, home, rules), { tone: 'bad', title: 'Overrun', text: 'They took the Armory.' });
});

test('the map: a hostile ship until it is met, the parts wrecked aboard, and what a station repairs', () => {
  const node = { name: 'Mile Forty', type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } };
  assert.deepEqual(nodeText(node, rules), { name: 'Mile Forty', kind: 'Hostile ship: Pirate cutter', text: rules.nodeTypes.get('hostile').text });
  assert.equal(nodeText(node, rules, { done: true }).kind, 'Hostile ship, gone');
  const campaign = onRun({ credits: 500 });
  const engine = campaign.ship.modules.find((m) => m.type === 'engine').uid;
  const station = campaign.run.sector.nodes.find((n) => n.type === 'station').id;
  const wrecked = { ...campaign, wrecks: { [engine]: 'fire' }, run: { ...campaign.run, at: station, seen: [...campaign.run.seen, station] } };
  const text = sectorText(wrecked, rules);
  assert.deepEqual(text.hold.find(([label]) => label === 'Wrecked'), ['Wrecked', 'Engine']);
  const price = repairPrice('engine', rules);
  assert.deepEqual(text.repair, { ok: true, label: `Repair · ${price}`, ask: `Repair for ${price}?`, text: `Repairs the engine for ${price} credits. Tap again to repair.`, why: null });
  assert.equal(text.hint.text, 'Supplies and repairs here. A part is wrecked aboard.');
  assert.equal(sectorText({ ...wrecked, credits: 0 }, rules).repair.ok, false);
  assert.equal(sectorText({ ...wrecked, wrecks: {} }, rules).repair, null);
  assert.equal(sectorText({ ...wrecked, run: campaign.run }, rules).repair, null, 'away from a station');
});

test("the station's medic: Patch up with its price, two taps, and the hint", () => {
  const campaign = onRun({ credits: 500 });
  const station = campaign.run.sector.nodes.find((n) => n.type === 'station').id;
  const crew = campaign.crew.map((m, i) => ({ ...m, hp: i === 0 ? 1 : m.hp }));
  const hurt = { ...campaign, crew, run: { ...campaign.run, at: station, seen: [...campaign.run.seen, station] } };
  const missing = maxHp(crew[0], rules) - 1;
  const cost = missing * rules.balance.patchPrice;
  const text = sectorText(hurt, rules);
  assert.deepEqual([text.patch.ok, text.patch.label, text.patch.ask], [true, `Patch up · ${cost}`, `Patch for ${cost}?`]);
  assert.equal(text.patch.text, `Patches up ${crew[0].name} 1 to ${maxHp(crew[0], rules)} for ${cost} credits. Tap again to patch up.`);
  assert.equal(text.hint.text, 'Supplies and a medic here. The crew is hurt.');
  const short = sectorText({ ...hurt, credits: 3 * rules.balance.patchPrice }, rules).patch;
  assert.equal(short.text, `Your credits cover ${crew[0].name} 1 to 4 for ${3 * rules.balance.patchPrice} credits, of ${cost} to heal everyone. Tap again to patch up.`);
  assert.equal(sectorText({ ...hurt, crew: campaign.crew }, rules).patch, null, 'no one hurt');
  const broke = sectorText({ ...hurt, credits: 0 }, rules).patch;
  assert.deepEqual([broke.ok, broke.label], [false, 'Patch up']);
  const engine = campaign.ship.modules.find((m) => m.type === 'engine').uid;
  assert.equal(sectorText({ ...hurt, wrecks: { [engine]: 'fire' } }, rules).hint.text, 'Supplies, repairs and a medic here. A part is wrecked aboard, and the crew is hurt.');
});
