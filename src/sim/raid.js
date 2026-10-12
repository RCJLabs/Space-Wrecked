// The hangar raid (ROADMAP §2, §4.4): once heat reaches raidHeat, the
// pursuer comes for the ship, and no job can be taken until they have been
// faced (or heat paid down). The fight is on the hangar map (hangarMap.js):
// the crew on the bridge, the pursuer's raiders (data/backgrounds.json) at
// the hangar's doors, coming in through the airlocks. Raiders press on
// (press.js): they came for the ship, and won't wait it out at the door.
// Afterwards heat falls to heatAfterRaid, won or lost. Lost, they take what
// they can carry: the dearest part on hand, or with none, half the credits.
// Pure: every roll is the campaign's.
import { int } from '../core/rng.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight } from './campaign.js';
import { PAY_STEP } from './economy.js';
import { hangarDoors, hangarMap, waysIn } from './hangarMap.js';
import { pursuerOf, raidDue } from './heat.js';
import { enemyBonus } from './settings.js';
import { hasTag } from './modules.js';
import { stepsFrom } from './moves.js';
import { walkable } from './terrain.js';

const MAX_SEED = 0xffffffff;

// Starts the raid that is due: the whole crew against the raiders, on the
// hangar map. Its seed is the campaign's next roll. setup is what the
// settings make of the fight (settings.js fightSettings): forgiving odds,
// and the difficulty. Returns { ok: true, campaign } with the fight on, or
// { ok: false, error } saying why it can't start.
export function beginRaid(campaign, rules, { forgiving = false, difficulty = 'normal' } = {}) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  if (!raidDue(campaign, rules)) return { ok: false, error: 'No one is raiding the hangar.' };
  const pursuer = pursuerOf(campaign, rules);
  const raiders = rules.encounters.get(pursuer?.raiders)?.enemies;
  if (!raiders) return { ok: false, error: 'The raiders are unknown.' };
  if (!campaign.crew.length) return { ok: false, error: 'There is no one aboard to fight.' };
  const unknown = campaign.crew.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const map = hangarMap(campaign.ship, rules);
  if (!map) return { ok: false, error: 'The ship has no parts yet.' };
  if (!waysIn(map)) return { ok: false, error: `${pursuer.name} won't cut through the hull. Put an airlock on it, then face them.` };
  const placed = raidPlaces(map, campaign.crew.length, raiders.length, rules);
  if (!placed) return { ok: false, error: `There isn't room for ${campaign.crew.length} crew and ${raiders.length} raiders.` };
  const { value: seed, state: rng } = int(campaign.rng, 0, MAX_SEED);
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = [
    ...campaign.crew.map((member, i) => ({ ...crewUnit(member, rules), x: placed.crew[i][0], y: placed.crew[i][1] })),
    ...raiders.map((kind, i) => ({ kind, x: placed.raiders[i][0], y: placed.raiders[i][1], bonus })),
  ];
  const { battle, events } = createBattle({ map, units, seed, options: { forgiving, press: true } }, rules);
  const fight = { encounter: pursuer.raiders, seed, crew: campaign.crew.map((member) => member.id), battle, log: events, job: null, raid: true };
  return { ok: true, campaign: { ...campaign, rng, place: 'fight', fight } };
}

// Where everyone starts: the crew on the bridge, nearest its middle by
// walking first (with no bridge, as far from the hangar's doors as it
// goes), and the raiders inside the hangar's doors. Null without room.
function raidPlaces(map, crew, raiders, rules) {
  const field = { map, doors: [], units: [] };
  const doors = hangarDoors(map).slice(0, raiders);
  const bridge = [];
  for (const room of map.rooms) {
    if (!hasTag(rules.modules.get(room.type), 'bridge')) continue;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) if (walkable(field, x, y, rules)) bridge.push([x, y]);
    }
  }
  const fromDoors = stepsFrom(field, doors, rules);
  const furthest = Math.max(...fromDoors.values());
  const start = bridge.length ? bridge : [...fromDoors].filter(([, steps]) => steps === furthest).map(([key]) => key.split(',').map(Number));
  const taken = new Set(doors.map(([x, y]) => `${x},${y}`));
  const spots = [...stepsFrom(field, start, rules)]
    .map(([key, steps]) => ({ key, steps, at: key.split(',').map(Number) }))
    .filter(({ key }) => !taken.has(key))
    .sort((a, b) => a.steps - b.steps || a.at[1] - b.at[1] || a.at[0] - b.at[0])
    .slice(0, crew)
    .map(({ at }) => at);
  return spots.length < crew || doors.length < raiders ? null : { crew: spots, raiders: doors };
}

// What a lost raid costs: { part } for the dearest part on hand (by
// module cost, then id), or with none, { credits } for half of them in
// steps of PAY_STEP, or null with nothing to take.
export function raidLoss(campaign, rules) {
  const held = Object.keys(campaign.parts).sort((a, b) => (rules.modules.get(b)?.cost ?? 0) - (rules.modules.get(a)?.cost ?? 0) || a.localeCompare(b));
  if (held.length) return { part: held[0] };
  const credits = PAY_STEP * Math.floor(campaign.credits / 2 / PAY_STEP);
  return credits > 0 ? { credits } : null;
}

// After a raid with a winner, home again (campaign.js endFight), with heat
// down to heatAfterRaid, the raid counted in the flags (raidsWon or
// raidsLost), and, if it was lost, what the raiders took. Any other fight
// is left to endFight as it is.
export function endRaid(campaign, rules) {
  const { fight } = campaign;
  const after = endFight(campaign, rules);
  if (after === campaign || !fight.raid) return after;
  const won = fight.battle.winner === 'crew';
  const loss = won ? null : raidLoss(campaign, rules);
  const parts = { ...after.parts };
  if (loss?.part) {
    parts[loss.part] -= 1;
    if (!parts[loss.part]) delete parts[loss.part];
  }
  const flag = won ? 'raidsWon' : 'raidsLost';
  return {
    ...after,
    heat: Math.min(after.heat, rules.balance.heatAfterRaid),
    credits: after.credits - (loss?.credits ?? 0),
    parts,
    flags: { ...after.flags, [flag]: (after.flags[flag] ?? 0) + 1 },
  };
}
