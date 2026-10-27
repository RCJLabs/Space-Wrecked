// Words for the epilogue (epilogue.js, M56): the reckoning won, the
// pursuit over. The background's own words, the colony as it stands, the
// crew and the fallen, and how far the run came. Pure.
import { fullName } from '../../sim/crewLook.js';
import { pursuerOf } from '../../sim/heat.js';
import { HOME, reckoningOf } from '../../sim/reckoning.js';

// { title, line, words, colony: [[label, value]], crew: [{ name, about }],
// fallen: [{ name, about }], record: [[label, value]] }.
export function epilogueText(campaign, rules) {
  const { flags, ending } = campaign;
  const count = (name) => flags[name] ?? 0;
  const leader = reckoningOf(campaign, rules);
  const pursuer = pursuerOf(campaign, rules)?.name ?? 'The pursuer';
  const home = [campaign.colony, ...(campaign.colonies ?? [])].find((colony) => colony?.id === HOME) ?? campaign.colony;
  const others = (campaign.colonies?.length ?? 0) + (campaign.colony && campaign.colony.id !== HOME ? 1 : 0);
  const fights = count('fightsWon') + count('fightsLost');
  const job = (id) => rules.jobs.get(id)?.name ?? id;
  return {
    title: 'The pursuit is over',
    line: `${leader?.name ?? pursuer} beaten at ${ending?.colony ?? home?.world?.name ?? 'the colony'} on its day ${ending?.day ?? home?.day ?? 0}.`,
    words: leader?.won ?? '',
    colony: [
      ['World', home?.world?.name ?? 'None'],
      ['Day', `${home?.day ?? 0}`],
      ['Citizens', `${home?.citizens ?? 0}`],
      ['Buildings', `${home?.buildings?.length ?? 0}`],
      ...(others ? [['Other colonies', `${others}`]] : []),
    ],
    crew: [...campaign.crew].map((member) => ({ name: fullName(member), about: `${job(member.job)}${member.id === campaign.captain ? ' · captain' : ''} · ${member.fights ?? 0} fight${member.fights === 1 ? '' : 's'}` })),
    fallen: (campaign.fallen ?? []).map((member) => ({ name: member.name, about: `${job(member.job)} · act ${member.act}` })),
    record: [
      ['Difficulty', `${campaign.difficulty[0].toUpperCase()}${campaign.difficulty.slice(1)}${campaign.permadeath ? ', death permanent' : ''}`],
      ['Fights', fights ? `${count('fightsWon')} won, ${count('fightsLost')} lost` : 'None'],
      ['Jobs', count('jobsDone') || count('jobsFailed') ? `${count('jobsDone')} done, ${count('jobsFailed')} lost` : 'None'],
      ['Sectors', `${campaign.run?.past.length ?? 0} crossed`],
      ['Raids', count('colonyRaidsWon') || count('colonyRaidsLost') ? `${count('colonyRaidsWon')} beaten, ${count('colonyRaidsLost')} lost` : 'None'],
      ['Lost', count('crewLost') ? `${count('crewLost')} of the crew` : 'No one'],
    ],
  };
}
