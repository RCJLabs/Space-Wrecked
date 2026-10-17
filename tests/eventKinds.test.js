// M36: what an event can need and do since M36. A choice can need someone
// of a job or with a trait; an event can be a background's own; an outcome
// can spring a trap, or wreck or repair the ship; and an event once met
// comes again only once its kind has no others left. These tests add events
// of their own to the content, so they hold whatever data/events.json says.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/save.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { closeApproach, giveOrder } from '../src/sim/encounter.js';
import { eventsOf, freshest } from '../src/sim/eventPool.js';
import { applyEffects, choiceProblem, chooseEvent, takerOf, whoNeeded } from '../src/sim/events.js';
import { chooseAtPlace, flyOut, placeFightDue, rollPlaces, tripHere } from '../src/sim/expeditions.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { launch } from '../src/sim/launch.js';
import { hasTag } from '../src/sim/modules.js';
import { wrecksToRepair } from '../src/sim/repair.js';
import { initialState, reduce } from '../src/sim/root.js';
import { beginRun } from '../src/sim/travel.js';
import { checkEvents } from '../tools/validate-events.js';
import { rules as content } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const choice = (id, needs, ...outcomes) => ({ id, label: id, ...(needs ? { needs } : {}), outcomes: outcomes.map(([chance, effects]) => ({ chance, text: `${id}.`, effects })) });
const leave = choice('leave', null, [100, {}]);
const EVENTS = [
  { id: 't-engineer', kind: 'derelict', title: 'Rig it', text: 'A test.', choices: [choice('rig', { job: 'engineer' }, [100, { wound: { hp: 2 }, credits: 5 }]), leave] },
  { id: 't-trait', kind: 'derelict', title: 'Dare', text: 'A test.', choices: [choice('dare', { trait: 'hothead' }, [100, { credits: 5 }]), leave] },
  { id: 't-trap', kind: 'distress', title: 'Bait', text: 'A test.', choices: [choice('answer', null, [100, { ambush: 'cutter' }]), leave] },
  { id: 't-wreck', kind: 'hazard', title: 'Squall', text: 'A test.', choices: [choice('ride', null, [100, { wreck: 2 }]), leave] },
  { id: 't-deserter', kind: 'derelict', background: 'deserter', title: 'Old shipmates', text: 'A test.', choices: [leave] },
  { id: 't-hulk-trap', kind: 'hulk', title: 'Waiting', text: 'A test.', choices: [choice('search', { job: 'medic' }, [100, { ambush: true, supplies: 2 }]), leave] },
];
const rules = { ...content, events: new Map([...content.events, ...EVENTS.map((event) => [event.id, event])]) };
const choiceOf = (event, id) => rules.events.get(event).choices.find((entry) => entry.id === id);

const onRun = () => beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
// On the run at node `id`, with event `eventId` open there.
function atEvent(eventId, campaign = onRun(), id = 1) {
  const type = rules.events.get(eventId).kind;
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === id ? { ...node, type, event: eventId, hostile: undefined } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: id, seen: [...new Set([...campaign.run.seen, id])] } };
}
// The settled colony with these places listed.
const listing = (campaign, places) => ({ ...campaign, colony: { ...campaign.colony, places } });

test('a choice can need someone: anyone aboard on the run, the first in the crew takes it, and a wound on one falls on them', () => {
  const there = atEvent('t-engineer');
  const engineer = there.crew.find((member) => member.job === 'engineer');
  const rig = choiceOf('t-engineer', 'rig');
  assert.equal(takerOf(there, rig).id, engineer.id);
  assert.equal(choiceProblem(there, rig, rules), null);
  const done = chooseEvent(there, rules, 'rig');
  assert.ok(done.ok, done.error);
  assert.equal(done.result.taker, engineer.id);
  assert.deepEqual(done.result.changes.wounds, [{ id: engineer.id, hp: 2 }], 'the wound is theirs, not a roll');
  assert.deepEqual(campaignProblems(done.campaign), []);
  // With no engineer aboard, it can't be taken, and says who it needs.
  const none = { ...there, crew: there.crew.filter((member) => member.job !== 'engineer') };
  assert.equal(choiceProblem(none, rig, rules), 'Needs an Engineer aboard.');
  assert.equal(chooseEvent(none, rules, 'rig').error, 'Needs an Engineer aboard.');
  // A trait: no one has it, then someone does.
  const dare = choiceOf('t-trait', 'dare');
  assert.equal(choiceProblem(there, dare, rules), 'Needs someone with the Hothead trait aboard.');
  const hot = { ...there, crew: there.crew.map((member) => (member.job === 'medic' ? { ...member, traits: ['hothead'] } : member)) };
  assert.equal(takerOf(hot, dare).job, 'medic');
  assert.equal(choiceProblem(hot, dare, rules), null);
  assert.equal(whoNeeded({ job: 'medic', trait: 'careful' }, rules), 'a Medic with the Careful trait');
  // A taker at 1 hit point takes no wound: it falls by a roll, as before.
  const worn = { ...there, crew: there.crew.map((member) => (member.id === engineer.id ? { ...member, hp: 1 } : member)) };
  const rolled = chooseEvent(worn, rules, 'rig').result.changes.wounds;
  assert.equal(rolled.length, 1);
  assert.notEqual(rolled[0].id, engineer.id);
});

test("a background's own events come only on its runs", () => {
  assert.ok(!eventsOf(rules, 'derelict', 'miner').includes('t-deserter'));
  assert.ok(eventsOf(rules, 'derelict', 'deserter').includes('t-deserter'));
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const held = (background) => generateSector(rules, seed, 1, { background }).nodes.map((node) => node.event).filter(Boolean);
    assert.ok(!held('miner').includes('t-deserter'), `seed ${seed}`);
    if (held('deserter').includes('t-deserter')) seen += 1;
  }
  assert.ok(seen > 0, 'a deserter meets it');
});

test('an event met comes again only once its kind has no others left, in a sector and at the places', () => {
  const ids = eventsOf(rules, 'hazard', 'miner');
  assert.ok(ids.length >= 3);
  assert.deepEqual(freshest(ids, [ids[0]]), ids.slice(1));
  assert.deepEqual(freshest(ids, [], ids.slice(0, 2)), ids.slice(2), 'none drawn there already');
  assert.deepEqual(freshest(ids, ids.slice(1), [ids[0]]), ids.slice(1), 'met, rather than twice in one place');
  assert.deepEqual(freshest(ids, ids), ids, 'all met: any');
  // Every hazard but the first met: a sector's first hazard holds it.
  for (let seed = 1; seed <= 30; seed++) {
    const hazards = generateSector(rules, seed, 2, { met: ids.slice(1) }).nodes.filter((node) => node.type === 'hazard');
    if (hazards.length) assert.equal(hazards[0].event, ids[0], `seed ${seed}`);
    assert.equal(new Set(hazards.map((node) => node.event)).size, Math.min(hazards.length, ids.length), `seed ${seed}: none twice while they last`);
  }
  // Settling an event counts it met, once.
  const done = chooseEvent(atEvent('t-wreck'), rules, 'leave').campaign;
  assert.deepEqual(done.eventsMet, ['t-wreck']);
  // The places: none shares an event while the kind has others, and those
  // met come last.
  const colony = settled();
  const rocks = eventsOf(rules, 'rock', colony.background);
  for (let rng = 1; rng <= 30; rng++) {
    const { places } = rollPlaces({ ...colony, rng, eventsMet: rocks.slice(1) }, rules);
    const atRocks = places.filter((place) => place.kind === 'rock' && place.event);
    if (atRocks.length) assert.equal(atRocks[0].event, rocks[0], `rng ${rng}`);
    for (const kind of new Set(places.map((place) => place.kind))) {
      const events = places.filter((place) => place.kind === kind && place.event).map((place) => place.event);
      assert.equal(new Set(events).size, Math.min(events.length, eventsOf(rules, kind, colony.background).length), `rng ${rng}: no ${kind} shares one while there are others`);
    }
  }
});

test('a trap on the run: the ship named comes out firing, the screen goes to her approach, and it plays out and saves', () => {
  const there = atEvent('t-trap');
  const sprung = chooseEvent(there, rules, 'answer');
  assert.ok(sprung.ok, sprung.error);
  const { approach } = sprung.campaign.run;
  assert.equal(approach.enemy.ship, 'cutter');
  assert.equal(approach.hunt, false);
  assert.equal(approach.patrol, null);
  assert.deepEqual(approach.ambush, { event: 't-trap', choice: 'answer', outcome: 0 });
  assert.equal(approach.round, 1);
  assert.ok(approach.last === null || approach.last.order === null, 'the opening volley is hers, before any order');
  assert.deepEqual(sprung.campaign.run.done, [there.run.at], 'the event settled the node');
  assert.equal(sprung.result.changes.ambush, 'cutter');
  assert.equal(sprung.campaign.flags.ambushes, 1);
  assert.deepEqual(campaignProblems(sprung.campaign), []);
  // By the action, the screen goes to the approach.
  const state = reduce({ ...initialState(1), screen: 'sector', campaign: there }, { type: 'campaign/event/choose', rules, choice: 'answer' });
  assert.equal(state.screen, 'approach');
  // Played out and put away: the node is settled once.
  let at = sprung.campaign;
  while (!at.run.approach.outcome) at = giveOrder(at, rules, { kind: 'flee' }).campaign;
  assert.deepEqual(at.run.done, [there.run.at]);
  assert.deepEqual(campaignProblems(at), []);
  const closed = closeApproach(at);
  if (closed.ok) assert.equal(closed.campaign.run.approach, null);
});

test("a trap at a hulk: the scavengers were waiting, the place is held and the squad's fight is due; a choice there needs its someone in the squad", () => {
  const colony = settled();
  const place = { kind: 'hulk', name: 'Long Haul', days: 1, event: 't-hulk-trap', held: false, seed: 7 };
  const medic = colony.crew.find((member) => member.job === 'medic');
  const marine = colony.crew.find((member) => member.job === 'marine');
  // Without the medic in the squad, the search waits.
  const alone = flyOut(listing(colony, [place]), rules, 0, [marine.id]).campaign;
  assert.equal(tripHere(alone, rules).event.id, 't-hulk-trap');
  assert.equal(chooseAtPlace(alone, rules, 'search').error, 'Needs a Medic in the squad.');
  // With her, it springs.
  const out = flyOut(listing(colony, [place]), rules, 0, [marine.id, medic.id]).campaign;
  const sprung = chooseAtPlace(out, rules, 'search');
  assert.ok(sprung.ok, sprung.error);
  const { trip } = sprung.campaign.colony;
  assert.equal(trip.place.held, true);
  assert.equal(trip.place.event, null);
  assert.equal(trip.done, false);
  assert.equal(trip.result.changes.ambush, true);
  assert.equal(trip.result.taker, medic.id);
  assert.deepEqual(sprung.campaign.eventsMet, ['t-hulk-trap']);
  assert.equal(sprung.campaign.flags.placeAmbushes, 1);
  assert.ok(placeFightDue(sprung.campaign, rules), 'the fight is due');
  assert.equal(tripHere(sprung.campaign, rules).held, true);
  assert.deepEqual(campaignProblems(sprung.campaign), []);
});

test('wrecks by roll among what a volley can hit, the reactor and engine got going again; repairs the dearest first', () => {
  const run = onRun();
  const hittable = (type) => ['weapon', 'pointdefense', 'engine', 'shield', 'reactor'].some((tag) => hasTag(rules.modules.get(type), tag));
  const hit = applyEffects(run, rules, { wreck: 2 });
  const { wrecked, rigged } = hit.changes;
  assert.ok(wrecked.length >= 1 && wrecked.length <= 2);
  for (const part of wrecked) {
    assert.ok(hittable(part.type), `${part.type} is one a volley could hit`);
    assert.equal(hit.campaign.wrecks[part.uid], part.wreck);
  }
  assert.ok(Array.isArray(rigged));
  for (const tag of ['reactor', 'engine']) {
    const ofTag = run.ship.modules.filter((module) => hasTag(rules.modules.get(module.type), tag));
    if (ofTag.length) assert.ok(ofTag.some((module) => !(module.uid in hit.campaign.wrecks)), `a ${tag} still works`);
  }
  assert.deepEqual(campaignProblems(hit.campaign), []);
  // Everything a volley could hit, wrecked: nothing more to wreck.
  const everything = Object.fromEntries(run.ship.modules.filter((module) => hittable(module.type)).map((module) => [module.uid, 'fire']));
  assert.deepEqual(applyEffects({ ...run, wrecks: everything }, rules, { wreck: 1 }).changes.wrecked, []);
  // Repairs: of two wrecks, the dearer goes first.
  const two = Object.fromEntries(run.ship.modules.filter((module) => hittable(module.type)).slice(0, 2).map((module) => [module.uid, 'rubble']));
  const priced = wrecksToRepair({ ...run, wrecks: two }, rules);
  const dearest = [...priced].sort((a, b) => b.price - a.price || a.uid - b.uid)[0];
  const fixed = applyEffects({ ...run, wrecks: two }, rules, { repair: 1 });
  assert.deepEqual(fixed.changes.repaired, [{ uid: dearest.uid, type: dearest.type }]);
  assert.equal(Object.keys(fixed.campaign.wrecks).length, 1);
  assert.deepEqual(applyEffects(run, rules, { repair: 2 }).changes.repaired, [], 'nothing to repair');
});

test('a v30 save keeps its campaign with no events met; a broken list is caught', () => {
  const step = MIGRATIONS.find((migration) => migration.from === 30);
  assert.deepEqual(step.up({ settings: {}, campaign: { act: 1 } }), { settings: {}, campaign: { act: 1, eventsMet: [] } });
  assert.deepEqual(step.up({ settings: {}, campaign: null }), { settings: {}, campaign: null });
  const campaign = onRun();
  assert.deepEqual(campaignProblems(campaign), []);
  for (const eventsMet of [['dead-hauler', 'dead-hauler'], [7], 'dead-hauler']) {
    assert.ok(campaignProblems({ ...campaign, eventsMet }).includes("The campaign's events met are unreadable."), JSON.stringify(eventsMet));
  }
});

test('the validator: who a choice needs, a background, traps, wrecks and repairs', () => {
  const more = {
    jobs: new Set(['engineer']),
    traits: new Set(['hothead']),
    backgrounds: new Set(['miner']),
    presets: new Map([['cutter', { tactics: {} }], ['hauler', {}]]),
    held: new Set(['hulk']),
  };
  const problems = (event) => {
    const found = [];
    checkEvents({ drops: { salvage: { corridor: 1 } }, events: [event] }, new Set(['derelict', 'distress']), new Set(['corridor']), (where, why) => found.push(why), new Set(['hulk', 'rock']), new Set(), new Set(), more);
    return found;
  };
  const event = (kind, first, extra = {}) => ({ id: 'e', kind, title: 'T', text: 'T.', ...extra, choices: [first, leave] });
  const good = [
    event('derelict', choice('a', { job: 'engineer' }, [100, { wreck: 1 }])),
    event('derelict', choice('a', { trait: 'hothead' }, [100, { repair: 3 }]), { background: 'miner' }),
    event('distress', choice('a', null, [100, { ambush: 'cutter' }])),
    event('hulk', choice('a', { job: 'engineer' }, [100, { ambush: true, repair: 1 }])),
  ];
  for (const ok of good) assert.deepEqual(problems(ok), [], JSON.stringify(ok.choices[0]));
  const bad = [
    [event('derelict', choice('a', { job: 'pilot' }, [100, {}])), /job "pilot" is not one of jobs/],
    [event('derelict', choice('a', { trait: 'brave' }, [100, {}])), /trait "brave" is not one of traits/],
    [event('derelict', leave, { background: 'priest' }), /background must be/],
    [event('distress', choice('a', null, [100, { ambush: 'hauler' }])), /can fight an approach/],
    [event('distress', choice('a', null, [100, { ambush: true }])), /can fight an approach/],
    [event('rock', choice('a', null, [100, { ambush: true }])), /can't hold a place of kind "rock"/],
    [event('hulk', choice('a', null, [100, { ambush: 'cutter' }])), /must be true/],
    [event('hulk', choice('a', null, [100, { wreck: 1 }])), /wreck/],
    [event('derelict', choice('a', null, [100, { wreck: 4 }])), /wreck must be a whole number from 1 to 3/],
    [event('derelict', choice('a', null, [100, { repair: 0 }])), /repair must be a whole number from 1 to 3/],
  ];
  for (const [wrong, why] of bad) assert.ok(problems(wrong).some((problem) => why.test(problem)), `${JSON.stringify(wrong.choices[0])}: ${problems(wrong).join(' | ')}`);
});

test("the content: 100 events, the run's and the places' kinds as the Done when counts them, every job and 8 traits needed, the traps, wrecks and repairs", () => {
  const all = [...content.events.values()];
  assert.equal(all.length, 100);
  const general = (kind) => all.filter((event) => event.kind === kind && !event.quest && !event.background).length;
  assert.deepEqual(['derelict', 'distress', 'trader', 'hazard'].map(general), [12, 12, 10, 11]);
  for (const background of content.backgrounds.keys()) assert.equal(all.filter((event) => event.background === background).length, 4, background);
  assert.deepEqual(['hulk', 'wreckage', 'rock', 'planet'].map(general), [9, 9, 9, 9]);
  assert.equal(all.filter((event) => event.quest).length, 7);
  const choices = all.flatMap((event) => event.choices.map((one) => ({ event, choice: one })));
  const needed = (key) => new Set(choices.map(({ choice: one }) => one.needs?.[key]).filter(Boolean));
  assert.deepEqual([...needed('job')].sort(), [...content.jobs.keys()].sort(), 'every job');
  assert.ok(needed('trait').size >= 8, `${needed('trait').size} traits`);
  const outcomesOf = (event) => event.choices.flatMap((one) => one.outcomes);
  const places = new Set(['hulk', 'wreckage', 'rock', 'planet']);
  const traps = all.filter((event) => outcomesOf(event).some((outcome) => outcome.effects.ambush));
  assert.ok(traps.filter((event) => !places.has(event.kind)).length >= 6, 'traps on the run');
  assert.ok(traps.filter((event) => event.kind === 'hulk').length >= 2, 'traps at hulks');
  assert.ok(all.filter((event) => outcomesOf(event).some((outcome) => outcome.effects.wreck)).length >= 4, 'events that wreck');
  assert.ok(all.filter((event) => outcomesOf(event).some((outcome) => outcome.effects.repair)).length >= 4, 'events that repair');
});
