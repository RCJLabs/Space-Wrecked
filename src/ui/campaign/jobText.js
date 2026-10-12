// Words for jobs (src/sim/contracts.js): the job board's cards, the
// objective in the fight, and the pay. Pure: rules are the content tables
// (src/sim/defs.js). tools/jobs.js prints jobs with them too.
import { objectiveDone } from '../../sim/battle.js';
import { jobSetup } from '../../sim/contracts.js';

// A job on the board, in words:
//   title    "Claim jumpers"
//   who      "Marta Okafor, the union steward"
//   where    "Pit Nine"
//   pitch    the client's ask, their name and the site's filled in
//   mission  "Clear out"; brief, what it takes
//   twist    null, or { name, text }
//   against  "Claim jumper ×4": who is there, the twist's change counted
//   pay      "85 credits + Corridor"
// Null for a job the content no longer has (a save from before an edit).
export function jobText(job, rules) {
  const contract = rules.contracts.jobs.get(job.contract);
  const client = rules.clients.get(job.client);
  const site = rules.sites.get(job.site);
  const mission = rules.contracts.missions.get(contract?.mission);
  if (!contract || !client || !site || !mission || !rules.siteMaps.has(site.map)) return null;
  const twist = job.twist ? rules.contracts.twists.get(job.twist) ?? null : null;
  const { units } = jobSetup(job, rules, []);
  return {
    title: contract.title,
    who: `${client.name}, ${client.title}`,
    where: capitalize(site.name),
    pitch: fill(contract.pitch, { client: client.name, site: site.name }),
    mission: mission.name,
    brief: fill(mission.brief, { turns: counted(contract.turns, 'turn'), crates: counted(contract.crates, 'tagged crate') }),
    twist: twist ? { name: twist.name, text: fill(twist.text, twist) } : null,
    against: countedNames(units.map((unit) => rules.enemies.get(unit.kind)?.name ?? unit.kind)),
    pay: payText(job, rules),
  };
}

// "85 credits + Corridor": what a job pays when it is done.
export function payText(job, rules) {
  const credits = `${job.credits.toLocaleString('en')} credits`;
  return job.part ? `${credits} + ${rules.modules.get(job.part)?.name ?? job.part}` : credits;
}

// The fight's objective as it stands, for the chip over the board:
//   { title, progress, deadline }
// title is the mission's name; progress what is done or left ("Crates: 1
// of 3", "Terminal: 1 of 2 turns", "3 left standing"); deadline null or
// "Round 2 of 6". Null for a fight that isn't a job.
export function objectiveText(battle, job, rules) {
  if (!job) return null;
  const contract = rules.contracts.jobs.get(job.contract);
  const mission = rules.contracts.missions.get(contract?.mission);
  const { objective } = battle;
  let progress;
  if (objective?.type === 'grab') progress = `Crates: ${objective.taken.length} of ${objective.crates.length}`;
  else if (objective?.type === 'hack') progress = `Terminal: ${Math.min(objective.progress, objective.turns)} of ${objective.turns} turns`;
  else progress = `${battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active').length} left standing`;
  const { deadline } = battle.options;
  return {
    title: mission?.name ?? 'The job',
    progress,
    done: objectiveDone(objective),
    deadline: deadline ? `Round ${Math.min(battle.round, deadline)} of ${deadline}` : null,
  };
}

// How a job's fight ended, for the end panel: { tone, title, text }. log is
// the fight's events, whose last says why it ended.
export function jobOutcome(battle, job, rules, log = []) {
  if (battle.winner === 'crew') return { tone: 'good', title: 'Job done', text: `Paid ${payText(job, rules)}.` };
  const why = log.findLast((event) => event.type === 'over')?.reason === 'deadline' ? 'Out of time' : 'The crew is down';
  return { tone: 'bad', title: 'Job lost', text: `${why}: no pay.` };
}

function fill(text, words) {
  return text.replace(/\{(\w+)\}/g, (all, word) => (words[word] === undefined ? all : String(words[word])));
}

// "1 turn", "2 turns".
function counted(n, noun) {
  return n === undefined ? undefined : `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Scavver ×3, Hired heavy": names in order of first showing, counted.
function countedNames(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}
