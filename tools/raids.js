#!/usr/bin/env node
// Each pursuer's raids against its background's start crew (M30), AI
// against AI, the raiders pressing on as in a raid: at the hangar, on the
// miner's ship as act 1 leaves it (tests/launchKit.js), and at the colony,
// on tests/colonyKit.js's with nothing given to it, so nothing fires at the
// lander and every raider lands. ROADMAP.md M30 asks each pursuer's to be
// beaten within 10 points of Con-Reg's.
//
//   node tools/raids.js               150 fights a background at each
//   node tools/raids.js --fights 500
import { pathToFileURL } from 'node:url';
import { seedFrom } from '../src/core/rng.js';
import { aiAction } from '../src/sim/ai.js';
import { playFrom } from '../src/sim/autoplay.js';
import { newCampaign } from '../src/sim/campaign.js';
import { pressAction } from '../src/sim/press.js';
import { beginRaid } from '../src/sim/raid.js';
import { faceRaid } from '../src/sim/raids.js';
import { settled } from '../tests/colonyKit.js';
import { readyToLaunch } from '../tests/launchKit.js';

const PLAYERS = { crew: aiAction, enemy: pressAction };
const MAX_ROUNDS = 60;

// The rows, a background each: { id, name, raiders: { hangar, colony } (the
// encounters), hangar, colony } (the crew's wins of `fights`).
export function runRaids(rules, { fights = 150 } = {}) {
  const hangar = readyToLaunch();
  const colony = settled();
  return [...rules.backgrounds.values()].map(({ id, name, pursuer }) => {
    const crew = newCampaign(rules, 5, { background: id }).crew;
    const row = { id, name, raiders: { hangar: pursuer.raiders, colony: pursuer.colony.raiders }, hangar: 0, colony: 0, fights };
    for (let n = 1; n <= fights; n++) {
      const begun = beginRaid({ ...hangar, background: id, crew, heat: rules.balance.raidHeat, rng: seedFrom(`hangar ${n}`) }, rules);
      if (!begun.ok) throw new Error(`${name}: ${begun.error}`);
      if (playFrom(begun.campaign.fight.battle, rules, PLAYERS, { maxRounds: MAX_ROUNDS }).battle.winner === 'crew') row.hangar += 1;
      const down = { ...colony, background: id, crew, colony: { ...colony.colony, day: 2, raid: { found: 1, lands: 2 } }, rng: seedFrom(`colony ${n}`) };
      const faced = faceRaid(down, rules);
      if (!faced.ok || !faced.fight) throw new Error(`${name}: ${faced.error ?? 'no fight at the colony'}`);
      if (playFrom(faced.campaign.fight.battle, rules, PLAYERS, { maxRounds: MAX_ROUNDS }).battle.winner === 'crew') row.colony += 1;
    }
    return row;
  });
}

// The rows as a table.
export function raidsText(rows, rules) {
  const party = (id) => rules.encounters.get(id).enemies.length;
  const width = Math.max(...rows.map((row) => row.name.length), 10);
  const percent = (won, row) => `${Math.round((100 * won) / row.fights)}%`;
  return [
    `Raids, the start crew against each pursuer's raiders, ${rows[0]?.fights ?? 0} fights each: the crew's wins.`,
    `${'Background'.padEnd(width)}  ${'At the hangar'.padStart(13)}  ${'At the colony'.padStart(13)}`,
    ...rows.map((row) => `${row.name.padEnd(width)}  ${`${percent(row.hangar, row)} of ${party(row.raiders.hangar)}`.padStart(13)}  ${`${percent(row.colony, row)} of ${party(row.raiders.colony)}`.padStart(13)}`),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readData } = await import('./data.js');
  const { indexDefs } = await import('../src/sim/defs.js');
  const args = process.argv.slice(2);
  const i = args.indexOf('--fights');
  const rules = indexDefs(readData());
  console.log(raidsText(runRaids(rules, { fights: i >= 0 ? Number(args[i + 1]) : 150 }), rules).join('\n'));
}
