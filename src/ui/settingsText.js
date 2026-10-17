// Text for the settings screen (settings.js): each setting's choices, and
// what the one picked does, its numbers from data/balance.json. Pure.
import { DIFFICULTIES, enemyBonus, FPS_CAPS, MOTIONS, VOLUMES } from '../sim/settings.js';

// The rows, in order: [{ key, title, choices: [{ value, label }], line }].
// key is the setting (sim/settings.js); line says what the value picked
// does.
export function settingsText(settings, balance) {
  return [
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
    {
      key: 'difficulty',
      title: 'Difficulty',
      choices: DIFFICULTIES.map((value) => ({ value, label: capitalize(value) })),
      line: `${difficultyLine(settings.difficulty, balance)} From the next fight.`,
    },
    {
      key: 'forgiving',
      title: 'Forgiving odds',
      choices: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
      line: settings.forgiving
        ? `Each miss in a row adds ${balance.forgivingStep} to the crew's next shot, up to ${balance.forgivingMax}. The odds shown include it. From the next fight.`
        : 'Every shot is its odds, miss after miss. From the next fight.',
    },
    {
      key: 'motion',
      title: 'Motion',
      choices: MOTIONS.map((value) => ({ value, label: { auto: 'As the phone', reduce: 'Reduce', full: 'Full' }[value] })),
      line: {
        auto: 'As the phone is set: reduced if it asks for less motion.',
        reduce: 'The stars stand still, the ship lifts off without moving, and nothing fades.',
        full: 'Everything moves, whatever the phone asks.',
      }[settings.motion],
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
}

// "Enemies aim 10 worse and have 1 hit point fewer."
export function difficultyLine(difficulty, balance) {
  const { aim = 0, hp = 0 } = enemyBonus(difficulty, balance);
  if (!aim && !hp) return 'Enemies as they come.';
  const parts = [];
  if (aim) parts.push(`aim ${Math.abs(aim)} ${aim > 0 ? 'better' : 'worse'}`);
  if (hp) parts.push(`have ${Math.abs(hp)} hit point${Math.abs(hp) === 1 ? '' : 's'} ${hp > 0 ? 'more' : 'fewer'}`);
  return `Enemies ${parts.join(' and ')}.`;
}

function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}
