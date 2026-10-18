// Text for voyages from the colony (src/sim/voyage.js, M38d): Fly out's
// first pick and its plan, who goes and who stays, the stores split and the
// jump into the next system; the colony's panel on the chart while the
// ship is away, its day, food and the raid coming; Fly home's plan; and
// what flying out and home came to. From M38e a stopped flight can be for
// another colony, and a lander can come at any. rules are the content
// tables (src/sim/defs.js).
import { maxHp } from '../../sim/campaign.js';
import { allColonies, colonyById, reachOf, thereAt } from '../../sim/colonies.js';
import { storesOf } from '../../sim/colony.js';
import { crewRoom } from '../../sim/crew.js';
import { pursuerOf } from '../../sim/heat.js';
import { downAt } from '../../sim/raids.js';
import { voyageHomePlan } from '../../sim/voyage.js';
import { raidStatus } from './raidText.js';

// Who Fly out picks first (crew ids, in the crew's order): the healthiest,
// as many as the ship beds and breathes for, leaving one at home when there
// are two or more.
export function firstVoyagers(campaign, rules) {
  const { crew } = campaign;
  const most = Math.max(1, Math.min(crewRoom(campaign.ship, rules), crew.length > 1 ? crew.length - 1 : 1));
  const fit = [...crew].sort((a, b) => b.hp / maxHp(b, rules) - a.hp / maxHp(a, rules)).slice(0, most).map((member) => member.id);
  return crew.filter((member) => fit.includes(member.id)).map((member) => member.id);
}

// Fly out's plan in words (voyage.js voyagePlan's): { title, lines, bad
// (how many of the last lines are failing checks), ok, ask (what Fly out's
// first tap says), why (why the ship can't fly, or null) }. The lines: who
// goes and who stays; what the holds take of the food and how many jumps it
// lasts, what the colony keeps and what spoils; what the mines dig while
// the ship is away, kept up to the storehouses' room; the jump into the
// next system; whoever stays with no bed and air; and the flight checks
// with those aboard, each one failing with its fix.
export function outText(plan, campaign, rules) {
  const world = campaign.colony.world.name;
  if (!plan.crew) return { title: 'Voyage', lines: [], bad: 0, ok: false, ask: null, why: plan.error };
  const names = (ids) => listed(ids.map((id) => campaign.crew.find((member) => member.id === id)?.name ?? '?'));
  const { food, materials, jump } = plan;
  const home = plan.home.length ? `${names(plan.home)} stay${plan.home.length === 1 ? 's' : ''} at ${world}` : `Nobody stays at ${world}`;
  const after = Math.min(100, campaign.heat + jump.heat);
  const hunters = jump.hunt?.chance ? ` · hunters ${jump.hunt.chance}%` : '';
  const { hungerHp } = rules.balance;
  const hungry = jump.hungry ? ` · the crew goes hungry, ${hungerHp} hit point${hungerHp === 1 ? '' : 's'} each` : '';
  const jumps = jump.supplies > 0 ? Math.floor(food.ship / jump.supplies) : 0;
  const lasts = `${jumps} jump${jumps === 1 ? '' : 's'}`;
  const dug = !materials.dug ? [] : materials.room ? [`The mines' ${materials.dug} a day keeps up to the storehouses' ${materials.room} while the ship is away`] : [`No storehouse: the mines' ${materials.dug} a day is lost while the ship is away`];
  const lines = [
    `Aboard: ${names(plan.crew)} · ${home}`,
    `Food ${food.now}: the holds take ${food.ship}, enough for ${lasts}; the storehouses keep ${food.colony} of ${food.room}${food.spoils ? `, ${food.spoils} spoil` : ''}`,
    ...dug,
    `Into a system nobody has charted: ${jump.supplies} supplies, heat +${jump.heat} to ${after}${hunters}${hungry}`,
    ...(plan.rough.length ? [`${names(plan.rough)} ${plan.rough.length === 1 ? 'has' : 'have'} no bed and air at ${world}: no rest while the ship is away`] : []),
  ];
  const failing = plan.checks.filter((line) => line.ok !== true);
  if (failing.length) lines.push(...failing.map((line) => `${line.text}${line.fix ? `: ${lowerFirst(line.fix)}` : ''}`));
  else lines.push(`Every flight check passes with ${plan.crew.length} aboard.`);
  const lost = [...(food.spoils ? [`${food.spoils} food spoils`] : []), ...(jump.hungry ? ['the first jump goes hungry'] : [])];
  return {
    title: `Voyage from ${world}`,
    lines,
    bad: failing.length,
    ok: plan.ok,
    ask: plan.ok ? `Fly out with ${names(plan.crew)}${plan.home.length ? `, ${names(plan.home)} at home` : ', nobody at home'}: the holds take ${food.ship} food, ${lasts}' worth, and the colony keeps ${food.colony}${lost.length ? `; ${listed(lost)}` : ''}. Tap again to fly.` : null,
    why: plan.ok ? null : `${plan.error} Refit to put ${failing.some((line) => line.id === 'lifeSupport') ? 'life support' : 'what is short'} aboard, or take fewer.`,
  };
}

// The colony's panel on the chart while the ship is away, or null with it
// home: { title, rows ([[label, value]]: its day, its food of the
// storehouses' room, who is home, the raid's, and from M38e the flight
// home's days), tone (the raid's: 'bad' with a lander coming or down),
// line (the pursuer's words for it) }.
export function colonyPanelText(campaign, rules) {
  const voyage = campaign.colony?.voyage;
  if (!voyage) return null;
  const home = voyage.home?.crew ?? campaign.crew;
  const food = voyage.home?.food ?? campaign.supplies;
  const room = storesOf(campaign, rules).colony;
  const raid = raidStatus(campaign, rules);
  return {
    title: `Colony · ${campaign.colony.world.name}`,
    rows: [
      ['Day', String(campaign.colony.day)],
      ['Food', `${food} of ${room}`],
      ['Home', home.length ? listed(home.map((member) => member.name.split(' ')[0])) : 'Nobody'],
      [raid.label, raid.value],
      ['Flight', dayCount(reachOf(campaign, campaign.colony))],
    ],
    tone: raid.ok ? 'info' : 'bad',
    line: raid.line,
  };
}

// Fly home, for its button: { ok, label ('Fly home', or 'Fly on' once a
// lander stopped the flight), ask (its first tap's words), why }. A
// stopped flight for another colony (M38e) flies on there.
export function homeText(campaign, rules) {
  const plan = voyageHomePlan(campaign, rules);
  const label = campaign.colony?.voyage?.homing ? 'Fly on' : 'Fly home';
  if (!plan.ok) return { ok: false, label, ask: null, why: plan.error };
  const world = colonyById(campaign, plan.to).world.name;
  const elsewhere = plan.to !== campaign.colony.id;
  const days = `${plan.days} day${plan.days === 1 ? '' : 's'}`;
  const hungry = plan.hungry ? `, ${plan.hungry} hungry` : '';
  const heat = plan.heat ? `, heat +${plan.heat}` : '';
  const landed = Math.min(plan.food.room, plan.food.ship[1] + plan.food.colony[1]);
  const lost = plan.food.lost ? `, ${plan.food.lost} spoil` : '';
  return {
    ok: true,
    label,
    ask: `${elsewhere ? 'Fly on' : plan.stopped ? 'Fly on home' : 'Fly home'} to ${world}: ${days}, eating ${plan.eats} supplies aboard (${plan.food.ship[0]} → ${plan.food.ship[1]})${hungry}${heat}. Landed, the stores are one: ${landed} food of ${plan.food.room}${lost}. Tap again to fly.`,
    why: null,
  };
}

// What the chart's hint says of a raid's lander on its way to a colony
// while the ship is away, or null with none coming: { text, tone }. It says
// whether flying there now lands before it. The colony flown from first,
// then the others (M38e).
export function landerComing(campaign, rules) {
  if (!campaign.colony?.voyage) return null;
  const colony = allColonies(campaign).find((one) => one.raid && one.day < one.raid.lands);
  if (!colony) return null;
  const days = colony.raid.lands - colony.day;
  const flight = reachOf(campaign, colony);
  const home = colony === campaign.colony;
  const there = home ? campaign.colony.voyage.home?.crew ?? [] : thereAt(campaign, colony.id).crew;
  const who = home ? (there.length ? 'those at home fight it' : 'nobody is home to fight it') : there.length ? 'those there fight it' : 'nobody is there to fight it';
  const go = home ? 'Fly home' : `Fly to ${colony.world.name}`;
  const then = flight <= days ? `${go} now (${dayCount(flight)}) to meet it, or ${who}.` : `${home ? 'Flying home' : 'Flying there'} takes ${dayCount(flight)}, too long to meet it: ${who}.`;
  return { text: `${pursuerOf(campaign, rules)?.name ?? 'The pursuer'} found ${colony.world.name}: their lander comes down in ${dayCount(days)}. ${then}`, tone: 'warn' };
}

// "1 day", "3 days".
function dayCount(n) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

// What flying out or home came to (voyage.js voyageOut's or voyageHome's
// result), for the hint: { text, tone }. before: the campaign as it began.
export function voyageReport(result, before, rules) {
  const world = before.colony.world.name;
  if (result.plan.jump) {
    const spoiled = result.plan.food.spoils ? ` ${result.plan.food.spoils} food spoiled.` : '';
    return { text: `Into ${result.campaign.run.sector.name}, a system nobody has charted. A day passes at ${world} with each jump.${spoiled}`, tone: 'good' };
  }
  if (result.stopped) {
    const left = result.campaign.colony.voyage.homing;
    const at = downAt(result.campaign);
    const home = !at || at === result.campaign.colony;
    return { text: `${pursuerOf(before, rules)?.name ?? 'The pursuer'}'s lander is down at ${at?.world.name ?? world}: the ship waits, ${left} day${left === 1 ? '' : 's'} still to fly, while those ${home ? 'at home' : 'there'} face it.`, tone: 'bad' };
  }
  const n = result.days.length;
  // Landed at another colony (M38e): a stopped flight flown on there.
  if (result.campaign.colony.id !== before.colony.id) return { text: `Landed at ${result.campaign.colony.world.name} after ${n} day${n === 1 ? '' : 's'}: the ship's crew and stores join those there, ${result.campaign.supplies} food. ${world} keeps its own.`, tone: 'good' };
  return { text: `Home at ${world} after ${n} day${n === 1 ? '' : 's'}: the crew and the stores are one again, ${result.campaign.supplies} food.`, tone: 'good' };
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
