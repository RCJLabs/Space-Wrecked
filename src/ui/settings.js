// The settings screen, from the title: difficulty, forgiving odds, motion,
// the frame rate and tips, each a row of choices with what the one picked
// does (settingsText.js); then the save as a code, the player's backup: a
// TWA keeps the save in Chrome's storage, and clearing Chrome's data
// clears it. Export makes the code to copy; Import checks a pasted one,
// and a second tap replaces the save with it.
import { seedFrom } from '../core/rng.js';
import { exportSave, importSave, makeSave } from '../core/save.js';
import { loadContent } from '../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../render/starfield.js';
import { saveData } from '../sim/root.js';
import { copyText } from './clipboard.js';
import { node, setText, toolButton } from './fight/panels.js';
import { onTap } from './gestures.js';
import { icons } from './icons.js';
import { settingsText } from './settingsText.js';

const field = makeStarfield(seedFrom('settings'));

export const settingsScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'set');
    const head = node('header', 'set-head');
    head.append(node('h1', null, 'Settings'));
    const rows = node('div', 'set-rows');
    const saveBox = node('section', 'set-save');
    const body = node('div', 'set-body');
    body.append(rows, saveBox);
    const foot = node('footer', 'set-foot');
    const backButton = toolButton('set-back', icons.leave, 'Title');
    foot.append(backButton);
    el.append(head, body, foot);
    root.append(el);

    let alive = true;
    let balance = null;
    const cleanups = [onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })), game.subscribe(() => alive && render())];
    const shown = new Map(); // key -> { buttons, line }
    let resetButton = null;

    loadContent()
      .then((content) => {
        if (!alive) return;
        balance = content.balance;
        build();
        render();
      })
      .catch((err) => {
        if (alive) rows.replaceChildren(node('p', 'set-line', `Couldn't load the game data: ${err.message}`));
      });
    buildSave();

    function build() {
      const { settings } = game.getState();
      rows.replaceChildren(
        ...settingsText(settings, balance).map((row) => {
          const item = node('div', 'set-row');
          const choices = node('div', 'set-choices');
          choices.setAttribute('role', 'group');
          choices.setAttribute('aria-label', row.title);
          const buttons = row.choices.map((choice) => {
            const button = node('button', 'btn set-choice', choice.label);
            button.type = 'button';
            cleanups.push(onTap(button, () => game.dispatch({ type: `settings/${row.key}`, value: choice.value })));
            return { button, value: choice.value };
          });
          choices.append(...buttons.map((b) => b.button));
          const line = node('p', 'set-line');
          item.append(node('h2', null, row.title), choices, line);
          if (row.key === 'tips') {
            resetButton = node('button', 'btn set-reset', 'Show tips again');
            resetButton.type = 'button';
            cleanups.push(onTap(resetButton, () => game.dispatch({ type: 'settings/tips/reset' })));
            item.append(resetButton);
          }
          shown.set(row.key, { buttons, line });
          return item;
        }),
      );
    }

    function render() {
      if (!balance) return;
      const { settings } = game.getState();
      for (const row of settingsText(settings, balance)) {
        const { buttons, line } = shown.get(row.key);
        for (const { button, value } of buttons) button.setAttribute('aria-pressed', String(settings[row.key] === value));
        setText(line, row.line);
      }
      if (resetButton) resetButton.hidden = settings.tips && !settings.tipsSeen.length;
    }

    // Export and import, as the dev menu has them, for players.
    function buildSave() {
      const intro = node('p', 'set-line', "Your campaign lives in this browser. Keep a save code somewhere safe before clearing Chrome's data or changing phones.");
      const exportArea = codeArea('Tap Export to make a save code.');
      exportArea.readOnly = true;
      const exportNote = node('p', 'set-note');
      const exportButton = toolButton('set-export', icons.open, 'Export');
      const copyButton = toolButton('set-copy', icons.done, 'Copy');
      const makeCode = () => {
        exportArea.value = exportSave(makeSave(saveData(game.getState())));
        setNote(exportNote, `${exportArea.value.length} characters.`, 'info');
      };
      const importArea = codeArea('Paste a save code here.');
      const importNote = node('p', 'set-note');
      const importButton = toolButton('set-import', icons.again, 'Import');
      let checked = null;
      const importLabel = () => setText(importButton.querySelector('span'), checked ? 'Replace save?' : 'Import');
      cleanups.push(
        onTap(exportButton, makeCode),
        onTap(copyButton, async () => {
          if (!exportArea.value) makeCode();
          const copied = await copyText(exportArea);
          if (alive) setNote(exportNote, copied ? 'Copied.' : 'Copy failed. Select the code and copy it by hand.', copied ? 'good' : 'bad');
        }),
        onTap(importButton, () => {
          if (checked) {
            game.dispatch({ type: 'save/restore', data: checked.data });
            checked = null;
            importArea.value = '';
            importLabel();
            setNote(importNote, 'Imported. The title has the campaign it holds.', 'good');
            return;
          }
          const result = importSave(importArea.value);
          if (!result.ok) return setNote(importNote, result.error, 'bad');
          checked = result.save;
          importLabel();
          setNote(importNote, 'A good save code. Tap Replace save? to put it in place of this one: the campaign under way goes.', 'warn');
        }),
      );
      const onEdit = () => {
        checked = null;
        importLabel();
        setNote(importNote, '', 'info');
      };
      importArea.addEventListener('input', onEdit);
      cleanups.push(() => importArea.removeEventListener('input', onEdit));
      const exportRow = node('div', 'set-save-row');
      exportRow.append(exportButton, copyButton);
      const importRow = node('div', 'set-save-row');
      importRow.append(importButton);
      saveBox.append(node('h2', null, 'Save'), intro, exportArea, exportRow, exportNote, importArea, importRow, importNote);
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
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

function codeArea(placeholder) {
  const area = node('textarea', 'set-code');
  Object.assign(area, { placeholder, rows: 2, spellcheck: false });
  // Phone keyboards must not capitalize or "correct" a code.
  for (const name of ['autocapitalize', 'autocomplete', 'autocorrect']) area.setAttribute(name, 'off');
  return area;
}

function setNote(el, text, tone) {
  setText(el, text);
  el.dataset.tone = tone;
}
