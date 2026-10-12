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
  hull: icon('<path d="M5 8h8l7 4-7 4H5z"/><path d="M5 10.5H2M5 13.5H2"/><path d="M9.5 8v8"/>'),
  // The enemy ships sandbox.
  prev: icon('<path d="m15 5-7 7 7 7"/>'),
  next: icon('<path d="m9 5 7 7-7 7"/>'),
  plans: icon('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v14M15 5v14"/>'),
  map: icon('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 11h7v9M10 11V4M15 4v8h6"/>'),
  open: icon('<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v6H4V6h6"/>'),
  // Fight orders.
  shoot: icon('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  overwatch: icon('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
  reload: icon('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M8 8h8M8 13h8"/>'),
  stabilize: icon('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'),
  door: icon('<path d="M3 21h18"/><path d="M6 21V3h12v18"/><path d="M14 12h.01"/>'),
  grab: icon('<path d="m4 8.5 8-4 8 4v8l-8 4-8-4z"/><path d="m4 8.5 8 4 8-4M12 12.5v8"/>'),
  hack: icon('<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="m7 8.5 3 2.5-3 2.5M12 13.5h5"/><path d="M8 21h8M12 17v4"/>'),
  endTurn: icon('<path d="M4 12h12"/><path d="m11 6 6 6-6 6"/><path d="M20 5v14"/>'),
  skip: icon('<path d="m4 6 8 6-8 6z"/><path d="m12 6 8 6-8 6z"/>'),
  log: icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
  again: icon('<path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/>'),
  // The campaign.
  build: icon('<path d="M14.5 4.5a4 4 0 0 0-3.9 5.1L4 16.2 7.8 20l6.6-6.6a4 4 0 0 0 5.1-3.9l-2.7 2.7-2.4-.7-.7-2.4z"/>'),
  home: icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'),
  leave: icon('<path d="M10 4H5v16h5"/><path d="M9 12h11"/><path d="m16 8 4 4-4 4"/>'),
  jobs: icon('<rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 4V2.8h6V4"/><path d="M9 10h6M9 14h6M9 18h3"/>'),
  pay: icon('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>'),
  // The shop: a storefront under its awning, and a price tag.
  shop: icon('<path d="M4 9 5.5 4h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-5h4v5"/>'),
  tag: icon('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
  // The run: a jump and a long one, a crate of supplies, the sector map's
  // nodes (the way in, a station, the jump point), and the ship's mark on
  // it, filled by its CSS.
  jump: icon('<path d="M3 18c2-6.5 7-9.5 14-9"/><path d="m13.5 5 4 4-4 4"/>'),
  longJump: icon('<path d="M2.5 18c1.5-4.5 4-6.5 7.5-6.5"/><path d="M8.5 18c2-7 6.5-10 12-9.5"/><path d="m17 5 3.8 3.6L17 12.4"/>'),
  supplies: icon('<rect x="3.5" y="8" width="17" height="12" rx="1.2"/><path d="M3.5 12h17M8.5 8V5h7v3M10 15.5h4"/>'),
  wayIn: icon('<path d="M2.5 12h10"/><path d="m9 8 4 4-4 4"/><path d="M15 5.5a7 7 0 0 1 0 13"/>'),
  station: icon('<rect x="9.5" y="7" width="5" height="10" rx="1"/><path d="M2.5 9.5h5v5h-5zM16.5 9.5h5v5h-5zM7.5 12h2M14.5 12h2"/>'),
  jumpPoint: icon('<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.6"/><circle cx="12" cy="12" r="3.5"/>'),
  shipMark: icon('<path d="M3.5 6.5 20.5 12l-17 5.5L7.5 12z"/>'),
  // Launch: a ship standing on its tail, fins out, its flame under it.
  launch: icon('<path d="M12 2.5c3 2.4 4.5 5.9 4.5 10.5v3h-9v-3C7.5 8.4 9 4.9 12 2.5z"/><path d="m7.5 12.5-2.5 3v2l2.5-1.5M16.5 12.5l2.5 3v2l-2.5-1.5"/><circle cx="12" cy="9.5" r="1.6"/><path d="M10.5 19 12 22l1.5-3"/>'),
};
