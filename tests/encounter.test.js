// Hostile ships on the run (src/sim/encounter.js), repairs (repair.js) and
// save v12: the approach opens where the ship meets one and holds the run
// until it is over; each order plays a round, saved; the end is settled by
// the stand-ins until M22's boarding fights; the player's wrecks stay until a
// station repairs them, except the reactor and engine the crew gets going.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { approachIntent, approachState, closeApproach, giveOrder, juryRig, openApproach } from '../src/sim/encounter.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launch } from '../src/sim/launch.js';
import { raidLoss } from '../src/sim/raid.js';
import { repairPlan, repairPrice, repairShip } from '../src/sim/repair.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, jump, jumpPlan, leavePlan, linked, scanPlan } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// A run whose first node on holds a pirate cutter (preset seed `seed`), and
// no other node holds anything: { campaign, to }.
function hostileAhead(extra = {}, seed = 1) {
  const fresh = onRun(extra);
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed } } : node));
  return { campaign: { ...fresh, run: { ...fresh.run, sector: { ...sector, nodes } } }, to };
}
// The campaign at the cutter, its approach open.
const atCutter = (extra = {}, seed = 1) => {
  const { campaign, to } = hostileAhead(extra, seed);
  return jump(campaign, rules, to).campaign;
};
// Plays orders until the approach ends: the first order that `pick` gives
// for each round (default: evade).
function playOut(campaign, pick = () => ({ kind: 'evade' })) {
  let at = campaign;
  while (!at.run.approach.outcome) {
    const given = giveOrder(at, rules, pick(at));
    assert.ok(given.ok, given.error);
    at = given.campaign;
  }
  return at;
}
// A campaign at the cutter with its RNG set so that playing `pick` ends in
// an outcome `kind`.
function endingIn(kind, pick, extra = {}) {
  const start = atCutter(extra);
  for (let seed = 0; seed < 3000; seed++) {
    const ended = playOut({ ...start, rng: seedFrom(seed) }, pick);
    if (ended.run.approach.outcome.kind === kind) return { start: { ...start, rng: seedFrom(seed) }, ended };
  }
  throw new Error(`No seed ends in ${kind}`);
}

test('arriving where a hostile ship is opens the approach, which holds jumps, scans and leaving', () => {
  const { campaign, to } = hostileAhead();
  assert.equal(campaign.run.approach, null);
  const there = jump(campaign, rules, to).campaign;
  const { approach } = there.run;
  const made = generateShip(rules, 'cutter', 1);
  assert.deepEqual(approach.enemy, { ship: 'cutter', name: 'Pirate cutter', crew: made.crew });
  assert.deepEqual(approach.them, { ship: made.ship, damage: {}, wrecked: made.wrecked });
  assert.deepEqual([approach.node, approach.round, approach.fired, approach.last, approach.outcome], [to, 1, false, null, null]);
  assert.deepEqual(approach.you, { damage: {}, wrecked: {} });
  const held = { ok: false, error: 'Deal with the Pirate cutter first.' };
  assert.deepEqual(jumpPlan(there, rules, linked(there.run.sector, to).find((id) => id !== 0)), held);
  assert.deepEqual(scanPlan(there, rules), held);
  assert.deepEqual(leavePlan({ ...there, run: { ...there.run, at: there.run.sector.exit } }, rules).ok, false);
  assert.deepEqual(campaignProblems(there), [], 'it saves');
  // The intent shown is the order the cutter gives.
  assert.deepEqual(approachIntent(there, rules), { kind: 'fire', at: rules.ships.get('cutter').tactics.aim[0] });
  // The ship's wrecks from before come into it.
  const engine = there.ship.modules.find((m) => m.type === 'engine').uid;
  assert.deepEqual(openApproach({ ...campaign, wrecks: { [engine]: 'fire' }, run: { ...campaign.run, at: to } }, rules).run.approach.you.wrecked, { [engine]: 'fire' });
});

test('each order plays a round with the campaign\'s RNG, saved; an order that can\'t be given changes nothing', () => {
  const there = atCutter();
  const played = giveOrder(there, rules, { kind: 'fire', at: 'engines' });
  assert.ok(played.ok);
  const { approach } = played.campaign.run;
  assert.notEqual(played.campaign.rng, there.rng);
  assert.equal(approach.round, 2);
  assert.deepEqual(approach.last.order, { kind: 'fire', at: 'engines' });
  assert.deepEqual(approach.last.intent, approachIntent(there, rules));
  assert.ok(approach.last.events.some((e) => e.kind === 'volley'));
  assert.equal(approach.fired, true);
  assert.deepEqual(campaignProblems(played.campaign), []);
  // The same campaign and order always play the same round.
  assert.deepEqual(giveOrder(there, rules, { kind: 'fire', at: 'engines' }), played);
  assert.deepEqual(giveOrder(there, rules, { kind: 'close' }).ok, false);
  assert.deepEqual(giveOrder(there, rules, { kind: 'fire', at: 'shields' }), { ok: false, error: 'They have no working shields.' });
  assert.deepEqual(giveOrder(onRun(), rules, { kind: 'evade' }), { ok: false, error: 'There is no ship to face.' });
});

test('the end, settled by the stand-ins: their part and scrap; scrap alone from a wreck; what a lost raid takes', () => {
  const fire = (at) => () => ({ kind: 'fire', at });
  // Boarded, disabled: one of their working parts, and the preset's scrap.
  const { start, ended } = endingIn('boarded', fire('reactor'), { credits: 50 });
  const { changes } = ended.run.approach.outcome;
  const [min, max] = rules.ships.get('cutter').scrap;
  assert.ok(changes.credits >= min && changes.credits <= max);
  assert.equal(ended.credits, start.credits + changes.credits);
  assert.equal(changes.parts.length, 1);
  assert.equal(ended.parts[changes.parts[0]], (start.parts[changes.parts[0]] ?? 0) + 1);
  assert.equal(ended.flags.approachesWon, 1);
  // Boarded by them: the dearest part on hand, or half the credits.
  const lost = endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: { corridor: 2, armory: 1 } });
  assert.deepEqual(lost.ended.run.approach.outcome.changes.lost, raidLoss(lost.start, rules));
  assert.deepEqual(lost.ended.parts, { corridor: 2 });
  const broke = endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: {}, credits: 80 });
  assert.deepEqual(broke.ended.run.approach.outcome.changes.lost, { credits: 40 });
  assert.equal(broke.ended.credits, 40);
  assert.equal(broke.ended.flags.approachesLost, 1);
  // Heat, if anyone fired; the node settled; still saved.
  for (const [begin, end] of [[start, ended], [lost.start, lost.ended]]) {
    const { approach } = end.run;
    assert.equal(end.heat - begin.heat, approach.fired ? balance.approachHeat : 0);
    assert.equal(approach.outcome.changes.heat, end.heat - begin.heat);
    assert.ok(end.run.done.includes(approach.node));
    assert.deepEqual(campaignProblems(end), []);
  }
});

test("the player's wrecks stay after an approach, but the crew gets a reactor and an engine going", () => {
  const { ended } = endingIn('boardedBy', () => ({ kind: 'fire', at: 'weapons' }));
  const { you, outcome } = ended.run.approach;
  const kept = juryRig(ended.ship, you.wrecked, rules);
  assert.deepEqual(ended.wrecks, kept.wrecked);
  assert.deepEqual(outcome.changes.patched, kept.patched);
  const tagged = (tag) => ended.ship.modules.filter((m) => rules.modules.get(m.type).tags.includes(tag)).map((m) => m.uid);
  for (const tag of ['reactor', 'engine']) assert.ok(tagged(tag).some((uid) => !(uid in ended.wrecks)), `a ${tag} works`);
  // Every engine wrecked: the first is got going, the rest wait.
  const engines = tagged('engine');
  const all = Object.fromEntries(engines.map((uid) => [uid, 'fire']));
  const rigged = juryRig(ended.ship, all, rules);
  assert.deepEqual(rigged.patched, [engines[0]]);
  assert.deepEqual(Object.keys(rigged.wrecked).map(Number), engines.slice(1));
  // Carry on: the approach is put away; the next one starts with the wrecks.
  const closed = closeApproach(ended);
  assert.equal(closed.campaign.run.approach, null);
  assert.deepEqual(closeApproach(closed.campaign).ok, false);
  assert.deepEqual(closeApproach(atCutter()), { ok: false, error: 'The approach is still on.' });
  assert.deepEqual(campaignProblems(closed.campaign), []);
});

test('a station repairs what the credits cover, the cheapest first, at repairPercent of the part\'s cost', () => {
  const ship = onRun().ship;
  const uid = (type) => ship.modules.find((m) => m.type === type).uid;
  const wrecks = { [uid('engine')]: 'fire', [uid('weapon')]: 'vacuum' };
  assert.equal(repairPrice('engine', rules), 5 * Math.round((rules.modules.get('engine').cost * balance.repairPercent) / 100 / 5));
  const atStation = (credits) => {
    const campaign = onRun({ credits });
    const station = campaign.run.sector.nodes.find((node) => node.type === 'station').id;
    return { ...campaign, wrecks, run: { ...campaign.run, at: station, seen: [...campaign.run.seen, station] } };
  };
  assert.deepEqual(repairPlan({ ...onRun(), wrecks }, rules), { ok: false, error: 'Repairs are made at stations.' });
  assert.deepEqual(repairPlan(atStation(500), rules).ok && repairPlan({ ...atStation(500), wrecks: {} }, rules), { ok: false, error: 'Nothing on the ship is wrecked.' });
  const rich = repairShip(atStation(500), rules);
  const total = repairPrice('engine', rules) + repairPrice('weapon', rules);
  assert.deepEqual([rich.campaign.wrecks, rich.campaign.credits, rich.campaign.flags.repairs], [{}, 500 - total, 2]);
  const cheap = Math.min(repairPrice('engine', rules), repairPrice('weapon', rules));
  const poor = repairShip(atStation(cheap), rules);
  assert.equal(Object.keys(poor.campaign.wrecks).length, 1);
  assert.equal(poor.campaign.credits, 0);
  assert.deepEqual(repairShip(atStation(cheap - 1), rules), { ok: false, error: `A repair costs ${cheap} credits.`, wrecks: repairPlan(atStation(cheap - 1), rules).wrecks, total });
});

test('save v12: a v11 campaign gets no wrecks and no approach; a broken approach or wreck is caught', () => {
  const step = MIGRATIONS.find((m) => m.from === 11);
  const campaign = onRun();
  const { wrecks, ...v11campaign } = campaign;
  const { approach, ...v11run } = campaign.run;
  const old = { campaign: { ...v11campaign, run: v11run } };
  assert.deepEqual(step.up(old).campaign, campaign);
  assert.deepEqual(step.up({ campaign: { ...v11campaign, run: null } }).campaign, { ...campaign, run: null });
  const there = atCutter();
  const round = giveOrder(there, rules, { kind: 'fire', at: 'engines' }).campaign;
  const restored = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(1), campaign: round }))));
  assert.ok(restored.ok, restored.error);
  assert.deepEqual(restored.save.data.campaign, round);
  const broken = (change) => campaignProblems(change(round));
  assert.deepEqual(broken((c) => ({ ...c, wrecks: { 999: 'fire' } })), ["The campaign's wrecks are unreadable."]);
  assert.deepEqual(broken((c) => ({ ...c, wrecks: { [c.ship.modules[0].uid]: 'flood' } })), ["The campaign's wrecks are unreadable."]);
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, round: 0 } } })), ["The campaign's run has an unreadable approach."]);
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, outcome: { kind: 'escaped', changes: { credits: 0, heat: 0, parts: [], lost: null, patched: [] } } } } })), ["The campaign's run has an unreadable approach."], 'an outcome on a node not settled');
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, node: 0 } } })), ["The campaign's run has an unreadable approach."]);
});

test('through the game: a jump to a hostile ship opens its screen, orders play it, and Carry on goes back to the map', () => {
  const { campaign, to } = hostileAhead();
  let state = { ...initialState(1), campaign, screen: 'sector' };
  state = reduce(state, { type: 'campaign/jump', to, rules });
  assert.equal(state.screen, 'approach');
  assert.ok(state.campaign.run.approach);
  state = reduce(state, { type: 'campaign/approach/order', order: { kind: 'fire', at: 'engines' }, rules });
  assert.equal(state.campaign.run.approach.round, 2);
  while (!state.campaign.run.approach.outcome) state = reduce(state, { type: 'campaign/approach/order', order: { kind: 'evade' }, rules });
  assert.equal(state.screen, 'approach');
  const back = reduce(state, { type: 'campaign/approach/close' });
  assert.deepEqual([back.screen, back.campaign.run.approach], ['sector', null]);
  assert.equal(reduce(back, { type: 'campaign/continue' }).screen, 'sector');
  assert.equal(reduce(state, { type: 'campaign/continue' }).screen, 'approach', 'Continue goes back to an approach going on');
  assert.equal(approachState(back.campaign, rules), null);
});
