// The Saves tab: the ships kept in the builder's slots, codes that carry a
// ship to another device, and the build replay. Opening a slot or making a
// new one is safe at a tap (nothing is lost: every slot is saved); deleting
// takes a second tap within ARM_MS.
import { MAX_SLOTS } from '../../sim/builds.js';
import { confirms, holdMode } from '../confirm.js';
import { onTap } from '../gestures.js';

const ARM_MS = 3000;

// Handlers: onOpen(index), onNew(), onCopy() -> code, onPaste(text) ->
// { ok, error, name }, onReplay(), onDelete().
export function createSavesPanel({ onOpen, onNew, onCopy, onPaste, onReplay, onDelete }) {
  const el = node('div', 'bld-saves');
  const current = node('p', 'bld-current');
  const copy = button('Copy code');
  const replay = button('Replay build');
  const row = node('div', 'bld-row');
  row.append(copy, replay);
  const code = node('textarea', 'bld-code');
  code.readOnly = true;
  code.rows = 3;
  code.hidden = true;
  code.setAttribute('aria-label', "This ship's code");
  const copyNote = node('p', 'bld-message bld-copy-note');
  const slotsTitle = node('h3');
  const list = node('ul', 'bld-slots');
  const add = button('New ship');
  const paste = node('textarea', 'bld-paste');
  paste.rows = 2;
  paste.placeholder = "Paste a ship's code here";
  paste.setAttribute('aria-label', "A ship's code to open");
  const open = button('Open the code');
  const pasteNote = node('p', 'bld-message bld-paste-note');
  const remove = button('Delete this ship');
  remove.classList.add('bld-danger');
  el.append(
    node('h3', null, 'This ship'), current, row, code, copyNote,
    slotsTitle, list, add,
    node('h3', null, 'From a code'), paste, open, pasteNote,
    remove,
  );

  let armedUntil = 0;
  let timer = 0;
  let slotTaps = [];

  const detach = [
    onTap(copy, () => {
      const text = onCopy();
      code.value = text;
      code.hidden = false;
      code.focus({ preventScroll: true });
      code.select();
      const done = () => say(copyNote, 'good', 'Code copied. Paste it into Space Wrecked on any device.');
      const manual = () => say(copyNote, 'info', 'Select the code above and copy it.');
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, manual);
      else manual();
    }),
    onTap(replay, () => onReplay()),
    onTap(add, () => onNew()),
    onTap(open, () => {
      const result = onPaste(paste.value);
      if (result.ok) {
        paste.value = '';
        say(pasteNote, 'good', `Opened as ${result.name}.`);
      } else {
        say(pasteNote, 'bad', result.error);
      }
    }),
    onTap(remove, (press) => {
      if (confirms(performance.now() < armedUntil, press)) {
        disarm();
        onDelete();
        return;
      }
      armedUntil = performance.now() + ARM_MS;
      clearTimeout(timer);
      timer = setTimeout(disarm, ARM_MS);
      remove.textContent = holdMode() ? 'Hold to delete' : 'Tap again to delete';
      remove.dataset.state = 'armed';
    }, { confirm: true }),
  ];

  function disarm() {
    clearTimeout(timer);
    armedUntil = 0;
    remove.textContent = 'Delete this ship';
    delete remove.dataset.state;
  }

  // Messages sit by what they answer: under the code, or under the paste
  // box, so a scrolled tab still shows them.
  function say(line, tone, text) {
    line.dataset.tone = tone;
    line.textContent = text;
  }

  return {
    el,
    // slots: [{ name, parts, ready }] for every slot; active: the open one's
    // index; replaying: whether the replay is running.
    update({ slots, active, replaying, canReplay }) {
      const open = slots[active];
      current.textContent = open ? `${open.name} · ${open.parts} part${open.parts === 1 ? '' : 's'}${open.ready ? ' · ready to launch' : ''}` : '';
      copy.disabled = !open?.parts;
      replay.textContent = replaying ? 'Stop replay' : 'Replay build';
      replay.disabled = !replaying && !canReplay;
      slotsTitle.textContent = `Saved ships (${slots.length} of ${MAX_SLOTS})`;
      for (const off of slotTaps) off();
      slotTaps = [];
      list.replaceChildren(
        ...slots.map((slot, index) => {
          const item = node('li');
          const pick = button(slot.name);
          pick.classList.add('bld-slot');
          if (index === active) pick.setAttribute('aria-current', 'true');
          pick.append(node('small', null, `${slot.parts} part${slot.parts === 1 ? '' : 's'}${slot.ready ? ' · ready' : ''}`));
          slotTaps.push(onTap(pick, () => onOpen(index)));
          item.append(pick);
          return item;
        }),
      );
      add.disabled = slots.length >= MAX_SLOTS;
      remove.disabled = !open;
    },
    // A change of ship: the old code and messages no longer apply.
    reset() {
      code.hidden = true;
      code.value = '';
      say(copyNote, 'info', '');
      disarm();
    },
    dispose() {
      clearTimeout(timer);
      for (const off of [...detach, ...slotTaps]) off();
      el.remove();
    },
  };
}

function button(label) {
  const b = node('button', 'btn bld-wide', label);
  b.type = 'button';
  return b;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
