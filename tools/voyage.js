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
//     beyond a holdful's price;
//   - fight a boarding with the healthiest squadSize of the crew (crew.js);
//   - with --scan yes (the default), scan wherever a scan would show a
//     node ahead; with --scan no, never;
//   - from each node, plan every way on to the jump point, a link at a
//     time, and jump to the next node on the way that goes hungry least,
//     then is worth most: the supplies and credits carried out, and the
//     nodes passed;
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
//
//   node tools/voyage.js               a voyage from campaign seed 1, step by step
//   node tools/voyage.js --seed 7      another seed
//   node tools/voyage.js --runs 20     seeds 1 to 20, summed up
//   node tools/voyage.js --long never  no long jumps
//   node tools/voyage.js --scan no     no scans
//   node tools/voyage.js --fit medbay  a part fitted before the voyage (or a
//                                      list, like --fit cargo,medbay)
//   node tools/voyage.js --refit no    no refits at stations
//   node tools/voyage.js --heat ignore no swaps, hides or long jumps
//   node tools/voyage.js --runs 20 --set supplyPrice=2
//                                      a balance number changed for this run
//                                      only (as many --set as you like)
import { pathToFileURL } from 'node:url';
import { maxHp, shipChecklist } from '../src/sim/campaign.js';
import { buildingOf, colonyStats, donate, storesOf } from '../src/sim/colony.js';
import { build } from '../src/sim/colonyBuild.js';
import { crewRoom } from '../src/sim/crew.js';
import { nextDay } from '../src/sim/days.js';
import { chooseAtPlace, flyHome, flyOn, flyOut, tripHere, withPlaces } from '../src/sim/expeditions.js';
import { flightChecklist } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { FACED } from '../src/sim/approach.js';
import { approachState, closeApproach, giveOrder } from '../src/sim/encounter.js';
import { chooseEvent, partsOnHand } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { patchCrew } from '../src/sim/patch.js';
import { raidLoss } from '../src/sim/raid.js';
import { landingPlan, raidDown } from '../src/sim/raids.js';
import { huntersOf } from '../src/sim/hunt.js';
import { hireRecruit } from '../src/sim/recruits.js';
import { regroup } from '../src/sim/regroup.js';
import { repairShip } from '../src/sim/repair.js';
import { settle } from '../src/sim/settle.js';
import { survey } from '../src/sim/survey.js';
import { swapTransponder } from '../src/sim/transponder.js';
import { beginRun, buySupplies, failingCheck, hereOf, jump, jumpSupplies, leaveSector, openEvent, scan, scanPlan, supplyCapacity, supplyOffer } from '../src/sim/travel.js';
import { runRecord } from '../src/ui/campaign/launchText.js';
import { captainOrder } from './approachPlan.js';
import { fightBoarding, fightPlace, fightRaid } from './boarding.js';
import { readData } from './data.js';
import { runToLaunch } from './run.js';
import { rulesWith, setting } from './sim.js';
import { withPart } from './startShip.js';
import { bestChoice, boardIt, HEAT_POLICIES, hireWho, homeBuild, LONG_FROM, nextBuild, nextGift, nextJump, nextPlace, placeChoice, raidPrep, refitAt, refitForSquad, restNow, scanNow, swapNow, systemMove, tripSquad, worldScore } from './voyagePlan.js';

export const LONG_POLICIES = ['heat', 'never'];
export const SCAN_POLICIES = ['yes', 'no'];
export const REFIT_POLICIES = ['yes', 'no'];
const MAX_JUMPS = 100; // a voyage still going after this many stops
// The colony's days the test player plays, and the days from the landing
// within which its farms are to feed the crew (M27's Done when).
export const COLONY_DAYS = 30;
export const FED_WITHIN = 15;
// The days of trips it plays after those (M28's Done when).
export const TRIP_DAYS = 30;

// A voyage from a launched campaign (act 2, the run not yet begun) to a
// world settled, its colony founded and its first days played: { ended,
// steps, sectors, system, tally, lines, campaign, landed, home, travelled }.
// ended: whether it settled a world, ending the act; steps: every jump,
// purchase, event, approach, boarding, patch, repair, scan and survey, with
// what it moved, [before, after], and the settling; sectors: each sector as
// the ship entered it; system: the system past the charts, as it entered
// it, or null; campaign: as it ended, the colony founded; landed: the
// campaign as it settled, before the colony was founded, or null; home:
// the colony after its first COLONY_DAYS days (M27), or null; travelled:
// after TRIP_DAYS more of trips (M28), or null.
export function voyageFrom(defs, launched, { long: longPolicy = 'heat', scans = 'yes', refit = 'yes', heat = 'manage', label = '' } = {}) {
  if (!LONG_POLICIES.includes(longPolicy)) throw new Error(`--long is one of ${LONG_POLICIES.join(', ')}`);
  if (!HEAT_POLICIES.includes(heat)) throw new Error(`--heat is one of ${HEAT_POLICIES.join(', ')}`);
  // Ignoring heat makes no long jumps either.
  const long = heat === 'ignore' ? 'never' : longPolicy;
  if (!SCAN_POLICIES.includes(scans)) throw new Error(`--scan is one of ${SCAN_POLICIES.join(', ')}`);
  if (!REFIT_POLICIES.includes(refit)) throw new Error(`--refit is one of ${REFIT_POLICIES.join(', ')}`);
  const begun = beginRun(launched, defs);
  if (!begun.ok) throw new Error(begun.error);
  let campaign = begun.campaign;
  const steps = [];
  const sectors = [campaign.run.sector];
  const tally = {
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
    peak: launched.heat,
    heat: [launched.heat, null],
    hp: [hpOf(campaign), null],
  };
  const hold = () => `${campaign.supplies} supplies, ${campaign.credits} credits, heat ${campaign.heat}`;
  // The parts a refit couldn't fit, and the ship then (voyagePlan.js refitAt).
  const tried = new Map();
  const lines = [
    `${label}Launched with ${campaign.credits} credits, heat ${campaign.heat}, a crew of ${campaign.crew.length} (${hpOf(campaign)}) and ${campaign.supplies} supplies, the holds full. A jump eats ${jumpSupplies(campaign, defs)}.`,
  ];
  const sectorLine = () => {
    const { sector } = campaign.run;
    if (sector.system) {
      const worlds = sector.nodes.filter((node) => node.world).map((node) => `${node.name} (${kindName(defs, node.world)})`);
      lines.push(`The system past the charts: ${sector.name}, ${worlds.length} worlds: ${worlds.join(', ')}.`);
      return;
    }
    lines.push(`Sector ${sector.index}: ${sector.name}, ${sector.nodes.length} nodes, ${sector.nodes.filter((node) => node.type === 'station').length} station(s).`);
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
  const jumped = (before, moved) => {
    if (!moved.ok) throw new Error(moved.error);
    campaign = moved.campaign;
    const { plan } = moved;
    const out = plan.kind === 'sector' || plan.kind === 'system';
    record(plan.kind, before, { hungry: plan.hungry, heal: plan.heal, max: before.crew.map((member) => maxHp(member, defs)), to: out ? null : campaign.run.at, hunt: moved.hunt });
    tally.jumps += 1;
    if (moved.hunt.chance > 0) tally.hotJumps += 1;
    tally.peak = Math.max(tally.peak, campaign.heat);
    if (plan.kind === 'long') tally.longJumps += 1;
    if (plan.hungry) tally.hungryJumps += 1;
    if (plan.hungry && before.run.sector.system) tally.systemHungry += 1;
    // A sector is crossed when the ship reaches its jump point.
    if (campaign.run.at === campaign.run.sector.exit) tally.crossed += 1;
    const hungry = plan.hungry ? `, hungry (${hpOf(campaign)})` : '';
    if (out) {
      if (plan.kind === 'sector') sectors.push(campaign.run.sector);
      else system = campaign.run.sector;
      lines.push(`   Jumped on ${plan.kind === 'sector' ? 'out of the sector' : 'past the charts'}${hungry}: ${hold()}.`);
      sectorLine();
    } else {
      const node = hereOf(campaign);
      lines.push(`   ${plan.kind === 'long' ? 'Long jump' : 'Jump'} to ${node.name}${node.type === 'station' ? ' (a station)' : ''}${hungry}: ${hold()}.`);
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
      const { outcome, round } = campaign.run.approach;
      const { changes } = outcome;
      record('approach', before, { ship: enemy.ship, hunt, outcome: outcome.kind, how: outcome.how ?? null, rounds: round, changes, boarding: outcome.boarding, wrecks: Object.keys(campaign.wrecks).length });
      tally.approaches += 1;
      if (hunt) {
        tally.hunts += 1;
        if (FACED.includes(outcome.kind)) tally.huntsFaced += 1;
        if (enemy.ship === huntersOf(campaign, defs)?.taskForce) tally.taskForces += 1;
      }
      if (outcome.kind === 'boarded' || outcome.kind === 'destroyed') tally.approachesWon += 1;
      if (outcome.kind === 'boardedBy') tally.approachesLost += 1;
      tally.approachCredits += changes.credits;
      lines.push(`   ${hunt ? 'The hunters, in a ' : ''}${enemy.name}: ${outcome.kind}${outcome.how ? ` (${outcome.how})` : ''} in round ${round}, ${Object.keys(campaign.wrecks).length} wrecked aboard. ${hold()}.`);
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
      const said = pick.choice.outcomes[result.outcome].text;
      lines.push(`   ${open.event.title}: ${pick.choice.label}${result.roll === null ? '' : ` (rolled ${result.roll})`}. ${said} ${hold()}.`);
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
        record('survey', before, { world: here.name, hunt: done.hunt });
        tally.surveys += 1;
        tally.peak = Math.max(tally.peak, campaign.heat);
        lines.push(`   Surveyed ${here.name} (${kindName(defs, here.world)}): ${numbersText(here.world)}; scores ${worldScore(defs, here.world, true)}. ${hold()}${done.hunt.found ? '. The hunters found the ship' : ''}.`);
        continue;
      }
      if (move.kind === 'settle') {
        const done = settle(campaign, defs);
        if (!done.ok) throw new Error(done.error);
        campaign = done.campaign;
        const { world } = campaign.colony;
        const best = Math.max(...before.run.sector.nodes.filter((node) => node.world).map((node) => worldScore(defs, node.world, true)));
        record('settle', before, { world: world.name });
        tally.settled = { name: world.name, kind: world.kind, surveyed: world.surveyed, score: worldScore(defs, world, world.surveyed), best, record: runRecord(campaign, defs) };
        lines.push(`   Settled ${world.name} (${kindName(defs, world)}, ${world.surveyed ? `surveyed, scoring ${worldScore(defs, world, true)}` : `not surveyed, its kind scoring ${worldScore(defs, world, false)}`}; the system's best scores ${best}): act 2 ends.`);
        landed = campaign;
        const founded = foundColony(campaign, defs);
        campaign = founded.campaign;
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
        };
        lines.push(`   ${raidsLine(defs, tally.raids)}`);
        break;
      }
      jumped(before, jump(campaign, defs, move.to));
      continue;
    }
    // A refit at a station, before the holds are filled: a hold fitted
    // takes more.
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
    // A recruit signed on, where there is room and the fee to spare.
    const slot = offer.ok ? hireWho(campaign, defs) : null;
    if (slot !== null) {
      const before = campaign;
      const signed = hireRecruit(campaign, defs, slot);
      if (!signed.ok) throw new Error(signed.error);
      campaign = signed.campaign;
      const member = campaign.crew.at(-1);
      record('hire', before, { name: member.name, job: member.job, traits: member.traits });
      tally.hired += 1;
      tally.hireCredits += signed.plan.fee;
      lines.push(`   Signed on ${member.name} (${defs.jobs.get(member.job)?.name ?? member.job}) for ${signed.plan.fee} credits: a crew of ${campaign.crew.length}, ${hold()}.`);
    }
    // Managing heat: the transponder swapped, once a recruit has signed
    // on, and before patching and repairs.
    if (swapNow(campaign, defs, heat)) {
      const before = campaign;
      campaign = swapTransponder(campaign, defs).campaign;
      record('swap', before);
      tally.swaps += 1;
      tally.swapCredits += before.credits - campaign.credits;
      lines.push(`   Swapped the transponder for ${before.credits - campaign.credits} credits: ${hold()}.`);
    }
    // Patching up, then repairs, with what is left beyond a holdful's price.
    const reserve = supplyCapacity(campaign.ship, defs) * defs.balance.supplyPrice;
    const patched = offer.ok && campaign.credits > reserve ? patchCrew({ ...campaign, credits: campaign.credits - reserve }, defs) : { ok: false };
    if (patched.ok) {
      const before = campaign;
      campaign = { ...patched.campaign, credits: patched.campaign.credits + reserve };
      record('patch', before, { patched: patched.plan.hp });
      tally.patchedHp += patched.plan.hp;
      tally.patchCredits += patched.plan.cost;
      lines.push(`   Patched up ${patched.plan.hp} hit points for ${patched.plan.cost} credits: crew ${hpOf(campaign)}, ${hold()}.`);
    }
    const fixed = offer.ok && campaign.credits > reserve ? repairShip({ ...campaign, credits: campaign.credits - reserve }, defs) : { ok: false };
    if (fixed.ok) {
      const before = campaign;
      campaign = { ...fixed.campaign, credits: fixed.campaign.credits + reserve };
      record('repair', before, { repaired: fixed.plan.repairs.length });
      tally.repairs += fixed.plan.repairs.length;
      tally.repairCredits += fixed.plan.cost;
      lines.push(`   Repaired ${fixed.plan.repairs.map((repair) => repair.type).join(', ')} for ${fixed.plan.cost} credits: ${hold()}.`);
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
  tally.heat[1] = campaign.heat;
  tally.hp[1] = hpOf(campaign);
  tally.healed = campaign.flags.hpHealed ?? 0;
  const ended = tally.settled !== null;
  const { sector } = campaign.run;
  const where = ended ? `Settled ${tally.settled.name} in ${sector.name}` : sector.system ? `Stopped in ${sector.name}, past the charts` : `Stopped in sector ${sector.index}`;
  lines.push(
    `${where}, ${tally.crossed} sectors crossed, ${tally.surveys} world${tally.surveys === 1 ? '' : 's'} surveyed: ${tally.jumps} jumps (${tally.longJumps} long, ${tally.hungryJumps} hungry), ${tally.bought} supplies bought at ${tally.stations} stations for ${tally.spent} credits. ${tally.events} events: ${signed(tally.eventCredits)} credits, ${signed(tally.eventSupplies)} supplies, ${tally.found} parts found, ${tally.sold} sold, ${tally.wounds} hit points lost; ${tally.scans} scans. ${tally.approaches} hostile ships: ${tally.approachesWon} won, ${tally.approachesLost} lost, ${signed(tally.approachCredits)} credits; boarded ${tally.boardings} (won ${tally.boardingsWon}), left ${tally.left}, fought off ${tally.defencesWon} of ${tally.defences}; salvage ${tally.salvaged} parts and ${tally.salvageCredits} credits, lost ${tally.partsLost} parts and ${tally.creditsLost} credits, ${tally.fightHp} hit points; patched ${tally.patchedHp} for ${tally.patchCredits} credits; ${tally.repairs} repairs for ${tally.repairCredits} credits; signed on ${tally.hired}, healed ${tally.healed} in the med bay; refitted ${tally.fitted} parts at ${tally.refits} stations. The hunters: met ${tally.hunts} (${tally.taskForces} the task force), faced ${tally.huntsFaced}; ${tally.hotJumps} jumps where they might wait; ${tally.regroups} regroups and ${tally.hides} days hidden, healing ${tally.rested}; ${tally.swaps} transponder swaps for ${tally.swapCredits} credits. Heat ${tally.heat[0]} to ${tally.heat[1]}, at most ${tally.peak}; crew ${tally.hp[0]} to ${tally.hp[1]}.`,
  );
  if (ended) lines.push(`The act's record: ${tally.settled.record.map(([label, value]) => `${label} ${value}`).join('; ')}.`);
  return { ended, steps, sectors, system, tally, lines, campaign, landed, home, travelled };
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

// The colony's first days as the careful player plays them (M27): before
// each day it builds what voyagePlan.js's nextBuild says, as long as it
// says to, then passes the day. From M29, while a raid is coming it sets
// down from the hold what raidPrep says, and a raid that is down it faces
// before the day (faceRaid below). { campaign, days: { built ([{ day,
// type, name }], in order), fedOn (the first day its farms fed the crew,
// what they grow a day covering what the crew eats, or null), hungry
// (hungry days), farms, mines, food and materials ([at the landing, at the
// end]), stores (at the end), healed, hurt }, raids ({ faced, set }:
// raidsLog's) }.
export function playColony(campaign, defs, days = COLONY_DAYS) {
  const built = [];
  const raids = raidsLog();
  const start = { food: campaign.supplies, materials: campaign.colony.materials };
  let fedOn = null;
  let healed = 0;
  let hurt = 0;
  for (let n = 0; n < days; n++) {
    for (let what = nextBuild(campaign, defs); what; what = nextBuild(campaign, defs)) {
      const done = build(campaign, defs, what);
      if (!done.ok) throw new Error(done.error);
      built.push({ day: campaign.colony.day, type: done.plan.type, name: done.plan.name });
      campaign = done.campaign;
    }
    campaign = readyForRaid(campaign, defs, raids);
    if (fedOn === null && colonyStats(campaign, defs).made.food >= campaign.crew.length * defs.balance.jumpSupplies) fedOn = campaign.colony.day;
    const day = nextDay(campaign, defs);
    if (!day.ok) throw new Error(day.error);
    campaign = day.campaign;
    healed += day.healed;
    hurt += day.hurt;
  }
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
    },
    raids,
  };
}

// What the raids came to, as the test player keeps it (M29): faced ([{
// day, landed (the raiders that landed), stopped (those the guns
// stopped), home (who was home to fight), away (true with the ship away),
// fought, won, taken (what a lost raid took, raids.js raidTake, or null)
// }]) and set ([{ day, type, name }]: the defenses it set down from the
// hold for them).
function raidsLog() {
  return { faced: [], set: [] };
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

// The raid that is down, faced: the guns fire at the lander, and those at
// home fight whoever lands, played by the AI (tools/boarding.js
// fightRaid). Its record goes on raids.faced. Returns the campaign.
function faceRaid(campaign, defs, raids) {
  const plan = landingPlan(campaign, defs);
  if (!plan.ok) throw new Error(plan.error);
  const day = campaign.colony.day;
  const done = fightRaid(campaign, defs);
  raids.faced.push({
    day,
    landed: done.landing.landed.length,
    stopped: plan.raiders.length - done.landing.landed.length,
    home: plan.defenders.length,
    away: Boolean(campaign.colony.trip),
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
// aboard), hungry (hungry days in these days), healed, hurt } }.
export function playTrips(campaign, defs, days = TRIP_DAYS) {
  const until = campaign.colony.day + days;
  const start = { flags: campaign.flags };
  const flown = [];
  const built = [];
  const moved = [];
  const raids = raidsLog();
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
        const trip = flyTrip(campaign, defs, index, squad, raids);
        campaign = trip.campaign;
        flown.push(trip.record);
        continue;
      }
    }
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
      left: flown.filter((trip) => trip.what === 'left her').length,
      built,
      moved,
      hungry: since('hungryDays'),
      healed: since('colonyHealed'),
      hurt: since('hungerHurt'),
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
  if (here.event) {
    const pick = placeChoice(now, defs, here.event);
    const chose = chooseAtPlace(now, defs, pick.choice.id);
    if (!chose.ok) throw new Error(chose.error);
    now = chose.campaign;
    what = `${here.event.title}: ${pick.choice.label}`;
  } else if (here.held) {
    const fought = fightPlace(now, defs);
    now = fought.campaign;
    what = fought.won ? 'boarded her and won' : 'boarded her and lost';
  }
  if (raidDown(now)) now = faceRaid(now, defs, raids);
  const home = flyHome(now, defs);
  if (!home.ok) throw new Error(home.error);
  return { campaign: onWay(home.campaign, defs, raids), record: { day, name: place.name, kind: place.kind, days: place.days, squad: squad.length, what } };
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

// What the trips came to, as a line of its report: "30 days of trips: 4
// trips, 14 days away: The Anvil (day 31, 2 days, 3 aboard: Rich seam: Dig
// deep), ...; brought 2 parts, 23 materials and 10 food; boardings won 1,
// lost 0; built Shelter (day 40); refitted Life support aboard; 0 hungry
// days."
function tripsLine(defs, trips) {
  const each = trips.flown.map((trip) => `${trip.name} (day ${trip.day}, ${trip.days * 2} days, ${trip.squad} aboard: ${trip.what})`).join('; ');
  const builds = trips.built.map((b) => `${b.name} (day ${b.day})`).join(', ');
  return (
    `${TRIP_DAYS} days of trips: ${trips.flown.length} trip${trips.flown.length === 1 ? '' : 's'}, ${trips.away} days away${each ? `: ${each}` : ''}. ` +
    `Brought ${trips.parts} part${trips.parts === 1 ? '' : 's'}, ${trips.materials} materials and ${trips.food} food; boardings won ${trips.won}, lost ${trips.lost}, left ${trips.left}; ` +
    `built ${builds || 'nothing'}; refitted ${trips.moved.length ? trips.moved.map((type) => defs.modules.get(type)?.name ?? type).join(', ') : 'nothing'} aboard; ${trips.hungry} hungry day${trips.hungry === 1 ? '' : 's'}.`
  );
}

// What the raids came to over the colony's days (M29), as a line of its
// report: "Raids over 60 days (off the lanes; heat 52 to 31): found 2,
// faced 2. Day 14: the guns stopped 1 of 4, 3 at home, won. Day 41, the
// ship away: the guns stopped 0 of 4, 2 at home, lost: they took 12 food,
// 15 materials and a Shield generator. Set down Gun emplacement (day 13)."
function raidsLine(defs, raids) {
  const lanes = ['near the lanes', 'off the lanes', 'far from the lanes'][raids.lanes - 1];
  const each = raids.faced.map((raid) => {
    const fight = !raid.home ? 'nobody home' : raid.fought ? `${raid.home} at home` : 'no fight';
    const outcome = raid.won ? 'won' : `lost: they took ${tookText(defs, raid.taken)}`;
    return `Day ${raid.day}${raid.away ? ', the ship away' : ''}: the guns stopped ${raid.stopped} of ${raid.stopped + raid.landed}, ${fight}, ${outcome}.`;
  });
  const set = raids.set.map((b) => `${b.name} (day ${b.day})`).join(', ');
  return [
    `Raids over ${COLONY_DAYS + TRIP_DAYS} days (${lanes}; heat ${raids.heat[0]} to ${raids.heat[1]}): found ${raids.found}, faced ${raids.faced.length}.`,
    ...each,
    ...(set ? [`Set down ${set}.`] : []),
    ...(raids.coming ? ['A raid still coming at the end.'] : []),
  ].join(' ');
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

// Act 1's test run from campaign seed `seed`, and the launch: { ok: true,
// campaign (launched), jobs } or { ok: false, line }. The slow half of a
// voyage, so callers flying a seed more than once can keep it.
export function launchedAt(defs, seed) {
  const act1 = runToLaunch(defs, seed);
  const lifted = act1.launched ? launch(act1.campaign, defs) : null;
  if (!lifted?.ok) return { ok: false, line: `Campaign seed ${seed}: ${lifted?.error ?? act1.lines.at(-1)}` };
  return { ok: true, campaign: lifted.campaign, jobs: act1.jobs };
}

// A voyage from campaign seed `seed`: act 1's test run to launch (or
// `lifted`, launchedAt's for the seed), then the voyage, with the parts in
// fit (module types) fitted to the ship first. { launched, ...voyageFrom },
// or { launched: false, lines } if the test run stopped short.
export function voyage(defs, seed, options = {}, lifted = launchedAt(defs, seed)) {
  const { fit = [], ...rest } = options;
  if (!lifted.ok) return { launched: false, lines: [lifted.line] };
  const ship = fit.reduce((fitted, type) => withPart(fitted, defs, type), lifted.campaign.ship);
  // A ship that fails a flight check can't leave a station (M23h), so what
  // is fitted has to keep every check passing.
  const broken = flightChecklist(ship, defs, lifted.campaign.crew.length).find((line) => line.ok !== true);
  if (broken) throw new Error(`Fitted with ${fit.join(' and ')}, the ship fails a flight check: ${broken.text}.`);
  return { launched: true, ...voyageFrom(defs, { ...lifted.campaign, ship }, { ...rest, label: `Campaign seed ${seed}, after ${lifted.jobs} jobs. ` }) };
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
  const ignoring = options.heat === 'ignore';
  const policy = ignoring || options.long === 'never' ? 'never' : `when heat is at ${LONG_FROM} or over`;
  const met = done.filter((r) => r.tally.hunts > 0).length;
  const lines = [
    `${runs} voyages from launch, campaign seeds 1 to ${runs}, ${ignoring ? 'ignoring heat' : 'managing heat'}, long jumps ${policy}, ${options.scans === 'no' ? 'no scans' : 'scanning'}, ${options.refit === 'no' ? 'no refits' : 'refitting at stations'}${options.fit?.length ? `, fitted with ${options.fit.join(' and ')}` : ''}. The median, then the least and most:`,
    `Sectors crossed: ${spread(of('crossed'))}; ${done.filter((r) => r.system).length} of ${done.length} entered the system past the charts, ${done.filter((r) => r.ended).length} settled a world; fed all the way in ${done.filter((r) => r.tally.hungryJumps === 0).length} of ${done.length}.`,
    systemLine(defs, done),
    colonySummary(defs, done),
    daysSummary(done),
    tripsSummary(done),
    raidsSummary(defs, done),
    `Jumps: ${spread(of('jumps'))}, long ${spread(of('longJumps'))}, hungry ${spread(of('hungryJumps'))}.`,
    `At the nodes: ${spread(of('events'))} events, ${spread(of('eventCredits'))} credits and ${spread(of('eventSupplies'))} supplies from them, ${spread(of('found'))} parts found, ${spread(of('sold'))} sold, ${spread(of('wounds'))} hit points lost; ${spread(of('scans'))} scans.`,
    `Hostile ships: ${spread(of('approaches'))} met, ${spread(of('approachesWon'))} disabled or blown up, ${spread(of('approachesLost'))} boarding us. Boarded her ${spread(of('boardings'))} times (won ${spread(of('boardingsWon'))}), left her ${spread(of('left'))}; fought off ${spread(of('defencesWon'))} of ${spread(of('defences'))} boardings. Salvage: ${spread(of('salvaged'))} parts and ${spread(of('salvageCredits'))} credits. Lost: ${spread(of('partsLost'))} parts and ${spread(of('creditsLost'))} credits; ${spread(of('fightHp'))} hit points in the fights. Lost a boarding at home: ${done.filter((r) => r.steps.some((step) => step.kind === 'boarding' && step.dir === 'you' && !step.won)).length} of ${done.length}; dragged past 40 rounds: ${done.reduce((sum, r) => sum + r.tally.dragged, 0)}.`,
    `At stations: patched ${spread(of('patchedHp'))} hit points for ${spread(of('patchCredits'))} credits; ${spread(of('repairs'))} repairs for ${spread(of('repairCredits'))} credits. Crew at the end: ${spread(done.map((r) => r.campaign.crew.reduce((sum, m) => sum + m.hp, 0)))} hit points.`,
    `Crew: signed on ${spread(of('hired'))} for ${spread(of('hireCredits'))} credits, ${done.filter((r) => r.tally.hired > 0).length} of ${done.length} runs; ${spread(done.map((r) => r.campaign.crew.length))} aboard at the end. The med bay healed ${spread(of('healed'))} hit points.`,
    `Refits: ${spread(of('fitted'))} parts fitted at ${spread(of('refits'))} stations, in ${done.filter((r) => r.tally.fitted > 0).length} of ${done.length} runs: ${fitsLine(defs, done)}.`,
    `In the first three sectors: restocked at ${spread(done.map((r) => early(r, (step) => step.kind === 'buy')))} stations; hungry on ${spread(hungryEarly)} jumps; fed all the way in ${hungryEarly.filter((n) => n === 0).length} of ${done.length}.`,
    `Supplies bought: ${spread(of('bought'))}, for ${spread(of('spent'))} credits. Launch credits: ${spread(done.map((r) => r.steps[0]?.credits[0] ?? 0))}.`,
    `Heat at launch: ${spread(done.map((r) => r.tally.heat[0]))}; at the end: ${spread(done.map((r) => r.tally.heat[1]))}; at most: ${spread(of('peak'))}. Jumps where the hunters might wait: ${spread(of('hotJumps'))}.`,
    `The hunters: met in ${met} of ${done.length} runs, ${spread(of('hunts'))} a run (the task force ${spread(of('taskForces'))}), faced ${spread(of('huntsFaced'))}. Regroups ${spread(of('regroups'))}, days hidden ${spread(of('hides'))}, healing ${spread(of('rested'))}; transponder swaps ${spread(of('swaps'))} for ${spread(of('swapCredits'))} credits.`,
    ...results.filter((r) => !r.launched).map((r) => r.lines.at(-1)),
  ];
  return { lines, results };
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
    `boardings won ${sum('won')}, lost ${sum('lost')}; built ${Object.entries(built).map(([name, n]) => `${name} ${n}`).join(', ') || 'nothing'}; refitted aboard in ${played.filter((trips) => trips.moved.length > 0).length}; hungry days ${median(played.map((trips) => trips.hungry))}.`
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
  const options = { long: value('--long', 'heat'), scans: value('--scan', 'yes'), refit: value('--refit', 'yes'), heat: value('--heat', 'manage'), fit: fit ? fit.split(',') : [] };
  const runs = Number(value('--runs', 0));
  console.log((runs ? manyVoyages(made.rules, runs, options) : voyage(made.rules, Number(value('--seed', 1)), options)).lines.join('\n'));
}
