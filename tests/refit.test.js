// Refits at stations (M23h): construction mode on the run takes the parts on
// hand at a station, for nothing (campaign.js refitShip); a wrecked part
// stays aboard until the station repairs it; the ship can't jump from the
// station while a flight check fails; and supplies past what the holds take
// stay behind at the next jump (travel.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand, removeModule } from '../src/sim/builder.js';
import { campaignProblems, canRefit, refitShip, stockOf, wreckedUids } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { initialState, reduce } from '../src/sim/root.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { beginRun, buySupplies, failingCheck, jump, jumpPlan, leavePlan, linked, reach, supplyCapacity, suppliesOver } from '../src/sim/travel.js';
import { fitPart } from '../tools/run.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The run with the ship at the first station of its sector.
function atStation(extra = {}) {
  const fresh = onRun(extra);
  const station = fresh.run.sector.nodes.find((n) => n.type === 'station').id;
  return { ...fresh, run: { ...fresh.run, at: station, seen: [...fresh.run.seen, station] } };
}
// A node a jump from the station reaches, and one a long jump does.
function jumps(campaign) {
  const far = reach(campaign.run.sector, campaign.run.at);
  return { near: [...far].find(([, links]) => links === 1)[0], far: [...far].find(([, links]) => links === 2)?.[0] ?? null };
}
const uidOf = (ship, type) => ship.modules.find((m) => m.type === type).uid;

test('at a station a refit fits the parts on hand, for nothing, and what comes off goes back', () => {
  const campaign = atStation({ parts: { corridor: 2, cargo: 1, medbay: 1 }, credits: 120 });
  assert.equal(canRefit(campaign, rules), true);
  const cargo = fitPart(campaign.ship, rules, 'cargo');
  assert.ok(cargo, 'a cargo hold fits the start ship');
  const fitted = refitShip(campaign, cargo.ship, rules);
  assert.equal(fitted.ship, cargo.ship);
  assert.deepEqual(fitted.parts, { corridor: 2, medbay: 1 });
  assert.deepEqual(stockOf(fitted), stockOf(campaign), 'the parts add up the same');
  assert.deepEqual([fitted.credits, fitted.supplies, fitted.heat, fitted.flags], [campaign.credits, campaign.supplies, campaign.heat, campaign.flags], 'free');
  assert.deepEqual(campaignProblems(fitted), []);
  // Taken off again, it goes back on hand.
  const off = refitShip(fitted, removeModule(fitted.ship, uidOf(fitted.ship, 'cargo')), rules);
  assert.deepEqual(off.parts, { corridor: 2, medbay: 1, cargo: 1 });
  // Only with parts the campaign has: no second hold.
  const twice = fitPart(fitted.ship, rules, 'cargo');
  assert.equal(refitShip(fitted, twice.ship, rules), fitted);
  // Through the game's reducer, which needs the rules to know where the ship is.
  const state = { ...initialState(1), campaign };
  assert.equal(reduce(state, { type: 'campaign/ship', ship: cargo.ship, rules }).campaign.ship, cargo.ship);
  assert.equal(reduce(state, { type: 'campaign/ship', ship: cargo.ship }), state);
});

test('away from a station, or in a fight, the ship is not refitted', () => {
  const station = atStation({ parts: { corridor: 2, cargo: 1 } });
  const cargo = fitPart(station.ship, rules, 'cargo').ship;
  const away = { ...station, run: { ...station.run, at: jumps(station).near } };
  assert.notEqual(away.run.sector.nodes[away.run.at].type, 'station');
  assert.equal(canRefit(away, rules), false);
  assert.equal(refitShip(away, cargo, rules), away);
  const atStart = onRun({ parts: { corridor: 2, cargo: 1 } });
  assert.equal(refitShip(atStart, fitPart(atStart.ship, rules, 'cargo').ship, rules), atStart, 'not at the way in');
  const fighting = { ...station, place: 'fight' };
  assert.equal(refitShip(fighting, cargo, rules), fighting);
  // Nor once the run's act is over: the stub has no refits.
  const later = { ...station, act: 3 };
  assert.equal(refitShip(later, cargo, rules), later);
});

test('a wrecked part moves with its damage, but stays on until the station repairs it', () => {
  const base = atStation({ parts: { corridor: 2 } });
  const weapon = uidOf(base.ship, 'weapon');
  const campaign = { ...base, wrecks: { [weapon]: 'fire' } };
  assert.deepEqual(wreckedUids(campaign), [weapon]);
  // Off: refused, by the sim and by the builder's session.
  assert.equal(refitShip(campaign, removeModule(campaign.ship, weapon), rules), campaign);
  let session = reduceSession(createSession(campaign.ship, [], stockOf(campaign), wreckedUids(campaign)), { type: 'build/tap', ...centre(campaign.ship, weapon) }, rules);
  assert.equal(session.selected, weapon);
  const kept = reduceSession(session, { type: 'build/delete' }, rules);
  assert.equal(kept.ship, campaign.ship, 'Delete leaves it on');
  assert.equal(kept.notice.tone, 'bad');
  assert.match(kept.notice.text, /wrecked: it comes off once the station repairs it/);
  // Without wrecks the same Delete takes it off: the lock is the wreck's.
  const free = reduceSession(reduceSession(createSession(campaign.ship, [], stockOf(campaign)), { type: 'build/tap', ...centre(campaign.ship, weapon) }, rules), { type: 'build/delete' }, rules);
  assert.notEqual(free.ship, campaign.ship);
  // Moved, it keeps its uid, so the damage goes with it, onto the boarding map.
  const module = campaign.ship.modules.find((m) => m.uid === weapon);
  const moved = [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2]]
    .map(([dx, dy]) => applyCommand(campaign.ship, rules, { op: 'move', uid: weapon, x: module.x + dx, y: module.y + dy, rot: module.rot }))
    .find((result) => result.ok && result.ship !== campaign.ship);
  assert.ok(moved, 'the gun has somewhere to move');
  const after = refitShip(campaign, moved.ship, rules);
  assert.equal(after.ship, moved.ship);
  assert.deepEqual(after.wrecks, campaign.wrecks);
  assert.deepEqual(campaignProblems(after), []);
  const map = mapFromShip(after.ship, rules, { wrecked: after.wrecks });
  assert.deepEqual(map, mapFromShip(moved.ship, rules, { wrecked: { [weapon]: 'fire' } }));
  // Swapped for another part of its type it is not the same part: refused.
  const swapped = { ...campaign.ship, modules: campaign.ship.modules.map((m) => (m.uid === weapon ? { ...m, type: 'pointdefense' } : m)) };
  assert.equal(refitShip({ ...campaign, parts: { pointdefense: 1 } }, swapped, rules).ship, campaign.ship);
});

test('the ship can not jump from the station while a flight check fails, and the words say which', () => {
  const campaign = atStation({ parts: { corridor: 2 } });
  const { near, far } = jumps(campaign);
  assert.equal(failingCheck(campaign, rules), null);
  assert.equal(jumpPlan(campaign, rules, near).ok, true);
  // The reactor taken off: no power.
  const broken = refitShip(campaign, removeModule(campaign.ship, uidOf(campaign.ship, 'reactor')), rules);
  assert.equal(broken.parts.reactor, 1, 'the reactor is on hand');
  const check = failingCheck(broken, rules);
  assert.equal(check.id, 'power');
  const plan = jumpPlan(broken, rules, near);
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.check, check);
  assert.equal(plan.error, `The ship can't leave until every flight check passes: ${check.text.charAt(0).toLowerCase()}${check.text.slice(1)}. Refit to fix it.`);
  if (far !== null) assert.equal(jumpPlan(broken, rules, far).ok, false, 'nor a long jump');
  assert.equal(jump(broken, rules, near).ok, false);
  // The jump point is never a station, but if it were, Jump on would wait too.
  const exitStation = { ...broken, run: { ...broken.run, sector: { ...broken.run.sector, exit: broken.run.at } } };
  assert.equal(leavePlan(exitStation, rules).check?.id, 'power');
  // Back on, the ship can go.
  const fixed = refitShip(broken, campaign.ship, rules);
  assert.equal(failingCheck(fixed, rules), null);
  assert.equal(jump(fixed, rules, near).ok, true);
  // Away from a station only the joins hold it (M46): a move between jumps
  // can't add the reactor back, but it can split the ship, as taking the
  // reactor off did here.
  const away = { ...broken, run: { ...broken.run, at: near } };
  assert.equal(failingCheck(away, rules).id, 'layout');
});

test('supplies past what the holds take after a refit stay behind at the next jump, said before it', () => {
  const campaign = atStation({ parts: { corridor: 2, cargo: 1 }, credits: 200 });
  const withHold = refitShip(campaign, fitPart(campaign.ship, rules, 'cargo').ship, rules);
  const full = buySupplies(withHold, rules, supplyCapacity(withHold.ship, rules) - withHold.supplies).campaign;
  assert.equal(full.supplies, rules.balance.baseSupplies + rules.modules.get('cargo').stats.cargo);
  const without = refitShip(full, campaign.ship, rules);
  assert.equal(without.supplies, full.supplies, 'the refit itself takes none');
  const over = suppliesOver(without, rules);
  assert.equal(over, rules.modules.get('cargo').stats.cargo);
  const { near } = jumps(without);
  const plan = jumpPlan(without, rules, near);
  assert.equal(plan.ok, true);
  assert.equal(plan.left, over);
  assert.equal(plan.hungry, false);
  const after = jump(without, rules, near).campaign;
  assert.equal(after.supplies, supplyCapacity(without.ship, rules) - plan.supplies);
  assert.equal(after.flags.suppliesLeft, over);
  // With the holds on, nothing stays behind.
  assert.equal(jumpPlan(full, rules, near).left, 0);
  assert.equal(jump(full, rules, near).campaign.flags.suppliesLeft, undefined);
});

test('an act 2 save opens at the same version and refits at a station', () => {
  const campaign = atStation({ parts: { corridor: 2, cargo: 1 } });
  const text = JSON.stringify(makeSave({ ...initialState(1), campaign }));
  const opened = parseSave(text);
  assert.equal(opened.ok, true, opened.error);
  // M23h needed no bump (saves were 17 then; M24 made them 18).
  assert.equal(opened.save.version, SAVE_VERSION);
  const reopened = opened.save.data.campaign;
  const cargo = fitPart(reopened.ship, rules, 'cargo');
  assert.deepEqual(refitShip(reopened, cargo.ship, rules).parts, { corridor: 2 });
  assert.ok(linked(reopened.run.sector, reopened.run.at).length > 0);
});

// The middle of a module, in cells: a tap there picks it.
function centre(ship, uid) {
  const module = ship.modules.find((m) => m.uid === uid);
  const def = rules.modules.get(module.type);
  const [w, h] = module.rot % 2 ? [def.size[1], def.size[0]] : def.size;
  return { x: module.x + w / 2, y: module.y + h / 2 };
}
