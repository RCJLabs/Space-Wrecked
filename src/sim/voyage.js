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
// supplies for those aboard for each system out (less what hydroponics grow,
// M39), with one jump's heat (less the baffles'). A
// lander coming down on the way stops the flight that day, as a trip's leg
// (expeditions.js), and Fly home flies on once it is faced. Landed, the
// crew is one again in its order and the stores one store, up to their
// room, and the ship's heat the greater of its own and the colony's (M38e).
// From M38e the ship flies straight to any colony too (Fly to,
// colonies.js): from anywhere on a voyage while nothing holds it, or from
// the colony screen with the crew picked as for Fly out (flyFrom). A day
// and a jump's supplies for each system between, one at least, and one
// jump's heat; no hunters. A lander coming down at any colony on the way
// stops the flight, and Fly on finishes it; stopped on a flight from the
// colony screen, the ship waits in the system it has reached (travel.js
// waitIn). Landed at another colony, the one flown from keeps whoever was
// home and its food, and the ship's crew and stores join those there.
// Pure: every roll is the campaign's.
//
// The voyage (colony.voyage, null while the ship is home):
//   out      the systems out from the colony, 1 up
//   homing   the days a flight still has to fly, once a lander stopped it;
//            else null
//   home     { crew, food }: those at home and the colony's food, while
//            those aboard and the ship's holds are the campaign's crew and
//            supplies
//   aboard   { crew, supplies }: in home's place while those at home fight
//            a raid (away.js homeFront)
//   at       where the ship is along the line of systems (M38e,
//            colonies.js): the colony's place and out, and moving a system
//            a day of a flight
//   to       the colony a stopped flight is for, by number, or null for
//            the one flown from (M38e)
// The flags count the voyages, the systems entered past the colony's
// (travel.js), the landings home, the flights to another colony and the
// landings there, and the food the split and the landing spoil.
import { atColony } from './acts.js';
import { voyageOf } from './away.js';
import { shipChecklist } from './campaign.js';
import { colonyById, reachOf } from './colonies.js';
import { colonyStats, storesOf } from './colony.js';
import { withPlaces } from './expeditions.js';
import { tally } from './flags.js';
import { withHeat } from './heat.js';
import { downText, raidDown } from './raids.js';
import { LOW_PROFILE } from './pressure.js';
import { enterBeyond, growsOf, holdOf, homewardDay, jumpHeatOf, jumpSupplies, onTheRun, onwardCosts, supplyCapacity, waitIn } from './travel.js';

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
  if (campaign.colony?.lowProfile) return { ok: false, error: LOW_PROFILE };
  const picked = new Set(Array.isArray(crew) ? crew : []);
  if (!picked.size) return { ok: false, error: 'Pick who goes: one or more.' };
  if (picked.size !== crew.length || ![...picked].every((id) => campaign.crew.some((member) => member.id === id))) return { ok: false, error: 'Pick who goes from the crew.' };
  const aboard = campaign.crew.filter((member) => picked.has(member.id));
  const home = campaign.crew.filter((member) => !picked.has(member.id));
  const checks = shipChecklist(campaign, rules, aboard.length);
  const failing = checks.find((line) => line.ok !== true);
  const food = campaign.supplies;
  const ship = Math.min(food, supplyCapacity(campaign.ship, rules, aboard));
  const split = (kept) => ({ ...campaign, crew: aboard, supplies: ship, colony: { ...campaign.colony, voyage: setOut({ crew: home, food: kept }, campaign.colony) } });
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
    jump: { kind: 'beyond', ...onwardCosts(split(kept), rules, true) },
  };
}

// The voyage as the ship sets out from colony with those at home: no
// system out yet, at the colony's place, flying to no other.
function setOut(home, colony, to = null) {
  return { out: 0, homing: null, home, at: colony.at, to };
}

// The ship's side flying out with crew, as voyagePlan's plan splits it:
// those picked aboard with the holds' food, those at home with the
// colony's, the colony keeping the ship's heat as its trail (M38e) and its
// news, read while the ship was there, let go (M38f). to is the colony a
// flight from the colony screen is for (flyFrom), else null.
function splitOut(campaign, plan, counts, to = null) {
  const picked = new Set(plan.crew);
  const home = { crew: campaign.crew.filter((member) => !picked.has(member.id)), food: plan.food.colony };
  return {
    ...campaign,
    crew: campaign.crew.filter((member) => picked.has(member.id)),
    supplies: plan.food.ship,
    flags: tally(campaign.flags, { ...counts, foodLost: plan.food.spoils }),
    colony: { ...campaign.colony, heat: campaign.heat, voyage: setOut(home, campaign.colony, to), news: [] },
  };
}

// Flies out with crew (see voyagePlan): the crew and the stores split, and
// the ship jumps into the next system, a day passing at the colony on the
// way. Returns { ok: true, plan, campaign, hunt (hunt.js rollHunt's), day
// (the colony's: days.js voyageDay) } or { ok: false, error }.
export function voyageOut(campaign, rules, crew) {
  const plan = voyagePlan(campaign, rules, crew);
  if (!plan.ok) return { ok: false, error: plan.error };
  const on = enterBeyond(splitOut(campaign, plan, { voyages: 1 }), rules, plan.jump, 1);
  return { ok: true, plan, campaign: on.campaign, hunt: on.hunt, day: on.day };
}

// What flying from the voyage to the colony numbered id would come to (M38e:
// to the one flown from, Fly home; to another, Fly to): { ok: true, to
// (its number), days (the flight's: a day for each system between, one at
// least, or what a stopped flight has left), heat (its change: one jump's,
// none flying on), eats (the supplies those aboard eat on the way), food ({
// ship: [now, landing], colony: [now, landing] (the food there), room (the
// stores', landed), lost }: as the days would leave them), hungry (the
// days those aboard would go hungry), stopped (true flying on after a
// lander stopped the flight) }, or { ok: false, error }: with the ship
// home, something holding it, a lander down, or a stopped flight for
// another colony.
export function flightPlan(campaign, rules, id) {
  const voyage = voyageOf(campaign);
  if (!voyage?.home || campaign.place !== 'hub') return { ok: false, error: 'The ship is home.' };
  const target = colonyById(campaign, id);
  if (!target) return { ok: false, error: 'The crew has no colony there.' };
  if (raidDown(campaign)) return { ok: false, error: downText(campaign, rules) };
  if (voyage.homing) {
    const bound = colonyById(campaign, voyage.to ?? campaign.colony.id);
    if (bound !== target) return { ok: false, error: `The ship is on its way to ${bound.world.name}: fly on first.` };
  } else {
    if (!onTheRun(campaign, rules)) return { ok: false, error: 'The ship flies home from the run.' };
    const held = holdOf(campaign, rules);
    if (held) return { ok: false, error: held };
  }
  const days = voyage.homing ?? reachOf(campaign, target);
  const heat = voyage.homing ? 0 : withHeat(campaign.heat, jumpHeatOf(campaign, rules)) - campaign.heat;
  const ahead = flyDays({ ...campaign, heat: campaign.heat + heat }, rules, target.at, days, { stop: false });
  const landed = landAt(ahead.campaign, rules, target.id);
  return {
    ok: true,
    to: target.id,
    days,
    heat,
    eats: ahead.eats,
    food: { ship: [campaign.supplies, ahead.campaign.supplies], colony: [foodThere(campaign, target.id), foodThere(ahead.campaign, target.id)], room: landed.room, lost: landed.lost },
    hungry: ahead.hungry,
    stopped: Boolean(voyage.homing),
  };
}

// Flies from the voyage to the colony numbered id (see flightPlan): the
// flight's days pass one by one, the ship a system nearer each, a jump's
// supplies for those aboard and a day at every colony, stopping on a day a
// raid's lander comes down at any with days still to fly (the voyage's
// homing keeps them, and to the colony); else the ship lands there.
// Returns { ok: true, plan, campaign, days (each colony day's, days.js
// passDay), stopped (true when a lander stopped the flight), landed (true
// once there) } or { ok: false, error }.
export function flyTo(campaign, rules, id) {
  const plan = flightPlan(campaign, rules, id);
  if (!plan.ok) return plan;
  const voyage = voyageOf(campaign);
  const counts = voyage.homing || plan.to === campaign.colony.id ? {} : { flights: 1 };
  const going = { ...campaign, heat: campaign.heat + plan.heat, flags: tally(campaign.flags, counts), colony: { ...campaign.colony, voyage: { ...voyage, homing: null } } };
  return flown(going, rules, plan, colonyById(campaign, plan.to));
}

// What flying home or on would come to (Fly home, M38d): flightPlan's to the
// colony flown from, or to the one a stopped flight is for.
export function voyageHomePlan(campaign, rules) {
  return flightPlan(campaign, rules, boundFor(campaign));
}

// Flies home, or on with a stopped flight (see flyTo).
export function voyageHome(campaign, rules) {
  return flyTo(campaign, rules, boundFor(campaign));
}

// What flying from the colony screen to the colony numbered id with crew
// (ids) would come to (Fly to, M38e): Fly out's split (voyagePlan's), and
// the flight: { ...voyagePlan's, to (its number), days (a day for each
// system between, one at least), heat (one jump's) }, or { ok: false,
// error }.
export function flightFromPlan(campaign, rules, id, crew) {
  const plan = voyagePlan(campaign, rules, crew);
  if (!plan.crew) return plan;
  const target = colonyById(campaign, id);
  if (!target || target === campaign.colony) return { ok: false, error: 'Fly to another of the crew\'s colonies.' };
  const heat = withHeat(campaign.heat, jumpHeatOf(campaign, rules)) - campaign.heat;
  return { ...plan, to: target.id, days: reachOf(campaign, target), heat };
}

// Flies from the colony screen to the colony numbered id with crew (see
// flightFromPlan): the crew and the stores split as for Fly out, and the
// ship flies as flyTo does; stopped by a lander, it waits in the system it
// has reached. Returns flyTo's, or { ok: false, error }.
export function flyFrom(campaign, rules, id, crew) {
  const plan = flightFromPlan(campaign, rules, id, crew);
  if (!plan.ok) return { ok: false, error: plan.error };
  const split = splitOut(campaign, plan, { flights: 1 }, plan.to);
  return flown({ ...split, heat: campaign.heat + plan.heat }, rules, plan, colonyById(campaign, plan.to));
}

// The colony a flight from the voyage is for: the one a stopped flight is
// for, else the one flown from. Null with the ship home.
function boundFor(campaign) {
  const voyage = voyageOf(campaign);
  if (!voyage) return null;
  return voyage.homing ? voyage.to ?? campaign.colony.id : campaign.colony.id;
}

// The flight under way to target with plan's days: flown day by day, and
// stopped with days left or landed.
function flown(going, rules, plan, target) {
  const flight = flyDays(going, rules, target.at, plan.days);
  const left = plan.days - flight.flown;
  const now = flight.campaign;
  if (left > 0) {
    const stopped = { ...now, colony: { ...now.colony, voyage: { ...voyageOf(now), homing: left, to: target.id === now.colony.id ? null : target.id } } };
    // From the colony screen there was no system to wait in: the ship waits
    // in the one it has reached, so many systems out (travel.js waitIn).
    const waiting = voyageOf(going).out ? stopped : waitIn(stopped, rules);
    return { ok: true, plan, campaign: waiting, days: flight.days, stopped: true, landed: false };
  }
  return { ok: true, plan, campaign: landAt(now, rules, target.id).campaign, days: flight.days, stopped: false, landed: true };
}

// A flight's n days toward the place to along the line (travel.js
// homewardDay), the ship moving a system nearer each, stopping, unless stop
// is false (a plan's look ahead), on a day a raid's lander is down at any
// colony before the last: { campaign, days (each colony day's), flown (the
// days flown), eats, hungry }.
function flyDays(campaign, rules, to, n, { stop = true } = {}) {
  let now = campaign;
  const days = [];
  let eats = 0;
  let hungry = 0;
  let flown = 0;
  for (let d = 0; d < n; d++) {
    if (stop && raidDown(now)) break;
    const need = jumpSupplies(now, rules);
    eats += need;
    if (now.supplies + growsOf(now, rules) < need) hungry += 1;
    const voyage = voyageOf(now);
    const nearer = { ...now, colony: { ...now.colony, voyage: { ...voyage, at: voyage.at + Math.sign(to - voyage.at) } } };
    const day = homewardDay(nearer, rules);
    now = day.campaign;
    flown += 1;
    if (day.day) days.push(day.day);
  }
  return { campaign: now, days, flown, eats, hungry };
}

// The food at the colony numbered id while the ship is away: the one flown
// from keeps it in the voyage, the others their own.
function foodThere(campaign, id) {
  return id === campaign.colony.id ? voyageOf(campaign).home.food : colonyById(campaign, id).keep.food;
}

// The ship landed at the colony numbered id from its voyage: home (land),
// or another (M38e), where the colony flown from joins the others with
// those at home and its food, and the one landed at leaves them, its crew
// and food joining the ship's. { campaign, room, lost }.
function landAt(campaign, rules, id) {
  if (id === campaign.colony.id) return land(campaign, rules);
  const { voyage, ...from } = campaign.colony;
  const left = { ...from, voyage: null, keep: { crew: voyage.home.crew, food: voyage.home.food } };
  const { keep, ...there } = colonyById(campaign, id);
  const colonies = [...campaign.colonies.filter((other) => other.id !== id), left].sort((a, b) => a.id - b.id);
  const crew = [...campaign.crew, ...keep.crew].sort((a, b) => a.id - b.id);
  return joined({ ...campaign, crew, colonies, colony: there, heat: Math.max(campaign.heat, there.heat) }, rules, keep.food, { landings: 1 });
}

// The ship landed home from its voyage: the crew one again in its order
// (by id, the order they signed on in), the ship's holds and the colony's
// food one store up to the stores' room, the rest spoiled, the ship's heat
// the greater of its own and the colony's trail (M38e), and the places
// within reach rolled if there are none. { campaign, room, lost }.
function land(campaign, rules) {
  const { home } = voyageOf(campaign);
  const crew = [...campaign.crew, ...home.crew].sort((a, b) => a.id - b.id);
  const together = { ...campaign, crew, colony: { ...campaign.colony, voyage: null }, heat: Math.max(campaign.heat, campaign.colony.heat) };
  return joined(together, rules, home.food, { voyagesHome: 1 });
}

// The ship's holds and the food there one store, up to the stores' room,
// the rest spoiled; counts tallied.
function joined(together, rules, food, counts) {
  const room = storesOf(together, rules).total;
  const all = together.supplies + food;
  const kept = Math.min(all, room);
  const flags = tally(together.flags, { ...counts, foodLost: all - kept });
  return { campaign: withPlaces({ ...together, supplies: kept, flags }, rules), room, lost: all - kept };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
