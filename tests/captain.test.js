import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { beginFight, campaignProblems, captainProblem, maxHp, newCampaign } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { beginRaid } from '../src/sim/raid.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { defaultSettings, enemyBonus, fightSettings, reduceSettings, settingsProblems } from '../src/sim/settings.js';
import { LOOKS_APART, looksApart } from '../src/sim/looks.js';
import { traitBonus } from '../src/sim/traits.js';
import { rules } from './battleKit.js';

const dell = { name: '  Dell Okafor ', job: 'engineer', traits: ['thick-skull', 'steady'] };

test('a captain needs a name, one of the crew jobs, two different traits, and a look if one is given', () => {
  assert.equal(captainProblem(dell, rules), null);
  const cases = [
    [{ ...dell, name: '   ' }, 'Give your captain a name.'],
    [{ ...dell, name: 'x'.repeat(25) }, 'A name fits 24 letters.'],
    [{ ...dell, job: 'pilot' }, 'Pick a job for your captain.'],
    [{ ...dell, traits: ['steady'] }, 'Pick 2 traits.'],
    [{ ...dell, traits: ['steady', 'steady'] }, 'Pick 2 traits.'],
    [{ ...dell, traits: ['steady', 'quick', 'patched'] }, 'Pick 2 traits.'],
    [{ ...dell, traits: ['steady', 'lucky'] }, 'There is no trait "lucky".'],
    [{ ...dell, look: { face: 99 } }, 'Pick a look for your captain.'],
    [null, 'Give your captain a name.'],
  ];
  for (const [captain, why] of cases) assert.equal(captainProblem(captain, rules), why, JSON.stringify(captain));
});

test('the captain leads the crew in their job, named, with their traits and look; the rest are named from the recruits\' names', () => {
  const look = { face: 3, skin: 'tan', hair: 'crop', hairColor: 'black', eyes: 'brown', beard: 'none', mark: 'scar' };
  const campaign = newCampaign(rules, 77, { captain: { ...dell, look } });
  assert.equal(campaign.captain, 2);
  assert.deepEqual(
    campaign.crew.map(({ id, job, traits, hp }) => ({ id, job, traits, hp })),
    [
      { id: 1, job: 'marine', traits: [], hp: 10 },
      { id: 2, job: 'engineer', traits: ['thick-skull', 'steady'], hp: 10 },
      { id: 3, job: 'medic', traits: [], hp: 8 },
    ],
  );
  assert.equal(campaign.crew[1].name, 'Dell Okafor');
  assert.deepEqual(campaign.crew[1].look, look, 'the look picked');
  for (const member of [campaign.crew[0], campaign.crew[2]]) {
    const [first, last] = member.name.split(' ');
    assert.ok(rules.recruits.first.includes(first) && rules.recruits.last.includes(last), member.name);
    assert.ok(looksApart(member.look, look) >= LOOKS_APART, 'apart from the captain');
  }
  assert.ok(looksApart(campaign.crew[0].look, campaign.crew[2].look) >= LOOKS_APART);
  assert.deepEqual(newCampaign(rules, 77, { captain: { ...dell, look } }), campaign, 'the same seed and captain, the same crew');
  assert.equal(maxHp(campaign.crew[1], rules), 10, "a thick skull's 2 on the engineer's 8");
  assert.deepEqual(campaignProblems(campaign), []);
  assert.deepEqual(traitBonus(['hothead', 'low-profile'], rules), { hp: 0, aim: 10, defense: 0, mobility: 0, armor: 0 }, 'effects add up, and cancel');
  assert.throws(() => newCampaign(rules, 77, { captain: { ...dell, traits: [] } }), /Pick 2 traits/);
  // Without a captain made for it, the first crew member leads.
  const plain = newCampaign(rules, 77);
  assert.equal(plain.captain, 1);
  assert.ok(plain.crew.every((member) => member.traits.length === 0));
});

test("traits go into every fight: the captain's numbers in a job, a raid and a fight on the ship", () => {
  const campaign = withBoard(newCampaign(rules, 77, { captain: dell }), rules);
  const captainOf = (fight) => fight.battle.units.find((unit) => unit.name === 'Dell Okafor');
  const engineer = rules.jobs.get('engineer');
  const expect = { maxHp: engineer.hp + 2, hp: engineer.hp + 2, aim: engineer.aim + 5, defense: engineer.defense, mobility: engineer.mobility, armor: engineer.armor };
  const job = takeJob(campaign, rules, 0);
  const raid = beginRaid({ ...campaign, heat: 80 }, rules);
  const fight = beginFight(campaign, rules);
  for (const [what, begun] of [['job', job], ['raid', raid], ['fight', fight]]) {
    assert.ok(begun.ok, `${what}: ${begun.error}`);
    const unit = captainOf(begun.campaign.fight);
    assert.deepEqual(Object.fromEntries(Object.keys(expect).map((key) => [key, unit[key]])), expect, what);
    const marine = begun.campaign.fight.battle.units.find((u) => u.kind === 'marine');
    assert.equal(marine.aim, rules.jobs.get('marine').aim, `${what}: the others fight as their job`);
  }
  // Wounded, the captain comes back to their own most, not the job's.
  const hurt = { ...campaign, crew: campaign.crew.map((member) => (member.id === 2 ? { ...member, hp: 9 } : member)) };
  assert.equal(captainOf(takeJob(hurt, rules, 0).campaign.fight).hp, 9);
});

test('difficulty changes what every enemy brings; normal changes nothing', () => {
  const campaign = withBoard(newCampaign(rules, 77), rules);
  const { balance } = rules;
  assert.deepEqual(enemyBonus('normal', balance), {});
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const bonus = { aim: 0, hp: 0, ...enemyBonus(difficulty, balance) };
    for (const begun of [takeJob(campaign, rules, 0, { difficulty }), beginRaid({ ...campaign, heat: 80 }, rules, { difficulty })]) {
      assert.ok(begun.ok, begun.error);
      for (const unit of begun.campaign.fight.battle.units.filter((u) => u.side === 'enemy')) {
        const template = rules.enemies.get(unit.kind);
        assert.equal(unit.aim, template.aim + bonus.aim, `${difficulty} ${unit.kind} aim`);
        assert.equal(unit.maxHp, Math.max(1, template.hp + bonus.hp), `${difficulty} ${unit.kind} hit points`);
        assert.equal(unit.hp, unit.maxHp);
      }
      for (const unit of begun.campaign.fight.battle.units.filter((u) => u.side === 'crew')) {
        assert.equal(unit.aim, rules.jobs.get(unit.kind).aim, `${difficulty}: the crew is as it was`);
      }
    }
  }
  assert.ok(enemyBonus('easy', balance).aim < 0 && enemyBonus('hard', balance).aim > 0);
});

test('forgiving odds and difficulty come from the settings as a fight starts, and stay with it', () => {
  let state = reduce(initialState(3), { type: 'campaign/new', rules, captain: dell });
  assert.equal(state.campaign.captain, 2);
  state = reduce(state, { type: 'settings/forgiving', value: true });
  state = reduce(state, { type: 'settings/difficulty', value: 'hard' });
  assert.deepEqual(fightSettings(state.settings), { forgiving: true, difficulty: 'hard' });
  const fighting = reduce(state, { type: 'campaign/job/take', index: 0, rules });
  const { battle } = fighting.campaign.fight;
  assert.equal(battle.options.forgiving, true);
  const enemy = battle.units.find((unit) => unit.side === 'enemy');
  assert.equal(enemy.aim, rules.enemies.get(enemy.kind).aim + rules.balance.hardEnemyAim);
  // Changing the setting mid-fight changes nothing in it.
  const later = reduce(fighting, { type: 'settings/forgiving', value: false });
  assert.equal(later.campaign.fight.battle, battle);
  // A captain who can't be: no campaign.
  const refused = reduce(initialState(3), { type: 'campaign/new', rules, captain: { ...dell, name: '' } });
  assert.equal(refused.campaign, null);
});

test('settings take only what they can hold', () => {
  const settings = defaultSettings();
  assert.deepEqual(settings, { fpsCap: 60, difficulty: 'normal', forgiving: false, motion: 'auto', tips: true, tipsSeen: [] });
  const apply = (action) => reduceSettings(settings, action);
  assert.equal(apply({ type: 'settings/difficulty', value: 'easy' }).difficulty, 'easy');
  assert.equal(apply({ type: 'settings/difficulty', value: 'brutal' }), settings);
  assert.equal(apply({ type: 'settings/forgiving', value: 'yes' }), settings);
  assert.equal(apply({ type: 'settings/motion', value: 'reduce' }).motion, 'reduce');
  assert.equal(apply({ type: 'settings/motion', value: 'slow' }), settings);
  assert.equal(apply({ type: 'settings/tips', value: false }).tips, false);
  const seen = apply({ type: 'settings/tip/seen', id: 'build' });
  assert.deepEqual(seen.tipsSeen, ['build']);
  assert.equal(reduceSettings(seen, { type: 'settings/tip/seen', id: 'build' }), seen, 'once');
  assert.equal(apply({ type: 'settings/tip/seen', id: 'Not An Id' }), settings);
  assert.deepEqual(reduceSettings({ ...seen, tips: false }, { type: 'settings/tips/reset' }), settings, 'Show tips again');
  assert.equal(reduceSettings(settings, { type: 'settings/tips/reset' }), settings);
  assert.deepEqual(settingsProblems(settings), []);
  assert.deepEqual(settingsProblems({ ...settings, difficulty: 'brutal', tipsSeen: ['a', 'a'] }), ['The difficulty setting is invalid.', 'The tips settings are unreadable.']);
});

test('a save from M17 (v8) opens with the default settings, its frame cap, and its first crew member as captain', () => {
  let state = reduce({ ...initialState(6), settings: { ...defaultSettings(), fpsCap: 30 } }, { type: 'campaign/new', rules });
  state = reduce(state, { type: 'campaign/job/take', index: 0, rules });
  const { captain, ...campaign } = state.campaign;
  const v8 = {
    version: 8,
    data: { ...saveData(state), settings: { fpsCap: 30 }, campaign: { ...campaign, crew: campaign.crew.map(({ traits, ...member }) => member) } },
  };
  const loaded = parseSave(JSON.stringify(v8));
  assert.ok(loaded.ok, loaded.error);
  assert.equal(loaded.save.version, SAVE_VERSION);
  assert.deepEqual(loaded.save.data.settings, { ...defaultSettings(), fpsCap: 30 });
  assert.deepEqual(loaded.save.data.campaign, state.campaign, 'mid-fight and all: traits [] for everyone, captain the first');
  // And a new one round-trips with its captain.
  const fresh = reduce(initialState(6), { type: 'campaign/new', rules, captain: dell });
  const back = parseSave(JSON.stringify(makeSave(saveData(fresh))));
  assert.deepEqual(back.save.data.campaign, fresh.campaign);
  // A save whose captain isn't aboard is damaged.
  const lost = makeSave({ ...saveData(fresh), campaign: { ...fresh.campaign, captain: 9 } });
  assert.match(parseSave(JSON.stringify(lost)).error, /captain isn't aboard/);
});
