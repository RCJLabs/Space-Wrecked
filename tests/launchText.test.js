import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { launch } from '../src/sim/launch.js';
import { hangarText } from '../src/ui/campaign/hubText.js';
import { landingText, launchText } from '../src/ui/campaign/launchText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

test('a ship ready to launch: the hangar says so, and Launch asks before it ends the act', () => {
  const text = hangarText(readyToLaunch(), rules);
  assert.equal(text.goal.ready, true);
  assert.deepEqual(text.hint, { tone: 'good', text: 'Every flight check passes. Tap Launch to lift off and end act 1.' });
  // The miner's act 1 step isn't done, so the ask says Launching ends it
  // (M33b, tests/questText.test.js has the ask without it).
  assert.deepEqual(text.launch, { ok: true, ask: "Lift off and end act 1? Launching ends the miner's debt: its step here isn't done. The job board and the shop stay behind. Tap Launch again." });
  assert.equal(hangarText(withBoard(newCampaign(rules, 5), rules), rules).launch.ok, false);
});

test('with a raid at the door, a ready ship can still lift off from under it', () => {
  const text = hangarText(readyToLaunch({ heat: 80 }), rules);
  assert.ok(text.raid);
  assert.equal(text.launch.ok, true);
  assert.deepEqual(text.hint, {
    tone: 'bad',
    text: 'Con-Reg Recovery is at the hangar door with a court order and a lot of friends. Win: 30% to pick up one of their weapons. Launch, and leave them an empty hangar.',
  });
});

test("the launch: the act it leaves, the background's words, and the raid left behind", () => {
  const words = rules.backgrounds.get('miner').launch;
  assert.deepEqual(launchText(launch(readyToLaunch(), rules).campaign, rules), { from: 'Act 1 · Homeworld', to: 'Act 2 · The run', line: words.text, escaped: null });
  assert.equal(launchText(launch(readyToLaunch({ heat: 80 }), rules).campaign, rules).escaped, words.escaped);
});

test('the landing: the world settled, its kind\'s words, and the act it begins', () => {
  const campaign = settled(2);
  const { world } = campaign.colony;
  const kind = rules.worlds.kinds.get(world.kind);
  // where: the line under the heading, the world alone for the first
  // colony (M38e names a later one there).
  assert.deepEqual(landingText(campaign, rules), { world: `${world.name} · ${kind.name}`, to: 'Act 3 · The colony', where: `${world.name} · ${kind.name}`, line: kind.landing });
});
