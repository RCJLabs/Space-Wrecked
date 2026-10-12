#!/usr/bin/env node
// A test voyage through act 2 (M19's Done when): from launch, across the
// act's sectors to where the charts end. The ship launches from a test run
// of act 1 at the same seed (tools/run.js), so it sets out with what such a
// run leaves it: its credits, heat and crew, the holds full. A test player
// does what a careful player would:
//   - at a station, fill the holds, as far as the credits go;
//   - from each node, plan every way on to the jump point, a link at a
//     time, and jump to the next node on the way that goes hungry least,
//     then carries the most supplies on out of the sector, then the most
//     credits;
//   - with --long heat (the default), when heat is at the hunters' level
//     (huntHeat) or over, make a long jump on instead, if the supplies
//     cover it and the way on from there goes hungry no more often; with
//     --long never, never.
//
//   node tools/voyage.js               a voyage from campaign seed 1, step by step
//   node tools/voyage.js --seed 7      another seed
//   node tools/voyage.js --runs 20     seeds 1 to 20, summed up
//   node tools/voyage.js --long never  no long jumps
//   node tools/voyage.js --runs 20 --set supplyPrice=2
//                                      a balance number changed for this run
//                                      only (as many --set as you like)
import { pathToFileURL } from 'node:url';
import { indexDefs } from '../src/sim/defs.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, buySupplies, hereOf, jump, jumpSupplies, leavePlan, leaveSector, linked, reach, supplyCapacity, supplyOffer } from '../src/sim/travel.js';
import { readData } from './data.js';
import { runToLaunch } from './run.js';
import { rulesWith, setting } from './sim.js';

export const LONG_POLICIES = ['heat', 'never'];
const MAX_JUMPS = 100; // a voyage still going after this many stops

// The ways on from node `id` to the sector's jump point, a link at a time:
// lists of nodes, `id` first.
function waysOn(sector, id) {
  if (id === sector.exit) return [[id]];
  const { col } = sector.nodes[id];
  return linked(sector, id)
    .filter((next) => sector.nodes[next].col > col)
    .flatMap((next) => waysOn(sector, next).map((way) => [id, ...way]));
}

// What the holds take at a station, as far as the credits go.
function fill(supplies, credits, room, price) {
  return Math.max(0, Math.min(room - supplies, Math.floor(credits / price)));
}

// How a way on goes from what the ship carries: { hungry (jumps), supplies,
// credits (what's left out of the sector) }. The jump out of the sector
// counts too, unless it is the act's last.
function wayCost(campaign, rules, way, { supplies, credits }) {
  const { sector } = campaign.run;
  const price = rules.balance.supplyPrice;
  const room = supplyCapacity(campaign.ship, rules);
  const each = jumpSupplies(campaign, rules);
  let hungry = 0;
  const eat = () => {
    if (supplies < each) hungry += 1;
    supplies = Math.max(0, supplies - each);
  };
  for (const id of way.slice(1)) {
    eat();
    if (sector.nodes[id].type === 'station') {
      const bought = fill(supplies, credits, room, price);
      supplies += bought;
      credits -= bought * price;
    }
  }
  if (leavePlan({ ...campaign, run: { ...campaign.run, at: sector.exit } }, rules).ok) eat();
  return { hungry, supplies, credits };
}

// Whether way a beats way b (or there is no b): hungry least, then the most
// supplies carried on (the next sector's stations are unknown), then the
// most credits.
function better(a, b) {
  if (!b) return true;
  if (a.hungry !== b.hungry) return a.hungry < b.hungry;
  if (a.supplies !== b.supplies) return a.supplies > b.supplies;
  return a.credits > b.credits;
}

// The best way on from node `from` with what the ship carries there.
function bestWay(campaign, rules, from, carried) {
  let best = null;
  for (const way of waysOn(campaign.run.sector, from)) {
    const cost = { ...wayCost(campaign, rules, way, carried), way };
    if (better(cost, best)) best = cost;
  }
  return best;
}

// Where the test player jumps next from where the ship is (not the jump
// point): a node id.
function nextJump(campaign, rules, policy) {
  const { sector, at } = campaign.run;
  const carried = { supplies: campaign.supplies, credits: campaign.credits };
  const way = bestWay(campaign, rules, at, carried);
  if (policy !== 'heat' || campaign.heat < rules.balance.huntHeat) return way.way[1];
  // A long jump on, where the supplies cover it and the way on from there
  // goes hungry no more often.
  const cost = jumpSupplies(campaign, rules, true);
  if (campaign.supplies < cost) return way.way[1];
  const price = rules.balance.supplyPrice;
  const room = supplyCapacity(campaign.ship, rules);
  let long = null;
  for (const [to, links] of reach(sector, at)) {
    if (links !== 2 || sector.nodes[to].col !== sector.nodes[at].col + 2) continue;
    let supplies = campaign.supplies - cost;
    let { credits } = campaign;
    if (sector.nodes[to].type === 'station') {
      const bought = fill(supplies, credits, room, price);
      supplies += bought;
      credits -= bought * price;
    }
    const on = { ...bestWay(campaign, rules, to, { supplies, credits }), to };
    if (on.hungry <= way.hungry && better(on, long)) long = on;
  }
  return long ? long.to : way.way[1];
}

// A voyage from a launched campaign (act 2, the run not yet begun) to the
// end of the charts: { ended, steps, sectors, tally, lines, campaign }.
// steps: every jump and purchase with what it moved, [before, after];
// sectors: each sector as the ship entered it.
export function voyageFrom(defs, launched, { long = 'heat', label = '' } = {}) {
  if (!LONG_POLICIES.includes(long)) throw new Error(`--long is one of ${LONG_POLICIES.join(', ')}`);
  const begun = beginRun(launched, defs);
  if (!begun.ok) throw new Error(begun.error);
  let campaign = begun.campaign;
  const steps = [];
  const sectors = [campaign.run.sector];
  const tally = { crossed: 0, jumps: 0, longJumps: 0, hungryJumps: 0, stations: 0, bought: 0, spent: 0, heat: [launched.heat, null], hp: [hpOf(campaign), null] };
  const hold = () => `${campaign.supplies} supplies, ${campaign.credits} credits, heat ${campaign.heat}`;
  const lines = [
    `${label}Launched with ${campaign.credits} credits, heat ${campaign.heat}, a crew of ${campaign.crew.length} (${hpOf(campaign)}) and ${campaign.supplies} supplies, the holds full. A jump eats ${jumpSupplies(campaign, defs)}.`,
  ];
  const sectorLine = () => {
    const { sector } = campaign.run;
    lines.push(`Sector ${sector.index}: ${sector.name}, ${sector.nodes.length} nodes, ${sector.nodes.filter((node) => node.type === 'station').length} station(s).`);
  };
  const record = (kind, before, extra = {}) => {
    const step = { kind, sector: before.run.sector.index, supplies: [before.supplies, campaign.supplies], credits: [before.credits, campaign.credits], heat: [before.heat, campaign.heat], hp: [before.crew.map((m) => m.hp), campaign.crew.map((m) => m.hp)], crew: before.crew.length, ...extra };
    steps.push(step);
    return step;
  };
  sectorLine();
  for (;;) {
    if (tally.jumps >= MAX_JUMPS) {
      lines.push(`Stopped: still going after ${MAX_JUMPS} jumps.`);
      break;
    }
    const offer = supplyOffer(campaign, defs);
    const count = offer.ok ? Math.min(offer.room, offer.most) : 0;
    if (count > 0) {
      const before = campaign;
      campaign = buySupplies(campaign, defs, count).campaign;
      record('buy', before, { count });
      tally.stations += 1;
      tally.bought += count;
      tally.spent += before.credits - campaign.credits;
      lines.push(`   Bought ${count} supplies at ${hereOf(campaign).name} for ${before.credits - campaign.credits} credits: ${hold()}.`);
    }
    const before = campaign;
    let moved;
    if (campaign.run.at === campaign.run.sector.exit) {
      if (leavePlan(campaign, defs).last) break;
      moved = leaveSector(campaign, defs);
    } else {
      moved = jump(campaign, defs, nextJump(campaign, defs, long));
    }
    if (!moved.ok) throw new Error(moved.error);
    campaign = moved.campaign;
    const { plan } = moved;
    record(plan.kind, before, { hungry: plan.hungry, to: plan.kind === 'sector' ? null : campaign.run.at });
    tally.jumps += 1;
    if (plan.kind === 'long') tally.longJumps += 1;
    if (plan.hungry) tally.hungryJumps += 1;
    // A sector is crossed when the ship reaches its jump point.
    if (campaign.run.at === campaign.run.sector.exit) tally.crossed += 1;
    const hungry = plan.hungry ? `, hungry (${hpOf(campaign)})` : '';
    if (plan.kind === 'sector') {
      sectors.push(campaign.run.sector);
      lines.push(`   Jumped on out of the sector${hungry}: ${hold()}.`);
      sectorLine();
    } else {
      const node = hereOf(campaign);
      lines.push(`   ${plan.kind === 'long' ? 'Long jump' : 'Jump'} to ${node.name}${node.type === 'station' ? ' (a station)' : ''}${hungry}: ${hold()}.`);
    }
  }
  tally.heat[1] = campaign.heat;
  tally.hp[1] = hpOf(campaign);
  const ended = leavePlan(campaign, defs).last === true;
  const where = ended ? `The charts end at sector ${campaign.run.sector.index}'s jump point` : `Stopped in sector ${campaign.run.sector.index}`;
  lines.push(
    `${where}, ${tally.crossed} sectors crossed: ${tally.jumps} jumps (${tally.longJumps} long, ${tally.hungryJumps} hungry), ${tally.bought} supplies bought at ${tally.stations} stations for ${tally.spent} credits. Heat ${tally.heat[0]} to ${tally.heat[1]}; crew ${tally.hp[0]} to ${tally.hp[1]}.`,
  );
  return { ended, steps, sectors, tally, lines, campaign };
}

// A voyage from campaign seed `seed`: act 1's test run to launch, then the
// voyage. { launched, ...voyageFrom }, or { launched: false, lines } if the
// test run stopped short.
export function voyage(defs, seed, options = {}) {
  const act1 = runToLaunch(defs, seed);
  const lifted = act1.launched ? launch(act1.campaign, defs) : null;
  if (!lifted?.ok) return { launched: false, lines: [`Campaign seed ${seed}: ${lifted?.error ?? act1.lines.at(-1)}`] };
  return { launched: true, ...voyageFrom(defs, lifted.campaign, { ...options, label: `Campaign seed ${seed}, after ${act1.jobs} jobs. ` }) };
}

// Voyages from seeds 1 to `runs`, summed up: { lines, results }.
export function manyVoyages(defs, runs, options = {}) {
  const results = [];
  for (let seed = 1; seed <= runs; seed++) results.push({ seed, ...voyage(defs, seed, options) });
  const done = results.filter((r) => r.launched);
  const spread = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const of = (key) => done.map((r) => r.tally[key]);
  // In the first three sectors: M19's Done when.
  const early = (r, test) => r.steps.filter((step) => step.sector <= 3 && test(step)).length;
  const hungryEarly = done.map((r) => early(r, (step) => step.hungry));
  const policy = options.long === 'never' ? 'never' : `when heat is at ${defs.balance.huntHeat} or over`;
  const lines = [
    `${runs} voyages from launch, campaign seeds 1 to ${runs}, long jumps ${policy}. The median, then the least and most:`,
    `Sectors crossed: ${spread(of('crossed'))}; ${done.filter((r) => r.ended).length} of ${done.length} reached the end of the charts.`,
    `Jumps: ${spread(of('jumps'))}, long ${spread(of('longJumps'))}, hungry ${spread(of('hungryJumps'))}.`,
    `In the first three sectors: restocked at ${spread(done.map((r) => early(r, (step) => step.kind === 'buy')))} stations; hungry on ${spread(hungryEarly)} jumps; fed all the way in ${hungryEarly.filter((n) => n === 0).length} of ${done.length}.`,
    `Supplies bought: ${spread(of('bought'))}, for ${spread(of('spent'))} credits. Launch credits: ${spread(done.map((r) => r.steps[0]?.credits[0] ?? 0))}.`,
    `Heat at launch: ${spread(done.map((r) => r.tally.heat[0]))}; at the end: ${spread(done.map((r) => r.tally.heat[1]))}.`,
    ...results.filter((r) => !r.launched).map((r) => r.lines.at(-1)),
  ];
  return { lines, results };
}

function hpOf(campaign) {
  return campaign.crew.map((member) => member.hp).join('/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const sets = args.flatMap((arg, i) => (arg === '--set' ? [setting(args[i + 1] ?? '')] : []));
  const made = sets.length ? rulesWith(readData(), sets) : { ok: true, rules: indexDefs(readData()) };
  if (!made.ok) throw new Error(made.error);
  const options = { long: value('--long', 'heat') };
  const runs = Number(value('--runs', 0));
  console.log((runs ? manyVoyages(made.rules, runs, options) : voyage(made.rules, Number(value('--seed', 1)), options)).lines.join('\n'));
}
