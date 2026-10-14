#!/usr/bin/env node
// A test voyage through act 2 (M19's and M20's Done whens): from launch,
// across the act's sectors to where the charts end. The ship launches from
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
//   - with --long heat (the default), when heat is at the hunters' level
//     (huntHeat) or over, make a long jump on instead, if the supplies
//     cover it and the way on from there goes hungry no more often; with
//     --long never, never.
//
//   node tools/voyage.js               a voyage from campaign seed 1, step by step
//   node tools/voyage.js --seed 7      another seed
//   node tools/voyage.js --runs 20     seeds 1 to 20, summed up
//   node tools/voyage.js --long never  no long jumps
//   node tools/voyage.js --scan no     no scans
//   node tools/voyage.js --fit medbay  a part fitted before the voyage (or a
//                                      list, like --fit cargo,medbay)
//   node tools/voyage.js --refit no    no refits at stations
//   node tools/voyage.js --runs 20 --set supplyPrice=2
//                                      a balance number changed for this run
//                                      only (as many --set as you like)
import { pathToFileURL } from 'node:url';
import { maxHp } from '../src/sim/campaign.js';
import { flightChecklist } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { approachState, closeApproach, giveOrder } from '../src/sim/encounter.js';
import { chooseEvent, partsOnHand } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { patchCrew } from '../src/sim/patch.js';
import { raidLoss } from '../src/sim/raid.js';
import { hireRecruit } from '../src/sim/recruits.js';
import { repairShip } from '../src/sim/repair.js';
import { beginRun, buySupplies, failingCheck, hereOf, jump, jumpSupplies, leavePlan, leaveSector, openEvent, scan, scanPlan, supplyCapacity, supplyOffer } from '../src/sim/travel.js';
import { captainOrder } from './approachPlan.js';
import { fightBoarding } from './boarding.js';
import { readData } from './data.js';
import { runToLaunch } from './run.js';
import { rulesWith, setting } from './sim.js';
import { withPart } from './startShip.js';
import { bestChoice, boardIt, hireWho, nextJump, refitAt } from './voyagePlan.js';

export const LONG_POLICIES = ['heat', 'never'];
export const SCAN_POLICIES = ['yes', 'no'];
export const REFIT_POLICIES = ['yes', 'no'];
const MAX_JUMPS = 100; // a voyage still going after this many stops

// A voyage from a launched campaign (act 2, the run not yet begun) to the
// end of the charts: { ended, steps, sectors, tally, lines, campaign }.
// steps: every jump, purchase, event, approach, boarding, patch, repair and
// scan with what it moved, [before, after]; sectors: each sector as the ship
// entered it.
export function voyageFrom(defs, launched, { long = 'heat', scans = 'yes', refit = 'yes', label = '' } = {}) {
  if (!LONG_POLICIES.includes(long)) throw new Error(`--long is one of ${LONG_POLICIES.join(', ')}`);
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
  sectorLine();
  for (;;) {
    if (tally.jumps >= MAX_JUMPS) {
      lines.push(`Stopped: still going after ${MAX_JUMPS} jumps.`);
      break;
    }
    // An event where the ship is: the choice worth most.
    const open = openEvent(campaign, defs);
    if (open) {
      const pick = bestChoice(campaign, defs, open.event);
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
    // A hostile ship where the ship is: the approach, played out.
    if (campaign.run.approach) {
      const before = campaign;
      const { enemy } = campaign.run.approach;
      while (!campaign.run.approach.outcome) {
        const given = giveOrder(campaign, defs, captainOrder(approachState(campaign, defs), defs));
        if (!given.ok) throw new Error(given.error);
        campaign = given.campaign;
      }
      const { outcome, round } = campaign.run.approach;
      const { changes } = outcome;
      record('approach', before, { ship: enemy.ship, outcome: outcome.kind, how: outcome.how ?? null, rounds: round, changes, boarding: outcome.boarding, wrecks: Object.keys(campaign.wrecks).length });
      tally.approaches += 1;
      if (outcome.kind === 'boarded' || outcome.kind === 'destroyed') tally.approachesWon += 1;
      if (outcome.kind === 'boardedBy') tally.approachesLost += 1;
      tally.approachCredits += changes.credits;
      lines.push(`   ${enemy.name}: ${outcome.kind}${outcome.how ? ` (${outcome.how})` : ''} in round ${round}, ${Object.keys(campaign.wrecks).length} wrecked aboard. ${hold()}.`);
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
    // A scan, where it would show a node ahead.
    const look = scans === 'yes' ? scanPlan(campaign, defs) : { ok: false };
    const { sector, at } = campaign.run;
    if (look.ok && look.reveals.some((id) => sector.nodes[id].col > sector.nodes[at].col)) {
      const before = campaign;
      campaign = scan(campaign, defs).campaign;
      record('scan', before, { reveals: look.reveals.length });
      tally.scans += 1;
      lines.push(`   Scanned: ${look.reveals.length} node(s) shown, heat ${campaign.heat}.`);
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
    record(plan.kind, before, { hungry: plan.hungry, heal: plan.heal, max: before.crew.map((member) => maxHp(member, defs)), to: plan.kind === 'sector' ? null : campaign.run.at });
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
  tally.healed = campaign.flags.hpHealed ?? 0;
  const ended = leavePlan(campaign, defs).last === true;
  const where = ended ? `The charts end at sector ${campaign.run.sector.index}'s jump point` : `Stopped in sector ${campaign.run.sector.index}`;
  lines.push(
    `${where}, ${tally.crossed} sectors crossed: ${tally.jumps} jumps (${tally.longJumps} long, ${tally.hungryJumps} hungry), ${tally.bought} supplies bought at ${tally.stations} stations for ${tally.spent} credits. ${tally.events} events: ${signed(tally.eventCredits)} credits, ${signed(tally.eventSupplies)} supplies, ${tally.found} parts found, ${tally.sold} sold, ${tally.wounds} hit points lost; ${tally.scans} scans. ${tally.approaches} hostile ships: ${tally.approachesWon} won, ${tally.approachesLost} lost, ${signed(tally.approachCredits)} credits; boarded ${tally.boardings} (won ${tally.boardingsWon}), left ${tally.left}, fought off ${tally.defencesWon} of ${tally.defences}; salvage ${tally.salvaged} parts and ${tally.salvageCredits} credits, lost ${tally.partsLost} parts and ${tally.creditsLost} credits, ${tally.fightHp} hit points; patched ${tally.patchedHp} for ${tally.patchCredits} credits; ${tally.repairs} repairs for ${tally.repairCredits} credits; signed on ${tally.hired}, healed ${tally.healed} in the med bay; refitted ${tally.fitted} parts at ${tally.refits} stations. Heat ${tally.heat[0]} to ${tally.heat[1]}; crew ${tally.hp[0]} to ${tally.hp[1]}.`,
  );
  return { ended, steps, sectors, tally, lines, campaign };
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
  const policy = options.long === 'never' ? 'never' : `when heat is at ${defs.balance.huntHeat} or over`;
  const lines = [
    `${runs} voyages from launch, campaign seeds 1 to ${runs}, long jumps ${policy}, ${options.scans === 'no' ? 'no scans' : 'scanning'}, ${options.refit === 'no' ? 'no refits' : 'refitting at stations'}${options.fit?.length ? `, fitted with ${options.fit.join(' and ')}` : ''}. The median, then the least and most:`,
    `Sectors crossed: ${spread(of('crossed'))}; ${done.filter((r) => r.ended).length} of ${done.length} reached the end of the charts; fed all the way in ${done.filter((r) => r.tally.hungryJumps === 0).length} of ${done.length}.`,
    `Jumps: ${spread(of('jumps'))}, long ${spread(of('longJumps'))}, hungry ${spread(of('hungryJumps'))}.`,
    `At the nodes: ${spread(of('events'))} events, ${spread(of('eventCredits'))} credits and ${spread(of('eventSupplies'))} supplies from them, ${spread(of('found'))} parts found, ${spread(of('sold'))} sold, ${spread(of('wounds'))} hit points lost; ${spread(of('scans'))} scans.`,
    `Hostile ships: ${spread(of('approaches'))} met, ${spread(of('approachesWon'))} disabled or blown up, ${spread(of('approachesLost'))} boarding us. Boarded her ${spread(of('boardings'))} times (won ${spread(of('boardingsWon'))}), left her ${spread(of('left'))}; fought off ${spread(of('defencesWon'))} of ${spread(of('defences'))} boardings. Salvage: ${spread(of('salvaged'))} parts and ${spread(of('salvageCredits'))} credits. Lost: ${spread(of('partsLost'))} parts and ${spread(of('creditsLost'))} credits; ${spread(of('fightHp'))} hit points in the fights. Lost a boarding at home: ${done.filter((r) => r.steps.some((step) => step.kind === 'boarding' && step.dir === 'you' && !step.won)).length} of ${done.length}; dragged past 40 rounds: ${done.reduce((sum, r) => sum + r.tally.dragged, 0)}.`,
    `At stations: patched ${spread(of('patchedHp'))} hit points for ${spread(of('patchCredits'))} credits; ${spread(of('repairs'))} repairs for ${spread(of('repairCredits'))} credits. Crew at the end: ${spread(done.map((r) => r.campaign.crew.reduce((sum, m) => sum + m.hp, 0)))} hit points.`,
    `Crew: signed on ${spread(of('hired'))} for ${spread(of('hireCredits'))} credits, ${done.filter((r) => r.tally.hired > 0).length} of ${done.length} runs; ${spread(done.map((r) => r.campaign.crew.length))} aboard at the end. The med bay healed ${spread(of('healed'))} hit points.`,
    `Refits: ${spread(of('fitted'))} parts fitted at ${spread(of('refits'))} stations, in ${done.filter((r) => r.tally.fitted > 0).length} of ${done.length} runs: ${fitsLine(defs, done)}.`,
    `In the first three sectors: restocked at ${spread(done.map((r) => early(r, (step) => step.kind === 'buy')))} stations; hungry on ${spread(hungryEarly)} jumps; fed all the way in ${hungryEarly.filter((n) => n === 0).length} of ${done.length}.`,
    `Supplies bought: ${spread(of('bought'))}, for ${spread(of('spent'))} credits. Launch credits: ${spread(done.map((r) => r.steps[0]?.credits[0] ?? 0))}.`,
    `Heat at launch: ${spread(done.map((r) => r.tally.heat[0]))}; at the end: ${spread(done.map((r) => r.tally.heat[1]))}.`,
    ...results.filter((r) => !r.launched).map((r) => r.lines.at(-1)),
  ];
  return { lines, results };
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
  const options = { long: value('--long', 'heat'), scans: value('--scan', 'yes'), refit: value('--refit', 'yes'), fit: fit ? fit.split(',') : [] };
  const runs = Number(value('--runs', 0));
  console.log((runs ? manyVoyages(made.rules, runs, options) : voyage(made.rules, Number(value('--seed', 1)), options)).lines.join('\n'));
}
