// The shop: the district's dealer (src/sim/economy.js), opened from the
// hangar. Down the left, the parts for sale and, since M37, the weapons;
// then the parts on hand the dealer would buy, and the spare weapons. The
// one picked shows on the right: a part's size and stats and whether the
// ship still needs it for launch, or a weapon's numbers and rules and who
// aboard could carry it; and its price. Buy or Sell takes two taps, as Pay
// does at the hangar: the first shows the price, the second trades. The
// stock turns over after every job. The words are shopText.js's.
//
// Since M37b the screen is a shipyard's too, opened with Yard from the
// sector map at one: its parts for sale, never restocked, and the parts on
// hand it buys, at its prices; Map goes back. The first trade at a yard of
// the pursuer's side says the heat it adds. Those words are yardText.js's.
// Since M39 a yard sells hull frames too, listed between the two: bought
// with two taps, the ship moves onto the frame at once.
import { loadContent } from '../../platform/content.js';
import { palette } from '../../render/palette.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { shopText } from './shopText.js';
import { yardText } from './yardText.js';

const ARM_MS = 3000; // Buy or Sell waits this long for its second tap

export const shopScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'shop');
    const head = node('header', 'shop-head');
    const where = node('p', 'shop-where');
    const creditsChip = node('p', 'shop-credits');
    const title = node('h1', null, 'Shop');
    head.append(title, where, creditsChip);
    const list = node('div', 'shop-list');
    const detail = node('article', 'shop-detail');
    const foot = node('footer', 'shop-foot');
    const backButton = toolButton('shop-back', icons.home, 'Hangar');
    const hint = node('p', 'shop-hint', 'Loading…');
    const tradeButton = toolButton('shop-take', icons.tag, 'Buy');
    tradeButton.disabled = true;
    foot.append(backButton, hint, tradeButton);
    el.append(head, list, detail, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    // What is picked: { from: 'stock' | 'frames' | 'held', key } where key
    // is the part's type, 'w:' and the weapon's (shopText.js) or 'f:' and
    // the frame's (yardText.js), so a pick survives the stock or the hold
    // changing.
    let picked = null;
    let shownPick = null; // the pick the list last showed
    let armed = false; // Buy or Sell has had its first tap
    let armTimer = 0;
    let rows = [];
    // Where the way back goes: the hangar, or the map from a yard.
    let backTo = 'hub';
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: backTo })),
      onTap(tradeButton, trade),
      () => clearTimeout(armTimer),
      game.subscribe((state) => alive && render(state.campaign)),
      () => rows.forEach((row) => row.detach()),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        const { campaign } = game.getState();
        // Act 1's board and stock are rolled the first time they are seen;
        // a yard's stock is its own (yards.js).
        if (campaign && !campaign.run && (!campaign.board.length || campaign.shop === null)) game.dispatch({ type: 'campaign/board', rules: defs });
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function render(campaign) {
      if (!defs || !campaign) return;
      const text = yardText(campaign, defs) ?? shopText(campaign, defs);
      showBack(text?.back ?? (campaign.run ? { label: 'Map', screen: 'sector' } : { label: 'Hangar', screen: 'hub' }));
      setText(title, text?.title ?? 'Shop');
      if (!text) {
        setText(where, '');
        detail.replaceChildren(node('p', 'shop-none', 'There is no shop here.'));
        tradeButton.disabled = true;
        setText(hint, campaign.run ? 'Back to the map.' : 'Back to the hangar.');
        return;
      }
      setText(where, text.name);
      setText(creditsChip, text.credits);
      const frames = text.frames ?? [];
      const items = [...text.stock.map((item) => ({ from: 'stock', key: item.key, item })), ...frames.map((item) => ({ from: 'frames', key: item.key, item })), ...text.held.map((item) => ({ from: 'held', key: item.key, item }))];
      const current = items.find((entry) => entry.from === picked?.from && entry.key === picked?.key) ?? items[0] ?? null;
      if (current?.from !== picked?.from || current?.key !== picked?.key) disarm();
      const moved = current?.from !== shownPick?.from || current?.key !== shownPick?.key;
      picked = current && { from: current.from, key: current.key };
      shownPick = picked;
      build(text, current);
      // A new pick is brought into view, as after buying one into the hold.
      if (moved) list.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
      showPart(text, current);
      if (!current) {
        tradeButton.disabled = true;
        setText(hint, text.hint.text);
        hint.dataset.tone = text.hint.tone;
        return;
      }
      const { item } = current;
      const selling = current.from === 'held';
      tradeButton.disabled = !item.ok;
      if (!item.ok) disarm();
      const mode = selling ? 'sell' : 'buy';
      if (tradeButton.dataset.mode !== mode) {
        tradeButton.dataset.mode = mode;
        tradeButton.querySelector('svg').outerHTML = selling ? icons.pay : icons.tag;
      }
      setText(tradeButton.querySelector('span'), armed ? item.ask : item.action);
      tradeButton.dataset.armed = String(armed);
      tradeButton.setAttribute('aria-label', `${selling ? 'Sell' : 'Buy'} the ${item.name}`);
      const again = `Tap again to ${selling ? 'sell' : 'buy'} it.`;
      const confirm = item.warn ? `${item.warn}: tap again to ${selling ? 'sell' : 'buy'} it anyway.` : text.dock ? `${text.dock} ${again}` : again;
      const why = !item.ok ? item.why : armed ? confirm : null;
      setText(hint, why ?? text.hint.text);
      hint.dataset.tone = why ? (item.ok ? 'warn' : 'bad') : text.hint.tone;
    }

    // The list: the parts and weapons for sale, then those on hand, each a
    // button with its name, price, and a tag when the ship needs it.
    function build(text, current) {
      rows.forEach((row) => row.detach());
      const section = (label) => node('p', 'shop-section', label);
      const row = (from, item) => {
        const button = node('button', 'btn shop-pick');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(current?.from === from && current?.key === item.key));
        const top = node('span', 'shop-top');
        top.append(node('b', null, from === 'held' && item.count > 1 ? `${item.name} ×${item.count}` : item.name));
        if (item.needed) top.append(node('span', 'shop-need', 'Needed'));
        if (item.weapon) top.append(node('span', 'shop-arm', 'Weapon'));
        button.append(top, node('span', 'shop-price', from === 'held' ? `Sells for ${item.price}` : item.price));
        return { button, detach: onTap(button, () => pick(from, item.key)) };
      };
      const frames = text.frames ?? [];
      rows = [...text.stock.map((item) => row('stock', item)), ...frames.map((item) => row('frames', item)), ...text.held.map((item) => row('held', item))];
      const forSale = rows.slice(0, text.stock.length).map((r) => r.button);
      const hulls = rows.slice(text.stock.length, text.stock.length + frames.length).map((r) => r.button);
      const onHand = rows.slice(text.stock.length + frames.length).map((r) => r.button);
      list.replaceChildren(
        section('For sale'),
        ...(forSale.length ? forSale : [node('p', 'shop-none', text.soldOut ?? 'Sold out until the next job.')]),
        ...(hulls.length ? [section('Hull frames'), ...hulls] : []),
        ...(onHand.length ? [section('On hand'), ...onHand] : []),
      );
    }

    function pick(from, key) {
      if (picked?.from === from && picked?.key === key) return;
      picked = { from, key };
      disarm();
      render(game.getState().campaign);
    }

    function showPart(text, current) {
      if (!current) {
        detail.replaceChildren(node('h2', null, text.name), node('p', 'shop-who', text.dealer), node('p', 'shop-pitch', text.pitch));
        return;
      }
      const { item, from } = current;
      const facts = node('dl', 'shop-facts');
      const fact = (label, value) => {
        if (!value) return;
        const line = node('div');
        line.append(node('dt', null, label), node('dd', null, value));
        facts.append(line);
      };
      if (from === 'frames') {
        const [size, trait, price] = item.facts;
        fact('Size', size);
        fact('Trait', trait);
        fact('Price', price);
        fact('You pay', item.price);
        detail.replaceChildren(node('h2', null, item.name), node('p', 'shop-who', `For sale · ${text.dealer}`), facts, node('p', 'shop-pitch', text.framePitch ?? ''));
        return;
      }
      if (item.weapon) {
        const [what, aim, rules] = item.facts;
        fact('Weapon', what);
        fact('Aim', aim);
        fact('Rules', rules);
        fact('Crew', item.carried);
      } else {
        const [size, stats] = item.facts;
        fact('Size', size);
        fact('Stats', stats);
        fact('Launch', item.needed);
      }
      if (from === 'held') {
        fact('On hand', String(item.count));
        fact('Sells for', item.price);
      } else {
        fact('Price', item.price);
      }
      const who = from === 'held' ? `Yours · ${text.name} buys it` : `For sale · ${text.dealer}`;
      detail.replaceChildren(node('h2', null, item.name), node('p', 'shop-who', who), facts, ...(from === 'stock' ? [node('p', 'shop-pitch', text.pitch)] : []));
    }

    // Buy or Sell: the first tap shows the price, the second trades.
    function trade() {
      if (!defs || !picked || tradeButton.disabled) return;
      if (!armed) {
        armed = true;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render(game.getState().campaign);
        }, ARM_MS);
        render(game.getState().campaign);
        return;
      }
      disarm();
      const { campaign } = game.getState();
      const yard = yardText(campaign, defs);
      if (yard) {
        // At a yard: by the part's slot to buy, by its type to sell, a frame
        // by its id (M39), after which the ship's own frame is for sale in
        // its place.
        if (picked.from === 'frames') {
          const item = yard.frames.find((entry) => entry.key === picked.key);
          picked = { from: 'frames', key: `f:${campaign.ship.frame}` };
          if (item) game.dispatch({ type: 'campaign/yard/frame', frame: item.frame, rules: defs });
        } else if (picked.from === 'stock') {
          const item = yard.stock.find((entry) => entry.key === picked.key);
          picked = { from: 'held', key: picked.key };
          if (item) game.dispatch({ type: 'campaign/yard/buy', slot: item.slot, rules: defs });
        } else {
          game.dispatch({ type: 'campaign/yard/sell', part: picked.key, rules: defs });
        }
        render(game.getState().campaign);
        return;
      }
      if (picked.from === 'stock') {
        const index = campaign.shop.findIndex((item) => (item.weapon ? `w:${item.weapon}` : item.part) === picked.key);
        // Once bought, the part or weapon is on hand: it stays picked
        // there. (The screen draws again as the game changes, inside
        // dispatch.)
        picked = { from: 'held', key: picked.key };
        if (index >= 0) game.dispatch({ type: 'campaign/buy', index, rules: defs });
      } else if (picked.key.startsWith('w:')) {
        game.dispatch({ type: 'campaign/arms/sell', weapon: picked.key.slice(2), rules: defs });
      } else {
        game.dispatch({ type: 'campaign/sell', part: picked.key, rules: defs });
      }
      render(game.getState().campaign);
    }

    function disarm() {
      armed = false;
      clearTimeout(armTimer);
    }

    // The way back's button: Hangar, or Map at a yard.
    function showBack({ label, screen }) {
      if (backTo === screen) return;
      backTo = screen;
      backButton.querySelector('svg').outerHTML = screen === 'sector' ? icons.map : icons.home;
      setText(backButton.querySelector('span'), label);
    }

    let painted = false;
    return {
      resize() {
        painted = false;
      },
      // Nothing on the canvas: the shop is all panels.
      draw(ctx, view) {
        if (painted) return;
        painted = true;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
