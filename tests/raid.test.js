import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave } from '../src/core/save.js';
import { aiAction } from '../src/sim/ai.js';
import { playFrom } from '../src/sim/autoplay.js';
import { act, createBattle } from '../src/sim/battle.js';
import { applyCommand, removeModule } from '../src/sim/builder.js';
import { campaignProblems, newCampaign, saveFight } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { createFight, reduceFight } from '../src/sim/fight.js';
import { cellAt } from '../src/sim/grid.js';
import { hangarDoors, hangarMap, PAD, waysIn } from '../src/sim/hangarMap.js';
import { mapFromShip, wallAt } from '../src/sim/mapFromShip.js';
import { hasTag } from '../src/sim/modules.js';
import { stepsFrom } from '../src/sim/moves.js';
import { pressAction } from '../src/sim/press.js';
import { beginRaid, endRaid, raidLoss } from '../src/sim/raid.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { walkable } from '../src/sim/terrain.js';
import { generateSite } from '../src/sim/gen/site.js';
import { tileText } from '../src/ui/battle/tileText.js';
import { raidObjective, raidOutcome } from '../src/ui/campaign/jobText.js';
import { drawn, rules } from './battleKit.js';
import { theShip } from '../src/ui/campaign/hubText.js';

// A campaign with the raid due: the start ship with its quarters, life
// support and an engine fitted, and heat at raidHeat.
function raidCampaign(seed = 5, extra = {}) {
  let { ship } = newCampaign(rules, seed);
  for (const command of [{ op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 }, { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 }, { op: 'place', type: 'engine', x: 7, y: 6, rot: 0 }]) {
    const result = applyCommand(ship, rules, command);
    assert.ok(result.ok, result.message);
    ship = result.ship;
  }
  return { ...withBoard(newCampaign(rules, seed), rules), ship, parts: { corridor: 2 }, credits: 230, heat: rules.balance.raidHeat, ...extra };
}

test('the hangar map is the ship on a deck, its airlocks opening onto it', () => {
  const { ship } = raidCampaign();
  const inner = mapFromShip(ship, rules);
  const map = hangarMap(ship, rules);
  assert.deepEqual(hangarMap(structuredClone(ship), rules), map, 'the same ship, the same map');
  const p = PAD * rules.tilesPerCell;
  assert.deepEqual([map.width, map.height], [inner.width + 2 * p, inner.height + 2 * p]);
  assert.deepEqual([map.margin, map.hangar, map.hatches], [0, true, []]);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = cellAt(map.tiles, x, y);
      const within = x >= p && y >= p && x < p + inner.width && y < p + inner.height;
      const was = within ? cellAt(inner.tiles, x - p, y - p) : 'space';
      assert.equal(tile, was === 'space' ? 'deck' : was, `(${x}, ${y})`);
      if (within) assert.equal(cellAt(map.roomAt, x, y), cellAt(inner.roomAt, x - p, y - p));
    }
  }
  for (const { x, y, side } of inner.hatches) assert.equal(wallAt(map, x + p, y + p, side), 'door', 'an airlock opens onto the deck');
  assert.equal(waysIn(map), inner.hatches.length);
  assert.deepEqual(map.rooms.map((r) => [r.type, r.x, r.y]), inner.rooms.map((r) => [r.type, r.x + p, r.y + p]));
  // The hangar's doors: the west columns of the deck, middle first.
  const doors = hangarDoors(map);
  assert.ok(doors.every(([x, y]) => x < p && cellAt(map.tiles, x, y) === 'deck'));
  assert.deepEqual(doors[0], [0, Math.floor((map.height - 1) / 2)]);
  // From the doors, every tile to stand on can be walked to, the ship's
  // rooms through the airlock.
  const away = stepsFrom({ map, doors: [], units: [] }, doors, rules);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) if (walkable({ map, doors: [] }, x, y, rules)) assert.ok(away.has(`${x},${y}`), `(${x}, ${y}) out of reach`);
  }
  assert.equal(hangarMap({ ...ship, modules: [] }, rules), null, 'no ship, no hangar');
});

test('a side that presses on opens the door it would otherwise wait behind', () => {
  // Two units either side of a closed door, out of each other's sight.
  const map = drawn(`
+-+-+-+-+-+-+
|. . ./. . .|
+-+-+-+-+-+-+
`);
  const { battle } = createBattle({ map, units: [{ kind: 'marine', x: 2, y: 0 }, { kind: 'pirate', x: 3, y: 0 }], seed: 1 }, rules);
  assert.deepEqual(pressAction(battle, rules), { type: 'open', unit: 'c1', side: 'e' });
  // Further off, it walks up first.
  const far = createBattle({ map, units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], seed: 1 }, rules).battle;
  assert.equal(pressAction(far, rules).type, 'move');
  // With an enemy in sight, it plays as the AI.
  const open = createBattle({ map: drawn(`
+-+-+-+-+-+-+
|. . . . . .|
+-+-+-+-+-+-+
`), units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], seed: 1 }, rules).battle;
  assert.deepEqual(pressAction(open, rules), aiAction(open, rules));
});

test('a raid starts on the hangar map: the crew on the bridge, the raiders at the doors, pressing on', () => {
  const campaign = raidCampaign();
  assert.deepEqual(beginRaid({ ...campaign, heat: 74 }, rules), { ok: false, error: 'No one is raiding the hangar.' });
  const begun = beginRaid(campaign, rules);
  assert.ok(begun.ok, begun.error);
  const { fight, rng } = begun.campaign;
  assert.notEqual(rng, campaign.rng, 'the seed is a roll');
  assert.deepEqual([fight.raid, fight.job, fight.encounter, fight.battle.options.press, fight.battle.map.hangar], [true, null, 'raid', true, true]);
  assert.deepEqual(begun, beginRaid(structuredClone(campaign), rules), 'reloading never rerolls');
  const { battle } = fight;
  const crew = battle.units.filter((u) => u.side === 'crew');
  const raiders = battle.units.filter((u) => u.side === 'enemy');
  assert.deepEqual(raiders.map((u) => u.kind), rules.encounters.get('raid').enemies);
  assert.deepEqual(raiders.map((u) => [u.x, u.y]), hangarDoors(battle.map).slice(0, raiders.length));
  const bridge = battle.map.rooms.find((room) => hasTag(rules.modules.get(room.type), 'bridge'));
  assert.ok(crew.every((u) => u.x >= bridge.x && u.x < bridge.x + bridge.w && u.y >= bridge.y && u.y < bridge.y + bridge.h), 'the crew on the bridge');
  assert.deepEqual(campaignProblems(begun.campaign), []);
  // No airlock: no way in, and no raid until there is one.
  const airlock = campaign.ship.modules.find((m) => m.type === 'airlock');
  const sealed = { ...campaign, ship: removeModule(campaign.ship, airlock.uid) };
  assert.match(beginRaid(sealed, rules).error, /won't cut through the hull\. Put an airlock on it/);
  // Through the game's reducer.
  const state = { ...initialState(1), screen: 'hub', campaign };
  const raided = reduce(state, { type: 'campaign/raid/begin', rules });
  assert.equal(raided.screen, 'campaign-fight');
  assert.deepEqual(raided.campaign, begun.campaign);
});

test("on the Fight screen, the raiders' turn presses on toward the crew", () => {
  const { fight } = beginRaid(raidCampaign(), rules).campaign;
  const bridge = fight.battle.units.filter((u) => u.side === 'crew').map((u) => [u.x, u.y]);
  const away = stepsFrom(fight.battle, bridge, rules);
  const distance = (battle) => battle.units.filter((u) => u.side === 'enemy').reduce((sum, u) => sum + (away.get(`${u.x},${u.y}`) ?? 99), 0);
  const before = distance(fight.battle);
  // From M50 the first End is Ready (placing over); the second ends the turn.
  const ready = reduceFight(createFight(fight.battle, rules, fight.log), { type: 'fight/end' }, rules);
  const after = reduceFight(ready, { type: 'fight/end' }, rules);
  assert.equal(after.battle.side, 'crew');
  assert.ok(distance(after.battle) < before, `the raiders came closer: ${before} to ${distance(after.battle)}`);
});

// No standoff: the raiders come in. A fight can still run long when the
// last two standing keep missing, so the bound is generous.
test('raids end, won or lost, and the crew can win them', () => {
  const results = { crew: 0, enemy: 0 };
  for (let seed = 1; seed <= 16; seed++) {
    const { fight } = beginRaid(raidCampaign(seed), rules).campaign;
    const { battle } = playFrom(fight.battle, rules, { crew: aiAction, enemy: pressAction }, { maxRounds: 60 });
    assert.ok(battle.winner, `seed ${seed}: no winner after 60 rounds`);
    results[battle.winner] += 1;
  }
  assert.ok(results.crew > 0 && results.enemy > 0, `both sides win some: ${JSON.stringify(results)}`);
});

test('after a raid, heat falls to heatAfterRaid; lost, the raiders take the dearest part on hand, or half the credits', () => {
  const on = beginRaid(raidCampaign(), rules).campaign;
  const ended = (campaign, winner) => endRaid({ ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, winner } } }, rules);
  const won = ended(on, 'crew');
  assert.deepEqual([won.place, won.fight, won.heat, won.credits], ['hub', null, rules.balance.heatAfterRaid, 230]);
  assert.deepEqual(won.parts, { corridor: 2 });
  assert.equal(won.flags.raidsWon, 1);
  assert.deepEqual(won.crew.map((m) => m.hp), [10, 8, 8], 'healed at the hangar');
  assert.deepEqual(campaignProblems(won), []);
  const lost = ended({ ...on, parts: { corridor: 2, engine: 1, shield: 1 } }, 'enemy');
  const dearest = ['engine', 'shield', 'corridor'].sort((a, b) => rules.modules.get(b).cost - rules.modules.get(a).cost)[0];
  assert.equal(lost.parts[dearest], undefined, `they took the ${dearest}`);
  assert.equal(lost.flags.raidsLost, 1);
  assert.equal(lost.heat, rules.balance.heatAfterRaid);
  const broke = ended({ ...on, parts: {}, credits: 235 }, 'enemy');
  assert.equal(broke.credits, 120, 'half, in steps of 5: 115 taken');
  assert.deepEqual(raidLoss({ ...on, parts: {}, credits: 5 }, rules), null, 'nothing worth taking');
  assert.equal(endRaid(on, rules), on, 'a raid still going is left alone');
  // Through the game's reducer.
  const state = { ...initialState(1), screen: 'campaign-fight', campaign: { ...on, fight: { ...on.fight, battle: { ...on.fight.battle, winner: 'crew' } } } };
  const home = reduce(state, { type: 'campaign/fight/end', rules });
  assert.equal(home.screen, 'hub');
  assert.equal(home.campaign.heat, rules.balance.heatAfterRaid);
});

// Quitting anywhere in a raid and reopening resumes it, as M12 asks of
// every fight.
test('quitting mid-raid and reopening resumes the raid where it was', () => {
  let state = { ...initialState(3), screen: 'hub', campaign: raidCampaign(7) };
  const quitAndReopen = (now) => {
    const loaded = parseSave(JSON.stringify(makeSave(saveData(now))));
    assert.ok(loaded.ok, loaded.error);
    const fresh = reduce(initialState(99), { type: 'save/restore', data: loaded.save.data });
    return reduce(fresh, { type: 'campaign/continue' });
  };
  assert.equal(quitAndReopen(state).screen, 'hub', 'the raid is due at the hub');
  state = reduce(state, { type: 'campaign/raid/begin', rules });
  let { battle, log } = state.campaign.fight;
  for (let i = 0; i < 12 && !battle.winner; i++) {
    const player = battle.side === 'crew' ? aiAction : pressAction;
    const result = act(battle, player(battle, rules), rules);
    assert.ok(result.ok, result.error);
    battle = result.battle;
    log = [...log, ...result.events];
    state = { ...state, campaign: saveFight(state.campaign, battle, log) };
    const reopened = quitAndReopen(state);
    assert.equal(reopened.screen, 'campaign-fight');
    assert.deepEqual(saveData(reopened), saveData(state));
  }
});

test('a v5 save gains raid: false on any fight', () => {
  const on = withBoard(newCampaign(rules, 4), rules);
  const job = reduce({ ...initialState(1), campaign: on }, { type: 'campaign/job/take', index: 0, rules }).campaign;
  // As v5 saved it: no raid on the fight, and no shop (v7).
  const { raid, ...fight } = job.fight;
  const { shop, spent, ...unshopped } = job;
  const v5 = { version: 5, data: { ...saveData(initialState(2)), campaign: { ...unshopped, fight } } };
  const loaded = parseSave(JSON.stringify(v5));
  assert.ok(loaded.ok, loaded.error);
  assert.equal(loaded.save.data.campaign.fight.raid, false);
  assert.deepEqual(loaded.save.data.campaign, { ...job, shop: null });
  const { shop: stock, spent: done, ...hubCampaign } = on;
  const hub = { version: 5, data: { ...saveData(initialState(2)), campaign: hubCampaign } };
  assert.deepEqual(parseSave(JSON.stringify(hub)).save.data.campaign, { ...on, shop: null }, 'no fight: nothing to add for raids');
  const damaged = { ...job, fight: { ...job.fight, raid: 'yes' } };
  assert.match(campaignProblems(damaged).join(' '), /fight is unreadable/);
});

test('a raid in words: the raiders left, and what it cost', () => {
  const on = beginRaid(raidCampaign(), rules).campaign;
  assert.deepEqual(raidObjective(on.fight.battle), { title: 'Raid', progress: '4 raiders left', done: false, deadline: null });
  const won = { ...on.fight.battle, winner: 'crew' };
  assert.deepEqual(raidOutcome(won, on, rules), { tone: 'good', title: 'Raid beaten', text: `They back off ${theShip(on, rules)}, for now. Heat falls to 40.` });
  const lost = { ...on.fight.battle, winner: 'enemy' };
  assert.deepEqual(raidOutcome(lost, { ...on, parts: { engine: 1 } }, rules), { tone: 'bad', title: 'Raid lost', text: 'They took the Engine. Heat falls to 40.' });
  assert.deepEqual(raidOutcome(lost, { ...on, parts: {}, credits: 100 }, rules), { tone: 'bad', title: 'Raid lost', text: 'They took 50 credits. Heat falls to 40.' });
  assert.deepEqual(raidOutcome(lost, { ...on, parts: {}, credits: 0 }, rules), { tone: 'bad', title: 'Raid lost', text: 'There was nothing to take. Heat falls to 40.' });
});

test("a tile's card names the hangar's deck, rock and ground as well as rooms", () => {
  const { ship } = raidCampaign();
  const map = hangarMap(ship, rules);
  assert.equal(tileText(map, 0, 0, rules).title, 'Hangar deck');
  const room = map.rooms[0];
  assert.equal(tileText(map, room.x, room.y, rules).title, rules.modules.get(room.type).name);
  const site = generateSite(rules.siteMaps.get('yard'), 1).map;
  const rock = site.tiles.cells.indexOf('rock');
  assert.equal(tileText(site, rock % site.width, Math.floor(rock / site.width), rules).title, 'Rock');
  const ground = site.tiles.cells.indexOf('floor');
  assert.equal(tileText(site, ground % site.width, Math.floor(ground / site.width), rules).title, 'Floor');
});
