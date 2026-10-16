// The quests' words (M33b, src/ui/campaign/questText.js), and where the
// screens' text carries them: the hangar's panel and Launch's first tap,
// the job board, a fight's end, the chart's nodes and its last jump point,
// an event's choices and result, the colony's places, trip and odds.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withBoard } from '../src/sim/contracts.js';
import { newCampaign } from '../src/sim/campaign.js';
import { dayPlan } from '../src/sim/days.js';
import { flyOut, withPlaces } from '../src/sim/expeditions.js';
import { launch } from '../src/sim/launch.js';
import { questJobs } from '../src/sim/quests.js';
import { beginRun } from '../src/sim/travel.js';
import { dayText } from '../src/ui/campaign/colonyText.js';
import { eventText } from '../src/ui/campaign/eventText.js';
import { hangarText } from '../src/ui/campaign/hubText.js';
import { choiceQuestSaid, coldWarning, easedSaid, questJobEnd, questJobText, questNodeText, questNoteLines, questPlaceText, questsText } from '../src/ui/campaign/questText.js';
import { raidStatus } from '../src/ui/campaign/raidText.js';
import { nodeText, sectorText } from '../src/ui/campaign/sectorText.js';
import { awayText, placesText } from '../src/ui/campaign/tripText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const at = (campaign, step, id = 'debt', state = 'open') => ({ ...campaign, quests: { ...campaign.quests, [id]: { step, state } } });
const none = { credits: 0, heat: 0, standing: [] };

test("the quests' panel: each quest the campaign has, its step and what is next, or what came of it", () => {
  const start = newCampaign(rules, 5);
  assert.deepEqual(questsText(start, rules), [
    {
      id: 'debt',
      name: "The miner's debt",
      state: 'open',
      label: 'Step 1 of 3',
      next: "Rook's job, on the board: lose your file from Depot 4's terminal.",
      line: "The miner's debt: step 1 of 3. Rook's job, on the board: lose your file from Depot 4's terminal.",
    },
  ]);
  const later = at(at(start, 2), 0, 'tender', 'cold');
  assert.deepEqual(questsText(later, rules).map((q) => [q.label, q.next]), [
    ['Step 3 of 3', "Con-Reg's claims tender, within reach of the colony: Recovery holds her."],
    ['Gone cold', 'A step was left undone in its act.'],
  ]);
  const done = at(at(start, 2, 'debt', 'done'), 0, 'tender', 'done');
  assert.deepEqual(questsText(done, rules).map((q) => [q.label, q.next]), [
    ['Done', 'Con-Reg Recovery has eased off: its raids come half as often.'],
    ['Done', 'The Fleet remembers it.'],
  ]);
  assert.deepEqual(questsText({ ...start, quests: {} }, rules), []);
  // The hangar has them, and Launch's first tap names a quest it would end.
  const ready = readyToLaunch();
  assert.deepEqual(hangarText(ready, rules).quests, questsText(ready, rules));
  assert.equal(hangarText(ready, rules).launch.ask, "Lift off and end act 1? Launching ends the miner's debt: its step here isn't done. The job board and the shop stay behind. Tap Launch again.");
  assert.equal(hangarText(at(ready, 1), rules).launch.ask, 'Lift off and end act 1? The job board and the shop stay behind. Tap Launch again.');
  assert.equal(coldWarning([rules.quests.get('debt'), rules.quests.get('tender')], 'Leaving the charts'), "Leaving the charts ends the miner's debt and the tender's stores: their steps here aren't done.");
  assert.equal(coldWarning([], 'Launching'), null);
});

test("the board: a quest's job says its quest, its step and what it adds; its fight's end, the step's words", () => {
  const start = withBoard({ ...newCampaign(rules, 5), heat: 30 }, rules);
  const [offer] = questJobs(start, rules);
  assert.deepEqual(questJobText(offer, rules), { tag: "The miner's debt", fact: "Step 1 of 3 of the miner's debt. Done, heat −20 on top." });
  assert.equal(questJobText(start.board[0], rules), null);
  assert.deepEqual(questJobEnd(offer, true, start, rules), ["The miner's debt: Your file is gone from Depot 4. Con-Reg will find the paper again, but not this month.", 'Heat −20.']);
  assert.deepEqual(questJobEnd(offer, false, start, rules), []);
  assert.deepEqual(questJobEnd(start.board[0], true, start, rules), []);
});

test("what came of a quest, as an event's result, a fight's end or the homecoming says it", () => {
  const start = newCampaign(rules, 5);
  assert.deepEqual(questNoteLines({ quest: 'tender', did: 'started', step: 0, changes: none }, rules), ["A new quest: The tender's stores. The tender's stolen stores pod: marked on the chart, from the next sector on."]);
  assert.deepEqual(questNoteLines({ quest: 'debt', did: 'done', step: 1, changes: none }, rules), ["The miner's debt: step 2 of 3 done. Next: Con-Reg's claims tender, within reach of the colony: Recovery holds her."]);
  assert.deepEqual(questNoteLines({ quest: 'tender', did: 'cold', step: 0, changes: none }, rules), ["The tender's stores has gone cold."]);
  assert.deepEqual(questNoteLines({ quest: 'debt', did: 'finished', step: 2, changes: { credits: 0, heat: -30, standing: [{ side: 'conreg', by: 5, from: -10, to: -5 }] } }, rules, start), [
    "The miner's debt: done. The tender's log had the colony in it. It doesn't now: Con-Reg has to find you the hard way, and its raids come half as often.",
    'Heat −30.',
    'Con-Reg +5: now cold, −5.',
  ]);
  assert.deepEqual(questNoteLines({ quest: 'tender', did: 'finished', step: 0, changes: none }, rules), ["The tender's stores: done."]);
  assert.deepEqual(questNoteLines(null, rules), []);
});

test("the chart: a quest's node is marked and says its quest; its choices say what each does to it; the last jump point warns", () => {
  const run = beginRun(launch(at(readyToLaunch(), 1), rules).campaign, rules).campaign;
  const node = run.run.sector.nodes.find((n) => n.quest);
  const text = sectorText(run, rules);
  assert.equal(text.nodes[node.id].quest, "The miner's debt");
  assert.ok(text.nodes.filter((n) => n.quest).length === 1);
  assert.deepEqual(text.quests, questsText(run, rules));
  assert.deepEqual(questNodeText(node, rules), { name: "The miner's debt", line: "The miner's debt: Con-Reg's courier, with your paper filed again." });
  assert.deepEqual(nodeText(node, rules), { name: 'Con-Reg courier', kind: 'Distress call: Con-Reg courier', text: "The miner's debt: Con-Reg's courier, with your paper filed again." });
  // Done, the node is no longer marked.
  const done = { ...run, run: { ...run.run, at: node.id, seen: [...run.run.seen, node.id], done: [node.id] } };
  assert.equal(sectorText(done, rules).nodes[node.id].quest, null);
  // At the node, each choice's first tap says what it does to the quest.
  const there = { ...run, run: { ...run.run, at: node.id, seen: [...run.run.seen, node.id] } };
  const asks = Object.fromEntries(eventText(there, rules).choices.map((choice) => [choice.id, choice.ask]));
  assert.match(asks.board, /It does step 2 of 3 of the miner's debt\. Tap again to choose\.$/);
  assert.match(asks.fly, /The miner's debt waits for the next sector\. Tap again to choose\.$/);
  // The tender's help starts the Fleet's chain, until it has started.
  assert.equal(choiceQuestSaid(run, rules, { id: 1 }, 'fleet-tender', 'help'), "It starts a quest: The tender's stores.");
  assert.equal(choiceQuestSaid(at(run, 0, 'tender'), rules, { id: 1 }, 'fleet-tender', 'help'), null);
  assert.equal(choiceQuestSaid(run, rules, { id: 1 }, 'fleet-tender', 'stores'), null);
  // The last jump point says the quest goes cold, and warns.
  const last = rules.acts.get(2).sectors;
  const exit = { ...run, run: { ...run.run, at: run.run.sector.exit, seen: [...run.run.seen, run.run.sector.exit], sector: { ...run.run.sector, index: last } } };
  const leave = sectorText(exit, rules).leave;
  assert.equal(leave.lines[0], "Leaving the charts ends the miner's debt: its step here isn't done.");
  assert.equal(leave.tone, 'warn');
  const earlier = { ...exit, run: { ...exit.run, sector: { ...exit.run.sector, index: 1 } } };
  assert.ok(!sectorText(earlier, rules).leave.lines.some((line) => /ends/.test(line)));
});

test("the colony: the quest's place is named for its quest, held, and Next day's odds say they are halved once it is done", () => {
  const home = withPlaces(at(settled(), 2), rules);
  const rows = placesText(home, rules);
  const row = rows.at(-1);
  assert.deepEqual([row.name, row.kind, row.quest, row.line], ['Con-Reg claims tender', "The miner's debt", "The miner's debt", "The miner's debt · 2 days away · held"]);
  assert.equal(row.about, rules.quests.get('debt').steps[2].place.text);
  assert.deepEqual(questPlaceText(home.colony.places.at(-1), rules), { tag: "The miner's debt", line: rules.quests.get('debt').steps[2].place.text });
  assert.equal(questPlaceText(home.colony.places[0], rules), null);
  assert.ok(rows.slice(0, -1).every((r) => r.quest === null));
  // Flown to: who holds her, and what a win does.
  const there = flyOut(home, rules, rows.length - 1, [1, 2]).campaign;
  const away = awayText(there, rules);
  assert.equal(away.where, "The miner's debt · 2 days from home");
  assert.equal(away.held.lines[0], `${rules.quests.get('debt').steps[2].place.text} Aboard: Recovery agent ×2, Hired heavy, Company guard.`);
  assert.match(away.held.lines[1], /^Win: The miner's debt is done, and 1 of her parts and 4 to 8 materials\.$/);
  // Done: the odds halved, and said so.
  const done = { ...settled(), heat: 50, quests: { debt: { step: 2, state: 'done' } } };
  assert.equal(easedSaid(done, rules), 'half the odds since Con-Reg Recovery eased off');
  assert.equal(easedSaid({ ...done, quests: {} }, rules), null);
  const status = raidStatus(done, rules);
  assert.match(status.value, / · halved$/);
  assert.match(status.line, /Half the odds since Con-Reg Recovery eased off\.$/);
  const plan = dayPlan(done, rules);
  assert.ok(plan.found > 0);
  assert.match(dayText(plan, easedSaid(done, rules)).text, new RegExp(`${plan.found}% the colony is found tonight, half the odds since Con-Reg Recovery eased off\\.`));
});
