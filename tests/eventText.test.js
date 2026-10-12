import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { sellPriceOf } from '../src/sim/economy.js';
import { chooseEvent } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { beginRun } from '../src/sim/travel.js';
import { changesText, effectsText, eventText, resultText } from '../src/ui/campaign/eventText.js';
import { sectorText } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

// A campaign at node 1 with event `id` open there.
function atEvent(id, extra = {}) {
  const campaign = beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
  const kind = rules.events.get(id).kind;
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === 1 ? { ...node, type: kind, event: id } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: 1, seen: [0, 1] } };
}

test('an open event: where it is, its words, and each choice with its odds and what each outcome does', () => {
  const campaign = atEvent('dead-hauler');
  const text = eventText(campaign, rules);
  const node = campaign.run.sector.nodes[1];
  assert.equal(text.where, `Derelict · ${node.name}`);
  assert.equal(text.title, 'Dead hauler');
  assert.equal(text.text, rules.events.get('dead-hauler').text);
  const [strip, loose, leave] = text.choices;
  assert.equal(strip.odds, '70% · 30%');
  assert.deepEqual(strip.outcomes, [
    { chance: 70, says: '+10 credits, a salvaged part' },
    { chance: 30, says: 'someone hurt (3 hit points), a salvaged part' },
  ]);
  assert.equal(strip.ask, 'Strip it: 70%: +10 credits, a salvaged part. 30%: someone hurt (3 hit points), a salvaged part. Tap again to choose.');
  assert.deepEqual([loose.odds, loose.ask], ['', "Grab what's loose: +6 credits, +4 supplies. Tap again to choose."]);
  assert.equal(leave.outcomes[0].says, 'nothing');
  assert.ok(text.choices.every((choice) => choice.ok && choice.why === null));
  assert.equal(sectorText(campaign, rules).deciding, true);
  assert.equal(sectorText(campaign, rules).hint.text, 'Decide first: Dead hauler.');
});

test('a choice that can not be paid says what it needs; a sale names the part it would sell', () => {
  const miner = eventText({ ...atEvent('stalled-miner'), supplies: 2 }, rules);
  assert.deepEqual([miner.choices[0].ok, miner.choices[0].why], [false, 'Needs 3 supplies.']);
  const dealer = eventText({ ...atEvent('scrap-dealer'), parts: { engine: 1, corridor: 2 } }, rules);
  assert.equal(dealer.choices[0].outcomes[0].says, `your Engine sold for ${sellPriceOf('engine', rules)} credits`);
  assert.equal(effectsText({ part: 'armory', heat: -6, wound: { hp: 2, all: true } }, atEvent('ion-storm'), rules), 'heat −6, everyone hurt (2 hit points), an Armory');
});

test('after a choice: what happened, the roll against the odds, and what it came to', () => {
  const at = { ...atEvent('dead-hauler'), rng: seedFrom(3) };
  const made = chooseEvent(at, rules, 'strip');
  const text = resultText(made.campaign, rules);
  const outcome = rules.events.get('dead-hauler').choices[0].outcomes[made.result.outcome];
  assert.equal(text.title, 'Dead hauler: Strip it');
  assert.equal(text.text, outcome.text);
  assert.equal(text.roll, `Rolled ${made.result.roll}: the ${outcome.chance}% came up.`);
  assert.equal(eventText(made.campaign, rules), null, 'settled: nothing open');
  const sure = resultText(chooseEvent(atEvent('dead-hauler'), rules, 'loose').campaign, rules);
  assert.deepEqual([sure.roll, sure.changes], ['', '+6 credits.'], 'no roll; the holds were full, so the supplies go spare');
  assert.equal(resultText(atEvent('dead-hauler'), rules), null);
});

test('what changes came to, in words', () => {
  const campaign = atEvent('dead-hauler');
  const kim = campaign.crew[1];
  const words = changesText({ credits: 15, supplies: -3, heat: 8, wounds: [{ id: kim.id, hp: 1 }], parts: ['armory'], sold: [{ part: 'engine', credits: 100 }] }, campaign, rules);
  assert.equal(words, `+15 credits, −3 supplies, heat +8. Found: an Armory. Sold: the Engine, for 100 credits. ${kim.name} hurt (1 hit point).`);
  assert.equal(changesText({ credits: 0, supplies: 0, heat: 0, wounds: [], parts: [], sold: [] }, campaign, rules), 'Nothing changes.');
});
