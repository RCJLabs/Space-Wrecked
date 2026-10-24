// The colony's days (ROADMAP §2, M27): act 3 counts days from the landing,
// day 1 first, and Next day passes one. From M28 a trip's days pass the
// same way, one by one, with the ship away (expeditions.js). A day, in
// order:
//   - each farm grows its food and each mine digs its materials, by the
//     world's numbers (colony.js yieldOf);
//   - the crew eats what a jump eats (travel.js jumpSupplies), the squad
//     away included: food is one store, the run's supplies;
//   - each of the wounded heals where they are. At home, a fed crew rests,
//     healing what a day's regroup heals (regroupHp), and a powered
//     infirmary heals its own on top, a medic at home adding their colony
//     effect (edges.js; before M32, their med bay's on the run). While the ship is away, whoever
//     is home without a bed and air at the colony doesn't rest, since the
//     ship isn't there to sleep aboard; the infirmary still heals them. The
//     squad aboard heals what the ship's med bay heals in a jump. Short of
//     food, everyone goes hungry as on a hungry jump, losing hungerHp hit
//     points, never the last, and nobody rests; the infirmary and the med
//     bay still heal;
//   - food and materials are each kept up to the colony's stores (colony.js
//     storesOf): what is past them is lost. While the ship is away on a
//     voyage (M38d's fix), materials past the storehouses' room keep where
//     they lie, though the mines add to them only up to it;
//   - the day count rises;
//   - from M29, with no raid coming, the pursuer may find the colony, at
//     the day's odds, and heat falls (raids.js raidDayEnd).
// While the ship is away the colony runs on its own power (colony.js
// colonyStats). Giving, building, moving and taking down take no time.
// While a raid's lander is down (M29) no day passes until it is faced. From
// M38d, while the ship is away on a voyage (voyage.js), each jump, survey or
// day's rest on the run passes a day (voyageDay), run as a trip's for those
// at home and the colony's own food (away.js). From M38e every day that
// passes passes at every colony (colonies.js): once the colony the ship is
// at or flew from has lived it, each other lives it as one the ship is away
// from, in the order settled, with whoever is there and its own food and
// heat (othersDay). The flags count the days, the hungry ones, the food
// grown, the materials dug, what the stores couldn't keep, and the hit
// points the days healed and hunger took, at every colony; and a voyage's
// days and its hungry ones, and the others'. The only roll is the
// pursuer's, the campaign's. Pure.
import { atColony } from './acts.js';
import { backAboard, homeFront } from './away.js';
import { thereAt, thereFrom, withNews } from './colonies.js';
import { citizenEats, colonyStats, homeCrew, storesOf } from './colony.js';
import { colonyEdge } from './edges.js';
import { tally } from './flags.js';
import { healCrew, healRate } from './medbay.js';
import { downText, foundOdds, raidDayEnd, raidDown } from './raids.js';
import { traderAfter } from './traders.js';
import { jumpSupplies } from './travel.js';

// More days than a colony will see: a guard on what a save can hold.
export const MAX_DAYS = 99999;

// What Next day would come to (see planDay), at home: { ok: false, error }
// away from the colony, or while the ship is away and its days pass as it
// flies.
export function dayPlan(campaign, rules) {
  const away = 'The ship is away: the days pass as it flies.';
  if (campaign.colony?.voyage) return { ok: false, error: away };
  if (!atColony(campaign, rules)) return { ok: false, error: 'Days pass at the colony.' };
  if (campaign.colony.trip) return { ok: false, error: away };
  if (raidDown(campaign)) return { ok: false, error: downText(campaign, rules) };
  return planDay(campaign, rules);
}

// What the next day would come to, the ship at home or away: { ok: true,
// day (the day it is now), made ({ food, materials }: what the farms and
// mines make), eats (the food the crew eats), fed (whether the food covers
// it), heals ({ [id]: what each crew member would heal, wounded or not }),
// hunger (what each loses going hungry, 0 when fed), rough (the ids at home
// who don't rest for want of a bed and air, while the ship is away), food
// and materials ([now, after the day]), lost ({ food, materials }: what
// the stores can't keep), stores (what they keep of each), found (the
// odds, percent, of the pursuer finding the colony at the day's end, M29),
// citizens (M38f: citizensDay's) }, or { ok: false, error }. While the ship
// is away on a voyage (M38d) it is the day of those at home, on the
// colony's food, and the materials past the stores keep (see the top of
// the file). From M38f the citizens eat too.
export function planDay(campaign, rules) {
  if (campaign.colony.voyage?.home) return planDay(homeFront(campaign), rules);
  const { day, materials, trip } = campaign.colony;
  if (day >= MAX_DAYS) return { ok: false, error: 'The colony has counted all the days it can.' };
  const stats = colonyStats(campaign, rules);
  const stores = storesOf(campaign, rules, stats).total;
  const { made } = stats;
  const eats = jumpSupplies(campaign, rules) + citizenEats(campaign.colony, rules);
  const harvest = campaign.supplies + made.food;
  const fed = harvest >= eats;
  const { regroupHp, hungerHp } = rules.balance;
  const away = new Set(trip?.squad ?? []);
  const home = campaign.crew.filter((member) => !away.has(member.id));
  const squad = campaign.crew.filter((member) => away.has(member.id));
  const infirmary = stats.infirmary ? stats.infirmary + colonyEdge(home, rules, 'heal') : 0;
  const aboard = squad.length ? healRate({ ...campaign, crew: squad }, rules) : 0;
  const rough = new Set(stats.rough);
  const rest = fed ? regroupHp : 0;
  const heals = Object.fromEntries(campaign.crew.map((member) => [member.id, away.has(member.id) ? aboard : rough.has(member.id) ? infirmary : rest + infirmary]));
  const food = Math.max(0, harvest - eats);
  const dug = materials + made.materials;
  const keeps = campaign.colony.voyage ? Math.max(stores, materials) : stores;
  return {
    ok: true,
    day,
    made,
    eats,
    fed,
    heals,
    hunger: fed ? 0 : hungerHp,
    rough: stats.rough,
    food: [campaign.supplies, Math.min(food, stores)],
    materials: [materials, Math.min(dug, keeps)],
    lost: { food: Math.max(0, food - stores), materials: Math.max(0, dug - keeps) },
    stores,
    found: foundOdds(campaign, rules),
    citizens: citizensDay(campaign, rules, stats, fed),
  };
}

// What the day comes to for the colony's citizens (M38f): { now, after,
// growth ([now, after]: the days it has been fit to grow), why (why none
// grows: 'hungry', 'nobody', 'room' (no bed and air free for one more) or
// 'dark' (a building unpowered); null when the day counts toward the next)
// }. Fit, a day counts; every citizenDays such days, one more citizen. A
// hungry day, one leaves.
export function citizensDay(campaign, rules, stats, fed) {
  const { colony } = campaign;
  const now = colony.citizens ?? 0;
  const growth = colony.growth ?? 0;
  const days = rules.balance.citizenDays ?? 0;
  const why = !fed ? 'hungry' : !now && !homeCrew(campaign).length ? 'nobody' : stats.citizens.free <= 0 ? 'room' : stats.buildings.some((b) => !b.powered) ? 'dark' : null;
  if (why === 'hungry') return { now, after: Math.max(0, now - 1), growth: [growth, growth], why };
  if (why || !days) return { now, after: now, growth: [growth, growth], why };
  return growth + 1 >= days ? { now, after: now + 1, growth: [growth, 0], why } : { now, after: now, growth: [growth, growth + 1], why };
}

// Passes Next day (see dayPlan). Returns { ok: true, plan, campaign, healed
// (hit points healed in all), hurt (hit points hunger took in all), found
// (the raid the pursuer found at the day's end, or null), roll (its roll,
// or null when there were no odds), fought (a raid fought out where the
// ship isn't, M38f: raids.js fightAway's, or null) } or { ok: false, error }.
export function nextDay(campaign, rules) {
  const plan = dayPlan(campaign, rules);
  return plan.ok ? passPlanned(campaign, rules, plan) : plan;
}

// Passes the next day, the ship at home or away (planDay): what a trip's
// days do (expeditions.js), and a voyage's (voyageDay). Returns as nextDay
// does.
export function passDay(campaign, rules) {
  if (campaign.colony.voyage?.home) {
    const day = passDay(homeFront(campaign), rules);
    if (!day.ok) return day;
    const flags = tally(day.campaign.flags, { voyageDays: 1, voyageHungryDays: day.plan.fed ? 0 : 1 });
    return { ...day, campaign: backAboard({ ...day.campaign, flags }) };
  }
  const plan = planDay(campaign, rules);
  return plan.ok ? passPlanned(campaign, rules, plan) : plan;
}

// A day at the colony while the ship is away on a voyage (M38d): each jump,
// survey or day's rest on the run passes one (travel.js, survey.js,
// regroup.js), as passDay has it. Returns { campaign, day (passDay's, or
// null with the ship home or no day to pass) }.
export function voyageDay(campaign, rules) {
  if (!campaign.colony?.voyage?.home) return { campaign, day: null };
  const day = passDay(campaign, rules);
  return day.ok ? { campaign: day.campaign, day } : { campaign, day: null };
}

function passPlanned(campaign, rules, plan) {
  let hurt = 0;
  let healed = 0;
  const crew = campaign.crew.map((member) => {
    const hp = Math.max(1, member.hp - plan.hunger);
    hurt += member.hp - hp;
    const heal = healCrew([hp === member.hp ? member : { ...member, hp }], plan.heals[member.id] ?? 0, rules);
    healed += heal.healed;
    return heal.crew[0];
  });
  const flags = tally(campaign.flags, {
    colonyDays: 1,
    hungryDays: plan.fed ? 0 : 1,
    foodGrown: plan.made.food,
    materialsDug: plan.made.materials,
    foodLost: plan.lost.food,
    materialsLost: plan.lost.materials,
    colonyHealed: healed,
    hungerHurt: hurt,
  });
  // The citizens (M38f): one more or one fewer, and while the ship isn't
  // there, the news says so; with the ship there, a day passed lets the
  // news of its time away go, read.
  const { citizens } = plan;
  const grown = { ...campaign.colony, day: plan.day + 1, materials: plan.materials[1], citizens: citizens.after, growth: citizens.growth[1] };
  const kind = citizens.after > citizens.now ? 'grew' : citizens.after < citizens.now ? 'left' : null;
  const away = Boolean(campaign.colony.voyage || campaign.colony.trip);
  // A side's trader calls (M53, traders.js) at the colony the ship is
  // landed at, for the day that begins.
  const traded = { ...grown, trader: away ? null : traderAfter(campaign, rules, plan.day + 1) };
  const colony = !away ? { ...traded, news: [] } : kind ? withNews(traded, { day: plan.day, kind, citizens: citizens.after }) : traded;
  const counted = kind ? tally(flags, { [kind === 'grew' ? 'citizensGrown' : 'citizensLeft']: 1 }) : flags;
  const changed = hurt || healed ? crew : campaign.crew;
  const ended = raidDayEnd(campaign, { ...campaign, supplies: plan.food[1], crew: changed, colony, flags: counted }, rules);
  return { ok: true, plan, campaign: othersDay(ended.campaign, rules), healed, hurt, found: ended.found, roll: ended.roll, fought: ended.fought };
}

// The day at each other colony (M38e), in the order settled, once the
// colony the ship is at or flew from has lived it: as a day there with the
// ship away (thereAt), its rolls the campaign's. A colony with a day it
// can't pass (at the most days, or its lander down) waits.
function othersDay(campaign, rules) {
  let now = campaign;
  for (const { id } of campaign.colonies ?? []) {
    const there = thereAt(now, id);
    if (raidDown(there)) continue;
    const plan = planDay(there, rules);
    if (!plan.ok) continue;
    const day = passPlanned(there, rules, plan);
    // No trader calls where the ship isn't (M53).
    const quiet = { ...day.campaign, colony: { ...day.campaign.colony, trader: null } };
    now = thereFrom(now, { ...quiet, flags: tally(day.campaign.flags, { othersDays: 1, othersHungryDays: plan.fed ? 0 : 1, othersRaidsFound: day.found ? 1 : 0 }) });
  }
  return now;
}
