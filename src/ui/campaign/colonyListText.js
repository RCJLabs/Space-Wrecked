// Text for the crew's other colonies (src/sim/colonies.js, M38e): each as
// the chart and the colony screen list it, where it lies, its day, food,
// who is there and its raid; Fly to it, from the chart (voyage.js flyTo)
// and from the colony screen with the crew picked (flyFrom); what a
// flight came to; and the words a second colony's landing and Settle here
// on a voyage say. rules are the content tables (src/sim/defs.js).
import { allColonies, colonyById, reachOf, thereAt } from '../../sim/colonies.js';
import { storesOf } from '../../sim/colony.js';
import { pursuerOf } from '../../sim/heat.js';
import { downAt } from '../../sim/raids.js';
import { flightFromPlan, flightPlan } from '../../sim/voyage.js';
import { raidStatus } from './raidText.js';
import { outText } from './voyageText.js';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

// "second" for 2: a colony's place in the order settled.
export function ordinal(n) {
  return ORDINALS[n - 1] ?? `${n}th`;
}

// The other colonies, in the order settled: all but the one the ship is at
// or flew from. Each { id, name, title, rows ([[label, value]]: the
// flight there, its day, its food of its storehouses' room, who is there,
// and its raid), tone ('bad' with a lander coming or down), line (the
// pursuer's words for its raid), detail (the rows in one line, for the
// colony screen's list), days (the flight's) }.
export function otherColonies(campaign, rules) {
  return allColonies(campaign).filter((colony) => colony !== campaign.colony).map((colony) => {
    const there = thereAt(campaign, colony.id);
    const days = reachOf(campaign, colony);
    const room = storesOf(there, rules).colony;
    const raid = raidStatus(there, rules);
    const who = there.crew.length ? listed(there.crew.map((member) => member.name.split(' ')[0])) : 'Nobody';
    return {
      id: colony.id,
      name: colony.world.name,
      title: `Colony · ${colony.world.name}`,
      rows: [
        ['Flight', dayCount(days)],
        ['Day', String(colony.day)],
        ['Food', `${there.supplies} of ${room}`],
        ['There', who],
        [raid.label, raid.value],
      ],
      tone: raid.ok ? 'info' : 'bad',
      line: raid.line,
      detail: `${capital(flightOf(days))} · day ${colony.day} · food ${there.supplies} · ${who === 'Nobody' ? 'nobody there' : `${who} there`} · ${lowerFirst(raid.value)}`,
      days,
    };
  });
}

// Fly to the colony numbered id from the chart, for its button: { ok,
// label, ask (its first tap's words), why }.
export function flyToText(campaign, rules, id) {
  const plan = flightPlan(campaign, rules, id);
  const label = 'Fly to';
  if (!plan.ok) return { ok: false, label, ask: null, why: plan.error };
  const name = colonyById(campaign, id).world.name;
  const from = campaign.colony.world.name;
  const home = campaign.colony.voyage.home.crew;
  const keeps = home.length ? `${listed(home.map((member) => member.name.split(' ')[0]))} and its food` : 'its food';
  return {
    ok: true,
    label,
    ask: `${plan.stopped ? 'Fly on' : 'Fly'} to ${name}: ${flightWords(plan)} ${from} keeps ${keeps}. Tap again to fly.`,
    why: null,
  };
}

// The flight's days, supplies, heat and the stores landed, in words.
function flightWords(plan) {
  const hungry = plan.hungry ? `, ${plan.hungry} hungry` : '';
  const heat = plan.heat ? `, heat +${plan.heat}` : '';
  const landed = Math.min(plan.food.room, plan.food.ship[1] + plan.food.colony[1]);
  const lost = plan.food.lost ? `, ${plan.food.lost} spoil` : '';
  return `${dayCount(plan.days)}, eating ${plan.eats} supplies aboard (${plan.food.ship[0]} → ${plan.food.ship[1]})${hungry}${heat}, no hunters. Landed, the stores are one: ${landed} food of ${plan.food.room}${lost}.`;
}

// Fly to the colony numbered id from the colony screen with crew (ids):
// Fly out's words for who goes and the stores split (voyageText.js
// outText), the flight in place of the jump: { title, lines, bad, ok, ask,
// why }.
export function flightFromText(campaign, rules, id, crew) {
  const plan = flightFromPlan(campaign, rules, id, crew);
  const words = outText(plan, campaign, rules);
  if (!plan.crew || !plan.days) return words;
  const name = colonyById(campaign, id)?.world.name ?? 'the colony';
  const flight = `To ${name}: ${dayCount(plan.days)}, ${plan.jump.supplies} supplies a day for those aboard, heat +${plan.heat} to ${Math.min(100, campaign.heat + plan.heat)}, no hunters`;
  const lines = words.lines.map((line) => (line.startsWith('Into a system nobody has charted') ? flight : line));
  return {
    ...words,
    title: `Fly to ${name}`,
    lines,
    ask: words.ask && words.ask.replace(/^Fly out with /, `Fly to ${name} with `).replace(/\. Tap again to fly\.$/, `; ${flightOf(plan.days)}. Tap again to fly.`),
  };
}

// What a flight to a colony came to (voyage.js flyTo's or flyFrom's
// result), for the hint: { text, tone }. before: the campaign as it began.
export function flightReport(result, before, rules) {
  const now = result.campaign;
  if (result.stopped) {
    const at = downAt(now);
    const left = now.colony.voyage.homing;
    const bound = colonyById(now, now.colony.voyage.to ?? now.colony.id);
    const where = at ? ` at ${at.world.name}` : '';
    return { text: `${pursuerOf(before, rules)?.name ?? 'The pursuer'}'s lander is down${where}: the ship waits in ${now.run.sector.name}, ${dayCount(left)} still to fly to ${bound.world.name}, until the raid is faced.`, tone: 'bad' };
  }
  const n = result.days.length;
  return { text: `Landed at ${now.colony.world.name} after ${dayCount(n)}: the ship's crew and stores join those there, ${now.supplies} food. ${before.colony.world.name} keeps its own.`, tone: 'good' };
}

// Settling on a voyage (M38e), for Settle here: the words of its first
// tap, or null for the first colony's (sectorText.js has those).
export function settleOnVoyage(campaign, plan, rules) {
  const { voyage } = campaign.colony ?? {};
  if (!voyage) return null;
  const aboard = listed(campaign.crew.map((member) => member.name.split(' ')[0]));
  const home = voyage.home.crew;
  const keeps = home.length ? `${listed(home.map((member) => member.name.split(' ')[0]))} and its food` : 'its food';
  const unknown = plan.world.surveyed ? '' : ' Not surveyed: what it is worth, you find out on the ground.';
  return `Found the crew's ${ordinal(plan.id)} colony on ${plan.world.name}: the ship lands with ${aboard}, a landing's ${rules.colony?.materials ?? 0} materials and nothing built yet. ${campaign.colony.world.name} keeps ${keeps}.${unknown} Tap again to settle.`;
}

// "1 day", "3 days".
function dayCount(n) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

// "a day's flight", "3 days' flight".
function flightOf(n) {
  return n === 1 ? "a day's flight" : `${n} days' flight`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
