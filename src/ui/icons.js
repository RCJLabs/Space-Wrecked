// Button icons as SVG strings, drawn in the button's text color.

const icon = (body) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  undo: icon('<path d="M9 5 4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-4"/>'),
  redo: icon('<path d="m15 5 5 5-5 5"/><path d="M20 10H10a5 5 0 0 0 0 10h4"/>'),
  turn: icon('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 3v5h-5"/>'),
  remove: icon('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>'),
  done: icon('<path d="m5 12 5 5 9-10"/>'),
  fit: icon('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
};
