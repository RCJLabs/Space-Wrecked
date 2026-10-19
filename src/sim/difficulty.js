// The game's difficulty (M41, ROADMAP §4.3): Easy, Normal or Hard, what the
// enemy brings. It is the campaign's (campaign.difficulty), picked at New
// game and changed in Settings from the next fight; permanent death
// (campaign.permadeath) is picked at New game and kept for the game. Until
// M41 the difficulty was a setting (settings.js); a save from before takes
// its setting as its campaign's (core/save.js). Pure.
//   in a fight     each enemy's aim and hit points (enemyBonus): from act
//                  1's jobs to a raid fought out where the ship isn't
//   in an approach the enemy ship's gunnery (gunneryBonus)
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

// What the enemy brings to a fight at a difficulty, to add to each enemy's
// numbers (battle.js bonus): balance.json's easyEnemyAim and the rest.
// Normal adds nothing.
export function enemyBonus(difficulty, balance) {
  if (difficulty === 'easy') return { aim: balance.easyEnemyAim, hp: balance.easyEnemyHp };
  if (difficulty === 'hard') return { aim: balance.hardEnemyAim, hp: balance.hardEnemyHp };
  return {};
}

// What an enemy ship's guns add to their hit chance in an approach at a
// difficulty (approach.js sideStats aim): easyEnemyGunnery or
// hardEnemyGunnery; Normal adds nothing.
export function gunneryBonus(difficulty, balance) {
  if (difficulty === 'easy') return balance.easyEnemyGunnery ?? 0;
  if (difficulty === 'hard') return balance.hardEnemyGunnery ?? 0;
  return 0;
}

// What a fight takes as it starts: forgiving odds from the settings
// (settings.js fightSettings), the campaign's difficulty, and whether death
// is permanent. A fight keeps them to its end.
export function fightSetup(campaign, setup = {}) {
  return { forgiving: setup.forgiving === true, difficulty: difficultyOf(campaign), permadeath: campaign.permadeath === true };
}

// The campaign's difficulty: Normal for one that names none.
export function difficultyOf(campaign) {
  return DIFFICULTIES.includes(campaign?.difficulty) ? campaign.difficulty : 'normal';
}

// The campaign at another difficulty (Settings): { ok: true, campaign }, or
// { ok: false, error } for one that isn't Easy, Normal or Hard. It holds
// from the next fight; one under way keeps its own.
export function setDifficulty(campaign, value) {
  if (!DIFFICULTIES.includes(value)) return { ok: false, error: 'The difficulty is Easy, Normal or Hard.' };
  return { ok: true, campaign: value === campaign.difficulty ? campaign : { ...campaign, difficulty: value } };
}
