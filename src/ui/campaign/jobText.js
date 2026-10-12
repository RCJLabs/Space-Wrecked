// Words for jobs (src/sim/contracts.js): the job board's cards, the
// objective in the fight, and the pay. Pure: rules are the content tables
// (src/sim/defs.js). tools/jobs.js prints jobs with them too.
import { objectiveDone } from '../../sim/battle.js';
import { jobSetup } from '../../sim/contracts.js';
import { jobHeat } from '../../sim/heat.js';
import { raidLoss } from '../../sim/raid.js';

// A job on the board, in words:
//   title    "Claim jumpers"
//   who      "Marta Okafor, the union steward"
//   where    "Pit Nine"
//   pitch    the client's ask, their name and the site's filled in
//   mission  "Clear out"; brief, what it takes
//   twist    null, or { name, text }
//   against  "Claim jumper ×4": who is there, the twist's change counted
//   pay      "85 credits + Corridor"
//   heat     "+15 heat, loud": what it adds to heat, done or lost
// hunters: enemies the pursuer sends along (heat.js huntersFor), counted
// in against. Null for a job the content no longer has (a save from
// before an edit).
export function jobText(job, rules, hunters = []) {
  const contract = rules.contracts.jobs.get(job.contract);
  const client = rules.clients.get(job.client);
  const site = rules.sites.get(job.site);
  const mission = rules.contracts.missions.get(contract?.mission);
  if (!contract || !client || !site || !mission || !rules.siteMaps.has(site.map)) return null;
  const twist = job.twist ? rules.contracts.twists.get(job.twist) ?? null : null;
  const { units } = jobSetup(job, rules, [], { hunters });
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
    heat: heatText(job, rules),
  };
}

// "+15 heat, loud": what a job adds to heat.
export function heatText(job, rules) {
  const { heat, loud } = jobHeat(job, rules);
  return `+${heat} heat${loud ? ', loud' : ''}`;
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
  const heat = ` Heat +${jobHeat(job, rules).heat}.`;
  if (battle.winner === 'crew') return { tone: 'good', title: 'Job done', text: `Paid ${payText(job, rules)}.${heat}` };
  const why = log.findLast((event) => event.type === 'over')?.reason === 'deadline' ? 'Out of time' : 'The crew is down';
  return { tone: 'bad', title: 'Job lost', text: `${why}: no pay.${heat}` };
}

// A raid's line under the round: { title, progress, done, deadline }.
export function raidObjective(battle) {
  const left = battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active').length;
  return { title: 'Raid', progress: `${left} raider${left === 1 ? '' : 's'} left`, done: false, deadline: null };
}

// How a raid ended, for the end panel: { tone, title, text }. campaign is
// as it stands before the crew goes home (raid.js endRaid).
export function raidOutcome(battle, campaign, rules) {
  const after = `Heat falls to ${Math.min(campaign.heat, rules.balance.heatAfterRaid)}.`;
  if (battle.winner === 'crew') return { tone: 'good', title: 'Raid beaten', text: `They back off, for now. ${after}` };
  const loss = raidLoss(campaign, rules);
  const took = loss?.part ? `They took the ${rules.modules.get(loss.part)?.name ?? loss.part}.` : loss?.credits ? `They took ${loss.credits} credits.` : 'There was nothing to take.';
  return { tone: 'bad', title: 'Raid lost', text: `${took} ${after}` };
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
