// Text for making a captain (captain.js): the background the campaign
// starts from, the jobs and traits to pick from, and what is left to do.
// rules are the content tables (src/sim/defs.js). Pure.
import { CAPTAIN_TRAITS, captainProblem, firstBackground } from '../../sim/campaign.js';
import { TRAIT_STATS, traitBonus } from '../../sim/traits.js';

// A fighter's numbers in words, in the order the traits move them.
const STAT_NAMES = { hp: 'Hit points', aim: 'Aim', defense: 'Defense', mobility: 'Moves', armor: 'Armor' };

// What the screen shows for a draft captain, { name, job, traits }:
//   background  { name, blurb, pursuer }: fixed in v0.1
//   jobs        [{ id, name, line, picked }]: the start's crew jobs, each
//               with its numbers and weapon
//   traits      [{ id, name, text, effect, picked }]
//   captain     the captain's numbers in words, with the traits picked
//               ('' before a job is picked)
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
    jobs: start.start.crew.map((id) => {
      const fighter = rules.jobs.get(id);
      return { id, name: fighter.name, line: statLine(fighter, rules), picked: id === draft.job };
    }),
    traits: [...rules.traits.values()].map((trait) => ({ id: trait.id, name: trait.name, text: trait.text, effect: effectText(trait.effects), picked: picked.has(trait.id) })),
    captain: job ? statLine(withBonus(job, traitBonus(draft.traits, rules)), rules) : '',
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
