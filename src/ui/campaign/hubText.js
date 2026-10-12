// Text for the campaign's screens: the hangar's panels and the title's
// Continue line. rules are the content tables (src/sim/defs.js).
import { actOf, HEAT_MAX, maxHp } from '../../sim/campaign.js';
import { canLaunch, flightChecklist } from '../../sim/constraints.js';
import { heatLevel, paymentFor, pursuerOf, raidDue } from '../../sim/heat.js';
import { beginRaid } from '../../sim/raid.js';

const LEVEL_NAMES = { calm: 'Calm', rumors: 'Rumors', hunters: 'Hunters', raid: 'Raid' };

// What the hangar shows:
//   act, home   "Act 1 · Homeworld", "The hangar"
//   goal        { ready, lines }: the flight checklist, act 1's goal. Each
//               line is { ok, text, fix }, and a fix that adds a part says
//               how many are on hand.
//   crew        [{ name, job, hp, max }]: job is blank when it is the name
//   holdings    [[label, value]]: credits, parts on hand and jobs
//   hint        { tone, text }: what to do next
//   build       true when a part on hand fixes a failing line
//   heat        { value, max, level, name, line, marks, payment }: the
//               pursuer's meter, its level (heat.js) and the pursuer's
//               words for it, the thresholds to mark on it, and the
//               payment: { label, ask, ok, why }
//   raid        null, or the raid at the door: { line, ok, why }, why
//               saying what stops it starting
export function hangarText(campaign, rules) {
  const act = actOf(campaign, rules);
  const crew = campaign.crew.map((member) => {
    const job = rules.jobs.get(member.job)?.name ?? member.job;
    return { name: member.name, job: job === member.name ? '' : job, hp: member.hp, max: maxHp(member, rules) };
  });
  const checklist = flightChecklist(campaign.ship, rules, campaign.crew.length);
  const onHand = (type) => campaign.parts[type] ?? 0;
  const lines = checklist.map((line) => ({
    ok: line.ok === true,
    text: line.text,
    fix: line.ok === true || !line.fix ? null : line.add ? `${line.fix}: ${onHand(line.add) ? `${onHand(line.add)} on hand` : 'none on hand'}` : line.fix,
  }));
  const ready = canLaunch(checklist);
  const build = checklist.some((line) => line.ok !== true && line.add && onHand(line.add) > 0);
  const held = Object.values(campaign.parts).reduce((sum, count) => sum + count, 0);
  const heat = heatText(campaign, rules);
  const raid = raidDue(campaign, rules) ? raidText(campaign, rules) : null;
  return {
    act: `Act ${campaign.act} · ${act?.name ?? 'Unknown'}`,
    home: act?.home ?? '',
    goal: { ready, lines },
    crew,
    holdings: [
      ['Credits', campaign.credits.toLocaleString('en')],
      ['Parts on hand', partsText(campaign.parts, rules)],
      ['Jobs', jobsText(campaign.flags)],
    ],
    build,
    heat,
    raid,
    hint: raid
      ? { tone: 'bad', text: raid.ok ? `${raid.line} Defend the ship, or pay heat down under ${rules.balance.raidHeat}.` : `${raid.line} ${raid.why}` }
      : ready
        ? { tone: 'good', text: 'Every flight check passes. Launching ends act 1: it comes later.' }
        : build
          ? { tone: 'good', text: 'Your ship is half built. Tap Build to fit the parts on hand.' }
          : heat.level !== 'calm'
            ? { tone: 'warn', text: `${heat.line} A payment buys some heat off.` }
            : held
              ? { tone: 'info', text: 'Tap Build to change the ship. The parts still missing come from jobs: tap Jobs.' }
              : { tone: 'info', text: 'The parts still missing come from jobs: tap Jobs.' },
  };
}

// The heat meter: see hangarText.
export function heatText(campaign, rules) {
  const level = heatLevel(campaign.heat, rules);
  const { payment, ok, why } = paymentFor(campaign, rules);
  const { rumorHeat, huntHeat, raidHeat } = rules.balance;
  return {
    value: campaign.heat,
    max: HEAT_MAX,
    level,
    name: LEVEL_NAMES[level],
    line: pursuerOf(campaign, rules)?.levels[level] ?? '',
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
  return { line: pursuerOf(campaign, rules)?.levels.raid ?? '', ok: begun.ok, why: begun.ok ? null : begun.error };
}

// "Engine ×2, Corridor": the parts on hand, not on the ship.
export function partsText(parts, rules) {
  const held = Object.entries(parts).map(([type, count]) => {
    const name = rules.modules.get(type)?.name ?? type;
    return count > 1 ? `${name} ×${count}` : name;
  });
  return held.length ? held.join(', ') : 'None';
}

// "2 done, 1 lost", from the flags the jobs keep.
export function jobsText(flags) {
  const done = flags.jobsDone ?? 0;
  const lost = flags.jobsFailed ?? 0;
  return done || lost ? `${done} done, ${lost} lost` : 'None yet';
}

// Under the title's Continue: where the campaign is. rules may still be
// loading (null): then the act goes without its home, and a job without
// its name.
export function continueText(campaign, rules) {
  const { fight } = campaign;
  const what = fight?.raid ? 'The raid' : fight?.job ? rules?.contracts.jobs.get(fight.job.contract)?.title ?? 'On a job' : 'In a fight';
  const kind = fight?.raid ? 'The raid' : fight?.job ? 'A job' : 'A fight';
  const at = fight
    ? fight.battle.winner ? `${kind} just ended` : `${what}, round ${fight.battle.round}`
    : rules && actOf(campaign, rules)?.home;
  return at ? `Act ${campaign.act} · ${at}` : `Act ${campaign.act}`;
}
