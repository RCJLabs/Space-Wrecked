// Words for the game's end (over.js, M41): where death is permanent and no
// one is left aboard. Who fell, and how far the game came. Pure.
import { actTitle } from './hubText.js';

// { title, line, fallen: [{ name, about }], record: [[label, value]] }.
export function overText(campaign, rules) {
  const { flags } = campaign;
  const count = (name) => flags[name] ?? 0;
  const fights = count('fightsWon') + count('fightsLost');
  const colonies = campaign.colony ? 1 + (campaign.colonies?.length ?? 0) : 0;
  return {
    title: 'The end',
    line: `No one is left aboard. The game ends in ${actTitle(campaign.act, rules)}.`,
    fallen: (campaign.fallen ?? []).map((member) => ({ name: member.name, about: `${rules.jobs.get(member.job)?.name ?? member.job} · act ${member.act}` })),
    record: [
      ['Difficulty', `${campaign.difficulty[0].toUpperCase()}${campaign.difficulty.slice(1)}, death permanent`],
      ['Fights', fights ? `${count('fightsWon')} won, ${count('fightsLost')} lost` : 'None'],
      ['Jobs', count('jobsDone') || count('jobsFailed') ? `${count('jobsDone')} done, ${count('jobsFailed')} lost` : 'None'],
      ['Sectors', `${campaign.run?.past.length ?? 0} crossed`],
      ['Colonies', colonies ? `${colonies} settled, day ${campaign.colony.day}` : 'None'],
      ['Lost', `${count('crewLost')} of the crew${count('captainsLost') ? `, ${count('captainsLost')} captain${count('captainsLost') === 1 ? '' : 's'} among them` : ''}`],
    ],
  };
}
