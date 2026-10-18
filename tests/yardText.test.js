// M37b: the shipyards in words. The sector map at a yard (sectorText.js):
// its kind and side, what it has left for sale, Yard and Refit, and what to
// do; a jump to one. The shop screen as the yard (yardText.js): its parts
// at its prices, the parts on hand at what it pays, the docking heat said
// first, and Map back.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { beginRun, linked } from '../src/sim/travel.js';
import { buyFromYard, yardBuyBack, yardHere } from '../src/sim/yards.js';
import { jumpText, sectorText } from '../src/ui/campaign/sectorText.js';
import { yardText } from '../src/ui/campaign/yardText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const yardOf = (campaign) => campaign.run.sector.nodes.find((node) => node.type === 'shipyard');
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });
// The ship at its first sector's yard, which is Con-Reg's, the miner's
// pursuer's (factions.json: Drydock Nine), unless renamed.
function atTheYard(extra = {}, name = null) {
  const run = onRun(extra);
  const yard = yardOf(run);
  const there = at(run, yard.id);
  if (!name) return there;
  const { sector } = there.run;
  return { ...there, run: { ...there.run, sector: { ...sector, nodes: sector.nodes.map((node) => (node.id === yard.id ? { ...node, name } : node)) } } };
}
// Every part the yard has bought out.
const soldOut = (campaign) => ({ ...campaign, run: { ...campaign.run, yarded: yardHere(campaign, rules).map((item) => ({ node: campaign.run.at, slot: item.slot })) } });

test('the map at a yard: its kind and side, what it has left, Yard and Refit, and what to do first', () => {
  const campaign = atTheYard({ credits: 500, parts: { cargo: 1 } });
  assert.equal(yardOf(campaign).name, 'Drydock Nine');
  const text = sectorText(campaign, rules);
  assert.deepEqual([text.here.name, text.here.kind], ['Drydock Nine', 'Shipyard · Con-Reg']);
  assert.equal(text.station.line, "Con-Reg's yard: hostile, prices 150%.");
  const prices = yardHere(campaign, rules).map((item) => item.price);
  assert.deepEqual(text.yard, { label: 'Yard', parts: 12, line: `12 parts for sale, ${Math.min(...prices)} to ${Math.max(...prices)} credits. The yard buys parts on hand too.` });
  assert.equal(text.refit.line, 'A part on hand: Refit fits it, free.');
  assert.deepEqual([text.offer, text.rack, text.patch, text.repair, text.swap], [null, null, null, null, null], "a station's trades stay at stations");
  assert.deepEqual(text.hint, { tone: 'warn', text: 'Con-Reg is after you, and this is their yard: your first trade here adds 10 heat. Passing through costs nothing.' });
  // On the chart: charted, in its side's color.
  const mark = text.nodes.find((n) => n.id === campaign.run.at);
  assert.deepEqual([mark.type, mark.known, mark.side.name], ['shipyard', true, 'Con-Reg']);
  const far = sectorText(at(campaign, campaign.run.sector.start), rules).nodes.find((n) => n.id === campaign.run.at);
  assert.deepEqual([far.type, far.known], ['shipyard', true], 'known from the way in');
  // Docked: what to do there.
  const docked = buyFromYard(campaign, rules, 0).campaign;
  assert.deepEqual(sectorText(docked, rules).hint, { tone: 'good', text: "2 parts on hand: Refit, on the ship's panel, fits them, free. Tap Yard to buy parts, or sell what you have." });
  // Nobody's yard: no side, and nothing to fit.
  const nobodys = atTheYard({ credits: 500, parts: {} }, 'The Gantry');
  const plain = sectorText(nobodys, rules);
  assert.deepEqual([plain.station, plain.here.kind, plain.nodes[nobodys.run.at].side], [null, 'Shipyard', null]);
  assert.deepEqual(plain.hint, { tone: 'good', text: 'Tap Yard to buy parts, or sell what you have.' });
  assert.equal(plain.refit.line, "Refit moves and turns the ship's parts, free.");
  // Bought out.
  const empty = sectorText(soldOut(nobodys), rules);
  assert.deepEqual([empty.yard.parts, empty.yard.line, empty.hint.text], [0, 'Sold out. The yard buys parts on hand too.', 'The yard is sold out, but buys parts: tap Yard.']);
  // Away from a yard, no Yard.
  assert.equal(sectorText(at(campaign, campaign.run.sector.start), rules).yard, null);
});

test("a jump to a yard: the pursuer's side's says what trading there adds, and the hunters keep clear", () => {
  const run = onRun({ heat: 60 });
  const yard = yardOf(run);
  const next = run.run.sector.nodes.find((node) => linked(run.run.sector, node.id).includes(yard.id) && node.id < yard.id);
  // A node next to the yard, what it held settled.
  const there = at(run, next.id);
  const plan = jumpText({ ...there, run: { ...there.run, done: [...there.run.done, next.id] } }, rules, yard.id);
  assert.ok(plan.ok, plan.lines.join(' | '));
  assert.ok(plan.lines.includes('Con-Reg is after you, and this is their yard: trading there adds 10 heat. Passing through costs nothing.'), plan.lines.join(' | '));
  assert.ok(plan.lines.includes('The hunters keep clear of yards.'), plan.lines.join(' | '));
  assert.equal(plan.hunt, 0);
});

test('the shop screen as the yard: its parts at its prices, yours at what it pays, the docking heat first, and Map back', () => {
  const campaign = atTheYard({ credits: 500, parts: { cargo: 1 } });
  const text = yardText(campaign, rules);
  assert.deepEqual([text.yard, text.title, text.name, text.dealer, text.back], [true, 'Shipyard', 'Drydock Nine', "Con-Reg's yard: hostile, prices 150%.", { label: 'Map', screen: 'sector' }]);
  assert.equal(text.pitch, rules.nodeTypes.get('shipyard').text);
  assert.equal(text.credits, '500 credits');
  const stock = yardHere(campaign, rules);
  assert.deepEqual(text.stock.map((item) => [item.slot, item.key, item.price, item.action, item.ask]), stock.map((item) => [item.slot, item.part, `${item.price} credits`, `Buy · ${item.price}`, `Buy for ${item.price}?`]));
  assert.ok(text.stock.every((item) => item.weapon === null && item.needed === null && item.facts.length === 2));
  const back = yardBuyBack(campaign, rules, 'cargo');
  assert.deepEqual(text.held.map((item) => [item.key, item.count, item.price, item.ok, item.action]), [['cargo', 1, `${back} credits`, true, `Sell · ${back}`]]);
  // The heat of the first trade, said before it is made; none once docked.
  assert.equal(text.dock, 'Con-Reg logs the ship: heat +10 to 40.');
  assert.deepEqual(text.hint, { tone: 'warn', text: 'Con-Reg is after you, and this is their yard: your first trade here adds 10 heat.' });
  const docked = yardText(buyFromYard(campaign, rules, 0).campaign, rules);
  assert.equal(docked.dock, '');
  assert.deepEqual(docked.hint, { tone: 'info', text: 'Pick a part to read about it. Bought, it goes on hand: Refit fits it, back on the map. The yard buys yours too.' });
  assert.equal(docked.stock.length, 11);
  // Short of credits, why not.
  const poor = yardText({ ...campaign, credits: 0 }, rules);
  const [first] = poor.stock;
  assert.deepEqual([first.ok, first.why], [false, `The ${first.name.toLowerCase()} is ${stock[0].price} credits.`]);
  // Bought out, and with nothing to sell.
  const bare = yardText(soldOut(atTheYard({ credits: 500, parts: {} }, 'The Gantry')), rules);
  assert.deepEqual([bare.stock, bare.held, bare.hint.text, bare.dealer], [[], [], 'The yard is sold out, and you have no parts to sell.', "Nobody's yard: full prices."]);
  assert.equal(yardText(soldOut(atTheYard({ credits: 500, parts: { cargo: 1 } }, 'The Gantry')), rules).hint.text, 'The yard is sold out, but buys parts: pick one of yours to sell.');
  // Away from a yard, none.
  assert.equal(yardText(at(campaign, campaign.run.sector.start), rules), null);
});
