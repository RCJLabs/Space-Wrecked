// Traits and recruits' backgrounds (M32b): the 20 traits, half of them
// trading one fight number for another; each recruit rolled from a
// background in data/recruits.json (its jobs, its count of traits and the
// fights already stood, so a veteran signs on ranked); the fee rising with
// their traits and rank; and the background kept aboard and in the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave } from '../src/core/save.js';
import { campaignProblems, crewUnit } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { memberJob, rankOf } from '../src/sim/ranks.js';
import { feeOf, hireRecruit, recruitsAt } from '../src/sim/recruits.js';
import { initialState, saveData } from '../src/sim/root.js';
import { shareHere } from '../src/sim/standing.js';
import { TRAIT_STATS } from '../src/sim/traits.js';
import { beginRun } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The ship at station `node`, with room aboard for anyone.
const at = (campaign, node) => ({ ...campaign, crew: campaign.crew.slice(0, 1), run: { ...campaign.run, at: node, seen: [...campaign.run.seen, node] } });

// Every recruit the stations of the first sector offer, over campaign seeds
// 1 to `seeds`, with the campaign they were offered in.
function offered(seeds = 60) {
  const fresh = onRun({ credits: 500 });
  const all = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const campaign = { ...fresh, seed };
    for (const node of campaign.run.sector.nodes.filter((n) => n.type === 'station')) {
      for (const recruit of recruitsAt(campaign, rules, node.id)) all.push({ recruit, campaign: at(campaign, node.id) });
    }
  }
  return all;
}

test('20 traits, each moving the fight numbers; half of them trade one number for another, as Hothead does', () => {
  const traits = [...rules.traits.values()];
  assert.equal(traits.length, 20);
  for (const trait of traits) {
    const moves = Object.entries(trait.effects);
    assert.ok(moves.length && moves.every(([key, value]) => TRAIT_STATS.includes(key) && Number.isInteger(value) && value !== 0), trait.id);
  }
  const trades = traits.filter((trait) => Object.values(trait.effects).some((v) => v < 0) && Object.values(trait.effects).some((v) => v > 0));
  assert.equal(trades.length, 10);
  assert.ok(trades.some((trait) => trait.id === 'hothead'));
});

test('every recruit comes from a background and rolls from it: one of its jobs, its count of traits none twice, and fights in its range', () => {
  const all = offered();
  const seen = new Set();
  for (const { recruit } of all) {
    const past = rules.recruits.backgrounds.get(recruit.background);
    assert.ok(past, recruit.name);
    seen.add(past.id);
    assert.ok(past.jobs.includes(recruit.job), `${recruit.name}: ${recruit.job} from ${past.id}`);
    assert.equal(recruit.traits.length, past.traitCount, recruit.name);
    assert.equal(new Set(recruit.traits).size, recruit.traits.length, `${recruit.name}: no trait twice`);
    assert.ok(recruit.traits.every((id) => past.traits.includes(id)), recruit.name);
    assert.ok(recruit.fights >= past.fights[0] && recruit.fights <= past.fights[1], `${recruit.name}: ${recruit.fights} fights from ${past.id}`);
  }
  assert.deepEqual([...seen].sort(), [...rules.recruits.backgrounds.keys()].sort(), 'every background turns up');
  // Ranked recruits and green ones both come.
  const ranks = new Set(all.map(({ recruit }) => rankOf(recruit, rules)));
  assert.deepEqual([...ranks].sort(), [0, 1, 2]);
});

test('the fee rises with traits and rank: recruitFee, recruitTraitFee a trait and recruitRankFee a rank', () => {
  assert.deepEqual([balance.recruitFee, balance.recruitTraitFee, balance.recruitRankFee], [30, 20, 40]);
  const fee = (traits, fights, job = 'marine') => feeOf({ job, traits, fights }, rules);
  assert.equal(fee([], 0), 30, 'a green hand');
  assert.equal(fee(['quick'], 0), 50, 'one trait: the fee before M32b');
  assert.equal(fee(['quick'], 2), 50, 'two fights: no rank yet');
  assert.equal(fee(['quick'], 3), 90, 'rank 1');
  assert.equal(fee(['steady', 'cool-head'], 8), 150, 'rank 2, two traits');
  assert.equal(fee(['steady', 'cool-head'], 40), 150, 'no rank past 2');
  // Each recruit asks their own, at the station's share (M33).
  for (const { recruit, campaign } of offered(10)) assert.equal(recruit.fee, feeOf(recruit, rules, shareHere(campaign, rules)), recruit.name);
});

test('a veteran signs on ranked: their fights stood set their rank, and their order and effects follow it from the first fight', () => {
  const { recruit, campaign } = offered().find(({ recruit: r }) => rankOf(r, rules) === 2);
  const signed = hireRecruit({ ...campaign, credits: recruit.fee }, rules, recruit.slot);
  assert.ok(signed.ok, signed.error);
  assert.equal(signed.campaign.credits, 0, 'the whole fee');
  const member = signed.campaign.crew.at(-1);
  assert.deepEqual([member.fights, member.background, rankOf(member, rules)], [recruit.fights, recruit.background, 2]);
  assert.equal(crewUnit(member, rules).rank, 2);
  assert.equal(memberJob(member, rules), memberJob({ job: member.job, fights: rules.balance.rankTwoFights }, rules));
});

test('a recruit keeps their background aboard and in the save; the start crew have none, and a broken one is caught', () => {
  const { recruit, campaign } = offered(5)[0];
  const signed = hireRecruit({ ...campaign, credits: 500 }, rules, recruit.slot).campaign;
  assert.deepEqual(signed.crew.map((m) => m.background), [undefined, recruit.background]);
  const opened = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(5)), campaign: signed })));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.data.campaign.crew.at(-1).background, recruit.background);
  assert.deepEqual(campaignProblems(signed), []);
  for (const background of ['', 'Fleet Veteran', 7, null]) {
    const broken = { ...signed, crew: signed.crew.map((m, i) => (i === 1 ? { ...m, background } : m)) };
    assert.notDeepEqual(campaignProblems(broken), [], `background ${JSON.stringify(background)}`);
  }
});
