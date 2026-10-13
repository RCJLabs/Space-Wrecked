// Crew looks (M23c): what portraits are drawn from (src/sim/looks.js),
// rolled for the start crew and recruits, picked for the captain, kept
// apart aboard, and saved (v15, with its migration).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, migrate, parseSave } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { crewLook, FACES, isLook, LOOK_KEYS, LOOK_LAYERS, LOOKS_APART, looksApart, rollLook, stepLook } from '../src/sim/looks.js';
import { hireRecruit, recruitOffer, recruitsAt } from '../src/sim/recruits.js';
import { initialState, saveData } from '../src/sim/root.js';
import { beginRun } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const look = { face: 3, skin: 'tan', hair: 'crop', hairColor: 'black', eyes: 'brown', beard: 'none', mark: 'scar' };

test('a rolled look has a choice in every layer; the same state, the same look; every choice comes up', () => {
  const seen = Object.fromEntries(LOOK_KEYS.map((key) => [key, new Set()]));
  let state = seedFrom('looks');
  for (let i = 0; i < 3000; i++) {
    const roll = rollLook(state);
    assert.ok(isLook(roll.value), JSON.stringify(roll.value));
    assert.deepEqual(rollLook(state), roll, 'pure');
    for (const key of LOOK_KEYS) seen[key].add(roll.value[key]);
    state = roll.state;
  }
  assert.equal(seen.face.size, FACES);
  for (const [key, choices] of Object.entries(LOOK_LAYERS)) assert.equal(seen[key].size, choices.length, key);
});

test('a look rolled beside others is at least LOOKS_APART layers from each', () => {
  for (let i = 0; i < 300; i++) {
    const others = [];
    for (let id = 1; id <= 6; id++) {
      const next = crewLook(i, id, others);
      for (const other of others) assert.ok(looksApart(next, other) >= LOOKS_APART, `seed ${i}, id ${id}`);
      others.push(next);
    }
  }
  // Close to someone, it is rolled again: a look one layer from the first
  // roll's is passed over.
  const first = rollLook(seedFrom('close')).value;
  const near = { ...first, face: (first.face + 1) % FACES };
  assert.ok(looksApart(rollLook(seedFrom('close'), [near]).value, near) >= LOOKS_APART);
  assert.equal(looksApart(look, look), 0);
  assert.equal(looksApart(look, { ...look, mark: 'none', face: 4 }), 2);
});

test('captain creation steps each layer through its choices and round again', () => {
  for (const key of LOOK_KEYS) {
    const count = key === 'face' ? FACES : LOOK_LAYERS[key].length;
    let at = look;
    const seen = new Set();
    for (let i = 0; i < count; i++) {
      seen.add(at[key]);
      at = stepLook(at, key);
      assert.ok(isLook(at));
      assert.equal(looksApart(at, look) <= 1, true, 'one layer at a time');
    }
    assert.equal(seen.size, count, key);
    assert.deepEqual(at, look, `${key}: round again`);
  }
});

test('a look is only what can be drawn', () => {
  assert.ok(isLook(look));
  for (const bad of [null, [], 'tan', { ...look, face: FACES }, { ...look, face: -1 }, { ...look, face: 1.5 }, { ...look, skin: 'green' }, { ...look, hat: 'cap' }, (({ mark: _, ...rest }) => rest)(look)]) {
    assert.equal(isLook(bad), false, JSON.stringify(bad));
  }
});

test('new games: the start crew named from the recruits\' names and apart in looks, the same from the same seed', () => {
  for (let seed = 0; seed < 200; seed++) {
    const { crew } = newCampaign(rules, seed);
    assert.equal(new Set(crew.map((m) => m.name.split(' ')[0])).size, crew.length, `seed ${seed}: a first name each`);
    for (const a of crew) for (const b of crew) if (a !== b) assert.ok(looksApart(a.look, b.look) >= LOOKS_APART, `seed ${seed}`);
  }
  assert.deepEqual(newCampaign(rules, 5).crew, newCampaign(rules, 5).crew);
  // The captain's name is never another's.
  const captain = { name: newCampaign(rules, 9).crew[1].name, job: 'marine', traits: ['quick', 'steady'], look };
  const crew = newCampaign(rules, 9, { captain }).crew;
  assert.equal(crew.filter((m) => m.name === captain.name).length, 1);
});

test('recruits come with looks, apart from the crew and each other, the same on every visit, kept when signed on', () => {
  const run = beginRun(launch(readyToLaunch({ credits: 500 }), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((n) => n.type === 'station').id;
  const campaign = { ...run, run: { ...run.run, at: station, seen: [...run.run.seen, station] } };
  const offer = recruitOffer(campaign, rules);
  const all = [...campaign.crew.map((m) => m.look), ...offer.map((r) => r.look)];
  for (const recruit of offer) {
    assert.ok(isLook(recruit.look));
    for (const other of all) if (other !== recruit.look) assert.ok(looksApart(recruit.look, other) >= LOOKS_APART);
  }
  assert.deepEqual(recruitsAt({ ...campaign, rng: 12345 }, rules, station), recruitsAt(campaign, rules, station), 'the campaign\'s RNG plays no part');
  const signed = hireRecruit(campaign, rules, offer[0].slot).campaign;
  assert.deepEqual(signed.crew.at(-1).look, offer[0].look);
  assert.deepEqual(recruitOffer(signed, rules), offer.slice(1), 'the rest look as they did');
});

test('save v15 keeps the looks; a v14 crew gets looks from its ids, apart and the same on every load, names kept', () => {
  const campaign = newCampaign(rules, 31);
  const state = { ...initialState(1), campaign };
  const back = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.save.data.campaign.crew, campaign.crew);
  // A v14 campaign, crew named by their jobs as before M23c.
  const v14crew = campaign.crew.map(({ look: _, ...member }) => ({ ...member, name: rules.jobs.get(member.job).name }));
  const v14 = { ...saveData(state), campaign: { ...campaign, crew: v14crew } };
  const up = MIGRATIONS.find((m) => m.from === 14).up;
  const crew = up(v14).campaign.crew;
  assert.deepEqual(crew.map((m) => m.name), ['Marine', 'Engineer', 'Medic'], 'names kept');
  for (const member of crew) assert.ok(isLook(member.look));
  for (const a of crew) for (const b of crew) if (a !== b) assert.ok(looksApart(a.look, b.look) >= LOOKS_APART);
  assert.deepEqual(up(v14), up(structuredClone(v14)), 'the same on every load');
  assert.deepEqual(crew.map((m) => m.look), v14crew.map((m, i) => crewLook(campaign.seed, m.id, crew.slice(0, i).map((c) => c.look))));
  const loaded = migrate({ version: 14, data: v14 }, { target: 15 });
  assert.equal(loaded.version, 15);
  assert.deepEqual(loaded.data.campaign.crew, crew);
  assert.deepEqual(up({ ...v14, campaign: null }).campaign, null, 'no campaign, nothing to do');
  // Without a look, or with one that can't be drawn, a crew member is caught.
  assert.deepEqual(campaignProblems({ ...campaign, crew: v14crew }), ['The campaign\'s crew is unreadable.']);
  assert.deepEqual(campaignProblems({ ...campaign, crew: [{ ...campaign.crew[0], look: { ...look, eyes: 'red' } }, ...campaign.crew.slice(1)] }), ['The campaign\'s crew is unreadable.']);
});
