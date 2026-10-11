// Game identity. The display name lives here and in manifest.webmanifest only,
// so a rename touches those two files.
export const config = {
  title: 'Space Wrecked',
  shortName: 'Space Wrecked',

  // Stable internal id for storage keys, cache names and save codes.
  // Never change it, even on a rename: that would orphan every player's save.
  appId: 'wt',
};
