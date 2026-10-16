// The ?dev=1 menu's small DOM pieces (menu.js, cheats.js).

export function el(tag, props = {}, children = []) {
  const { text, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (text !== undefined) node.textContent = text;
  node.append(...children.filter(Boolean));
  return node;
}

export function button(label, onClick) {
  const b = el('button', { className: 'btn', type: 'button', text: label });
  b.addEventListener('click', onClick);
  return b;
}

export function section(title, children) {
  return el('section', { className: 'dev-section' }, [el('h3', { text: title }), ...children]);
}

export function row(children) {
  return el('div', { className: 'dev-row' }, children);
}

export function note(text) {
  return el('p', { className: 'dev-note', text });
}

export function setNote(node, text, tone) {
  node.textContent = text;
  node.dataset.tone = tone;
}

export function textArea(placeholder) {
  const area = el('textarea', { className: 'dev-code', placeholder, rows: 3, spellcheck: false });
  // Mobile keyboards must not capitalize or "correct" a code.
  area.setAttribute('autocapitalize', 'off');
  area.setAttribute('autocomplete', 'off');
  area.setAttribute('autocorrect', 'off');
  return area;
}
