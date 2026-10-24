// Player settings, saved with the game. Pure: plain data in, plain data out.
//   fpsCap      60, or 30 to save battery
//   forgiving   forgiving odds (ROADMAP §4.3): each miss in a row makes the
//               crew's next shot likelier, from the next fight on
//   motion      'auto' (as the phone is set), 'reduce' or 'full'
//   tips        whether the first-run tips show
//   tipsSeen    the ids of the tips already put away
//   sound       whether the game plays sound (M35)
//   volume      how loud, in percent: one of VOLUMES
//   colors      'standard', or 'safe' for colorblind-safe colors (M42)
//   textSize    how big the text is, in percent: one of TEXT_SIZES (M42)
//   fog         fog of war (M45): in a fight, an enemy no one in the crew
//               can see is hidden. Only what the screen shows changes
//   hand        'right', or 'left' to mirror the side columns (M47)
//   speed       the playback's speed, in percent: one of SPEEDS (M47)
//   confirm     'taps' (a second tap confirms) or 'hold' (a hold does, M47)
//   vibration   whether the phone vibrates on hits (M47)
//   captions    whether each sound the game makes is shown in words too (M49)
//   reading     'standard', or 'readable' for text spaced for easier reading
//               (M49)
// The difficulty was a setting too until M41, when it became the
// campaign's (difficulty.js).

// 60 is the target; 30 is the battery setting.
export const FPS_CAPS = [60, 30];
export const MOTIONS = ['auto', 'reduce', 'full'];
// The volumes to pick from, in percent; a new game starts at 70 (Evan's
// pick, M35).
export const VOLUMES = [10, 30, 50, 70, 100];
// The color sets (src/render/palette.js COLOR_SETS) and the text sizes, in
// percent (M42).
export const COLORS = ['standard', 'safe'];
export const TEXT_SIZES = [100, 115, 130];
// Controls and feel (M47): which hand the orders sit for, how fast a fight's
// and an approach's playback runs, in percent, and what confirms.
export const HANDS = ['right', 'left'];
export const SPEEDS = [100, 150, 200];
export const CONFIRMS = ['taps', 'hold'];
// Senses (M49): how the text is set.
export const READINGS = ['standard', 'readable'];
// More tips than the game has: a guard on what a save can hold.
export const MAX_TIPS = 64;
const TIP_ID = /^[a-z][a-z0-9-]{0,31}$/;

export function defaultSettings() {
  return { fpsCap: 60, forgiving: false, motion: 'auto', tips: true, tipsSeen: [], sound: true, volume: 70, colors: 'standard', textSize: 100, fog: false, hand: 'right', speed: 100, confirm: 'taps', vibration: true, captions: false, reading: 'standard' };
}

// Actions:
//   settings/fpsCap { value }       60 or 30
//   settings/forgiving { value }    true or false
//   settings/motion { value }       auto, reduce or full
//   settings/tips { value }         tips on or off
//   settings/tips/reset             tips on, and every tip shows again
//   settings/tip/seen { id }        a tip put away, not to show again
//   settings/sound { value }        sound on or off
//   settings/volume { value }       one of VOLUMES
//   settings/colors { value }       standard or safe
//   settings/textSize { value }     one of TEXT_SIZES
//   settings/fog { value }          fog of war on or off (M45)
//   settings/hand { value }         right or left (M47)
//   settings/speed { value }        one of SPEEDS (M47)
//   settings/confirm { value }      taps or hold (M47)
//   settings/vibration { value }    vibration on or off (M47)
//   settings/captions { value }     captions on or off (M49)
//   settings/reading { value }      standard or readable (M49)
export function reduceSettings(settings, action) {
  const set = (key, ok) => (!ok || action.value === settings[key] ? settings : { ...settings, [key]: action.value });
  switch (action.type) {
    case 'settings/fpsCap':
      return set('fpsCap', FPS_CAPS.includes(action.value));
    case 'settings/forgiving':
      return set('forgiving', typeof action.value === 'boolean');
    case 'settings/motion':
      return set('motion', MOTIONS.includes(action.value));
    case 'settings/tips':
      return set('tips', typeof action.value === 'boolean');
    case 'settings/sound':
      return set('sound', typeof action.value === 'boolean');
    case 'settings/volume':
      return set('volume', VOLUMES.includes(action.value));
    case 'settings/colors':
      return set('colors', COLORS.includes(action.value));
    case 'settings/textSize':
      return set('textSize', TEXT_SIZES.includes(action.value));
    case 'settings/fog':
      return set('fog', typeof action.value === 'boolean');
    case 'settings/hand':
      return set('hand', HANDS.includes(action.value));
    case 'settings/speed':
      return set('speed', SPEEDS.includes(action.value));
    case 'settings/confirm':
      return set('confirm', CONFIRMS.includes(action.value));
    case 'settings/vibration':
      return set('vibration', typeof action.value === 'boolean');
    case 'settings/captions':
      return set('captions', typeof action.value === 'boolean');
    case 'settings/reading':
      return set('reading', READINGS.includes(action.value));
    case 'settings/tips/reset':
      return settings.tips && !settings.tipsSeen.length ? settings : { ...settings, tips: true, tipsSeen: [] };
    case 'settings/tip/seen':
      if (!TIP_ID.test(action.id ?? '') || settings.tipsSeen.includes(action.id) || settings.tipsSeen.length >= MAX_TIPS) return settings;
      return { ...settings, tipsSeen: [...settings.tipsSeen, action.id] };
    default:
      return settings;
  }
}

// What a saved settings object gets wrong, in words; empty when it reads.
export function settingsProblems(settings) {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return ['Settings are missing.'];
  const problems = [];
  if (!FPS_CAPS.includes(settings.fpsCap)) problems.push('The frame cap setting is invalid.');
  if (typeof settings.forgiving !== 'boolean') problems.push('The forgiving odds setting is invalid.');
  if (!MOTIONS.includes(settings.motion)) problems.push('The motion setting is invalid.');
  if (typeof settings.sound !== 'boolean') problems.push('The sound setting is invalid.');
  if (!VOLUMES.includes(settings.volume)) problems.push('The volume setting is invalid.');
  if (!COLORS.includes(settings.colors)) problems.push('The colors setting is invalid.');
  if (!TEXT_SIZES.includes(settings.textSize)) problems.push('The text size setting is invalid.');
  if (typeof settings.fog !== 'boolean') problems.push('The fog of war setting is invalid.');
  if (!HANDS.includes(settings.hand)) problems.push('The hand setting is invalid.');
  if (!SPEEDS.includes(settings.speed)) problems.push('The playback speed setting is invalid.');
  if (!CONFIRMS.includes(settings.confirm)) problems.push('The confirm setting is invalid.');
  if (typeof settings.vibration !== 'boolean') problems.push('The vibration setting is invalid.');
  if (typeof settings.captions !== 'boolean') problems.push('The captions setting is invalid.');
  if (!READINGS.includes(settings.reading)) problems.push('The reading setting is invalid.');
  const { tipsSeen } = settings;
  if (typeof settings.tips !== 'boolean' || !Array.isArray(tipsSeen) || tipsSeen.length > MAX_TIPS || !tipsSeen.every((id) => TIP_ID.test(id)) || new Set(tipsSeen).size !== tipsSeen.length) {
    problems.push('The tips settings are unreadable.');
  }
  return problems;
}

// What a fight takes from the settings as it starts: { forgiving }
// (contracts.js takeJob, raid.js beginRaid, campaign.js beginFight); the
// difficulty and permanent death are the campaign's (difficulty.js
// fightSetup, M41). A fight keeps them to its end.
export function fightSettings(settings) {
  return { forgiving: settings.forgiving === true };
}
