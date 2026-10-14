#!/usr/bin/env node
// A test run of act 1 (M16's Done when): from New game until every line of
// the flight checklist passes and the ship can launch. A test player does
// what a careful player would, taking any maker's version of a part the
// checklist asks for (M23g). At the hangar, in this order:
//   - fit each part on hand the checklist needs, where it touches the most
//     of the ship (fitPart);
//   - sell the parts on hand it doesn't need;
//   - buy what it needs, if the shop has it and there are the credits;
//   - face a raid that is due, unless a payment heads it off;
//   - pay heat down when the next job would bring the hunters (or, with
//     --heat, only before a raid, or never);
//   - take the job worth most: its pay and its part, at the odds the test
//     crew has had on that job and twist.
// In a fight the crew is played by the job player (src/sim/jobAi.js), or
// in a raid by the AI; the enemy by the AI, pressing on in a raid.
//
// Time on the phone is an estimate from what the run did, at the pace in
// PACE: seconds for an order in a fight, watching an enemy turn, reading
// the board, fitting a part, a visit to the shop and a payment, each
// [quick, slow]. Orders are counted as tools/sim.js counts them, and an
// order's 8 to 12 s is the estimate Gate 2 was passed on.
//
//   node tools/run.js                a run from campaign seed 1, step by step
//   node tools/run.js --seed 7       another seed
//   node tools/run.js --runs 20      seeds 1 to 20, summed up
//   node tools/run.js --heat raids   pay heat down only before a raid
//   node tools/run.js --heat never   never pay
//   node tools/run.js --difficulty easy   (or hard) the enemy as the
//                                    difficulty setting has it
import { pathToFileURL } from 'node:url';
import { aiAction } from '../src/sim/ai.js';
import { playFrom } from '../src/sim/autoplay.js';
import { applyCommand, layoutProblems, occupancy } from '../src/sim/builder.js';
import { newCampaign, partsNeeded, refitShip, shipChecklist } from '../src/sim/campaign.js';
import { canLaunch } from '../src/sim/constraints.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { indexDefs } from '../src/sim/defs.js';
import { buyPart, priceOf, sellPart, sellPriceOf } from '../src/sim/economy.js';
import { cellAt, SIDES, step } from '../src/sim/grid.js';
import { jobHeat, makePayment, paymentFor, raidDue } from '../src/sim/heat.js';
import { jobAction } from '../src/sim/jobAi.js';
import { baseOf, countOfAny, versionAtHand } from '../src/sim/makers.js';
import { placedCells } from '../src/sim/modules.js';
import { pressAction } from '../src/sim/press.js';
import { beginRaid, endRaid } from '../src/sim/raid.js';
import { DIFFICULTIES } from '../src/sim/settings.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { readData } from './data.js';

// Seconds on the phone, [quick, slow].
export const PACE = {
  order: [8, 12], // an order in a fight: tap to preview, tap to confirm
  enemyTurn: [6, 10], // watching an enemy turn play out, End turn and all
  board: [20, 40], // reading the job board and taking a job
  fit: [30, 60], // fitting a part in construction mode
  shop: [15, 30], // a visit to the shop
  pay: [3, 6], // a payment on the debt
};
// How often the test crew wins each job at heat 0, and how a twist moves
// that: its record over 750 jobs in M16 (every job on the first board of
// campaign seeds 1 to 250). A careful player learns which jobs go badly.
// A job not here counts at its mission's rate.
const JOB_ODDS = { payroll: 0.86, repo: 0.89, ledger: 0.78, manifest: 0.66, supplies: 0.61, jumpers: 0.56, scrap: 0.54, debts: 0.48, rent: 0.42, picket: 0.03 };
const MISSION_ODDS = { clear: 0.39, grab: 0.69, hack: 0.76 };
const TWIST_ODDS = { overtime: 0.6, cavein: 0.75, hazard: 0.75, rush: 0.75, lights: 1, skeleton: 1.4 };
const HEAT_POLICIES = ['raids', 'hunters', 'never'];
const MAX_ROUNDS = 60; // a fight still going after this many stops the run
const MAX_JOBS = 30; // a run not at launch after this many stops

// The ship with a part of `type` fitted where the builder's rules allow it
// and the layout stays whole (every part joined to the bridge, every
// exhaust and barrel facing space), touching as much of the ship as it
// can; ties go to the first row, then column, then turn. Returns { ship,
// at: { x, y, rot } }, or null if it fits nowhere.
export function fitPart(ship, defs, type) {
  const def = defs.modules.get(type);
  const frame = defs.frames.get(ship.frame);
  if (!def || !frame) return null;
  const taken = occupancy(ship, defs);
  const touching = (at) => placedCells(def, at).reduce((sum, [x, y]) => sum + SIDES.filter((side) => (cellAt(taken, ...step(x, y, side)) ?? null) !== null).length, 0);
  let best = null;
  for (const rot of def.rotates ? [0, 1, 2, 3] : [0]) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const placed = applyCommand(ship, defs, { op: 'place', type, x, y, rot });
        if (!placed.ok || layoutProblems(placed.ship, defs).length) continue;
        const score = touching({ x, y, rot });
        if (!best || score > best.score) best = { ship: placed.ship, at: { x, y, rot }, score };
      }
    }
  }
  return best && { ship: best.ship, at: best.at };
}

// What a job on the board is worth to the run: its pay and its part (the
// price of one the checklist needs, else what the shop would pay for it),
// at the test crew's odds on it.
function jobWorth(job, campaign, defs, needed) {
  const contract = defs.contracts.jobs.get(job.contract);
  const part = job.part ? (needOf(needed, job.part, defs) ? priceOf(job.part, defs) : sellPriceOf(job.part, defs)) ?? 0 : 0;
  const odds = (JOB_ODDS[job.contract] ?? MISSION_ODDS[contract.mission] ?? 0.5) * (TWIST_ODDS[job.twist] ?? 1);
  return Math.min(0.95, odds) * (job.credits + part);
}

// How many of a part the checklist still asks for, any maker's version
// counting as the part (needed is partsNeeded's, by base part).
function needOf(needed, type, defs) {
  return needed[baseOf(defs.modules.get(type) ?? { id: type })] ?? 0;
}

// A run from New game to launch: { launched, jobs, raids, minutes: [quick,
// slow], tally, lines, campaign }. tally counts what the run did; lines say
// it step by step; campaign is where it ended, ready to launch if it got
// there.
export function runToLaunch(defs, seed, { heat = 'hunters', difficulty = 'normal' } = {}) {
  if (!HEAT_POLICIES.includes(heat)) throw new Error(`--heat is one of ${HEAT_POLICIES.join(', ')}`);
  if (!DIFFICULTIES.includes(difficulty)) throw new Error(`--difficulty is one of ${DIFFICULTIES.join(', ')}`);
  let campaign = withBoard(newCampaign(defs, seed), defs);
  const lines = [`Campaign seed ${seed}, paying heat down ${{ raids: 'before a raid', hunters: 'before the hunters', never: 'never' }[heat]}:`];
  const say = (text) => lines.push(text);
  const name = (type) => defs.modules.get(type)?.name ?? type;
  // waited: visits where a part the checklist needed was affordable, but
  // not in the shop's stock.
  const tally = { jobs: 0, done: 0, lost: 0, raids: 0, raidsLost: 0, orders: 0, rounds: 0, fits: 0, shopVisits: 0, payments: 0, bought: 0, sold: 0, waited: 0, stuck: null };

  const fightOut = (started, players) => {
    const { fight } = started;
    const sides = new Map(fight.battle.units.map((unit) => [unit.id, unit.side]));
    const { battle, actions, events } = playFrom(fight.battle, defs, players, { maxRounds: MAX_ROUNDS });
    tally.orders += actions.filter((action) => action.unit && sides.get(action.unit) === 'crew').length;
    tally.rounds += battle.round;
    return { battle, events, campaign: { ...started, fight: { ...fight, battle, log: [...fight.log, ...events] } } };
  };
  const pay = (why) => {
    const before = campaign.heat;
    campaign = makePayment(campaign, defs).campaign;
    tally.payments += 1;
    say(`   A payment on the debt ${why}: heat ${before} to ${campaign.heat}, ${campaign.credits} credits left.`);
  };

  // A visit to the hangar: fit, sell, buy, and face or head off a raid. Any
  // maker's version of a part on hand is the part.
  const count = (type) => campaign.parts[type] ?? 0;
  const have = (type) => countOfAny(defs, type, count);
  const atHub = () => {
    for (;;) {
      const needed = partsNeeded(campaign, defs);
      const part = Object.keys(needed).find((t) => have(t));
      if (!part) break;
      const type = versionAtHand(defs, part, count);
      const fitted = fitPart(campaign.ship, defs, type);
      const next = fitted ? refitShip(campaign, fitted.ship) : campaign;
      if (next === campaign) {
        tally.stuck = `no room for the ${name(type)}`;
        return;
      }
      campaign = next;
      tally.fits += 1;
      say(`   Fitted the ${name(type)} at (${fitted.at.x}, ${fitted.at.y}).`);
    }
    if (canLaunch(shipChecklist(campaign, defs))) return;
    const needed = partsNeeded(campaign, defs);
    let traded = false;
    for (const [type, held] of Object.entries(campaign.parts)) {
      if (needOf(needed, type, defs)) continue;
      for (let n = 0; n < held; n++) campaign = sellPart(campaign, defs, type).campaign;
      tally.sold += held;
      traded = true;
      say(`   Sold ${held} × ${name(type)}: ${campaign.credits} credits.`);
    }
    for (let index = 0; index < campaign.shop.length; ) {
      const item = campaign.shop[index];
      const short = needOf(needed, item.part, defs) - have(item.part);
      const bought = short > 0 && campaign.credits >= item.price ? buyPart(campaign, defs, index) : null;
      if (!bought?.ok) {
        index += 1;
        continue;
      }
      campaign = bought.campaign;
      tally.bought += 1;
      traded = true;
      say(`   Bought the ${name(item.part)} for ${item.price}: ${campaign.credits} credits left.`);
    }
    if (traded) tally.shopVisits += 1;
    const after = partsNeeded(campaign, defs);
    if (Object.keys(after).some((type) => !have(type) && campaign.credits >= (priceOf(type, defs) ?? Infinity) && !campaign.shop.some((item) => needOf({ [type]: 1 }, item.part, defs)))) tally.waited += 1;
    // What was bought goes on now.
    if (Object.keys(needed).some((type) => have(type))) atHub();
  };

  while (!canLaunch(shipChecklist(campaign, defs))) {
    atHub();
    if (tally.stuck || canLaunch(shipChecklist(campaign, defs))) break;
    if (tally.jobs >= MAX_JOBS) {
      tally.stuck = `not at launch after ${MAX_JOBS} jobs`;
      break;
    }
    while (raidDue(campaign, defs) && heat !== 'never' && paymentFor(campaign, defs).ok) pay('to head off the raid');
    if (raidDue(campaign, defs)) {
      const begun = beginRaid(campaign, defs, { difficulty });
      if (!begun.ok) {
        tally.stuck = `the raid can't start: ${begun.error}`;
        break;
      }
      tally.raids += 1;
      const { battle, campaign: fought } = fightOut(begun.campaign, { crew: aiAction, enemy: pressAction });
      if (!battle.winner) {
        tally.stuck = `a raid with no winner after ${MAX_ROUNDS} rounds`;
        break;
      }
      const before = { credits: fought.credits, parts: fought.parts };
      campaign = endRaid(fought, defs);
      if (battle.winner !== 'crew') tally.raidsLost += 1;
      const took = Object.keys(before.parts).find((type) => (campaign.parts[type] ?? 0) < before.parts[type]);
      const lost = took ? `they took the ${name(took)}` : before.credits > campaign.credits ? `they took ${before.credits - campaign.credits} credits` : 'there was nothing to take';
      say(`   Raid: ${battle.winner === 'crew' ? 'held' : `lost, ${lost}`}, in round ${battle.round}. Heat ${campaign.heat}.`);
      continue;
    }
    const needed = partsNeeded(campaign, defs);
    const worth = campaign.board.map((job) => jobWorth(job, campaign, defs, needed));
    const index = worth.indexOf(Math.max(...worth));
    const job = campaign.board[index];
    const limit = heat === 'hunters' ? defs.balance.huntHeat : defs.balance.raidHeat;
    while (heat !== 'never' && campaign.heat + jobHeat(job, defs).heat >= limit && paymentFor(campaign, defs).ok) pay(heat === 'hunters' ? 'to keep the hunters off' : 'before the job brings a raid');
    const words = jobText(job, defs);
    tally.jobs += 1;
    say(`${tally.jobs}. ${words.title} (${words.mission}${words.twist ? `, ${words.twist.name}` : ''}): ${words.pay}, ${words.heat}.`);
    const taken = takeJob(campaign, defs, index, { difficulty });
    if (!taken.ok) {
      tally.stuck = `the job can't start: ${taken.error}`;
      break;
    }
    const { battle, campaign: fought } = fightOut(taken.campaign, { crew: jobAction, enemy: aiAction });
    if (!battle.winner) {
      tally.stuck = `a job with no winner after ${MAX_ROUNDS} rounds`;
      break;
    }
    campaign = endJob(fought, defs);
    tally[battle.winner === 'crew' ? 'done' : 'lost'] += 1;
    say(`   ${battle.winner === 'crew' ? 'Done' : 'Lost'} in round ${battle.round}: ${campaign.credits} credits, heat ${campaign.heat}.`);
  }
  const launched = canLaunch(shipChecklist(campaign, defs));
  const minutes = [0, 1].map((i) => Math.round(
    (tally.orders * PACE.order[i] + tally.rounds * PACE.enemyTurn[i] + tally.jobs * PACE.board[i] + tally.fits * PACE.fit[i] + tally.shopVisits * PACE.shop[i] + tally.payments * PACE.pay[i]) / 60,
  ));
  say(launched
    ? `Ready to launch after ${tally.jobs} jobs (${tally.done} done, ${tally.lost} lost) and ${tally.raids} raid${tally.raids === 1 ? '' : 's'}: ${tally.orders} orders over ${tally.rounds} rounds, ${tally.fits} parts fitted, ${tally.bought} bought, ${tally.sold} sold, ${tally.payments} payments. About ${minutes[0]} to ${minutes[1]} minutes.`
    : `Stopped short of launch: ${tally.stuck}.`);
  return { launched, jobs: tally.jobs, raids: tally.raids, minutes, tally, lines, campaign };
}

// Runs from seeds 1 to `runs`, summed up: { lines, results }.
export function manyRuns(defs, runs, options = {}) {
  const results = [];
  for (let seed = 1; seed <= runs; seed++) results.push({ seed, ...runToLaunch(defs, seed, options) });
  const launched = results.filter((r) => r.launched);
  const sum = (list, key) => list.reduce((total, r) => total + r.tally[key], 0);
  const spread = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const lines = [
    `${runs} runs, seeds 1 to ${runs}: ${launched.length} ready to launch.`,
    `Jobs: ${spread(launched.map((r) => r.jobs))}. Raids: ${spread(launched.map((r) => r.raids))}. Jobs done: ${Math.round((100 * sum(results, 'done')) / Math.max(1, sum(results, 'jobs')))}% of ${sum(results, 'jobs')}.`,
    `Minutes, quick: ${spread(launched.map((r) => r.minutes[0]))}; slow: ${spread(launched.map((r) => r.minutes[1]))}. The median, then the least and most.`,
    ...results.filter((r) => !r.launched).map((r) => `Seed ${r.seed}: ${r.lines.at(-1)}`),
  ];
  return { lines, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const defs = indexDefs(readData());
  const options = { heat: value('--heat', 'hunters'), difficulty: value('--difficulty', 'normal') };
  const runs = Number(value('--runs', 0));
  console.log((runs ? manyRuns(defs, runs, options) : runToLaunch(defs, Number(value('--seed', 1)), options)).lines.join('\n'));
}
