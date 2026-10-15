// Hostile ships on the run (src/sim/encounter.js), repairs (repair.js) and
// saves v12 and v13: the approach opens where the ship meets one and holds
// the run until it is over; each order plays a round, saved; a boarding,
// either way, is a fight on the boarded ship's map (M22), and what it comes
// to; the player's wrecks stay until a station repairs them, except the
// reactor and engine the crew gets going.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { choicesFor } from '../src/sim/approach.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { approachIntent, approachState, beginBoarding, boardingDue, closeApproach, endBoarding, giveOrder, juryRig, openApproach } from '../src/sim/encounter.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launch } from '../src/sim/launch.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { hasTag } from '../src/sim/modules.js';
import { stepsFrom } from '../src/sim/moves.js';
import { raidLoss } from '../src/sim/raid.js';
import { repairPlan, repairPrice, repairShip } from '../src/sim/repair.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, jump, jumpPlan, leavePlan, linked, scanPlan } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// A run whose first node on holds a pirate cutter (preset seed `seed`), and
// no other node holds anything: { campaign, to }.
function hostileAhead(extra = {}, seed = CUTTER_SEED) {
  const fresh = onRun(extra);
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed } } : node));
  return { campaign: { ...fresh, run: { ...fresh.run, sector: { ...sector, nodes } } }, to };
}
// The campaign at the cutter, its approach open.
const atCutter = (extra = {}, seed = CUTTER_SEED) => {
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
  const made = generateShip(rules, 'cutter', CUTTER_SEED);
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
  assert.deepEqual(giveOrder(there, rules, { kind: 'fire', at: 'shields' }), { ok: false, error: 'They have no working shields.' });
  assert.deepEqual(giveOrder(onRun(), rules, { kind: 'evade' }), { ok: false, error: 'There is no ship to face.' });
});

// A boarding's fight, finished: won by the crew, or lost with the whole
// crew down. endFight reads only the winner and the crew's units.
function finished(campaign, winner) {
  const { battle } = campaign.fight;
  const units = winner === 'crew' ? battle.units : battle.units.map((unit) => (unit.side === 'crew' ? { ...unit, hp: 0, status: 'down', bleed: 2 } : unit));
  return { ...campaign, fight: { ...campaign.fight, battle: { ...battle, units, winner } } };
}

test('the end: a boarding either way leaves its fight due; a wreck leaves scrap; heat if anyone fired', () => {
  const fire = (at) => () => ({ kind: 'fire', at });
  const { start, ended } = endingIn('boarded', fire('reactor'), { credits: 50 });
  const { outcome } = ended.run.approach;
  assert.deepEqual([outcome.boarding, outcome.changes.credits, outcome.changes.parts, outcome.changes.lost], ['due', 0, [], null]);
  assert.deepEqual([ended.credits, ended.parts], [start.credits, start.parts], 'nothing is taken before the fight');
  assert.equal(ended.flags.approachesWon, 1);
  const lost = endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: { corridor: 2, armory: 1 } });
  assert.deepEqual([lost.ended.run.approach.outcome.boarding, lost.ended.parts], ['due', { corridor: 2, armory: 1 }]);
  assert.equal(lost.ended.flags.approachesLost, 1);
  // A ship blown apart leaves only the preset's scrap, and no fight.
  const blown = endingIn('destroyed', fire('reactor'));
  const [min, max] = rules.ships.get('cutter').scrap;
  const scrap = blown.ended.run.approach.outcome.changes.credits;
  assert.ok(scrap >= min && scrap <= max);
  assert.deepEqual([blown.ended.credits, blown.ended.run.approach.outcome.boarding], [blown.start.credits + scrap, null]);
  // Heat, if anyone fired; the node settled; still saved.
  for (const [begin, end] of [[start, ended], [lost.start, lost.ended], [blown.start, blown.ended]]) {
    const { approach } = end.run;
    assert.equal(end.heat - begin.heat, approach.fired ? balance.approachHeat : 0);
    assert.equal(approach.outcome.changes.heat, end.heat - begin.heat);
    assert.ok(end.run.done.includes(approach.node));
    assert.deepEqual(campaignProblems(end), []);
  }
});

test("a boarding is fought on the boarded ship's map, wrecks and all: her crew on her bridge, or at the player's hatches", () => {
  const preset = rules.ships.get('cutter');
  const party = rules.encounters.get(preset.party).enemies;
  // Aboard her: her map with her wrecks, her party on her bridge, the crew at her hatches.
  const { ended } = endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' }));
  const { them } = ended.run.approach;
  assert.ok(Object.keys(them.wrecked).length > 0, 'she is wrecked');
  const aboard = beginBoarding(ended, rules);
  assert.ok(aboard.ok, aboard.error);
  const { fight } = aboard.campaign;
  assert.deepEqual(fight.battle.map, mapFromShip(them.ship, rules, { wrecked: them.wrecked }));
  assert.deepEqual(fight.battle.units.filter((u) => u.side === 'enemy').map((u) => u.kind), party);
  assert.deepEqual(fight.battle.units.filter((u) => u.side === 'crew').map((u) => u.kind), ended.crew.map((m) => m.job));
  // Each with the hit points they have, less what a burning room takes as the first turn starts.
  const burnt = (u) => (fight.battle.map.hazards.cells[u.y * fight.battle.map.width + u.x] === 'fire' ? balance.fireDamage : 0);
  assert.deepEqual(fight.battle.units.filter((u) => u.side === 'crew').map((u) => u.hp + burnt(u)), ended.crew.map((m) => m.hp));
  const field = { map: fight.battle.map, doors: [], units: [] };
  const fromHatch = stepsFrom(field, fight.battle.map.hatches.map(({ x, y }) => [x, y]), rules);
  const furthest = (side) => Math.max(...fight.battle.units.filter((u) => u.side === side).map((u) => fromHatch.get(`${u.x},${u.y}`)));
  assert.ok(furthest('crew') < furthest('enemy'), 'the crew comes in at her hatches; hers hold further in');
  const bridge = fight.battle.map.rooms.find((room) => hasTag(rules.modules.get(room.type), 'bridge'));
  const onBridge = (u) => u.x >= bridge.x && u.x < bridge.x + bridge.w && u.y >= bridge.y && u.y < bridge.y + bridge.h;
  assert.ok(fight.battle.units.some((u) => u.side === 'enemy' && onBridge(u)), 'hers start on her bridge');
  assert.deepEqual([fight.boarding.dir, fight.battle.options.press ?? false, fight.encounter, aboard.campaign.place], ['them', false, preset.party, 'fight']);
  // What a win pays, rolled as it begins: her salvage, never a corridor or a wreck, and her scrap.
  const { salvage } = fight.boarding;
  assert.equal(salvage.parts.length, preset.salvage);
  const working = them.ship.modules.filter((m) => !(m.uid in them.wrecked) && !hasTag(rules.modules.get(m.type), 'corridor')).map((m) => m.type);
  assert.ok(salvage.parts.every((type) => working.includes(type)), `${salvage.parts}`);
  assert.ok(salvage.credits >= preset.scrap[0] && salvage.credits <= preset.scrap[1]);
  assert.deepEqual(campaignProblems(aboard.campaign), []);
  assert.deepEqual(beginBoarding(aboard.campaign, rules), { ok: false, error: 'A fight is on already.' });
  // At home: the player's map with the wrecks the approach left, the crew on the bridge, hers at the hatches, pressing on.
  const home = endingIn('boardedBy', () => ({ kind: 'evade' }));
  const { you } = home.ended.run.approach;
  const defend = beginBoarding(home.ended, rules);
  assert.ok(defend.ok, defend.error);
  assert.deepEqual(defend.campaign.fight.battle.map, mapFromShip(home.ended.ship, rules, { wrecked: you.wrecked }));
  assert.ok(Object.keys(you.wrecked).length > 0, 'the approach wrecked something aboard');
  assert.deepEqual([defend.campaign.fight.boarding.dir, defend.campaign.fight.battle.options.press, defend.campaign.fight.boarding.salvage.parts], ['you', true, []]);
  assert.equal(defend.campaign.fight.battle.side, 'crew', 'the crew moves first');
  // Nothing due, nothing to begin.
  assert.deepEqual(beginBoarding(atCutter(), rules), { ok: false, error: 'No one is boarding.' });
  assert.equal(boardingDue(onRun(), rules), null);
});


test("a boarding strips her makers' parts as they are: a pirate cutter's, Kestrel's among them (M31)", () => {
  const stripped = [];
  for (let cutter = 1; cutter <= 6; cutter++) {
    const start = atCutter({}, cutter);
    for (let seed = 0; seed < 200; seed++) {
      const ended = playOut({ ...start, rng: seedFrom(seed) }, () => ({ kind: 'fire', at: 'reactor' }));
      if (ended.run.approach.outcome.kind !== 'boarded') continue;
      const aboard = beginBoarding(ended, rules);
      assert.ok(aboard.ok, aboard.error);
      const ship = ended.run.approach.them.ship.modules.map((m) => m.type);
      assert.ok(aboard.campaign.fight.boarding.salvage.parts.every((type) => ship.includes(type)));
      stripped.push(...aboard.campaign.fight.boarding.salvage.parts);
      break;
    }
  }
  assert.equal(stripped.length, 6 * rules.ships.get('cutter').salvage);
  assert.ok(stripped.some((type) => rules.modules.get(type).manufacturer === 'kestrel'), `${stripped}`);
});
test("what a boarding comes to: her salvage and scrap, her boarders' gear, what a raid takes, or wounds alone", () => {
  const parts = { corridor: 2, armory: 1 };
  // Won aboard her: her salvage and scrap; the crew keeps its wounds.
  const aboard = beginBoarding(endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' }), { parts }).ended, rules).campaign;
  const { salvage } = aboard.fight.boarding;
  const won = endBoarding(finished(aboard, 'crew'), rules);
  assert.equal(won.credits, aboard.credits + salvage.credits);
  for (const type of salvage.parts) assert.equal(won.parts[type], (aboard.parts[type] ?? 0) + salvage.parts.filter((p) => p === type).length);
  assert.deepEqual([won.place, won.fight, won.run.approach, won.flags.boardingsWon, won.flags.fightsWon], ['hub', null, null, 1, 1]);
  assert.deepEqual(campaignProblems(won), []);
  // Lost aboard her: beaten back, wounded, nothing taken.
  const beaten = endBoarding(finished(aboard, 'enemy'), rules);
  assert.deepEqual([beaten.credits, beaten.parts, beaten.flags.boardingsLost], [aboard.credits, aboard.parts, 1]);
  assert.ok(beaten.crew.every((m) => m.hp === 1), 'everyone down comes back with 1');
  // At home: won, her boarders' gear; lost, what a lost raid takes.
  const home = beginBoarding(endingIn('boardedBy', () => ({ kind: 'evade' }), { parts }).ended, rules).campaign;
  const repelled = endBoarding(finished(home, 'crew'), rules);
  assert.deepEqual([repelled.credits, repelled.parts], [home.credits + home.fight.boarding.salvage.credits, parts]);
  const overrun = endBoarding(finished(home, 'enemy'), rules);
  assert.deepEqual(raidLoss(home, rules), { part: 'armory' });
  assert.deepEqual([overrun.parts, overrun.credits, overrun.run.approach], [{ corridor: 2 }, home.credits, null]);
  const broke = beginBoarding(endingIn('boardedBy', () => ({ kind: 'evade' }), { parts: {}, credits: 80 }).ended, rules).campaign;
  assert.equal(endBoarding(finished(broke, 'enemy'), rules).credits, 40);
  // Law 3: every one of them changed the ship or the run.
  for (const [before, after] of [[aboard, won], [aboard, beaten], [home, repelled], [home, overrun]]) {
    const hurt = after.crew.some((m, i) => m.hp < before.crew[i].hp);
    assert.ok(after.credits !== before.credits || JSON.stringify(after.parts) !== JSON.stringify(before.parts) || hurt, 'something changed');
  }
  // A fight still going is left as it is.
  assert.equal(endBoarding(aboard, rules), aboard);
});

test("a ship the player disabled can be left; one boarding the player's has to be fought off", () => {
  const { ended } = endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' }));
  const left = closeApproach(ended);
  assert.ok(left.ok);
  assert.deepEqual([left.campaign.run.approach, left.campaign.credits, left.campaign.parts], [null, ended.credits, ended.parts]);
  const { ended: boarding } = endingIn('boardedBy', () => ({ kind: 'evade' }));
  assert.deepEqual(closeApproach(boarding), { ok: false, error: 'They are boarding: fight them off.' });
  assert.deepEqual(closeApproach(beginBoarding(boarding, rules).campaign), { ok: false, error: 'Finish the fight first.' });
});

test("the player's Board order closes on a ship that can still fight, at the odds shown, and her fight is due", () => {
  const there = atCutter();
  const state = approachState(there, rules);
  const shown = choicesFor(state, approachIntent(there, rules), rules).find((c) => c.order.kind === 'close');
  assert.equal(shown.ok, true);
  for (let seed = 0; seed < 200; seed++) {
    const played = giveOrder({ ...there, rng: seedFrom(seed) }, rules, { kind: 'close' });
    assert.ok(played.ok, played.error);
    const close = played.campaign.run.approach.last.events.find((e) => e.kind === 'close' && e.side === 'you');
    if (!close) continue; // stopped by a volley first
    assert.equal(close.chance, shown.chance);
    if (!close.ok) continue;
    const { outcome } = played.campaign.run.approach;
    assert.deepEqual([outcome.kind, outcome.how, outcome.boarding], ['boarded', 'closed', 'due']);
    const aboard = beginBoarding(played.campaign, rules).campaign;
    assert.equal(aboard.fight.battle.units.filter((u) => u.side === 'enemy').length, rules.encounters.get('boarders').enemies.length, 'her whole party, though she can still fight');
    return;
  }
  assert.fail('no seed grappled on');
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
  // The fight over, the approach is put away; the next one starts with the wrecks.
  const after = endBoarding(finished(beginBoarding(ended, rules).campaign, 'crew'), rules);
  assert.equal(after.run.approach, null);
  assert.deepEqual(after.wrecks, ended.wrecks);
  assert.deepEqual(closeApproach(after).ok, false);
  assert.deepEqual(closeApproach(atCutter()), { ok: false, error: 'The approach is still on.' });
  const parted = endingIn('parted', () => ({ kind: 'evade' })).ended;
  assert.equal(closeApproach(parted).campaign.run.approach, null);
  assert.deepEqual(campaignProblems(after), []);
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

test('saves v12 and v13: no wrecks or approach before v12; no boarding due or fought before v13; a broken one is caught', () => {
  const step = MIGRATIONS.find((m) => m.from === 11);
  const campaign = onRun();
  const { wrecks, ...v11campaign } = campaign;
  const { approach, ...v11run } = campaign.run;
  const old = { campaign: { ...v11campaign, run: v11run } };
  assert.deepEqual(step.up(old).campaign, campaign);
  assert.deepEqual(step.up({ campaign: { ...v11campaign, run: null } }).campaign, { ...campaign, run: null });
  // v12 to v13: a fight under way is no boarding; an approach that ended was settled by its stand-in.
  const v13 = MIGRATIONS.find((m) => m.from === 12);
  const parted = endingIn('parted', () => ({ kind: 'evade' })).ended;
  const { boarding, ...v12outcome } = parted.run.approach.outcome;
  const v12 = { ...parted, run: { ...parted.run, approach: { ...parted.run.approach, outcome: v12outcome } } };
  assert.deepEqual(v13.up({ campaign: v12 }).campaign, parted);
  assert.deepEqual(v13.up({ campaign: onRun() }).campaign, onRun(), 'nothing to change');
  const fighting = { ...onRun(), place: 'fight', fight: { encounter: 'boarders', seed: 1, crew: [], battle: null, log: [], job: null, raid: false } };
  assert.deepEqual(v13.up({ campaign: fighting }).campaign.fight.boarding, null);
  // A round, and a boarding fight, read back from a save.
  const there = atCutter();
  const round = giveOrder(there, rules, { kind: 'fire', at: 'engines' }).campaign;
  const aboard = beginBoarding(endingIn('boarded', () => ({ kind: 'fire', at: 'reactor' })).ended, rules).campaign;
  for (const saved of [round, aboard]) {
    const restored = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(1), campaign: saved }))));
    assert.ok(restored.ok, restored.error);
    assert.deepEqual(restored.save.data.campaign, saved);
  }
  const broken = (change, from = round) => campaignProblems(change(from));
  assert.deepEqual(broken((c) => ({ ...c, wrecks: { 999: 'fire' } })), ["The campaign's wrecks are unreadable."]);
  assert.deepEqual(broken((c) => ({ ...c, wrecks: { [c.ship.modules[0].uid]: 'flood' } })), ["The campaign's wrecks are unreadable."]);
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, round: 0 } } })), ["The campaign's run has an unreadable approach."]);
  const escaped = { kind: 'escaped', changes: { credits: 0, heat: 0, parts: [], lost: null, patched: [] }, boarding: null };
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, outcome: escaped } } })), ["The campaign's run has an unreadable approach."], 'an outcome on a node not settled');
  assert.deepEqual(broken((c) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, node: 0 } } })), ["The campaign's run has an unreadable approach."]);
  const due = (c, boarding) => ({ ...c, run: { ...c.run, approach: { ...c.run.approach, outcome: { ...c.run.approach.outcome, boarding } } } });
  assert.deepEqual(broken((c) => due(c, 'soon'), aboard), ["The campaign's run has an unreadable approach."]);
  assert.deepEqual(broken((c) => due(c, null), aboard), ["The campaign's boarding fight has no approach that ended in it."]);
  assert.deepEqual(broken((c) => ({ ...c, fight: { ...c.fight, boarding: { ...c.fight.boarding, dir: 'up' } } }), aboard), ["The campaign's fight has an unreadable boarding."]);
  assert.deepEqual(broken((c) => ({ ...c, fight: { ...c.fight, raid: true } }), aboard), ["The campaign's fight has an unreadable boarding."]);
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

test('through the game: a boarding fight begins from the approach, is saved as it goes, and ends back on the map', () => {
  let state = { ...initialState(1), campaign: endingIn('boardedBy', () => ({ kind: 'evade' })).ended, screen: 'approach' };
  assert.equal(reduce(state, { type: 'campaign/approach/close' }), state, "they can't be left");
  state = reduce(state, { type: 'campaign/boarding/begin', rules });
  assert.deepEqual([state.screen, state.campaign.place, state.campaign.fight.boarding.dir], ['campaign-fight', 'fight', 'you']);
  assert.equal(reduce(state, { type: 'campaign/continue' }).screen, 'campaign-fight', 'Continue goes back to the fight');
  const won = finished(state.campaign, 'crew').fight;
  state = reduce(state, { type: 'campaign/fight/save', battle: won.battle, log: won.log });
  state = reduce(state, { type: 'campaign/fight/end', rules });
  assert.deepEqual([state.screen, state.campaign.place, state.campaign.fight, state.campaign.run.approach], ['sector', 'hub', null, null]);
  assert.equal(state.campaign.flags.boardingsWon, 1);
});
