// How the test player gives orders in the approach phase (tools/approach.js
// and tools/voyage.js). It sees what the screen shows, the other ship's
// order and both ships, and thinks a round ahead: for each order it can
// give, it plays the approach out ROLLOUTS times on dice of its own
// (seeded, and the same for every order, so they are compared fairly),
// giving the later rounds' orders by quickOrder, and picks the order that
// comes out best on average: a boarding or a ship blown up counts 1, being
// boarded −1, and anything else 0. The game's own dice are never touched.
// It never closes to board: it boards only a ship it has disabled, since a
// boarding is a fight (encounter.js), not the win these scores count it as.
import { seedFrom } from '../src/core/rng.js';
import { choicesFor, enemyOrder, playRound, targetsOf } from '../src/sim/approach.js';

const ROLLOUTS = 16;
const SCORES = { boarded: 1, destroyed: 1, boardedBy: -1 };

// The player's order for the round: { kind, at? }.
export function captainOrder(state, rules) {
  const intent = enemyOrder(state, rules);
  const orders = choicesFor(state, intent, rules).filter((choice) => choice.ok && choice.order.kind !== 'close').map((choice) => choice.order);
  if (orders.length === 1) return orders[0];
  let best = null;
  for (const order of orders) {
    let total = 0;
    for (let i = 0; i < ROLLOUTS; i++) total += imagine(state, order, seedFrom(`imagine ${state.round} ${i}`), rules);
    if (!best || total > best.total) best = { order, total };
  }
  return best.order;
}

// How an approach comes out, as a score, from `order` this round and
// quickOrder's after, on the dice from rng.
function imagine(state, order, rng, rules) {
  let at = state;
  let next = order;
  let dice = rng;
  for (;;) {
    const played = playRound(at, next, dice, rules);
    if (played.outcome) return SCORES[played.outcome.kind] ?? 0;
    at = { ...at, you: played.you, them: played.them, round: played.round };
    dice = played.rng;
    next = quickOrder(at, rules);
  }
}

// A quick rule of thumb for an order, from the odds on show:
//   - when the other ship closes to board, run;
//   - when the guns can wreck the other ship's reactor or engines in the
//     rounds left, on average, fire at whichever goes soonest;
//   - otherwise run if that is likelier than not to work;
//   - otherwise fire at its guns while it fires, else at its engines, and
//     with nothing to fire, evade.
export function quickOrder(state, rules) {
  const intent = enemyOrder(state, rules);
  const choices = choicesFor(state, intent, rules);
  const choice = (kind, at) => choices.find((c) => c.order.kind === kind && c.order.at === at);
  const flee = choice('flee');
  if (intent.kind === 'close' && flee.ok) return flee.order;
  const left = rules.balance.approachRounds - state.round + 1;
  const quickest = ['reactor', 'engines']
    .map((at) => ({ at, rounds: roundsToWreck(state, choice('fire', at), at, rules) }))
    .filter((way) => way.rounds <= left)
    .sort((a, b) => a.rounds - b.rounds)[0];
  if (quickest) return { kind: 'fire', at: quickest.at };
  if (flee.ok && flee.chance > 50) return flee.order;
  for (const at of intent.kind === 'fire' ? ['weapons', 'engines'] : ['engines', 'weapons']) {
    if (choice('fire', at).ok) return { kind: 'fire', at };
  }
  return { kind: 'evade' };
}

// How many rounds, on average, the player's volleys take to wreck every
// module of a kind on the other ship; Infinity if they can't.
function roundsToWreck(state, fire, at, rules) {
  if (!fire?.ok) return Infinity;
  const perRound = Math.max(0, (fire.guns * fire.chance * fire.damage) / 100 - fire.shields);
  if (!perRound) return Infinity;
  const left = targetsOf(state.them, at, rules).reduce((sum, target) => sum + target.left, 0);
  return left / perRound;
}
