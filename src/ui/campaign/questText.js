// Text for the quests (M33b, src/sim/quests.js): the quests' panel at the
// hangar, on the chart and at the colony; a quest's job on the board and at
// its fight's end; a quest's node on the chart and what its event did; the
// colony's quest place and the pay-off at its fight's end; the odds a
// pursuer eased off finds the colony at; and the warnings before quests go
// cold. rules are the content tables (src/sim/defs.js).
import { pursuerOf } from '../../sim/heat.js';
import { eased, openStep, questOf, stepDone } from '../../sim/quests.js';
import { changeLines, signed } from './standingText.js';

const LABELS = { done: 'Done', cold: 'Gone cold' };

// The quests the campaign has, in the data's order, for a home's panel:
// [{ id, name, state ('open', 'done' or 'cold'), label ("Step 2 of 3",
// "Done", "Gone cold"), next (the open step's words, or what came of the
// quest), line (all of it, for a screen reader) }].
export function questsText(campaign, rules) {
  return [...rules.quests.values()]
    .filter((quest) => campaign.quests?.[quest.id])
    .map((quest) => {
      const { step, state } = campaign.quests[quest.id];
      const label = state === 'open' ? `Step ${step + 1} of ${quest.steps.length}` : LABELS[state];
      const next = state === 'open' ? quest.steps[step]?.next ?? '' : state === 'done' ? doneLine(quest, campaign, rules) : 'A step was left undone in its act.';
      return { id: quest.id, name: quest.name, state, label, next, line: `${quest.name}: ${label.toLowerCase()}. ${next}` };
    });
}

// What a quest done left: a thread's pursuer easing off, or the side's
// chain's thanks.
function doneLine(quest, campaign, rules) {
  if (quest.payoff?.eased) return `${pursuerOf(campaign, rules)?.name ?? 'The pursuer'} has eased off: its raids come half as often.`;
  return quest.side ? `${capital(rules.factions.sides.get(quest.side)?.name ?? quest.side)} remember${rules.factions.sides.get(quest.side)?.name?.endsWith('s') ? '' : 's'} it.` : 'Done.';
}

// A quest's job on the board (quests.js questJobs): { tag (the quest's
// name), fact ("Step 1 of 3 of the miner's debt. Done, heat −20 on top.") },
// or null for any other job.
export function questJobText(job, rules) {
  const quest = job?.quest ? questOf(rules, job.quest) : null;
  if (!quest) return null;
  const index = quest.steps.findIndex((step) => step.job === job.contract);
  const step = quest.steps[index];
  const more = effectsSaid(step?.effects ?? {}, rules);
  return { tag: quest.name, fact: `Step ${index + 1} of ${quest.steps.length} of ${lower(quest.name)}.${more ? ` Done, ${more} on top.` : ''}` };
}

// A quest's job done, for its fight's end panel, before the crew goes home:
// ["The miner's debt: Your file is gone… Heat −20."]; none for a job lost
// or any other job.
export function questJobEnd(job, won, campaign, rules) {
  const quest = won && job?.quest ? questOf(rules, job.quest) : null;
  const step = quest?.steps.find((entry) => entry.job === job.contract);
  if (!step) return [];
  const { note } = stepDone(campaign, rules, quest.id);
  return note ? [`${quest.name}: ${step.said}`, ...noteChanges(note, rules)] : [];
}

// A fight at a quest's place won, for its end panel, before the crew goes
// home: what the quest came to (questNoteLines); none lost, or at any other
// place.
export function questPlaceEnd(place, won, campaign, rules) {
  if (!won || !place?.quest) return [];
  return questNoteLines(stepDone(campaign, rules, place.quest).note, rules, campaign);
}

// What came of a quest where it moved (questShape.js isQuestNote): lines
// for an event's result, a fight's end or the homecoming. started: "A new
// quest: The tender's stores. …"; done: "The miner's debt: step 2 of 3
// done. Next: …"; finished: the quest done, its pay-off's words and what
// they came to; cold: "… has gone cold."
export function questNoteLines(note, rules, campaign = null) {
  const quest = note ? questOf(rules, note.quest) : null;
  if (!quest) return [];
  if (note.did === 'started') return [`A new quest: ${quest.name}. ${quest.steps[0]?.next ?? ''}`.trim()];
  if (note.did === 'cold') return [`${quest.name} has gone cold.`];
  if (note.did === 'done') {
    const next = quest.steps[note.step + 1];
    return [`${quest.name}: step ${note.step + 1} of ${quest.steps.length} done.${next ? ` Next: ${next.next}` : ''}`, ...noteChanges(note, rules)];
  }
  return [`${quest.name}: done.${quest.payoff?.said ? ` ${quest.payoff.said}` : ''}`, ...noteChanges(note, rules)];
}

// A note's changes, a line each: "Heat −30.", credits, and the sides'.
function noteChanges(note, rules) {
  const { credits, heat, standing } = note.changes;
  return [...(heat ? [`Heat ${signed(heat)}.`] : []), ...(credits ? [`${signed(credits)} credits.`] : []), ...changeLines(standing, rules)];
}

// What a step's effects add, in a run of words: "heat −20" (credits and
// the sides' too), or '' for nothing.
function effectsSaid(effects, rules) {
  const parts = [];
  if (effects.heat) parts.push(`heat ${signed(effects.heat)}`);
  if (effects.credits) parts.push(`${signed(effects.credits)} credits`);
  for (const [side, by] of Object.entries(effects.standing ?? {})) parts.push(`${rules.factions.sides.get(side)?.name ?? side} ${signed(by)}`);
  return parts.join(', ');
}

// What a choice at an event does to the quests (quests.js atEvent), for
// its first tap: at a quest's node, "It does step 2 of 3 of the miner's
// debt.", "It ends the tender's stores.", or for any other choice there
// "The miner's debt waits for the next sector."; a side's chain's start,
// "It starts a quest: The tender's stores."; else null.
export function choiceQuestSaid(campaign, rules, node, eventId, choiceId) {
  const open = node?.quest ? openStep(campaign, rules, node.quest) : null;
  if (open && open.step.act === 2 && open.step.event === eventId) {
    const { quest, index } = open;
    if (open.step.done.includes(choiceId)) return `It does step ${index + 1} of ${quest.steps.length} of ${lower(quest.name)}.`;
    if ((open.step.cold ?? []).includes(choiceId)) return `It ends ${lower(quest.name)}.`;
    return `${quest.name} waits for the next sector.`;
  }
  const starts = [...rules.quests.values()].find((quest) => quest.start?.event === eventId && quest.start.choice === choiceId && !campaign.quests?.[quest.id]);
  return starts ? `It starts a quest: ${starts.name}.` : null;
}

// A quest's node on the chart (quests.js placeQuests): { name (the
// quest's), line ("The miner's debt: Con-Reg's courier, with your paper
// filed again.") }, or null for any other node.
export function questNodeText(node, rules) {
  const quest = node?.quest ? questOf(rules, node.quest) : null;
  if (!quest) return null;
  const step = quest.steps.find((entry) => entry.event === node.event);
  return { name: quest.name, line: `${quest.name}: ${(step?.next ?? '').replace(/: marked on the chart.*$/, '.')}` };
}

// A quest's place at the colony (quests.js questPlaces): { tag (the
// quest's name), line (the place's words) }, or null for any other place.
export function questPlaceText(place, rules) {
  const quest = place?.quest ? questOf(rules, place.quest) : null;
  const step = quest?.steps.find((entry) => entry.act === 3);
  if (!step?.place) return null;
  return { tag: quest.name, line: step.place.text };
}

// Why the colony's odds are halved, once the background's thread is done:
// "half the odds since Con-Reg Recovery eased off". Null before.
export function easedSaid(campaign, rules) {
  if (!eased(campaign, rules)) return null;
  return `${rules.balance.easedOdds === 50 ? 'half' : `${rules.balance.easedOdds}% of`} the odds since ${pursuerOf(campaign, rules)?.name ?? 'the pursuer'} eased off`;
}

// The words before quests go cold (quests.js coldAt's): "Launching ends
// the miner's debt: its step here isn't done." Null for none.
export function coldWarning(quests, how) {
  if (!quests.length) return null;
  const names = quests.map((quest) => lower(quest.name));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `${how} ends ${list}: ${quests.length > 1 ? 'their steps' : 'its step'} here ${quests.length > 1 ? "aren't" : "isn't"} done.`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "the miner's debt" from "The miner's debt", as a quest's name runs on in
// a sentence.
function lower(text) {
  return text.startsWith('The ') ? `the ${text.slice(4)}` : text;
}
