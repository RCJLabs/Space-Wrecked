import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { beginRun, linked, reach } from '../src/sim/travel.js';
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
  assert.match(text.hint.text, /Tap a ringed node/);
});

test('a jump picked says what it eats and what heat does; out of reach, why', () => {
  const campaign = onRun({ heat: 30 });
  const { sector } = campaign.run;
  const next = linked(sector, sector.start)[0];
  const near = jumpText(campaign, rules, next);
  assert.equal(near.ok, true);
  assert.equal(near.title, `Jump to ${sector.nodes[next].name}`);
  assert.deepEqual(near.lines, [`Eats 3 supplies: ${balance.baseSupplies - 3} left.`, 'Heat +3: 33.']);
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
  assert.deepEqual(text.leave, { ok: true, last: false, label: 'Jump on', ask: 'Jump on?', title: 'On to sector 2', lines: [`Eats 3 supplies: ${balance.baseSupplies - 3} left.`, 'Heat +3: 13.'], tone: 'info' });
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
