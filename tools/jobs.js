#!/usr/bin/env node
// Prints jobs (src/sim/contracts.js) and the maps of their sites
// (src/sim/gen/site.js).
//
//   node tools/jobs.js                ten jobs in a row from a new
//                                     campaign: the board's first job is
//                                     taken each time and played out, the
//                                     crew by src/sim/jobAi.js and the
//                                     enemy by the AI
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
import { autoplay } from '../src/sim/autoplay.js';
import { newCampaign } from '../src/sim/campaign.js';
import { endJob, jobSetup, takeJob, withBoard } from '../src/sim/contracts.js';
import { indexDefs } from '../src/sim/defs.js';
import { generateSite } from '../src/sim/gen/site.js';
import { aiAction } from '../src/sim/ai.js';
import { jobAction } from '../src/sim/jobAi.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { renderMap } from './battle-map.js';
import { readData } from './data.js';

export const GOLDEN_SITES = fileURLToPath(new URL('../tests/golden/sites.txt', import.meta.url));
// Each golden seed with the hazard its map is drawn with.
export const GOLDEN_SEEDS = [[1, null], [2, 'fire'], [3, 'rubble']];
// Zones marked on a site's text as its template marks them.
const ZONE_MARKS = { entry: 'e', spawn: 's', loot: '*', terminal: 'k' };
const MAX_ROUNDS = 30;

// A site's map as text (tools/battle-map.js renderMap, with '%' for rock),
// with its zones marked the way templates mark them: e the ways in, s the
// spawn tiles, * crates a job can tag, k the terminal. Hazards, if any,
// are drawn below it.
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

// Jobs in a row from a new campaign: each time the board's first job is
// taken and played out. Returns the lines to print.
export function jobsInARow(defs, seed, count = 10) {
  let campaign = withBoard(newCampaign(defs, seed), defs);
  const lines = [`Campaign seed ${seed}:`];
  for (let n = 1; n <= count && campaign.board.length; n++) {
    const job = campaign.board[0];
    const words = jobText(job, defs);
    lines.push(
      `${n}. ${words.title}, for ${words.who}, at ${words.where} (${defs.sites.get(job.site).map})`,
      `   ${words.mission}${words.twist ? `, ${words.twist.name}: ${words.twist.text}` : ''}`,
      `   Against ${words.against}. Pays ${words.pay}.`,
    );
    const taken = takeJob(campaign, defs, 0);
    if (!taken.ok) {
      lines.push(`   Can't start: ${taken.error}`);
      break;
    }
    // The same battle takeJob began, played out.
    const { battle, events } = autoplay(jobSetup(job, defs, campaign.crew), defs, { crew: jobAction, enemy: aiAction }, { maxRounds: MAX_ROUNDS });
    const over = events.findLast((event) => event.type === 'over');
    if (!battle.winner) {
      lines.push(`   No winner after ${MAX_ROUNDS} rounds.`);
      break;
    }
    lines.push(`   ${battle.winner === 'crew' ? 'Done' : 'Lost'} in round ${battle.round}${over?.reason ? ` (${over.reason})` : ''}.`);
    campaign = endJob({ ...taken.campaign, fight: { ...taken.campaign.fight, battle, log: events } }, defs);
  }
  const parts = Object.entries(campaign.parts).map(([type, n]) => `${defs.modules.get(type)?.name ?? type} ×${n}`).join(', ');
  lines.push(`After: ${campaign.credits} credits; on hand: ${parts || 'nothing'}; ${campaign.flags.jobsDone ?? 0} done, ${campaign.flags.jobsFailed ?? 0} lost.`);
  return lines;
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
    console.log('Tiles: . floor, h crate, H container, # machinery, c console, % rock; e the way in, s spawn, * crate to tag, k terminal.');
  } else {
    console.log(jobsInARow(defs, value('--seed', 1), value('--count', 10)).join('\n'));
  }
}
