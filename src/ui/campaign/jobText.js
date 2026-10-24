// Words for jobs (src/sim/contracts.js): the job board's cards, the
// objective in the fight, and the pay; since M33, whom a job is for and
// against, and what its client's side adds to the pay (standingText.js);
// since M38f the captive a rescue on a voyage frees settling at the colony.
// Pure: rules are the content tables (src/sim/defs.js). tools/jobs.js
// prints jobs with them too.
import { objectiveDone } from '../../sim/battle.js';
import { jobSetup, rescuedSettle } from '../../sim/contracts.js';
import { jobHeat } from '../../sim/heat.js';
import { raidLoss } from '../../sim/raid.js';
import { jobPay } from '../../sim/standing.js';
import { bonusText, jobSidesText } from './standingText.js';
import { gearLine } from './armsText.js';
import { theShip } from './hubText.js';

// A job on the board, in words:
//   title    "Claim jumpers"
//   who      "Marta Okafor, the union steward"
//   where    "Pit Nine"
//   pitch    the client's ask, their name and the site's filled in, and
//            at a station (M38c) its name
//   mission  "Clear out"; brief, what it takes
//   twist    null, or { name, text }
//   against  "Claim jumper ×4": who is there, the twist's change counted
//   sides    whom it is for and against, and what it moves (M33:
//            standingText.js jobSidesText), or null
//   pay      "85 credits + Corridor", with what the client's side adds
//   bonus    "+10%: the union is friendly", or null
//   heat     "+15 heat, loud": what it adds to heat, done or lost
//   gear     what a win can leave the crew (M37, armsText.js gearLine),
//            or null
// hunters: enemies the pursuer sends along (heat.js huntersFor), counted
// in against. campaign: the campaign whose board it is, for its standing
// (M33); without one, no bonus and the sides without their levels. Null
// for a job the content no longer has (a save from before an edit).
export function jobText(job, rules, hunters = [], campaign = null) {
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
    pitch: fill(contract.pitch, { client: client.name, site: site.name, station: job.station }),
    mission: mission.name,
    brief: fill(mission.brief, {
      turns: counted(contract.turns, 'turn'),
      crates: counted(contract.crates, 'tagged crate'),
      rounds: counted(contract.rounds, 'round'),
      targets: counted(contract.targets, 'tagged target'),
      client: client.name,
      captive: contract.captive,
    }),
    twist: twist ? { name: twist.name, text: fill(twist.text, twist) } : null,
    // The enemies only: the person the crew brings out (M38) isn't against it.
    against: countedNames(units.filter((unit) => !rules.people?.has(unit.kind)).map((unit) => rules.enemies.get(unit.kind)?.name ?? unit.kind)),
    sides: jobSidesText(job, campaign, rules),
    pay: payText(job, rules, campaign),
    bonus: bonusText(job, campaign, rules),
    heat: heatText(job, rules),
    gear: gearLine(rules),
  };
}

// "+15 heat, loud": what a job adds to heat.
export function heatText(job, rules) {
  const { heat, loud } = jobHeat(job, rules);
  return `+${heat} heat${loud ? ', loud' : ''}`;
}

// "85 credits + Corridor": what a job pays when it is done, with what its
// client's side adds for the campaign's standing (M33), if given.
export function payText(job, rules, campaign = null) {
  const credits = `${(campaign ? jobPay(campaign, rules, job) : job.credits).toLocaleString('en')} credits`;
  return job.part ? `${credits} + ${rules.modules.get(job.part)?.name ?? job.part}` : credits;
}

// The fight's objective as it stands, for the chip over the board:
//   { title, progress, deadline }
// title is the mission's name; progress what is done or left ("Crates: 1
// of 3", "Terminal: 1 of 2 turns", "3 left standing"; since M38 "Crates
// out: 0 of 1", "Jory Rook: to the far gate", "Held: round 2 of 6",
// "Blown: 0 of 1 · 2 charges", "Danny Prewitt: held"); deadline null or
// "Round 2 of 6". Null for a fight that isn't a job.
export function objectiveText(battle, job, rules) {
  if (!job) return null;
  const contract = rules.contracts.jobs.get(job.contract);
  const mission = rules.contracts.missions.get(contract?.mission);
  const { deadline } = battle.options;
  return {
    title: mission?.name ?? 'The job',
    progress: progressText(battle),
    done: objectiveDone(battle.objective),
    deadline: deadline ? `Round ${Math.min(battle.round, deadline)} of ${deadline}` : null,
  };
}

// What is done or left of a job's objective, in a few words.
function progressText(battle) {
  const { objective } = battle;
  const ward = battle.units.find((unit) => unit.id === objective?.ward);
  switch (objective?.type) {
    case 'grab':
      return `Crates: ${objective.taken.length} of ${objective.crates.length}`;
    case 'hack':
      return `Terminal: ${Math.min(objective.progress, objective.turns)} of ${objective.turns} turns`;
    case 'extract':
      return `Crates out: ${objective.out.length} of ${objective.crates.length}`;
    case 'escort':
      return `${ward?.name ?? 'The client'}: ${objective.out ? 'through the far gate' : wardState(ward) ?? 'to the far gate'}`;
    case 'rescue':
      return `${ward?.name ?? 'The captive'}: ${objective.out ? 'out' : ward?.status === 'held' ? 'held' : wardState(ward) ?? 'freed, walk them out'}`;
    case 'sabotage':
      return `Blown: ${objective.blown.length} of ${objective.targets.length} · ${counted(objective.left, 'charge')} left`;
    case 'defend':
      return `Held: round ${Math.min(battle.round, objective.rounds)} of ${objective.rounds}`;
    default:
      return `${battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active').length} left standing`;
  }
}

// The person brought out (M38) when they are down: how long they have.
function wardState(ward) {
  if (ward?.status === 'down') return `down, ${counted(ward.bleed, 'turn')} to live`;
  if (ward?.status === 'stable') return 'down, stable';
  return null;
}

// How a job's fight ended, for the end panel: { tone, title, text }. log is
// the fight's events, whose last says why it ended: out of time, and since
// M38 the line held, broken through, or the person brought out lost.
// campaign: as it stands before the crew goes home, for what the client's
// side adds to the pay.
export function jobOutcome(battle, job, rules, log = [], campaign = null) {
  const heat = ` Heat +${jobHeat(job, rules).heat}.`;
  const bonus = bonusText(job, campaign, rules);
  const reason = log.findLast((event) => event.type === 'over')?.reason;
  if (battle.winner === 'crew') return { tone: 'good', title: 'Job done', text: `${reason === 'held' ? 'The line held. ' : ''}Paid ${payText(job, rules, campaign)}${bonus ? ` (${bonus})` : ''}.${heat}` };
  const ward = battle.units.find((unit) => unit.id === battle.objective?.ward);
  const why = { deadline: 'Out of time', through: 'They broke through', ward: `${ward?.name ?? 'The one you came for'} is lost` }[reason] ?? 'The crew is down';
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
  if (battle.winner === 'crew') return { tone: 'good', title: 'Raid beaten', text: `They back off ${theShip(campaign, rules)}, for now. ${after}` };
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

// The captive a rescue on a voyage freed, settling at the colony the ship
// flew from as the fight ends (M38f, contracts.js rescuedSettle), for the
// end panel: "Sana Ito settles at Copperhill: 2 citizens there now.", or
// null when they go their way.
export function settledLine(battle, campaign, rules) {
  if (!rescuedSettle(campaign, rules, battle, battle.winner === 'crew')) return null;
  const ward = battle.units.find((unit) => unit.ward);
  const n = (campaign.colony.citizens ?? 0) + 1;
  return `${ward?.name ?? 'The captive'} settles at ${campaign.colony.world.name}: ${n} citizen${n === 1 ? '' : 's'} there now.`;
}
