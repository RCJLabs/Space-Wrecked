// The Campaigns screen (M63), from the title: the three campaign slots, each
// with where its campaign is, and the backups of the slot in play. Tapping a
// slot puts it in play (back on the title, Continue and New game act on
// it); a backup comes back behind a second tap, and the campaign it
// replaces is kept as the slot's replaced backup. The rules are
// src/core/slots.js; the storage, src/platform/saves.js.
import { seedFrom } from '../core/rng.js';
import { loadContent } from '../platform/content.js';
import { saves } from '../platform/saves.js';
import { drawStars, makeStarfield, paintBackdrop } from '../render/starfield.js';
import { saveData } from '../sim/root.js';
import { backupText, NO_BACKUPS, slotLine } from './campaignsText.js';
import { confirms } from './confirm.js';
import { node, setText, toolButton } from './fight/panels.js';
import { onTap } from './gestures.js';
import { icons } from './icons.js';

const field = makeStarfield(seedFrom('campaigns'));
const ARM_MS = 3000; // Restore waits this long for its second tap

export const campaignsScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'set cmp');
    const head = node('header', 'set-head');
    head.append(node('h1', null, 'Campaigns'));
    const slotBox = node('section', 'set-rows cmp-slots');
    const backupBox = node('section', 'set-save cmp-backups');
    const body = node('div', 'set-body');
    body.append(slotBox, backupBox);
    const foot = node('footer', 'set-foot');
    const backButton = toolButton('set-back', icons.leave, 'Title');
    foot.append(backButton);
    el.append(head, body, foot);
    root.append(el);

    let alive = true;
    let rules = null;
    let armed = null; // the backup kind armed to restore
    let armTimer = 0;
    let note = { text: '', tone: 'info' };
    let rows = []; // [{ button, cleanup }]
    const cleanups = [onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'title' }))];

    loadContent()
      .then((content) => {
        rules = content;
        if (alive) render();
      })
      .catch(() => {}); // the lines say where without the act's home
    render();

    function render() {
      for (const row of rows) row.cleanup();
      rows = [];
      const list = saves.list();
      const inPlay = saves.slot();
      slotBox.replaceChildren(node('h2', null, 'Slots'));
      for (const { slot, state } of list) {
        const button = node('button', 'btn cmp-slot');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(slot === inPlay));
        button.append(node('strong', null, `Slot ${slot}`), node('small', null, slotLine(state, rules)));
        button.disabled = state.kind === 'broken' && slot !== inPlay;
        rows.push({ cleanup: onTap(button, () => open(slot)) });
        slotBox.append(button);
      }
      slotBox.append(node('p', 'set-line', 'Each slot keeps its own campaign. The settings and the sandbox ships are shared.'));

      const { backups } = list.find((s) => s.slot === inPlay);
      backupBox.replaceChildren(node('h2', null, `Backups of slot ${inPlay}`));
      if (!backups.length) backupBox.append(node('p', 'set-line', NO_BACKUPS));
      for (const backup of backups) {
        const { title, line } = backupText(backup, rules);
        const item = node('div', 'cmp-backup');
        const words = node('div', 'cmp-words');
        words.append(node('strong', null, title), node('small', null, line));
        const restore = toolButton('cmp-restore', icons.again, armed === backup.kind ? 'Restore?' : 'Restore');
        restore.disabled = backup.state.kind === 'broken';
        rows.push({ cleanup: onTap(restore, (press) => restoreFrom(backup.kind, press), { confirm: true }) });
        item.append(words, restore);
        backupBox.append(item);
      }
      const said = node('p', 'set-note');
      said.setAttribute('role', 'status');
      setText(said, note.text);
      said.dataset.tone = note.tone;
      backupBox.append(said);
    }

    // Puts a slot in play: its own campaign, with the game's settings.
    function open(slot) {
      if (slot === saves.slot()) return;
      const fresh = crypto.getRandomValues(new Uint32Array(1))[0];
      const opened = saves.open(slot, saveData(game.getState()), fresh);
      if (!opened.ok) {
        note = { text: `Slot ${slot} can't be read: ${opened.error}`, tone: 'bad' };
        return render();
      }
      disarm();
      note = { text: `Slot ${slot} is in play.`, tone: 'good' };
      game.dispatch({ type: 'save/restore', data: opened.data });
      render();
    }

    function restoreFrom(kind, press) {
      if (!confirms(armed === kind, press)) {
        armed = kind;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render();
        }, ARM_MS);
        note = { text: 'Tap Restore again. The campaign in this slot now is kept as the one replaced.', tone: 'warn' };
        return render();
      }
      disarm();
      const restored = saves.restore(kind, saveData(game.getState()));
      if (!restored.ok) {
        note = { text: restored.error, tone: 'bad' };
        return render();
      }
      game.dispatch({ type: 'save/restore', data: restored.data });
      note = { text: 'Restored. The campaign it replaced is kept: restore that to undo.', tone: 'good' };
      render();
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
      note = { text: '', tone: 'info' };
    }

    let backdrop = null;
    let dirty = true;
    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
        dirty = true;
      },
      // A still sky: drawn again only when the screen changes.
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        backdrop ??= paintBackdrop(field, view);
        ctx.drawImage(backdrop, 0, 0, view.width, view.height);
        drawStars(ctx, field, view, 0);
      },
      unmount() {
        alive = false;
        clearTimeout(armTimer);
        for (const row of rows) row.cleanup();
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
