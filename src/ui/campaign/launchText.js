// Text for the launch (src/sim/launch.js), the landing (src/sim/settle.js,
// M25) and how the run went, which the colony keeps (colonyText.js). rules
// are the content tables (src/sim/defs.js).
import { runLevel } from '../../sim/heat.js';
import { ordinal } from './colonyListText.js';
import { actTitle, partsText, RUN_LEVEL_NAMES } from './hubText.js';

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

// What the landing shows, for a campaign that has just settled a world:
//   world    "Greenhaven · Ice world": where the ship comes down
//   to       "Act 3 · The colony": the act it is in now; for a colony
//            settled on a voyage (M38e), "The crew's second colony"
//   where    the head's line: world, and for a colony settled on a voyage
//            which it is ("Saltmarch · Desert world · The crew's second
//            colony")
//   line     its kind's words for the landing (data/worlds.json)
export function landingText(campaign, rules) {
  const world = campaign.colony?.world;
  const kind = world && rules.worlds?.kinds.get(world.kind);
  const id = campaign.colony?.id ?? 1;
  const said = world ? `${world.name} · ${kind?.name ?? world.kind}` : '';
  const to = id > 1 ? `The crew's ${ordinal(id)} colony` : actTitle(campaign.act, rules);
  return {
    world: said,
    to,
    where: id > 1 ? `${said} · ${to}` : said,
    line: kind?.landing ?? '',
  };
}

// How the run went, from the run and the flags it kept: [[label, value]].
export function runRecord(campaign, rules) {
  const { flags } = campaign;
  const count = (name) => flags[name] ?? 0;
  const jumps = count('jumps');
  const long = count('longJumps');
  return [
    ['Sectors', `${campaign.run?.past.length ?? 0} crossed`],
    ['Jumps', jumps ? `${jumps}${long ? `, ${long} long` : ''}` : 'None'],
    ['Hunters', count('hunts') ? `${count('hunts')} met, ${count('huntsFaced')} faced` : 'None met'],
    ['Boardings', count('boardingsWon') || count('boardingsLost') ? `${count('boardingsWon')} won, ${count('boardingsLost')} lost` : 'None'],
    ['Credits', campaign.credits.toLocaleString('en')],
    ['Parts on hand', partsText(campaign.parts, rules)],
    ['Heat', `${campaign.heat} · ${RUN_LEVEL_NAMES[runLevel(campaign.heat, rules)]}`],
  ];
}
