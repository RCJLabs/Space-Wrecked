// M61: the colony's own events. A day at home may bring one, at
// balance.colonyEventChance in 100, drawn fresh-first, a background's own
// only on its campaign; a companion's beat, the first step of their loyalty
// quest, comes ahead of any rolled; the next day waits until it is decided;
// its effects are the colony's. Save v51 and the validator's refusals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { chooseAtColony, colonyEventHere, COLONY_EFFECTS, COLONY_NEEDS, dayEvent } from '../src/sim/colonyEvents.js';
import { joinCompanion } from '../src/sim/companions.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { withPlaces } from '../src/sim/expeditions.js';
import { reduce } from '../src/sim/root.js';
import { readData } from '../tools/data.js';
import { validateData } from '../tools/validate-data.js';
import { rules } from './battleKit.js';
import { calm, heard, settled } from './colonyKit.js';

const always = { ...rules, balance: { ...rules.balance, colonyEventChance: 100 } };
const colonyEvents = [...rules.events.values()].filter((event) => event.kind === 'colony');
const opened = (campaign, id) => ({ ...campaign, colony: { ...campaign.colony, event: { id, quest: null } } });

test("the content: 10 for any colony, 2 for each background's and 4 companions' beats, choosing only what a colony can need and do", () => {
  assert.equal(rules.balance.colonyEventChance, 20);
  assert.equal(colonyEvents.filter((event) => !event.background && !event.quest).length, 10);
  for (const background of rules.backgrounds.keys()) assert.equal(colonyEvents.filter((event) => event.background === background).length, 2, background);
  assert.deepEqual(colonyEvents.filter((event) => event.quest).map((event) => event.quest).sort(), ['brandt-loyal', 'halloran-loyal', 'osei-loyal', 'varga-loyal']);
  for (const event of colonyEvents) {
    assert.ok(event.choices.some((choice) => !choice.needs), `${event.id}: a choice anyone can make`);
    for (const choice of event.choices) {
      for (const key of Object.keys(choice.needs ?? {})) assert.ok(COLONY_NEEDS.includes(key), `${event.id} ${choice.id} needs ${key}`);
      for (const { effects } of choice.outcomes) for (const key of Object.keys(effects)) assert.ok(COLONY_EFFECTS.includes(key), `${event.id} ${choice.id} does ${key}`);
    }
  }
  // Each loyalty quest's beat comes before its place.
  for (const companion of rules.companions.values()) {
    const steps = rules.quests.get(companion.loyalty).steps;
    assert.deepEqual(steps.map((step) => (step.event ? 'event' : 'place')), ['event', 'place'], companion.id);
  }
});

test("a day rolls for one at the day's chance, of the colony's kind and the campaign's background, the roll the campaign's", () => {
  const home = settled();
  const day = nextDay(home, always);
  assert.equal(day.ok, true, day.error);
  const open = colonyEventHere(day.campaign, always);
  assert.ok(open, 'one at 100 in 100');
  assert.equal(open.quest, null);
  assert.equal(open.event.kind, 'colony');
  assert.ok(!open.event.background || open.event.background === home.background);
  assert.notDeepEqual(day.campaign.rng, nextDay(home, calm).campaign.rng, 'the roll moves the campaign on');
  assert.equal(nextDay(home, calm).campaign.colony.event, null, 'none at 0 in 100');
  assert.deepEqual(nextDay(home, always).campaign, day.campaign, 'the same day again');
  assert.deepEqual(campaignProblems(day.campaign), []);
  // Over the days, the fresh ones first: no event twice before every one
  // the campaign could meet has come.
  let now = home;
  const met = [];
  const pool = colonyEvents.filter((event) => !event.quest && (!event.background || event.background === home.background)).length;
  for (let n = 0; n < pool; n++) {
    now = dayEvent({ ...now, colony: { ...now.colony, event: null } }, always);
    met.push(now.colony.event.id);
    now = chooseAtColony(now, always, rules.events.get(now.colony.event.id).choices.find((choice) => !choice.needs).id).campaign;
  }
  assert.equal(new Set(met).size, pool);
});

test('none while one is open, the ship is out on a trip, or flown out on a voyage', () => {
  const home = opened(settled(), 'tremor');
  assert.equal(dayEvent(home, always), home);
  const away = { ...settled(), colony: { ...settled().colony, trip: { place: 0 } } };
  assert.equal(dayEvent(away, always), away);
  const out = { ...settled(), colony: { ...settled().colony, voyage: { at: 1 } } };
  assert.equal(dayEvent(out, always), out);
});

test('the next day waits until it is decided; decided, the result shows until the day after', () => {
  const home = opened(settled(), 'tremor');
  assert.deepEqual(dayPlan(home, rules), { ok: false, error: 'Decide first: Tremor.' });
  assert.equal(nextDay(home, rules).ok, false);
  assert.equal(chooseAtColony(home, rules, 'nope').ok, false);
  // Shoring up the walls: 5 materials, no roll with one outcome.
  const made = chooseAtColony(home, rules, 'shore');
  assert.equal(made.ok, true, made.error);
  assert.deepEqual([made.result.event, made.result.choice, made.result.roll, made.result.changes.materials], ['tremor', 'shore', null, -5]);
  const after = made.campaign;
  assert.equal(after.colony.materials, home.colony.materials - 5);
  assert.deepEqual([after.colony.event, after.colony.eventResult], [null, made.result]);
  assert.ok(after.eventsMet.includes('tremor'));
  assert.deepEqual([after.flags.colonyEvents, after.flags.eventMaterialsLost], [1, 5]);
  assert.deepEqual(campaignProblems(after), []);
  assert.equal(nextDay(after, calm).campaign.colony.eventResult, null, 'gone the next day');
  // A choice that needs a job someone at home has: the engineer looks.
  assert.ok(home.crew.some((member) => member.job === 'engineer'));
  const looked = chooseAtColony(home, rules, 'engineer');
  assert.equal(looked.ok, true, looked.error);
  assert.equal(looked.result.taker, home.crew.find((member) => member.job === 'engineer').id);
  // The root reducer takes it as an action.
  const state = { campaign: home };
  assert.equal(reduce(state, { type: 'campaign/colony/choose', choice: 'shore', rules }).campaign.colony.materials, after.colony.materials);
});

test("a wound falls on someone at home; supplies come out of the colony's food", () => {
  const home = opened(settled(), 'fever-wing');
  const boiled = chooseAtColony(home, rules, 'boil').campaign;
  assert.equal(boiled.supplies, home.supplies - 4);
  const worked = chooseAtColony(home, rules, 'work');
  assert.equal(worked.ok, true, worked.error);
  const hurt = worked.result.changes.wounds;
  if (worked.result.outcome === 0) assert.equal(hurt.length, home.crew.length, 'it goes through everyone');
  else assert.deepEqual(hurt, []);
});

test("a companion's beat comes the day after they sign on, at any chance; any choice does it, and their place is listed only then", () => {
  const joined = joinCompanion(settled(), rules, 'varga').campaign;
  assert.deepEqual(joined.quests['varga-loyal'], { step: 0, state: 'open' });
  assert.equal(withPlaces(joined, rules).colony.places.find((p) => p.quest === 'varga-loyal'), undefined, 'not yet');
  const day = nextDay(joined, calm);
  assert.deepEqual(day.campaign.colony.event, { id: 'tender-count', quest: 'varga-loyal' });
  const made = chooseAtColony(day.campaign, calm, 'watch');
  assert.equal(made.ok, true, made.error);
  assert.deepEqual(made.campaign.quests['varga-loyal'], { step: 1, state: 'open' });
  assert.ok(made.note, "the quest's next words");
  assert.ok(withPlaces(made.campaign, rules).colony.places.some((p) => p.quest === 'varga-loyal'), 'their place, now');
  // A list rolled before the beat takes the place on once it is heard.
  const listed = withPlaces(day.campaign, calm);
  assert.ok(listed.colony.places.length > 0 && !listed.colony.places.some((p) => p.quest));
  assert.ok(chooseAtColony(listed, calm, 'hear').campaign.colony.places.some((p) => p.quest === 'varga-loyal'), 'on the list already rolled');
  assert.deepEqual(heard(joined).quests['varga-loyal'], { step: 1, state: 'open' }, "the tests' kit hears it the same way");
  // Heard, no beat comes again.
  assert.equal(nextDay(made.campaign, calm).campaign.colony.event, null);
});

test('save v51: no colony has an event; a loyalty quest moves on past its new beat', () => {
  assert.equal(SAVE_VERSION, 53);
  const step = MIGRATIONS.find((m) => m.from === 50);
  const home = settled();
  const { event, eventResult, ...before } = home.colony;
  const other = { ...before, id: 2 };
  const old = { campaign: { ...home, colony: before, colonies: [other], quests: { 'varga-loyal': { step: 0, state: 'open' }, debt: { step: 1, state: 'open' } } } };
  const moved = step.up(old).campaign;
  assert.deepEqual([moved.colony.event, moved.colony.eventResult, moved.colonies[0].event, moved.colonies[0].eventResult], [null, null, null, null]);
  assert.deepEqual(moved.quests, { 'varga-loyal': { step: 1, state: 'open' }, debt: { step: 1, state: 'open' } });
  // A save before act 3, or with no campaign, is as it was.
  const { colony, ...run } = home;
  assert.deepEqual(step.up({ campaign: run }).campaign, run);
  assert.deepEqual(step.up({ campaign: null }), { campaign: null });
});

test("the validator refuses a colony event that ambushes, a beat that isn't the colony's kind, and a chance out of range", () => {
  const problems = (change) => {
    const data = structuredClone(readData());
    change(data);
    return validateData(data).join('\n');
  };
  assert.match(problems((data) => {
    data.events.events.find((e) => e.id === 'tremor').choices[0].outcomes[0].effects = { ambush: 'scavengers' };
  }), /tremor/);
  assert.match(problems((data) => {
    data.events.events.find((e) => e.id === 'tender-count').kind = 'hulk';
  }), /must be of kind colony/);
  assert.match(problems((data) => {
    data.balance.colonyEventChance = 120;
  }), /colonyEventChance/);
});
