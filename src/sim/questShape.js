// What a campaign's quests (quests.js, M33b) must look like in a save, for
// the save's checks (campaign.js campaignProblems), and the quests a new
// campaign starts with. Shape only: whether a quest is the content's is the
// rules' business. Pure; imports nothing, so campaign.js can ask without
// taking in the rules quests.js plays by.

// Where a quest is: its step open, or the quest done, or gone cold.
export const QUEST_STATES = ['open', 'done', 'cold'];
// More quests than the content has, and more steps than a quest takes
// (tools/validate-quests.js holds the data to it): guards on what a save
// can hold.
export const MAX_QUESTS = 32;
export const MAX_STEPS = 6;
const MAX_CHANGE = 9999;
const ID = /^[a-z][a-z0-9-]*$/;

// The quests a new campaign starts with: its background's thread, at its
// first step. { [id]: { step: 0, state: 'open' } }.
export function startingQuests(rules, background) {
  return Object.fromEntries([...(rules.quests?.values() ?? [])].filter((quest) => quest.background === background).map((quest) => [quest.id, { step: 0, state: 'open' }]));
}

// The quest gone cold where it stands, if its step is open: { campaign,
// note }, the note what came of it (QUEST_MOVES), or null with nothing to
// end. Here rather than in quests.js (which hands it on) so campaign.js can
// end a fallen companion's loyalty quest (M41).
export function endCold(campaign, id) {
  const at = campaign.quests?.[id];
  if (at?.state !== 'open') return { campaign, note: null };
  return { campaign: { ...campaign, quests: { ...campaign.quests, [id]: { ...at, state: 'cold' } } }, note: { quest: id, did: 'cold', step: at.step, changes: { credits: 0, heat: 0, standing: [] } } };
}

// campaign.quests: { [id]: { step, state } }, step the index of the step
// open (or the last one reached, once the quest is over).
export function isQuests(value) {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_QUESTS && entries.every(([id, at]) => ID.test(id) && isRecord(at) && isInt(at.step, 0, MAX_STEPS - 1) && QUEST_STATES.includes(at.state));
}

// What came of a quest where it moved (quests.js stepDone and the rest),
// as a result keeps it for the screens: { quest, did, step, changes }. did
// is 'done' (a step done, the quest going on), 'finished' (its last step
// done), 'cold' or 'started'; changes are what the step and the pay-off
// came to: { credits, heat, standing: [{ side, by, from, to }] }.
export const QUEST_MOVES = ['done', 'finished', 'cold', 'started'];
export function isQuestNote(note) {
  if (!isRecord(note) || !ID.test(note.quest ?? '') || !QUEST_MOVES.includes(note.did) || !isInt(note.step, 0, MAX_STEPS - 1)) return false;
  const { changes } = note;
  return (
    isRecord(changes) &&
    isInt(changes.credits, -MAX_CHANGE, MAX_CHANGE) &&
    isInt(changes.heat, -MAX_CHANGE, MAX_CHANGE) &&
    Array.isArray(changes.standing) &&
    changes.standing.every((move) => isRecord(move) && ID.test(move.side ?? '') && [move.by, move.from, move.to].every((n) => isInt(n, -MAX_CHANGE, MAX_CHANGE)))
  );
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}
