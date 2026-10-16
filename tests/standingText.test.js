// The words for standing (src/ui/campaign/standingText.js, M33) where they
// show: the sides on the homes' panels with how far to the next level; a
// change where it happens, with the level it leaves; a job's sides and its
// pay with the bonus; a station's side and prices; the docking heat and a
// patrol's greeting in the jump plan; and the patrol's words on the
// approach screen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { chooseEvent } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { approachText } from '../src/ui/campaign/approachText.js';
import { colonyText } from '../src/ui/campaign/colonyText.js';
import { changesText, effectsText, resultText } from '../src/ui/campaign/eventText.js';
import { hangarText } from '../src/ui/campaign/hubText.js';
import { jobOutcome, jobText } from '../src/ui/campaign/jobText.js';
import { jumpText, nodeText, sectorText } from '../src/ui/campaign/sectorText.js';
import { bonusText, changeLines, jobEndLines, jobSidesText, patrolWords, sidesText, stationText } from '../src/ui/campaign/standingText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const STOOD = { conreg: -10, fleet: -3, hallorans: 0, union: 4 };
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The first node on from the way in made into `node`, nothing else on the
// map holding anything: { campaign, to }.
function ahead(campaign, node) {
  const { sector } = campaign.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...rest }) => (rest.id === to ? { ...rest, ...node } : rest));
  return { campaign: { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes } } }, to };
}
const there = ({ campaign, to }) => ({ ...campaign, run: { ...campaign.run, at: to, seen: [...campaign.run.seen, to] } });

test('the sides on the homes\' panels: each one\'s level and number, colored by it, and how far to the next', () => {
  const campaign = { ...newCampaign(rules, 7), standing: STOOD };
  const sides = sidesText(campaign, rules);
  assert.deepEqual(
    sides.map(({ side, name, level, label, next }) => [side, name, level, label, next]),
    [
      ['conreg', 'Con-Reg', 'hostile', 'Hostile −10', '5 to cold'],
      ['fleet', 'The Fleet', 'cold', 'Cold −3', '2 to neutral'],
      ['hallorans', 'The Hallorans', 'neutral', 'Neutral 0', '2 to friendly'],
      ['union', 'The union', 'friendly', 'Friendly +4', '2 to trusted'],
    ],
  );
  assert.ok(sides.every((row) => /^#[0-9a-f]{6}$/.test(row.color)), 'each in its side\'s color');
  assert.match(sides[0].line, /^Con-Reg: hostile, −10\. 5 more to cold\. Consolidated Regolith/);
  assert.equal(sidesText({ ...campaign, standing: { ...STOOD, union: 10 } }, rules)[3].next, 'The most there is');
  // The hangar's, the chart's and the colony's.
  assert.deepEqual(hangarText(withBoard(campaign, rules), rules).sides, sides);
  assert.deepEqual(sectorText(onRun({ standing: STOOD }), rules).sides, sides);
  assert.deepEqual(colonyText({ ...settled(), standing: STOOD }, rules).sides, sides);
});

test('a change says where it leaves the side: now another level, the same one, or as far as it goes', () => {
  const lines = changeLines(
    [
      { side: 'union', by: 2, from: 0, to: 2 },
      { side: 'union', by: 1, from: 2, to: 3 },
      { side: 'conreg', by: -1, from: -10, to: -10 },
      { side: 'fleet', by: -3, from: -8, to: -10 },
      { side: 'hallorans', by: 2, from: 10, to: 10 },
    ],
    rules,
  );
  assert.deepEqual(lines, [
    'The union +2: now friendly, +2.',
    'The union +1: friendly, +3.',
    'Con-Reg −1: still hostile, −10, as low as it goes.',
    'The Fleet −2: hostile, −10.',
    'The Hallorans +2: still trusted, +10, as high as it goes.',
  ]);
  assert.deepEqual(changeLines(undefined, rules), [], 'an approach or result saved before M33 has none');
});

// The steward's payroll job, for the union and against Con-Reg's guards.
const PAYROLL = { contract: 'payroll', client: 'marta', site: 'pit9', twist: null, seed: 7, credits: 120, part: null };

test("the job board: whom a job is for and against, and its pay with what a friendly side adds", () => {
  const campaign = { ...newCampaign(rules, 9), standing: { ...STOOD, union: 2 } };
  assert.equal(jobSidesText(PAYROLL, campaign, rules), 'For the union (friendly): +2 done. Against Con-Reg (hostile): −2 done or lost.');
  assert.equal(jobSidesText({ ...PAYROLL, contract: 'scrap', client: 'dutch', site: 'yard' }, campaign, rules), null);
  assert.equal(jobSidesText(PAYROLL, null, rules), 'For the union: +2 done. Against Con-Reg: −2 done or lost.', 'tools/jobs.js, with no campaign');
  const words = jobText(PAYROLL, rules, [], campaign);
  assert.deepEqual([words.sides, words.pay, words.bonus], [jobSidesText(PAYROLL, campaign, rules), '130 credits', '+10%: the union is friendly']);
  assert.deepEqual([jobText(PAYROLL, rules).pay, jobText(PAYROLL, rules).bonus], ['120 credits', null], 'without a campaign, the pay on the board');
  assert.equal(bonusText(PAYROLL, { ...campaign, standing: { ...STOOD, union: 6 } }, rules), '+20%: the union is trusted');
  assert.equal(bonusText(PAYROLL, { ...campaign, standing: STOOD }, rules), '+10%: the union is friendly');
  assert.equal(bonusText(PAYROLL, { ...campaign, standing: { ...STOOD, union: 1 } }, rules), null);
  // The fight's end: the pay with its bonus, and what the job moved.
  const battle = { winner: 'crew' };
  assert.equal(jobOutcome(battle, PAYROLL, rules, [], campaign).text, 'Paid 130 credits (+10%: the union is friendly). Heat +8.');
  assert.deepEqual(jobEndLines(campaign, rules, PAYROLL, true), ['The union +2: friendly, +4.', 'Con-Reg −2: still hostile, −10, as low as it goes.']);
  assert.deepEqual(jobEndLines({ ...campaign, standing: { ...STOOD, conreg: 0 } }, rules, PAYROLL, false), ['Con-Reg −2: now cold, −2.']);
});

test("a station's side on the chart, and in its services its prices at the crew's level", () => {
  const hall = there(ahead(onRun({ standing: STOOD }), { type: 'station', name: 'Union Hall Twelve' }));
  const node = hall.run.sector.nodes[hall.run.at];
  assert.deepEqual(nodeText(node, rules), { name: 'Union Hall Twelve', kind: 'Station · The union', text: rules.nodeTypes.get('station').text });
  assert.deepEqual(stationText(node, hall, rules), { side: 'union', name: 'The union', color: sidesText(hall, rules)[3].color, line: "The union's station: friendly, prices 90%.", tone: 'good' });
  const text = sectorText(hall, rules);
  assert.equal(text.station.line, "The union's station: friendly, prices 90%.");
  assert.match(text.offer.line, /^Supplies, 1 credit each, 90% here\./);
  assert.deepEqual(text.nodes[hall.run.at].side, { name: 'The union', color: text.station.color });
  const depot = there(ahead(onRun({ standing: STOOD }), { type: 'station', name: 'The Depot' }));
  assert.deepEqual([stationText(depot.run.sector.nodes[depot.run.at], depot, rules).line, sectorText(depot, rules).station.tone], ["Con-Reg's station: hostile, prices 150%.", 'warn']);
  const pumps = there(ahead(onRun({ standing: STOOD }), { type: 'station', name: "Mac's Pumps" }));
  assert.equal(sectorText(pumps, rules).station, null, "nobody's station");
  assert.equal(sectorText(pumps, rules).nodes[pumps.run.at].side, null);
});

test("the jump plan: the heat of docking with the pursuer's side, and how a side's patrol will greet the crew", () => {
  const set = ahead(onRun({ standing: STOOD }), { type: 'station', name: 'The Depot' });
  const plan = jumpText(set.campaign, rules, set.to);
  assert.ok(plan.lines.includes(`Con-Reg is after you, and this is their station: docking adds 10 heat, to ${set.campaign.heat + rules.balance.jumpHeat + 10}.`), plan.lines.join(' | '));
  assert.equal(plan.tone, 'warn');
  assert.ok(!jumpText(ahead(onRun({ standing: STOOD }), { type: 'station', name: 'Union Hall Twelve' }).campaign, rules, set.to).lines.some((line) => /docking/.test(line)));
  const patrol = (fleet) => {
    const near = ahead(onRun({ standing: { ...STOOD, fleet } }), { type: 'hostile', hostile: { ship: 'corvette', seed: 1 } });
    return jumpText(near.campaign, rules, near.to).lines;
  };
  assert.ok(patrol(2).includes('The Fleet is friendly with you: the patrol corvette will wave you through.'));
  assert.ok(patrol(-6).includes('The Fleet is hostile to you: the patrol corvette will open fire before you can act.'));
  assert.ok(!patrol(0).some((line) => /The Fleet/.test(line)), 'neutral: nothing to say');
});

test("the approach screen: a patrol waving the ship through, one opening fire, and what striking a side's ship cost", () => {
  const meet = (fleet) => {
    const near = ahead(onRun({ standing: { ...STOOD, fleet } }), { type: 'hostile', hostile: { ship: 'corvette', seed: 1 } });
    return jump(near.campaign, rules, near.to).campaign;
  };
  const waved = approachText(meet(2), rules);
  const fleet = rules.factions.sides.get('fleet');
  assert.deepEqual([waved.round, waved.outcome.title, waved.outcome.lines], ['Over', 'The corvette waves you through.', [fleet.patrol.waved]]);
  assert.equal(waved.hint.text, 'Carry on to the chart.');
  const fired = meet(-6);
  const text = approachText(fired, rules);
  assert.equal(text.lastHead, 'They opened fire');
  assert.match(text.last[0], /^Their \d guns at your guns, \d+%: /);
  assert.deepEqual([text.hint.tone, text.hint.text], ['bad', `${fleet.patrol.fired} Tap an order to see its odds; tap it again to give it.`]);
  assert.equal(patrolWords(fired.run.approach, rules), fleet.patrol.fired);
  assert.equal(approachText(meet(0), rules).lastHead, 'Last round', 'neutral: as before');
  // An end that struck her names what it cost.
  const struck = { ...fired, run: { ...fired.run, done: [...fired.run.done, fired.run.at], approach: { ...fired.run.approach, outcome: { kind: 'destroyed', changes: { credits: 30, parts: [], lost: null, heat: 4, patched: [], standing: [{ side: 'fleet', by: -3, from: -6, to: -9 }] }, boarding: null } } } };
  assert.ok(approachText(struck, rules).outcome.lines.includes('The Fleet −3: hostile, −9.'));
});

test("an event's odds and its result say what it moves with the sides", () => {
  const campaign = onRun({ standing: { ...STOOD, union: 0 } });
  const tow = rules.events.get('stalled-miner').choices.find((c) => c.id === 'tow');
  assert.equal(effectsText(tow.outcomes[0].effects, campaign, rules), '+25 credits, −3 supplies, the union +1');
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === 1 ? { ...node, type: 'distress', event: 'stalled-miner' } : node));
  const at = { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: 1, seen: [...campaign.run.seen, 1] } };
  const chose = chooseEvent(at, rules, 'crate').campaign;
  assert.equal(resultText(chose, rules).changes, '−2 supplies, heat −4. The union +1: neutral, +1.');
  assert.equal(changesText({ credits: 0, supplies: 0, heat: 0, materials: 0, wounds: [], parts: [], sold: [] }, campaign, rules), 'Nothing changes.', 'a result saved before M33');
});
