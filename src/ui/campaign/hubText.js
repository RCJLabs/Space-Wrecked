// Text for the campaign's screens: the hangar's panels and the title's
// Continue line. rules are the content tables (src/sim/defs.js).
import { actOf, HEAT_MAX, maxHp, partsNeeded, shipChecklist } from '../../sim/campaign.js';
import { canLaunch } from '../../sim/constraints.js';
import { shopOf } from '../../sim/economy.js';
import { heatLevel, paymentFor, pursuerOf, raidDue, runLevel } from '../../sim/heat.js';
import { launchProblem } from '../../sim/launch.js';
import { baseOf, countOfAny } from '../../sim/makers.js';
import { beginRaid } from '../../sim/raid.js';
import { coldAt } from '../../sim/quests.js';
import { recruitOffer } from '../../sim/recruits.js';
import { gearLine } from './armsText.js';
import { shownRank } from './crewJobText.js';
import { coldWarning, questsText } from './questText.js';
import { offerText } from './shopText.js';
import { sidesText } from './standingText.js';
import { withIdentity } from '../../sim/identity.js';

export const LEVEL_NAMES = { calm: 'Calm', rumors: 'Rumors', hunters: 'Hunters', raid: 'Raid' };
// On the run (act 2, M24), heat's own levels (heat.js RUN_LEVELS).
export const RUN_LEVEL_NAMES = { calm: 'Calm', rumors: 'Rumors', hunters: 'Hunters', taskForce: 'Task force', cornered: 'Cornered' };

// What the hangar shows:
//   act, home   "Act 1 · Homeworld", "The hangar"
//   ship        "Kestrel Rose · KR-482": the ship's name and hull number (M52)
//   goal        { ready, lines }: the flight checklist, act 1's goal. Each
//               line is { ok, text, fix, add }, and a fix that adds a part
//               says how many are on hand, and the shop's price if it has
//               one; any maker's version of the part counts (M23g). add is
//               that part when one is on hand, else null (M44: the line
//               opens the builder with it armed).
//   crew        [{ name, job, hp, max }]: job is blank when it is the name
//   sides       each side and the crew's standing with it (M33:
//               standingText.js sidesText)
//   quests      the quests and where each stands (M33b: questText.js
//               questsText)
//   holdings    [[label, value]]: credits, parts on hand and jobs
//   hint        { tone, text }: what to do next
//   build       true when a part on hand fixes a failing line
//   heat        { value, max, level, name, line, marks, payment }: the
//               pursuer's meter, its level (heat.js) and the pursuer's
//               words for it, the thresholds to mark on it, and the
//               payment: { label, ask, ok, why }
//   raid        null, or the raid at the door: { line, ok, why }, why
//               saying what stops it starting
//   shop        true when the district has a shop (economy.js)
//   launch      { ok, ask }: whether the ship can launch now (launch.js),
//               and what its first tap asks, with the quests launching
//               would end (M33b)
export function hangarText(campaign, rules) {
  const act = actOf(campaign, rules);
  const crew = crewText(campaign, rules);
  const checklist = shipChecklist(campaign, rules);
  const onHand = (type) => countOfAny(rules, type, (version) => campaign.parts[version] ?? 0);
  const lines = checklist.map((line) => ({
    ok: line.ok === true,
    text: line.text,
    // The part to fit, when one is on hand: the line opens the builder
    // with it armed (M44).
    add: line.ok !== true && line.add && onHand(line.add) > 0 ? line.add : null,
    fix: line.ok === true || !line.fix ? null : line.add ? `${line.fix}: ${[onHand(line.add) ? `${onHand(line.add)} on hand` : 'none on hand', offerText(campaign, rules, line.add)].filter(Boolean).join(', ')}` : line.fix,
  }));
  const ready = canLaunch(checklist);
  const build = checklist.some((line) => line.ok !== true && line.add && onHand(line.add) > 0);
  const held = Object.values(campaign.parts).reduce((sum, count) => sum + count, 0);
  const heat = heatText(campaign, rules);
  const raid = raidDue(campaign, rules) ? raidText(campaign, rules) : null;
  const shop = shopOf(campaign, rules);
  // A part the checklist needs, for sale and affordable.
  const needs = partsNeeded(campaign, rules);
  const buy = shop && (campaign.shop ?? []).find((item) => (needs[baseOf(rules.modules.get(item.part) ?? { id: item.part })] ?? 0) > onHand(item.part) && item.price <= campaign.credits);
  return {
    act: actTitle(campaign.act, rules),
    home: act?.home ?? '',
    ship: shipLine(campaign, rules),
    goal: { ready, lines },
    crew,
    sides: sidesText(campaign, rules),
    quests: questsText(campaign, rules),
    holdings: [
      ['Credits', campaign.credits.toLocaleString('en')],
      ['Parts on hand', partsText(campaign.parts, rules)],
      ['Jobs', jobsText(campaign.flags)],
    ],
    build,
    heat,
    raid,
    shop: Boolean(shop),
    launch: { ok: !launchProblem(campaign, rules), ask: [`Lift off and end act ${campaign.act}?`, coldWarning(coldAt(campaign, rules, campaign.act), 'Launching'), `The job board${shop ? ' and the shop stay' : ' stays'} behind. Tap Launch again.`].filter(Boolean).join(' ') },
    hint: hangarHint({ act: campaign.act, raid, ready, build, buy, heat, held, shop, pursuer: pursuerOf(campaign, rules)?.name ?? 'The pursuer', hire: recruitOffer(campaign, rules).length > 0 }, rules),
  };
}

// "Act 1 · Homeworld".
export function actTitle(act, rules) {
  return `Act ${act} · ${rules.acts.get(act)?.name ?? 'Unknown'}`;
}

// The crew panel's rows: [{ name, job, rank, hp, max }]: job blank when it
// is the name; rank their rank (M32b), 0 for none, a loyal companion's the
// third (M33c, crewJobText.js shownRank).
export function crewText(campaign, rules) {
  return campaign.crew.map((member) => {
    const job = rules.jobs.get(member.job)?.name ?? member.job;
    return { name: member.name, job: job === member.name ? '' : job, rank: shownRank(member, rules), hp: member.hp, max: maxHp(member, rules) };
  });
}

// What to do next at the hangar, the most pressing first: a raid at the
// door (unless the ship can lift off from under it), the hangar's recruit
// filling a place the fallen left (M41), launch, parts on hand to fit, the
// hunters on every job, a part the ship needs at the shop, rumors, and
// otherwise where parts come from. A pursuer that takes no payments (M30)
// leaves a raid as the one thing that brings heat down.
function hangarHint({ act, raid, ready, build, buy, heat, held, shop, pursuer, hire }, rules) {
  const shed = heat.payment ? 'A payment buys some heat off.' : `${pursuer} takes no payments: heat only falls once a raid is faced.`;
  const warn = { tone: 'warn', text: `${heat.line} ${shed}` };
  if (raid && ready) return { tone: 'bad', text: `${raid.line} Launch, and leave them an empty hangar.` };
  if (raid) return { tone: 'bad', text: raid.ok ? `${raid.line} ${heat.payment ? `Defend the ship, or pay heat down under ${rules.balance.raidHeat}.` : 'Defend the ship.'}` : `${raid.line} ${raid.why}` };
  if (hire) return { tone: 'good', text: 'Someone from the district is looking for a berth, to fill the place the fallen left. Tap Crew to sign them on.' };
  if (ready) return { tone: 'good', text: `Every flight check passes. Tap Launch to lift off and end act ${act}.` };
  if (build) return { tone: 'good', text: 'Your ship is half built. Tap Build to fit the parts on hand.' };
  if (heat.level === 'hunters') return warn;
  if (buy) return { tone: 'good', text: `${shop.name} has the ${rules.modules.get(buy.part)?.name ?? buy.part} the ship needs, for ${buy.price}. Tap Shop.` };
  if (heat.level !== 'calm') return warn;
  if (held) return { tone: 'info', text: shop ? 'The parts still missing come from jobs and the shop, where spares sell too.' : 'Tap Build to change the ship. The parts still missing come from jobs: tap Jobs.' };
  return { tone: 'info', text: `The parts still missing come from jobs${shop ? ' and the shop' : ''}: tap Jobs.` };
}

// The heat meter: see hangarText. On the run, the run's levels, with the
// pursuer's words for them; at the colony (M29) the same levels, with its
// words for the colony.
export function heatText(campaign, rules) {
  const hub = actOf(campaign, rules)?.hub;
  const run = hub === 'ship' || hub === 'colony';
  // Out on a voyage (M38d) the run's words, the hunters', not the colony's.
  const home = hub === 'colony' && !campaign.colony?.voyage;
  const level = run ? runLevel(campaign.heat, rules) : heatLevel(campaign.heat, rules);
  const { payment, ok, why } = paymentFor(campaign, rules);
  const { rumorHeat, huntHeat, raidHeat } = rules.balance;
  const pursuer = pursuerOf(campaign, rules);
  return {
    value: campaign.heat,
    max: HEAT_MAX,
    level,
    name: (run ? RUN_LEVEL_NAMES : LEVEL_NAMES)[level],
    line: (home ? pursuer?.colony?.levels[level] : run ? pursuer?.run?.levels[level] : pursuer?.levels[level]) ?? '',
    marks: [rumorHeat, huntHeat, raidHeat],
    payment: payment && {
      label: `Pay ${payment.credits}`,
      ask: `Pay ${payment.credits}?`,
      ok,
      why,
      text: `${payment.name}: ${payment.credits} credits for ${payment.heat} heat off. ${payment.text}`,
    },
  };
}

// The raid at the door: see hangarText.
function raidText(campaign, rules) {
  const begun = beginRaid(campaign, rules);
  const gear = gearLine(rules);
  return { line: `${pursuerOf(campaign, rules)?.levels.raid ?? ''}${gear ? ` ${gear}` : ''}`, ok: begun.ok, why: begun.ok ? null : begun.error };
}

// "Engine ×2, Corridor": the parts on hand, not on the ship.
export function partsText(parts, rules) {
  const held = Object.entries(parts).map(([type, count]) => {
    const name = rules.modules.get(type)?.name ?? type;
    return count > 1 ? `${name} ×${count}` : name;
  });
  return held.length ? held.join(', ') : 'None';
}

// "2 done, 1 lost", from the flags the jobs keep; none is "None yet", or
// what none is given as.
export function jobsText(flags, none = 'None yet') {
  const done = flags.jobsDone ?? 0;
  const lost = flags.jobsFailed ?? 0;
  return done || lost ? `${done} done, ${lost} lost` : none;
}

// Under the title's Continue: where the campaign is. rules may still be
// loading (null): then the act goes without its home, and a job without
// its name. On the run, the sector says where, or the system past the
// charts; once a world is settled (M25), the world; out on a voyage from it
// (M38d), the system the ship is in; on a stopped flight to another colony
// (M38e), where it was going.
export function continueText(campaign, rules) {
  const { fight, run, colony } = campaign;
  const approach = run?.approach;
  const boarding = fight?.boarding && approach ? (fight.boarding.dir === 'them' ? `Aboard the ${approach.enemy.name}` : `Boarders from the ${approach.enemy.name}`) : null;
  const what = fight?.raid ? 'The raid' : fight?.job ? rules?.contracts.jobs.get(fight.job.contract)?.title ?? 'On a job' : boarding ?? 'In a fight';
  const kind = fight?.raid ? 'The raid' : fight?.job ? 'A job' : fight?.boarding ? 'A boarding' : 'A fight';
  const facing = approach && (approach.outcome ? `${approach.enemy.name}, over` : `${approach.enemy.name}, round ${approach.round}`);
  const at = fight
    ? fight.battle.winner ? `${kind} just ended` : `${what}, round ${fight.battle.round}`
    : facing ?? (colony?.voyage ? `${run.sector.name}, ${voyageWhere(campaign)}` : colony ? colony.world.name : run ? `${run.sector.system ? 'The system' : `Sector ${run.sector.index}`} · ${run.sector.name}` : rules && actOf(campaign, rules)?.home);
  return at ? `Act ${campaign.act} · ${at}` : `Act ${campaign.act}`;
}

// Where a voyage has the ship, for Continue: "out from Copperhill", or on
// a stopped flight to another colony (M38e) "on the way to Saltmarch".
function voyageWhere(campaign) {
  const { colony } = campaign;
  const { voyage } = colony;
  if (voyage.homing && voyage.to !== null) return `on the way to ${(campaign.colonies ?? []).find((other) => other.id === voyage.to)?.world.name ?? 'a colony'}`;
  return `out from ${colony.world.name}`;
}

// The ship's name and hull number, for a heading (M52): "Kestrel Rose ·
// KR-482".
export function shipLine(campaign, rules) {
  const { name, number } = withIdentity(campaign, rules).identity;
  return `${name} · ${number}`;
}

// The ship as a sentence names her (M52): "the Wren", or a name that
// starts with "The" as it is.
export function theShip(campaign, rules) {
  const { name } = withIdentity(campaign, rules).identity;
  return /^the\s/i.test(name) ? name : `the ${name}`;
}
