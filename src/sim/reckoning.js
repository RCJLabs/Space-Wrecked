// The reckoning (M56): the pursuer's leader comes for the colony the crew
// founded, once, and won, the pursuit is over. Pure.
//   - It is due on the founding colony's day reckoningDay, or from the
//     background's thread's pay-off (quests.js) reckoningAfter days on,
//     whichever is sooner; lost, reckoningAgain days after.
//   - Due, with no raid coming there, it is found at that day's end as a
//     raid is (raids.js raidDayEnd), its lander down reckoningWarning days
//     later, its party the leader's (data/backgrounds.json, the pursuer's
//     colony.reckoning: { party, leader, name, found, landing, won, lost }).
//   - Won, the campaign's ending is set and the pursuer finds the colony no
//     more; the epilogue tells it (ui/campaign/epilogue.js). Lost, it is a
//     raid lost, and the leader comes again.
//
//   campaign.reckoning  null, or { due }: the founding colony's day it is
//                       due from, once set (by the pay-off or a loss); with
//                       none, reckoningDay
//   campaign.ending     null, or { day, colony (its name), won: true }: the
//                       pursuit over, from the day it was won
import { pursuerOf } from './heat.js';

// The colony the crew founded, the one the leader comes for.
export const HOME = 1;

// The pursuer's reckoning (see above), or null.
export function reckoningOf(campaign, rules) {
  return pursuerOf(campaign, rules)?.colony?.reckoning ?? null;
}

// True once the pursuit is over.
export function pursuitOver(campaign) {
  return Boolean(campaign.ending?.won);
}

// The founding colony's day the reckoning is due from.
export function reckoningDay(campaign, rules) {
  return campaign.reckoning?.due ?? rules.balance.reckoningDay;
}

// True when the reckoning is due at the colony as it stands: the founding
// colony, its day come, no raid coming there, the pursuit not over.
export function reckoningDue(campaign, rules) {
  const { colony } = campaign;
  if (!colony || colony.id !== HOME || colony.raid || pursuitOver(campaign) || !reckoningOf(campaign, rules)) return false;
  return colony.day >= reckoningDay(campaign, rules);
}

// The founding colony's day: the colony's the ship is at, or from M38e the
// one kept among the others; null before act 3.
export function homeDay(campaign) {
  if (campaign.colony?.id === HOME) return campaign.colony.day;
  return campaign.colonies?.find((colony) => colony.id === HOME)?.day ?? null;
}

// The reckoning brought forward as the background's thread pays off
// (quests.js): reckoningAfter days on from the founding colony's day,
// unless it is due sooner. Before act 3, as it was.
export function afterPayoff(campaign, rules) {
  const day = homeDay(campaign);
  if (day === null) return campaign;
  const due = Math.min(reckoningDay(campaign, rules), day + rules.balance.reckoningAfter);
  return { ...campaign, reckoning: { due } };
}

// The reckoning's raid over at the founding colony on its day `day`: won,
// the ending; lost, due again reckoningAgain days on.
export function reckoningSettled(campaign, rules, won, day) {
  if (won) return { ...campaign, ending: { day, colony: campaign.colony?.world?.name ?? null, won: true } };
  return { ...campaign, reckoning: { due: day + rules.balance.reckoningAgain } };
}
