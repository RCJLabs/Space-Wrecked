// M30: three backgrounds, each with its start, its district and its
// pursuer, and everything that reads the background reading the
// campaign's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { newCampaign } from '../src/sim/campaign.js';
import { contractsIn, withBoard } from '../src/sim/contracts.js';
import { shopOf } from '../src/sim/economy.js';
import { huntersFor, paymentFor } from '../src/sim/heat.js';
import { huntOdds } from '../src/sim/hunt.js';
import { launch } from '../src/sim/launch.js';
import { beginRaid } from '../src/sim/raid.js';
import { faceRaid } from '../src/sim/raids.js';
import { initialState, reduce } from '../src/sim/root.js';
import { beginRun } from '../src/sim/travel.js';
import { backgroundText } from '../src/ui/campaign/backgroundText.js';
import { captainText } from '../src/ui/campaign/captainText.js';
import { hangarText, heatText } from '../src/ui/campaign/hubText.js';
import { launchText } from '../src/ui/campaign/launchText.js';
import { raidsText, runRaids } from '../tools/raids.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const IDS = ['miner', 'deserter', 'smuggler'];
const captain = (job) => ({ name: 'Ada Kessler', job, traits: ['steady', 'quick'] });
const enemiesOf = (campaign) => campaign.fight.battle.units.filter((unit) => unit.side === 'enemy').map((unit) => unit.kind);

test('three backgrounds, each with its own district, pursuer, fighters and ships', () => {
  assert.deepEqual([...rules.backgrounds.keys()], IDS);
  const all = IDS.map((id) => rules.backgrounds.get(id));
  const distinct = (pick) => assert.equal(new Set(all.map(pick)).size, IDS.length, pick.toString());
  distinct((b) => b.district);
  distinct((b) => b.pursuer.name);
  distinct((b) => b.pursuer.hunters.join());
  distinct((b) => b.pursuer.raiders);
  distinct((b) => b.pursuer.run.hunters);
  distinct((b) => b.pursuer.run.taskForce);
  distinct((b) => b.pursuer.colony.raiders);
  distinct((b) => b.start.crew.join());
});

test('a campaign starts from the background picked: its crew, credits, parts and ship, and its district\'s board and shop', () => {
  for (const id of IDS) {
    const { start, district } = rules.backgrounds.get(id);
    const campaign = withBoard(newCampaign(rules, 7, { background: id }), rules);
    assert.equal(campaign.background, id);
    assert.deepEqual(campaign.crew.map((member) => member.job), start.crew, id);
    assert.equal(campaign.credits, start.credits, id);
    assert.deepEqual(campaign.parts, start.parts, id);
    assert.deepEqual(campaign.ship.modules.map((module) => module.type), start.ship.placements.map((placement) => placement.type), id);
    const offered = new Set(contractsIn(rules, district).map((contract) => contract.id));
    assert.equal(offered.size, id === 'miner' ? 10 : 8, `${id}: its district's jobs`);
    assert.ok(campaign.board.length > 0 && campaign.board.every((job) => offered.has(job.contract)), `${id}: the board is its district's`);
    assert.equal(shopOf(campaign, rules).name, rules.districts.get(district).shop.name, id);
  }
});

test('campaign/new starts from the background picked, the first if none is, and refuses one that isn\'t there or a captain its crew can\'t have', () => {
  const deserter = reduce(initialState(3), { type: 'campaign/new', rules, background: 'deserter', captain: captain('marine') });
  assert.equal(deserter.campaign.background, 'deserter');
  assert.equal(deserter.campaign.crew[deserter.campaign.captain - 1].name, 'Ada Kessler');
  assert.equal(reduce(initialState(3), { type: 'campaign/new', rules }).campaign.background, 'miner');
  assert.equal(reduce(initialState(3), { type: 'campaign/new', rules, background: 'pilot' }).campaign, null);
  // The deserter's crew has no engineer, so an engineer can't lead it.
  assert.equal(reduce(initialState(3), { type: 'campaign/new', rules, background: 'deserter', captain: captain('engineer') }).campaign, null);
  assert.equal(reduce(initialState(3), { type: 'campaign/new', rules, background: 'smuggler', captain: captain('engineer') }).campaign.background, 'smuggler');
});

test('the pursuer is the background\'s in act 1: its words, its hunters on jobs, its raid at the hangar and its launch words', () => {
  for (const id of IDS) {
    const { pursuer, launch: words } = rules.backgrounds.get(id);
    const start = withBoard(newCampaign(rules, 9, { background: id }), rules);
    const at = (heat) => ({ ...start, heat });
    assert.equal(heatText(at(10), rules).line, pursuer.levels.calm, id);
    assert.equal(heatText(at(30), rules).line, pursuer.levels.rumors, id);
    assert.equal(heatText(at(55), rules).line, pursuer.levels.hunters, id);
    assert.deepEqual(huntersFor(at(55), rules), pursuer.hunters, id);
    const raid = beginRaid(at(80), rules);
    assert.equal(raid.ok, true, `${id}: ${raid.error}`);
    assert.deepEqual(enemiesOf(raid.campaign).sort(), [...rules.encounters.get(pursuer.raiders).enemies].sort(), `${id}: its raiders`);
    const lifted = launch({ ...readyToLaunch(), background: id }, rules).campaign;
    assert.equal(launchText(lifted, rules).line, words.text, id);
  }
});

test('the pursuer is the background\'s on the run and at the colony: its words, its hunters\' ships and its raiders', () => {
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const colony = settled();
  for (const id of IDS) {
    const { pursuer } = rules.backgrounds.get(id);
    const onRun = { ...run, background: id };
    assert.equal(heatText({ ...onRun, heat: 60 }, rules).line, pursuer.run.levels.hunters, id);
    assert.equal(huntOdds(onRun, rules, 60, 'empty').ship, pursuer.run.hunters, id);
    assert.equal(huntOdds(onRun, rules, 80, 'empty').ship, pursuer.run.taskForce, id);
    const home = { ...colony, background: id };
    assert.equal(heatText({ ...home, heat: 80 }, rules).line, pursuer.colony.levels.taskForce, id);
    // A raid down on a colony with no guns: every raider lands.
    const down = { ...home, heat: 70, colony: { ...home.colony, day: 2, raid: { found: 1, lands: 2 } } };
    let fight = null;
    for (let n = 1; n <= 50 && !fight; n++) {
      const faced = faceRaid({ ...down, rng: seedFrom(n) }, rules);
      if (faced.ok && faced.fight) fight = faced.campaign;
    }
    assert.ok(fight, `${id}: a raid fought`);
    assert.deepEqual(enemiesOf(fight).sort(), [...rules.encounters.get(pursuer.colony.raiders).enemies].sort(), `${id}: its raiders at the colony`);
  }
});

test('the Fleet Provost takes no payments: no Pay at the hangar, and the hints say only a raid brings heat down', () => {
  const deserter = withBoard(newCampaign(rules, 4, { background: 'deserter' }), rules);
  // Nothing on hand to fit, so the hint is heat's.
  const hot = { ...deserter, heat: 55, credits: 500, parts: {} };
  assert.deepEqual(paymentFor(hot, rules), { payment: null, ok: false, why: 'There is no one to pay.' });
  const text = hangarText(hot, rules);
  assert.equal(text.heat.payment, null);
  assert.equal(text.hint.text, `${rules.backgrounds.get('deserter').pursuer.levels.hunters} The Fleet Provost takes no payments: heat only falls once a raid is faced.`);
  const raid = hangarText({ ...hot, heat: 80 }, rules);
  assert.equal(raid.hint.text, `${rules.backgrounds.get('deserter').pursuer.levels.raid} Defend the ship.`);
  // The Hallorans take theirs, dearer than Con-Reg's.
  const smuggler = { ...withBoard(newCampaign(rules, 4, { background: 'smuggler' }), rules), heat: 55, credits: 500, parts: {} };
  const terms = paymentFor(smuggler, rules);
  assert.equal(terms.ok, true);
  assert.deepEqual([terms.payment.credits, terms.payment.heat], [75, 15]);
  assert.ok(terms.payment.credits > rules.backgrounds.get('miner').pursuer.payment.credits);
  assert.match(hangarText(smuggler, rules).hint.text, /A payment buys some heat off\.$/);
});

test('the background screen: a card for each background, and the one picked in full, with what its start still has to find', () => {
  const text = backgroundText(rules, 'deserter');
  assert.deepEqual(text.cards.map((card) => [card.id, card.picked]), [['miner', false], ['deserter', true], ['smuggler', false]]);
  assert.equal(text.cards[1].pursuer, 'After you: The Fleet Provost');
  assert.equal(text.name, 'Navy deserter');
  assert.deepEqual(Object.fromEntries(text.facts), {
    'After you': 'The Fleet Provost. The Navy\'s police. They never forget a deserter, and they never take cash. Takes no payments.',
    Home: `The Strand. ${rules.districts.get('strand').blurb}`,
    Crew: 'Marine ×2, Medic',
    Credits: '0',
    'On hand': 'Engine, Crew quarters, Corridor ×2',
    Fitted: 'Bridge, Reactor, Corridor ×3, Airlock, Weapon mount, Shield generator, Small reactor',
    'To find': 'Engine ×2, Life support',
  });
  assert.equal(Object.fromEntries(backgroundText(rules, 'miner').facts)['To find'], 'Engine ×3');
  assert.match(Object.fromEntries(backgroundText(rules, 'smuggler').facts)['After you'], /Takes payments: 75 credits for 15 heat off\.$/);
});

test('the captain screen offers each of the start crew\'s jobs once, and names the background picked', () => {
  const draft = { name: 'Ada Kessler', job: 'marine', traits: [], look: null };
  const text = captainText(rules, draft, 'deserter');
  assert.deepEqual(text.jobs.map((job) => job.id), ['marine', 'medic']);
  assert.deepEqual(text.background, { name: 'Navy deserter', blurb: rules.backgrounds.get('deserter').blurb, pursuer: 'The Fleet Provost' });
  assert.deepEqual(captainText(rules, draft, 'smuggler').jobs.map((job) => job.id), ['engineer', 'medic']);
});

test("each pursuer's raids are beaten about as often as Con-Reg's, at the hangar and at the colony: within 10 points over 150 fights (M30, tools/raids.js)", () => {
  const rows = runRaids(rules);
  const miner = rows.find((row) => row.id === 'miner');
  for (const row of rows) {
    for (const where of ['hangar', 'colony']) assert.ok(Math.abs(row[where] - miner[where]) <= 0.1 * row.fights, `${row.id} at the ${where}: ${row[where]} won, against ${miner[where]} against Con-Reg`);
  }
  // The Provost comes fewer and tougher, the Hallorans in numbers.
  const party = (id) => rules.encounters.get(rules.backgrounds.get(id).pursuer.raiders).enemies;
  assert.ok(party('deserter').length < party('miner').length && party('smuggler').length > party('miner').length);
  assert.ok(party('deserter').every((kind) => rules.enemies.get(kind).armor >= 1));
  assert.match(raidsText(rows, rules)[2], /^Debt-bound miner +\d+% of 4 +\d+% of 4$/);
});
