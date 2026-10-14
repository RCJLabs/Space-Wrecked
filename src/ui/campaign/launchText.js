// Text for the launch (src/sim/launch.js), the landing (src/sim/settle.js,
// M25) and the stub that stands in for an act not built yet. rules are the
// content tables (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { runLevel } from '../../sim/heat.js';
import { actTitle, crewText, partsText, RUN_LEVEL_NAMES } from './hubText.js';
import { worldSaid } from './sectorText.js';

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
//   to       "Act 3 · The colony": the act it is in now
//   line     its kind's words for the landing (data/worlds.json)
export function landingText(campaign, rules) {
  const world = campaign.colony?.world;
  const kind = world && rules.worlds?.kinds.get(world.kind);
  return {
    world: world ? `${world.name} · ${kind?.name ?? world.kind}` : '',
    to: actTitle(campaign.act, rules),
    line: kind?.landing ?? '',
  };
}

// What the stub shows in place of an act not built yet (act 3, the colony,
// since M25):
//   act, home   "Act 3 · The colony", "The colony · Greenhaven"
//   text        what stands in for the act (data/campaign.json stub)
//   record      { title, lines: [[label, value]] }: how the run went:
//               sectors, jumps, the hunters met and faced, boardings,
//               credits, parts on hand and heat
//   world       the world settled, or null: { title ("Greenhaven · Ice
//               world"), lines (its numbers and how far it lies from the
//               lanes, as the sector map says them, and a line if it was
//               settled without a survey), surveyed }
//   crew        as the hangar's (hubText.js)
export function stubText(campaign, rules) {
  const act = actOf(campaign, rules);
  const world = campaign.colony?.world ?? null;
  const home = act?.home ?? '';
  return {
    act: actTitle(campaign.act, rules),
    home: world ? `${home} · ${world.name}` : home,
    text: act?.ahead ?? 'This act is not built yet.',
    record: { title: actTitle(campaign.act - 1, rules), lines: runRecord(campaign, rules) },
    world: world && worldCard(world, rules),
    crew: crewText(campaign, rules),
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

// The world settled, as the stub's card says it: on the ground, its
// numbers are known, surveyed or not.
function worldCard(world, rules) {
  const kind = rules.worlds?.kinds.get(world.kind)?.name ?? world.kind;
  const unsurveyed = world.surveyed ? [] : ['Settled without a survey: these are what the landing found.'];
  return { title: `${world.name} · ${kind}`, lines: [...worldSaid(world, rules, true), ...unsurveyed], surveyed: world.surveyed };
}
