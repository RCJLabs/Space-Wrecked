// The colony's levers on heat (M53), for the colony screen's right-hand
// panel (colony.js): Lie low and a payment under Heat, and the friendly
// side's trader when one is here, or when the next calls. Each button
// takes two taps, the first saying what it comes to in the hint. Its words
// are pressureText.js's.
//
// levers = createLevers(ctx), with the screen's, as colonyTrip.js has them:
//   game, defs()                    the store, and the content once loaded
//   rowButton, list                 colony.js's buttons for the panel
//   armed(), arm(what), disarm()    the screen's two-tap state
//   say(words)                      what the hint says next ({ text, tone })
//   refresh()                       draws the screen again
// levers.section(campaign)          Heat and the trader, for browsing
// levers.hint(campaign)             what the hint says while one is armed,
//                                   or null
// levers.owns(key)                  whether an armed key is one of these
import { confirms } from '../confirm.js';
import { node } from '../fight/panels.js';
import { lowProfileRow, paymentRow, traderText } from './pressureText.js';

const PREFIX = 'lever:';

export function createLevers(ctx) {
  const { game, defs, rowButton, list, armed, arm, disarm, say, refresh } = ctx;

  // Every lever as it stands: key to { name, detail, ok, ask, action }.
  function rowsOf(campaign) {
    const rules = defs();
    const rows = new Map();
    const low = lowProfileRow(campaign, rules);
    rows.set('low', { ...low, action: { type: 'campaign/lowprofile', on: !campaign.colony.lowProfile } });
    const pay = paymentRow(campaign, rules);
    if (pay) rows.set('pay', { ...pay, action: { type: 'campaign/colony/pay' } });
    const trader = traderText(campaign, rules);
    for (const row of trader.rows) rows.set(row.key, { ...row, action: { type: `campaign/trader/${row.key}` } });
    return { rows, trader };
  }

  const levers = {
    owns: (key) => typeof key === 'string' && key.startsWith(PREFIX),

    section(campaign) {
      const { rows, trader } = rowsOf(campaign);
      const button = (key) => {
        const row = rows.get(key);
        const item = rowButton(row.name, row.detail, row.ok, (press) => tap(key, press));
        item.firstChild.dataset.armed = String(armed() === PREFIX + key);
        return item;
      };
      const heat = ['low', 'pay'].filter((key) => rows.has(key));
      const sections = [node('h2', null, 'Heat'), list(heat.map(button), 'cln-levers')];
      sections.push(node('h2', null, trader.title));
      if (trader.rows.length) sections.push(list(trader.rows.map((row) => button(row.key)), 'cln-levers'));
      sections.push(node('p', 'cln-note cln-trader-note', trader.note));
      return sections;
    },

    hint(campaign) {
      const key = armed();
      if (!levers.owns(key)) return null;
      const row = rowsOf(campaign).rows.get(key.slice(PREFIX.length));
      return row ? { text: row.ask, tone: 'warn' } : null;
    },
  };

  // The first tap says what it comes to; the second does it. One that
  // can't says why.
  function tap(key, press) {
    const { campaign } = game.getState();
    const rules = defs();
    if (!campaign || !rules) return;
    const row = rowsOf(campaign).rows.get(key);
    if (!row) return;
    if (!row.ok) {
      disarm();
      say({ text: row.detail, tone: 'warn' });
      refresh();
      return;
    }
    if (!confirms(armed() === PREFIX + key, press)) {
      say(null);
      arm(PREFIX + key);
      return;
    }
    disarm();
    game.dispatch({ ...row.action, rules });
    say(doneText(key, row, game.getState().campaign, rules));
    refresh();
  }

  return levers;
}

// What a lever came to, for the hint.
function doneText(key, row, campaign, rules) {
  if (key === 'low') return campaign.colony.lowProfile
    ? { text: `The colony lies low: heat falls ${rules.balance.lowProfileFall} a day. Nothing flies and the mines are still until it stops.`, tone: 'good' }
    : { text: 'The colony stops lying low: the ship can fly and the mines dig again.', tone: 'info' };
  if (key === 'pay') return { text: `Paid. Heat is ${campaign.heat}.`, tone: 'good' };
  if (key === 'sell') return { text: `Sold: ${campaign.credits} credits, ${campaign.colony.materials} materials left.`, tone: 'good' };
  return { text: `Bought: ${row.name.replace(/^Buy /, 'the ')} is in the hold.`, tone: 'good' };
}
