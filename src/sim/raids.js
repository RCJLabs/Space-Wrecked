// Raids on the colony (ROADMAP §2, §4.4, M29). In act 3 the pursuer
// hunts for the colony:
//   - heat falls by colonyHeatFall at each of the colony's days' end, and
//     a trip adds tripHeat as the ship flies out (expeditions.js);
//   - at each day's end, while no raid is coming, the pursuer may find the
//     colony, at odds by heat's level (raidOdds*, from rumorHeat up, none
//     below);
//   - both go by how far the colony lies from the lanes: off them as they
//     are, near them lanesNear percent and far from them lanesFar percent;
//   - found, its lander comes down raidWarning days later. That day the
//     raid is down: Next day and the trips wait until it is faced.
// Facing it (faceRaid):
//   - the colony's powered defenses fire at the lander as it comes down,
//     each building its data/colony.json shots at landingHit percent, and
//     each hit is a raider fewer;
//   - whoever is home fights the rest on the colony's grid (colonyMap.js),
//     the raiders pressing on as at the hangar (raid.js). A powered shield
//     gives the defenders raidShieldArmor armor, a powered armory
//     raidArmoryAim aim;
//   - with nobody home, the hits are all the colony has.
// Won or lost, heat falls to heatAfterRaid. Lost, the raiders take half
// the food, half the materials and the dearest part in the hold. Pure:
// every roll is the campaign's.
//
// The raid coming (colony.raid, null with none): { found (the day the
// pursuer found the colony), lands (the day its lander comes down) }.
import { int } from '../core/rng.js';
import { atColony } from './acts.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight } from './campaign.js';
import { buildingOf, colonyStats } from './colony.js';
import { colonyMap, raidStarts } from './colonyMap.js';
import { tally } from './flags.js';
import { pursuerOf, runLevel, withHeat } from './heat.js';
import { enemyBonus } from './settings.js';

const MAX_SEED = 0xffffffff;
// The levels of heat the pursuer may find the colony at, each with its
// odds a day off the lanes (data/balance.json).
export const RAID_ODDS = { rumors: 'raidOddsRumors', hunters: 'raidOddsHunters', taskForce: 'raidOddsTaskForce', cornered: 'raidOddsCornered' };

// The pursuer at the colony (data/backgrounds.json): { levels, raiders,
// found, landing, faced }, or null.
export function colonyPursuer(campaign, rules) {
  return pursuerOf(campaign, rules)?.colony ?? null;
}

// What lying where it does makes of heat gained and of the odds, in
// percent: near the lanes (1) lanesNear, off them (2) 100, far from them
// (3) lanesFar.
export function lanesPercent(colony, rules) {
  const { lanesNear, lanesFar } = rules.balance;
  return [lanesNear, 100, lanesFar][(colony?.world?.lanes ?? 2) - 1] ?? 100;
}

// The heat a trip adds as the ship flies out.
export function tripHeatOf(campaign, rules) {
  return Math.round((rules.balance.tripHeat * lanesPercent(campaign.colony, rules)) / 100);
}

// The day's odds, in percent, of the pursuer finding the colony at the
// day's end: by heat's level and the lanes, none while a raid is coming.
export function foundOdds(campaign, rules) {
  if (!campaign.colony || campaign.colony.raid) return 0;
  const key = RAID_ODDS[runLevel(campaign.heat, rules)];
  if (!key) return 0;
  return Math.min(100, Math.round((rules.balance[key] * lanesPercent(campaign.colony, rules)) / 100));
}

// True on the day the raid's lander is down, and every day after until it
// is faced.
export function raidDown(campaign) {
  const raid = campaign.colony?.raid;
  return Boolean(raid) && campaign.colony.day >= raid.lands;
}

// The days until the raid's lander comes down: 0 with it down, null with
// none coming.
export function raidIn(campaign) {
  const raid = campaign.colony?.raid;
  return raid ? Math.max(0, raid.lands - campaign.colony.day) : null;
}

// What the refusals say while the lander is down.
export function downText(campaign, rules) {
  return `${pursuerOf(campaign, rules)?.name ?? 'The pursuer'}'s lander is down: face the raid first.`;
}

// The colony's day's end for raids (days.js, once the day has passed and
// its count risen): with no raid coming, the pursuer may find the colony,
// at the odds of the day just ended (foundOdds, on the campaign as it was);
// then heat falls. Returns { campaign, odds, roll (null when nothing was
// rolled), found (the raid found, or null) }.
export function raidDayEnd(before, campaign, rules) {
  const odds = foundOdds(before, rules);
  let { rng } = campaign;
  let roll = null;
  let raid = campaign.colony.raid;
  let found = null;
  if (odds > 0) {
    const rolled = int(rng, 0, 99);
    roll = rolled.value;
    rng = rolled.state;
    if (roll < odds) {
      found = { found: before.colony.day, lands: campaign.colony.day + rules.balance.raidWarning };
      raid = found;
    }
  }
  const heat = withHeat(campaign.heat, -rules.balance.colonyHeatFall);
  const flags = tally(campaign.flags, { raidsFound: found ? 1 : 0 });
  return { campaign: { ...campaign, rng, heat, flags, colony: { ...campaign.colony, raid } }, odds, roll, found };
}

// Who is home to fight: the crew but the squad away on a trip, in the
// crew's order.
export function defendersOf(campaign) {
  const away = new Set(campaign.colony?.trip?.squad ?? []);
  return campaign.crew.filter((member) => !away.has(member.id));
}

// The colony's defenses against a raid as they stand: { guns ([{ uid,
// name, shots }]: the powered buildings that fire at a lander, in the
// order built), shots (in all), armor and aim (what the defenders gain: a
// powered shield's and a powered armory's) }.
export function defensesOf(campaign, rules) {
  const stats = colonyStats(campaign, rules);
  const guns = stats.buildings
    .filter((b) => b.powered)
    .map((b) => ({ uid: b.uid, name: b.name, shots: buildingOf(b.type, rules)?.shots ?? 0 }))
    .filter((gun) => gun.shots > 0);
  const lit = stats.buildings.filter((b) => b.powered && b.gives);
  const { raidShieldArmor, raidArmoryAim } = rules.balance;
  return {
    guns,
    shots: guns.reduce((sum, gun) => sum + gun.shots, 0),
    armor: lit.some((b) => b.gives.shield > 0) ? raidShieldArmor : 0,
    aim: lit.some((b) => b.gives.armory) ? raidArmoryAim : 0,
  };
}

// What facing the raid that is down would come to: { ok: true, raiders
// (the pursuer's, enemy ids), defenders (crew ids at home), guns, shots,
// armor and aim (defensesOf's), hit (each shot's chance, percent) }, or
// { ok: false, error }.
export function landingPlan(campaign, rules) {
  if (!atColony(campaign, rules) || !raidDown(campaign)) return { ok: false, error: 'No lander is down at the colony.' };
  const pursuer = colonyPursuer(campaign, rules);
  const raiders = rules.encounters.get(pursuer?.raiders)?.enemies;
  if (!raiders) return { ok: false, error: 'The raiders are unknown.' };
  return { ok: true, raiders, defenders: defendersOf(campaign).map((member) => member.id), ...defensesOf(campaign, rules), hit: rules.balance.landingHit };
}

// Faces the raid that is down (see landingPlan): the guns fire at the
// lander, a roll a shot (0 to 99, under hit to hit), each hit a raider
// fewer, the last of the party first. With none left the raid is beaten
// where it stands; with nobody home and some left, it is lost; else the
// fight begins: whoever is home against the raiders left, on the colony's
// grid, its seed the campaign's next roll. setup is what the settings make
// of the fight (settings.js fightSettings). Returns { ok: true, campaign,
// landing: { shots ([{ uid, name, roll, hit }]), hits, landed (the
// raiders left) }, fight (true with the fight on), taken (what a raid lost
// without a fight took, else null) }, or { ok: false, error }.
export function faceRaid(campaign, rules, { forgiving = false, difficulty = 'normal' } = {}) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  const plan = landingPlan(campaign, rules);
  if (!plan.ok) return plan;
  let { rng } = campaign;
  const shots = [];
  for (const gun of plan.guns) {
    for (let n = 0; n < gun.shots; n++) {
      const rolled = int(rng, 0, 99);
      rng = rolled.state;
      shots.push({ uid: gun.uid, name: gun.name, roll: rolled.value, hit: rolled.value < plan.hit });
    }
  }
  const hits = shots.filter((shot) => shot.hit).length;
  const landed = plan.raiders.slice(0, Math.max(0, plan.raiders.length - hits));
  const landing = { shots, hits, landed };
  const rolled = { ...campaign, rng, flags: tally(campaign.flags, { landingShots: shots.length, landingHits: hits, raidersStopped: plan.raiders.length - landed.length }) };
  if (!landed.length || !plan.defenders.length) {
    const won = !landed.length;
    const settled = settleRaid(rolled, rules, won);
    return { ok: true, campaign: settled.campaign, landing, fight: false, won, taken: settled.taken };
  }
  const map = colonyMap(campaign.colony, rules);
  const members = defendersOf(campaign);
  const unknown = members.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const starts = map && raidStarts(map, members.length, landed.length, rules);
  if (!starts) return { ok: false, error: `There isn't room on the colony's grid for ${members.length} crew and ${landed.length} raiders.` };
  const seedRoll = int(rng, 0, MAX_SEED);
  const bonus = enemyBonus(difficulty, rules.balance);
  const units = [
    ...members.map((member, i) => {
      const unit = crewUnit(member, rules);
      const kit = { ...unit.bonus, armor: (unit.bonus?.armor ?? 0) + plan.armor, aim: (unit.bonus?.aim ?? 0) + plan.aim };
      return { ...unit, bonus: kit, x: starts.crew[i][0], y: starts.crew[i][1] };
    }),
    ...landed.map((kind, i) => ({ kind, x: starts.raiders[i][0], y: starts.raiders[i][1], bonus })),
  ];
  const { battle, events } = createBattle({ map, units, seed: seedRoll.value, options: { forgiving, press: true } }, rules);
  const fight = { encounter: colonyPursuer(campaign, rules).raiders, seed: seedRoll.value, crew: members.map((member) => member.id), battle, log: events, job: null, raid: true, boarding: null };
  return { ok: true, campaign: { ...rolled, rng: seedRoll.state, place: 'fight', fight }, landing, fight: true, won: null, taken: null };
}

// What a lost raid takes: { food, materials } (half of each, rounded
// down) and part (the dearest in the hold, by its cost, then its id, or
// null with the hold empty).
export function raidTake(campaign, rules) {
  const held = Object.keys(campaign.parts).sort((a, b) => (rules.modules.get(b)?.cost ?? 0) - (rules.modules.get(a)?.cost ?? 0) || a.localeCompare(b));
  return { food: Math.floor(campaign.supplies / 2), materials: Math.floor(campaign.colony.materials / 2), part: held[0] ?? null };
}

// After a raid fight at the colony, once it is won or lost (campaign.js
// endFight: wounds kept, the fights counted): settled as settleRaid has
// it. Any other fight is left as it is.
export function endColonyRaid(campaign, rules) {
  const { fight } = campaign;
  if (!fight?.raid || !campaign.colony) return campaign;
  const after = endFight(campaign, rules);
  if (after === campaign) return campaign;
  return settleRaid(after, rules, fight.battle.winner === 'crew').campaign;
}

// A raid over, won or lost: heat down to heatAfterRaid, the raid gone, and
// lost, what the raiders take (raidTake). Returns { campaign, taken (or
// null when won) }.
export function settleRaid(campaign, rules, won) {
  const taken = won ? null : raidTake(campaign, rules);
  const parts = { ...campaign.parts };
  if (taken?.part) {
    parts[taken.part] -= 1;
    if (!parts[taken.part]) delete parts[taken.part];
  }
  const flags = tally(campaign.flags, {
    [won ? 'colonyRaidsWon' : 'colonyRaidsLost']: 1,
    raidFoodTaken: taken?.food ?? 0,
    raidMaterialsTaken: taken?.materials ?? 0,
    raidPartsTaken: taken?.part ? 1 : 0,
  });
  return {
    taken,
    campaign: {
      ...campaign,
      heat: Math.min(campaign.heat, rules.balance.heatAfterRaid),
      supplies: campaign.supplies - (taken?.food ?? 0),
      parts,
      flags,
      colony: { ...campaign.colony, raid: null, materials: campaign.colony.materials - (taken?.materials ?? 0) },
    },
  };
}
