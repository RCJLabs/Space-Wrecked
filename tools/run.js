#!/usr/bin/env node
// A test run of act 1 (M16's Done when): from New game until every line of
// the flight checklist passes and the ship can launch. A test player does
// what a careful player would, taking any maker's version of a part the
// checklist asks for (M23g), or a part that does one's work (M39: a
// thruster for an engine, a dormitory for crew quarters, a cockpit for the
// bridge). At the hangar, in this order:
//   - fit each part on hand the checklist needs, where it touches the most
//     of the ship (fitPart), then any on hand that does a needed one's work
//     (helps);
//   - sell the parts on hand it doesn't need;
//   - buy what it needs, if the shop has it and there are the credits; with
//     none of that bought, a part that does a needed one's work;
//   - buy a weapon GAIN points better than anyone who could carry it has
//     (M37, arms.js), with what the parts still needed, a holdful's price
//     and a transponder swap's leave;
//   - face a raid that is due, unless a payment heads it off;
//   - pay heat down when the next job would bring the hunters (or, with
//     --heat, only before a raid, or never);
//   - take the job worth most: its pay (with what its client's side adds,
//     M33) and its part, at the odds the test crew has had on that job and
//     twist. The background's thread's job (M33b) is offered above the
//     board's, and the heat its step takes off counts at a payment's price
//     (for the deserter, whose pursuer takes no payment, at the cheapest
//     any pursuer takes); once the ship could launch, it is taken before
//     launching in any case, again until it is done.
// In a fight the crew is played by the job player (src/sim/jobAi.js), or
// in a raid by the AI; the enemy by the AI, pressing on in a raid. Each
// goes in with the best weapon on hand of their job's kinds (M37): for the
// ground on a job, for a fight aboard the ship in a raid.
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
//   node tools/run.js --background deserter   from another background's
//                                    start (M30; data/backgrounds.json)
import { pathToFileURL } from 'node:url';
import { aiAction } from '../src/sim/ai.js';
import { applyCommand, layoutProblems, occupancy } from '../src/sim/builder.js';
import { firstBackground, newCampaign, partsNeeded, refitShip, shipChecklist } from '../src/sim/campaign.js';
import { canLaunch } from '../src/sim/constraints.js';
import { endJob, takeJob, takeQuestJob, withBoard } from '../src/sim/contracts.js';
import { indexDefs } from '../src/sim/defs.js';
import { buyPart, priceOf, sellPart, sellPriceOf } from '../src/sim/economy.js';
import { cellAt, SIDES, step } from '../src/sim/grid.js';
import { jobHeat, makePayment, paymentFor, pursuerOf, raidDue } from '../src/sim/heat.js';
import { jobAction } from '../src/sim/jobAi.js';
import { baseOf, countOfAny, versionAtHand } from '../src/sim/makers.js';
import { placedCells } from '../src/sim/modules.js';
import { pressAction } from '../src/sim/press.js';
import { questJobs, threadOf } from '../src/sim/quests.js';
import { beginRaid, endRaid } from '../src/sim/raid.js';
import { DIFFICULTIES } from '../src/sim/settings.js';
import { jobPay } from '../src/sim/standing.js';
import { supplyCapacity } from '../src/sim/travel.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { armFor, upgradeOf } from './arms.js';
import { playOn } from './boarding.js';
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
// that. The jobs' odds were measured anew in M38, when the enemies came to
// play to the objective: each of the 44 jobs 200 times from its
// background's start crew, at heat 0 with no twist (tools/jobs.js's crew
// and enemy). The twists' are M16's, over 750 jobs. A careful player learns
// which jobs go badly. A job not here counts at its mission's rate. The
// stations' 15 (M38c) were measured the same way (tools/jobs.js --stations
// --odds 200), for the voyage's test player (voyagePlan.js).
const JOB_ODDS = {
  jumpers: 0.66, scrap: 0.61, payroll: 0.78, repo: 0.88, debts: 0.51, picket: 0.06, manifest: 0.72, supplies: 0.81, ledger: 0.83, rent: 0.45,
  strikefund: 0.57, backdoor: 0.69, yardwatch: 0.82, pumps: 0.64, nephew: 0.46,
  hotcargo: 0.76, dockwar: 0.13, signedfor: 0.64, breaking: 0.52, pressgang: 0.48, coal: 0.7, impounded: 0.97, pawn: 0.32,
  rumration: 0.66, auditors: 0.82, dockstrike: 0.45, presstender: 0.57, lodger: 0.6,
  insurance: 0.61, seized: 0.74, papertrail: 0.69, turf: 0.66, housecall: 0.82, divers: 0.65, luggage: 0.9, lastorders: 0.72,
  ledgers: 0.68, housecallacross: 0.81, closingtime: 0.85, still: 0.57, collateral: 0.74,
  undeclared: 0.59, claimrights: 0.62, holdberth: 0.89, familybooks: 0.73, steward: 0.64, safepassage: 0.89, cutrig: 0.56, dues: 0.57,
  pumppirates: 0.48, salvage: 0.56, pumplocks: 0.64, badpaper: 0.46, courier: 0.85, fleetstores: 0.57, repomen: 0.77,
};
const MISSION_ODDS = { clear: 0.46, grab: 0.75, hack: 0.73, extract: 0.64, escort: 0.77, defend: 0.7, sabotage: 0.59, rescue: 0.6 };
const TWIST_ODDS = { overtime: 0.6, cavein: 0.75, hazard: 0.75, rush: 0.75, lights: 1, skeleton: 1.4 };
const HEAT_POLICIES = ['raids', 'hunters', 'never'];
const MAX_ROUNDS = 60; // a fight still going after this many stops the run
const MAX_JOBS = 30; // a run not at launch after this many stops

// The ship with a part of `type` fitted where the builder's rules allow it
// and the layout stays whole (every part joined to the bridge, every
// exhaust and barrel facing space), touching as much of the ship as it
// can; ties go to the first row, then column, then turn. Returns { ship,
// at: { x, y, rot } }, or null if it fits nowhere. A spot is weighed before
// it is tried: one touching nothing can't join the bridge, and one touching
// no more than the best so far can't win, so neither is built (M23h: the
// voyage's refits fit parts at every station).
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
        const score = touching({ x, y, rot });
        if (score === 0 || (best && score <= best.score)) continue;
        const placed = applyCommand(ship, defs, { op: 'place', type, x, y, rot });
        if (!placed.ok || layoutProblems(placed.ship, defs).length) continue;
        best = { ship: placed.ship, at: { x, y, rot }, score };
      }
    }
  }
  return best && { ship: best.ship, at: best.at };
}

// What a job on the board is worth to the run: its pay, with what its
// client's side adds (M33), its part (the price of one the checklist
// needs, else what the shop would pay for it) and for a quest's job the
// heat its step takes off (questWorth), at the test crew's odds on it.
function jobWorth(job, campaign, defs, needed) {
  const part = job.part ? (needOf(needed, job.part, defs) || helps(campaign, defs, job.part, needed) ? priceOf(job.part, defs) : sellPriceOf(job.part, defs)) ?? 0 : 0;
  return jobOdds(job, defs) * (jobPay(campaign, defs, job) + part + questWorth(job, campaign, defs));
}

// How often the test crew wins a job: its own odds or its mission's, with
// its twist's, at most 95%.
export function jobOdds(job, defs) {
  const contract = defs.contracts.jobs.get(job.contract);
  return Math.min(0.95, (JOB_ODDS[job.contract] ?? MISSION_ODDS[contract?.mission] ?? 0.5) * (TWIST_ODDS[job.twist] ?? 1));
}

// The heat a quest's job's step takes off (M33b), in credits at a
// payment's price: the pursuer's payment, or for one that takes none (the
// Provost) the cheapest any pursuer takes. 0 for any other job.
function questWorth(job, campaign, defs) {
  const step = job.quest ? defs.quests.get(job.quest)?.steps.find((entry) => entry.job === job.contract) : null;
  const heat = -(step?.effects?.heat ?? 0);
  if (heat <= 0) return 0;
  const own = pursuerOf(campaign, defs)?.payment;
  const prices = own ? [own] : [...defs.backgrounds.values()].map((background) => background.pursuer?.payment).filter(Boolean);
  return heat * Math.min(...prices.map((payment) => payment.credits / payment.heat));
}

// How many of a part the checklist still asks for, any maker's version
// counting as the part (needed is partsNeeded's, by base part).
function needOf(needed, type, defs) {
  return needed[baseOf(defs.modules.get(type) ?? { id: type })] ?? 0;
}

// True if a part of `type` the checklist doesn't name, fitted, leaves it
// asking for fewer parts in all (M39): a thruster or a light engine with
// the thrust an engine would bring, a dormitory with the berths, a cockpit
// for the bridge. A part that fixes one line and breaks another (a
// thruster's power) doesn't. needed is partsNeeded's for the campaign.
export function helps(campaign, defs, type, needed = partsNeeded(campaign, defs)) {
  const total = (list) => Object.values(list).reduce((sum, n) => sum + n, 0);
  if (!defs.modules.has(type) || needOf(needed, type, defs) || !total(needed)) return false;
  const ship = { ...campaign.ship, modules: [...campaign.ship.modules, { uid: -1000, type, x: 0, y: 0, rot: 0 }] };
  return total(partsNeeded({ ...campaign, ship }, defs)) < total(needed);
}

// A run from New game to launch: { launched, jobs, raids, minutes: [quick,
// slow], tally, lines, campaign }. tally counts what the run did; lines say
// it step by step; campaign is where it ended, ready to launch if it got
// there.
export function runToLaunch(defs, seed, { heat = 'hunters', difficulty = 'normal', background = firstBackground(defs) } = {}) {
  if (!HEAT_POLICIES.includes(heat)) throw new Error(`--heat is one of ${HEAT_POLICIES.join(', ')}`);
  if (!DIFFICULTIES.includes(difficulty)) throw new Error(`--difficulty is one of ${DIFFICULTIES.join(', ')}`);
  if (!defs.backgrounds.has(background)) throw new Error(`--background is one of ${[...defs.backgrounds.keys()].join(', ')}`);
  let campaign = withBoard(newCampaign(defs, seed, { background }), defs);
  const lines = [`Campaign seed ${seed}, ${defs.backgrounds.get(background).name.toLowerCase()}, paying heat down ${{ raids: 'before a raid', hunters: 'before the hunters', never: 'never' }[heat]}:`];
  const say = (text) => lines.push(text);
  const name = (type) => defs.modules.get(type)?.name ?? type;
  // waited: visits where a part the checklist needed was affordable, but
  // not in the shop's stock.
  // questJobs: the thread's jobs taken (M33b); questAt: the job that did
  // its step, or null.
  // armsBought: weapons bought (M37).
  const tally = { jobs: 0, done: 0, lost: 0, raids: 0, raidsLost: 0, orders: 0, rounds: 0, fits: 0, shopVisits: 0, payments: 0, bought: 0, sold: 0, waited: 0, armsBought: 0, questJobs: 0, questAt: null, stuck: null };

  const fightOut = (started, players) => {
    const { fight } = started;
    const sides = new Map(fight.battle.units.map((unit) => [unit.id, unit.side]));
    // Past 40 rounds both sides press on, a hopeless shot giving way to a
    // step nearer (boarding.js playOn, M32), so no fight drags for ever.
    const { battle, actions, events } = playOn(fight.battle, defs, players, { maxRounds: MAX_ROUNDS });
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
  // A part on hand that does a needed one's work, and fits (M39); noRoom:
  // those that didn't, which are sold.
  const noRoom = new Set();
  const helping = (needed) => Object.keys(campaign.parts).find((type) => count(type) > 0 && !noRoom.has(type) && helps(campaign, defs, type, needed)) ?? null;
  const atHub = () => {
    for (;;) {
      const needed = partsNeeded(campaign, defs);
      const part = Object.keys(needed).find((t) => have(t));
      const type = part ? versionAtHand(defs, part, count) : helping(needed);
      if (!type) break;
      const fitted = fitPart(campaign.ship, defs, type);
      const next = fitted ? refitShip(campaign, fitted.ship, defs) : campaign;
      if (next === campaign && !part) {
        noRoom.add(type);
        continue;
      }
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
      if (!held || needOf(needed, type, defs) || (!noRoom.has(type) && helps(campaign, defs, type, needed))) continue;
      for (let n = 0; n < held; n++) campaign = sellPart(campaign, defs, type).campaign;
      tally.sold += held;
      traded = true;
      say(`   Sold ${held} × ${name(type)}: ${campaign.credits} credits.`);
    }
    for (let index = 0; index < campaign.shop.length; ) {
      const item = campaign.shop[index];
      if (item.weapon) {
        index += 1;
        continue;
      }
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
    // With nothing it names bought, one part that does a needed one's work
    // (M39): once fitted, the next might not.
    if (!Object.keys(needed).some((type) => have(type))) {
      const index = campaign.shop.findIndex((item) => item.part && !noRoom.has(item.part) && campaign.credits >= item.price && helps(campaign, defs, item.part, needed));
      const bought = index >= 0 ? buyPart(campaign, defs, index) : null;
      if (bought?.ok) {
        say(`   Bought the ${name(campaign.shop[index].part)} for ${campaign.shop[index].price}, to do a needed part's work: ${bought.campaign.credits} credits left.`);
        campaign = bought.campaign;
        tally.bought += 1;
        traded = true;
      }
    }
    // A weapon GAIN points better than anyone who could carry it has, for
    // the jobs' ground (M37), with what the parts still needed, a holdful's
    // price and a transponder swap's leave: the voyage sets out with what
    // act 1 leaves, and keeping the parts' price alone, fewer voyages
    // crossed fed (PROGRESS.md, M37).
    const kept = Object.entries(partsNeeded(campaign, defs)).reduce((sum, [type, n]) => sum + Math.max(0, n - have(type)) * (priceOf(type, defs) ?? 0), 0) + supplyCapacity(campaign.ship, defs, campaign.crew) * defs.balance.supplyPrice + defs.balance.swapPrice;
    for (let index = 0; index < campaign.shop.length; ) {
      const item = campaign.shop[index];
      const bought = item.weapon && upgradeOf(campaign, defs, item.weapon, 'ground') && campaign.credits - item.price >= kept ? buyPart(campaign, defs, index) : null;
      if (!bought?.ok) {
        index += 1;
        continue;
      }
      campaign = bought.campaign;
      tally.armsBought += 1;
      traded = true;
      say(`   Bought the ${defs.weapons.get(item.weapon).name.toLowerCase()} for ${item.price}: ${campaign.credits} credits left.`);
    }
    if (traded) tally.shopVisits += 1;
    const after = partsNeeded(campaign, defs);
    if (Object.keys(after).some((type) => !have(type) && campaign.credits >= (priceOf(type, defs) ?? Infinity) && !campaign.shop.some((item) => needOf({ [type]: 1 }, item.part, defs)))) tally.waited += 1;
    // What was bought goes on now.
    if (Object.keys(needed).some((type) => have(type)) || helping(partsNeeded(campaign, defs))) atHub();
  };

  // Ready to launch, the run goes on until the thread's job is done (M33b).
  const threadOpen = () => questJobs(campaign, defs).length > 0;
  while (!canLaunch(shipChecklist(campaign, defs)) || threadOpen()) {
    atHub();
    const ready = canLaunch(shipChecklist(campaign, defs));
    if (tally.stuck || (ready && !threadOpen())) break;
    if (tally.jobs >= MAX_JOBS) {
      tally.stuck = `not at launch after ${MAX_JOBS} jobs`;
      break;
    }
    while (raidDue(campaign, defs) && heat !== 'never' && paymentFor(campaign, defs).ok) pay('to head off the raid');
    if (raidDue(campaign, defs)) {
      const begun = beginRaid(armFor(campaign, defs, 'ship'), defs, { difficulty });
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
    const quests = questJobs(campaign, defs);
    const offers = ready ? quests : [...quests, ...campaign.board];
    const worth = offers.map((job) => jobWorth(job, campaign, defs, needed));
    const index = worth.indexOf(Math.max(...worth));
    const job = offers[index];
    const limit = heat === 'hunters' ? defs.balance.huntHeat : defs.balance.raidHeat;
    while (heat !== 'never' && campaign.heat + jobHeat(job, defs).heat >= limit && paymentFor(campaign, defs).ok) pay(heat === 'hunters' ? 'to keep the hunters off' : 'before the job brings a raid');
    const words = jobText(job, defs);
    tally.jobs += 1;
    if (job.quest) tally.questJobs += 1;
    const quest = job.quest ? `, ${defs.quests.get(job.quest).name.toLowerCase()}${ready ? ' before launching' : ''}` : '';
    say(`${tally.jobs}. ${words.title} (${words.mission}${words.twist ? `, ${words.twist.name}` : ''}${quest}): ${words.pay}, ${words.heat}.`);
    const armed = armFor(campaign, defs, 'ground');
    const taken = job.quest ? takeQuestJob(armed, defs, job.quest, { difficulty }) : takeJob(armed, defs, index - quests.length, { difficulty });
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
    if (job.quest && battle.winner === 'crew') tally.questAt = tally.jobs;
    say(`   ${battle.winner === 'crew' ? 'Done' : 'Lost'} in round ${battle.round}: ${campaign.credits} credits, heat ${campaign.heat}.`);
  }
  const launched = canLaunch(shipChecklist(campaign, defs));
  // The thread's act 1 step done, or none to do (M33b).
  const thread = threadOf(campaign, defs);
  const threadDone = !thread || (campaign.quests?.[thread.id]?.step ?? 0) > 0 || campaign.quests?.[thread.id]?.state === 'done';
  const minutes = [0, 1].map((i) => Math.round(
    (tally.orders * PACE.order[i] + tally.rounds * PACE.enemyTurn[i] + tally.jobs * PACE.board[i] + tally.fits * PACE.fit[i] + tally.shopVisits * PACE.shop[i] + tally.payments * PACE.pay[i]) / 60,
  ));
  say(launched
    ? `Ready to launch after ${tally.jobs} jobs (${tally.done} done, ${tally.lost} lost) and ${tally.raids} raid${tally.raids === 1 ? '' : 's'}: ${tally.orders} orders over ${tally.rounds} rounds, ${tally.fits} parts fitted, ${tally.bought} bought, ${tally.sold} sold, ${tally.payments} payments. ${thread ? `${thread.name}'s job ${threadDone ? `done at job ${tally.questAt}` : 'not done'}, in ${tally.questJobs} tr${tally.questJobs === 1 ? 'y' : 'ies'}. ` : ''}About ${minutes[0]} to ${minutes[1]} minutes.`
    : `Stopped short of launch: ${tally.stuck}.`);
  return { launched, jobs: tally.jobs, raids: tally.raids, minutes, threadDone, tally, lines, campaign };
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
    `${runs} runs, seeds 1 to ${runs}${options.background ? `, the ${defs.backgrounds.get(options.background)?.name.toLowerCase()}` : ''}: ${launched.length} ready to launch.`,
    `Jobs: ${spread(launched.map((r) => r.jobs))}. Raids: ${spread(launched.map((r) => r.raids))}. Jobs done: ${Math.round((100 * sum(results, 'done')) / Math.max(1, sum(results, 'jobs')))}% of ${sum(results, 'jobs')}.`,
    `Minutes, quick: ${spread(launched.map((r) => r.minutes[0]))}; slow: ${spread(launched.map((r) => r.minutes[1]))}. The median, then the least and most.`,
    `The thread's job (M33b): done in ${launched.filter((r) => r.threadDone).length} of ${launched.length} launched, at job ${spread(launched.filter((r) => r.tally.questAt).map((r) => r.tally.questAt))}, in ${spread(launched.map((r) => r.tally.questJobs))} tries; taken before launching in ${launched.filter((r) => r.lines.some((line) => / before launching\)/.test(line))).length}.`,
    `Weapons (M37): ${sum(results, 'armsBought')} bought, in ${results.filter((r) => r.tally.armsBought).length} runs.`,
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
  const options = { heat: value('--heat', 'hunters'), difficulty: value('--difficulty', 'normal'), background: value('--background', undefined) };
  const runs = Number(value('--runs', 0));
  console.log((runs ? manyRuns(defs, runs, options) : runToLaunch(defs, Number(value('--seed', 1)), options)).lines.join('\n'));
}
