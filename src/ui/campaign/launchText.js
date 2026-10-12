// Text for the launch (src/sim/launch.js) and for the stub that stands in
// for an act not built yet. rules are the content tables (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { heatLevel } from '../../sim/heat.js';
import { actTitle, crewText, jobsText, LEVEL_NAMES, partsText } from './hubText.js';

// What the launch shows, for a campaign that has just launched:
//   from     "Act 1 · Homeworld": the act it leaves
//   to       "Act 2 · The run": the act it is in now
//   line     the background's words as the ship lifts off
//   escaped  the pursuer's words for the raid left at the door, or null
export function launchText(campaign, rules) {
  const words = rules.backgrounds.get(campaign.background)?.launch;
  return {
    from: actTitle(campaign.act - 1, rules),
    to: actTitle(campaign.act, rules),
    line: words?.text ?? '',
    escaped: campaign.flags.escapedRaid ? words?.escaped ?? null : null,
  };
}

// What the stub shows in place of an act not built yet:
//   act, home   "Act 2 · The run", "Your ship"
//   text        what stands in for the act (data/campaign.json stub)
//   record      { title, lines: [[label, value]] }: how the act before it
//               went: jobs, raids, credits, parts on hand and heat
//   crew        as the hangar's (hubText.js)
export function stubText(campaign, rules) {
  const act = actOf(campaign, rules);
  return {
    act: actTitle(campaign.act, rules),
    home: act?.home ?? '',
    text: act?.stub ?? 'This act is not built yet.',
    record: {
      title: actTitle(campaign.act - 1, rules),
      lines: [
        ['Jobs', jobsText(campaign.flags, 'None')],
        ['Raids', raidsText(campaign.flags)],
        ['Credits', campaign.credits.toLocaleString('en')],
        ['Parts on hand', partsText(campaign.parts, rules)],
        ['Heat', `${campaign.heat} · ${LEVEL_NAMES[heatLevel(campaign.heat, rules)]}`],
      ],
    },
    crew: crewText(campaign, rules),
  };
}

// "1 fought off, 1 lost", from the flags the raids keep, and the one left
// at the door by lifting off.
export function raidsText(flags) {
  const said = [
    flags.raidsWon && `${flags.raidsWon} fought off`,
    flags.raidsLost && `${flags.raidsLost} lost`,
    flags.escapedRaid && '1 left at the door',
  ].filter(Boolean);
  return said.length ? said.join(', ') : 'None';
}
