// The ?dev=1 menu: sandboxes, frame cap, save export and import, and status.
import { exportSave, importSave, makeSave } from '../../core/save.js';
import { saveData } from '../../sim/root.js';
import { FPS_CAPS } from '../../sim/settings.js';
import { sandboxes } from './sandboxes.js';

export function createDevMenu(root, { store, getStatus }) {
  const toggle = button('DEV', () => setOpen(true));
  toggle.classList.add('dev-toggle');
  const panel = el('div', { className: 'dev-panel' });
  panel.hidden = true;
  root.append(toggle, panel);

  const status = el('pre', { className: 'dev-status' });

  function setOpen(open) {
    panel.hidden = !open;
    toggle.hidden = open;
    if (open) getStatus().then((lines) => (status.textContent = lines.join('\n')));
  }

  function go(screen) {
    store.dispatch({ type: 'screen/show', screen });
    setOpen(false);
  }

  // Header
  panel.append(el('div', { className: 'dev-head' }, [el('h2', { text: 'Dev menu' }), button('Close', () => setOpen(false))]));

  // Sandboxes
  panel.append(section('Sandboxes', [row([button('Title', () => go('title')), ...sandboxes.map((s) => button(s.name, () => go(s.id)))])]));

  // Frame cap
  const capButtons = FPS_CAPS.map((cap) => {
    const b = button(`${cap} fps`, () => store.dispatch({ type: 'settings/fpsCap', value: cap }));
    b.dataset.cap = String(cap);
    return b;
  });
  const syncCaps = () => {
    const current = store.getState().settings.fpsCap;
    for (const b of capButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.cap) === current));
  };
  syncCaps();
  store.subscribe(syncCaps);
  panel.append(section('Frame cap', [row(capButtons)]));

  // Save export
  const exportBox = textArea('Tap Export to make a save code.');
  exportBox.readOnly = true;
  const exportNote = note('');
  const makeCode = () => {
    exportBox.value = exportSave(makeSave(saveData(store.getState())));
    exportNote.textContent = `${exportBox.value.length} characters. Keep it somewhere safe.`;
  };
  const copyButton = button('Copy', async () => {
    if (!exportBox.value) makeCode();
    exportNote.textContent = (await copyText(exportBox)) ? 'Copied.' : 'Copy failed. Select the code and copy it by hand.';
  });

  // Save import: tap once to check the code, tap again to replace the save.
  const importBox = textArea('Paste a save code here.');
  const importNote = note('');
  let checked = null;
  const importButton = button('Import', () => {
    if (checked) {
      store.dispatch({ type: 'save/restore', data: checked.data });
      checked = null;
      importBox.value = '';
      importButton.textContent = 'Import';
      setNote(importNote, 'Imported.', 'good');
      return;
    }
    const result = importSave(importBox.value);
    if (!result.ok) return setNote(importNote, result.error, 'bad');
    checked = result.save;
    importButton.textContent = 'Replace save';
    setNote(importNote, `Valid save (v${checked.version}). Tap Replace save to overwrite the current one.`, 'good');
  });
  importBox.addEventListener('input', () => {
    checked = null;
    importButton.textContent = 'Import';
    importNote.textContent = '';
  });

  panel.append(
    section('Save', [
      exportBox,
      row([button('Export', makeCode), copyButton]),
      exportNote,
      importBox,
      row([importButton]),
      importNote,
    ]),
  );

  panel.append(section('Status', [status]));
}

function el(tag, props = {}, children = []) {
  const { text, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (text !== undefined) node.textContent = text;
  node.append(...children.filter(Boolean));
  return node;
}

function button(label, onClick) {
  const b = el('button', { className: 'btn', type: 'button', text: label });
  b.addEventListener('click', onClick);
  return b;
}

function section(title, children) {
  return el('section', { className: 'dev-section' }, [el('h3', { text: title }), ...children]);
}

function row(children) {
  return el('div', { className: 'dev-row' }, children);
}

function note(text) {
  return el('p', { className: 'dev-note', text });
}

function setNote(node, text, tone) {
  node.textContent = text;
  node.dataset.tone = tone;
}

function textArea(placeholder) {
  const area = el('textarea', { className: 'dev-code', placeholder, rows: 3, spellcheck: false });
  // Mobile keyboards must not capitalize or "correct" a code.
  area.setAttribute('autocapitalize', 'off');
  area.setAttribute('autocomplete', 'off');
  area.setAttribute('autocorrect', 'off');
  return area;
}

async function copyText(area) {
  try {
    await navigator.clipboard.writeText(area.value);
    return true;
  } catch {
    area.focus();
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}
