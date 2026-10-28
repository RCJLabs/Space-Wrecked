// Words for a new game's last screen (startGame.js, M41): how hard the game
// is, and whether death is permanent in it, for the background and captain
// picked on the screens before. Pure.
import { DIFFICULTIES } from '../../sim/difficulty.js';
import { difficultyLine } from '../settingsText.js';
import { weekLine } from '../runText.js';

// { sub, rows: [{ key, title, choices: [{ value, label }], value, line }],
// hint: { tone, text } }. draft is newGame.js's: { background, captain,
// difficulty, permadeath, weekly }. under: true when a campaign is under
// way, which Start replaces. week: this week's key (M64), for its row.
export function startText(rules, draft, under = false, week = null) {
  const background = rules.backgrounds.get(draft.background);
  const captain = draft.captain;
  const job = captain ? rules.jobs.get(captain.job)?.name.toLowerCase() : null;
  return {
    sub: [background?.name, captain ? `${captain.name.trim()}, ${job}` : null].filter(Boolean).join('. ') + '.',
    rows: [
      {
        key: 'difficulty',
        title: 'Difficulty',
        choices: DIFFICULTIES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
        value: draft.difficulty,
        line: `${difficultyLine(draft.difficulty, rules.balance)} You can change it in Settings, from the next fight.`,
      },
      {
        key: 'permadeath',
        title: 'Permanent death',
        choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
        value: draft.permadeath,
        line: draft.permadeath
          ? 'Anyone who bleeds out in a fight dies. If the captain dies, whoever has stood in the most fights takes command; with no one left aboard, the game is over. It holds for the whole game.'
          : 'Anyone who bleeds out in a fight comes back after it, badly hurt. It holds for the whole game.',
      },
      // The week's run (M64).
      ...(week
        ? [
            {
              key: 'weekly',
              title: 'Run',
              choices: [{ value: false, label: 'Your own' }, { value: true, label: "This week's" }],
              value: draft.weekly === true,
              line: weekLine(rules, week, draft.weekly === true),
            },
          ]
        : []),
    ],
    hint: { tone: 'good', text: `Tap Start to begin.${under ? ' This replaces the campaign under way.' : ''}` },
  };
}
