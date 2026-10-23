// M46: refits on the move. Between jumps (rearrange.js) the ship's parts
// move and turn, but none comes off or goes on; a move that leaves the joins
// failing holds the ship until it's fixed, anywhere on the run; and in a
// refit at a station a wrecked part is scrapped for a spare in its place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, removeModule } from '../src/sim/builder.js';
import { campaignProblems, refitShip, stockOf, wreckedUids } from '../src/sim/campaign.js';
import { layoutLine } from '../src/sim/constraints.js';
import { launch } from '../src/sim/launch.js';
import { canRearrange, rearrangeShip } from '../src/sim/rearrange.js';
import { initialState, reduce } from '../src/sim/root.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { beginRun, failingCheck, jumpPlan, linked, reach } from '../src/sim/travel.js';
import { fitPart } from '../tools/run.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const at = (campaign, node) => ({ ...campaign, run: { ...campaign.run, at: node, seen: [...campaign.run.seen, node] } });
// The run with the ship at a node that is no port, with no event or ship
// there.
function between(extra = {}) {
  const fresh = onRun(extra);
  const { sector } = fresh.run;
  const quiet = sector.nodes.map(({ event, hostile, ...node }) => node);
  const campaign = { ...fresh, run: { ...fresh.run, sector: { ...sector, nodes: quiet } } };
  return campaign;
}
const uidOf = (ship, type) => ship.modules.find((m) => m.type === type).uid;
// The ship with part `uid` moved somewhere it goes, in reach of where it
// is: the first spot found that `keep` (the moved ship) takes.
function moved(ship, uid, keep = () => true) {
  const module = ship.modules.find((m) => m.uid === uid);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      if (!dx && !dy) continue;
      const result = applyCommand(ship, rules, { op: 'move', uid, x: module.x + dx, y: module.y + dy, rot: module.rot });
      if (result.ok && result.ship !== ship && keep(result.ship)) return result.ship;
    }
  }
  return null;
}
const joined = (ship) => layoutLine(ship, rules).ok === true;

test('between jumps the parts move and turn, but none comes off or goes on', () => {
  const campaign = between({ parts: { cargo: 1 } });
  assert.equal(canRearrange(campaign, rules), true, 'at the way in, nothing there');
  const ship = moved(campaign.ship, uidOf(campaign.ship, 'weapon'), joined);
  assert.ok(ship, 'the gun has somewhere to go');
  const after = rearrangeShip(campaign, ship, rules);
  assert.equal(after.ship, ship);
  assert.deepEqual([after.parts, after.credits, after.supplies], [campaign.parts, campaign.credits, campaign.supplies]);
  assert.deepEqual(campaignProblems(after), []);
  // Through the reducer: the same action as a refit's.
  const state = { ...initialState(1), campaign };
  assert.equal(reduce(state, { type: 'campaign/ship', ship, rules }).campaign.ship, ship);
  // Nothing off, nothing on.
  assert.equal(rearrangeShip(campaign, removeModule(campaign.ship, uidOf(campaign.ship, 'weapon')), rules), campaign);
  assert.equal(reduce(state, { type: 'campaign/ship', ship: removeModule(campaign.ship, uidOf(campaign.ship, 'weapon')), rules }).campaign, campaign);
  const cargo = fitPart(campaign.ship, rules, 'cargo');
  assert.ok(cargo);
  assert.equal(rearrangeShip(campaign, cargo.ship, rules), campaign);
  // A part turned into another isn't the same part.
  const other = { ...campaign.ship, modules: campaign.ship.modules.map((m) => (m.type === 'weapon' ? { ...m, type: 'kestrel-weapon' } : m)) };
  assert.equal(rearrangeShip(campaign, other, rules), campaign);
});

test('no rearranging at a port (a refit there), with an event or a ship to deal with, or in a fight', () => {
  const campaign = between();
  const station = campaign.run.sector.nodes.find((n) => n.type === 'station').id;
  assert.equal(canRearrange(at(campaign, station), rules), false, 'a station refits');
  const fresh = onRun();
  const withEvent = fresh.run.sector.nodes.find((n) => n.event && n.type !== 'station');
  if (withEvent) assert.equal(canRearrange(at(fresh, withEvent.id), rules), false, 'an event to decide first');
  assert.equal(canRearrange({ ...campaign, place: 'fight' }, rules), false);
  assert.equal(canRearrange({ ...campaign, run: { ...campaign.run, approach: { outcome: null, enemy: { name: 'Cutter' } } } }, rules), false);
  assert.equal(canRearrange(campaign, null), false);
});

test("a move that splits the joins holds the ship anywhere on the run, and the words say Rearrange", () => {
  const campaign = between();
  const split = moved(campaign.ship, uidOf(campaign.ship, 'weapon'), (ship) => !joined(ship));
  assert.ok(split, 'the gun can be moved off on its own');
  const apart = rearrangeShip(campaign, split, rules);
  assert.equal(apart.ship, split);
  const check = failingCheck(apart, rules);
  assert.equal(check?.id, 'layout');
  const next = linked(apart.run.sector, apart.run.at)[0];
  const plan = jumpPlan(apart, rules, next);
  assert.equal(plan.ok, false);
  assert.match(plan.error, /can't leave until every flight check passes: .*Rearrange to fix it\./);
  // Moved back, it jumps.
  const back = rearrangeShip(apart, campaign.ship, rules);
  assert.equal(failingCheck(back, rules), null);
  assert.equal(jumpPlan(back, rules, next).ok, true);
  // Away from a port the other lines don't hold it: a crew past the berths
  // (only a refit could fix that) flies on as before M46.
  const crowded = { ...campaign, crew: [...campaign.crew, ...campaign.crew.map((m) => ({ ...m, id: m.id + 100 }))] };
  assert.equal(failingCheck(crowded, rules), null);
  assert.ok(reach(crowded.run.sector, crowded.run.at).size > 1);
});

test('the session between jumps: Delete and Swap say why not', () => {
  const campaign = between({ parts: { 'kestrel-weapon': 1 } });
  const ownParts = Object.fromEntries(Object.entries(stockOf(campaign)).map(([type]) => [type, campaign.ship.modules.filter((m) => m.type === type).length]).filter(([, n]) => n));
  const weapon = uidOf(campaign.ship, 'weapon');
  let session = createSession(campaign.ship, [], ownParts, wreckedUids(campaign), { rearrange: true });
  session = reduceSession(session, { type: 'build/select', uid: weapon }, rules);
  session = { ...session, selected: weapon };
  const kept = reduceSession(session, { type: 'build/delete' }, rules);
  assert.equal(kept.ship, campaign.ship);
  assert.match(kept.notice.text, /Between jumps parts only move and turn: the .* comes off at a station or a shipyard\./);
  const swapped = reduceSession(session, { type: 'build/swap', uid: weapon, moduleType: 'kestrel-weapon' }, rules);
  assert.equal(swapped.ship, campaign.ship);
  assert.equal(swapped.notice.tone, 'bad');
});

// The run with the ship at the first station of its sector.
function atStation(extra = {}) {
  const fresh = onRun(extra);
  return at(fresh, fresh.run.sector.nodes.find((n) => n.type === 'station').id);
}

test("a wreck scrapped for a spare: the spare in its place, the wreck gone, the history starting over", () => {
  const base = atStation({ parts: { 'kestrel-weapon': 1 } });
  const weapon = uidOf(base.ship, 'weapon');
  const campaign = { ...base, wrecks: { [weapon]: 'fire' } };
  let session = { ...createSession(campaign.ship, [], stockOf(campaign), wreckedUids(campaign)), selected: weapon };
  session = reduceSession(reduceSession(session, { type: 'build/undo' }, rules), { type: 'build/swap', uid: weapon, moduleType: 'kestrel-weapon' }, rules);
  assert.equal(session.notice.tone, 'good', session.notice.text);
  assert.match(session.notice.text, /Scrapped the wrecked .*: a .* in its place\. A scrap can't be undone\./);
  const spare = session.ship.modules.find((m) => m.type === 'kestrel-weapon');
  const was = campaign.ship.modules.find((m) => m.uid === weapon);
  assert.deepEqual([spare.x, spare.y, spare.rot], [was.x, was.y, was.rot], 'the same spot and turn');
  assert.deepEqual([session.wrecked, session.past, session.stock.weapon ?? 0, session.stock['kestrel-weapon']], [[], [], 0, 1]);
  // The campaign takes it: nothing on hand, the wreck's damage gone.
  const after = refitShip(campaign, session.ship, rules);
  assert.equal(after.ship, session.ship);
  assert.deepEqual([after.parts, after.wrecks], [{}, {}]);
  assert.deepEqual(stockOf(after), session.stock);
  assert.deepEqual(campaignProblems(after), []);
  // The same part as a spare does too.
  const same = { ...campaign, parts: { weapon: 1 } };
  const twin = reduceSession({ ...createSession(same.ship, [], stockOf(same), wreckedUids(same)), selected: weapon }, { type: 'build/swap', uid: weapon, moduleType: 'weapon' }, rules);
  assert.equal(twin.notice.tone, 'good');
  assert.deepEqual(refitShip(same, twin.ship, rules).parts, {});
  // Without a spare in its place, the wreck still can't come off.
  assert.equal(refitShip(campaign, removeModule(campaign.ship, weapon), rules), campaign);
  const none = reduceSession({ ...createSession(base.ship, [], stockOf({ ...campaign, parts: {} }), [weapon]), selected: weapon }, { type: 'build/swap', uid: weapon, moduleType: 'kestrel-weapon' }, rules);
  assert.equal(none.ship, base.ship);
  assert.match(none.notice.text, /on hand/);
});

test("the chart's ship panel: Rearrange between jumps, Refit at a station, and the joins' words", async () => {
  const { sectorText } = await import('../src/ui/campaign/sectorText.js');
  const campaign = between();
  const away = sectorText(campaign, rules).refit;
  assert.deepEqual([away.label, away.rearrange, away.broken], ['Rearrange', true, null]);
  assert.match(away.line, /moves and turns the ship's parts, free/);
  const station = campaign.run.sector.nodes.find((n) => n.type === 'station').id;
  assert.equal(sectorText(at(campaign, station), rules).refit.label, 'Refit');
  const split = rearrangeShip(campaign, moved(campaign.ship, uidOf(campaign.ship, 'weapon'), (ship) => !joined(ship)), rules);
  assert.match(sectorText(split, rules).refit.broken, /Rearrange to fix it\.$/);
});
