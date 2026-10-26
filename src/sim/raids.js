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
//     raid is down: Next day and the trips wait until it is faced. Found
//     while the ship is away on a voyage (M38d's fix), it comes down no
//     sooner than the ship could be home if it turned back at once: the
//     flight home's days (voyage.js), when they are more.
// Facing it (faceRaid):
//   - the colony's powered defenses fire at the lander as it comes down,
//     each building its data/colony.json shots at landingHit percent (and
//     a marine at home's more, M32), and each hit is a raider fewer;
//   - whoever is home fights the rest on the colony's grid (colonyMap.js),
//     the raiders pressing on as at the hangar (raid.js). A powered shield
//     gives the defenders raidShieldArmor armor, a powered armory
//     raidArmoryAim aim;
//   - with nobody home, the hits are all the colony has.
// Won or lost, heat falls to heatAfterRaid. Lost, the raiders take half
// the food, half the materials and the dearest part in the hold. From M38d
// a raid can come while the ship is away on a voyage (voyage.js): the days
// pass as it flies, and their end leaves heat alone, the ship making its
// own out there. Its lander down holds the ship where it is (travel.js
// holdOf), those at home face it from the chart, the fight theirs while it
// lasts (away.js homeFront), and lost, the raiders take the colony's food
// and materials and nothing aboard. From M38e every colony can be raided
// (colonies.js), each by its own trail of heat (Evan's pick): the heat the
// ship left it with, falling colonyHeatFall a day, the campaign's while the
// ship is landed there (heatAt). Found while the ship isn't there, its
// lander comes down no sooner than the ship could reach it (reachOf), and a
// lander down at any colony holds the ship until it is faced, from the
// chart or the colony screen, by whoever is there (thereAt; their fight in
// play while it lasts, frontAt), or with nobody there by the guns alone.
// A raid sets that colony's heat to heatAfterRaid, and the ship's only
// when it is landed there. Pure: every roll is the campaign's.
//
// From M53 the party grows with the heat the colony is found at: at the
// hunters' level raidExtraHunters raiders more, at a task force
// raidExtraTaskForce, cornered raidExtraCornered, each another of the
// pursuer's own party in turn (raidParty). The count is set as the raid is
// found, so its warning holds it.
//
// The raid coming (colony.raid, null with none): { found (the day the
// pursuer found the colony), lands (the day its lander comes down), extra
// (M53: the raiders past the pursuer's party; 0 in a save from before),
// reckoning (M56: true for the leader's own, reckoning.js) }.
//
// From M56 the leader comes for the founding colony once (reckoning.js):
// due, it is found at the day's end before any raid is rolled for, its
// party the leader's; won, the pursuit is over and no raid is found again.
import { int } from '../core/rng.js';
import { atColony } from './acts.js';
import { backAboard, colonyFood, homeFront, homeOf, withColonyFood } from './away.js';
import { allColonies, backFrom, frontAt, heatAt, reachOf, thereAt, thereFrom, withNews } from './colonies.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight } from './campaign.js';
import { buildingOf, colonyEffect, colonyStats } from './colony.js';
import { colonyMap, raidStarts } from './colonyMap.js';
import { fightOut } from './fightOut.js';
import { tally } from './flags.js';
import { pursuerOf, runLevel, withHeat } from './heat.js';
import { eased } from './quests.js';
import { difficultyOf, enemyBonus, fightSetup } from './difficulty.js';
import { withPlacing } from './placing.js';
import { heatFallOf } from './pressure.js';
import { pursuitOver, reckoningDue, reckoningOf, reckoningSettled } from './reckoning.js';

const MAX_SEED = 0xffffffff;
// The levels of heat the pursuer may find the colony at, each with its
// odds a day off the lanes (data/balance.json).
export const RAID_ODDS = { rumors: 'raidOddsRumors', hunters: 'raidOddsHunters', taskForce: 'raidOddsTaskForce', cornered: 'raidOddsCornered' };

// The raiders past the pursuer's party that heat brings (M53), by its
// level.
const EXTRA = { hunters: 'raidExtraHunters', taskForce: 'raidExtraTaskForce', cornered: 'raidExtraCornered' };
export function raidExtra(heat, rules) {
  return rules.balance[EXTRA[runLevel(heat, rules)]] ?? 0;
}

// The raiders a raid brings: the pursuer's party, then `extra` more of its
// own kinds in turn.
export function raidParty(party, extra = 0) {
  return [...party, ...Array.from({ length: party.length ? extra : 0 }, (_, i) => party[i % party.length])];
}

// The raiders of the raid coming at a colony (`there`, as landingPlan
// takes it), or null when the pursuer's party is unknown.
export function raidersOf(there, rules) {
  const party = rules.encounters.get(raidEncounter(there, rules))?.enemies;
  return party ? raidParty(party, there.colony?.raid?.extra ?? 0) : null;
}

// The encounter the raid coming at a colony brings: the leader's party for
// the reckoning (M56), else the pursuer's raiders.
export function raidEncounter(there, rules) {
  return there.colony?.raid?.reckoning ? reckoningOf(there, rules)?.party : colonyPursuer(there, rules)?.raiders;
}

// The pursuer at the colony (data/backgrounds.json): { levels, raiders,
// found, landing, faced, reckoning }, or null.
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
// day's end: by heat's level and the lanes, none while a raid is coming;
// and once the background's thread is done (M33b, quests.js eased), at
// easedOdds percent of that, rounded as the odds are. The heat is the
// colony's own trail (M38e, heatAt).
export function foundOdds(campaign, rules) {
  if (!campaign.colony || campaign.colony.raid || pursuitOver(campaign)) return 0;
  const key = RAID_ODDS[runLevel(heatAt(campaign, campaign.colony), rules)];
  if (!key) return 0;
  const share = eased(campaign, rules) ? rules.balance.easedOdds : 100;
  return Math.min(100, Math.round((rules.balance[key] * lanesPercent(campaign.colony, rules) * share) / 10000));
}

// True on the day a raid's lander is down, and every day after until it
// is faced: from M38e at any colony (downAt).
export function raidDown(campaign) {
  return Boolean(downAt(campaign));
}

// The colony whose raid's lander is down, the one the ship is at or flew
// from first, then the others in the order settled; or null.
export function downAt(campaign) {
  return allColonies(campaign).find((colony) => colony.raid && colony.day >= colony.raid.lands) ?? null;
}

// The days until the raid's lander comes down: 0 with it down, null with
// none coming.
export function raidIn(campaign) {
  const raid = campaign.colony?.raid;
  return raid ? Math.max(0, raid.lands - campaign.colony.day) : null;
}

// What the refusals say while a lander is down: where, unless it is at the
// colony the ship is landed at.
export function downText(campaign, rules) {
  const at = downAt(campaign);
  const where = at && (at !== campaign.colony || campaign.colony.voyage) ? ` at ${at.world.name}` : '';
  return `${pursuerOf(campaign, rules)?.name ?? 'The pursuer'}'s lander is down${where}: face the raid first.`;
}

// The colony's day's end for raids (days.js, once the day has passed and
// its count risen): with no raid coming, the pursuer may find the colony,
// at the odds of the day just ended (foundOdds, on the campaign as it was),
// its lander coming down no sooner than the ship could reach it (M38e,
// reachOf), and from M38f, where the ship isn't, no sooner than the day
// after it could land there (raidReach), so flying straight back meets it;
// then heat falls there: the campaign's with the ship landed, else the
// colony's own (M38e; M38d left it alone, heat following the ship). From
// M38f, where the ship isn't (on a voyage or a trip, or at another colony),
// a lander coming down is fought out at once (fightAway). Returns {
// campaign, odds, roll (null when nothing was rolled), found (the raid
// found, or null), fought (fightAway's, or null) }.
export function raidDayEnd(before, campaign, rules) {
  const odds = foundOdds(before, rules);
  let { rng } = campaign;
  let roll = null;
  let raid = campaign.colony.raid;
  let found = null;
  const away = Boolean(campaign.colony.voyage || campaign.colony.trip);
  if (reckoningDue(campaign, rules)) {
    // The leader comes (M56), warned as long as reckoningWarning.
    const reach = raidReach(campaign, campaign.colony);
    found = { found: before.colony.day, lands: campaign.colony.day + Math.max(rules.balance.reckoningWarning, reach), extra: 0, reckoning: true };
    raid = found;
  } else if (odds > 0) {
    const rolled = int(rng, 0, 99);
    roll = rolled.value;
    rng = rolled.state;
    if (roll < odds) {
      const reach = raidReach(campaign, campaign.colony);
      found = { found: before.colony.day, lands: campaign.colony.day + Math.max(rules.balance.raidWarning, away ? reach + 1 : reach), extra: raidExtra(heatAt(before, before.colony), rules) };
      raid = found;
    }
  }
  const voyage = Boolean(campaign.colony.voyage);
  const fall = (heat) => withHeat(heat, -heatFallOf(campaign.colony, rules));
  const heat = voyage ? campaign.heat : fall(campaign.heat);
  const flags = tally(campaign.flags, { raidsFound: found ? 1 : 0, ...(found && voyage ? { raidsFoundAway: 1 } : {}) });
  const ended = { ...campaign, rng, heat, flags, colony: { ...campaign.colony, raid, heat: voyage ? fall(campaign.colony.heat) : campaign.colony.heat } };
  const fought = away && raid && ended.colony.day >= raid.lands ? fightAway(ended, rules) : null;
  return { campaign: fought ? fought.campaign : ended, odds, roll, found, fought };
}

// The days the ship needs to be back at a colony to meet a raid there
// (M38f): on a trip from it, a leg home, or two while it is still on its
// way out or at the place (expeditions.js; the place's days, a pilot's day
// short of them not counted); else reachOf's.
function raidReach(campaign, colony) {
  const trip = colony === campaign.colony ? colony.trip : null;
  if (trip) return (trip.place?.days ?? 0) * (trip.done ? 1 : 2);
  return reachOf(campaign, colony);
}

// The days a flight home from the voyage would take from here: a day for
// each system between the ship and the colony it flew from, one at least
// (M38e, colonies.js reachOf); 0 with the ship home.
export function flightHome(campaign) {
  return campaign.colony?.voyage ? reachOf(campaign, campaign.colony) : 0;
}

// Who is home to fight: the crew but the squad away on a trip, or while the
// ship is away on a voyage those at home (M38d), in the crew's order.
export function defendersOf(campaign) {
  const home = homeOf(campaign);
  if (home) return home;
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

// What facing the raid that is down would come to: { ok: true, colony (the
// number of the colony it is down at, M38e), raiders (the pursuer's, enemy
// ids), defenders (crew ids there), citizens (how many stand beside them
// as colonists, M38f: colonistsOf), guns, shots, armor and aim
// (defensesOf's, there), hit (each shot's chance, percent: landingHit, and
// a marine there's more, edges.js) }, or { ok: false, error }. At the
// colony, or from the run while the ship is away on a voyage (M38d); from
// M38e at any colony, from either.
export function landingPlan(campaign, rules) {
  const at = downAt(campaign);
  const faced = atColony(campaign, rules) || (campaign.place === 'hub' && Boolean(campaign.colony?.voyage?.home));
  if (!faced || !at) return { ok: false, error: 'No lander is down at the colony.' };
  const there = at === campaign.colony ? campaign : thereAt(campaign, at.id);
  const raiders = raidersOf(there, rules);
  if (!raiders) return { ok: false, error: 'The raiders are unknown.' };
  return { ok: true, colony: at.id, ...facing(there, rules, raiders) };
}

// The raid's sides at a colony, as there lives it: { raiders, defenders
// (crew ids), citizens, guns, shots, armor, aim, hit } (see landingPlan).
function facing(there, rules, raiders) {
  const defenders = defendersOf(there);
  // The defenders' sharpest eye and, from M39, the powered sensor masts and
  // fire directors (colony.js colonyEffect).
  const hit = Math.min(100, rules.balance.landingHit + colonyEffect(defenders, rules, 'landing', colonyStats(there, rules).effects));
  return { raiders, defenders: defenders.map((member) => member.id), citizens: colonistsOf(there, rules), ...defensesOf(there, rules), hit };
}

// How many of a colony's citizens stand in its raid as colonists (M38f): all
// of them, up to raidCitizens; none without data/colony.json's citizen, and
// none in the reckoning (M56), the crew's fight with the leader, the
// citizens sheltered.
export function colonistsOf(campaign, rules) {
  if (!rules.colony?.citizen || campaign.colony?.raid?.reckoning) return 0;
  return Math.min(campaign.colony?.citizens ?? 0, rules.balance.raidCitizens ?? 0);
}

// The guns fire at the lander (faceRaid, fightAway): a roll a shot (0 to 99,
// under hit to hit), each hit a raider fewer, the last of the party first.
// Returns { landing: { shots ([{ uid, name, roll, hit }]), hits, landed
// (the raiders left) }, rolled (the campaign with the rolls and the flags) }.
function fireAtLander(campaign, plan) {
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
  const flags = tally(campaign.flags, { landingShots: shots.length, landingHits: hits, raidersStopped: plan.raiders.length - landed.length });
  return { landing: { shots, hits, landed }, rolled: { ...campaign, rng, flags } };
}

// The raid's fight on the colony's grid, as there lives it (faceRaid,
// fightAway): whoever is there and, from M38f, its colonists (colonistsOf)
// beside them in the crew's band, against the raiders left, each defender
// with a powered shield's armor and a powered armory's aim, and from M50
// each powered gun standing in it (gunsOn); its seed the next roll of rng. setup is difficulty.js fightSetup's: the raiders bring
// what the campaign's difficulty adds (M41, a raid fought out too), and a
// fight the player plays has permanent death if the campaign does.
// Returns { battle, events, seed, rng, members (the crew fighting, in their
// units' order) } or { error }.
function raidBattle(there, rules, plan, landed, rng, { forgiving = false, difficulty = 'normal', permadeath = false } = {}) {
  const map = colonyMap(there.colony, rules);
  const members = defendersOf(there);
  const unknown = members.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const colonists = plan.citizens;
  const starts = map && raidStarts(map, members.length + colonists, landed.length, rules);
  if (!starts) return { error: `There isn't room on the colony's grid for ${members.length + colonists} defenders and ${landed.length} raiders.` };
  const seedRoll = int(rng, 0, MAX_SEED);
  const bonus = enemyBonus(difficulty, rules.balance);
  const kit = (own = {}) => ({ ...own, armor: (own.armor ?? 0) + plan.armor, aim: (own.aim ?? 0) + plan.aim });
  const citizen = rules.colony?.citizen;
  const units = [
    ...members.map((member, i) => {
      const unit = crewUnit(member, rules);
      return { ...unit, bonus: kit(unit.bonus), x: starts.crew[i][0], y: starts.crew[i][1] };
    }),
    ...Array.from({ length: colonists }, (_, i) => {
      const [x, y] = starts.crew[members.length + i];
      return { kind: citizen.id, name: `${citizen.name} ${i + 1}`, bonus: kit(), x, y };
    }),
    ...landed.map((kind, i) => ({ kind, x: starts.raiders[i][0], y: starts.raiders[i][1], bonus })),
    ...gunsOn(there.colony, plan.guns, rules),
  ];
  const made = createBattle({ map, units, seed: seedRoll.value, options: { forgiving, permadeath, press: true } }, rules);
  // The crew can be placed before it begins (M50, placing.js); the AI's
  // first order ends placing where a raid is fought out.
  return { battle: withPlacing(made.battle, rules), events: made.events, seed: seedRoll.value, rng: seedRoll.state, members };
}

// The colony's powered guns in a raid's fight (M50): each as the machine of
// data/colony.json gun, on the defenders' side, from its building's first
// tile (a block of full cover, so it stands in no one's way and sees as a
// ship's turret does, M39), named as its building, numbered when there are
// two or more of a name. guns: defensesOf's ([{ uid, name }]). [{ kind,
// side, name, x, y }], or none without data/colony.json's gun.
export function gunsOn(colony, guns, rules) {
  const gun = rules.colony?.gun;
  if (!gun) return [];
  const placed = guns.flatMap(({ uid, name }) => {
    const building = colony.buildings.find((b) => b.uid === uid);
    return building ? [{ kind: gun.id, side: 'crew', name, x: building.x, y: building.y }] : [];
  });
  return placed.map((unit) => {
    const same = placed.filter((other) => other.name === unit.name);
    return same.length > 1 ? { ...unit, name: `${unit.name} ${same.indexOf(unit) + 1}` } : unit;
  });
}

// The colonists who fell in a raid's battle (M38f): those of its citizens
// not standing at its end, but for one stabilized as they lay.
export function fallenColonists(battle) {
  return battle.units.filter((unit) => unit.citizen && unit.status !== 'active' && unit.status !== 'stable').length;
}

// The campaign with the colony's citizens fewer by fell.
function lessCitizens(campaign, fell) {
  if (!fell) return campaign;
  const { colony } = campaign;
  return { ...campaign, colony: { ...colony, citizens: Math.max(0, (colony.citizens ?? 0) - fell) }, flags: tally(campaign.flags, { citizensFell: fell }) };
}

// Faces the raid that is down (see landingPlan): the guns fire at the
// lander, a roll a shot (0 to 99, under hit to hit), each hit a raider
// fewer, the last of the party first. With none left the raid is beaten
// where it stands; with nobody home and some left, it is lost; else the
// fight begins: whoever is home against the raiders left, on the colony's
// grid, its seed the campaign's next roll. setup is what the settings make
// of the fight (settings.js fightSettings), with the campaign's difficulty
// and permanent death (M41, difficulty.js). While the ship is away on a
// voyage (M38d) the fight is those at home's, in play until it is over
// (away.js homeFront); at another colony (M38e) it is theirs, on its grid,
// the fight naming it (fight.colony), and they are in play until it is
// over (colonies.js frontAt). Returns { ok: true, campaign, colony (the
// number of the colony faced, M38e), landing: { shots ([{ uid, name,
// roll, hit }]), hits, landed (the raiders left) }, fight (true with the
// fight on), taken (what a raid lost without a fight took, else null) },
// or { ok: false, error }.
export function faceRaid(campaign, rules, setup = {}) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  const plan = landingPlan(campaign, rules);
  if (!plan.ok) return plan;
  const { landing, rolled } = fireAtLander(campaign, plan);
  const { landed } = landing;
  const other = plan.colony === campaign.colony.id ? null : plan.colony;
  if (!landed.length || (!plan.defenders.length && !plan.citizens)) {
    const won = !landed.length;
    const settled = settleRaid(other ? thereAt(rolled, other) : rolled, rules, won);
    return { ok: true, campaign: other ? thereFrom(rolled, settled.campaign) : settled.campaign, colony: plan.colony, landing, fight: false, won, taken: settled.taken };
  }
  const there = other ? thereAt(campaign, other) : campaign;
  const begun = raidBattle(there, rules, plan, landed, rolled.rng, fightSetup(campaign, setup));
  if (begun.error) return { ok: false, error: begun.error };
  const { battle, events, seed, members } = begun;
  const fight = { encounter: raidEncounter(there, rules), seed, crew: members.map((member) => member.id), battle, log: events, job: null, raid: true, boarding: null, ...(other ? { colony: other } : {}) };
  const front = other ? frontAt(rolled, other) : homeFront(rolled);
  return { ok: true, campaign: { ...front, rng: begun.rng, place: 'fight', fight }, colony: plan.colony, landing, fight: true, won: null, taken: null };
}

// A raid whose lander comes down at a colony the ship isn't at (M38f,
// Evan's pick): fought out at once. The guns fire as faceRaid's; with any
// raiders left and anyone there, crew or citizens, they fight on its grid
// as faceRaid's, the AI playing both sides (fightOut.js: past 40 rounds
// both press on; still unended at 60, the raiders pull out and the colony
// holds), the raiders bringing what the campaign's difficulty adds (M41).
// Crew there come out wounded, never dead, even where death is permanent,
// and count the fight; the colonists who fell are gone. Settled as settleRaid has it (that
// colony's heat, and lost, half its food and materials), and its news tells
// it. campaign: the colony as it lives its day (days.js), its crew those
// there. Returns { campaign, won, fell (the citizens lost), landing }.
export function fightAway(campaign, rules) {
  const raiders = raidersOf(campaign, rules) ?? [];
  const plan = facing(campaign, rules, raiders);
  const { landing, rolled } = fireAtLander(campaign, plan);
  let now = rolled;
  let won = !landing.landed.length;
  let fell = 0;
  const begun = won || (!plan.defenders.length && !plan.citizens) ? null : raidBattle(rolled, rules, plan, landing.landed, rolled.rng, { difficulty: difficultyOf(campaign) });
  if (begun && !begun.error) {
    const { battle } = fightOut(begun.battle, rules);
    won = battle.winner !== 'enemy';
    fell = fallenColonists(battle);
    // The crew there: wounds kept, never below 1, and the fight counted
    // (campaign.js endFight's).
    const units = battle.units.filter((unit) => unit.side === 'crew' && !unit.ward && !unit.citizen);
    const stood = new Map(begun.members.map((member, i) => [member.id, units[i]]));
    const crew = rolled.crew.map((member) => {
      const unit = stood.get(member.id);
      return unit ? { ...member, hp: Math.max(1, unit.hp), fights: (member.fights ?? 0) + 1 } : member;
    });
    now = { ...rolled, rng: begun.rng, crew, flags: tally(rolled.flags, { [won ? 'fightsWon' : 'fightsLost']: 1 }) };
  }
  const settled = settleRaid(lessCitizens(now, fell), rules, won);
  const { colony } = settled.campaign;
  const told = withNews(colony, { day: colony.day, kind: 'raid', won, landed: landing.landed.length, fell, food: settled.taken?.food ?? 0, materials: settled.taken?.materials ?? 0, part: settled.taken?.part ?? null });
  const flags = tally(settled.campaign.flags, { raidsFoughtOut: 1, [won ? 'raidsFoughtOutWon' : 'raidsFoughtOutLost']: 1 });
  return { campaign: { ...settled.campaign, colony: told, flags }, won, fell, landing };
}

// The campaign as the colony whose raid fight is on lives it (M38e): at
// another colony, as thereAt has it, with those who fight there; else the
// campaign as it is. For what the fight's words say of that colony.
export function raidCampaign(campaign) {
  const id = campaign.fight?.colony;
  return id === undefined ? campaign : thereAt(backFrom(campaign, id), id);
}

// What a lost raid takes: { food, materials } (half of each, rounded
// down: the colony's food, away.js colonyFood) and part (the dearest in
// the hold, by its cost, then its id, or null with the hold empty; none
// while the ship is away on a voyage, M38d).
export function raidTake(campaign, rules) {
  const held = campaign.colony.voyage ? [] : Object.keys(campaign.parts).sort((a, b) => (rules.modules.get(b)?.cost ?? 0) - (rules.modules.get(a)?.cost ?? 0) || a.localeCompare(b));
  return { food: Math.floor(colonyFood(campaign) / 2), materials: Math.floor(campaign.colony.materials / 2), part: held[0] ?? null };
}

// After a raid fight at the colony, once it is won or lost (campaign.js
// endFight: wounds kept, the fights counted): settled as settleRaid has
// it, and while the ship is away on a voyage its side back in play (M38d,
// away.js backAboard); at another colony (M38e), those there back at it
// and the side parked there back in play (colonies.js backFrom), settled
// there. From M38f the colonists who fell there are gone. Any other fight
// is left as it is.
export function endColonyRaid(campaign, rules) {
  const { fight } = campaign;
  if (!fight?.raid || !campaign.colony) return campaign;
  const after = endFight(campaign, rules);
  if (after === campaign) return campaign;
  const won = fight.battle.winner === 'crew';
  // The colonists who fell are gone (M38f).
  const fell = fallenColonists(fight.battle);
  if (fight.colony === undefined) return backAboard(settleRaid(lessCitizens(after, fell), rules, won).campaign);
  const back = backFrom(after, fight.colony);
  return thereFrom(back, settleRaid(lessCitizens(thereAt(back, fight.colony), fell), rules, won).campaign);
}

// A raid over, won or lost: heat down to heatAfterRaid, the raid gone, and
// lost, what the raiders take (raidTake); the reckoning's (M56) its ending
// or its next coming (reckoning.js reckoningSettled). The heat is the colony's: the
// campaign's with the ship landed there, else the colony's own, the ship's
// left alone (M38e). Returns { campaign, taken (or null when won) }.
export function settleRaid(campaign, rules, won) {
  if (campaign.colony.raid?.reckoning) return settleRaidAs(reckoningSettled(campaign, rules, won, campaign.colony.day), rules, won);
  return settleRaidAs(campaign, rules, won);
}

function settleRaidAs(campaign, rules, won) {
  const taken = won ? null : raidTake(campaign, rules);
  const parts = { ...campaign.parts };
  if (taken?.part) {
    parts[taken.part] -= 1;
    if (!parts[taken.part]) delete parts[taken.part];
  }
  const away = campaign.colony.voyage ? { [won ? 'raidsWonAway' : 'raidsLostAway']: 1 } : {};
  const flags = tally(campaign.flags, {
    [won ? 'colonyRaidsWon' : 'colonyRaidsLost']: 1,
    raidFoodTaken: taken?.food ?? 0,
    raidMaterialsTaken: taken?.materials ?? 0,
    raidPartsTaken: taken?.part ? 1 : 0,
    ...away,
  });
  const fed = withColonyFood(campaign, colonyFood(campaign) - (taken?.food ?? 0));
  const { heatAfterRaid } = rules.balance;
  const ship = !campaign.colony.voyage;
  return {
    taken,
    campaign: {
      ...fed,
      heat: ship ? Math.min(campaign.heat, heatAfterRaid) : campaign.heat,
      parts,
      flags,
      colony: { ...fed.colony, raid: null, materials: campaign.colony.materials - (taken?.materials ?? 0), heat: ship ? campaign.colony.heat : Math.min(campaign.colony.heat, heatAfterRaid) },
    },
  };
}
