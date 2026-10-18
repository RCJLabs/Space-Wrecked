// Voyages from the colony (ROADMAP §2, M38d): from act 3 the run goes on.
// At the colony, with the ship home, no trip under way and no lander down,
// Fly out takes the crew picked aboard, as many as the ship's berths and
// air hold (campaign.js shipChecklist), one or more; the rest stay home.
// The stores split (away.js): the ship's holds take their fill of the food
// (travel.js supplyCapacity, for those aboard), the colony keeps the rest
// up to its storehouses' room (colony.js storesOf, the ship away), and what
// neither holds spoils. The materials stay where they lie, all of them
// (M38d's fix), though while the ship is away the mines add to them only
// up to the storehouses' room (days.js). Credits, the parts on hand and the
// spare weapons go with the ship. Then
// the ship jumps into a system never charted (travel.js enterBeyond): a
// jump's supplies and heat, and the hunters may wait at its way in, as
// leaving a sector. Out there everything of act 2's run works for those
// aboard, and each jump, survey or day's rest passes a day at the colony
// (days.js voyageDay), where a raid's lander can come down and hold the
// ship until those at home face it (raids.js). Fly home goes from anywhere
// on the run while nothing holds the ship: a day at the colony and a jump's
// supplies for those aboard for each system out, with one jump's heat. A
// lander coming down on the way stops the flight that day, as a trip's leg
// (expeditions.js), and Fly home flies on once it is faced. Landed, the
// crew is one again in its order and the stores one store, up to their
// room. Pure: every roll is the campaign's.
//
// The voyage (colony.voyage, null while the ship is home):
//   out      the systems out from the colony, 1 up
//   homing   the days a flight home still has to fly, once a lander stopped
//            it; else null
//   home     { crew, food }: those at home and the colony's food, while
//            those aboard and the ship's holds are the campaign's crew and
//            supplies
//   aboard   { crew, supplies }: in home's place while those at home fight
//            a raid (away.js homeFront)
// The flags count the voyages, the systems entered past the colony's
// (travel.js), the landings home, and the food the split and the landing
// spoil.
import { atColony } from './acts.js';
import { voyageOf } from './away.js';
import { shipChecklist } from './campaign.js';
import { colonyStats, storesOf } from './colony.js';
import { withPlaces } from './expeditions.js';
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { downText, flightHome, raidDown } from './raids.js';
import { enterBeyond, holdOf, homewardDay, jumpSupplies, onTheRun, onwardCosts, supplyCapacity } from './travel.js';

// What flying out with crew (ids) would come to: { ok, error (why the ship
// can't fly, or null), crew (the ids aboard, in the crew's order), home
// (the ids staying), rough (those of them with no bed and air at the
// colony, who won't rest while the ship is away: colony.js colonyStats),
// checks (the flight checklist with them aboard), food ({ now, ship (what
// the holds take), colony (what the colony keeps), room (its
// storehouses'), spoils }), materials ({ now, dug (what the mines dig a
// day on the colony's own power), room (the most the mines fill them to
// while the ship is away: the storehouses') }), jump (the jump into the
// next system: travel.js onwardCosts, kind 'beyond') }. With
// nothing to plan (away from the colony, the ship away, a lander down, no
// crew picked): { ok: false, error } alone.
export function voyagePlan(campaign, rules, crew) {
  if (!atColony(campaign, rules) || !campaign.run) return { ok: false, error: 'Voyages leave from the colony.' };
  if (campaign.colony.trip) return { ok: false, error: 'The ship is away already.' };
  if (raidDown(campaign)) return { ok: false, error: downText(campaign, rules) };
  const picked = new Set(Array.isArray(crew) ? crew : []);
  if (!picked.size) return { ok: false, error: 'Pick who goes: one or more.' };
  if (picked.size !== crew.length || ![...picked].every((id) => campaign.crew.some((member) => member.id === id))) return { ok: false, error: 'Pick who goes from the crew.' };
  const aboard = campaign.crew.filter((member) => picked.has(member.id));
  const home = campaign.crew.filter((member) => !picked.has(member.id));
  const checks = shipChecklist(campaign, rules, aboard.length);
  const failing = checks.find((line) => line.ok !== true);
  const food = campaign.supplies;
  const ship = Math.min(food, supplyCapacity(campaign.ship, rules, aboard));
  const split = (kept) => ({ ...campaign, crew: aboard, supplies: ship, colony: { ...campaign.colony, voyage: { out: 0, homing: null, home: { crew: home, food: kept } } } });
  const room = storesOf(split(0), rules).colony;
  const kept = Math.min(food - ship, room);
  const stats = colonyStats(split(kept), rules);
  return {
    ok: !failing,
    error: failing ? `The ship can't fly with ${aboard.length} aboard: ${lowerFirst(failing.text)}.` : null,
    crew: aboard.map((member) => member.id),
    home: home.map((member) => member.id),
    rough: stats.rough,
    checks,
    food: { now: food, ship, colony: kept, room, spoils: food - ship - kept },
    materials: { now: campaign.colony.materials, dug: stats.made.materials, room },
    jump: { kind: 'beyond', ...onwardCosts(split(kept), rules) },
  };
}

// Flies out with crew (see voyagePlan): the crew and the stores split, and
// the ship jumps into the next system, a day passing at the colony on the
// way. Returns { ok: true, plan, campaign, hunt (hunt.js rollHunt's), day
// (the colony's: days.js voyageDay) } or { ok: false, error }.
export function voyageOut(campaign, rules, crew) {
  const plan = voyagePlan(campaign, rules, crew);
  if (!plan.ok) return { ok: false, error: plan.error };
  const picked = new Set(plan.crew);
  const home = { crew: campaign.crew.filter((member) => !picked.has(member.id)), food: plan.food.colony };
  const flags = tally(campaign.flags, { voyages: 1, foodLost: plan.food.spoils });
  const split = {
    ...campaign,
    crew: campaign.crew.filter((member) => picked.has(member.id)),
    supplies: plan.food.ship,
    flags,
    colony: { ...campaign.colony, voyage: { out: 0, homing: null, home } },
  };
  const on = enterBeyond(split, rules, plan.jump, 1);
  return { ok: true, plan, campaign: on.campaign, hunt: on.hunt, day: on.day };
}

// What flying home would come to: { ok: true, days (the flight's: a day
// for each system out, or what a stopped flight has left), heat (its
// change: one jump's, none flying on), eats (the supplies those aboard eat
// on the way), food ({ ship: [now, landing], colony: [now, landing], room
// (the stores', landed), lost }: as the days would leave them), hungry
// (the days those aboard would go hungry), stopped (true flying on after a
// lander stopped the flight) }, or { ok: false, error }: with the ship
// home, something holding it, or a lander down.
export function voyageHomePlan(campaign, rules) {
  const voyage = voyageOf(campaign);
  if (!voyage?.home || campaign.place !== 'hub') return { ok: false, error: 'The ship is home.' };
  if (raidDown(campaign)) return { ok: false, error: downText(campaign, rules) };
  if (!voyage.homing) {
    if (!onTheRun(campaign, rules)) return { ok: false, error: 'The ship flies home from the run.' };
    const held = holdOf(campaign, rules);
    if (held) return { ok: false, error: held };
  }
  const days = flightHome(campaign);
  const heat = voyage.homing ? 0 : withHeat(campaign.heat, rules.balance.jumpHeat) - campaign.heat;
  const ahead = flyHome({ ...campaign, heat: campaign.heat + heat }, rules, days, { stop: false });
  const landed = land(ahead.campaign, rules);
  return {
    ok: true,
    days,
    heat,
    eats: ahead.eats,
    food: { ship: [campaign.supplies, ahead.campaign.supplies], colony: [voyage.home.food, voyageOf(ahead.campaign).home.food], room: landed.room, lost: landed.lost },
    hungry: ahead.hungry,
    stopped: Boolean(voyage.homing),
  };
}

// Flies home (see voyageHomePlan): the flight's days pass one by one, each
// a jump's supplies for those aboard and a day at the colony, stopping on a
// day a raid's lander comes down there with days still to fly (the
// voyage's homing keeps them); else the ship lands. Returns { ok: true,
// plan, campaign, days (each colony day's, days.js passDay), stopped (true
// when a lander stopped the flight), landed (true once home) } or { ok:
// false, error }.
export function voyageHome(campaign, rules) {
  const plan = voyageHomePlan(campaign, rules);
  if (!plan.ok) return plan;
  const voyage = voyageOf(campaign);
  const going = { ...campaign, heat: campaign.heat + plan.heat, colony: { ...campaign.colony, voyage: { ...voyage, homing: null } } };
  const flown = flyHome(going, rules, plan.days);
  const left = plan.days - flown.days.length;
  const now = flown.campaign;
  if (left > 0) {
    const stopped = { ...now, colony: { ...now.colony, voyage: { ...voyageOf(now), homing: left } } };
    return { ok: true, plan, campaign: stopped, days: flown.days, stopped: true, landed: false };
  }
  return { ok: true, plan, campaign: land(now, rules).campaign, days: flown.days, stopped: false, landed: true };
}

// The flight home's n days (travel.js homewardDay), stopping, unless stop
// is false (a plan's look ahead), on a day a raid's lander is down before
// the last: { campaign, days (each colony day's), eats, hungry }.
function flyHome(campaign, rules, n, { stop = true } = {}) {
  let now = campaign;
  const days = [];
  let eats = 0;
  let hungry = 0;
  for (let d = 0; d < n; d++) {
    if (stop && raidDown(now)) break;
    const need = jumpSupplies(now, rules);
    eats += need;
    if (now.supplies < need) hungry += 1;
    const flown = homewardDay(now, rules);
    now = flown.campaign;
    if (flown.day) days.push(flown.day);
  }
  return { campaign: now, days, eats, hungry };
}

// The ship landed home from its voyage: the crew one again in its order
// (by id, the order they signed on in), the ship's holds and the colony's
// food one store up to the stores' room, the rest spoiled, and the places
// within reach rolled if there are none. { campaign, room, lost }.
function land(campaign, rules) {
  const { home } = voyageOf(campaign);
  const crew = [...campaign.crew, ...home.crew].sort((a, b) => a.id - b.id);
  const together = { ...campaign, crew, colony: { ...campaign.colony, voyage: null } };
  const room = storesOf(together, rules).total;
  const food = campaign.supplies + home.food;
  const kept = Math.min(food, room);
  const flags = tally(campaign.flags, { voyagesHome: 1, foodLost: food - kept });
  return { campaign: withPlaces({ ...together, supplies: kept, flags }, rules), room, lost: food - kept };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
