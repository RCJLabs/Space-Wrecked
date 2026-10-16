// The ?dev=1 menu's tools in the simulation: God mode (src/sim/god.js) in a
// fight and in an approach, and the cheats (src/sim/dev.js), each leaving a
// save that reads back.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { openingVolley, playRound } from '../src/sim/approach.js';
import { act, createBattle } from '../src/sim/battle.js';
import { campaignProblems, maxHp, newCampaign, partsNeeded } from '../src/sim/campaign.js';
import { storesOf } from '../src/sim/colony.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { cheat } from '../src/sim/dev.js';
import { withPlaces } from '../src/sim/expeditions.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launch } from '../src/sim/launch.js';
import { eased, questJobs } from '../src/sim/quests.js';
import { rankOf } from '../src/sim/ranks.js';
import { initialState, reduce } from '../src/sim/root.js';
import { STANDING_MAX, STANDING_MIN } from '../src/sim/standing.js';
import { beginRun, supplyCapacity } from '../src/sim/travel.js';
import { launchedShip } from '../tools/approach.js';
import { openMap, rules, wreck } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const b = rules.balance;
const god = { ...rules, dev: { god: true } };
const who = (battle, id) => battle.units.find((u) => u.id === id);
const start = () => withBoard(newCampaign(rules, 5), rules);
const readable = (result) => {
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(campaignProblems(result.campaign), []);
  return result.campaign;
};

// A marine in a fire and a medic in vacuum, the pirate shooting at them in
// turn, each with hit points enough to stand every round; the marine shoots
// back once. The same actions, under rules r: { battle, events }.
function siege(r) {
  const map = wreck(wreck(openMap(6, 3), 0, 0, 'fire'), 0, 2, 'vacuum');
  const tough = { hp: 500 };
  let { battle, events } = createBattle({ map, seed: 7, units: [{ kind: 'marine', x: 0, y: 0, bonus: tough }, { kind: 'medic', x: 0, y: 2, bonus: tough }, { kind: 'pirate', x: 5, y: 1, bonus: tough }] }, r);
  const play = (action) => {
    const result = act(battle, action, r);
    assert.equal(result.ok, true, `${JSON.stringify(action)}: ${result.error}`);
    battle = result.battle;
    events = [...events, ...result.events];
  };
  play({ type: 'shoot', unit: 'c1', target: 'e1' });
  play({ type: 'end' });
  for (let round = 0; round < b.suitAir + 3; round++) {
    if (who(battle, 'e1').ammo) play({ type: 'shoot', unit: 'e1', target: round % 2 ? 'c2' : 'c1' });
    else {
      play({ type: 'reload', unit: 'e1' });
      play({ type: 'end' });
    }
    play({ type: 'end' });
  }
  return { battle, events };
}

test('God mode in a fight: a hit on the crew does nothing, nor fire or vacuum; the enemy is hurt as ever, and every roll is the same', () => {
  const plain = siege(rules);
  const spared = siege(god);
  const shots = (run) => run.events.filter((e) => e.type === 'shot');
  const rolls = (run) => shots(run).map((e) => [e.unit, e.target, e.roll, e.hit, e.critRoll ?? null]);
  assert.deepEqual(rolls(spared), rolls(plain), 'the same shots, rolled the same');
  assert.equal(spared.battle.rng, plain.battle.rng, 'and no roll more or less');
  const onCrew = (run) => shots(run).filter((e) => e.hit && e.target.startsWith('c'));
  assert.ok(onCrew(plain).length >= 2, 'the pirate hits the crew more than once');
  assert.ok(onCrew(plain).every((e) => e.damage >= 1));
  assert.ok(onCrew(spared).every((e) => e.damage === 0));
  for (const id of ['c1', 'c2']) {
    assert.ok(who(plain.battle, id).hp < who(plain.battle, id).maxHp, id);
    assert.equal(who(spared.battle, id).hp, who(spared.battle, id).maxHp, id);
  }
  const hazards = (run) => run.events.filter((e) => e.type === 'hazard').map((e) => `${e.unit} ${e.hazard}`);
  assert.ok(hazards(plain).includes('c1 fire') && hazards(plain).includes('c2 vacuum'));
  assert.deepEqual(hazards(spared), []);
  assert.ok(spared.events.some((e) => e.type === 'air' && e.unit === 'c2'), 'suits still use air');
  // The marine's shot at the pirate hurts him all the same.
  assert.equal(who(spared.battle, 'e1').hp, who(plain.battle, 'e1').hp);
});

test('God mode in an approach: their hits on the ship are taken whole, and nothing on her is damaged or wrecked', () => {
  const cutter = generateShip(rules, 'cutter', 1);
  const side = (ship) => ({ ship, damage: {}, wrecked: {} });
  const state = { you: side(launchedShip(rules)), them: side(cutter.ship), round: 1, tactics: rules.ships.get('cutter').tactics };
  const theirHits = (played) => played.events.filter((e) => e.kind === 'volley' && e.side === 'them').flatMap((e) => e.shots.filter((s) => s.hit));
  let seed = 0;
  while (seed < 5000 && !theirHits(playRound(state, { kind: 'evade' }, seedFrom(seed), rules)).some((s) => s.damage > 0)) seed += 1;
  const plain = playRound(state, { kind: 'evade' }, seedFrom(seed), rules);
  const spared = playRound(state, { kind: 'evade' }, seedFrom(seed), god);
  assert.ok(Object.keys(plain.you.damage).length > 0, 'without it, the ship is hit');
  assert.deepEqual([spared.you.damage, spared.you.wrecked], [{}, {}]);
  assert.ok(theirHits(spared).length > 0);
  assert.ok(theirHits(spared).every((s) => s.damage === 0 && s.module === null && s.wreck === null && s.absorbed > 0));
  // The opening volley, likewise.
  const opening = openingVolley(state, seedFrom(1), god);
  assert.deepEqual([opening.you.damage, opening.you.wrecked], [{}, {}]);
});

test('cheats: credits and heat move within their bounds, and a bad cheat is refused', () => {
  const campaign = start();
  assert.equal(readable(cheat(campaign, rules, { kind: 'credits', by: 1000 })).credits, campaign.credits + 1000);
  assert.equal(readable(cheat({ ...campaign, credits: 50 }, rules, { kind: 'credits', by: -100 })).credits, 0);
  assert.match(cheat({ ...campaign, credits: 0 }, rules, { kind: 'credits', by: -100 }).error, /no credits/);
  assert.equal(readable(cheat({ ...campaign, heat: 10 }, rules, { kind: 'heat', by: 25 })).heat, 35);
  assert.equal(readable(cheat({ ...campaign, heat: 90 }, rules, { kind: 'heat', by: 25 })).heat, 100);
  assert.equal(readable(cheat({ ...campaign, heat: 10 }, rules, { kind: 'heat', by: -25 })).heat, 0);
  assert.match(cheat({ ...campaign, heat: 0 }, rules, { kind: 'heat', by: -25 }).error, /Heat is at 0/);
  assert.match(cheat(campaign, rules, { kind: 'wish' }).error, /unknown/);
  for (const by of [0, 1.5, '10', undefined]) assert.equal(cheat(campaign, rules, { kind: 'credits', by }).ok, false, `${by}`);
});

test('cheats: the crew healed and ranked up, all of them, but not in a fight', () => {
  const campaign = start();
  const hurt = { ...campaign, crew: campaign.crew.map((member, i) => (i === 0 ? { ...member, hp: 1 } : member)) };
  const healed = readable(cheat(hurt, rules, { kind: 'heal' }));
  assert.ok(healed.crew.every((member) => member.hp === maxHp(member, rules)));
  assert.match(cheat(healed, rules, { kind: 'heal' }).error, /full health/);
  let ranked = campaign;
  for (const rank of [1, 2]) {
    ranked = readable(cheat(ranked, rules, { kind: 'rank' }));
    assert.ok(ranked.crew.every((member) => rankOf(member, rules) === rank), `rank ${rank}`);
  }
  assert.match(cheat(ranked, rules, { kind: 'rank' }).error, /last rank/);
  const fighting = takeJob(hurt, rules, 0).campaign;
  for (const kind of ['heal', 'rank', 'quest']) assert.match(cheat(fighting, rules, { kind }).error, /Not in a fight/, kind);
});

test("cheats: the parts the ship's checks ask for, on hand, once", () => {
  const campaign = start();
  const needed = partsNeeded(campaign, rules);
  assert.ok(Object.keys(needed).length > 0, 'the start ship needs parts');
  const stocked = readable(cheat(campaign, rules, { kind: 'parts' }));
  for (const [type, count] of Object.entries(needed)) assert.ok(stocked.parts[type] >= count, type);
  assert.match(cheat(stocked, rules, { kind: 'parts' }).error, /every part/);
});

test('cheats: the holds filled on the run and the stores at the colony; nothing to fill in act 1', () => {
  assert.match(cheat(start(), rules, { kind: 'fill' }).error, /as the run begins/);
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  assert.match(cheat(run, rules, { kind: 'fill' }).error, /holds are full/);
  const filled = readable(cheat({ ...run, supplies: 0 }, rules, { kind: 'fill' }));
  assert.equal(filled.supplies, supplyCapacity(run.ship, rules, run.crew));
  const colony = settled();
  const empty = { ...colony, supplies: 0, colony: { ...colony.colony, materials: 0 } };
  const stocked = readable(cheat(empty, rules, { kind: 'fill' }));
  const { total } = storesOf(empty, rules);
  assert.deepEqual([stocked.supplies, stocked.colony.materials], [total, total]);
  assert.match(cheat(stocked, rules, { kind: 'fill' }).error, /stores are full/);
});

test('cheats: standing with every side moved, within its bounds', () => {
  const campaign = start();
  const up = readable(cheat(campaign, rules, { kind: 'standing', by: 5 }));
  for (const side of rules.factions.sides.keys()) assert.equal(up.standing[side], Math.min(STANDING_MAX, (campaign.standing[side] ?? 0) + 5), side);
  const top = { ...campaign, standing: Object.fromEntries([...rules.factions.sides.keys()].map((side) => [side, STANDING_MAX])) };
  assert.match(cheat(top, rules, { kind: 'standing', by: 5 }).error, /at its best/);
  const down = readable(cheat(top, rules, { kind: 'standing', by: -30 }));
  assert.ok(Object.values(down.standing).every((value) => value === STANDING_MIN));
});

test("cheats: a quest's step open in this act done, as if played; its place comes off the colony's list", () => {
  const campaign = { ...start(), heat: 40 };
  const done = readable(cheat(campaign, rules, { kind: 'quest' }));
  assert.deepEqual(done.quests, { debt: { step: 1, state: 'open' } });
  assert.equal(done.heat, 20, "the step's heat -20");
  assert.deepEqual(questJobs(done, rules), [], 'its job is no longer offered');
  assert.match(cheat(done, rules, { kind: 'quest' }).error, /No quest has a step open in this act/, "the run's step waits for the run");
  // At the colony, with the thread's last step open and its place listed.
  const colony = withPlaces(settled(), rules);
  const atPlace = withPlaces({ ...colony, quests: { debt: { step: 2, state: 'open' } }, colony: { ...colony.colony, places: [] } }, rules);
  assert.ok(atPlace.colony.places.some((place) => place.quest === 'debt'));
  const paid = readable(cheat(atPlace, rules, { kind: 'quest' }));
  assert.deepEqual(paid.quests.debt, { step: 2, state: 'done' });
  assert.ok(eased(paid, rules), 'its pay-off had');
  assert.ok(!paid.colony.places.some((place) => place.quest), 'its place is gone from the list');
});

test('cheats: Win ends the fight on with every enemy dead, and its end pays as for any win', () => {
  const campaign = start();
  assert.match(cheat(campaign, rules, { kind: 'win' }).error, /No fight/);
  const taken = takeJob(campaign, rules, 0).campaign;
  const won = readable(cheat(taken, rules, { kind: 'win' }));
  const { battle, log } = won.fight;
  assert.equal(battle.winner, 'crew');
  assert.ok(battle.units.filter((u) => u.side === 'enemy').every((u) => u.status === 'dead' && u.hp === 0));
  assert.deepEqual(battle.units.filter((u) => u.side === 'crew'), taken.fight.battle.units.filter((u) => u.side === 'crew'), 'the crew as it stood');
  assert.deepEqual(log.slice(taken.fight.log.length).map((e) => e.type), [...battle.units.filter((u) => u.side === 'enemy').map(() => 'dead'), 'over']);
  assert.match(cheat(won, rules, { kind: 'win' }).error, /over/);
  const ended = endJob(won, rules);
  assert.equal(ended.flags.jobsDone, 1);
  assert.ok(ended.credits > campaign.credits, 'paid');
  assert.deepEqual(campaignProblems(ended), []);
});

test('the dev/cheat action plays a cheat on the campaign, and leaves the state as it was when one is refused', () => {
  const state = { ...initialState(1), screen: 'hub', campaign: start() };
  const richer = reduce(state, { type: 'dev/cheat', cheat: { kind: 'credits', by: 100 }, rules });
  assert.equal(richer.campaign.credits, state.campaign.credits + 100);
  assert.equal(richer.screen, 'hub');
  assert.equal(reduce(state, { type: 'dev/cheat', cheat: { kind: 'win' }, rules }), state);
  const none = initialState(1);
  assert.equal(reduce(none, { type: 'dev/cheat', cheat: { kind: 'credits', by: 100 }, rules }), none);
});
