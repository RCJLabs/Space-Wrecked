// God mode, the ?dev=1 menu's (src/ui/dev/cheats.js): while it is on, the
// crew takes no damage in a fight (battle.js: a shot that hits them does 0,
// and fire and vacuum leave them be) and the ship none in an approach
// (approach.js: every hit on her is taken whole, as shields take one). Every
// roll is still made, so turning it on or off rerolls nothing.
//
// It is a switch the content carries to the simulation as rules.dev
// (src/platform/content.js devSwitches), set by the dev menu alone and never
// saved: a save is the same with it on or off, and every test and tool plays
// without it. Pure.
export function godMode(rules) {
  return rules?.dev?.god === true;
}
