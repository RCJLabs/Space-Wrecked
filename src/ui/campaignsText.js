// The words of the Campaigns screen (M63, campaigns.js): what a slot or a
// backup holds, from slotState (src/core/slots.js). Pure, for the tests.
import { BACKUP_NAMES } from '../core/slots.js';
import { continueText } from './campaign/hubText.js';

// "Act 2 · Sector 1 · Ashfall", "Empty", "No campaign" or "Can't be read".
export function slotLine(state, rules) {
  if (state.kind === 'campaign') return continueText(state.campaign, rules);
  if (state.kind === 'broken') return "Can't be read";
  return state.kind === 'none' ? 'No campaign' : 'Empty';
}

// A backup's title and line: { title: 'Before act 2', line }.
export function backupText(backup, rules) {
  return { title: BACKUP_NAMES[backup.kind], line: slotLine(backup.state, rules) };
}

export const NO_BACKUPS = 'None yet. One is kept before act 2, one before act 3, and one when a campaign is replaced.';

// The title's reminder (slots.js reminderDue): the campaign has reached an
// act with no save code made since.
export function reminderText(campaign) {
  return `Act ${campaign.act}: back this campaign up with a save code, kept somewhere safe.`;
}
