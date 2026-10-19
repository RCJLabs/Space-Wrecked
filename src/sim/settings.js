// Player settings, saved with the game. Pure: plain data in, plain data out.
//   fpsCap      60, or 30 to save battery
//   forgiving   forgiving odds (ROADMAP §4.3): each miss in a row makes the
//               crew's next shot likelier, from the next fight on
//   motion      'auto' (as the phone is set), 'reduce' or 'full'
//   tips        whether the first-run tips show
//   tipsSeen    the ids of the tips already put away
//   sound       whether the game plays sound (M35)
//   volume      how loud, in percent: one of VOLUMES
// The difficulty was a setting too until M41, when it became the
// campaign's (difficulty.js).

// 60 is the target; 30 is the battery setting.
export const FPS_CAPS = [60, 30];
export const MOTIONS = ['auto', 'reduce', 'full'];
// The volumes to pick from, in percent; a new game starts at 70 (Evan's
// pick, M35).
export const VOLUMES = [10, 30, 50, 70, 100];
// More tips than the game has: a guard on what a save can hold.
export const MAX_TIPS = 64;
const TIP_ID = /^[a-z][a-z0-9-]{0,31}$/;

export function defaultSettings() {
  return { fpsCap: 60, forgiving: false, motion: 'auto', tips: true, tipsSeen: [], sound: true, volume: 70 };
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
