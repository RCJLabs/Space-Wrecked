// Text for making a captain (captain.js): the background the campaign
// starts from, the jobs and traits to pick from, and what is left to do.
// rules are the content tables (src/sim/defs.js). Pure.
import { CAPTAIN_TRAITS, captainProblem, firstBackground } from '../../sim/campaign.js';
import { FACES, LOOK_KEYS } from '../../sim/looks.js';
import { TRAIT_STATS, traitBonus } from '../../sim/traits.js';
import { jobSaid } from './crewJobText.js';

// A fighter's numbers in words, in the order the traits move them.
const STAT_NAMES = { hp: 'Hit points', aim: 'Aim', defense: 'Defense', mobility: 'Moves', armor: 'Armor' };

// A look's layers and choices in words (src/sim/looks.js).
export const LAYER_NAMES = { face: 'Face', skin: 'Skin', hair: 'Hair', hairColor: 'Hair color', eyes: 'Eyes', beard: 'Beard', mark: 'Mark' };
export const LOOK_WORDS = {
  skin: { porcelain: 'Porcelain', fair: 'Fair', peach: 'Peach', sand: 'Sand', olive: 'Olive', tan: 'Tan', umber: 'Umber', brown: 'Brown', deep: 'Deep' },
  hair: { bald: 'Bald', buzz: 'Buzz cut', crop: 'Crop', sidepart: 'Side part', quiff: 'Quiff', mohawk: 'Mohawk', long: 'Long', bun: 'Bun', afro: 'Afro', locs: 'Locs' },
  hairColor: { black: 'Black', darkBrown: 'Dark brown', brown: 'Brown', auburn: 'Auburn', copper: 'Copper', blond: 'Blond', platinum: 'Platinum', grey: 'Gray', teal: 'Teal', magenta: 'Magenta', violet: 'Violet' },
  eyes: { brown: 'Brown', dark: 'Dark', hazel: 'Hazel', green: 'Green', blue: 'Blue', grey: 'Gray', amber: 'Amber' },
  beard: { none: 'None', stubble: 'Stubble', mustache: 'Mustache', goatee: 'Goatee', full: 'Full' },
  mark: { none: 'None', scar: 'Scar', freckles: 'Freckles', tattoo: 'Tattoo', ports: 'Ports', cybereye: 'Cyber eye', jawplate: 'Jaw plate', earring: 'Earring', eyepatch: 'Eye patch', lines: 'Lines' },
};

// What the screen shows for a draft captain, { name, job, traits, look }:
//   background  { name, blurb, pursuer }: the one picked (background.js)
//   look        [{ key, label, value }]: each layer of the look, its name
//               and its choice in words ([] without a look)
//   jobs        [{ id, name, line, picked }]: the start's crew jobs, each
//               once (a crew can have two of a job, M30), with its
//               numbers and weapon
//   traits      [{ id, name, text, effect, picked }]
//   captain     the captain's numbers in words, with the traits picked
//               ('' before a job is picked)
//   does        the job picked's order, ship effect and colony effect in
//               words (crewJobText.js jobSaid, M32): [] before one is
//   ready       true when the captain can lead (captainProblem)
//   hint        { tone, text }: what is left to do, or who is ready
export function captainText(rules, draft, background = firstBackground(rules)) {
  const start = rules.backgrounds.get(background);
  const picked = new Set(draft.traits);
  const why = captainProblem(draft, rules, background);
  const job = rules.jobs.get(draft.job);
  const left = CAPTAIN_TRAITS - draft.traits.length;
  return {
    background: { name: start.name, blurb: start.blurb, pursuer: start.pursuer.name },
    look: draft.look ? LOOK_KEYS.map((key) => ({ key, label: LAYER_NAMES[key], value: key === 'face' ? `${draft.look.face + 1} of ${FACES}` : LOOK_WORDS[key][draft.look[key]] })) : [],
    jobs: [...new Set(start.start.crew)].map((id) => {
      const fighter = rules.jobs.get(id);
      return { id, name: fighter.name, line: statLine(fighter, rules), picked: id === draft.job };
    }),
    traits: [...rules.traits.values()].map((trait) => ({ id: trait.id, name: trait.name, text: trait.text, effect: effectText(trait.effects), picked: picked.has(trait.id) })),
    captain: job ? statLine(withBonus(job, traitBonus(draft.traits, rules)), rules) : '',
    does: job ? Object.values(jobSaid(job.id, rules)).filter(Boolean) : [],
    ready: !why,
    hint: why
      ? { tone: 'info', text: why === `Pick ${CAPTAIN_TRAITS} traits.` && left > 0 ? `Pick ${CAPTAIN_TRAITS} traits: ${left} to go.` : why }
      : { tone: 'good', text: `${draft.name.trim()}, ${job.name.toLowerCase()}: ${draft.traits.map((id) => rules.traits.get(id).name).join(' and ')}. Tap Start.` },
  };
}

// "Aim +10, defense −5".
export function effectText(effects) {
  return TRAIT_STATS.filter((key) => effects[key])
    .map((key, i) => {
      const name = i ? STAT_NAMES[key].toLowerCase() : STAT_NAMES[key];
      return `${name} ${effects[key] > 0 ? '+' : '−'}${Math.abs(effects[key])}`;
    })
    .join(', ');
}

// "10 hit points · aim 70 · defense 0 · moves 4 · armor 1 · Rifle".
function statLine(fighter, rules) {
  const weapon = rules.weapons.get(fighter.weapon)?.name ?? fighter.weapon;
  return `${fighter.hp} hit points · aim ${fighter.aim} · defense ${fighter.defense} · moves ${fighter.mobility} · armor ${fighter.armor} · ${weapon}`;
}

function withBonus(fighter, bonus) {
  const sum = { ...fighter };
  for (const key of TRAIT_STATS) sum[key] = fighter[key] + bonus[key];
  return { ...sum, hp: Math.max(1, sum.hp), mobility: Math.max(1, sum.mobility) };
}
