// Text for trips from the colony (src/sim/expeditions.js, M28): the places
// within reach, a trip's plan, where the squad is and what is there, and
// what each leg's days came to; since M29 a leg a raid stopped, and Fly
// on; since M33b a quest's place, named for its quest, and what winning
// her did to the quest; since M36 who in the squad would take a choice,
// and a trap that leaves the place held. rules are the content tables
// (src/sim/defs.js).
import { maxHp } from '../../sim/campaign.js';
import { colonyBy } from '../../sim/edges.js';
import { homePlan, kindOf, onPlan, otherWorlds, placeFightDue, tripHere } from '../../sim/expeditions.js';
import { pursuerOf } from '../../sim/heat.js';
import { aWeapon, gearLine } from './armsText.js';
import { byJob } from './crewJobText.js';
import { faceOf } from './crewText.js';
import { changesText, choiceSaid } from './eventText.js';
import { questNoteLines, questPlaceText } from './questText.js';

// The places within reach, a row each: [{ index, name, kind (its kind's
// name, or a world's: "Desert world"; a quest's place, its quest's name),
// days (each way), held, quest (a quest's place's quest's name, or null),
// line ("Ore rock · 2 days away", and "squatters aboard" where they hold
// her, "held" at a quest's place), about (the kind's words, or the quest
// place's) }].
export function placesText(campaign, rules) {
  return campaign.colony.places.map((place, index) => {
    const kind = kindOf(place, rules);
    const name = kindName(place, campaign, rules);
    const quest = questPlaceText(place, rules);
    return {
      index,
      name: place.name,
      kind: name,
      days: place.days,
      held: place.held,
      quest: quest?.tag ?? null,
      line: [name, `${place.days} day${place.days === 1 ? '' : 's'} away`, ...(place.held ? [quest ? 'held' : 'squatters aboard'] : [])].join(' · '),
      about: quest?.line ?? kind?.text ?? '',
    };
  });
}

// The squad picker's rows: [{ id, name, about (their job), hp, max, face,
// going }] for the crew, in its order. going: the ids picked.
export function squadRows(campaign, rules, going) {
  const picked = new Set(going);
  return campaign.crew.map((member, i) => ({
    id: member.id,
    name: member.name,
    about: rules.jobs.get(member.job)?.name ?? member.job,
    hp: member.hp,
    max: maxHp(member, rules),
    face: faceOf(member, rules, i),
    going: picked.has(member.id),
  }));
}

// A trip's plan in words (expeditions.js tripPlan's): { title (the place),
// lines, ok, ask (what Fly out's first tap says), why (why it can't fly,
// or null) }. The lines: the place's kind and the days there and back (a
// pilot in the squad flying them shorter, M32); what the days eat; and the
// flight checks with the squad aboard, each one failing with its fix.
export function planText(plan, campaign, rules) {
  if (!plan.place) return { title: 'Fly out', lines: [], ok: false, ask: null, why: plan.error };
  const { place, days } = plan;
  const squad = plan.squad.map((id) => campaign.crew.find((member) => member.id === id)).filter(Boolean);
  const pilot = days.out < place.days ? colonyBy(squad, rules, 'tripDays') : null;
  const lines = [
    `${kindName(place, campaign, rules)} · ${days.out} day${days.out === 1 ? '' : 's'} there, ${days.back} back${pilot ? `, ${byJob(pilot, rules)} flying` : ''}${place.held ? (place.quest ? ' · held' : ' · squatters aboard') : ''}`,
    `The days eat ${plan.eats} food: ${plan.food[0]} → ${plan.food[1]}${plan.hungry ? `, ${plan.hungry} day${plan.hungry === 1 ? '' : 's'} hungry` : ''}`,
  ];
  const failing = plan.checks.filter((line) => line.ok !== true);
  const n = plan.squad.length;
  if (failing.length) lines.push(...failing.map((line) => `${line.text}${line.fix ? `: ${lowerFirst(line.fix)}` : ''}`));
  else lines.push(`Every flight check passes with ${n} aboard.`);
  const names = listed(plan.squad.map((id) => campaign.crew.find((member) => member.id === id)?.name ?? '?'));
  const total = days.out + days.back;
  return {
    title: place.name,
    lines,
    ok: plan.ok,
    ask: plan.ok ? `Fly out to ${place.name} with ${names}: ${total} days away, the colony on its own power. Tap again to fly.` : null,
    why: plan.ok ? null : `${plan.error} Refit to put ${failing.some((line) => line.id === 'lifeSupport') ? 'life support' : 'what is short'} aboard.`,
  };
}

// Where the squad is while the ship is away, for the side panel, or null
// with the ship home: { title (the place), where ("Ore rock · 2 days from
// home"), squad (their names), event, held, result, home, leg, on }.
//   event   the event to decide there: { title, text, choices: [{ id,
//           label, ok, why, odds, taker, ask }] }, as the run's
//           (eventText.js), but only the squad can take a choice
//   held    the squatters' derelict, still to fight for: { lines, ask }
//   result  what came of it: { title, text }
//   home    Fly home: { ok, ask (its first tap's words), why }
//   leg     a leg a raid stopped (M29), or null: { dir, left, line }
//   on      Fly on, with a leg stopped: { ok, ask, why }, else null
export function awayText(campaign, rules) {
  const here = tripHere(campaign, rules);
  if (!here) return null;
  const { place, leg } = here;
  const squad = listed(campaign.colony.trip.squad.map((id) => campaign.crew.find((member) => member.id === id)?.name ?? '?'));
  const plan = homePlan(campaign, rules);
  const on = leg ? onPlan(campaign, rules) : null;
  const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
  return {
    title: place.name,
    where: `${kindName(place, campaign, rules)} · ${days(place.days)} from home`,
    squad: squad || 'nobody',
    event: here.event ? eventAt(here.event, campaign, rules) : null,
    held: here.held ? heldText(campaign, rules) : null,
    result: here.result ? resultAt(here.result, campaign, rules) : null,
    home: plan.ok
      ? { ok: true, ask: `Fly home: ${days(plan.days)} back, the days eating ${plan.eats} food (${plan.food[0]} → ${plan.food[1]}). Tap again to fly.`, why: null }
      : { ok: false, ask: null, why: plan.error },
    leg: leg && { dir: leg.dir, left: leg.left, line: `On the way ${leg.dir === 'out' ? 'out' : 'home'}, ${days(leg.left)} still to fly` },
    on: !on ? null
      : on.ok ? { ok: true, ask: `Fly on ${on.dir === 'out' ? `to ${place.name}` : 'home'}: ${days(on.days)} still to fly, the days eating ${on.eats} food (${on.food[0]} → ${on.food[1]}). Tap again to fly.`, why: null }
      : { ok: false, ask: null, why: on.error },
  };
}

// What a leg's days came to (expeditions.js flyOut's, flyHome's or
// flyOn's result), for the hint: { text, tone }. leg: 'out' or 'home';
// before: the campaign as the leg began. A leg a raid's lander stopped
// (M29) says so, and the days still to fly.
export function legReport(result, leg, before, rules) {
  const sum = (key) => result.days.reduce((total, day) => total + key(day), 0);
  const grown = sum((day) => day.plan.made.food);
  const dug = sum((day) => day.plan.made.materials);
  const eaten = sum((day) => day.plan.eats);
  const hungry = result.days.filter((day) => !day.plan.fed).length;
  const hurt = sum((day) => day.hurt);
  const n = result.days.length;
  const said = [`${n} day${n === 1 ? '' : 's'} ${leg === 'out' ? 'out' : 'back'}: ${grown ? `the farms grew ${grown} food and ` : ''}everyone ate ${eaten}${dug ? `; the mines dug ${dug} materials` : ''}.`];
  if (hungry) said.push(`Short of food on ${hungry} day${hungry === 1 ? '' : 's'}: ${hurt} hit points lost.`);
  const rough = result.days[0]?.plan.rough ?? [];
  if (rough.length) said.push(`With no bed and air at the colony, ${listed(rough.map((id) => before.crew.find((member) => member.id === id)?.name ?? '?'))} didn't rest.`);
  const left = result.stopped ? result.campaign.colony.trip?.leg?.left ?? 0 : 0;
  if (left) said.push(`${pursuerOf(before, rules)?.name ?? 'The pursuer'}'s lander is down at the colony: the ship waits, ${left} day${left === 1 ? '' : 's'} still to fly, while those at home face it.`);
  else if (leg === 'out') said.push(`The squad is at ${result.plan.place.name}.`);
  else said.push(`The ship is home. ${broughtText(before.colony.trip?.result ?? null, before, rules)}`, ...questNoteLines(before.colony.trip?.result?.quest ?? null, rules, before));
  return { text: said.join(' '), tone: hungry || left ? 'bad' : 'good' };
}

// What a trip brought home, in words.
function broughtText(result, campaign, rules) {
  if (!result) return 'It brought nothing.';
  const parts = result.won !== undefined ? result.parts : result.changes.parts;
  const materials = result.won !== undefined ? result.materials : result.changes.materials;
  const food = result.won !== undefined ? 0 : Math.max(0, result.changes.supplies);
  const arms = result.won !== undefined ? [] : result.changes.arms ?? [];
  const said = [...parts.map((type) => aPart(type, rules)), ...arms.map((id) => aWeapon(id, rules)), ...(materials ? [`${materials} materials`] : []), ...(food ? [`${food} food`] : [])];
  return said.length ? `It brought ${listed(said)}.` : 'It brought nothing.';
}

// The event at a place, as eventText.js has the run's: a choice that needs
// someone (M36) needs them in the squad.
function eventAt(event, campaign, rules) {
  const among = campaign.colony.trip?.squad ?? [];
  return {
    title: event.title,
    text: event.text,
    choices: event.choices.map((choice) => {
      const said = choiceSaid(choice, campaign, rules, among);
      return { ...said, ask: `${said.ask} Tap again to choose.` };
    }),
  };
}

// The squatters' derelict: who holds her, what a win brings and a loss
// costs, and Board her's first tap.
function heldText(campaign, rules) {
  const due = placeFightDue(campaign, rules);
  if (!due) return null;
  const counts = new Map();
  for (const id of due.party) {
    const name = rules.enemies.get(id)?.name ?? id;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const party = [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
  const [least, most] = due.materials;
  // A quest's place (M33b): the pursuer's men hold her, and winning does
  // the quest's step; losing leaves her for another trip.
  const quest = questPlaceText(due.place, rules);
  if (quest) {
    return {
      lines: [`${quest.line} Aboard: ${party}.`, `Win: ${quest.tag} is done, and ${due.salvage ? `${due.salvage} of her parts and ` : ''}${least} to ${most} materials.`, ...[gearLine(rules)].filter(Boolean), 'Lose: the squad comes back hurt, and she is still there. Or fly home and leave her for now.'],
      ask: `Board ${due.place.name}: the squad against her crew, aboard her. Tap again to board.`,
    };
  }
  return {
    lines: [`Squatters hold her: ${party}.`, `Win: strip ${due.salvage} of her parts, and ${least} to ${most} materials.`, ...[gearLine(rules)].filter(Boolean), 'Lose: the squad comes back hurt, with nothing. Or fly home and leave her be.'],
    ask: `Board ${due.place.name}: the squad against the squatters, aboard her. Tap again to board.`,
  };
}

// What came of a place: an event's choice, or a fight.
function resultAt(result, campaign, rules) {
  if (result.won !== undefined) {
    return result.won
      ? { title: 'Boarded and won', text: [broughtText(result, campaign, rules).replace('It brought', 'The squad took'), ...questNoteLines(result.quest ?? null, rules, campaign)].join(' ') }
      : { title: 'Beaten back', text: 'The squad came back aboard hurt, with nothing.' };
  }
  const event = rules.events.get(result.event);
  const choice = event?.choices.find((entry) => entry.id === result.choice);
  const outcome = choice?.outcomes[result.outcome];
  const roll = result.roll === null || !outcome ? '' : ` Rolled ${result.roll}: the ${outcome.chance}% came up.`;
  return { title: event && choice ? `${event.title}: ${choice.label}` : 'Done', text: `${outcome?.text ?? ''}${roll} ${changesText(result.changes, campaign, rules)}`.trim() };
}

// A place's kind by name: the kind's, or for a world its own kind's; a
// quest's place (M33b), its quest's name.
function kindName(place, campaign, rules) {
  const quest = questPlaceText(place, rules);
  if (quest) return quest.tag;
  const kind = kindOf(place, rules);
  if (kind?.worlds) {
    const world = otherWorlds(campaign).find((entry) => entry.name === place.name)?.world;
    const worldKind = world && rules.worlds?.kinds.get(world.kind)?.name;
    if (worldKind) return worldKind;
  }
  return kind?.name ?? place.kind;
}

// "an Air plant", "a Corridor".
function aPart(type, rules) {
  const name = rules.modules.get(type)?.name ?? type;
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
