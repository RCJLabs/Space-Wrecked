// Launch (ROADMAP §2): act 1 ends when the ship lifts off with every line
// of its flight checklist passing (campaign.js shipChecklist: for the crew
// aboard, with what lifting off takes). The campaign moves on to the next
// act, at its hub, with its ship, crew, credits, parts on hand and heat;
// what was the district's stays behind: the job board and the shop's
// stock, which acts.js keeps to the hangar from then on. A raid at the
// door doesn't stop it: the pursuer finds an empty hangar (the flags say
// so, for the words), and heat goes along. Pure.
import { atHangar } from './acts.js';
import { ACTS, shipChecklist } from './campaign.js';
import { raidDue } from './heat.js';

// Why the campaign can't launch now, or null if it can.
export function launchProblem(campaign, rules) {
  if (!atHangar(campaign, rules)) return 'Launch from the hangar.';
  if (campaign.act >= ACTS) return 'There is nowhere further to go.';
  const open = shipChecklist(campaign, rules).filter((line) => line.ok !== true).length;
  if (open) return `Every flight check has to pass first: ${open} to go.`;
  return null;
}

// Launches: the campaign in the next act, at its hub. Returns { ok: true,
// campaign } or { ok: false, error }.
export function launch(campaign, rules) {
  const why = launchProblem(campaign, rules);
  if (why) return { ok: false, error: why };
  const flags = raidDue(campaign, rules) ? { ...campaign.flags, escapedRaid: true } : campaign.flags;
  return { ok: true, campaign: { ...campaign, act: campaign.act + 1, place: 'hub', board: [], shop: [], flags } };
}
