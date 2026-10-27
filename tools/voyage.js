#!/usr/bin/env node
// A test voyage through act 2 (M19's and M20's Done whens): from launch,
// across the act's sectors and on into the system past the charts, where it
// settles a world and the act ends (M25). The ship launches from
// a test run of act 1 at the same seed (tools/run.js), so it sets out with
// what such a run leaves it: its credits, heat and crew, the holds full. A
// test player does what a careful player would (its judgment is
// voyagePlan.js's):
//   - at an event, make the choice worth most;
//   - meeting a hostile ship, give the orders tools/approachPlan.js gives;
//     then fight any boarding it ends in with the AI (tools/boarding.js),
//     unless it is a ship the crew disabled and the crew is too worn down
//     to board her (voyagePlan.js boardIt), when it leaves her;
//   - at a station, refit with the parts on hand (voyagePlan.js refitAt,
//     M23h), unless --refit no; then fill the holds, as far as the credits
//     go, then patch up the crew, then repair, then sign a recruit on where
//     there is room (voyagePlan.js hireWho), with what the credits cover
//     beyond a holdful's price, and since M37 buy a weapon from its rack
//     GAIN points better than anyone who could carry it has (arms.js), with
//     what is left beyond a holdful's price and a transponder swap's;
//   - at a station from M38c, before the refit, take the job on its board
//     worth most with a full squad of the fit, if one is worth taking
//     (voyagePlan.js stationJobPick), unless --jobs no, and fight it as
//     act 1's jobs are fought (tools/boarding.js fightStationJob);
//   - fight a boarding with the healthiest squadSize of the crew (crew.js),
//     each carrying the best weapon on hand of their job's kinds (M37);
//   - with --scan yes (the default), scan wherever a scan would show a
//     node ahead; with --scan no, never;
//   - from each node, plan every way on to the jump point, a link at a
//     time, and jump to the next node on the way that goes hungry least,
//     then is worth most: the supplies and credits carried out, and the
//     nodes passed. Managing heat, at a station of the pursuer's side,
//     where the first trade logs the ship (M33's fix), it trades only to
//     swap the transponder or where filling the holds makes the way on
//     better, the trade counted as a hungry jump (voyagePlan.js tradeHere),
//     and otherwise passes by;
//   - with --long heat (the default), when heat is at LONG_FROM or over
//     (voyagePlan.js), make a long jump on instead, if the supplies cover
//     it and the way on from there goes hungry no more often; with --long
//     never, never;
//   - with --heat manage (the default, M24), keep the pursuer's hunters
//     off: long jumps as above, a transponder swap at a station
//     (voyagePlan.js swapNow), hiding in a nebula on the way (restNow);
//     with --heat ignore, none of these, and no long jumps;
//   - either way, regroup away from stations when the crew is worn down
//     (restNow), and face the hunters as any hostile ship;
//   - in the system past the charts (M25), survey while the supplies
//     allow, and settle the world it scores best (voyagePlan.js
//     systemMove), which ends the voyage;
//   - at the colony (M26), give it every useful part of the ship the
//     flight checks let go, beds and air first (voyagePlan.js nextGift);
//   - then play the colony's first COLONY_DAYS days (M27), building the
//     farms that feed the crew, and the mines that pay for them sooner,
//     before each day (voyagePlan.js nextBuild);
//   - then TRIP_DAYS more (M28), flying trips to the places within reach
//     with a squad of the fit, the ship refitted for them, a shelter and a
//     solar array for whoever stays home, the place worth most, and its
//     event's choice worth most, boarding a held derelict with the AI
//     (voyagePlan.js tripSquad, refitForSquad, homeBuild, nextPlace,
//     placeChoice); resting on the days it doesn't fly.
// From M33b it takes the quests' steps (voyagePlan.js questWorth): on the
// run it goes by a quest's node where the way allows and makes the step's
// choice there, lends the Fleet's tender a hand where the chain would leave
// the crew friendly with the Fleet and the holds keep their buffer after
// it, and at the colony flies to the quest's place first of the held ones
// (nextPlace). The report says what came of
// each quest, and the colony's odds of being found before and after the
// thread's pay-off. From M33c it starts each side's chain where the start's
// price leaves its buffer, signs the chain's companion on where a berth is
// free, and flies to their loyalty place as to a quest's; the report says
// who was met, signed on and loyal. From M36 it makes a choice that needs
// someone only with them aboard (in the squad, at a place), meets a trap's
// ship as any hostile ship, the trap's volley first, and fights a place's
// trap then and there; the report counts the traps and what events
// wrecked and mended. From M38d, once the colony's days are played and no
// raid is coming (it stays home and faces one first), it flies out on a
// voyage (unless --out no): the ship refitted with berths and air for all
// but one, as for a trip (voyagePlan.js refitForSquad), the healthiest who
// fit aboard going (voyageCrew) and a shelter built for whoever stays home
// (homeBuild). It plays the systems past the colony's as act 2's sectors,
// stations, jobs and yards among them, those at home facing any raid that
// lands meanwhile; and it flies home at the jump point of the
// VOYAGE_SYSTEMS'th system, or sooner once the holds come down to the way
// home's supplies and a buffer (homeNow), those at home facing a lander
// that stops the flight. The voyage keeps its own tally, so act 2's are
// as they were; the report says what it came to. From M38e (unless
// --settle no), in the SETTLE_SYSTEM'th system out it makes for the best
// world there and settles it (voyagePlan.js settleMove), gives the ship's
// parts and plays the new colony's first NEW_DAYS days, building its
// farms and mines, then flies straight back to the first colony, leaving
// the least fit there when three or more landed (backCrew); a raid coming
// at the first cuts the days short (secondColony). From M38f, back from
// its voyage out, it plays the first colony's next AFTER_DAYS days as its
// first (afterVoyage), the second living them too; a raid where the ship
// isn't is fought out without it, and it flies home for one only when it
// lands the day before (voyagePlan.js homeNow).
//
//   node tools/voyage.js               a voyage from campaign seed 1, step by step
//   node tools/voyage.js --seed 7      another seed
//   node tools/voyage.js --runs 20     seeds 1 to 20, summed up
//   node tools/voyage.js --long never  no long jumps
//   node tools/voyage.js --scan no     no scans
//   node tools/voyage.js --fit medbay  a part fitted before the voyage (or a
//                                      list, like --fit cargo,medbay)
//   node tools/voyage.js --frame courier
//                                      the ship moved onto another hull
//                                      frame first (M39), as a yard moves it
//   node tools/voyage.js --refit no    no refits at stations
//   node tools/voyage.js --jobs no     no jobs at stations (M38c)
//   node tools/voyage.js --out no      no voyage out from the colony (M38d)
//   node tools/voyage.js --settle no   no second colony on it (M38e)
//   node tools/voyage.js --heat ignore no swaps, hides or long jumps
//   node tools/voyage.js --background deserter
//                                      from another background's start
//                                      (M30; data/backgrounds.json)
//   node tools/voyage.js --runs 30 --background all
//                                      every background's, side by side
//   node tools/voyage.js --difficulty hard   the game's difficulty (M41),
//                                      act 1 to the end; the summary
//                                      gives the share of fights won
//   node tools/voyage.js --permadeath on    death permanent (M41): the
//                                      summary counts the dead and the
//                                      games over
//   node tools/voyage.js --runs 20 --set supplyPrice=2
//                                      a balance number changed for this run
//                                      only (as many --set as you like)
import { pathToFileURL } from 'node:url';
import { maxHp, shipChecklist } from '../src/sim/campaign.js';
import { buildingOf, colonyStats, donate, storesOf } from '../src/sim/colony.js';
import { build } from '../src/sim/colonyBuild.js';
import { crewRoom } from '../src/sim/crew.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { payFromColony, setLowProfile } from '../src/sim/pressure.js';
import { buyFromTrader, sellToTrader } from '../src/sim/traders.js';
import { chooseAtPlace, flyHome, flyOn, flyOut, tripHere, withPlaces } from '../src/sim/expeditions.js';
import { flightChecklist } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { shipEdge } from '../src/sim/edges.js';
import { jobHeat } from '../src/sim/heat.js';
import { FACED } from '../src/sim/approach.js';
import { approachState, closeApproach, giveOrder } from '../src/sim/encounter.js';
import { chooseEvent, partsOnHand } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { patchCrew } from '../src/sim/patch.js';
import { buyFromRack, rackHere } from '../src/sim/racks.js';
import { buyFromYard } from '../src/sim/yards.js';
import { eased, questOf, threadOf } from '../src/sim/quests.js';
import { raidLoss } from '../src/sim/raid.js';
import { onFrame } from '../src/sim/reframe.js';
import { landingPlan, raidDown, raidIn } from '../src/sim/raids.js';
import { huntersOf } from '../src/sim/hunt.js';
import { hireRecruit } from '../src/sim/recruits.js';
import { regroup } from '../src/sim/regroup.js';
import { repairShip } from '../src/sim/repair.js';
import { settle } from '../src/sim/settle.js';
import { allColonies, colonyById } from '../src/sim/colonies.js';
import { jobPay, levelOf, shareHere, standingWith, stationSide } from '../src/sim/standing.js';
import { survey } from '../src/sim/survey.js';
import { swapPriceOf, swapTransponder } from '../src/sim/transponder.js';
import { beginRun, buySupplies, failingCheck, hereOf, jump, jumpSupplies, leaveSector, openEvent, scan, scanPlan, supplyCapacity, supplyOffer, tradeHeat } from '../src/sim/travel.js';
import { flightFromPlan, flyFrom, voyageHome, voyageHomePlan, voyageOut, voyagePlan } from '../src/sim/voyage.js';
import { runRecord } from '../src/ui/campaign/launchText.js';
import { captainOrder } from './approachPlan.js';
import { upgradeOf } from './arms.js';
import { fightBoarding, fightPlace, fightRaid, fightStationJob, GameOver, SealedIn } from './boarding.js';
import { readData } from './data.js';
import { runToLaunch } from './run.js';
import { rulesWith, setting } from './sim.js';
import { withPart } from './startShip.js';
import { backCrew, bestChoice, leverNow, boardIt, foodReserve, HEAT_POLICIES, hireWho, homeBuild, homeNow, LONG_FROM, nextBuild, nextGift, nextJump, nextPlace, placeChoice, raidPrep, refitAt, refitForSquad, restNow, scanNow, settleMove, STOCK_DAYS, STOCK_SHARE, stationJobPick, stockFor, swapNow, systemMove, tradeHere, tripSquad, voyageCrew, worldScore, yardBuy } from './voyagePlan.js';

export const LONG_POLICIES = ['heat', 'never'];
export const SCAN_POLICIES = ['yes', 'no'];
export const REFIT_POLICIES = ['yes', 'no'];
export const JOB_POLICIES = ['yes', 'no'];
export const OUT_POLICIES = ['yes', 'no'];
export const SETTLE_POLICIES = ['yes', 'no'];
// The most systems past the colony's a voyage out crosses before it flies
// home (M38d).
export const VOYAGE_SYSTEMS = 3;
// The system out where the voyage settles a second colony, and the days of
// it the test player plays before flying back to the first (M38e).
export const SETTLE_SYSTEM = 2;
export const NEW_DAYS = 10;
// The first colony's days the test player plays once back from its voyage
// out (M38f).
export const AFTER_DAYS = 20;
const MAX_JUMPS = 100; // a voyage still going after this many stops
// The colony's days the test player plays, and the days from the landing
// within which its farms are to feed the crew (M27's Done when).
export const COLONY_DAYS = 30;
export const FED_WITHIN = 15;
// The days of trips it plays after those (M28's Done when).
export const TRIP_DAYS = 30;
// What came of a quest, as the log says it (questShape.js QUEST_MOVES).
const QUEST_DID = { started: 'started', done: 'a step done', finished: 'done', cold: 'gone cold' };

// A voyage from a launched campaign (act 2, the run not yet begun) to a
// world settled, its colony founded and its first days played: { ended,
// steps, sectors, system, tally, lines, campaign, landed, home, travelled }.
// ended: whether it settled a world, ending the act; steps: every jump,
// purchase, event, approach, boarding, station job (M38c), patch, repair,
// scan and survey, with what it moved, [before, after], and the settling;
// sectors: each sector as the ship entered it; system: the system past the
// charts, as it entered it, or null; campaign: as it ended, the colony
// founded; landed: the campaign as it settled, before the colony was
// founded, or null; home: the colony after its first COLONY_DAYS days
// (M27), or null; travelled: after TRIP_DAYS more of trips (M28), or null.
// jobs: 'no' takes no work at stations (M38c). out (M38d): the voyage out
// from the colony after its days (voyageOutOf), or null with none flown.
// With out: 'no' it flies none; with settle: 'no' (M38e) it settles no
// second colony on it.
export function voyageFrom(defs, launched, { long: longPolicy = 'heat', scans = 'yes', refit = 'yes', heat = 'manage', jobs = 'yes', out: outPolicy = 'yes', settle: settlePolicy = 'yes', label = '' } = {}) {
  if (!LONG_POLICIES.includes(longPolicy)) throw new Error(`--long is one of ${LONG_POLICIES.join(', ')}`);
  if (!HEAT_POLICIES.includes(heat)) throw new Error(`--heat is one of ${HEAT_POLICIES.join(', ')}`);
  // Ignoring heat makes no long jumps either.
  const long = heat === 'ignore' ? 'never' : longPolicy;
  if (!SCAN_POLICIES.includes(scans)) throw new Error(`--scan is one of ${SCAN_POLICIES.join(', ')}`);
  if (!REFIT_POLICIES.includes(refit)) throw new Error(`--refit is one of ${REFIT_POLICIES.join(', ')}`);
  if (!JOB_POLICIES.includes(jobs)) throw new Error(`--jobs is one of ${JOB_POLICIES.join(', ')}`);
  if (!OUT_POLICIES.includes(outPolicy)) throw new Error(`--out is one of ${OUT_POLICIES.join(', ')}`);
  if (!SETTLE_POLICIES.includes(settlePolicy)) throw new Error(`--settle is one of ${SETTLE_POLICIES.join(', ')}`);
  const begun = beginRun(launched, defs);
  if (!begun.ok) throw new Error(begun.error);
  let campaign = begun.campaign;
  // The steps and the tally: act 2's, and from M38d the voyage out's in
  // their place while it flies (act keeps act 2's meanwhile).
  let steps = [];
  const sectors = [campaign.run.sector];
  // A tally from `from` (the launched campaign, or the colony as the voyage
  // out leaves it), with the crew as `now` has them.
  const tallyFrom = (from, now) => ({
    crossed: 0,
    jumps: 0,
    longJumps: 0,
    hungryJumps: 0,
    stations: 0,
    bought: 0,
    spent: 0,
    events: 0,
    eventCredits: 0,
    eventSupplies: 0,
    found: 0,
    sold: 0,
    wounds: 0,
    scans: 0,
    approaches: 0,
    approachesWon: 0,
    approachesLost: 0,
    approachCredits: 0,
    boardings: 0,
    boardingsWon: 0,
    defences: 0,
    defencesWon: 0,
    left: 0,
    dragged: 0,
    salvageCredits: 0,
    salvaged: 0,
    partsLost: 0,
    creditsLost: 0,
    fightHp: 0,
    patchedHp: 0,
    patchCredits: 0,
    repairs: 0,
    repairCredits: 0,
    // Weapons bought from stations' racks (M37), and what they cost; and
    // those won in fights.
    armsBought: 0,
    armsCredits: 0,
    // Parts bought at the shipyards (M37b), and what they cost.
    yardBought: 0,
    yardCredits: 0,
    // Jobs taken at stations (M38c), won, what they paid, the heat they
    // added (their docking heat with it) and the hit points they cost.
    stationJobs: 0,
    stationJobsWon: 0,
    jobCredits: 0,
    jobHeat: 0,
    jobHp: 0,
    hired: 0,
    hireCredits: 0,
    healed: 0,
    refits: 0,
    fitted: 0,
    fits: {},
    hunts: 0,
    huntsFaced: 0,
    taskForces: 0,
    regroups: 0,
    hides: 0,
    rested: 0,
    swaps: 0,
    swapCredits: 0,
    hotJumps: 0,
    surveys: 0,
    systemHungry: 0,
    // The world settled: { name, kind, surveyed, score (as the player knew
    // it), best (the best score of the system's worlds, all numbers known),
    // record (the act's, as the colony says it) }, or null.
    settled: null,
    // The colony founded (foundColony), or null.
    colony: null,
    peak: from.heat,
    heat: [from.heat, null],
    hp: [hpOf(now), null],
    // Standing with each side (M33) at the launch and as the world is
    // settled (null short of one); and the side's patrols that waved the
    // ship through or fired first. The trades at stations of the pursuer's
    // side that logged the ship, and those it passed by without trading
    // (M33's fix).
    standing: { launch: from.standing, landing: null },
    waved: 0,
    fired: 0,
    docked: 0,
    passedBy: 0,
    friendly: 0,
    // The quests (M33b) at the launch, the landing and the end (null short
    // of them), and what came of them on the way: [{ quest, did, step,
    // sector }].
    quests: { launch: from.quests ?? {}, landing: null, end: null },
    questNotes: [],
    // The companions (M33c) met at their chain's step, and those who signed
    // on, by id in the order they did.
    companions: { met: [], joined: [] },
    // Events' traps sprung, and the parts events wrecked and mended (M36).
    ambushes: 0,
    eventWrecks: 0,
    eventRepairs: 0,
  });
  let tally = tallyFrom(launched, campaign);
  // The voyage out (M38d): act 2's steps and tally while it flies, and the
  // voyage as it began (voyageOutOf's), or null; and the campaign as the
  // colony was founded, the one the report and the result keep.
  let act = null;
  let away = null;
  let foundedAt = null;
  const hold = () => `${campaign.supplies} supplies, ${campaign.credits} credits, heat ${campaign.heat}`;
  // The parts a refit couldn't fit, and the ship then (voyagePlan.js refitAt).
  const tried = new Map();
  const lines = [
    `${label}Launched with ${campaign.credits} credits, heat ${campaign.heat}, a crew of ${campaign.crew.length} (${hpOf(campaign)}) and ${campaign.supplies} supplies, the holds full. A jump eats ${jumpSupplies(campaign, defs)}.`,
  ];
  const sectorLine = () => {
    const { sector } = campaign.run;
    const worlds = sector.nodes.filter((node) => node.world).map((node) => `${node.name} (${kindName(defs, node.world)})`);
    if (sector.system) {
      lines.push(`The system past the charts: ${sector.name}, ${worlds.length} worlds: ${worlds.join(', ')}.`);
      return;
    }
    const stations = `${sector.nodes.length} nodes, ${sector.nodes.filter((node) => node.type === 'station').length} station(s)`;
    // A system past the colony's (M38d).
    const out = campaign.colony?.voyage?.out;
    if (out) {
      lines.push(`System ${out} out from ${campaign.colony.world.name}: ${sector.name}, ${stations}, worlds ${worlds.join(', ') || 'none'}.`);
      return;
    }
    lines.push(`Sector ${sector.index}: ${sector.name}, ${stations}.`);
  };
  const record = (kind, before, extra = {}) => {
    const step = {
      kind,
      sector: before.run.sector.index,
      supplies: [before.supplies, campaign.supplies],
      credits: [before.credits, campaign.credits],
      heat: [before.heat, campaign.heat],
      hp: [before.crew.map((m) => m.hp), campaign.crew.map((m) => m.hp)],
      parts: [partsOnHand(before), partsOnHand(campaign)],
      crew: before.crew.length,
      // What the holds carried as it began (M33c: a companion's lockers
      // count from the step they sign on, as a recruit's do).
      room: supplyCapacity(before.ship, defs, before.crew),
      ...extra,
    };
    steps.push(step);
    return step;
  };
  // A jump made: its step, the tallies and the log.
  let system = null;
  let landed = null;
  let home = null;
  let travelled = null;
  const questNote = (note, sector) => {
    tally.questNotes.push({ quest: note.quest, did: note.did, step: note.step, sector });
    lines.push(`   ${questOf(defs, note.quest)?.name ?? note.quest}: ${QUEST_DID[note.did]}.`);
  };
  const jumped = (before, moved) => {
    if (!moved.ok) throw new Error(moved.error);
    campaign = moved.campaign;
    const { plan } = moved;
    // Leaving the last sector, a run's step not done goes cold (M33b).
    for (const id of moved.cold ?? []) questNote({ quest: id, did: 'cold', step: campaign.quests[id]?.step ?? 0 }, before.run.sector.index);
    // Out of the map: into the next sector, the system past the charts, or
    // on a voyage the next system past the colony's (M38d).
    const out = plan.kind === 'sector' || plan.kind === 'system' || plan.kind === 'beyond';
    // M39: what hydroponics grew on the way, and the heat the baffles took
    // off it.
    const quiet = shipEdge(before.ship, before.crew, defs, 'quiet', before.wrecks);
    record(plan.kind, before, { hungry: plan.hungry, heal: plan.heal, grows: plan.grows ?? 0, quiet, max: before.crew.map((member) => maxHp(member, defs)), to: out ? null : campaign.run.at, hunt: moved.hunt });
    tally.jumps += 1;
    if (moved.hunt.chance > 0) tally.hotJumps += 1;
    tally.peak = Math.max(tally.peak, campaign.heat);
    if (plan.kind === 'long') tally.longJumps += 1;
    if (calledFriendly(campaign, defs)) tally.friendly += 1;
    if (plan.hungry) tally.hungryJumps += 1;
    if (plan.hungry && before.run.sector.system) tally.systemHungry += 1;
    // A sector is crossed when the ship reaches its jump point.
    if (campaign.run.at === campaign.run.sector.exit) tally.crossed += 1;
    const hungry = plan.hungry ? `, hungry (${hpOf(campaign)})` : '';
    if (out) {
      if (plan.kind === 'sector') sectors.push(campaign.run.sector);
      else if (plan.kind === 'system') system = campaign.run.sector;
      else away.systems.push(campaign.run.sector);
      lines.push(`   Jumped on ${{ sector: 'out of the sector', system: 'past the charts', beyond: 'into the next system' }[plan.kind]}${hungry}: ${hold()}.`);
      sectorLine();
    } else {
      const node = hereOf(campaign);
      const whose = stationSide(node, defs);
      const station = node.type === 'station' ? ` (a station${whose ? `, ${defs.factions.sides.get(whose)?.name ?? whose}'s` : ''})` : '';
      lines.push(`   ${plan.kind === 'long' ? 'Long jump' : 'Jump'} to ${node.name}${station}${hungry}: ${hold()}.`);
    }
  };
  sectorLine();
  for (;;) {
    if (tally.jumps >= MAX_JUMPS) {
      lines.push(`Stopped: still going after ${MAX_JUMPS} jumps.`);
      break;
    }
    // A hostile ship where the ship is, or the hunters: the approach,
    // played out. An event where the hunters wait comes after.
    if (campaign.run.approach) {
      const before = campaign;
      const { enemy, hunt } = campaign.run.approach;
      while (!campaign.run.approach.outcome) {
        const given = giveOrder(campaign, defs, captainOrder(approachState(campaign, defs), defs));
        if (!given.ok) throw new Error(given.error);
        campaign = given.campaign;
      }
      const { outcome, round, patrol } = campaign.run.approach;
      const { changes } = outcome;
      record('approach', before, { ship: enemy.ship, hunt, outcome: outcome.kind, how: outcome.how ?? null, rounds: round, changes, boarding: outcome.boarding, wrecks: Object.keys(campaign.wrecks).length });
      // A side's patrol (M33) that waved the ship through is no approach.
      if (patrol === 'waved') {
        tally.waved += 1;
        lines.push(`   ${enemy.name}: waved through. ${hold()}.`);
        campaign = closeApproach(campaign).campaign;
      }
      if (patrol === 'fired') tally.fired += 1;
    }
    if (campaign.run.approach) {
      const { enemy, hunt, ambush } = campaign.run.approach;
      const { outcome, round } = campaign.run.approach;
      const { changes } = outcome;
      tally.approaches += 1;
      if (ambush) tally.ambushes += 1;
      if (hunt) {
        tally.hunts += 1;
        if (FACED.includes(outcome.kind)) tally.huntsFaced += 1;
        if (enemy.ship === huntersOf(campaign, defs)?.taskForce) tally.taskForces += 1;
      }
      if (outcome.kind === 'boarded' || outcome.kind === 'destroyed') tally.approachesWon += 1;
      if (outcome.kind === 'boardedBy') tally.approachesLost += 1;
      tally.approachCredits += changes.credits;
      lines.push(`   ${hunt ? 'The hunters, in a ' : ambush ? 'A trap: ' : ''}${enemy.name}: ${outcome.kind}${outcome.how ? ` (${outcome.how})` : ''} in round ${round}, ${Object.keys(campaign.wrecks).length} wrecked aboard. ${hold()}.`);
      // Its boarding, if it ended in one: fought, or a disabled ship left.
      if (outcome.boarding === 'due' && (outcome.kind === 'boardedBy' || boardIt(campaign, defs))) {
        const ready = campaign;
        const fought = fightBoarding(campaign, defs);
        campaign = fought.campaign;
        const lost = !fought.won && fought.dir === 'you' ? raidLoss(ready, defs) : null;
        const step = record('boarding', ready, { ship: enemy.ship, dir: fought.dir, won: fought.won, rounds: fought.rounds, salvage: fought.salvage, lost, dragged: fought.dragged });
        if (fought.dir === 'them') tally.boardings += 1;
        else tally.defences += 1;
        if (fought.won && fought.dir === 'them') tally.boardingsWon += 1;
        if (fought.won && fought.dir === 'you') tally.defencesWon += 1;
        if (fought.won) {
          tally.salvageCredits += fought.salvage.credits;
          tally.salvaged += fought.salvage.parts.length;
        }
        if (lost?.part) tally.partsLost += 1;
        tally.creditsLost += lost?.credits ?? 0;
        if (fought.dragged) tally.dragged += 1;
        tally.fightHp += step.hp[0].reduce((a, b) => a + b, 0) - step.hp[1].reduce((a, b) => a + b, 0);
        const way = fought.dir === 'them' ? 'Boarded her' : 'Fought off her boarders';
        lines.push(`   ${way}: ${fought.won ? 'won' : 'lost'} in round ${fought.rounds}, crew ${hpOf(campaign)}. ${hold()}.`);
      } else {
        if (outcome.boarding === 'due') {
          tally.left += 1;
          lines.push(`   Left her: the crew is too worn down to board (${hpOf(campaign)}).`);
        }
        campaign = closeApproach(campaign).campaign;
      }
    }
    // An event where the ship is: the choice worth most.
    const open = openEvent(campaign, defs);
    if (open) {
      const pick = bestChoice(campaign, defs, open.event, heat);
      const before = campaign;
      const made = chooseEvent(campaign, defs, pick.choice.id);
      if (!made.ok) throw new Error(made.error);
      campaign = made.campaign;
      const { result } = made;
      const { changes } = result;
      record('event', before, { event: open.event.id, choice: pick.choice.id, outcome: result.outcome, roll: result.roll, changes });
      tally.events += 1;
      tally.eventCredits += changes.credits;
      tally.eventSupplies += changes.supplies;
      tally.found += changes.parts.length;
      tally.sold += changes.sold.length;
      tally.wounds += changes.wounds.reduce((sum, wound) => sum + wound.hp, 0);
      tally.eventWrecks += changes.wrecked?.length ?? 0;
      tally.eventRepairs += changes.repaired?.length ?? 0;
      const said = pick.choice.outcomes[result.outcome].text;
      lines.push(`   ${open.event.title}: ${pick.choice.label}${result.roll === null ? '' : ` (rolled ${result.roll})`}. ${said} ${hold()}.`);
      if (result.quest) questNote(result.quest, before.run.sector.index);
      // A companion's chain step (M33c): met, and signed on or not.
      const offered = open.event.choices.flatMap((choice) => choice.outcomes.map((outcome) => outcome.effects.joins)).find(Boolean);
      if (offered && !tally.companions.met.includes(offered)) tally.companions.met.push(offered);
      if (changes.joined) {
        tally.companions.joined.push(changes.joined);
        lines.push(`   ${defs.companions.get(changes.joined)?.name ?? changes.joined} signs on: a crew of ${campaign.crew.length}.`);
      }
      // A trap (M36): its ship, met before anything else.
      if (campaign.run.approach) continue;
    }
    // A raid's lander down at the colony while the ship is out on a voyage
    // (M38d): it holds the ship where it is until those at home face it.
    if (campaign.colony?.voyage && raidDown(campaign)) {
      const before = campaign;
      campaign = faceRaid(campaign, defs, away.raids);
      const raid = away.raids.faced.at(-1);
      record('raid', before, { won: raid.won, home: raid.home, landed: raid.landed, stopped: raid.stopped, taken: raid.taken });
      lines.push(`   A raid at ${campaign.colony.world.name}: ${raidLine(defs, raid)} Aboard: ${hold()}.`);
      continue;
    }
    // The system past the charts (M25): a survey, a jump between its
    // worlds, or settling, which ends the voyage. There is nothing else to
    // do there: no station, no events.
    if (campaign.run.sector.system) {
      const move = systemMove(campaign, defs);
      const before = campaign;
      const here = hereOf(campaign);
      if (move.kind === 'survey') {
        const done = survey(campaign, defs);
        if (!done.ok) throw new Error(done.error);
        campaign = done.campaign;
        record('survey', before, { world: here.name, hunt: done.hunt, free: done.plan.free });
        tally.surveys += 1;
        tally.peak = Math.max(tally.peak, campaign.heat);
        lines.push(`   Surveyed ${here.name} (${kindName(defs, here.world)}): ${numbersText(here.world)}; scores ${worldScore(defs, here.world, true)}. ${hold()}${done.plan.free ? ', a free survey' : ''}${done.hunt?.found ? '. The hunters found the ship' : ''}.`);
        continue;
      }
      if (move.kind === 'settle') {
        const done = settle(campaign, defs);
        if (!done.ok) throw new Error(done.error);
        campaign = done.campaign;
        const { world } = campaign.colony;
        const best = Math.max(...before.run.sector.nodes.filter((node) => node.world).map((node) => worldScore(defs, node.world, true)));
        record('settle', before, { world: world.name });
        tally.standing.landing = campaign.standing;
        tally.quests.landing = campaign.quests;
        tally.settled = { name: world.name, kind: world.kind, surveyed: world.surveyed, score: worldScore(defs, world, world.surveyed), best, record: runRecord(campaign, defs) };
        lines.push(`   Settled ${world.name} (${kindName(defs, world)}, ${world.surveyed ? `surveyed, scoring ${worldScore(defs, world, true)}` : `not surveyed, its kind scoring ${worldScore(defs, world, false)}`}; the system's best scores ${best}): act 2 ends.`);
        landed = campaign;
        const founded = foundColony(campaign, defs);
        campaign = founded.campaign;
        foundedAt = campaign;
        tally.colony = founded.colony;
        lines.push(`   ${colonyLine(defs, founded.colony)}`);
        const played = playColony(campaign, defs);
        home = played.campaign;
        tally.days = played.days;
        lines.push(`   ${daysLine(played.days)}`);
        const flown = playTrips(home, defs);
        travelled = flown.campaign;
        tally.trips = flown.trips;
        lines.push(`   ${tripsLine(defs, flown.trips)}`);
        tally.raids = {
          faced: [...played.raids.faced, ...flown.raids.faced],
          set: [...played.raids.set, ...flown.raids.set],
          found: travelled.flags.raidsFound ?? 0,
          heat: [campaign.heat, travelled.heat],
          lanes: travelled.colony.world.lanes,
          coming: Boolean(travelled.colony.raid),
          // The odds of being found each day at home, and the day the
          // thread's place was won, or null (M33b).
          odds: [...played.raids.odds, ...flown.raids.odds],
          payoff: flown.trips.payoff,
        };
        lines.push(`   ${raidsLine(defs, tally.raids)}`);
        tally.quests.end = travelled.quests;
        // The voyage out (M38d): from here the run goes on with its own
        // steps and tally, act 2's kept.
        const leaving = outPolicy === 'yes' ? voyageOutOf(travelled, defs) : null;
        if (!leaving?.flown) {
          if (leaving) lines.push(`   No voyage out: ${leaving.why}`);
          break;
        }
        act = { tally, steps };
        away = leaving;
        steps = [];
        tally = tallyFrom(leaving.before, leaving.flown.campaign);
        campaign = leaving.flown.campaign;
        lines.push(`   ${outLine(defs, leaving)}`);
        // Flying out is the jump into the first system.
        const { jump: into } = leaving.flown.plan;
        record('out', leaving.before, { aboard: leaving.crew, stay: leaving.home, food: leaving.flown.plan.food, materials: leaving.flown.plan.materials, hungry: into.hungry, hunt: leaving.flown.hunt });
        tally.jumps += 1;
        if (leaving.flown.hunt.chance > 0) tally.hotJumps += 1;
        if (into.hungry) tally.hungryJumps += 1;
        tally.peak = Math.max(tally.peak, campaign.heat);
        away.systems.push(campaign.run.sector);
        sectorLine();
        continue;
      }
      jumped(before, jump(campaign, defs, move.to));
      continue;
    }
    // Work at a station (M38c): the job worth most on its board, while one
    // is worth taking with a full squad of the fit (voyagePlan.js
    // stationJobPick), before the refit, so a part it pays goes on here.
    for (let pick = jobs === 'yes' ? stationJobPick(campaign, defs, heat) : null; pick; pick = stationJobPick(campaign, defs, heat)) {
      const before = campaign;
      const dock = tradeHeat(campaign, defs);
      const fought = fightStationJob(campaign, defs, pick.index, pick.squad);
      campaign = fought.campaign;
      const step = record('job', before, { contract: pick.job.contract, won: fought.won, rounds: fought.rounds, squad: pick.squad, ids: before.crew.map((member) => member.id), max: before.crew.map((member) => maxHp(member, defs)), part: pick.job.part, pay: fought.won ? jobPay(before, defs, pick.job) : 0, added: jobHeat(pick.job, defs).heat, dock, dragged: fought.dragged });
      if (step.dock) tally.docked += 1;
      tally.stationJobs += 1;
      if (fought.won) tally.stationJobsWon += 1;
      tally.jobCredits += step.pay;
      tally.jobHeat += campaign.heat - before.heat;
      tally.jobHp += step.hp[0].reduce((a, b) => a + b, 0) - step.hp[1].reduce((a, b) => a + b, 0);
      if (fought.dragged) tally.dragged += 1;
      tally.peak = Math.max(tally.peak, campaign.heat);
      const title = defs.contracts.jobs.get(pick.job.contract)?.title ?? pick.job.contract;
      const part = pick.job.part ? (defs.modules.get(pick.job.part)?.name.toLowerCase() ?? pick.job.part) : null;
      const paid = `paid ${step.pay} credits${part ? ` and ${/^[aeiou]/.test(part) ? 'an' : 'a'} ${part}` : ''}`;
      lines.push(`   Took ${title} at ${hereOf(campaign).name}: ${fought.won ? `done in round ${fought.rounds}, ${paid}` : `lost in round ${fought.rounds}`}${dock ? `, docking +${dock} heat` : ''}; crew ${hpOf(campaign)}. ${hold()}.`);
    }
    // At a shipyard (M37b), refitting: the parts the refit would fit, one
    // at a time while each leaves a holdful's price and a transponder
    // swap's (voyagePlan.js yardBuy); the refit below fits them.
    for (let pick = refit === 'yes' ? yardBuy(campaign, defs) : null; pick; pick = yardBuy(campaign, defs)) {
      const before = campaign;
      const bought = buyFromYard(campaign, defs, pick.slot);
      if (!bought.ok) throw new Error(bought.error);
      campaign = bought.campaign;
      const step = record('yard', before, { part: pick.part, price: pick.price, dock: bought.plan.dock });
      if (step.dock) tally.docked += 1;
      tally.yardBought += 1;
      tally.yardCredits += pick.price;
      lines.push(`   Bought the ${defs.modules.get(pick.part)?.name.toLowerCase() ?? pick.part} at ${hereOf(campaign).name} for ${pick.price} credits${step.dock ? `, docking +${step.dock} heat` : ''}: ${hold()}.`);
    }
    // A refit at a station or a shipyard, before the holds are filled: a
    // hold fitted takes more.
    if (refit === 'yes') {
      const before = campaign;
      const done = refitAt(campaign, defs, tried);
      if (done.parts.length) {
        campaign = done.campaign;
        record('refit', before, { fitted: done.parts, modules: [before.ship.modules.length, campaign.ship.modules.length], passes: !failingCheck(campaign, defs) });
        tally.refits += 1;
        tally.fitted += done.parts.length;
        for (const type of done.parts) tally.fits[type] = (tally.fits[type] ?? 0) + 1;
        lines.push(`   Refitted at ${hereOf(campaign).name}: ${done.parts.map((type) => defs.modules.get(type)?.name ?? type).join(', ')} on. ${hold()}.`);
      }
    }
    // Trading at a station: managing heat, at one of the pursuer's side
    // only where it must (M33's fix: voyagePlan.js tradeHere); else it
    // passes by. A trade that logs the ship says so, and counts.
    const offer = supplyOffer(campaign, defs);
    const trading = offer.ok && tradeHere(campaign, defs, heat);
    if (offer.ok && !trading) {
      tally.passedBy += 1;
      lines.push(`   Passed by ${hereOf(campaign).name} without trading: ${defs.factions.sides.get(stationSide(hereOf(campaign), defs))?.name ?? 'its side'} would log the ship, +${tradeHeat(campaign, defs)} heat.`);
    }
    const logged = (step) => {
      if (step.dock) tally.docked += 1;
      return step.dock ? `, docking +${step.dock} heat` : '';
    };
    const count = trading ? Math.min(offer.room, offer.most) : 0;
    if (count > 0) {
      const before = campaign;
      campaign = buySupplies(campaign, defs, count).campaign;
      const step = record('buy', before, { count, share: offer.share, dock: offer.dock });
      tally.stations += 1;
      tally.bought += count;
      tally.spent += before.credits - campaign.credits;
      lines.push(`   Bought ${count} supplies at ${hereOf(campaign).name} for ${before.credits - campaign.credits} credits${logged(step)}: ${hold()}.`);
    }
    // A recruit signed on, where there is room and the fee to spare.
    const slot = trading ? hireWho(campaign, defs) : null;
    if (slot !== null) {
      const before = campaign;
      const signed = hireRecruit(campaign, defs, slot);
      if (!signed.ok) throw new Error(signed.error);
      campaign = signed.campaign;
      const member = campaign.crew.at(-1);
      const step = record('hire', before, { name: member.name, job: member.job, traits: member.traits, fights: member.fights, background: member.background, share: shareHere(before, defs), dock: signed.plan.dock });
      tally.hired += 1;
      tally.hireCredits += signed.plan.fee;
      lines.push(`   Signed on ${member.name} (${defs.jobs.get(member.job)?.name ?? member.job}) for ${signed.plan.fee} credits${logged(step)}: a crew of ${campaign.crew.length}, ${hold()}.`);
    }
    // Managing heat: the transponder swapped, once a recruit has signed
    // on, and before patching and repairs.
    if (trading && swapNow(campaign, defs, heat)) {
      const before = campaign;
      const swapped = swapTransponder(campaign, defs);
      campaign = swapped.campaign;
      const step = record('swap', before, { dock: swapped.plan.dock, price: swapped.plan.price });
      tally.swaps += 1;
      tally.swapCredits += before.credits - campaign.credits;
      lines.push(`   Swapped the transponder for ${before.credits - campaign.credits} credits${logged(step)}: ${hold()}.`);
    }
    // Patching up, then repairs, with what is left beyond a holdful's price,
    // or in act 2 the food to the system (voyagePlan.js foodReserve) if
    // that is more.
    const reserve = Math.max(supplyCapacity(campaign.ship, defs, campaign.crew) * defs.balance.supplyPrice, foodReserve(campaign, defs));
    const patched = trading && campaign.credits > reserve ? patchCrew({ ...campaign, credits: campaign.credits - reserve }, defs) : { ok: false };
    if (patched.ok) {
      const before = campaign;
      campaign = { ...patched.campaign, credits: patched.campaign.credits + reserve };
      const step = record('patch', before, { patched: patched.plan.hp, share: patched.plan.share, dock: patched.plan.dock });
      tally.patchedHp += patched.plan.hp;
      tally.patchCredits += patched.plan.cost;
      lines.push(`   Patched up ${patched.plan.hp} hit points for ${patched.plan.cost} credits${logged(step)}: crew ${hpOf(campaign)}, ${hold()}.`);
    }
    const fixed = trading && campaign.credits > reserve ? repairShip({ ...campaign, credits: campaign.credits - reserve }, defs) : { ok: false };
    if (fixed.ok) {
      const before = campaign;
      campaign = { ...fixed.campaign, credits: fixed.campaign.credits + reserve };
      const step = record('repair', before, { repaired: fixed.plan.repairs.length, dock: fixed.plan.dock });
      tally.repairs += fixed.plan.repairs.length;
      tally.repairCredits += fixed.plan.cost;
      lines.push(`   Repaired ${fixed.plan.repairs.map((repair) => repair.type).join(', ')} for ${fixed.plan.cost} credits${logged(step)}: ${hold()}.`);
    }
    // A weapon from the station's rack (M37) GAIN points better than anyone
    // who could carry it has, for a fight aboard a ship, with what is left
    // beyond a holdful's price and a transponder swap's, which keeps the
    // hunters off: beyond a holdful's alone, fewer voyages crossed fed.
    for (const item of trading ? rackHere(campaign, defs) : []) {
      if (!upgradeOf(campaign, defs, item.weapon, 'ship') || campaign.credits - item.price < reserve + swapPriceOf(campaign, defs)) continue;
      const before = campaign;
      const bought = buyFromRack(campaign, defs, item.slot);
      if (!bought.ok) continue;
      campaign = bought.campaign;
      const step = record('arms', before, { weapon: item.weapon, price: item.price, dock: bought.plan.dock });
      tally.armsBought += 1;
      tally.armsCredits += item.price;
      lines.push(`   Bought the ${defs.weapons.get(item.weapon).name.toLowerCase()} for ${item.price} credits${logged(step)}: ${hold()}.`);
    }
    // Home from a voyage (M38d), once the node's business is done: at the
    // last system's jump point, once the holds come down to the way home's
    // supplies and a buffer, or with the pursuer's lander coming down at
    // the colony after the flight home would land (M38d's fix; voyagePlan.js
    // homeNow).
    if (away && homeNow(campaign, defs, VOYAGE_SYSTEMS)) {
      const before = campaign;
      // Those aboard as the flight home sets out, for the voyage's tally.
      tally.hp[1] = hpOf(before);
      const plan = voyageHomePlan(campaign, defs);
      const back = flyHomeFrom(campaign, defs, away.raids);
      campaign = back.campaign;
      const coming = raidIn(before);
      record('home', before, { out: before.colony.voyage.out, atExit: before.run.at === before.run.sector.exit, eats: plan.eats, each: jumpSupplies(before, defs), flight: plan.days, coming, days: back.days, stops: back.stops, hungry: back.hungry });
      // Called home by a raid coming (M38d's fix), or not; a raid coming at
      // the landing is met at home, with everyone.
      away.back = { ...back, called: coming !== null, landed: campaign.crew.map((member) => member.id), dugLost: (campaign.flags.materialsLost ?? 0) - (away.before.flags.materialsLost ?? 0) };
      lines.push(`   ${homeLine(back, before)}`);
      if (campaign.colony.raid) {
        const met = waitForRaid(campaign, defs, away.raids);
        campaign = met.campaign;
        lines.push(`   At home for the raid: ${met.days} day${met.days === 1 ? '' : 's'}; ${raidLine(defs, away.raids.faced.at(-1))}`);
      }
      break;
    }
    // A second colony (M38e): in the SETTLE_SYSTEM'th system out the ship
    // makes for its best world and settles there, plays the new colony's
    // first days, and flies straight back to the first (secondColony).
    if (away && settlePolicy === 'yes' && campaign.colony.voyage.out === SETTLE_SYSTEM) {
      const move = settleMove(campaign, defs);
      const before = campaign;
      if (move.kind === 'jump') {
        jumped(before, jump(campaign, defs, move.to));
        continue;
      }
      tally.hp[1] = hpOf(before);
      const second = secondColony(campaign, defs, away.raids);
      campaign = second.campaign;
      record('settle', before, { world: second.settled.colony.world.name, days: second.days, called: second.called, left: second.left, back: second.crew });
      away.second = second;
      lines.push(`   ${secondLine(defs, second)}`);
      if (second.back) {
        const coming = raidIn(campaign);
        record('back', second.before, { days: second.back.days, stops: second.back.stops, hungry: second.back.hungry, flight: second.back.flight });
        away.back = { ...second.back, called: second.called, landed: campaign.crew.map((member) => member.id), dugLost: (campaign.flags.materialsLost ?? 0) - (away.before.flags.materialsLost ?? 0) };
        if (coming !== null) {
          const met = waitForRaid(campaign, defs, away.raids);
          campaign = met.campaign;
          lines.push(`   At home for the raid: ${met.days} day${met.days === 1 ? '' : 's'}; ${raidLine(defs, away.raids.faced.at(-1))}`);
        }
      }
      break;
    }
    // A day hidden in a nebula, or regrouping: the hunters may find a ship
    // that regroups, and then their approach comes first.
    const rest = restNow(campaign, defs, heat);
    if (rest) {
      const before = campaign;
      const done = regroup(campaign, defs);
      if (!done.ok) throw new Error(done.error);
      campaign = done.campaign;
      record(rest.kind, before, { heal: rest.heal, max: before.crew.map((member) => maxHp(member, defs)), found: done.hunt?.found ?? false });
      tally[rest.kind === 'hide' ? 'hides' : 'regroups'] += 1;
      tally.rested += (campaign.flags.hpRested ?? 0) - (before.flags.hpRested ?? 0);
      tally.peak = Math.max(tally.peak, campaign.heat);
      lines.push(`   ${rest.kind === 'hide' ? 'Hid a day in the nebula' : 'Regrouped a day'}: crew ${hpOf(campaign)}, ${hold()}${done.hunt?.found ? '. The hunters found the ship' : ''}.`);
      continue;
    }
    // A scan, where it would show a node ahead.
    const look = scans === 'yes' && scanNow(campaign, defs, heat) ? scanPlan(campaign, defs) : { ok: false };
    const { sector, at } = campaign.run;
    if (look.ok && look.reveals.some((id) => sector.nodes[id].col > sector.nodes[at].col)) {
      const before = campaign;
      campaign = scan(campaign, defs).campaign;
      record('scan', before, { reveals: look.reveals.length });
      tally.scans += 1;
      lines.push(`   Scanned: ${look.reveals.length} node(s) shown, heat ${campaign.heat}.`);
    }
    const before = campaign;
    jumped(before, campaign.run.at === campaign.run.sector.exit ? leaveSector(campaign, defs) : jump(campaign, defs, nextJump(campaign, defs, long, { heat })));
  }
  // The voyage out (M38d): its tally closed, then act 2's back, with the
  // campaign as the colony was founded.
  let out = null;
  if (act) {
    const since = (flag) => (campaign.flags[flag] ?? 0) - (away.before.flags[flag] ?? 0);
    // The flight home's heat too.
    tally.peak = Math.max(tally.peak, campaign.heat);
    tally.heat[1] = campaign.heat;
    tally.hp[1] ??= hpOf(campaign);
    tally.healed = since('hpHealed');
    // The first colony's days away (M38e: the second's days too, whose days
    // pass there as well), every colony's hungry days (the second's too,
    // and the first's while the ship was landed at the second), and the
    // raids found at each.
    const landedAt = away.back?.campaign ?? campaign;
    const days = colonyById(landedAt, 1).day - away.before.colony.day;
    const found = away.second ? { first: since('raidsFound') - away.second.found.second, second: away.second.found.second } : { first: since('raidsFound'), second: 0 };
    out = { ...away, tally, steps, campaign, colony: { days, hungry: since('hungryDays'), found: since('raidsFound'), at: found, dugLost: away.back?.dugLost ?? since('materialsLost') }, credits: [away.before.credits, campaign.credits] };
    // Back home (M38f): the first colony's next days, the second's too.
    out.after = away.back && !campaign.colony.voyage ? afterVoyage(campaign, defs, away.before) : null;
    ({ tally, steps } = act);
    campaign = foundedAt;
  }
  tally.heat[1] = campaign.heat;
  tally.hp[1] = hpOf(campaign);
  tally.healed = campaign.flags.hpHealed ?? 0;
  const ended = tally.settled !== null;
  const { sector } = campaign.run;
  const where = ended ? `Settled ${tally.settled.name} in ${sector.name}` : sector.system ? `Stopped in ${sector.name}, past the charts` : `Stopped in sector ${sector.index}`;
  lines.push(
    `${where}, ${tally.crossed} sectors crossed, ${tally.surveys} world${tally.surveys === 1 ? '' : 's'} surveyed: ${tally.jumps} jumps (${tally.longJumps} long, ${tally.hungryJumps} hungry), ${tally.bought} supplies bought at ${tally.stations} stations for ${tally.spent} credits. ${tally.events} events: ${signed(tally.eventCredits)} credits, ${signed(tally.eventSupplies)} supplies, ${tally.found} parts found, ${tally.sold} sold, ${tally.wounds} hit points lost, ${tally.ambushes} traps, ${tally.eventWrecks} parts wrecked and ${tally.eventRepairs} mended; ${tally.scans} scans. ${tally.approaches} hostile ships: ${tally.approachesWon} won, ${tally.approachesLost} lost, ${signed(tally.approachCredits)} credits; boarded ${tally.boardings} (won ${tally.boardingsWon}), left ${tally.left}, fought off ${tally.defencesWon} of ${tally.defences}; salvage ${tally.salvaged} parts and ${tally.salvageCredits} credits, lost ${tally.partsLost} parts and ${tally.creditsLost} credits, ${tally.fightHp} hit points; patched ${tally.patchedHp} for ${tally.patchCredits} credits; ${tally.repairs} repairs for ${tally.repairCredits} credits; signed on ${tally.hired}, healed ${tally.healed} in the med bay; refitted ${tally.fitted} parts at ${tally.refits} stations; ${tally.stationJobs} station jobs taken (${tally.stationJobsWon} done) for ${tally.jobCredits} credits, ${signed(tally.jobHeat)} heat and ${tally.jobHp} hit points. The hunters: met ${tally.hunts} (${tally.taskForces} the task force), faced ${tally.huntsFaced}; ${tally.hotJumps} jumps where they might wait; ${tally.regroups} regroups and ${tally.hides} days hidden, healing ${tally.rested}; ${tally.swaps} transponder swaps for ${tally.swapCredits} credits. Heat ${tally.heat[0]} to ${tally.heat[1]}, at most ${tally.peak}; crew ${tally.hp[0]} to ${tally.hp[1]}.`,
  );
  if (ended) lines.push(`The act's record: ${tally.settled.record.map(([label, value]) => `${label} ${value}`).join('; ')}.`);
  if (out) lines.push(voyageLine(out));
  return { ended, steps, sectors, system, tally, lines, campaign, landed, home, travelled, out };
}

// The colony founded as the careful player would (M26): the ship's parts
// given one at a time, the next each time voyagePlan.js's nextGift, until
// the flight checks let no more go. { campaign, colony: { given (types, in
// the order given), power (as colony.js colonyStats has it), beds, air,
// crew, aboard (how many sleep aboard), dark (buildings without power),
// flies (every flight check passing, counting nobody aboard) } }. Since
// M28 an infirmary opening heals nobody, so giving heals nobody either.
export function foundColony(campaign, defs) {
  const given = [];
  for (let uid = nextGift(campaign, defs); uid !== null; uid = nextGift(campaign, defs)) {
    const done = donate(campaign, defs, uid);
    if (!done.ok) throw new Error(done.error);
    given.push(done.plan.type);
    campaign = done.campaign;
  }
  const stats = colonyStats(campaign, defs);
  const colony = {
    given,
    power: stats.power,
    beds: stats.beds,
    air: stats.air,
    crew: campaign.crew.length,
    aboard: stats.aboard.length,
    dark: stats.buildings.filter((building) => !building.powered).length,
    flies: shipChecklist(campaign, defs).every((line) => line.ok === true),
  };
  return { campaign, colony };
}

// The first colony's next AFTER_DAYS days once the ship is back from its
// voyage out (M38f), played as its first (playColony), the second colony
// living them too: { campaign, days (playColony's), raids, citizens ([[id,
// count]]: at each colony at the end), and since flying out (before):
// grown, left, fell, settled (the citizens grown, gone short of food,
// fallen in raids, and rescued and settled), foughtOut, won, lost (the
// raids fought out without the ship, and how they went), hungry (every
// colony's hungry days) }.
export function afterVoyage(campaign, defs, before) {
  const played = playColony(campaign, defs, AFTER_DAYS);
  const now = played.campaign;
  const since = (flag) => (now.flags[flag] ?? 0) - (before.flags[flag] ?? 0);
  return {
    campaign: now,
    days: played.days,
    raids: played.raids,
    citizens: allColonies(now).map((colony) => [colony.id, colony.citizens ?? 0]),
    grown: since('citizensGrown'),
    left: since('citizensLeft'),
    fell: since('citizensFell'),
    // Freed captives (M38f) and event survivors (M54) who settled.
    settled: since('rescuedSettled') + since('survivorsSettled'),
    foughtOut: since('raidsFoughtOut'),
    won: since('raidsFoughtOutWon'),
    lost: since('raidsFoughtOutLost'),
    hungry: since('hungryDays') + since('othersHungryDays'),
  };
}

// The colony's first days as the careful player plays them (M27): before
// each day it builds what voyagePlan.js's nextBuild says, as long as it
// says to, then passes the day. From M29, while a raid is coming it sets
// down from the hold what raidPrep says, and a raid that is down it faces
// before the day (faceRaid below). { campaign, days: { built ([{ day,
// type, name }], in order), fedOn (the first day its farms fed the crew,
// what they grow a day covering what the crew eats, or null), hungry
// (hungry days), farms, mines, food and materials ([at the landing, at the
// end]), stores (at the end), healed, hurt, levers (pullLevers') }, raids
// ({ faced, set }: raidsLog's) }. From M53 it pulls the colony's levers on
// heat before each day as leverNow says (pullLevers), and stops lying low
// at the end, so the ship can fly.
export function playColony(campaign, defs, days = COLONY_DAYS) {
  const built = [];
  const raids = raidsLog();
  const start = { food: campaign.supplies, materials: campaign.colony.materials };
  let fedOn = null;
  let healed = 0;
  let hurt = 0;
  const levers = { pay: 0, low: 0, rise: 0, sell: 0, buy: 0, lowDays: 0 };
  for (let n = 0; n < days; n++) {
    campaign = pullLevers(campaign, defs, levers);
    if (campaign.colony.lowProfile) levers.lowDays++;
    for (let what = nextBuild(campaign, defs); what; what = nextBuild(campaign, defs)) {
      const done = build(campaign, defs, what);
      if (!done.ok) throw new Error(done.error);
      built.push({ day: campaign.colony.day, type: done.plan.type, name: done.plan.name });
      campaign = done.campaign;
    }
    campaign = readyForRaid(campaign, defs, raids);
    if (fedOn === null && colonyStats(campaign, defs).made.food >= campaign.crew.length * defs.balance.jumpSupplies) fedOn = campaign.colony.day;
    logOdds(campaign, defs, raids);
    const day = nextDay(campaign, defs);
    if (!day.ok) throw new Error(day.error);
    campaign = day.campaign;
    healed += day.healed;
    hurt += day.hurt;
  }
  if (campaign.colony.lowProfile) campaign = setLowProfile(campaign, defs, false).campaign;
  const count = (makes) => campaign.colony.buildings.filter((b) => defs.colony.builds.get(b.type)?.makes === makes).length;
  return {
    campaign,
    days: {
      built,
      fedOn,
      hungry: campaign.flags.hungryDays ?? 0,
      farms: count('food'),
      mines: count('materials'),
      food: [start.food, campaign.supplies],
      materials: [start.materials, campaign.colony.materials],
      stores: storesOf(campaign, defs).total,
      healed,
      hurt,
      levers,
      // Buildings gaining from a neighbour at the end (M54).
      near: colonyStats(campaign, defs).buildings.filter((b) => b.near?.length).length,
    },
    raids,
  };
}

// The colony's levers (M53), pulled as leverNow says until it says none,
// each counted in levers ({ pay, low, rise, sell, buy, lowDays }).
// Returns the campaign.
const LEVERS = {
  pay: (campaign, defs) => payFromColony(campaign, defs),
  low: (campaign, defs) => setLowProfile(campaign, defs, true),
  rise: (campaign, defs) => setLowProfile(campaign, defs, false),
  sell: (campaign, defs) => sellToTrader(campaign, defs),
  buy: (campaign, defs) => buyFromTrader(campaign, defs),
};
function pullLevers(campaign, defs, levers) {
  for (let n = 0, what = leverNow(campaign, defs); what && n < 10; n++, what = leverNow(campaign, defs)) {
    const done = LEVERS[what](campaign, defs);
    if (!done.ok) throw new Error(done.error);
    levers[what]++;
    campaign = done.campaign;
  }
  return campaign;
}

// What the raids came to, as the test player keeps it (M29): faced ([{
// day, landed (the raiders that landed), stopped (those the guns
// stopped), home (who was home to fight), away (true with the ship away),
// fought, won, taken (what a lost raid took, raids.js raidTake, or null)
// }]), set ([{ day, type, name }]: the defenses it set down from the
// hold for them) and odds ([{ day, found, eased }]: the odds, percent, of
// being found at the end of each day passed at home, and whether the
// pursuer had eased off, M33b).
function raidsLog() {
  return { faced: [], set: [], odds: [] };
}

// The day's odds of the colony being found, put on the log before a day
// passes at home (M33b).
function logOdds(campaign, defs, raids) {
  const plan = dayPlan(campaign, defs);
  if (plan.ok) raids.odds.push({ day: campaign.colony.day, found: plan.found, eased: eased(campaign, defs) });
}

// Ready for a raid (M29): while one is coming, what raidPrep says set down
// from the hold (nothing while the ship is away: building waits for it);
// one that is down, faced (faceRaid). Returns the campaign.
function readyForRaid(campaign, defs, raids) {
  if (!campaign.colony.raid) return campaign;
  for (let what = raidPrep(campaign, defs); what; what = raidPrep(campaign, defs)) {
    const done = build(campaign, defs, what);
    if (!done.ok) throw new Error(done.error);
    raids.set.push({ day: campaign.colony.day, type: done.plan.type, name: done.plan.name });
    campaign = done.campaign;
  }
  return raidDown(campaign) ? faceRaid(campaign, defs, raids) : campaign;
}

// A raid coming, waited for at home and faced once it is down (M38d's fix:
// a voyage's flight home that a raid called): { campaign, days (the days
// waited) }.
function waitForRaid(campaign, defs, raids) {
  let now = campaign;
  let days = 0;
  for (;;) {
    now = readyForRaid(now, defs, raids);
    if (!now.colony.raid) return { campaign: now, days };
    logOdds(now, defs, raids);
    const day = nextDay(now, defs);
    if (!day.ok) throw new Error(day.error);
    now = day.campaign;
    days += 1;
  }
}

// The raid that is down, faced: the guns fire at the lander, and those at
// home fight whoever lands, played by the AI (tools/boarding.js
// fightRaid). Its record goes on raids.faced, with the colony it was at
// (M38e: at, its number; away, the ship not there). Returns the campaign.
function faceRaid(campaign, defs, raids) {
  const plan = landingPlan(campaign, defs);
  if (!plan.ok) throw new Error(plan.error);
  const here = plan.colony === campaign.colony.id;
  const day = colonyById(campaign, plan.colony).day;
  const reckoning = Boolean(colonyById(campaign, plan.colony).raid?.reckoning);
  const done = fightRaid(campaign, defs);
  raids.faced.push({
    day,
    reckoning,
    at: plan.colony,
    landed: done.landing.landed.length,
    stopped: plan.raiders.length - done.landing.landed.length,
    party: plan.raiders.length,
    home: plan.defenders.length,
    away: !here || Boolean(campaign.colony.trip || campaign.colony.voyage),
    fought: done.fought,
    won: done.won,
    taken: done.taken,
  });
  return done.campaign;
}

// The colony's days of trips as the careful player plays them (M28), after
// its first: each day it builds what nextBuild says, as in M27; then, with
// a squad fit to fly (tripSquad), it refits the ship for them
// (refitForSquad), builds for whoever stays home (homeBuild) and flies to
// the place worth most (nextPlace), coming home within the days it plays:
// at the place it makes the event's choice worth most (placeChoice), or
// boards the derelict the scavengers hold with the AI (tools/boarding.js
// fightPlace), then flies home. With no squad or no place, it passes the
// day. { campaign, trips: { flown ([{ day, name, kind, days, squad, what }],
// in order), away (days away), parts, materials and food (what the trips
// brought), won and lost (the boardings), left (held derelicts left
// alone), built ([{ day, type, name }]), moved (the parts refitted
// aboard), hungry (hungry days in these days), healed, hurt, sealed (null,
// or the trip whose fight could never end, { day, name }: the trips stop
// there, M32) } }.
export function playTrips(campaign, defs, days = TRIP_DAYS) {
  const until = campaign.colony.day + days;
  const start = { flags: campaign.flags };
  const flown = [];
  const built = [];
  const moved = [];
  const raids = raidsLog();
  let sealed = null;
  const put = (what) => {
    const done = build(campaign, defs, what);
    if (!done.ok) throw new Error(done.error);
    built.push({ day: campaign.colony.day, type: done.plan.type, name: done.plan.name });
    campaign = done.campaign;
  };
  while (campaign.colony.day < until) {
    campaign = withPlaces(campaign, defs);
    for (let what = nextBuild(campaign, defs); what; what = nextBuild(campaign, defs)) put(what);
    // A raid coming (M29): it gets ready, faces it once it is down, and
    // stays home until then.
    if (campaign.colony.raid) {
      campaign = readyForRaid(campaign, defs, raids);
      if (campaign.colony.raid) {
        logOdds(campaign, defs, raids);
        const day = nextDay(campaign, defs);
        if (!day.ok) throw new Error(day.error);
        campaign = day.campaign;
      }
      continue;
    }
    let squad = tripSquad(campaign, defs);
    if (squad.length) {
      const refit = refitForSquad(campaign, defs, squad.length);
      campaign = refit.campaign;
      moved.push(...refit.moved);
      squad = tripSquad(campaign, defs, crewRoom(campaign.ship, defs));
    }
    if (squad.length) {
      for (let what = homeBuild(campaign, defs, squad); what; what = homeBuild(campaign, defs, squad)) put(what);
      const index = nextPlace(campaign, defs, squad, until - campaign.colony.day);
      if (index !== null) {
        const logged = { faced: raids.faced.length, set: raids.set.length };
        try {
          const trip = flyTrip(campaign, defs, index, squad, raids);
          campaign = trip.campaign;
          flown.push(trip.record);
          continue;
        } catch (error) {
          if (!(error instanceof SealedIn)) throw error;
          // A fight at the place that can't end (boarding.js sealedIn): the
          // trips stop, with the campaign as it was before this one.
          sealed = { day: campaign.colony.day, name: campaign.colony.places[index].name };
          raids.faced.length = logged.faced;
          raids.set.length = logged.set;
          break;
        }
      }
    }
    logOdds(campaign, defs, raids);
    const day = nextDay(campaign, defs);
    if (!day.ok) throw new Error(day.error);
    campaign = day.campaign;
  }
  const since = (flag) => (campaign.flags[flag] ?? 0) - (start.flags[flag] ?? 0);
  return {
    campaign,
    trips: {
      flown,
      away: since('daysAway'),
      parts: since('tripParts'),
      materials: since('tripMaterials'),
      food: since('tripFood'),
      won: since('placeFightsWon'),
      lost: since('placeFightsLost'),
      // Places' traps sprung (M36).
      traps: since('placeAmbushes'),
      left: flown.filter((trip) => trip.what === 'left her').length,
      built,
      moved,
      hungry: since('hungryDays'),
      healed: since('colonyHealed'),
      hurt: since('hungerHurt'),
      sealed,
      // The day the thread's place was won (M33b), or null.
      payoff: flown.find((trip) => trip.wonOn !== null)?.wonOn ?? null,
    },
    raids,
  };
}

// One trip, out and home: { campaign, record }. A raid that lands on the
// way (M29) is faced by those at home, and the ship flies on (onWay).
function flyTrip(campaign, defs, index, squad, raids) {
  const place = campaign.colony.places[index];
  const day = campaign.colony.day;
  const out = flyOut(campaign, defs, index, squad);
  if (!out.ok) throw new Error(out.error);
  let now = onWay(out.campaign, defs, raids);
  const here = tripHere(now, defs);
  let what = 'left her';
  let wonOn = null;
  if (here.event) {
    const pick = placeChoice(now, defs, here.event);
    const chose = chooseAtPlace(now, defs, pick.choice.id);
    if (!chose.ok) throw new Error(chose.error);
    now = chose.campaign;
    what = `${here.event.title}: ${pick.choice.label}`;
    // A trap (M36): the place is held, and the squad fights there now.
    if (tripHere(now, defs).held) {
      const fought = fightPlace(now, defs);
      now = fought.campaign;
      what += fought.won ? ', a trap: won' : ', a trap: lost';
    }
  } else if (here.held) {
    const fought = fightPlace(now, defs);
    // The thread's place (M33b), not a companion's loyalty place (M33c).
    if (fought.won && defs.quests.get(place.quest)?.background) wonOn = now.colony.day;
    now = fought.campaign;
    what = fought.won ? 'boarded her and won' : 'boarded her and lost';
  }
  if (raidDown(now)) now = faceRaid(now, defs, raids);
  const home = flyHome(now, defs);
  if (!home.ok) throw new Error(home.error);
  return { campaign: onWay(home.campaign, defs, raids), record: { day, name: place.name, kind: place.kind, days: out.plan.days.out + home.plan.days, squad: squad.length, what, event: here.event?.id ?? null, quest: place.quest ?? null, wonOn } };
}

// A leg a raid stopped (M29): those at home face it, and the ship flies
// on, as long as raids keep stopping it. Returns the campaign.
function onWay(campaign, defs, raids) {
  let now = campaign;
  while (now.colony.trip?.leg) {
    if (raidDown(now)) now = faceRaid(now, defs, raids);
    const on = flyOn(now, defs);
    if (!on.ok) throw new Error(on.error);
    now = on.campaign;
  }
  return now;
}

// The voyage out from the colony as the careful player begins it (M38d),
// once its days are played. It stocks the holds first (M38d's fix): farms
// that grow STOCK_SHARE times what the crew eats (voyagePlan.js
// nextBuild), and days at home until the food is what the holds take
// (stockFor), at most STOCK_DAYS, and none once the farms can grow no more
// than the crew eats and no mine digs toward another. While a raid is
// coming it stays home and faces it first, as on its days (readyForRaid),
// the days it waits not counted against stocking. Then the ship is
// refitted with berths and air
// for all but one (refitForSquad), the healthiest who fit aboard go
// (voyageCrew), a shelter goes up for whoever stays home (homeBuild), and
// the ship flies out. { before (the colony as the ship left it), flown
// (voyage.js voyageOut's result, or null with nobody able to fly, why
// saying so), why, crew and home (the ids aboard and at home), waited
// (days at home waiting for a raid), stocked (days at home stocking the
// holds), full (whether the food filled the holds' stock), moved (the parts
// refitted aboard), built ([{ day, type, name }]), raids (raidsLog's: any
// faced before it flew, then those on the voyage and any met at home after
// it), prior (how many were faced before it flew), systems (each system as
// the ship entered it), back (flyHomeFrom's once home, with called: whether
// a raid coming called it home, landed: the crew's ids as it landed, and
// dugLost: the mines' digging the storehouses couldn't keep while it was
// away; else null) }.
export function voyageOutOf(campaign, defs) {
  const raids = raidsLog();
  const built = [];
  let now = campaign;
  let waited = 0;
  let stocked = 0;
  const put = (what) => {
    const done = build(now, defs, what);
    if (!done.ok) throw new Error(done.error);
    built.push({ day: now.colony.day, type: done.plan.type, name: done.plan.name });
    now = done.campaign;
  };
  for (;;) {
    for (let what = nextBuild(now, defs, STOCK_SHARE); what; what = nextBuild(now, defs, STOCK_SHARE)) put(what);
    if (now.colony.raid) now = readyForRaid(now, defs, raids);
    const coming = Boolean(now.colony.raid);
    // Nothing more to come: the farms grow no more than the crew eats, and
    // no mine digs toward another.
    const { made } = colonyStats(now, defs);
    const stuck = made.food <= jumpSupplies(now, defs) && made.materials === 0;
    if (!coming && (now.supplies >= stockFor(now, defs) || stocked >= STOCK_DAYS || stuck)) break;
    logOdds(now, defs, raids);
    const day = nextDay(now, defs);
    if (!day.ok) throw new Error(day.error);
    now = day.campaign;
    if (coming) waited += 1;
    else stocked += 1;
  }
  const full = now.supplies >= stockFor(now, defs);
  const refit = refitForSquad(now, defs, Math.max(1, now.crew.length - 1));
  now = refit.campaign;
  const crew = voyageCrew(now, defs);
  const homeIds = now.crew.filter((member) => !crew.includes(member.id)).map((member) => member.id);
  const base = { why: null, crew, home: homeIds, waited, stocked, full, moved: refit.moved, built, raids, prior: raids.faced.length, systems: [], back: null };
  if (!crew.length) return { ...base, before: now, flown: null, why: `the ship can't fly even one. ${voyagePlan(now, defs, now.crew.slice(0, 1).map((member) => member.id)).error}` };
  for (let what = homeBuild(now, defs, crew); what; what = homeBuild(now, defs, crew)) put(what);
  const flown = voyageOut(now, defs, crew);
  if (!flown.ok) throw new Error(flown.error);
  return { ...base, before: now, flown };
}

// The flight home from a voyage (M38d), as far as the colony: a lander
// that comes down on the way stops it, those at home face it (faceRaid),
// and the ship flies on. { campaign (landed), days (the colony's days the
// flight took), stops (the landers that stopped it), hungry (the days
// those aboard went hungry) }.
function flyHomeFrom(campaign, defs, raids) {
  let now = campaign;
  let days = 0;
  let stops = 0;
  for (;;) {
    if (raidDown(now)) now = faceRaid(now, defs, raids);
    const flown = voyageHome(now, defs);
    if (!flown.ok) throw new Error(flown.error);
    days += flown.days.length;
    if (flown.landed) return { campaign: flown.campaign, days, stops, hungry: (flown.campaign.flags.hungryJumps ?? 0) - (campaign.flags.hungryJumps ?? 0) };
    now = flown.campaign;
    stops += 1;
  }
}

// The second colony (M38e) as the test player founds and plays it, at the
// world the ship is at in the SETTLE_SYSTEM'th system out: Settle here, the
// ship's parts given as at the first (foundColony), and its first NEW_DAYS
// days played as the first's (farms and mines, nextBuild; a raid there
// readied for and faced with everyone, readyForRaid, and one still coming
// at the end waited for, waitForRaid), cut short once the first colony is
// found, as the ship then flies back at once to meet the lander. Then
// berths and air go back aboard for those flying back
// (refitForSquad), the least fit of three or more stays (backCrew; fewer
// where the ship can't fly them all, voyageCrew), and the ship flies
// straight back to the first colony (flyBack). { campaign, settled (as it
// landed), founded (foundColony's colony), days (played there), called
// (true when the first's raid cut them short), left (the ids staying),
// crew (those flying back), before (as it flew), back (flyBack's, or null
// when the ship can't fly even one), found ({ first, second }: the raids
// found at each from the landing) }.
function secondColony(campaign, defs, raids) {
  const done = settle(campaign, defs);
  if (!done.ok) throw new Error(done.error);
  const settled = done.campaign;
  const founded = foundColony(settled, defs);
  let now = founded.campaign;
  const first = () => colonyById(now, 1);
  let days = 0;
  let called = false;
  for (; days < NEW_DAYS; days++) {
    if (first().raid) {
      called = true;
      break;
    }
    for (let what = nextBuild(now, defs); what; what = nextBuild(now, defs)) {
      const built = build(now, defs, what);
      if (!built.ok) throw new Error(built.error);
      now = built.campaign;
    }
    now = readyForRaid(now, defs, raids);
    const day = nextDay(now, defs);
    if (!day.ok) throw new Error(day.error);
    now = day.campaign;
  }
  // A raid coming at the second is met there with everyone first, unless
  // the first's is coming too: that one calls the ship back.
  if (now.colony.raid && !first().raid) {
    const met = waitForRaid(now, defs, raids);
    now = met.campaign;
    days += met.days;
  }
  let crew = backCrew(now, defs);
  now = refitForSquad(now, defs, crew.length).campaign;
  if (!flightFromPlan(now, defs, 1, crew).ok) crew = voyageCrew(now, defs);
  const left = now.crew.filter((member) => !crew.includes(member.id)).map((member) => member.id);
  const base = { settled, founded: founded.colony, days, called, left, crew, before: now };
  const foundSince = (later) => {
    const since = (flag) => (later.flags[flag] ?? 0) - (settled.flags[flag] ?? 0);
    return { first: since('othersRaidsFound'), second: since('raidsFound') - since('othersRaidsFound') };
  };
  if (!crew.length) return { ...base, campaign: now, back: null, found: foundSince(now) };
  const back = flyBack(now, defs, raids, crew);
  return { ...base, campaign: back.campaign, back, found: foundSince(back.campaign) };
}

// The flight from the second colony straight back to the first (M38e,
// voyage.js flyFrom), crew aboard: a lander that comes down on the way,
// at either, stops it, it is faced (faceRaid), and the ship flies on. {
// campaign (landed), days (the flight's), flight (the days it was to
// take), stops (the landers that stopped it), hungry (the days those
// aboard went hungry) }.
function flyBack(campaign, defs, raids, crew) {
  const plan = flightFromPlan(campaign, defs, 1, crew);
  let flown = flyFrom(campaign, defs, 1, crew);
  if (!flown.ok) throw new Error(flown.error);
  let days = flown.days.length;
  let stops = 0;
  while (!flown.landed) {
    stops += 1;
    let now = flown.campaign;
    if (raidDown(now)) now = faceRaid(now, defs, raids);
    flown = voyageHome(now, defs);
    if (!flown.ok) throw new Error(flown.error);
    days += flown.days.length;
  }
  const hungry = (flown.campaign.flags.hungryJumps ?? 0) - (campaign.flags.hungryJumps ?? 0);
  return { campaign: flown.campaign, days, flight: plan.days, stops, hungry };
}

// The second colony as the log says it (M38e): "Settled Saltmarch (Desert
// world), 2 systems out: gave Quarters, Life support; 10 days, built Farm,
// Mine; Quill Petrov stays. Flew back to Copperhill: 2 days, landed with
// Fen Lindqvist and Lark Ibarra, 41 food."
function secondLine(defs, second) {
  const { settled, founded, days, called, left, back } = second;
  const name = (id) => second.before.crew.find((member) => member.id === id)?.name ?? String(id);
  const built = second.before.colony.buildings.filter((b) => defs.colony.builds.has(b.type)).map((b) => defs.colony.builds.get(b.type).name);
  const given = founded.given.map((type) => defs.modules.get(type)?.name ?? type);
  const stays = left.length ? `${listed(left.map(name))} stay${left.length === 1 ? 's' : ''}` : 'nobody stays';
  const there = `Settled ${settled.colony.world.name} (${kindName(defs, settled.colony.world)}), ${SETTLE_SYSTEM} systems out: gave ${given.join(', ') || 'nothing'}; ${days} day${days === 1 ? '' : 's'}${called ? ', cut short by a raid coming at the first' : ''}, built ${built.join(', ') || 'nothing'}; ${stays}.`;
  if (!back) return `${there} The ship can't fly back with anyone.`;
  const { colony, supplies } = back.campaign;
  return `${there} Flew back to ${colony.world.name}: ${back.days} day${back.days === 1 ? '' : 's'}${back.stops ? `, stopped ${back.stops} time${back.stops === 1 ? '' : 's'}` : ''}, landed on day ${colony.day} with ${listed(second.crew.map(name))}, ${supplies} food.`;
}

// What the trips came to, as a line of its report: "30 days of trips: 4
// trips, 14 days away: The Anvil (day 31, 2 days, 3 aboard: Rich seam: Dig
// deep), ...; brought 2 parts, 23 materials and 10 food; boardings won 1,
// lost 0; built Shelter (day 40); refitted Life support aboard; 0 hungry
// days."
function tripsLine(defs, trips) {
  const each = trips.flown.map((trip) => `${trip.name}${trip.quest ? `, ${(questOf(defs, trip.quest)?.name ?? trip.quest).replace(/^The /, 'the ')}` : ''} (day ${trip.day}, ${trip.days} days, ${trip.squad} aboard: ${trip.what})`).join('; ');
  const builds = trips.built.map((b) => `${b.name} (day ${b.day})`).join(', ');
  return (
    `${TRIP_DAYS} days of trips: ${trips.flown.length} trip${trips.flown.length === 1 ? '' : 's'}, ${trips.away} days away${each ? `: ${each}` : ''}. ` +
    `Brought ${trips.parts} part${trips.parts === 1 ? '' : 's'}, ${trips.materials} materials and ${trips.food} food; boardings won ${trips.won}, lost ${trips.lost}, left ${trips.left}; ` +
    `built ${builds || 'nothing'}; refitted ${trips.moved.length ? trips.moved.map((type) => defs.modules.get(type)?.name ?? type).join(', ') : 'nothing'} aboard; ${trips.hungry} hungry day${trips.hungry === 1 ? '' : 's'}.` +
    (trips.sealed ? ` On day ${trips.sealed.day} the fight at ${trips.sealed.name} sealed itself in, no one able to reach the other side: the trips stop there.` : '')
  );
}

// What the raids came to over the colony's days (M29), as a line of its
// report: "Raids over 60 days (off the lanes; heat 52 to 31): found 2,
// faced 2. Day 14: the guns stopped 1 of 4, 3 at home, won. Day 41, the
// ship away: the guns stopped 0 of 4, 2 at home, lost: they took 12 food,
// 15 materials and a Shield generator. Set down Gun emplacement (day 13)."
function raidsLine(defs, raids) {
  const lanes = ['near the lanes', 'off the lanes', 'far from the lanes'][raids.lanes - 1];
  const each = raids.faced.map((raid) => raidLine(defs, raid));
  const set = raids.set.map((b) => `${b.name} (day ${b.day})`).join(', ');
  return [
    `Raids over ${COLONY_DAYS + TRIP_DAYS} days (${lanes}; heat ${raids.heat[0]} to ${raids.heat[1]}): found ${raids.found}, faced ${raids.faced.length}.`,
    ...each,
    ...(set ? [`Set down ${set}.`] : []),
    ...(raids.coming ? ['A raid still coming at the end.'] : []),
  ].join(' ');
}

// One raid faced, as the log says it: "Day 41, the ship away: the guns
// stopped 0 of 4, 2 at home, lost: they took 12 food."
function raidLine(defs, raid) {
  const fight = !raid.home ? 'nobody home' : raid.fought ? `${raid.home} at home` : 'no fight';
  const outcome = raid.won ? 'won' : `lost: they took ${tookText(defs, raid.taken)}`;
  return `Day ${raid.day}${raid.away ? ', the ship away' : ''}: the guns stopped ${raid.stopped} of ${raid.stopped + raid.landed}, ${fight}, ${outcome}.`;
}

// The voyage out as the log says it (M38d): "Flew out from Copperhill on
// day 61 with Fen Lindqvist and Quill Petrov, Lark Ibarra at home: the
// holds took 30 food, the colony kept 20 of 20; refitted Bunks aboard;
// built Shelter."
function outLine(defs, leaving) {
  const { before, flown } = leaving;
  const name = (id) => before.crew.find((member) => member.id === id)?.name ?? String(id);
  const { food } = flown.plan;
  const said = [
    `the holds took ${food.ship} food, the colony kept ${food.colony} of ${food.room}${food.spoils ? `, ${food.spoils} spoiled` : ''}`,
    ...(leaving.moved.length ? [`refitted ${leaving.moved.map((type) => defs.modules.get(type)?.name ?? type).join(', ')} aboard`] : []),
    ...(leaving.built.length ? [`built ${leaving.built.map((b) => b.name).join(', ')}`] : []),
  ];
  const days = (n, why) => (n ? [`${n} day${n === 1 ? '' : 's'} ${why}`] : []);
  const stayed = [...days(leaving.stocked, 'stocking the holds'), ...days(leaving.waited, 'at home for a raid')];
  const waited = stayed.length ? `, after ${listed(stayed)},` : '';
  const home = leaving.home.length ? `${listed(leaving.home.map(name))} at home` : 'nobody at home';
  return `Flew out from ${before.colony.world.name} on day ${before.colony.day}${waited} with ${listed(leaving.crew.map(name))}, ${home}: ${said.join('; ')}.`;
}

// The flight home as the log says it (M38d): "Flew home from 3 systems
// out (Lamplight): 3 days, 0 hungry; landed at Copperhill on day 84, the
// stores one again: 41 food and 30 materials." before: as it set out.
function homeLine(back, before) {
  const { out } = before.colony.voyage;
  const stops = back.stops ? `, a lander stopping it ${back.stops === 1 ? 'once' : `${back.stops} times`}` : '';
  const { colony, supplies } = back.campaign;
  return `Flew home from ${out} system${out === 1 ? '' : 's'} out (${before.run.sector.name}): ${back.days} day${back.days === 1 ? '' : 's'}, ${back.hungry} hungry${stops}; landed at ${colony.world.name} on day ${colony.day}, the stores one again: ${supplies} food and ${colony.materials} materials.`;
}

// What the voyage out came to (M38d), as the log's last line: the systems
// crossed, the jumps, the work and trade on the way, the hunters, and the
// colony while the ship was away.
function voyageLine(out) {
  const { tally } = out;
  const faced = out.raids.faced.filter((raid) => raid.away);
  const lost = faced.filter((raid) => !raid.won).length;
  const where = out.back ? `home after ${out.colony.days} days away${out.back.called ? ', called home by a raid' : ''}` : 'still out';
  return (
    `The voyage out: ${tally.crossed} of ${VOYAGE_SYSTEMS} systems crossed, ${where}; ${tally.jumps} jumps (${tally.hungryJumps} hungry); ${tally.stationJobs} station jobs (${tally.stationJobsWon} done) for ${tally.jobCredits} credits; ` +
    `spent ${spentOf(tally)} credits, ${tally.yardBought} parts bought, ${tally.fitted} fitted; credits ${out.credits[0]} to ${out.credits[1]}. ` +
    `${tally.approaches} hostile ships, the hunters ${tally.hunts}; heat ${tally.heat[0]} to ${tally.heat[1]}, at most ${tally.peak}; crew ${tally.hp[0]} to ${tally.hp[1]}. ` +
    `At home: found ${out.colony.found} time${out.colony.found === 1 ? '' : 's'}, ${faced.length} raid${faced.length === 1 ? '' : 's'} faced while away, ${lost} lost; ${out.colony.hungry} hungry day${out.colony.hungry === 1 ? '' : 's'}.` +
    (out.after ? ` ${afterLine(out.after)}` : '')
  );
}

// The days after the voyage out (M38f), as the log says them: "20 days
// more at the first colony. Citizens: 2 at the first, 0 at the second; 3
// came, 1 left, 0 fell. Raids fought out without the ship 1: won 1."
function afterLine(after) {
  const at = after.citizens.map(([id, n]) => `${n} at the ${id === 1 ? 'first' : id === 2 ? 'second' : `colony ${id}`}`);
  return `${AFTER_DAYS} days more at the first colony. Citizens: ${at.join(', ')}; ${after.grown} came, ${after.left} left, ${after.fell} fell${after.settled ? `, ${after.settled} rescued settled` : ''}. Raids fought out without the ship ${after.foughtOut}: won ${after.won}, lost ${after.lost}.`;
}

// The credits a voyage's tally spent: supplies, patching, repairs,
// recruits, swaps, weapons and parts.
export function spentOf(tally) {
  return tally.spent + tally.patchCredits + tally.repairCredits + tally.hireCredits + tally.swapCredits + tally.armsCredits + tally.yardCredits;
}

// What a lost raid took, in words: "12 food, 15 materials and a Shield
// generator", or "nothing".
function tookText(defs, taken) {
  const part = taken?.part ? defs.modules.get(taken.part)?.name ?? taken.part : null;
  const said = [...(taken?.food ? [`${taken.food} food`] : []), ...(taken?.materials ? [`${taken.materials} materials`] : []), ...(part ? [`${/^[aeiou]/i.test(part) ? 'an' : 'a'} ${part}`] : [])];
  return said.length < 2 ? said[0] ?? 'nothing' : `${said.slice(0, -1).join(', ')} and ${said.at(-1)}`;
}

// What the colony's days came to, as a line of its report: "30 days at the
// colony: built Mine 2 (day 1), Farm 4 (days 4, 6, 9, 11); its farms feed
// the crew from day 11; 6 hungry days; food 4 to 25, materials 20 to 30, of
// 30 each."
function daysLine(days) {
  const named = new Map();
  for (const { day, name } of days.built) named.set(name, [...(named.get(name) ?? []), day]);
  const builds = [...named].map(([name, on]) => `${name}${on.length > 1 ? ` ${on.length}` : ''} (day${on.length > 1 ? 's' : ''} ${on.join(', ')})`).join(', ');
  const fed = days.fedOn === null ? 'its farms never feed the crew' : `its farms feed the crew from day ${days.fedOn}`;
  return (
    `${COLONY_DAYS} days at the colony: built ${builds || 'nothing'}; ${fed}; ${days.hungry} hungry day${days.hungry === 1 ? '' : 's'}${days.hurt ? ` (${days.hurt} hit points)` : ''}; ` +
    `food ${days.food[0]} to ${days.food[1]}, materials ${days.materials[0]} to ${days.materials[1]}, of ${days.stores} each; ${days.farms} farm${days.farms === 1 ? '' : 's'} and ${days.mines} mine${days.mines === 1 ? '' : 's'}.`
  );
}

// What a run's colony came to, as a line of its report.
function colonyLine(defs, colony) {
  const { given, power } = colony;
  const housed = colony.aboard ? `${colony.aboard} of them sleep aboard` : 'everyone has a bed and air';
  return (
    `Founded the colony: gave ${given.length ? namesOf(defs, given) : 'nothing'}; power ${power.made} (${power.plants} from its plants, ${power.ship} the ship's spare), ${power.used} used, ${colony.dark} dark; ` +
    `beds ${colony.beds} and air ${colony.air} for a crew of ${colony.crew}: ${housed}. The ship ${colony.flies ? 'passes' : 'fails'} its flight checks with nobody aboard.`
  );
}

// The buildings parts make, by name, most first: "Barracks, Air plant 2".
function namesOf(defs, types) {
  const counts = {};
  for (const type of types) {
    const name = buildingOf(type, defs)?.name ?? type;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([name, n]) => (n > 1 ? `${name} ${n}` : name)).join(', ');
}

// Act 1's test run from campaign seed `seed` (from `background`'s start,
// the first's if none), and the launch: { ok: true, campaign (launched),
// jobs } or { ok: false, line, over (true for a game over in act 1, M41) }.
// The slow half of a voyage, so callers flying a seed more than once can
// keep it. game is the game's: { difficulty, permadeath } (M41; Normal, and
// death not permanent, unless given).
export function launchedAt(defs, seed, background, game = {}) {
  const act1 = runToLaunch(defs, seed, { background, ...game });
  const lifted = act1.launched ? launch(act1.campaign, defs) : null;
  if (!lifted?.ok) return { ok: false, line: `Campaign seed ${seed}: ${lifted?.error ?? act1.lines.at(-1)}`, over: act1.over, campaign: act1.campaign };
  return { ok: true, campaign: lifted.campaign, jobs: act1.jobs };
}

// A voyage from campaign seed `seed`: act 1's test run to launch (or
// `lifted`, launchedAt's for the seed), then the voyage, with the parts in
// fit (module types) fitted to the ship first. { launched, ...voyageFrom },
// or { launched: false, lines, over } if the test run stopped short. With
// options.difficulty and options.permadeath (M41) the game is played at
// them. Where death is permanent and a fight leaves no one aboard, the
// game is over: { launched: true, over: true, act (where it ended),
// campaign, lines }.
export function voyage(defs, seed, options = {}, lifted = launchedAt(defs, seed, options.background, gameOf(options))) {
  const { fit = [], frame = null, background, difficulty, permadeath, ...rest } = options;
  if (!lifted.ok) return { launched: false, lines: [lifted.line], over: lifted.over === true, campaign: lifted.campaign };
  // On another hull frame first (M39), its parts where they were, shifted
  // in if need be, as a yard moves a ship over (reframe.js).
  const moved = frame ? onFrame(lifted.campaign.ship, defs, frame) : { ok: true, ship: lifted.campaign.ship };
  if (!moved.ok) throw new Error(moved.error);
  const ship = fit.reduce((fitted, type) => withPart(fitted, defs, type), moved.ship);
  // A ship that fails a flight check can't leave a station (M23h), so what
  // is fitted has to keep every check passing.
  const broken = flightChecklist(ship, defs, lifted.campaign.crew.length).find((line) => line.ok !== true);
  const how = [frame && `On the ${defs.frames.get(frame).name}`, fit.length && `fitted with ${fit.join(' and ')}`].filter(Boolean).join(', ');
  if (broken) throw new Error(`${how.charAt(0).toUpperCase()}${how.slice(1)}, the ship fails a flight check: ${broken.text}.`);
  try {
    return { launched: true, ...voyageFrom(defs, { ...lifted.campaign, ship }, { ...rest, label: `Campaign seed ${seed}, after ${lifted.jobs} jobs. ` }) };
  } catch (error) {
    if (!(error instanceof GameOver)) throw error;
    return { launched: true, over: true, act: error.campaign.act, campaign: error.campaign, lines: [`Campaign seed ${seed}: ${error.message}`] };
  }
}

// The game's difficulty and permanent death from a voyage's options (M41):
// { difficulty, permadeath }, Normal and not permanent unless given.
function gameOf(options) {
  return { difficulty: options.difficulty ?? 'normal', permadeath: options.permadeath === true };
}

// Voyages from seeds 1 to `runs` from each background's start, side by
// side (M30): how many launched, crossed fed all the way and met the
// hunters, and the colony's raids faced, won and lost, with the runs that
// lost one; (M33) the median standing with each side at the launch and at
// the landing; and (M33b) what came of the quests (questCounts). { lines,
// rows }, a row a background: { id, name, launched, fed, met, faced, won,
// lost, runsLost, standing, quests }.
export function voyagesByBackground(defs, runs, options = {}) {
  const rows = [...defs.backgrounds.values()].map(({ id, name }) => {
    const done = manyVoyages(defs, runs, { ...options, background: id }).results.filter((r) => r.launched && !r.over);
    const faced = done.flatMap((r) => r.tally.raids?.faced ?? []);
    const won = faced.filter((raid) => raid.won).length;
    return {
      id,
      name,
      launched: done.length,
      fed: done.filter((r) => r.tally.hungryJumps === 0).length,
      met: done.filter((r) => r.tally.hunts > 0).length,
      faced: faced.length,
      won,
      lost: faced.length - won,
      runsLost: done.filter((r) => (r.tally.raids?.faced ?? []).some((raid) => !raid.won)).length,
      standing: standingMedians(defs, done),
      quests: questCounts(defs, done),
      companions: companionCounts(defs, done),
      levers: leverCounts(done),
      reckoning: reckoningCounts(done),
      near: done.filter((r) => r.tally.days).reduce((sum, r) => sum + (r.tally.days.near ?? 0), 0),
      nearRuns: done.filter((r) => r.tally.days?.near > 0).length,
      settlers: done.reduce((sum, r) => sum + Math.max(r.campaign?.flags?.survivorsSettled ?? 0, r.out?.campaign?.flags?.survivorsSettled ?? 0), 0),
    };
  });
  const width = Math.max(...rows.map((row) => row.name.length), 10);
  const cells = (values) => values.map((value, i) => (i ? String(value).padStart(i === 1 ? 8 : 9) : String(value).padEnd(width))).join('  ');
  const lines = [
    `${runs} voyages from each background's start, campaign seeds 1 to ${runs}: launched, fed all the way, met the hunters, and the colony's raids.`,
    cells(['Background', 'Launched', 'Fed', 'Met', 'Raids', 'Won', 'Lost', 'Runs lost']),
    ...rows.map((row) => cells([row.name, row.launched, row.fed, row.met, row.faced, row.won, row.lost, row.runsLost])),
    'Standing with each side, the median at the launch, then at the landing (M33):',
    ...rows.map((row) => `${row.name.padEnd(width)}  ${standingLine(defs, row.standing)}`),
    'The quests (M33b):',
    ...rows.map((row) => `${row.name.padEnd(width)}  ${questsLine(row.quests)}`),
    "The companions (M33c), each met at their chain's step, signed on, and loyal by the end:",
    ...rows.map((row) => `${row.name.padEnd(width)}  ${companionsLine(row.companions)}`),
    "The colony's levers on heat (M53), over its first days: runs that pulled each, and how often:",
    ...rows.map((row) => `${row.name.padEnd(width)}  ${leversLine(row.levers)}`),
    "Neighbours and settlers (M54): buildings gaining from a neighbour at the end of the colony's first days, and survivors from events who settled:",
    ...rows.map((row) => `${row.name.padEnd(width)}  ${row.near} buildings in ${row.nearRuns} colonies; ${row.settlers} survivors settled`),
    "The reckoning (M56): runs whose colony the leader landed on, won it (the pursuit over), lost it at least once, and the leader's landings in all:",
    ...rows.map((row) => `${row.name.padEnd(width)}  met in ${row.reckoning.met}, won in ${row.reckoning.won}, lost in ${row.reckoning.lost} (${row.reckoning.landings} landings); of ${row.reckoning.played} colonies`),
  ];
  return { lines, rows };
}

// The colony's levers in voyages that played its days (M53): for each,
// the runs that pulled it and the times in all; lowDays the days it lay
// low.
export function leverCounts(done) {
  const played = done.filter((r) => r.tally.days?.levers);
  const of = (key) => ({ runs: played.filter((r) => r.tally.days.levers[key] > 0).length, times: played.reduce((sum, r) => sum + r.tally.days.levers[key], 0) });
  return { played: played.length, pay: of('pay'), low: of('low'), sell: of('sell'), buy: of('buy'), lowDays: of('lowDays') };
}

// The reckoning in voyages that founded a colony (M56), from the flags
// reckoning.js counts (faced by the crew or fought out while the ship was
// away): runs it landed in, runs it was won in (the pursuit over), runs it
// was lost in at least once, and its landings in all.
export function reckoningCounts(done) {
  const played = done.filter((r) => r.landed);
  const flags = (r) => [r.campaign, r.out?.campaign, r.travelled, r.home].reduce((most, campaign) => ({
    won: Math.max(most.won, campaign?.flags?.reckoningsWon ?? 0),
    lost: Math.max(most.lost, campaign?.flags?.reckoningsLost ?? 0),
  }), { won: 0, lost: 0 });
  const counted = played.map(flags);
  return {
    played: played.length,
    met: counted.filter(({ won, lost }) => won + lost > 0).length,
    won: counted.filter(({ won }) => won > 0).length,
    lost: counted.filter(({ lost }) => lost > 0).length,
    landings: counted.reduce((sum, { won, lost }) => sum + won + lost, 0),
  };
}

function leversLine(levers) {
  const said = (name, { runs, times }) => `${name} in ${runs} (${times})`;
  return `${said('paid', levers.pay)}, ${said('lay low', levers.low)} for ${levers.lowDays.times} days, ${said('sold to a trader', levers.sell)}, ${said('bought its part', levers.buy)}; of ${levers.played} colonies`;
}

// What came of the companions in voyages that launched (M33c), each in the
// data's order: [{ id, name, met (runs that came to their chain's step),
// joined (runs they signed on in), loyal (runs they were loyal in by the
// colony's last day) }].
export function companionCounts(defs, done) {
  return [...(defs.companions?.values() ?? [])].map(({ id, name }) => ({
    id,
    name,
    met: done.filter((r) => r.tally.companions.met.includes(id)).length,
    joined: done.filter((r) => r.tally.companions.joined.includes(id)).length,
    loyal: done.filter((r) => (r.travelled ?? r.campaign).crew.some((member) => member.companion === id && member.loyal)).length,
  }));
}

// companionCounts in words: "Ines Varga met in 12, signed on in 9, loyal
// in 6; …".
function companionsLine(counts) {
  return counts.map((c) => `${c.name} met in ${c.met}, signed on in ${c.joined}, loyal in ${c.loyal}`).join('; ');
}

// What came of the quests in voyages that launched (M33b): { thread (its
// name, or null), job (act 1's step done by the launch), run and runCold
// (the run's step done by the landing, or gone cold), place (its place won
// by the end), placeLost (fights lost there), landed (runs that settled),
// chain ({ started, done, cold }: the Fleet's), waved (runs a patrol waved
// through, and times), odds ({ before, after }: the colony's odds of being
// found a day at home, the mean percent, with the days counted, in the runs
// with a pay-off) and raids ({ before, after }: raids faced before and
// after the pay-off, in those runs) }.
export function questCounts(defs, done) {
  const thread = done.length ? threadOf(done[0].campaign, defs) : null;
  const id = thread?.id;
  const stepAt = (quests) => quests?.[id] ?? null;
  const landed = done.filter((r) => r.tally.quests.landing);
  const chain = [...defs.quests.values()].find((quest) => quest.side);
  const chainOf = (r) => (r.tally.quests.end ?? r.tally.quests.landing ?? r.campaign.quests)?.[chain?.id] ?? null;
  const paid = done.filter((r) => r.tally.raids?.payoff != null);
  const days = paid.flatMap((r) => r.tally.raids.odds);
  const mean = (list) => (list.length ? Math.round((10 * list.reduce((sum, day) => sum + day.found, 0)) / list.length) / 10 : null);
  const facedBy = (after) => paid.reduce((sum, r) => sum + r.tally.raids.faced.filter((raid) => (raid.day > r.tally.raids.payoff) === after).length, 0);
  return {
    thread: thread?.name ?? null,
    job: done.filter((r) => (stepAt(r.tally.quests.launch)?.step ?? 0) >= 1).length,
    run: landed.filter((r) => (stepAt(r.tally.quests.landing)?.step ?? 0) >= 2).length,
    runCold: landed.filter((r) => stepAt(r.tally.quests.landing)?.state === 'cold').length,
    place: done.filter((r) => stepAt(r.tally.quests.end)?.state === 'done').length,
    placeLost: done.reduce((sum, r) => sum + (r.tally.trips?.flown ?? []).filter((trip) => trip.quest && trip.what === 'boarded her and lost').length, 0),
    launched: done.length,
    landed: landed.length,
    chain: { started: done.filter((r) => chainOf(r)).length, done: done.filter((r) => chainOf(r)?.state === 'done').length, cold: done.filter((r) => chainOf(r)?.state === 'cold').length },
    waved: { runs: done.filter((r) => r.tally.waved > 0).length, times: done.reduce((sum, r) => sum + r.tally.waved, 0) },
    paid: paid.length,
    odds: { before: mean(days.filter((day) => !day.eased)), after: mean(days.filter((day) => day.eased)), days: [days.filter((day) => !day.eased).length, days.filter((day) => day.eased).length] },
    raids: { before: facedBy(false), after: facedBy(true) },
  };
}

// questCounts in words: "The miner's debt: act 1's step done in 30 of 30,
// the run's in 24 of 29 (5 gone cold), its place won in 12 (2 fights lost
// there). The Fleet's chain: started in 9, done in 7, gone cold in 2; waved
// through in 6 runs (8 times). In the 12 runs with a pay-off, found 6.2% a
// day before it (402 days) and 1.5% after (310), raids faced 3 before and
// 0 after."
function questsLine(counts) {
  const odds = (value) => (value === null ? '-' : `${value}%`);
  return (
    `${counts.thread ?? 'No thread'}: act 1's step done in ${counts.job} of ${counts.launched}, the run's in ${counts.run} of ${counts.landed} (${counts.runCold} gone cold), its place won in ${counts.place} (${counts.placeLost} fight${counts.placeLost === 1 ? '' : 's'} lost there). ` +
    `The Fleet's chain: started in ${counts.chain.started}, done in ${counts.chain.done}, gone cold in ${counts.chain.cold}; waved through in ${counts.waved.runs} run${counts.waved.runs === 1 ? '' : 's'} (${counts.waved.times} time${counts.waved.times === 1 ? '' : 's'}). ` +
    `In the ${counts.paid} run${counts.paid === 1 ? '' : 's'} with a pay-off, found ${odds(counts.odds.before)} a day before it (${counts.odds.days[0]} days) and ${odds(counts.odds.after)} after (${counts.odds.days[1]}), raids faced ${counts.raids.before} before and ${counts.raids.after} after.`
  );
}

// The median standing with each side at the launch and at the landing (M33),
// of the voyages that settled a world: { [side]: [launch, landing] }.
function standingMedians(defs, done) {
  const landed = done.filter((r) => r.tally.standing.landing);
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] ?? 0;
  return Object.fromEntries([...defs.factions.sides.keys()].map((side) => [side, [median(landed.map((r) => r.tally.standing.launch[side] ?? 0)), median(landed.map((r) => r.tally.standing.landing[side] ?? 0))]]));
}

// Whether the ship is at a station of a side friendly or trusted with the
// crew (M33).
function calledFriendly(campaign, defs) {
  const side = stationSide(hereOf(campaign), defs);
  return side !== null && ['friendly', 'trusted'].includes(levelOf(standingWith(campaign, side), defs));
}

// "Con-Reg −10 → −10, the Fleet 0 → −2, …".
function standingLine(defs, standing) {
  const signedOf = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  return Object.entries(standing).map(([side, [launch, landing]]) => `${defs.factions.sides.get(side)?.name ?? side} ${signedOf(launch)} → ${signedOf(landing)}`).join(', ');
}

// Voyages from seeds 1 to `runs`, summed up: { lines, results }.
export function manyVoyages(defs, runs, options = {}) {
  const results = [];
  for (let seed = 1; seed <= runs; seed++) results.push({ seed, ...voyage(defs, seed, options) });
  const done = results.filter((r) => r.launched && !r.over);
  const spread = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const of = (key) => done.map((r) => r.tally[key]);
  // In the first three sectors: M19's Done when.
  const early = (r, test) => r.steps.filter((step) => step.sector <= 3 && test(step)).length;
  const hungryEarly = done.map((r) => early(r, (step) => step.hungry));
  const ignoring = options.heat === 'ignore';
  const policy = ignoring || options.long === 'never' ? 'never' : `when heat is at ${LONG_FROM} or over`;
  const met = done.filter((r) => r.tally.hunts > 0).length;
  const lines = [
    `${runs} voyages from launch, campaign seeds 1 to ${runs}${options.background ? `, the ${defs.backgrounds.get(options.background)?.name.toLowerCase()}` : ''}${options.difficulty && options.difficulty !== 'normal' ? `, on ${options.difficulty}` : ''}${options.permadeath ? ', death permanent' : ''}, ${ignoring ? 'ignoring heat' : 'managing heat'}, long jumps ${policy}, ${options.scans === 'no' ? 'no scans' : 'scanning'}, ${options.refit === 'no' ? 'no refits' : 'refitting at stations'}, ${options.jobs === 'no' ? 'no station jobs' : 'taking station jobs'}${options.fit?.length ? `, fitted with ${options.fit.join(' and ')}` : ''}. The median, then the least and most:`,
    `Sectors crossed: ${spread(of('crossed'))}; ${done.filter((r) => r.system).length} of ${done.length} entered the system past the charts, ${done.filter((r) => r.ended).length} settled a world; fed all the way in ${done.filter((r) => r.tally.hungryJumps === 0).length} of ${done.length}.`,
    systemLine(defs, done),
    colonySummary(defs, done),
    daysSummary(done),
    tripsSummary(done),
    raidsSummary(defs, done),
    outSummary(done),
    secondSummary(done),
    citizensSummary(done),
    `The quests (M33b): ${questsLine(questCounts(defs, done))}`,
    `The companions (M33c): ${companionsLine(companionCounts(defs, done))}.`,
    `Jumps: ${spread(of('jumps'))}, long ${spread(of('longJumps'))}, hungry ${spread(of('hungryJumps'))}.`,
    `At the nodes: ${spread(of('events'))} events, ${spread(of('eventCredits'))} credits and ${spread(of('eventSupplies'))} supplies from them, ${spread(of('found'))} parts found, ${spread(of('sold'))} sold, ${spread(of('wounds'))} hit points lost; traps ${spread(of('ambushes'))}, in ${done.filter((r) => r.tally.ambushes > 0).length} of ${done.length} runs; parts wrecked ${spread(of('eventWrecks'))} and mended ${spread(of('eventRepairs'))}; ${spread(of('scans'))} scans.`,
    `Hostile ships: ${spread(of('approaches'))} met, ${spread(of('approachesWon'))} disabled or blown up, ${spread(of('approachesLost'))} boarding us. Boarded her ${spread(of('boardings'))} times (won ${spread(of('boardingsWon'))}), left her ${spread(of('left'))}; fought off ${spread(of('defencesWon'))} of ${spread(of('defences'))} boardings. Salvage: ${spread(of('salvaged'))} parts and ${spread(of('salvageCredits'))} credits. Lost: ${spread(of('partsLost'))} parts and ${spread(of('creditsLost'))} credits; ${spread(of('fightHp'))} hit points in the fights. Lost a boarding at home: ${done.filter((r) => r.steps.some((step) => step.kind === 'boarding' && step.dir === 'you' && !step.won)).length} of ${done.length}; dragged past 40 rounds: ${done.reduce((sum, r) => sum + r.tally.dragged, 0)}.`,
    `At stations: patched ${spread(of('patchedHp'))} hit points for ${spread(of('patchCredits'))} credits; ${spread(of('repairs'))} repairs for ${spread(of('repairCredits'))} credits. Crew at the end: ${spread(done.map((r) => r.campaign.crew.reduce((sum, m) => sum + m.hp, 0)))} hit points.`,
    `Crew: signed on ${spread(of('hired'))} for ${spread(of('hireCredits'))} credits, ${done.filter((r) => r.tally.hired > 0).length} of ${done.length} runs; ${spread(done.map((r) => r.campaign.crew.length))} aboard at the end. The med bay healed ${spread(of('healed'))} hit points.`,
    `Refits: ${spread(of('fitted'))} parts fitted at ${spread(of('refits'))} stations and shipyards, in ${done.filter((r) => r.tally.fitted > 0).length} of ${done.length} runs: ${fitsLine(defs, done)}. Bought at shipyards (M37b): ${spread(of('yardBought'))} parts for ${spread(of('yardCredits'))} credits, in ${done.filter((r) => r.tally.yardBought > 0).length} of ${done.length} runs.`,
    `Station jobs (M38c): ${spread(of('stationJobs'))} taken, in ${done.filter((r) => r.tally.stationJobs > 0).length} of ${done.length} runs, ${spread(of('stationJobsWon'))} done (${done.reduce((sum, r) => sum + r.tally.stationJobsWon, 0)} of ${done.reduce((sum, r) => sum + r.tally.stationJobs, 0)} in all); paid ${spread(of('jobCredits'))} credits; heat ${spread(of('jobHeat'))}; hit points ${spread(of('jobHp'))}.`,
    `In the first three sectors: restocked at ${spread(done.map((r) => early(r, (step) => step.kind === 'buy')))} stations; hungry on ${spread(hungryEarly)} jumps; fed all the way in ${hungryEarly.filter((n) => n === 0).length} of ${done.length}.`,
    `Supplies bought: ${spread(of('bought'))}, for ${spread(of('spent'))} credits. Launch credits: ${spread(done.map((r) => r.steps[0]?.credits[0] ?? 0))}.`,
    `Heat at launch: ${spread(done.map((r) => r.tally.heat[0]))}; at the end: ${spread(done.map((r) => r.tally.heat[1]))}; at most: ${spread(of('peak'))}. Jumps where the hunters might wait: ${spread(of('hotJumps'))}.`,
    `The hunters: met in ${met} of ${done.length} runs, ${spread(of('hunts'))} a run (the task force ${spread(of('taskForces'))}), faced ${spread(of('huntsFaced'))}. Regroups ${spread(of('regroups'))}, days hidden ${spread(of('hides'))}, healing ${spread(of('rested'))}; transponder swaps ${spread(of('swaps'))} for ${spread(of('swapCredits'))} credits.`,
    `The sides (M33): patrols waved the ship through ${spread(of('waved'))} times a run, fired first ${spread(of('fired'))}; traded at the pursuer's side's stations (each logging the ship) ${spread(of('docked'))} times, in ${done.filter((r) => r.tally.docked > 0).length} of ${done.length} runs, and passed one by without trading ${spread(of('passedBy'))} times, in ${done.filter((r) => r.tally.passedBy > 0).length}; called at a friendly or trusted side's station ${spread(of('friendly'))} times. Standing, the median at the launch, then at the landing: ${standingLine(defs, standingMedians(defs, done))}.`,
    ...(options.fights || options.permadeath ? [fightsLine(results)] : []),
    ...(options.permadeath ? [deathLine(results)] : []),
    ...results.filter((r) => !r.launched || r.over).map((r) => r.lines.at(-1)),
  ];
  return { lines, results };
}

// Where death is permanent (M41): the games over and the act each ended
// in, and the dead and the captains lost a game, the median then the most,
// over every game that began.
// Every fight of the games, act 1's among them (M41): won of all, and the
// share, from the campaigns' counts.
export function fightsLine(results) {
  const flags = results.map((r) => r.campaign?.flags ?? {});
  const won = flags.reduce((sum, f) => sum + (f.fightsWon ?? 0), 0);
  const all = won + flags.reduce((sum, f) => sum + (f.fightsLost ?? 0), 0);
  return `Fights (M41): won ${won} of ${all}, ${all ? Math.round((100 * won) / all) : 0}%.`;
}

export function deathLine(results) {
  const over = results.filter((r) => r.over);
  const acts = [1, 2, 3].map((act) => over.filter((r) => (r.launched ? r.act : 1) === act).length);
  const flags = results.map((r) => r.campaign?.flags ?? {}).filter(Boolean);
  const died = flags.map((f) => f.crewLost ?? 0).sort((a, b) => a - b);
  const median = died.length ? died[Math.floor((died.length - 1) / 2)] : 0;
  return `Death permanent (M41): ${over.length} of ${results.length} games over (act 1 ${acts[0]}, act 2 ${acts[1]}, act 3 ${acts[2]}); died ${median} a game at the median, at most ${died.at(-1) ?? 0}, none in ${died.filter((n) => n === 0).length}; captains lost in ${flags.filter((f) => (f.captainsLost ?? 0) > 0).length}.`;
}

// The system past the charts (M25): the surveys, and the worlds settled.
function systemLine(defs, done) {
  const settled = done.filter((r) => r.ended).map((r) => r.tally.settled);
  const kinds = {};
  for (const world of settled) kinds[world.kind] = (kinds[world.kind] ?? 0) + 1;
  const named = Object.entries(kinds).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([kind, n]) => `${kindName(defs, { kind })} ${n}`);
  const surveys = done.map((r) => r.tally.surveys);
  const count = (n) => surveys.filter((s) => s === n).length;
  const worlds = defs.worlds.system.worlds;
  const surveyed = [...Array(worlds + 1).keys()].reverse().map((n) => `${n === worlds ? `all ${n} worlds` : n || 'none'} in ${count(n)}${n === worlds ? ' runs' : ''}`);
  return `The system: surveyed ${surveyed.join(', ')}. Settled a surveyed world in ${settled.filter((world) => world.surveyed).length} of ${done.length}, the system's best (all its numbers known) in ${settled.filter((world) => world.surveyed && world.score === world.best).length}; by kind: ${named.join(', ') || 'none'}. Hungry jumps in the system: ${done.reduce((sum, r) => sum + r.tally.systemHungry, 0)}; the hunters met there: ${done.reduce((sum, r) => sum + r.steps.filter((step) => step.kind === 'approach' && step.sector > defs.acts.get(2).sectors).length, 0)}.`;
}

// The colonies founded (M26): what was given, and how they house and
// power the crew.
function colonySummary(defs, done) {
  const colonies = done.map((r) => r.tally.colony).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const housed = colonies.filter((colony) => colony.aboard === 0).length;
  return (
    `The colony: founded in ${colonies.length} of ${done.length}, ${median(colonies.map((colony) => colony.given.length))} parts given: ${namesOf(defs, colonies.flatMap((colony) => colony.given)) || 'none'}. ` +
    `Everyone housed in ${housed} of ${colonies.length}, ${median(colonies.map((colony) => colony.aboard))} sleeping aboard; every building powered in ${colonies.filter((colony) => colony.dark === 0).length}, power to spare ${median(colonies.map((colony) => colony.power.spare))}; ` +
    `the ship flies with nobody aboard in ${colonies.filter((colony) => colony.flies).length}.`
  );
}

// The colonies' first days (M27): when their farms fed the crew, what
// was built, the hungry days, and the stocks at the end.
function daysSummary(done) {
  const played = done.map((r) => r.tally.days).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const fed = played.filter((days) => days.fedOn !== null);
  const soon = fed.filter((days) => days.fedOn - 1 <= FED_WITHIN).length;
  return (
    `The colony's first ${COLONY_DAYS} days: its farms feed the crew within ${FED_WITHIN} days of the landing in ${soon} of ${played.length}, from day ${median(fed.map((days) => days.fedOn))}; ` +
    `farms ${median(played.map((days) => days.farms))}, mines ${median(played.map((days) => days.mines))}; hungry days ${median(played.map((days) => days.hungry))}, in ${played.filter((days) => days.hungry > 0).length} runs; ` +
    `at the end, food ${median(played.map((days) => days.food[1]))} and materials ${median(played.map((days) => days.materials[1]))}, stores ${median(played.map((days) => days.stores))}.`
  );
}

// The colonies' days of trips (M28): how many trips, days away, what they
// brought, the boardings, what was built for whoever stayed home, and the
// refits.
function tripsSummary(done) {
  const played = done.map((r) => r.tally.trips).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const sum = (key) => played.reduce((total, trips) => total + trips[key], 0);
  const built = {};
  for (const trips of played) for (const b of trips.built) built[b.name] = (built[b.name] ?? 0) + 1;
  return (
    `The colony's ${TRIP_DAYS} days of trips: trips ${median(played.map((trips) => trips.flown.length))}, flown in ${played.filter((trips) => trips.flown.length > 0).length} of ${played.length}; days away ${median(played.map((trips) => trips.away))}; ` +
    `brought parts ${median(played.map((trips) => trips.parts))}, materials ${median(played.map((trips) => trips.materials))}, food ${median(played.map((trips) => trips.food))}; ` +
    `boardings won ${sum('won')}, lost ${sum('lost')}; traps ${sum('traps')}; built ${Object.entries(built).map(([name, n]) => `${name} ${n}`).join(', ') || 'nothing'}; refitted aboard in ${played.filter((trips) => trips.moved.length > 0).length}; hungry days ${median(played.map((trips) => trips.hungry))}.`
  );
}

// The voyages out from the colonies (M38d): how many flew and came home,
// who went, the systems crossed and the days away; the jumps, the hostile
// ships, the hunters and the boardings; the work, spending and parts on the
// way; and the colony while the ship was away: found, raids faced and lost,
// fed or not, and what the split lost.
export function outSummary(done) {
  const flown = done.map((r) => r.out).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const of = (get) => median(flown.map(get));
  const runs = (test) => flown.filter(test).length;
  const sum = (get) => flown.reduce((total, out) => total + get(out), 0);
  const faced = flown.flatMap((out) => out.raids.faced.filter((raid) => raid.away));
  const lost = faced.filter((raid) => !raid.won);
  // The raids met at home once the ship was back (M38d's fix).
  const met = flown.flatMap((out) => out.raids.faced.slice(out.prior).filter((raid) => !raid.away));
  const defences = (out, won) => out.steps.filter((step) => step.kind === 'boarding' && step.dir === 'you' && (won === undefined || step.won === won)).length;
  return (
    `The voyage out (M38d): flown in ${flown.length} of ${done.length}, home in ${runs((out) => out.back)}; ${of((out) => out.crew.length)} aboard, ${of((out) => out.home.length)} at home; ` +
    `systems crossed ${of((out) => out.tally.crossed)}, all ${VOYAGE_SYSTEMS} in ${runs((out) => out.tally.crossed >= VOYAGE_SYSTEMS)}; days away ${of((out) => out.colony.days)}. ` +
    `Jumps ${of((out) => out.tally.jumps)}, hungry ${of((out) => out.tally.hungryJumps)} (in ${runs((out) => out.tally.hungryJumps > 0)} runs), flying home hungry in ${runs((out) => out.back?.hungry > 0)}; ` +
    `hostile ships ${of((out) => out.tally.approaches)}, boarding us ${sum((out) => out.tally.approachesLost)} times, fought off ${sum((out) => defences(out, true))} of ${sum((out) => defences(out))}; the hunters met in ${runs((out) => out.tally.hunts > 0)} (${sum((out) => out.tally.hunts)} times); heat at the end ${of((out) => out.tally.heat[1])}, at most ${of((out) => out.tally.peak)}. ` +
    `Station jobs ${of((out) => out.tally.stationJobs)}, in ${runs((out) => out.tally.stationJobs > 0)} runs, ${sum((out) => out.tally.stationJobsWon)} of ${sum((out) => out.tally.stationJobs)} done, paying ${of((out) => out.tally.jobCredits)}; ` +
    `credits spent ${of((out) => spentOf(out.tally))}; parts bought ${of((out) => out.tally.yardBought)}, in ${runs((out) => out.tally.yardBought > 0)} runs; fitted ${of((out) => out.tally.fitted)}; signed on ${sum((out) => out.tally.hired)}; credits ${of((out) => out.credits[0])} out, ${of((out) => out.credits[1])} home. ` +
    `At home: found in ${runs((out) => out.colony.found > 0)} runs, calling the ship home in ${runs((out) => out.back?.called)}; raids faced while away ${faced.length}, lost ${lost.length} (in ${runs((out) => out.raids.faced.some((raid) => raid.away && !raid.won))} runs), ${faced.filter((raid) => !raid.home).length} with nobody home; met at home once back ${met.length}, won ${met.filter((raid) => raid.won).length}; fed all the while in ${runs((out) => out.colony.hungry === 0)} of ${flown.length}; the mines' digging past the storehouses lost in ${runs((out) => out.colony.dugLost > 0)} runs (${sum((out) => out.colony.dugLost)} in all). ` +
    `Before flying out, ${of((out) => out.stocked)} days stocking the holds, full in ${runs((out) => out.full)} runs; flying out, food spoiled in ${runs((out) => out.flown.plan.food.spoils > 0)} runs (${sum((out) => out.flown.plan.food.spoils)} in all).`
  );
}

// The second colonies (M38e): how many voyages out founded one, the days
// played there, who stayed, the flights back and their days; the raids
// found, faced and lost at each colony; and every colony fed.
export function secondSummary(done) {
  const flown = done.map((r) => r.out).filter(Boolean);
  const founded = flown.filter((out) => out.second);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const of = (list, get) => median(list.map(get));
  const sum = (list, get) => list.reduce((total, out) => total + get(out), 0);
  const at = (id) => flown.flatMap((out) => out.raids.faced.slice(out.prior).filter((raid) => (raid.at ?? 1) === id));
  const raids = (id, key) => `found ${sum(flown, (out) => out.colony.at[key])}, faced ${at(id).length}, lost ${at(id).filter((raid) => !raid.won).length}`;
  const back = founded.filter((out) => out.second.back);
  return (
    `More colonies (M38e): founded on ${founded.length} of ${flown.length} voyages out, in system ${SETTLE_SYSTEM}; days there ${of(founded, (out) => out.second.days)}, cut short by a raid at the first in ${founded.filter((out) => out.second.called).length}; one left there in ${founded.filter((out) => out.second.left.length).length}. ` +
    `Flown back in ${back.length}: ${of(back, (out) => out.second.back.days)} days, stopped by a lander in ${back.filter((out) => out.second.back.stops).length}, hungry in ${back.filter((out) => out.second.back.hungry > 0).length}. ` +
    `The first colony's days away ${of(flown, (out) => out.colony.days)}. Raids since flying out: at the first ${raids(1, 'first')}; at the second ${raids(2, 'second')}. Every colony fed all the while in ${flown.filter((out) => out.colony.hungry === 0).length} of ${flown.length}.`
  );
}

// The citizens (M38f): back from the voyage out and AFTER_DAYS more days at
// the first colony, how many at each colony; since flying out, those grown,
// gone short of food, fallen in raids and rescued; the raids fought out
// without the ship; and the hungry days of the days after.
export function citizensSummary(done) {
  const after = done.map((r) => r.out?.after).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const at = (id) => after.map((a) => a.citizens.find(([colony]) => colony === id)?.[1]).filter((n) => n !== undefined);
  const sum = (key) => after.reduce((total, a) => total + a[key], 0);
  const where = (id, name) => {
    const counts = at(id);
    return `at the ${name} ${median(counts)}, in ${counts.filter((n) => n > 0).length} of ${counts.length}`;
  };
  return (
    `Citizens (M38f): back from the voyage out and ${AFTER_DAYS} days more at the first colony, ${where(1, 'first')}; ${where(2, 'second')}. ` +
    `Since flying out ${sum('grown')} came, ${sum('left')} left short of food, ${sum('fell')} fell in raids, ${sum('settled')} newcomer${sum('settled') === 1 ? '' : 's'} settled (freed captives and survivors). ` +
    `Raids fought out without the ship ${sum('foughtOut')}: won ${sum('won')}, lost ${sum('lost')}. Hungry days in the ${AFTER_DAYS}: ${sum('hungry')}, in ${after.filter((a) => a.hungry > 0).length} runs.`
  );
}

// The raids over the colonies' days (M29): how often found, by the lanes,
// faced, won and lost, what the guns stopped, the raids that came while the
// ship was away, what lost raids took, and what was set down for them.
function raidsSummary(defs, done) {
  const played = done.map((r) => r.tally.raids).filter(Boolean);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? `${sorted[Math.floor((sorted.length - 1) / 2)]} (${sorted[0]} to ${sorted.at(-1)})` : '-';
  };
  const faced = played.flatMap((raids) => raids.faced);
  const lost = faced.filter((raid) => !raid.won);
  const byLanes = [1, 2, 3].map((lanes) => {
    const here = played.filter((raids) => raids.lanes === lanes);
    const found = here.reduce((sum, raids) => sum + raids.found, 0);
    return `${['near', 'off', 'far'][lanes - 1]} ${found} in ${here.length} run${here.length === 1 ? '' : 's'}`;
  });
  const set = {};
  for (const raids of played) for (const b of raids.set) set[b.name] = (set[b.name] ?? 0) + 1;
  const sum = (list, key) => list.reduce((total, raid) => total + (raid.taken?.[key] ?? 0), 0);
  return (
    `Raids over the colony's ${COLONY_DAYS + TRIP_DAYS} days: found ${median(played.map((raids) => raids.found))} a run, in ${played.filter((raids) => raids.found > 0).length} of ${played.length} (by the lanes: ${byLanes.join(', ')}); ` +
    `faced ${faced.length}: won ${faced.length - lost.length}, lost ${lost.length}; the guns stopped ${faced.reduce((sum, raid) => sum + raid.stopped, 0)} of ${faced.reduce((sum, raid) => sum + raid.stopped + raid.landed, 0)} raiders; ` +
    `${faced.filter((raid) => raid.away).length} while the ship was away (${faced.filter((raid) => !raid.home).length} with nobody home); ` +
    `lost raids took ${sum(lost, 'food')} food, ${sum(lost, 'materials')} materials and ${lost.filter((raid) => raid.taken?.part).length} parts; heat at the end ${median(played.map((raids) => raids.heat[1]))}; ` +
    `set down ${Object.entries(set).map(([name, n]) => `${name} ${n}`).join(', ') || 'nothing'}.`
  );
}

// The parts the runs fitted, by name, most first: "Cargo hold 12, ...".
function fitsLine(defs, done) {
  const all = {};
  for (const r of done) for (const [type, n] of Object.entries(r.tally.fits)) all[type] = (all[type] ?? 0) + n;
  const named = Object.entries(all).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([type, n]) => `${defs.modules.get(type)?.name ?? type} ${n}`);
  return named.length ? named.join(', ') : 'none';
}

function hpOf(campaign) {
  return campaign.crew.map((member) => member.hp).join('/');
}

// "Ice world", a world's kind by name.
function kindName(defs, world) {
  return defs.worlds.kinds.get(world.kind)?.name ?? world.kind;
}

// "soil 0, water 2, ore 1, danger 0, lanes 1"
function numbersText(world) {
  return ['soil', 'water', 'ore', 'danger', 'lanes'].map((rating) => `${rating} ${world[rating]}`).join(', ');
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function signed(n) {
  return n < 0 ? `−${-n}` : `+${n}`;
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
  const fit = value('--fit', '');
  const options = { long: value('--long', 'heat'), scans: value('--scan', 'yes'), refit: value('--refit', 'yes'), heat: value('--heat', 'manage'), jobs: value('--jobs', 'yes'), out: value('--out', 'yes'), settle: value('--settle', 'yes'), fit: fit ? fit.split(',') : [], frame: value('--frame', null), background: value('--background', undefined), difficulty: value('--difficulty', 'normal'), permadeath: value('--permadeath', 'off') === 'on', fights: args.includes('--difficulty') };
  const runs = Number(value('--runs', 0));
  if (options.background === 'all') console.log(voyagesByBackground(made.rules, runs || 30, { ...options, background: undefined }).lines.join('\n'));
  else console.log((runs ? manyVoyages(made.rules, runs, options) : voyage(made.rules, Number(value('--seed', 1)), options)).lines.join('\n'));
}
