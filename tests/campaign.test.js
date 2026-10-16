import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave } from '../src/core/save.js';
import { act } from '../src/sim/battle.js';
import { aiAction } from '../src/sim/ai.js';
import { applyCommand, buildShip, layoutProblems, removeModule } from '../src/sim/builder.js';
import { actOf, beginFight, campaignProblems, endFight, maxHp, newCampaign, refitShip, saveFight, stockOf } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { isLook } from '../src/sim/looks.js';
import { createFight, reduceFight } from '../src/sim/fight.js';
import { initialState, PLACE_SCREENS, reduce, saveData } from '../src/sim/root.js';
import { scriptedAction } from '../src/sim/scripted.js';
import { ordersOf, rules } from './battleKit.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// A game with a new campaign at the hub.
const started = (seed) => reduce(initialState(seed), { type: 'campaign/new', rules });

// Quitting: what main.js writes after the last change. Reopening: a fresh
// game reads it back, as main.js does on launch, and Continue is tapped.
function quitAndReopen(state) {
  const loaded = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(loaded.ok, loaded.error);
  const fresh = reduce(initialState(12345), { type: 'save/restore', data: loaded.save.data });
  assert.equal(fresh.screen, 'title');
  return reduce(fresh, { type: 'campaign/continue' });
}

// What the campaign's Fight screen does: orders go to the fight, and every
// order that changes the battle is saved to the campaign.
function order(state, fight, action) {
  const next = reduceFight(fight, action, rules);
  const saved = next.battle === fight.battle ? state : reduce(state, { type: 'campaign/fight/save', battle: next.battle, log: next.log });
  return { state: saved, fight: next };
}

const fightOf = (state) => createFight(state.campaign.fight.battle, rules, state.campaign.fight.log);

test("a new campaign starts in act 1 at the hangar, with its background's start", () => {
  const campaign = newCampaign(rules, 77);
  const { start } = rules.backgrounds.get('miner');
  const { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  const { crew, ...rest } = campaign;
  assert.deepEqual(
    crew.map(({ id, job, traits, hp }) => ({ id, job, traits, hp })),
    [
      { id: 1, job: 'marine', traits: [], hp: 10 },
      { id: 2, job: 'engineer', traits: [], hp: 8 },
      { id: 3, job: 'medic', traits: [], hp: 8 },
    ],
  );
  // Named from the recruits' names, each their own, and each with a look.
  for (const member of crew) {
    const [first, last] = member.name.split(' ');
    assert.ok(rules.recruits.first.includes(first) && rules.recruits.last.includes(last), member.name);
    assert.ok(isLook(member.look), member.name);
  }
  assert.equal(new Set(crew.map((member) => member.name)).size, crew.length);
  assert.deepEqual(rest, {
    seed: 77,
    rng: 77,
    background: 'miner',
    act: 1,
    place: 'hub',
    credits: 0,
    parts: { quarters: 1, lifesupport: 1, corridor: 2 },
    captain: 1,
    heat: 0,
    flags: {},
    ship,
    wrecks: {},
    board: [],
    shop: null,
    spent: [],
    supplies: 0,
    run: null,
    colony: null,
    fight: null,
  });
  assert.deepEqual(actOf(campaign, rules), { act: 1, name: 'Homeworld', hub: 'hangar', home: 'The hangar', heals: true, liftOff: 1 });
  assert.deepEqual(layoutProblems(campaign.ship, rules), [], 'the half-built ship breaks no layout rule');
  assert.deepEqual(campaignProblems(campaign), []);
  assert.deepEqual(newCampaign(rules, 77), campaign, 'the same seed, the same campaign');
});

test('a refit at the hub takes parts from the hangar and puts back what comes off', () => {
  const campaign = deepFreeze(newCampaign(rules, 77));
  assert.deepEqual(stockOf(campaign), { quarters: 1, lifesupport: 1, corridor: 5, bridge: 1, reactor: 1, airlock: 1, weapon: 1 });
  const quarters = applyCommand(campaign.ship, rules, { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 });
  assert.ok(quarters.ok, quarters.message);
  const fitted = refitShip(campaign, quarters.ship, rules);
  assert.equal(fitted.ship, quarters.ship);
  assert.deepEqual(fitted.parts, { lifesupport: 1, corridor: 2 });
  assert.deepEqual(campaignProblems(fitted), []);
  const corridor = fitted.ship.modules.find((m) => m.type === 'corridor');
  assert.deepEqual(refitShip(fitted, removeModule(fitted.ship, corridor.uid), rules).parts, { lifesupport: 1, corridor: 3 }, 'a part taken off goes back');
  // Only parts the campaign has: no engine, and no second quarters.
  const engine = applyCommand(campaign.ship, rules, { op: 'place', type: 'engine', x: 7, y: 6, rot: 0 });
  assert.ok(engine.ok, engine.message);
  assert.equal(refitShip(campaign, engine.ship, rules), campaign);
  const twice = applyCommand(fitted.ship, rules, { op: 'place', type: 'quarters', x: 5, y: 5, rot: 0 });
  assert.ok(twice.ok, twice.message);
  assert.equal(refitShip(fitted, twice.ship, rules), fitted);
  // Not in a fight, not onto another frame, and the same ship changes nothing.
  const fighting = beginFight(campaign, rules).campaign;
  assert.equal(refitShip(fighting, quarters.ship, rules), fighting);
  assert.equal(refitShip(campaign, { ...quarters.ship, frame: 'barge' }, rules), campaign);
  assert.equal(refitShip(campaign, campaign.ship, rules), campaign);
  assert.equal(refitShip(campaign, quarters.ship), campaign, 'not without the rules to say where the ship is');
  // Through the game's reducer.
  const state = started(4);
  assert.deepEqual(reduce(state, { type: 'campaign/ship', ship: quarters.ship, rules }).campaign.parts, { lifesupport: 1, corridor: 2 });
  assert.equal(reduce(state, { type: 'campaign/ship', ship: engine.ship, rules }), state);
});

test("a new campaign's seed is the game's next roll, and the game goes to the hub with a job board", () => {
  const state = deepFreeze(initialState(5));
  const first = reduce(state, { type: 'campaign/new', rules });
  assert.equal(first.screen, 'hub');
  assert.notEqual(first.rng, state.rng);
  assert.deepEqual(first.campaign, withBoard(newCampaign(rules, first.campaign.seed), rules));
  assert.equal(first.campaign.board.length, rules.contracts.boardSize);
  assert.deepEqual(reduce(state, { type: 'campaign/new', rules }), first, 'the same game state, the same campaign');
  const second = reduce(first, { type: 'campaign/new', rules });
  assert.notEqual(second.campaign.seed, first.campaign.seed, 'starting over rolls a new one');
});

test('a fight puts the whole crew against the boarders on the ship, seeded by the campaign', () => {
  const campaign = deepFreeze(newCampaign(rules, 77));
  const begun = beginFight(campaign, rules);
  assert.ok(begun.ok, begun.error);
  const { fight, rng, place } = begun.campaign;
  assert.equal(place, 'fight');
  assert.notEqual(rng, campaign.rng, 'the seed is a roll');
  assert.deepEqual(fight.crew, [1, 2, 3]);
  assert.equal(fight.encounter, 'boarders');
  const crew = fight.battle.units.filter((u) => u.side === 'crew');
  const [a, b, c] = campaign.crew.map((member) => member.name);
  assert.deepEqual(crew.map((u) => [u.id, u.name, u.kind, u.hp]), [['c1', a, 'marine', 10], ['c2', b, 'engineer', 8], ['c3', c, 'medic', 8]]);
  assert.deepEqual(fight.battle.units.filter((u) => u.side === 'enemy').map((u) => u.kind), rules.encounters.get('boarders').enemies);
  assert.deepEqual(fight.log, [{ type: 'turn', side: 'crew', round: 1 }]);
  assert.deepEqual(campaignProblems(begun.campaign), []);
  // Reloading never rerolls: the same campaign begins the same fight.
  assert.deepEqual(beginFight(structuredClone(campaign), rules), begun);
});

test('wounds carry into the next fight, up to the job\'s hit points', () => {
  const campaign = newCampaign(rules, 77);
  const wounded = { ...campaign, crew: [{ ...campaign.crew[0], hp: 3 }, { ...campaign.crew[1], hp: 50 }, campaign.crew[2]] };
  const crew = beginFight(wounded, rules).campaign.fight.battle.units.filter((u) => u.side === 'crew');
  assert.deepEqual(crew.map((u) => [u.hp, u.maxHp]), [[3, 10], [8, 8], [8, 8]]);
  assert.equal(maxHp(wounded.crew[0], rules), 10);
});

test("a fight that can't start says why", () => {
  const campaign = newCampaign(rules, 77);
  const on = beginFight(campaign, rules).campaign;
  assert.deepEqual(beginFight(on, rules), { ok: false, error: 'A fight is on already.' });
  assert.deepEqual(beginFight({ ...campaign, crew: [] }, rules), { ok: false, error: 'There is no one aboard to fight.' });
  assert.deepEqual(beginFight({ ...campaign, crew: [{ ...campaign.crew[0], job: 'cook' }] }, rules), { ok: false, error: `${campaign.crew[0].name}'s job "cook" is unknown.` });
  assert.deepEqual(beginFight({ ...campaign, ship: { ...campaign.ship, modules: [] } }, rules), { ok: false, error: 'The ship has no parts yet.' });
  const sealed = { ...campaign.ship, modules: campaign.ship.modules.filter((m) => m.type !== 'airlock') };
  assert.match(beginFight({ ...campaign, ship: sealed }, rules).error, /Boarders need a way in/);
  // The root reducer leaves the game as it was.
  const state = deepFreeze({ ...started(1), campaign: { ...started(1).campaign, ship: sealed } });
  assert.equal(reduce(state, { type: 'campaign/fight/begin', rules }), state);
});

test('a fight is saved after every order, and only while one is on', () => {
  const campaign = beginFight(newCampaign(rules, 77), rules).campaign;
  const { battle } = act(campaign.fight.battle, { type: 'end' }, rules);
  const log = [...campaign.fight.log, { type: 'turn', side: 'enemy', round: 1 }];
  const saved = saveFight(campaign, battle, log);
  assert.equal(saved.fight.battle, battle);
  assert.equal(saved.fight.log, log);
  assert.equal(saved.fight.seed, campaign.fight.seed);
  assert.equal(saveFight(saved, battle, log), saved, 'the same fight changes nothing');
  const atHub = newCampaign(rules, 77);
  assert.equal(saveFight(atHub, battle, log), atHub, 'no fight on: nothing to save');
});

test('after a fight: the act 1 hangar heals, elsewhere wounds stay and the fallen come back hurt; the dead leave, and the flags count it', () => {
  const campaign = beginFight(newCampaign(rules, 77), rules).campaign;
  const units = campaign.fight.battle.units.map((u) => {
    if (u.id === 'c1') return { ...u, hp: 4 };
    if (u.id === 'c2') return { ...u, hp: 0, status: 'out' };
    if (u.id === 'c3') return { ...u, hp: 0, status: 'stable' };
    return { ...u, hp: 0, status: 'dead' };
  });
  const won = { ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, units, winner: 'crew' } } };
  const after = endFight(won, rules);
  assert.equal(after.place, 'hub');
  assert.equal(after.fight, null);
  assert.deepEqual(after.crew.map((m) => [m.job, m.hp]), [['marine', 10], ['engineer', 8], ['medic', 8]], 'act 1: healed at the hangar');
  assert.deepEqual(after.flags, { fightsWon: 1 });
  assert.deepEqual(campaignProblems(after), []);
  const later = endFight({ ...won, act: 2 }, rules);
  assert.deepEqual(later.crew.map((m) => [m.job, m.hp]), [['marine', 4], ['engineer', 1], ['medic', 1]], 'act 2: no healing at home');

  const killed = units.map((u) => (u.id === 'c2' ? { ...u, status: 'dead' } : u));
  const lost = endFight({ ...won, flags: { fightsLost: 2 }, fight: { ...won.fight, battle: { ...won.fight.battle, units: killed, winner: 'enemy' } } }, rules);
  assert.deepEqual(lost.crew.map((m) => m.job), ['marine', 'medic'], 'killed where death is permanent');
  assert.deepEqual(lost.flags, { fightsLost: 3 });

  assert.equal(endFight(campaign, rules), campaign, 'a fight still going is left alone');
  const atHub = newCampaign(rules, 77);
  assert.equal(endFight(atHub, rules), atHub);
});

test('the screens follow the campaign: hub, fight and back', () => {
  let state = started(3);
  assert.equal(state.screen, PLACE_SCREENS.hub);
  state = reduce(state, { type: 'screen/show', screen: 'title' });
  state = reduce(state, { type: 'campaign/continue' });
  assert.equal(state.screen, 'hub');
  state = reduce(state, { type: 'campaign/fight/begin', rules });
  assert.equal(state.screen, 'campaign-fight');
  assert.equal(reduce(state, { type: 'campaign/fight/end', rules }), state, 'not over yet');
  const over = { ...state.campaign.fight.battle, winner: 'crew' };
  state = reduce(state, { type: 'campaign/fight/save', battle: over, log: state.campaign.fight.log });
  state = reduce(state, { type: 'campaign/fight/end', rules });
  assert.equal(state.screen, 'hub');
  assert.equal(state.campaign.place, 'hub');
  state = reduce(state, { type: 'campaign/job/take', index: 1, rules });
  assert.equal(state.screen, 'campaign-fight');
  assert.equal(state.campaign.fight.job.contract, started(3).campaign.board[1].contract);
  // With no campaign, Continue and the campaign's actions do nothing.
  const none = deepFreeze(initialState(1));
  for (const type of ['campaign/continue', 'campaign/board', 'campaign/job/take', 'campaign/fight/begin', 'campaign/fight/save', 'campaign/fight/end']) {
    assert.equal(reduce(none, { type, rules, index: 0, battle: over, log: [] }), none, type);
  }
});

// M12's Done when: quitting anywhere and reopening resumes correctly. The
// game is quit after every change a player can make, from the new campaign
// through a whole fight and back to the hub, and reopened: it is where it
// was, and it plays on exactly as it would have. One fight is at home
// against boarders, the other a job off the board.
test('quitting anywhere and reopening resumes where the player was', () => {
  for (const seed of [2, 1]) {
    const begin = seed === 2 ? { type: 'campaign/fight/begin', rules } : { type: 'campaign/job/take', index: 0, rules };
    let state = started(seed);
    let reopened = quitAndReopen(state);
    assert.equal(reopened.screen, 'hub');
    assert.deepEqual(saveData(reopened), saveData(state), 'at the hub');

    // Construction mode: a part fitted is saved at once.
    state = reduce(state, { type: 'screen/show', screen: 'construction' });
    const fitted = applyCommand(state.campaign.ship, rules, { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 });
    state = reduce(state, { type: 'campaign/ship', ship: fitted.ship, rules });
    reopened = quitAndReopen(state);
    assert.equal(reopened.screen, 'hub', 'construction mode reopens at the hangar');
    assert.deepEqual(saveData(reopened), saveData(state), 'after a refit');
    assert.deepEqual(reopened.campaign.parts, { lifesupport: 1, corridor: 2 });
    state = reduce(state, { type: 'screen/show', screen: 'hub' });

    state = reduce(state, begin);
    assert.deepEqual(reduce(reopened, begin).campaign, state.campaign, 'the fight a reopened hub begins is the same');
    let fight = fightOf(state);
    let checked = 0;
    while (!fight.battle.winner) {
      assert.ok(fight.battle.round <= 30, 'the fight ends');
      for (const action of ordersOf(scriptedAction(fight.battle, rules))) {
        const before = state;
        ({ state, fight } = order(state, fight, action));
        if (state === before) continue;
        reopened = quitAndReopen(state);
        assert.equal(reopened.screen, 'campaign-fight');
        assert.deepEqual(saveData(reopened), saveData(state), `seed ${seed}, round ${fight.battle.round}`);
        assert.deepEqual(fightOf(reopened).battle, fight.battle);
        // Now and then, play the rest of the fight from the reopened game
        // too: it ends the same way, roll for roll.
        if (checked++ % 6 === 0) assert.deepEqual(playOut(reopened), playOut(state));
      }
    }
    assert.equal(quitAndReopen(state).screen, 'campaign-fight', 'the end of the fight, before going back');

    const fought = state.campaign.fight.battle;
    state = reduce(state, { type: 'campaign/fight/end', rules });
    reopened = quitAndReopen(state);
    assert.equal(reopened.screen, 'hub');
    assert.deepEqual(saveData(reopened), saveData(state), 'back at the hub');
    const flag = fought.winner === 'crew' ? 'fightsWon' : 'fightsLost';
    assert.equal(reopened.campaign.flags[flag], 1);
    assert.deepEqual(reopened.campaign.crew.map((m) => m.hp), [10, 8, 8], 'healed at the hangar');
  }
});

// The rest of a fight, the scripted crew against the AI, as the screen
// plays it: the battle at the end.
function playOut(state) {
  let fight = fightOf(state);
  while (!fight.battle.winner) {
    for (const action of ordersOf(scriptedAction(fight.battle, rules))) fight = reduceFight(fight, action, rules);
  }
  return fight.battle;
}

test('every battle the AI plays to on the ship reads back from a save', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let campaign = beginFight(newCampaign(rules, seed), rules).campaign;
    let { battle, log } = campaign.fight;
    while (!battle.winner && battle.round <= 30) {
      const result = act(battle, aiAction(battle, rules), rules);
      assert.ok(result.ok, result.error);
      battle = result.battle;
      log = [...log, ...result.events];
      campaign = saveFight(campaign, battle, log);
      assert.deepEqual(campaignProblems(campaign), [], `seed ${seed}, round ${battle.round}`);
      assert.deepEqual(JSON.parse(JSON.stringify(campaign)), campaign);
    }
  }
});

test("a damaged campaign is named, part by part, and never read", () => {
  const atHub = newCampaign(rules, 77);
  const inFight = beginFight(atHub, rules).campaign;
  const withJob = withBoard(atHub, rules);
  const onJob = reduce({ ...initialState(1), campaign: withJob }, { type: 'campaign/job/take', index: 0, rules }).campaign;
  assert.deepEqual(campaignProblems(onJob), []);
  const unit = (c, changes) => ({ ...c, fight: { ...c.fight, battle: { ...c.fight.battle, units: c.fight.battle.units.map((u, i) => (i === 0 ? { ...u, ...changes } : u)) } } });
  const battle = (c, changes) => ({ ...c, fight: { ...c.fight, battle: { ...c.fight.battle, ...changes } } });
  const map = (c, changes) => battle(c, { map: { ...c.fight.battle.map, ...changes } });
  const cases = [
    [null, /campaign is unreadable/],
    [[], /campaign is unreadable/],
    [{ ...atHub, rng: -1 }, /seed or RNG state is invalid/],
    [{ ...atHub, background: 7 }, /background is invalid/],
    [{ ...atHub, board: {} }, /job board is unreadable/],
    [{ ...atHub, board: [{ contract: 'repo' }] }, /job board is unreadable/],
    [{ ...withJob, board: [{ ...withJob.board[0], seed: -3 }] }, /job board is unreadable/],
    [{ ...withJob, board: [{ ...withJob.board[0], twist: 5 }] }, /job board is unreadable/],
    [{ ...onJob, fight: { ...onJob.fight, job: { ...onJob.fight.job, credits: -1 } } }, /fight has an unreadable job/],
    [{ ...onJob, fight: { ...onJob.fight, job: undefined } }, /fight has an unreadable job/],
    [battle(onJob, { objective: { type: 'grab', crates: [], taken: [] } }), /fight has an unreadable objective/],
    [battle(onJob, { objective: { type: 'grab', crates: [[1, 1]], taken: [[2, 2]] } }), /fight has an unreadable objective/],
    [battle(onJob, { objective: { type: 'hack', at: [999, 0], turns: 2, progress: 0, worked: 0 } }), /fight has an unreadable objective/],
    [battle(onJob, { objective: { type: 'dance' } }), /fight has an unreadable objective/],
    [battle(onJob, { objective: undefined }), /fight has an unreadable objective/],
    [battle(onJob, { options: { forgiving: false, permadeath: false, sight: 0 } }), /fight has unreadable options/],
    [battle(onJob, { options: { forgiving: false, permadeath: false, deadline: 'soon' } }), /fight has unreadable options/],
    [map(onJob, { margin: -1 }), /fight has an unreadable map/],
    [{ ...atHub, act: 4 }, /act is invalid/],
    [{ ...atHub, place: 'bar' }, /place is invalid/],
    [{ ...atHub, credits: 1.5 }, /credits are invalid/],
    [{ ...atHub, parts: { engine: 0 } }, /parts are unreadable/],
    [{ ...atHub, parts: [] }, /parts are unreadable/],
    [{ ...atHub, crew: [atHub.crew[0], atHub.crew[0]] }, /crew is unreadable/],
    [{ ...atHub, crew: [{ ...atHub.crew[0], hp: 0 }] }, /crew is unreadable/],
    [{ ...atHub, crew: [{ ...atHub.crew[0], name: '' }] }, /crew is unreadable/],
    [{ ...atHub, heat: 101 }, /heat is invalid/],
    [{ ...atHub, flags: { 'no spaces': true } }, /flags are unreadable/],
    [{ ...atHub, flags: { met: {} } }, /flags are unreadable/],
    [{ ...atHub, ship: { ...atHub.ship, nextUid: 0 } }, /ship is unreadable/],
    [{ ...atHub, place: 'fight' }, /fight doesn't match where the player is/],
    [{ ...inFight, place: 'hub' }, /fight doesn't match where the player is/],
    [{ ...atHub, fight: undefined }, /fight doesn't match where the player is/],
    [{ ...inFight, fight: { ...inFight.fight, crew: [1, 2, 9] } }, /fight names crew who aren't aboard/],
    [{ ...inFight, fight: { ...inFight.fight, crew: [1, 2] } }, /fight doesn't match its crew/],
    [{ ...inFight, fight: { ...inFight.fight, seed: 'x' } }, /fight is unreadable/],
    [{ ...inFight, fight: { ...inFight.fight, log: [{}] } }, /fight has an unreadable log/],
    [battle(inFight, { units: [] }), /fight has no units/],
    [unit(inFight, { hp: 11 }), /fight has an unreadable unit/],
    [unit(inFight, { x: 999 }), /fight has an unreadable unit/],
    [unit(inFight, { status: 'asleep' }), /fight has an unreadable unit/],
    [unit(inFight, { id: 'e1' }), /fight has an unreadable unit/],
    [battle(inFight, { round: 0 }), /fight has an unreadable turn/],
    [battle(inFight, { side: 'both' }), /fight has an unreadable turn/],
    [battle(inFight, { doors: [3] }), /fight has unreadable doors/],
    [battle(inFight, { misses: { crew: -1, enemy: 0 } }), /fight has unreadable misses/],
    [battle(inFight, { options: {} }), /fight has unreadable options/],
    [battle(inFight, { winner: 'nobody' }), /fight has an unreadable winner/],
    [map(inFight, { width: 0 }), /fight has an unreadable map/],
    [map(inFight, { tiles: { ...inFight.fight.battle.map.tiles, cells: [] } }), /fight has an unreadable map/],
    [map(inFight, { walls: { n: inFight.fight.battle.map.walls.n } }), /fight has an unreadable map/],
    [map(inFight, { hatches: [{ uid: 8, x: 0, y: 0, side: 'up' }] }), /fight has an unreadable map/],
  ];
  for (const [value, expected] of cases) {
    const problems = campaignProblems(value);
    assert.ok(problems.some((p) => expected.test(p)), `${expected}: got ${JSON.stringify(problems)}`);
  }
});
