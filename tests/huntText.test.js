// M24's words: the run's heat meter, the hunters' chance in a jump's plan
// and on the chart, Regroup and Hide, the transponder swap, the hints that
// say how to shed heat, and the approach screen when the hunters are there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { FACED } from '../src/sim/approach.js';
import { HEAT_MAX, maxHp, newCampaign } from '../src/sim/campaign.js';
import { giveOrder } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { approachText } from '../src/ui/campaign/approachText.js';
import { heatText } from '../src/ui/campaign/hubText.js';
import { jumpText, sectorText } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const pursuer = rules.backgrounds.get('miner').pursuer;
const tug = rules.ships.get(pursuer.run.hunters).name;
const gunship = rules.ships.get(pursuer.run.taskForce).name;
// The ship at the first node of kind `type`, made one where the sector has
// none (the first of the mix's kinds: a sector need hold no empty space,
// M37b): for the tests, no jump.
function atKind(campaign, type) {
  const { sector } = campaign.run;
  const found = sector.nodes.find((node) => node.type === type) ?? sector.nodes.find((node) => Object.hasOwn(rules.sectors.mix, node.type));
  const nodes = sector.nodes.map((node) => (node.id === found.id ? { ...node, type, event: undefined, hostile: undefined } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes }, at: found.id, seen: [...new Set([...campaign.run.seen, found.id])] } };
}
// A node a jump from here of kind `type`, made one: its id and the campaign.
function nextTo(campaign, type) {
  const { sector, at } = campaign.run;
  const to = linked(sector, at)[0];
  const nodes = sector.nodes.map((node) => (node.id === to ? { ...node, type, event: undefined, hostile: undefined } : node));
  return { to, campaign: { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes } } } };
}
const hurt = (campaign) => ({ ...campaign, crew: campaign.crew.map((member) => ({ ...member, hp: maxHp(member, rules) - 4 })) });

test("on the run the meter names the run's levels, with the pursuer's words; at the hangar, act 1's", () => {
  const meter = (heat) => heatText(onRun({ heat }), rules);
  assert.deepEqual([meter(0).name, meter(30).name, meter(55).name, meter(80).name, meter(100).name], ['Calm', 'Rumors', 'Hunters', 'Task force', 'Cornered']);
  assert.deepEqual([meter(80).level, meter(80).line], ['taskForce', pursuer.run.levels.taskForce]);
  assert.equal(meter(100).line, pursuer.run.levels.cornered);
  const hangar = heatText({ ...newCampaign(rules, 1), heat: 80 }, rules);
  assert.deepEqual([hangar.name, hangar.line], ['Raid', pursuer.levels.raid]);
});

test("a jump's plan says the hunters' chance where it comes out, by the heat it comes out with", () => {
  const warm = nextTo(onRun({ heat: balance.huntHeat - balance.jumpHeat }), 'empty');
  const plan = jumpText(warm.campaign, rules, warm.to);
  assert.ok(plan.lines.includes(`Hunters: ${balance.huntChance}% the ${tug} waits there.`), plan.lines.join(' | '));
  assert.deepEqual([plan.tone, plan.hunt], ['warn', balance.huntChance]);
  const hot = nextTo(onRun({ heat: HEAT_MAX }), 'empty');
  const certain = jumpText(hot.campaign, rules, hot.to);
  assert.ok(certain.lines.includes(`The ${gunship} will be waiting there.`));
  assert.equal(certain.tone, 'bad');
  const station = nextTo(onRun({ heat: HEAT_MAX }), 'station');
  assert.ok(jumpText(station.campaign, rules, station.to).lines.includes('The hunters keep clear of stations.'));
  const nebula = nextTo(onRun({ heat: HEAT_MAX }), 'nebula');
  assert.ok(jumpText(nebula.campaign, rules, nebula.to).lines.includes("The nebula hides the ship: the hunters can't see in."));
  const cool = nextTo(onRun({ heat: 10 }), 'empty');
  assert.ok(!jumpText(cool.campaign, rules, cool.to).lines.some((line) => /hunters|waits|waiting/i.test(line)));
  // The chart rings the nodes they may wait at.
  const text = sectorText(hot.campaign, rules);
  assert.equal(text.nodes[hot.to].hunt, 100);
  assert.ok(text.nodes.filter((n) => !n.links).every((n) => n.hunt === 0), 'none out of reach');
  // Leaving the sector says it too.
  const exit = { ...hot.campaign, run: { ...hot.campaign.run, at: hot.campaign.run.sector.exit } };
  assert.ok(sectorText(exit, rules).leave.lines.includes(`The ${gunship} will be waiting there.`));
});

test('Regroup away from stations, Hide in a nebula, nothing at a station: what each says', () => {
  const resting = sectorText(hurt(atKind(onRun({ heat: 20 }), 'empty')), rules).rest;
  assert.deepEqual([resting.kind, resting.label, resting.ask, resting.tone], ['regroup', 'Regroup', 'Regroup?', 'info']);
  assert.equal(resting.text, `A day's rest eats 3 supplies, heat +${balance.regroupHeat} to ${20 + balance.regroupHeat}. Each of the wounded heals ${balance.regroupHp}. Tap again to regroup.`);
  const hot = sectorText(hurt(atKind(onRun({ heat: 60 }), 'empty')), rules).rest;
  assert.match(hot.text, new RegExp(`Hunters: ${balance.huntChance}% the ${tug} finds you`));
  assert.equal(hot.tone, 'warn');
  const hiding = sectorText(atKind(onRun({ heat: 60 }), 'nebula'), rules).rest;
  assert.deepEqual([hiding.kind, hiding.label, hiding.ask], ['hide', 'Hide', 'Hide a day?']);
  assert.equal(hiding.text, `A day hidden in the nebula eats 3 supplies, heat −${-balance.hideHeat} to ${60 + balance.hideHeat}. Tap again to hide.`);
  assert.equal(sectorText(hurt(atKind(onRun({ heat: 60 }), 'station')), rules).rest, null);
  assert.equal(sectorText(atKind(onRun({ heat: 20 }), 'empty'), rules).rest, null, 'no one hurt, nothing to hide from');
});

test('the transponder swap at a station: its price and heat, two taps; gone once swapped, and short of credits it says why', () => {
  const campaign = atKind(onRun({ heat: 60, credits: 100 }), 'station');
  const { swap } = sectorText(campaign, rules);
  assert.deepEqual(swap, {
    ok: true,
    label: `Transponder · ${balance.swapPrice}`,
    ask: `Swap for ${balance.swapPrice}?`,
    text: `A clean transponder, once a sector: heat −${-balance.swapHeat} to ${60 + balance.swapHeat}, for ${balance.swapPrice} credits. Tap again to swap.`,
    why: null,
  });
  assert.equal(sectorText({ ...campaign, run: { ...campaign.run, swapped: true } }, rules).swap, null);
  assert.equal(sectorText({ ...campaign, heat: 0 }, rules).swap, null);
  const broke = sectorText({ ...campaign, credits: 10 }, rules).swap;
  assert.equal(broke.ok, false);
  assert.match(broke.why, /A swap is \d+ credits\. You have 10\./);
  assert.equal(sectorText(atKind(onRun({ heat: 60, credits: 100 }), 'empty'), rules).swap, null);
});

test('with the hunters out, the hint says how to shed heat: the swap here, hiding here, or long jumps and the rest', () => {
  const station = atKind(onRun({ heat: 60, credits: 100 }), 'station');
  assert.match(sectorText({ ...station, supplies: balance.baseSupplies }, rules).hint.text, /Heat 60: the hunters are out\. A clean transponder here sheds 30, for 40\./);
  const nebula = atKind(onRun({ heat: 60 }), 'nebula');
  assert.match(sectorText(nebula, rules).hint.text, /Hide here a day to shed 10/);
  const open = atKind(onRun({ heat: 60 }), 'empty');
  assert.match(sectorText(open, rules).hint.text, /the hunters may wait where you jump\. A long jump sheds heat; so do nebulae and a station's transponder swap/);
  assert.match(sectorText(hurt(atKind(onRun({ heat: 20 }), 'empty')), rules).hint.text, /The crew is hurt: Regroup rests a day here, for heat/);
});

test('the approach screen names the hunters, says what facing them buys, and what it did to heat', () => {
  const start = onRun({ heat: HEAT_MAX });
  const to = linked(start.run.sector, start.run.at).find((id) => !['station', 'nebula'].includes(start.run.sector.nodes[id].type));
  const met = jump(start, rules, to).campaign;
  const text = approachText(met, rules);
  assert.equal(text.where, `The hunters · ${gunship}`);
  assert.equal(text.them.name, 'The gunship');
  assert.match(text.hint.text, new RegExp(`^${pursuer.name}'s hunters were waiting\\. Facing them buys quiet; getting away doesn't\\.`));
  // Played out on dice that face them, and on dice that get away.
  const ends = new Map();
  for (let seed = 1; seed <= 80 && ends.size < 2; seed++) {
    let campaign = { ...met, rng: seedFrom(seed) };
    for (let i = 0; i < 10 && !campaign.run.approach.outcome; i++) {
      const given = giveOrder(campaign, rules, seed % 2 ? { kind: 'flee' } : { kind: 'fire', at: 'engines' });
      campaign = given.ok ? given.campaign : giveOrder(campaign, rules, { kind: 'evade' }).campaign;
    }
    const faced = FACED.includes(campaign.run.approach.outcome.kind);
    if (!ends.has(faced)) ends.set(faced, approachText(campaign, rules).outcome.lines);
  }
  assert.ok(ends.get(true).some((line) => line === `Heat −${HEAT_MAX - balance.heatAfterRaid}, to ${balance.heatAfterRaid}: ${pursuer.run.faced}`), ends.get(true).join(' | '));
  if (ends.has(false)) assert.ok(ends.get(false).some((line) => /^Still on your trail: heat \d+\.$/.test(line)), ends.get(false).join(' | '));
});
