// M64: replay across runs. Run modifiers change the start only, burdens open from the
// first game and boons once the record has gone far enough; the week's run
// is made from the week alone; the record across runs is kept as play goes;
// save v53; the validator's refusals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, MIGRATIONS, SAVE_VERSION, validate } from '../src/core/save.js';
import { newCampaign } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { isWeek, modifiersProblem, unlocked, weekKey, weeklyRun, withModifiers } from '../src/sim/modifiers.js';
import { emptyProfile, noteRun, profileProblems, RUNS } from '../src/sim/record.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { readData } from '../tools/data.js';
import { validateData } from '../tools/validate-data.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const mod = (id) => rules.modifiers.get(id);
const start = (background) => newCampaign(rules, 7, { background });

test('the content: three burdens open from the first game, three boons each opened by the record', () => {
  const all = [...rules.modifiers.values()];
  assert.deepEqual(all.filter((def) => def.kind === 'burden').map((def) => def.id), ['wanted', 'skeleton', 'bad-blood']);
  assert.deepEqual(all.filter((def) => def.kind === 'boon').map((def) => [def.id, def.unlock]), [['nest-egg', { act: 2 }], ['spare-crates', { act: 3 }], ['old-friends', { won: true }]]);
  const none = emptyProfile().reached;
  assert.deepEqual(all.filter((def) => unlocked(def, none)).map((def) => def.kind), ['burden', 'burden', 'burden']);
  assert.equal(unlocked(mod('nest-egg'), { act: 2, won: false }), true);
  assert.equal(unlocked(mod('spare-crates'), { act: 2, won: false }), false);
  assert.equal(unlocked(mod('spare-crates'), { act: 3, won: false }), true);
  assert.equal(unlocked(mod('old-friends'), { act: 3, won: false }), false);
  assert.equal(unlocked(mod('old-friends'), { act: 3, won: true }), true);
  assert.equal(modifiersProblem(rules, ['wanted', 'skeleton'], none), null);
  assert.match(modifiersProblem(rules, ['nest-egg'], none), /isn't open yet/);
  assert.match(modifiersProblem(rules, ['wanted', 'wanted'], none), /once/);
  assert.match(modifiersProblem(rules, ['nope'], none), /no modifier/);
});

test('each changes the start: heat, crew (never the captain), standing within its range, credits, parts', () => {
  for (const background of rules.backgrounds.keys()) {
    const base = start(background);
    assert.deepEqual([base.modifiers, base.week], [[], null]);
    assert.equal(withModifiers(base, rules, ['wanted']).heat, 30);
    const skeleton = withModifiers(base, rules, ['skeleton']);
    assert.equal(skeleton.crew.length, base.crew.length - 1);
    assert.ok(skeleton.crew.some((member) => member.id === base.captain), 'the captain stays');
    const bad = withModifiers(base, rules, ['bad-blood']);
    for (const [side, value] of Object.entries(base.standing)) assert.equal(bad.standing[side], Math.max(-10, value - 3), side);
    assert.equal(withModifiers(base, rules, ['nest-egg']).credits, base.credits + 150);
    const crates = withModifiers(base, rules, ['spare-crates']);
    for (const [type, count] of Object.entries(base.parts)) assert.equal(crates.parts[type], count + 1, type);
    const friends = withModifiers(base, rules, ['old-friends']);
    for (const [side, value] of Object.entries(base.standing)) assert.equal(friends.standing[side], Math.min(10, value + 3), side);
    assert.deepEqual(withModifiers(base, rules, ['bad-blood', 'wanted']).modifiers, ['bad-blood', 'wanted']);
  }
});

test("the week's key is the ISO week, worked out from the date alone", () => {
  assert.equal(weekKey(2026, 10, 28), '2026-W44');
  assert.equal(weekKey(2026, 10, 26), '2026-W44', 'Monday starts it');
  assert.equal(weekKey(2026, 11, 1), '2026-W44', 'Sunday ends it');
  assert.equal(weekKey(2026, 11, 2), '2026-W45');
  assert.equal(weekKey(2021, 1, 3), '2020-W53', "early January can be last year's");
  assert.equal(weekKey(2024, 12, 30), '2025-W01', "late December can be next year's");
  assert.equal(weekKey(2027, 1, 1), '2026-W53');
  assert.ok(isWeek('2026-W44') && !isWeek('2026-W54') && !isWeek('2026-44') && !isWeek(null));
});

test("the week's run: the same seed and modifiers all week, a burden first, a different run another week", () => {
  const a = weeklyRun(rules, '2026-W44');
  assert.deepEqual(weeklyRun(rules, '2026-W44'), a);
  assert.equal(a.modifiers.length, 2);
  assert.ok(a.modifiers.some((id) => mod(id).kind === 'burden'));
  const weeks = Array.from({ length: 52 }, (_, i) => weeklyRun(rules, `2026-W${String(i + 1).padStart(2, '0')}`));
  assert.ok(new Set(weeks.map((run) => run.seed)).size > 50, 'a new seed each week');
  assert.ok(new Set(weeks.map((run) => run.modifiers.join())).size > 5, 'and modifiers that vary');
  // Started from the title, twice: the same crew and ship, whatever the
  // game's RNG.
  const begin = (seed) => reduce(initialState(seed), { type: 'campaign/new', rules, background: 'miner', week: '2026-W44', modifiers: ['nest-egg'] }).campaign;
  const one = begin(1);
  const two = begin(99);
  assert.equal(one.seed, a.seed);
  assert.deepEqual([one.crew.map((m) => m.name), one.identity.name, one.modifiers, one.week], [two.crew.map((m) => m.name), two.identity.name, a.modifiers, '2026-W44']);
});

test('New game takes open modifiers only; the week takes its own', () => {
  const state = initialState(3);
  const begun = reduce(state, { type: 'campaign/new', rules, modifiers: ['wanted'] });
  assert.deepEqual([begun.campaign.modifiers, begun.campaign.heat], [['wanted'], 30]);
  assert.equal(reduce(state, { type: 'campaign/new', rules, modifiers: ['nest-egg'] }), state, 'a boon not yet open');
  const veteran = { ...state, profile: { ...emptyProfile(), reached: { act: 2, won: false } } };
  assert.equal(reduce(veteran, { type: 'campaign/new', rules, modifiers: ['nest-egg'] }).campaign.credits, start('miner').credits + 150);
  assert.equal(reduce(state, { type: 'campaign/new', rules, week: '2026-44' }), state, 'a week that is no week');
});

test('the record is kept as play goes: a new run, its act, a win and a game over; the latest RUNS, the furthest never lost', () => {
  let state = reduce(initialState(5), { type: 'campaign/new', rules });
  assert.equal(state.profile.runs.length, 1);
  assert.deepEqual([state.profile.runs[0].act, state.profile.reached], [1, { act: 1, won: false }]);
  const same = reduce(state, { type: 'screen/show', screen: 'title' });
  assert.equal(same.profile, state.profile, 'nothing new, the same record');
  let profile = noteRun(emptyProfile(), readyToLaunch());
  profile = noteRun(profile, launch(readyToLaunch(), rules).campaign);
  assert.deepEqual([profile.runs.length, profile.runs[0].act, profile.reached.act], [1, 2, 2]);
  const home = settled();
  const won = { ...home, ending: { day: 40, colony: home.colony.world.name, won: true, seen: false } };
  profile = noteRun(noteRun(profile, home), won);
  assert.deepEqual(profile.reached, { act: 3, won: true });
  const over = { ...readyToLaunch(), seed: 123, permadeath: true, crew: [] };
  profile = noteRun(profile, over);
  assert.deepEqual([profile.runs[0].seed, profile.runs[0].over], [123, true]);
  for (let seed = 1000; seed < 1000 + RUNS + 5; seed++) profile = noteRun(profile, { ...readyToLaunch(), seed });
  assert.equal(profile.runs.length, RUNS);
  assert.deepEqual(profile.reached, { act: 3, won: true }, 'the furthest stays');
  assert.deepEqual(profileProblems(profile), []);
  assert.ok(profileProblems({ reached: { act: 4, won: false }, runs: [] }).length);
  assert.ok(profileProblems(null).length);
});

test('save v53: the record starts from the campaign under way; a campaign has no modifiers and no week', () => {
  assert.equal(SAVE_VERSION, 53);
  const step = MIGRATIONS.find((m) => m.from === 52);
  assert.equal(step, MIGRATIONS.at(-1));
  const home = settled();
  const { modifiers, week, ...before } = { ...home, ending: { day: 9, colony: 'X', won: true, seen: true } };
  const data = { ...saveData(initialState(2)), campaign: before };
  delete data.profile;
  const moved = step.up(data);
  assert.deepEqual([moved.campaign.modifiers, moved.campaign.week], [[], null]);
  assert.deepEqual(moved.profile.reached, { act: 3, won: true });
  assert.equal(moved.profile.runs[0].seed, home.seed);
  assert.deepEqual(validate({ version: 53, data: moved }), []);
  const empty = saveData(initialState(2));
  delete empty.profile;
  assert.deepEqual(step.up(empty).profile, emptyProfile());
  assert.deepEqual(validate(migrate({ version: 52, data: empty })), []);
});

test("the validator refuses a burden with an unlock, a boon without one, a start it can't take, and too few burdens", () => {
  const problems = (change) => {
    const data = structuredClone(readData());
    change(data.modifiers.modifiers);
    return validateData(data).join('\n');
  };
  assert.match(problems((list) => (list[0].unlock = { act: 2 })), /wanted.*no unlock/);
  assert.match(problems((list) => delete list[3].unlock), /nest-egg.*must have an unlock/);
  assert.match(problems((list) => (list[0].start = { fuel: 3 })), /can't change "fuel"/);
  assert.match(problems((list) => (list[0].start = { heat: 0 })), /not 0/);
  assert.match(problems((list) => list.forEach((def) => (def.kind = 'boon'))), /two burdens/);
});
