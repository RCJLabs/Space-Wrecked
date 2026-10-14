import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refitShip } from '../src/sim/campaign.js';
import { removeModule } from '../src/sim/builder.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, brokenWhy, buySupplies, failingCheck, jumpPlan, knownNodes, linked, reach, scan, supplyCapacity } from '../src/sim/travel.js';
import { fitPart } from '../tools/run.js';
import { continueText } from '../src/ui/campaign/hubText.js';
import { jumpText, nodeText, sectorText } from '../src/ui/campaign/sectorText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const at = (campaign, node) => ({ ...campaign, run: { ...campaign.run, at: node, seen: [...new Set([...campaign.run.seen, node])] } });

test('the map: the sector, its nodes by column with what a jump reaches, its links, and where the ship is', () => {
  const campaign = onRun({ credits: 40 });
  const { sector } = campaign.run;
  const text = sectorText(campaign, rules);
  assert.equal(text.act, 'Act 2 · The run');
  assert.equal(text.where, `Sector 1 of ${rules.acts.get(2).sectors} · ${sector.name}`);
  assert.equal(text.nodes.length, sector.nodes.length);
  const start = text.nodes[sector.start];
  assert.deepEqual([start.here, start.seen, start.links, start.rows], [true, true, 0, 1]);
  const far = reach(sector, sector.start);
  for (const n of text.nodes) {
    assert.equal(n.links, far.get(n.id) ?? 0);
    assert.equal(n.rows, sector.nodes.filter((other) => other.col === n.col).length);
  }
  assert.ok(text.links.every(({ a, b, near }) => near === (a === sector.start || b === sector.start)));
  assert.deepEqual(text.here, { name: 'Way in', kind: '', text: rules.nodeTypes.get('start').text });
  assert.deepEqual(text.hold, [['Supplies', `${balance.baseSupplies} of ${balance.baseSupplies}`], ['Credits', '40']]);
  assert.equal(text.offer, null);
  assert.equal(text.leave, null);
  assert.match(text.hint.text, /A \? is a node not made out yet/);
  assert.equal(text.deciding, false);
});

test('what the map knows: the charted kinds and the nodes next to the route; the rest unknown until a scan', () => {
  const campaign = onRun({ heat: 30 });
  const { sector } = campaign.run;
  const text = sectorText(campaign, rules);
  for (const n of text.nodes) {
    const node = sector.nodes[n.id];
    const known = ['start', 'exit', 'station', 'nebula'].includes(node.type) || n.id === sector.start || linked(sector, sector.start).includes(n.id);
    assert.equal(n.known, known, `node ${n.id}`);
    assert.equal(n.type, known ? node.type : 'unknown');
  }
  assert.match(text.scan.text, /^A scan shows what \d+ nodes? holds? within 2 jumps, for 2 heat\. Tap again to scan\.$/);
  const scanned = scan(campaign, rules).campaign;
  const after = sectorText(scanned, rules);
  assert.ok(after.nodes.filter((n) => reach(sector, sector.start).has(n.id)).every((n) => n.known), 'a scan shows what lies in reach');
  assert.equal(after.scan, null, 'and nothing more to show from here');
  assert.match(after.hint.text, /Tap a ringed node/);
  const unknown = sector.nodes.find((node) => !knownNodes(campaign.run, rules).has(node.id));
  assert.deepEqual(nodeText(unknown, rules, { known: false }), { name: unknown.name, kind: 'Unknown', text: 'Too far to make out. Come closer, or scan.' });
  const derelict = { ...unknown, type: 'derelict', event: 'dead-hauler' };
  assert.equal(nodeText(derelict, rules).kind, 'Derelict: Dead hauler');
  assert.equal(nodeText(derelict, rules, { done: true }).kind, 'Derelict, been and done');
  assert.match(jumpText(campaign, rules, unknown.id).node.kind, /Unknown/);
});

test('a jump picked says what it eats and what heat does; out of reach, why', () => {
  const campaign = onRun({ heat: 30 });
  const { sector } = campaign.run;
  const next = linked(sector, sector.start)[0];
  const near = jumpText(campaign, rules, next);
  assert.equal(near.ok, true);
  assert.equal(near.title, `Jump to ${sector.nodes[next].name}`);
  assert.deepEqual(near.lines, [`Eats 3 supplies: ${balance.baseSupplies - 3} left.`, `Heat +${balance.jumpHeat}: ${30 + balance.jumpHeat}.`]);
  assert.deepEqual(near.way, [sector.start, next]);
  const far = [...reach(sector, sector.start)].find(([, links]) => links === 2)[0];
  const long = jumpText(campaign, rules, far);
  assert.equal(long.label, 'Long jump');
  assert.equal(long.lines[1], 'Heat −10: 20.');
  assert.equal(long.way.length, 3);
  assert.ok(linked(sector, long.way[1]).includes(far), 'through a node linked to both');
  const exit = jumpText(campaign, rules, sector.exit);
  assert.equal(exit.ok, false);
  assert.match(exit.lines[0], /too far/);
  const hungry = jumpText({ ...campaign, supplies: 1 }, rules, next);
  assert.equal(hungry.tone, 'bad');
  assert.match(hungry.lines[0], /the ship has 1: the crew goes hungry, 2 hit points each/);
  assert.equal(sectorText({ ...campaign, supplies: 1 }, rules).hint.tone, 'bad');
});

test('a station sells a jump\'s worth and a fill-up, each with its price', () => {
  const campaign = onRun({ credits: 40 });
  const station = campaign.run.sector.nodes.find((node) => node.type === 'station');
  const docked = { ...at(campaign, station.id), supplies: 10 };
  const text = sectorText(docked, rules);
  const room = balance.baseSupplies - 10;
  assert.equal(text.offer.line, `Supplies, ${balance.supplyPrice} credit${balance.supplyPrice === 1 ? '' : 's'} each. The holds take ${room} more.`);
  assert.deepEqual(text.offer.buys.map((buy) => [buy.count, buy.label]), [[3, 'Buy 3'], [room, `Fill up · ${room}`]]);
  assert.deepEqual(text.here, nodeText(station, rules));
  assert.equal(text.here.kind, 'Station');
  assert.equal(text.hint.tone, 'good');
  const broke = sectorText({ ...docked, credits: 0 }, rules);
  assert.deepEqual([broke.offer.buys, broke.offer.why], [[], 'You have 0 credits.']);
  const full = sectorText({ ...docked, supplies: balance.baseSupplies }, rules);
  assert.equal(full.offer.why, 'The holds are full.');
  const short = sectorText({ ...docked, credits: 2 * balance.supplyPrice }, rules);
  assert.deepEqual(short.offer.buys.map((buy) => buy.label), ['Buy 2'], 'as far as the credits go');
});

test('the jump point leads on, until the charts end at the act\'s last', () => {
  const campaign = onRun({ heat: 10 });
  const exit = at(campaign, campaign.run.sector.exit);
  const text = sectorText(exit, rules);
  assert.deepEqual(text.leave, { ok: true, last: false, label: 'Jump on', ask: 'Jump on?', title: 'On to sector 2', lines: [`Eats 3 supplies: ${balance.baseSupplies - 3} left.`, `Heat +${balance.jumpHeat}: ${10 + balance.jumpHeat}.`], tone: 'info' });
  assert.match(text.hint.text, /Jump on for sector 2/);
  const last = { ...exit, run: { ...exit.run, sector: { ...exit.run.sector, index: rules.acts.get(2).sectors } } };
  const end = sectorText(last, rules);
  assert.equal(end.leave.last, true);
  assert.deepEqual(end.leave.lines, [rules.acts.get(2).stub]);
  assert.match(end.hint.text, /The charts end here/);
});

test('Continue says the sector on the run', () => {
  const campaign = onRun();
  assert.equal(continueText(campaign, rules), `Act 2 · Sector 1 · ${campaign.run.sector.name}`);
  assert.equal(continueText({ ...campaign, run: null }, rules), 'Act 2 · Your ship');
});

// M23h: refits at stations.
const atStation = (extra = {}) => {
  const campaign = onRun(extra);
  return at(campaign, campaign.run.sector.nodes.find((n) => n.type === 'station').id);
};
const near = (campaign) => [...reach(campaign.run.sector, campaign.run.at)].find(([, links]) => links === 1)[0];

test("at a station the ship's panel is Refit, and the station says what is on hand to fit", () => {
  const station = atStation({ parts: { corridor: 2, medbay: 1 } });
  const text = sectorText(station, rules);
  assert.deepEqual(text.refit, { label: 'Refit', parts: 3, line: '3 parts on hand: Refit fits them, free.', broken: null });
  // The ship's panel keeps to its rows: at 821 × 283 a third doesn't fit
  // under the crew (M19), and the station's line names what is on hand.
  assert.deepEqual(text.hold.map(([label]) => label), ['Supplies', 'Credits']);
  assert.equal(sectorText(atStation({ parts: {} }), rules).refit.line, "Refit moves and turns the ship's parts, free.");
  assert.equal(sectorText(atStation({ parts: { medbay: 1 } }), rules).refit.line, 'A part on hand: Refit fits it, free.');
  // Away from a station, no Refit.
  assert.equal(sectorText(at(station, near(station)), rules).refit, null);
  // The hint says so once nothing more pressing is there: the holds full,
  // and no room for a recruit.
  const crowded = { ...station, crew: [...station.crew, { ...station.crew[2], id: 9, name: 'Ash Vey' }] };
  assert.deepEqual(sectorText(crowded, rules).hint, { tone: 'good', text: "3 parts on hand: tap Refit, on the ship's panel, to fit them, free." });
});

test('a flight check failing at the station: the hint, the panel and the jump, in the bad tone', () => {
  const station = atStation({ parts: { corridor: 2 } });
  const broken = refitShip(station, removeModule(station.ship, station.ship.modules.find((m) => m.type === 'reactor').uid), rules);
  const check = failingCheck(broken, rules);
  const text = sectorText(broken, rules);
  assert.deepEqual(text.hint, { tone: 'bad', text: brokenWhy(check) });
  assert.equal(text.refit.broken, brokenWhy(check));
  const jumpTo = jumpText(broken, rules, near(broken));
  assert.equal(jumpTo.ok, false);
  assert.equal(jumpTo.head, "Can't leave");
  assert.equal(jumpTo.tone, 'bad');
  assert.deepEqual(jumpTo.lines, [jumpPlan(broken, rules, near(broken)).error]);
  assert.match(jumpTo.lines[0], /^The ship can't leave until every flight check passes: power −7 \(0 made, 7 used\)\. Refit to fix it\.$/);
});

test('supplies past the holds after a refit: the hold row, the hint and the jump say they stay behind', () => {
  const station = atStation({ parts: { corridor: 2, cargo: 1 }, credits: 200 });
  const withHold = refitShip(station, fitPart(station.ship, rules, 'cargo').ship, rules);
  const full = buySupplies(withHold, rules, supplyCapacity(withHold.ship, rules) - withHold.supplies).campaign;
  const without = refitShip(full, station.ship, rules);
  const over = rules.modules.get('cargo').stats.cargo;
  const text = sectorText(without, rules);
  assert.deepEqual(text.hold[0], ['Supplies', `${full.supplies} of ${balance.baseSupplies}, ${over} won't fit`]);
  assert.deepEqual(text.hint, { tone: 'warn', text: `The holds take ${balance.baseSupplies} now: ${over} supplies stay behind at the next jump. Refit a hold back on to keep them.` });
  const jumpTo = jumpText(without, rules, near(without));
  assert.equal(jumpTo.ok, true);
  assert.equal(jumpTo.tone, 'warn');
  assert.equal(jumpTo.left, over);
  assert.deepEqual(jumpTo.lines.slice(0, 2), [`${over} supplies stay behind: the holds take ${balance.baseSupplies}.`, `Eats 3 supplies: ${balance.baseSupplies - 3} left.`]);
});
