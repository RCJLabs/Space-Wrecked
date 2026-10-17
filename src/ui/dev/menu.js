// The ?dev=1 menu: the frame rate's readout (fps.js), cheats (cheats.js),
// sandboxes, frame cap, every sound (M35), save export and import, and
// status. reopen() mounts
// the screen on show anew (main.js). Returns { toggle (the DEV button),
// readout (the section the frame rate's readout goes in) }.
import { exportSave, importSave, makeSave } from '../../core/save.js';
import { playNow } from '../../platform/audio.js';
import { loadContent } from '../../platform/content.js';
import { saveData } from '../../sim/root.js';
import { FPS_CAPS } from '../../sim/settings.js';
import { copyText } from '../clipboard.js';
import { cheatsSection } from './cheats.js';
import { button, el, note, row, section, setNote, textArea } from './dom.js';
import { sandboxes } from './sandboxes.js';

export function createDevMenu(root, { store, getStatus, reopen }) {
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

  // Header, then the frame rate's readout (fps.js fills it).
  panel.append(el('div', { className: 'dev-head' }, [el('h2', { text: 'Dev menu' }), button('Close', () => setOpen(false))]));
  const readout = section('Frames', []);
  panel.append(readout);

  // Sandboxes
  panel.append(section('Sandboxes', [row([button('Title', () => go('title')), ...sandboxes.map((s) => button(s.name, () => go(s.id)))])]));

  // Cheats, for the campaign where it is.
  panel.append(cheatsSection({ store, toggle, reopen, close: () => setOpen(false) }));

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

  // Sounds (M35): each one in data/sounds.json, to hear the set on the
  // phone, at the volume set, sound on or off.
  const soundRow = row([]);
  panel.append(section('Sounds', [soundRow]));
  loadContent()
    .then((content) => soundRow.append(...[...content.sounds.values()].map(({ id, for: what }) => Object.assign(button(id, () => playNow(id)), { title: what }))))
    .catch((err) => soundRow.append(note(`Couldn't load the sounds: ${err.message}`)));

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
  return { toggle, readout };
}
