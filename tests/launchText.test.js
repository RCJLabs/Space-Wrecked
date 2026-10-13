import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { launch } from '../src/sim/launch.js';
import { continueText, hangarText } from '../src/ui/campaign/hubText.js';
import { launchText, raidsText, stubText } from '../src/ui/campaign/launchText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

test('a ship ready to launch: the hangar says so, and Launch asks before it ends the act', () => {
  const text = hangarText(readyToLaunch(), rules);
  assert.equal(text.goal.ready, true);
  assert.deepEqual(text.hint, { tone: 'good', text: 'Every flight check passes. Tap Launch to lift off and end act 1.' });
  assert.deepEqual(text.launch, { ok: true, ask: 'Lift off and end act 1? The job board and the shop stay behind. Tap Launch again.' });
  assert.equal(hangarText(withBoard(newCampaign(rules, 5), rules), rules).launch.ok, false);
});

test('with a raid at the door, a ready ship can still lift off from under it', () => {
  const text = hangarText(readyToLaunch({ heat: 80 }), rules);
  assert.ok(text.raid);
  assert.equal(text.launch.ok, true);
  assert.deepEqual(text.hint, {
    tone: 'bad',
    text: 'Con-Reg Recovery is at the hangar door with a court order and a lot of friends. Launch, and leave them an empty hangar.',
  });
});

test("the launch: the act it leaves, the background's words, and the raid left behind", () => {
  const words = rules.backgrounds.get('miner').launch;
  assert.deepEqual(launchText(launch(readyToLaunch(), rules).campaign, rules), { from: 'Act 1 · Homeworld', to: 'Act 2 · The run', line: words.text, escaped: null });
  assert.equal(launchText(launch(readyToLaunch({ heat: 80 }), rules).campaign, rules).escaped, words.escaped);
});

test('the stub: act 2 with its words, how act 1 went, and the crew', () => {
  const launched = launch(readyToLaunch({ flags: { jobsDone: 7, jobsFailed: 2, raidsWon: 1 } }), rules).campaign;
  const text = stubText(launched, rules);
  assert.equal(text.act, 'Act 2 · The run');
  assert.equal(text.home, 'Your ship');
  assert.equal(text.text, rules.acts.get(2).stub);
  assert.deepEqual(text.record, {
    title: 'Act 1 · Homeworld',
    lines: [['Jobs', '7 done, 2 lost'], ['Raids', '1 fought off'], ['Credits', '140'], ['Parts on hand', 'Corridor ×2'], ['Heat', '30 · Rumors']],
  });
  assert.deepEqual(text.crew.map((member) => member.name), launched.crew.map((member) => member.name));
  assert.deepEqual(stubText(launch(readyToLaunch(), rules).campaign, rules).record.lines[0], ['Jobs', 'None'], 'the act is over: no "yet"');
  // The title's Continue: the act's home.
  assert.equal(continueText(launched, rules), 'Act 2 · Your ship');
});

test('raids in words', () => {
  assert.equal(raidsText({}), 'None');
  assert.equal(raidsText({ raidsWon: 2, raidsLost: 1 }), '2 fought off, 1 lost');
  assert.equal(raidsText({ raidsLost: 1, escapedRaid: true }), '1 lost, 1 left at the door');
});
