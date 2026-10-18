#!/usr/bin/env node
// Prints jobs (src/sim/contracts.js) and the maps of their sites
// (src/sim/gen/site.js).
//
//   node tools/jobs.js                ten jobs in a row from a new
//                                     campaign, ignoring heat: the board's
//                                     first job is taken each time and
//                                     played out, the crew by
//                                     src/sim/jobAi.js and the enemy by the
//                                     AI; a raid, when one comes, is fought
//                                     (raid.js), the raiders pressing on
//   node tools/jobs.js --manage       managing heat instead: the quietest
//                                     job on the board, and a payment on the
//                                     debt whenever the next job would bring
//                                     heat to the hunters
//   node tools/jobs.js --seed 7       from another campaign seed
//   node tools/jobs.js --count 20     more jobs, or fewer
//   node tools/jobs.js --maps         every site's map at the golden seeds
//   node tools/jobs.js --golden       rewrites tests/golden/sites.txt
//
// The golden file is every site's map at seeds 1 to 3: the first bare,
// the second on fire and the third caved in. Only rewrite it on purpose,
// and say so in PROGRESS.md.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aiAction } from '../src/sim/ai.js';
import { playFrom } from '../src/sim/autoplay.js';
import { newCampaign } from '../src/sim/campaign.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { indexDefs } from '../src/sim/defs.js';
import { generateSite } from '../src/sim/gen/site.js';
import { heatLevel, huntersFor, jobHeat, makePayment, paymentFor, raidDue } from '../src/sim/heat.js';
import { jobAction } from '../src/sim/jobAi.js';
import { pressAction } from '../src/sim/press.js';
import { beginRaid, endRaid, raidLoss } from '../src/sim/raid.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { renderMap } from './battle-map.js';
import { readData } from './data.js';

export const GOLDEN_SITES = fileURLToPath(new URL('../tests/golden/sites.txt', import.meta.url));
// Each golden seed with the hazard its map is drawn with.
export const GOLDEN_SEEDS = [[1, null], [2, 'fire'], [3, 'rubble']];
// Zones marked on a site's text as its template marks them: since M38 the
// far gate and the captive's places too.
const ZONE_MARKS = { entry: 'e', spawn: 's', loot: '*', terminal: 'k', exit: 'x', captive: 'v' };
const MAX_ROUNDS = 60; // a fight still going after this many stops with no winner

// A site's map as text (tools/battle-map.js renderMap, with '%' for rock),
// with its zones marked the way templates mark them: e the ways in, s the
// spawn tiles, * crates a job can tag, k the terminal, x the far gate, v
// where a captive can be held. Hazards, if any, are drawn below it.
export function siteText(defs, mapId, seed, hazard = null) {
  const template = defs.siteMaps.get(mapId);
  const { map, zones, flip } = generateSite(template, seed, { hazard, patches: hazard ? 2 : 0 });
  const lines = renderMap(map, { ...defs.tiles, '%': 'rock' }).split('\n');
  for (const [zone, mark] of Object.entries(ZONE_MARKS)) {
    for (const [x, y] of zones[zone]) {
      const row = lines[2 * y + 1].padEnd(2 * x + 2);
      lines[2 * y + 1] = row.slice(0, 2 * x + 1) + mark + row.slice(2 * x + 2);
    }
  }
  const turned = [flip.x && 'left to right', flip.y && 'top to bottom'].filter(Boolean).join(' and ') || 'not turned';
  return `${template.name} (${mapId}), seed ${seed}${hazard ? `, ${hazard}` : ''}: ${map.width} × ${map.height}, ${turned}\n${lines.join('\n')}`;
}

// Every site's map at the golden seeds.
export function goldenText(defs) {
  return [...defs.siteMaps.keys()].flatMap((id) => GOLDEN_SEEDS.map(([seed, hazard]) => siteText(defs, id, seed, hazard))).join('\n');
}

// Jobs in a row from a new campaign, either ignoring heat (the board's
// first job each time, and never a payment) or managing it (the quietest
// job on the board, and a payment whenever the next job would bring heat
// to the hunters, if there are credits for it). A raid, when one is due,
// is fought before the next job: the crew as the AI, the raiders pressing
// on. Returns { lines, raids, firstRaid, peak }: the lines to print, the
// raids fought, the job a raid first came after (or null) and the most
// heat there was.
export function jobsInARow(defs, seed, count = 10, { manage = false } = {}) {
  let campaign = withBoard(newCampaign(defs, seed), defs);
  const lines = [`Campaign seed ${seed}, ${manage ? 'managing' : 'ignoring'} heat:`];
  const run = { raids: 0, firstRaid: null, peak: 0 };
  const fightOut = (started, players) => {
    const { fight } = started;
    const { battle, events } = playFrom(fight.battle, defs, players, { maxRounds: MAX_ROUNDS });
    return { battle, events, campaign: { ...started, fight: { ...fight, battle, log: [...fight.log, ...events] } } };
  };
  for (let n = 1; n <= count && campaign.board.length; n++) {
    if (raidDue(campaign, defs)) {
      const begun = beginRaid(campaign, defs);
      if (!begun.ok) {
        lines.push(`   The raid can't start: ${begun.error}`);
        break;
      }
      run.raids += 1;
      run.firstRaid ??= n - 1;
      const loss = raidLoss(campaign, defs);
      const { battle, campaign: fought } = fightOut(begun.campaign, { crew: aiAction, enemy: pressAction });
      if (!battle.winner) {
        lines.push(`   The raid: no winner after ${MAX_ROUNDS} rounds.`);
        break;
      }
      campaign = endRaid(fought, defs);
      const took = battle.winner === 'crew' ? 'held' : `lost${loss ? `: they took ${loss.part ? defs.modules.get(loss.part)?.name ?? loss.part : `${loss.credits} credits`}` : ''}`;
      lines.push(`   Raid at heat ${fought.heat}: ${took} in round ${battle.round}. Heat ${campaign.heat}.`);
    }
    let index = 0;
    if (manage) {
      const heats = campaign.board.map((offer) => jobHeat(offer, defs).heat);
      index = heats.indexOf(Math.min(...heats));
      while (campaign.heat + heats[index] >= defs.balance.huntHeat && paymentFor(campaign, defs).ok) {
        const before = campaign.heat;
        campaign = makePayment(campaign, defs).campaign;
        lines.push(`   A payment on the debt: heat ${before} to ${campaign.heat}, ${campaign.credits} credits left.`);
      }
    }
    const job = campaign.board[index];
    const words = jobText(job, defs, huntersFor(campaign, defs));
    const { heat, loud } = jobHeat(job, defs);
    lines.push(
      `${n}. ${words.title}, for ${words.who}, at ${words.where} (${defs.sites.get(job.site).map})`,
      `   ${words.mission}${words.twist ? `, ${words.twist.name}: ${words.twist.text}` : ''}`,
      `   Against ${words.against}. Pays ${words.pay}. Heat +${heat}${loud ? ', loud' : ''}.`,
    );
    const taken = takeJob(campaign, defs, index);
    if (!taken.ok) {
      lines.push(`   Can't start: ${taken.error}`);
      break;
    }
    const { battle, events, campaign: fought } = fightOut(taken.campaign, { crew: jobAction, enemy: aiAction });
    const over = events.findLast((event) => event.type === 'over');
    if (!battle.winner) {
      lines.push(`   No winner after ${MAX_ROUNDS} rounds.`);
      break;
    }
    campaign = endJob(fought, defs);
    run.peak = Math.max(run.peak, campaign.heat);
    lines.push(`   ${battle.winner === 'crew' ? 'Done' : 'Lost'} in round ${battle.round}${over?.reason ? ` (${over.reason})` : ''}. Heat ${campaign.heat}, ${heatLevel(campaign.heat, defs)}.`);
  }
  const parts = Object.entries(campaign.parts).map(([type, n]) => `${defs.modules.get(type)?.name ?? type} ×${n}`).join(', ');
  lines.push(`After: ${campaign.credits} credits; on hand: ${parts || 'nothing'}; ${campaign.flags.jobsDone ?? 0} done, ${campaign.flags.jobsFailed ?? 0} lost; heat ${campaign.heat}, ${run.raids} raid${run.raids === 1 ? '' : 's'}${raidDue(campaign, defs) ? ', and one at the door' : ''}.`);
  return { lines, ...run, due: raidDue(campaign, defs) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const defs = indexDefs(readData());
  const value = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? Number(args[i + 1]) : fallback;
  };
  if (args.includes('--golden')) {
    writeFileSync(GOLDEN_SITES, `${goldenText(defs)}\n`);
    console.log(`Wrote ${GOLDEN_SITES}`);
  } else if (args.includes('--maps')) {
    console.log(goldenText(defs));
    console.log('Tiles: . floor, h crate, H container, # machinery, c console, % rock; e the way in, s spawn, * crate to tag, k terminal, x the far gate, v a captive.');
  } else {
    console.log(jobsInARow(defs, value('--seed', 1), value('--count', 10), { manage: args.includes('--manage') }).lines.join('\n'));
  }
}
