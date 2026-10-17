// M36's words: who would take a choice that needs someone, or who it
// needs; a trap, wrecks and repairs in a choice's odds and in what came of
// it; a trap's approach, her volley first; and a trap at the colony's
// places. As in eventKinds.test.js, the tests add events of their own to
// the content, so they hold whatever data/events.json says.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeApproach, giveOrder } from '../src/sim/encounter.js';
import { applyEffects, chooseEvent } from '../src/sim/events.js';
import { chooseAtPlace, flyOut } from '../src/sim/expeditions.js';
import { launch } from '../src/sim/launch.js';
import { hasTag } from '../src/sim/modules.js';
import { wrecksToRepair } from '../src/sim/repair.js';
import { beginRun } from '../src/sim/travel.js';
import { approachText } from '../src/ui/campaign/approachText.js';
import { changesText, effectsText, eventText, resultText } from '../src/ui/campaign/eventText.js';
import { awayText } from '../src/ui/campaign/tripText.js';
import { rules as content } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const choice = (id, label, needs, ...outcomes) => ({ id, label, ...(needs ? { needs } : {}), outcomes: outcomes.map(([chance, effects, text]) => ({ chance, text: text ?? `${label}.`, effects })) });
const leave = choice('leave', 'Leave it', null, [100, {}]);
const EVENTS = [
  { id: 't-rig', kind: 'derelict', title: 'Rig it', text: 'A test.', choices: [choice('rig', 'Rig it', { job: 'engineer' }, [80, { credits: 5 }], [20, { wound: { hp: 2 } }]), choice('dare', 'Dare', { trait: 'hothead' }, [100, { credits: 5 }]), leave] },
  { id: 't-bait', kind: 'distress', title: 'Bait', text: 'A test.', choices: [choice('answer', 'Answer', null, [100, { ambush: 'cutter' }, 'They were waiting.']), leave] },
  { id: 't-den', kind: 'hulk', title: 'Den', text: 'A test.', choices: [choice('search', 'Search her', { job: 'medic' }, [100, { ambush: true }, 'They never left.']), leave] },
];
const rules = { ...content, events: new Map([...content.events, ...EVENTS.map((event) => [event.id, event])]) };
const NOTHING = { credits: 0, supplies: 0, heat: 0, wounds: [], parts: [], sold: [], standing: [] };
const name = (type) => rules.modules.get(type).name;
const hittable = (module) => ['weapon', 'pointdefense', 'engine', 'shield', 'reactor'].some((tag) => hasTag(rules.modules.get(module.type), tag));

const onRun = () => beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
// On the run at node 1, with event `id` open there.
function atEvent(id, campaign = onRun()) {
  const type = rules.events.get(id).kind;
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === 1 ? { ...node, type, event: id, hostile: undefined } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: 1, seen: [...new Set([...campaign.run.seen, 1])] } };
}

test('a choice that needs someone names who takes it, and a wound falls on them in the odds; one no one can take says who it needs', () => {
  const there = atEvent('t-rig');
  const engineer = there.crew.find((member) => member.job === 'engineer');
  const [rig, dare] = eventText(there, rules).choices;
  assert.equal(rig.taker, engineer.name);
  assert.deepEqual(rig.outcomes.map((outcome) => outcome.says), ['+5 credits', `${engineer.name} hurt (2 hit points)`]);
  assert.equal(rig.ask, `Rig it: ${engineer.name} takes it. 80%: +5 credits. 20%: ${engineer.name} hurt (2 hit points). Tap again to choose.`);
  assert.deepEqual([dare.ok, dare.why, dare.taker], [false, 'Needs someone with the Hothead trait aboard.', '']);
  // At their last hit point, the wound falls by a roll: the odds say someone.
  const worn = { ...there, crew: there.crew.map((member) => (member.id === engineer.id ? { ...member, hp: 1 } : member)) };
  assert.equal(eventText(worn, rules).choices[0].outcomes[1].says, 'someone hurt (2 hit points)');
  // No engineer aboard: who it needs, and nobody named.
  const none = eventText({ ...there, crew: there.crew.filter((member) => member.job !== 'engineer') }, rules).choices[0];
  assert.deepEqual([none.ok, none.why, none.taker], [false, 'Needs an Engineer aboard.', '']);
});

test('a trap, wrecks and repairs in the odds, a repair naming the dearest wrecks; and in what came of them', () => {
  const run = onRun();
  const cutter = rules.ships.get('cutter').name;
  assert.equal(effectsText({ ambush: 'cutter' }, run, rules), `a trap: a ${cutter}, firing first`);
  assert.equal(effectsText({ ambush: true }, run, rules), 'a trap: a fight for her');
  assert.equal(effectsText({ wreck: 1 }, run, rules), 'a part aboard wrecked');
  assert.equal(effectsText({ supplies: 6, wreck: 2 }, run, rules), '+6 supplies, 2 parts aboard wrecked');
  assert.equal(effectsText({ repair: 1 }, run, rules), 'a repair, with nothing wrecked');
  const two = Object.fromEntries(run.ship.modules.filter(hittable).slice(0, 2).map((module) => [module.uid, 'rubble']));
  const wrecked = { ...run, wrecks: two };
  const [dearest, next] = wrecksToRepair(wrecked, rules).sort((a, b) => b.price - a.price || a.uid - b.uid);
  assert.equal(effectsText({ repair: 1, credits: -20 }, wrecked, rules), `−20 credits, the ${name(dearest.type)} repaired`);
  assert.equal(effectsText({ repair: 2 }, wrecked, rules), `the ${name(dearest.type)} and the ${name(next.type)} repaired`);
  // What came of them.
  const hit = applyEffects(run, rules, { wreck: 2 });
  const said = changesText(hit.changes, hit.campaign, rules);
  assert.ok(hit.changes.wrecked.length > 0);
  assert.match(said, /^Wrecked: /);
  for (const part of hit.changes.wrecked) assert.match(said, new RegExp(`the ${name(part.type)} \\((on fire|open to vacuum|full of rubble)\\)`));
  if (hit.changes.rigged.length) assert.match(said, / going again\.$/);
  const fixed = applyEffects(wrecked, rules, { repair: 1 });
  assert.equal(changesText(fixed.changes, fixed.campaign, rules), `Repaired: the ${name(dearest.type)}.`);
  assert.equal(changesText({ ...NOTHING, ambush: 'cutter' }, run, rules), `A trap: a ${cutter} fired first.`);
  assert.equal(changesText({ ...NOTHING, ambush: true }, run, rules), 'A trap: they hold her now.');
});

test("a trap's approach says so, in the event's words, her volley first; and the event's result says what sprang it", () => {
  const sprung = chooseEvent(atEvent('t-bait'), rules, 'answer').campaign;
  const text = approachText(sprung, rules);
  assert.equal(text.where, `A trap · ${sprung.run.approach.enemy.name}`);
  assert.deepEqual(text.hint, { tone: 'bad', text: 'They were waiting. Tap an order to see its odds; tap it again to give it.' });
  if (sprung.run.approach.last) {
    assert.equal(text.lastHead, 'They opened fire');
    assert.ok(text.last.length >= 1, 'her volley, a line a gun');
  }
  // Played out and put away: the event's card says what came of it.
  let at = sprung;
  while (!at.run.approach.outcome) at = giveOrder(at, rules, { kind: 'flee' }).campaign;
  const closed = closeApproach(at);
  if (closed.ok) {
    const result = resultText(closed.campaign, rules);
    assert.equal(result.title, 'Bait: Answer');
    assert.equal(result.text, 'They were waiting.');
    assert.match(result.changes, new RegExp(`A trap: a ${rules.ships.get('cutter').name} fired first\\.`));
  }
});

test("at a place: a choice needs its someone in the squad, and a trap leaves her held with the squad's fight to come", () => {
  const colony = settled();
  const place = { kind: 'hulk', name: 'Long Haul', days: 1, event: 't-den', held: false, seed: 7 };
  const listed = { ...colony, colony: { ...colony.colony, places: [place] } };
  const medic = colony.crew.find((member) => member.job === 'medic');
  const marine = colony.crew.find((member) => member.job === 'marine');
  // The medic home: the squad can't search her.
  const alone = awayText(flyOut(listed, rules, 0, [marine.id]).campaign, rules);
  const search = alone.event.choices.find((entry) => entry.id === 'search');
  assert.deepEqual([search.ok, search.why, search.taker], [false, 'Needs a Medic in the squad.', '']);
  // With her, she takes it, and the odds say the trap.
  const out = flyOut(listed, rules, 0, [marine.id, medic.id]).campaign;
  const ready = awayText(out, rules).event.choices.find((entry) => entry.id === 'search');
  assert.deepEqual([ready.ok, ready.taker], [true, medic.name]);
  assert.equal(ready.ask, `Search her: ${medic.name} takes it. A trap: a fight for her. Tap again to choose.`);
  // Sprung: what came of it, and the squatters to board, or leave.
  const sprung = awayText(chooseAtPlace(out, rules, 'search').campaign, rules);
  assert.equal(sprung.event, null);
  assert.ok(sprung.held, 'the fight is there to board');
  assert.deepEqual([sprung.result.title, sprung.result.text], ['Den: Search her', 'They never left. A trap: they hold her now.']);
  assert.equal(sprung.home.ok, true, 'or fly home and leave her be');
});
