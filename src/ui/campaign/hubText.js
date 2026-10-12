// Text for the campaign's screens: the hangar's panels and the title's
// Continue line. rules are the content tables (src/sim/defs.js).
import { actOf, HEAT_MAX, maxHp } from '../../sim/campaign.js';
import { canLaunch, flightChecklist } from '../../sim/constraints.js';

// What the hangar shows:
//   act, home   "Act 1 · Homeworld", "The hangar"
//   goal        { ready, lines }: the flight checklist, act 1's goal. Each
//               line is { ok, text, fix }, and a fix that adds a part says
//               how many are on hand.
//   crew        [{ name, job, hp, max }]: job is blank when it is the name
//   holdings    [[label, value]]: credits, heat, parts on hand and fights
//   hint        { tone, text }: what to do next
//   build       true when a part on hand fixes a failing line
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
  return {
    act: `Act ${campaign.act} · ${act?.name ?? 'Unknown'}`,
    home: act?.home ?? '',
    goal: { ready, lines },
    crew,
    holdings: [
      ['Credits', campaign.credits.toLocaleString('en')],
      ['Heat', `${campaign.heat} of ${HEAT_MAX}`],
      ['Parts on hand', partsText(campaign.parts, rules)],
      ['Fights', fightsText(campaign.flags)],
    ],
    build,
    hint: ready
      ? { tone: 'good', text: 'Every flight check passes. Launching ends act 1: it comes later.' }
      : build
        ? { tone: 'good', text: 'Your ship is half built. Tap Build to fit the parts on hand.' }
        : held
          ? { tone: 'info', text: 'Tap Build to change the ship. The parts still missing come from jobs, which come next.' }
          : { tone: 'info', text: 'The parts still missing come from jobs, which come next.' },
  };
}

// "Engine ×2, Corridor": the parts on hand, not on the ship.
export function partsText(parts, rules) {
  const held = Object.entries(parts).map(([type, count]) => {
    const name = rules.modules.get(type)?.name ?? type;
    return count > 1 ? `${name} ×${count}` : name;
  });
  return held.length ? held.join(', ') : 'None';
}

// "2 won, 1 lost", from the flags the fights keep.
export function fightsText(flags) {
  const won = flags.fightsWon ?? 0;
  const lost = flags.fightsLost ?? 0;
  return won || lost ? `${won} won, ${lost} lost` : 'None yet';
}

// Under the title's Continue: where the campaign is. rules may still be
// loading (null): then the act goes without its home.
export function continueText(campaign, rules) {
  const at = campaign.fight
    ? campaign.fight.battle.winner ? 'A fight just ended' : `In a fight, round ${campaign.fight.battle.round}`
    : rules && actOf(campaign, rules)?.home;
  return at ? `Act ${campaign.act} · ${at}` : `Act ${campaign.act}`;
}
