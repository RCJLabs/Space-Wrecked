// Quests (M33b): the backgrounds' threads, a step in each act, and the
// Fleet's chain from its tender (src/sim/quests.js, data/quests.json).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/save.js';
import { campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { endJob, takeQuestJob, withBoard } from '../src/sim/contracts.js';
import { chooseEvent } from '../src/sim/events.js';
import { boardPlace, endPlaceFight, flyHome, flyOut, placeFightDue, withPlaces } from '../src/sim/expeditions.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { jobHeat } from '../src/sim/heat.js';
import { launch } from '../src/sim/launch.js';
import { startingQuests } from '../src/sim/questShape.js';
import { coldAt, eased, openStep, placeQuests, questJobs, questPlaces, stepDone } from '../src/sim/quests.js';
import { foundOdds } from '../src/sim/raids.js';
import { beginRun, knownNodes, leavePlan, leaveSector } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const THREADS = { miner: 'debt', deserter: 'pardon', smuggler: 'cargo' };
const winner = (campaign, side) => ({ ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, winner: side } } });
// The miner's thread at step `step` (0 up), open.
const at = (campaign, step, id = 'debt') => ({ ...campaign, quests: { ...campaign.quests, [id]: { step, state: 'open' } } });
// On the run, the first sector entered with the thread's run step open.
const onRun = (extra = {}) => beginRun(launch(at(readyToLaunch(extra), 1), rules).campaign, rules).campaign;
// The ship moved to node id, as if it had jumped there.
const moveTo = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });
// The ship at its sector's jump point, the sector the act's `index`th.
const atExit = (campaign, index) => ({ ...moveTo(campaign, campaign.run.sector.exit), run: { ...moveTo(campaign, campaign.run.sector.exit).run, sector: { ...campaign.run.sector, index } } });

test("a new campaign starts its background's thread at its first step, and only its own", () => {
  for (const [background, id] of Object.entries(THREADS)) {
    const campaign = newCampaign(rules, 1, { background });
    assert.deepEqual(campaign.quests, { [id]: { step: 0, state: 'open' } }, background);
    assert.equal(rules.quests.get(id).steps[0].act, 1);
    assert.deepEqual(campaignProblems(campaign), []);
  }
  // Content with no thread for a background starts none; the Fleet's chain
  // starts with no campaign.
  assert.deepEqual(startingQuests({ ...rules, quests: new Map([...rules.quests].filter(([id]) => id !== 'debt')) }, 'miner'), {});
  assert.ok(!('tender' in newCampaign(rules, 1).quests));
});

test("act 1: the thread's job is offered above the board, off its rotation, and the board's rolls don't move", () => {
  const start = withBoard({ ...newCampaign(rules, 5), heat: 30 }, rules);
  const [offer] = questJobs(start, rules);
  assert.deepEqual(Object.keys(offer).sort(), ['client', 'contract', 'credits', 'part', 'quest', 'seed', 'site', 'twist']);
  assert.deepEqual([offer.contract, offer.quest, offer.client, offer.site, offer.twist, offer.part], ['losepaper', 'debt', 'rook', 'depot', null, null]);
  assert.ok(offer.credits >= 40 && offer.credits <= 60 && offer.credits % 5 === 0, `${offer.credits}`);
  assert.ok(start.board.every((job) => !rules.contracts.jobs.get(job.contract).quest), 'never on the board itself');
  // The board and the shop are what they were before quests, roll for roll.
  const plain = { ...rules, quests: new Map() };
  const before = withBoard({ ...newCampaign(plain, 5), heat: 30 }, plain);
  assert.deepEqual([before.board, before.shop, before.rng], [start.board, start.shop, start.rng]);
  // The offer holds until a job is done or lost.
  assert.deepEqual(questJobs({ ...start, heat: 50, credits: 999 }, rules), [offer]);
  // Taken, it is a job's fight, with its quest.
  const taken = takeQuestJob(start, rules, 'debt');
  assert.equal(taken.ok, true, taken.error);
  assert.deepEqual(taken.campaign.fight.job, offer);
  assert.equal(taken.campaign.fight.encounter, 'guards');
  assert.equal(takeQuestJob(start, rules, 'cargo').ok, false, "another background's thread offers nothing here");
  // Lost: the step stays open, and the next offer is new.
  const lost = endJob(winner(taken.campaign, 'enemy'), rules);
  assert.deepEqual(lost.quests, { debt: { step: 0, state: 'open' } });
  const again = questJobs(lost, rules)[0];
  assert.equal(again.contract, 'losepaper');
  assert.notEqual(again.seed, offer.seed);
  // Done: the pay, the job's heat and the step's (heat -20), and the next
  // step open, on the run; no more offer.
  const done = endJob(winner(taken.campaign, 'crew'), rules);
  assert.deepEqual(done.quests, { debt: { step: 1, state: 'open' } });
  assert.equal(done.credits, start.credits + offer.credits);
  assert.equal(done.heat, start.heat + jobHeat(offer, rules).heat - 20);
  assert.deepEqual(questJobs(done, rules), []);
  assert.deepEqual(campaignProblems(done), []);
});

test('the trail goes cold: launching with the job undone ends the thread, and Launch can say so first', () => {
  const ready = readyToLaunch();
  assert.deepEqual(coldAt(ready, rules, 1).map((quest) => quest.id), ['debt']);
  const gone = launch(ready, rules);
  assert.deepEqual(gone.cold, ['debt']);
  assert.deepEqual(gone.campaign.quests, { debt: { step: 0, state: 'cold' } });
  assert.equal(openStep(gone.campaign, rules, 'debt'), null);
  // With the job done, the thread goes on to the run.
  const kept = launch(at(ready, 1), rules);
  assert.deepEqual([kept.cold, kept.campaign.quests], [[], { debt: { step: 1, state: 'open' } }]);
  assert.deepEqual(coldAt(at(ready, 1), rules, 1), []);
});

test("the run: the step's event is put on a node of each sector entered, seeded, on the charts and named for it", () => {
  const run = onRun();
  const node = run.run.sector.nodes.find((n) => n.quest);
  assert.ok(node, 'the first sector has it');
  assert.deepEqual([node.quest, node.event, node.name, node.type], ['debt', 'refiled', 'Con-Reg courier', 'distress']);
  assert.ok(knownNodes(run.run, rules).has(node.id), 'on the charts from the first');
  // The same sector as with nothing open but the one node, and no roll of
  // the campaign's moved.
  const plain = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  assert.equal(plain.rng, run.rng);
  assert.deepEqual(run.run.sector.nodes.map((n) => (n.id === node.id ? null : n)), plain.run.sector.nodes.map((n) => (n.id === node.id ? null : n)));
  assert.ok(!plain.run.sector.nodes.some((n) => n.quest));
  // Over many sectors: never the way in, the jump point, a station, a
  // nebula or a hostile ship's node; one of the event's kind where there is
  // one; always the same node for the same seed.
  const campaign = at(readyToLaunch(), 1);
  for (let seed = 1; seed <= 300; seed++) {
    const sector = generateSector(rules, seed, 2);
    const placed = placeQuests(sector, campaign, rules);
    const changed = placed.nodes.filter((n, i) => n !== sector.nodes[i]);
    assert.equal(changed.length, 1, `seed ${seed}`);
    const [quest] = changed;
    const before = sector.nodes[quest.id];
    assert.ok(quest.id !== sector.start && quest.id !== sector.exit && !['station', 'nebula'].includes(before.type) && !before.hostile, `seed ${seed}: ${before.type}`);
    if (sector.nodes.some((n) => n.type === 'distress')) assert.equal(before.type, 'distress', `seed ${seed}`);
    assert.deepEqual(placeQuests(sector, campaign, rules), placed);
  }
  // Nothing open on the run, nothing placed; the system past the charts never.
  const sector = generateSector(rules, 7, 2);
  assert.equal(placeQuests(sector, readyToLaunch(), rules), sector);
  assert.equal(placeQuests({ ...sector, system: true }, campaign, rules).nodes, sector.nodes);
});

test("the run's event: its choice does the step; left, it is in the next sector again; done, it is placed no more", () => {
  const run = onRun({ heat: 40 });
  const node = run.run.sector.nodes.find((n) => n.quest);
  const there = moveTo(run, node.id);
  // Keep flying: the step stays open, and the next sector has the event.
  const passed = chooseEvent(there, rules, 'fly');
  assert.equal(passed.ok, true, passed.error);
  assert.equal(passed.result.quest, undefined);
  assert.deepEqual(passed.campaign.quests, { debt: { step: 1, state: 'open' } });
  const next = leaveSector(atExit(passed.campaign, 1), rules);
  assert.equal(next.ok, true, next.error);
  assert.ok(next.campaign.run.sector.nodes.some((n) => n.quest === 'debt' && n.event === 'refiled'));
  // Find your file: the outcome's heat, and the step done: the colony's
  // place is next.
  const done = chooseEvent(there, rules, 'board');
  assert.equal(done.ok, true, done.error);
  assert.deepEqual(done.campaign.quests, { debt: { step: 2, state: 'open' } });
  assert.deepEqual(done.result.quest, { quest: 'debt', did: 'done', step: 1, changes: { credits: 0, heat: 0, standing: [] } });
  assert.equal(done.result.changes.heat, -15);
  assert.equal(done.campaign.heat, there.heat - 15);
  assert.deepEqual(campaignProblems(done.campaign), []);
  const after = leaveSector(atExit(done.campaign, 1), rules).campaign;
  assert.ok(!after.run.sector.nodes.some((n) => n.quest));
});

test('the trail goes cold on the run too: leaving the last sector ends a step still open there, and its plan says so', () => {
  const run = onRun();
  const last = rules.acts.get(2).sectors;
  const exit = atExit(run, last);
  assert.deepEqual(leavePlan(exit, rules).cold, ['debt']);
  const left = leaveSector(exit, rules);
  assert.equal(left.ok, true, left.error);
  assert.deepEqual(left.cold, ['debt']);
  assert.deepEqual(left.campaign.quests, { debt: { step: 1, state: 'cold' } });
  // A sector before the last: nothing goes cold.
  assert.deepEqual(leavePlan(atExit(run, 1), rules).cold, []);
  assert.deepEqual(leaveSector(atExit(run, 1), rules).cold, []);
});

test("the colony: the step's place is on the list until done, her ship held by the pursuer's men", () => {
  const home = at(settled(), 2);
  const listed = withPlaces(home, rules);
  const place = listed.colony.places.at(-1);
  assert.deepEqual(place, { kind: 'hulk', name: 'Con-Reg claims tender', days: 2, event: null, held: true, seed: place.seed, quest: 'debt' });
  assert.deepEqual(questPlaces(home, rules), [place]);
  assert.equal(listed.colony.places.length, rules.expeditions.places + 1);
  assert.deepEqual(campaignProblems(listed), []);
  // A list rolled before the step opened gets it after the others.
  const old = withPlaces(settled(), rules);
  assert.deepEqual(withPlaces(at(old, 2), rules).colony.places, [...old.colony.places, place]);
  // Flown to: the step's party aboard the step's ship.
  const index = listed.colony.places.length - 1;
  const there = flyOut(listed, rules, index, [1, 2]).campaign;
  const due = placeFightDue(there, rules);
  assert.equal(due.preset.id, 'repotug');
  assert.deepEqual(due.party, rules.encounters.get('raid').enemies);
  assert.equal(due.encounter, 'raid');
  const begun = boardPlace(there, rules);
  assert.equal(begun.ok, true, begun.error);
  assert.equal(begun.campaign.fight.encounter, 'raid');
  // Lost: home hurt, and she is still there.
  const lost = endPlaceFight(winner(begun.campaign, 'enemy'), rules);
  assert.deepEqual(lost.quests, { debt: { step: 2, state: 'open' } });
  assert.equal(lost.colony.trip.result.quest, undefined);
  const back = flyHome(lost, rules).campaign;
  assert.ok(back.colony.places.some((p) => p.quest === 'debt'));
  // Won: the thread done, and its pay-off.
  const won = endPlaceFight(winner({ ...begun.campaign, heat: 60 }, 'crew'), rules);
  assert.deepEqual(won.quests, { debt: { step: 2, state: 'done' } });
  assert.equal(won.heat, 30);
  assert.equal(won.standing.conreg, rules.balance.coldStanding);
  assert.deepEqual(won.colony.trip.result.quest, { quest: 'debt', did: 'finished', step: 2, changes: { credits: 0, heat: -30, standing: [{ side: 'conreg', by: 5, from: -10, to: -5 }] } });
  assert.deepEqual(campaignProblems(won), []);
  const landed = flyHome(won, rules).campaign;
  assert.ok(!landed.colony.places.some((p) => p.quest), 'no more place once done');
});

test('the pay-off eases the pursuer off: its raids find the colony at easedOdds percent of the odds, rounded', () => {
  const home = settled();
  const done = { ...home, quests: { debt: { step: 2, state: 'done' } } };
  assert.equal(eased(home, rules), false);
  assert.equal(eased(done, rules), true);
  assert.equal(eased({ ...home, quests: { debt: { step: 2, state: 'cold' } } }, rules), false);
  for (const heat of [10, 25, 50, 75, 100]) {
    for (const lanes of [1, 2, 3]) {
      const world = { ...home.colony.world, lanes };
      const odds = foundOdds({ ...home, heat, colony: { ...home.colony, world } }, rules);
      const halved = foundOdds({ ...done, heat, colony: { ...home.colony, world } }, rules);
      const base = [0, 3, 6, 10, 15][[10, 25, 50, 75, 100].indexOf(heat)];
      const share = [150, 100, 50][lanes - 1];
      assert.equal(odds, Math.round((base * share) / 100), `heat ${heat}, lanes ${lanes}`);
      assert.equal(halved, Math.round((base * share * rules.balance.easedOdds) / 10000), `heat ${heat}, lanes ${lanes}`);
    }
  }
  // Each pay-off raises the pursuer's side no higher than cold, and never
  // lowers it.
  const friendly = stepDone({ ...at(home, 2), standing: { ...home.standing, conreg: 3 } }, rules, 'debt');
  assert.equal(friendly.campaign.standing.conreg, 3);
  assert.deepEqual(friendly.note.changes.standing, []);
});

test("the Fleet's chain starts at its tender, is the next sector's stores pod, and is done by tagging it or gone cold by stripping it", () => {
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const id = run.run.sector.nodes.find((n) => n.type !== 'start' && n.type !== 'exit' && n.type !== 'station').id;
  const tender = moveTo({ ...run, supplies: 20, run: { ...run.run, sector: { ...run.run.sector, nodes: run.run.sector.nodes.map((n) => (n.id === id ? { ...n, type: 'distress', event: 'fleet-tender', hostile: undefined } : n)) } } }, id);
  // Raiding her stores or flying on starts nothing.
  for (const choice of ['stores', 'fly']) assert.ok(!('tender' in chooseEvent(tender, rules, choice).campaign.quests), choice);
  const helped = chooseEvent(tender, rules, 'help');
  assert.deepEqual(helped.campaign.quests.tender, { step: 0, state: 'open' });
  assert.deepEqual(helped.result.quest, { quest: 'tender', did: 'started', step: 0, changes: { credits: 0, heat: 0, standing: [] } });
  assert.equal(helped.campaign.standing.fleet, 2, "the tender's own +2: friendly with the Fleet");
  assert.ok(!helped.campaign.run.sector.nodes.some((n) => n.quest === 'tender'), 'not in the sector it started in');
  // A second tender starts nothing more.
  assert.equal(chooseEvent({ ...tender, quests: { ...tender.quests, tender: { step: 0, state: 'done' } } }, rules, 'help').result.quest, undefined);
  // The next sector has her pod.
  const next = leaveSector(atExit(helped.campaign, 1), rules).campaign;
  const pod = next.run.sector.nodes.find((n) => n.quest === 'tender');
  assert.deepEqual([pod.event, pod.type, pod.name], ['storespod', 'derelict', 'Stolen stores pod']);
  const there = moveTo(next, pod.id);
  const tagged = chooseEvent(there, rules, 'tag');
  assert.deepEqual(tagged.campaign.quests.tender, { step: 0, state: 'done' });
  assert.equal(tagged.result.quest.did, 'finished');
  assert.deepEqual([tagged.campaign.standing.fleet, tagged.campaign.credits], [6, there.credits + 25]);
  const stripped = chooseEvent(there, rules, 'strip');
  assert.deepEqual(stripped.campaign.quests.tender, { step: 0, state: 'cold' });
  assert.equal(stripped.result.quest.did, 'cold');
  assert.equal(stripped.campaign.standing.fleet, 0);
  const left = chooseEvent(there, rules, 'leave');
  assert.deepEqual(left.campaign.quests.tender, { step: 0, state: 'open' });
});

test("saves: v28 for quests; a v27 campaign gets its background's thread at its act's step, none cold; broken ones are caught", () => {
  const step = MIGRATIONS.find((s) => s.from === 27);
  const up = (campaign) => step.up({ campaign }).campaign;
  const ready = readyToLaunch();
  const { quests, ...v27 } = ready;
  assert.ok(quests);
  assert.deepEqual(up(v27).quests, { debt: { step: 0, state: 'open' } });
  const run = onRun();
  const { quests: q2, ...v27run } = run;
  assert.ok(q2);
  assert.deepEqual(up(v27run).quests, { debt: { step: 1, state: 'open' } });
  assert.deepEqual(up({ ...v27run, run: null }).quests, { debt: { step: 1, state: 'open' } });
  assert.deepEqual(up({ ...v27run, run: { ...v27run.run, sector: { ...v27run.run.sector, system: true } } }).quests, { debt: { step: 2, state: 'open' } });
  const { quests: q3, ...v27colony } = settled();
  assert.ok(q3);
  assert.deepEqual(up(v27colony).quests, { debt: { step: 2, state: 'open' } });
  for (const background of Object.keys(THREADS)) assert.deepEqual(up({ ...v27, background }).quests, { [THREADS[background]]: { step: 0, state: 'open' } });
  assert.deepEqual(up({ ...v27, background: 'pilgrim' }).quests, {});
  assert.equal(step.up({ campaign: null }).campaign, null);
  // Broken ones are caught.
  const broken = (campaign) => campaignProblems(campaign);
  assert.deepEqual(broken({ ...ready, quests: undefined }), ["The campaign's quests are unreadable."]);
  assert.deepEqual(broken({ ...ready, quests: { debt: { step: 0, state: 'lost' } } }), ["The campaign's quests are unreadable."]);
  assert.deepEqual(broken({ ...ready, quests: { debt: { step: 9, state: 'open' } } }), ["The campaign's quests are unreadable."]);
  const node = run.run.sector.nodes.find((n) => n.quest);
  const { event, ...bare } = node;
  assert.ok(event);
  const noEvent = { ...run, run: { ...run.run, sector: { ...run.run.sector, nodes: run.run.sector.nodes.map((n) => (n.id === node.id ? bare : n)) } } };
  assert.deepEqual(broken(noEvent), ["The campaign's run has an unreadable map."]);
  const home = withPlaces(at(settled(), 2), rules);
  const unheld = { ...home, colony: { ...home.colony, places: home.colony.places.map((p) => (p.quest ? { ...p, held: false } : p)) } };
  assert.deepEqual(broken(unheld), ["The campaign's colony is unreadable."]);
});
