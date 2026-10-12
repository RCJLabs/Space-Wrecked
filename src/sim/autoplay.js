// Plays a battle out with a player for each side, for tests, tools and the
// balance harness (M11). A player is a function from (battle, rules) to its
// side's next action: scriptedAction (scripted.js), aiAction (ai.js),
// pressAction (press.js) or jobAction (jobAi.js).
import { act, createBattle } from './battle.js';

// players: { crew, enemy }. Plays until the battle ends or maxRounds have
// passed. Returns { battle, actions, events }.
export function autoplay(setup, rules, players, options) {
  const { battle, events } = createBattle(setup, rules);
  const rest = playFrom(battle, rules, players, options);
  return { battle: rest.battle, actions: rest.actions, events: [...events, ...rest.events] };
}

// The same, from a battle already under way: the events are those played
// from here on.
export function playFrom(battle, rules, players, { maxRounds = 30 } = {}) {
  const events = [];
  const actions = [];
  while (!battle.winner && battle.round <= maxRounds) {
    const action = players[battle.side](battle, rules);
    const result = act(battle, action, rules);
    if (!result.ok) throw new Error(`The ${battle.side}'s player tried ${JSON.stringify(action)}: ${result.error}`);
    actions.push(action);
    events.push(...result.events);
    battle = result.battle;
  }
  return { battle, actions, events };
}
