// Text for the settings screen (settings.js): each setting's choices, and
// what the one picked does, its numbers from data/balance.json. Pure.
import { DIFFICULTIES, enemyBonus, gunneryBonus } from '../sim/difficulty.js';
import { COLORS, FPS_CAPS, MOTIONS, TEXT_SIZES, VOLUMES } from '../sim/settings.js';

// The rows, in order: [{ key, title, choices: [{ value, label }], value,
// action, line }]. key is the setting (sim/settings.js); value is the one
// picked, and a choice's tap dispatches action with its value; line says
// what the value picked does. From M41 the difficulty is the game's: its
// row shows with a campaign under way (not one over) and sets it
// (campaign/difficulty).
export function settingsText(settings, balance, campaign = null) {
  const rows = [
    {
      key: 'sound',
      title: 'Sound',
      choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
      line: settings.sound ? 'Taps, the builder, fights and the voyage all sound, from your first tap.' : 'No sound.',
    },
    {
      key: 'volume',
      title: 'Volume',
      choices: VOLUMES.map((value) => ({ value, label: `${value}%` })),
      line: settings.sound ? `Every sound at ${settings.volume}%.` : `Every sound at ${settings.volume}%, once sound is on.`,
    },
    campaign && campaign.crew.length
      ? {
          key: 'difficulty',
          title: 'Difficulty',
          choices: DIFFICULTIES.map((value) => ({ value, label: capitalize(value) })),
          value: campaign.difficulty,
          action: 'campaign/difficulty',
          line: `${difficultyLine(campaign.difficulty, balance)} This game, from the next fight.${campaign.permadeath ? ' Death is permanent in it.' : ''}`,
        }
      : null,
    {
      key: 'forgiving',
      title: 'Forgiving odds',
      choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
      line: settings.forgiving
        ? `Each miss in a row adds ${balance.forgivingStep} to the crew's next shot, up to ${balance.forgivingMax}. The odds shown include it. From the next fight.`
        : 'Every shot is its odds, miss after miss. From the next fight.',
    },
    {
      key: 'fog',
      title: 'Fog of war',
      choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
      line: settings.fog
        ? "In a fight, an enemy no one in the crew can see is hidden. The enemy still knows where the crew is."
        : 'Every enemy in a fight shows, seen or not.',
    },
    {
      key: 'motion',
      title: 'Motion',
      choices: MOTIONS.map((value) => ({ value, label: { auto: 'As the phone', reduce: 'Reduce', full: 'Full' }[value] })),
      line: {
        auto: 'As the phone is set: reduced if it asks for less motion.',
        reduce: "The stars stand still, the ship lifts off without moving, nothing fades, and an enemy's turn in a fight shows its end at once.",
        full: 'Everything moves, whatever the phone asks.',
      }[settings.motion],
    },
    {
      key: 'colors',
      title: 'Colors',
      choices: COLORS.map((value) => ({ value, label: { standard: 'Standard', safe: 'Colorblind-safe' }[value] })),
      line: {
        standard: 'The game as drawn. Every color that tells you something has a shape or a word with it too.',
        safe: 'Colors picked to stay apart for every kind of colorblindness: good is blue, danger magenta, warnings near white.',
      }[settings.colors],
    },
    {
      key: 'textSize',
      title: 'Text size',
      choices: TEXT_SIZES.map((value) => ({ value, label: `${value}%` })),
      line: settings.textSize === 100 ? 'Text as drawn.' : `Every word ${settings.textSize}% as big, in the panels and on the board. Long lists scroll.`,
    },
    {
      key: 'fpsCap',
      title: 'Frame rate',
      choices: FPS_CAPS.map((value) => ({ value, label: `${value} fps` })),
      line: settings.fpsCap === 60 ? 'Smooth.' : 'Easier on the battery.',
    },
    {
      key: 'tips',
      title: 'Tips',
      choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
      line: settings.tips
        ? `Tips show the first time you build, take a job and fight. ${settings.tipsSeen.length ? `${settings.tipsSeen.length} put away so far.` : 'None put away yet.'}`
        : 'No tips.',
    },
  ];
  return rows.filter(Boolean).map((row) => ({ value: settings[row.key], action: `settings/${row.key}`, ...row }));
}

// "Enemies aim 10 worse and have 1 hit point fewer; their ships' guns aim
// 10 worse." (M41: the guns too.)
export function difficultyLine(difficulty, balance) {
  const { aim = 0, hp = 0 } = enemyBonus(difficulty, balance);
  const guns = gunneryBonus(difficulty, balance);
  if (!aim && !hp && !guns) return 'Enemies as they come.';
  const parts = [];
  if (aim) parts.push(`aim ${Math.abs(aim)} ${aim > 0 ? 'better' : 'worse'}`);
  if (hp) parts.push(`have ${Math.abs(hp)} hit point${Math.abs(hp) === 1 ? '' : 's'} ${hp > 0 ? 'more' : 'fewer'}`);
  const ships = guns ? `; their ships' guns aim ${Math.abs(guns)} ${guns > 0 ? 'better' : 'worse'}` : '';
  return `Enemies ${parts.join(' and ')}${ships}.`;
}

function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}
