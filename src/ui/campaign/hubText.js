// Text for the campaign's screens: the hub's panels and the title's
// Continue line. rules are the content tables (src/sim/defs.js).
import { actOf, HEAT_MAX, maxHp } from '../../sim/campaign.js';
import { canLaunch, flightChecklist } from '../../sim/constraints.js';

// What the hub shows:
//   act, home   "Act 1 · Homeworld", "The hangar"
//   crew        [{ name, job, hp, max }]: job is blank when it is the name
//   ship        { size, ready, lines }: lines are the flight checklist's
//               failing lines, each with its fix
//   holdings    [[label, value]]: credits, heat, parts and fights
export function hubText(campaign, rules) {
  const act = actOf(campaign, rules);
  const crew = campaign.crew.map((member) => {
    const job = rules.jobs.get(member.job)?.name ?? member.job;
    return { name: member.name, job: job === member.name ? '' : job, hp: member.hp, max: maxHp(member, rules) };
  });
  const checklist = flightChecklist(campaign.ship, rules, campaign.crew.length);
  const parts = campaign.ship.modules.length;
  return {
    act: `Act ${campaign.act} · ${act?.name ?? 'Unknown'}`,
    home: act?.home ?? '',
    crew,
    ship: {
      size: `${parts} ${parts === 1 ? 'part' : 'parts'}`,
      ready: canLaunch(checklist),
      lines: checklist.filter((line) => !line.ok).map((line) => (line.fix ? `${line.text}: ${line.fix}` : line.text)),
    },
    holdings: [
      ['Credits', campaign.credits.toLocaleString('en')],
      ['Heat', `${campaign.heat} of ${HEAT_MAX}`],
      ['Parts', partsText(campaign.parts, rules)],
      ['Fights', fightsText(campaign.flags)],
    ],
  };
}

// "Engine ×2, Corridor": the parts held, not on the ship.
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
