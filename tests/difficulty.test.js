// The game's difficulty (M41): the campaign's, picked at New game and
// changed in Settings from the next fight, reaching every enemy: in every
// fight, a raid fought out where the ship isn't among them, and an enemy
// ship's guns in an approach. A save from before takes its setting as its
// campaign's (v39).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { hitChance, sideStats } from '../src/sim/approach.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { DIFFICULTIES, difficultyOf, enemyBonus, fightSetup, gunneryBonus, setDifficulty } from '../src/sim/difficulty.js';
import { approachState, giveOrder } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { faceRaid, fightAway } from '../src/sim/raids.js';
import { initialState, reduce } from '../src/sim/root.js';
import { defaultSettings } from '../src/sim/settings.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { settingsText, difficultyLine } from '../src/ui/settingsText.js';
import { startText } from '../src/ui/campaign/startText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const { balance } = rules;
const at = (difficulty) => (campaign) => ({ ...campaign, difficulty });

// The run at a pirate cutter, its approach open (tests/encounter.test.js's).
function atCutter(difficulty) {
  const fresh = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const { sector } = fresh.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
  return jump({ ...fresh, difficulty, run: { ...fresh.run, sector: { ...sector, nodes } } }, rules, to).campaign;
}

test("a new game is Normal, death not permanent, unless picked; Settings changes the difficulty from the next fight", () => {
  const campaign = newCampaign(rules, 5);
  assert.deepEqual([campaign.difficulty, campaign.permadeath, campaign.fallen], ['normal', false, []]);
  const hard = newCampaign(rules, 5, { difficulty: 'hard', permadeath: true });
  assert.deepEqual([hard.difficulty, hard.permadeath], ['hard', true]);
  assert.throws(() => newCampaign(rules, 5, { difficulty: 'brutal' }), RangeError);
  assert.deepEqual(DIFFICULTIES, ['easy', 'normal', 'hard']);
  assert.equal(setDifficulty(hard, 'easy').campaign.difficulty, 'easy');
  assert.equal(setDifficulty(hard, 'hard').campaign, hard, 'the same, the campaign as it was');
  assert.equal(setDifficulty(hard, 'brutal').ok, false);
  assert.equal(difficultyOf({}), 'normal');
  assert.deepEqual(fightSetup(hard, { forgiving: true }), { forgiving: true, difficulty: 'hard', permadeath: true });
  // New game takes both (root.js campaign/new); a difficulty that isn't one starts nothing.
  const begun = reduce(initialState(3), { type: 'campaign/new', rules, difficulty: 'easy', permadeath: true });
  assert.deepEqual([begun.campaign.difficulty, begun.campaign.permadeath], ['easy', true]);
  assert.equal(reduce(initialState(3), { type: 'campaign/new', rules, difficulty: 'brutal' }).campaign, null);
  assert.equal(reduce(begun, { type: 'campaign/difficulty', value: 'hard' }).campaign.difficulty, 'hard');
  assert.deepEqual(campaignProblems({ ...begun.campaign, difficulty: 'brutal' }), ["The campaign's difficulty is invalid."]);
  assert.deepEqual(campaignProblems({ ...begun.campaign, permadeath: 'yes' }), ["The campaign's permanent death setting is invalid."]);
});

test("a raid's enemies bring the game's difficulty, faced and fought out where the ship isn't (the other fights: captain.test.js)", () => {
  for (const difficulty of DIFFICULTIES) {
    const { aim = 0, hp = 0 } = enemyBonus(difficulty, balance);
    // A raid faced at the colony.
    const base = settled();
    const down = { ...base, difficulty, colony: { ...base.colony, day: 2, raid: { found: 1, lands: 2 } } };
    const faced = faceRaid(down, rules);
    assert.ok(faced.ok, faced.error);
    if (faced.fight) {
      for (const unit of faced.campaign.fight.battle.units.filter((u) => u.side === 'enemy')) {
        assert.equal(unit.aim, rules.enemies.get(unit.kind).aim + aim, `${difficulty} raid aim`);
        assert.equal(unit.maxHp, Math.max(1, rules.enemies.get(unit.kind).hp + hp));
      }
    }
  }
  // Fought out with no one playing: the harder the game, the fewer held, over 40 raids.
  const held = (difficulty) => {
    let won = 0;
    for (let n = 0; n < 40; n++) {
      const base = settled();
      const down = { ...base, difficulty, rng: 1000 + n, colony: { ...base.colony, day: 2, raid: { found: 1, lands: 2 } } };
      if (fightAway(down, rules).won) won += 1;
    }
    return won;
  };
  assert.ok(held('easy') > held('hard'), `easy ${held('easy')}, hard ${held('hard')}`);
});

test("an enemy ship's guns aim with the difficulty, in the odds shown and the odds rolled", () => {
  assert.equal(gunneryBonus('normal', balance), 0);
  assert.ok(gunneryBonus('easy', balance) < 0 && gunneryBonus('hard', balance) > 0);
  for (const difficulty of DIFFICULTIES) {
    const there = atCutter(difficulty);
    const state = approachState(there, rules);
    assert.equal(state.them.aim ?? 0, gunneryBonus(difficulty, balance));
    assert.equal(sideStats(state.them, rules).gunnery, sideStats({ ...state.them, aim: 0 }, rules).gunnery + gunneryBonus(difficulty, balance));
    // What a volley rolls against is the chance its event shows.
    const played = giveOrder(there, rules, { kind: 'evade' });
    assert.ok(played.ok, played.error);
    const volley = played.campaign.run.approach.last.events.find((event) => event.kind === 'volley' && event.side === 'them');
    if (volley) assert.equal(volley.chance, hitChance(sideStats(state.you, rules), true, rules, sideStats(state.them, rules, state.round).gunnery));
    assert.equal(played.campaign.run.approach.them.aim, undefined, "the save keeps the ship, not the difficulty's aim");
  }
});

test('save v39: a save from before takes its settings\' difficulty as its campaign\'s, death not permanent and no one fallen', () => {
  assert.equal(SAVE_VERSION, 44);
  const campaign = { crew: [], fight: null, colonies: [] };
  const old = { settings: { ...defaultSettings(), difficulty: 'hard' }, campaign };
  const moved = migrate({ version: 38, data: old });
  assert.equal(moved.version, 44);
  assert.deepEqual(moved.data.settings, defaultSettings(), 'the settings keep none');
  assert.deepEqual(moved.data.campaign, { ...campaign, difficulty: 'hard', permadeath: false, fallen: [] });
  const none = migrate({ version: 38, data: { settings: { ...defaultSettings(), difficulty: 'odd' }, campaign: null } });
  assert.equal(none.data.campaign, null);
  assert.equal(migrate({ version: 38, data: { settings: { ...defaultSettings(), difficulty: 'odd' }, campaign } }).data.campaign.difficulty, 'normal');
});

test("the words: Settings' row is the game's, and New game's last screen offers both", () => {
  assert.equal(difficultyLine('normal', balance), 'Enemies as they come.');
  assert.equal(difficultyLine('easy', balance), `Enemies aim ${-balance.easyEnemyAim} worse and have ${-balance.easyEnemyHp} hit point fewer; their ships' guns aim ${-balance.easyEnemyGunnery} worse.`);
  const keys = (campaign) => settingsText(defaultSettings(), balance, campaign).map((row) => row.key);
  assert.ok(!keys(null).includes('difficulty'), 'no game, no row');
  const campaign = newCampaign(rules, 1, { difficulty: 'hard', permadeath: true });
  const row = settingsText(defaultSettings(), balance, campaign).find((each) => each.key === 'difficulty');
  assert.deepEqual([row.value, row.action], ['hard', 'campaign/difficulty']);
  assert.match(row.line, /This game, from the next fight\. Death is permanent in it\.$/);
  assert.equal(settingsText(defaultSettings(), balance, campaign).find((each) => each.key === 'forgiving').action, 'settings/forgiving');
  assert.ok(!keys({ ...campaign, crew: [] }).includes('difficulty'), 'a game over has none');
  const draft = { background: 'miner', captain: { name: 'Wren Castell ', job: 'marine', traits: [], look: null }, difficulty: 'normal', permadeath: true };
  const text = startText(rules, draft, true);
  assert.equal(text.sub, 'Debt-bound miner. Wren Castell, marine.');
  assert.deepEqual(text.rows.map((each) => [each.key, each.value]), [['difficulty', 'normal'], ['permadeath', true]]);
  assert.match(text.rows[1].line, /^Anyone who bleeds out in a fight dies\./);
  assert.equal(text.hint.text, 'Tap Start to begin. This replaces the campaign under way.');
});
