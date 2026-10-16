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
  // A crew job's order (M32), one for each kind (src/sim/orders.js).
  suppress: icon('<path d="M3 7h9M3 12h12M3 17h9"/><path d="m14 5 3 2-3 2M17 10l3 2-3 2M14 15l3 2-3 2"/>'),
  weld: icon('<path d="M4 20 13 11"/><path d="m13 11 2.5-2.5 3 3L16 14z"/><path d="M19 3.5v3M17.5 5h3M15.5 2.8l1 1"/>'),
  patch: icon('<path d="M5 15.5 15.5 5a3.5 3.5 0 0 1 5 5L10 20.5a3.5 3.5 0 0 1-5-5z"/><path d="M11 9.5h.01M14 9.5h.01M11 12.5h.01M14 12.5h.01"/>'),
  hustle: icon('<path d="M13 2.5 5 13.5h6l-1.5 8 8.5-11h-6z"/>'),
  mark: icon('<path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><path d="m12 8 4 4-4 4-4-4z"/>'),
  sedate: icon('<path d="m14.5 3.5 6 6"/><path d="m17.5 6.5-9 9-3.5 1 1-3.5 9-9"/><path d="M3.5 20.5 6 18"/><path d="M11 9l4 4"/>'),
  kit: icon('<rect x="3.5" y="7" width="17" height="13" rx="1.5"/><path d="M9 7V4.5h6V7"/><path d="M12 10.5v6M9 13.5h6"/>'),
  // A crew member's rank (M32b): a chevron for each.
  rank1: icon('<path d="m5 15.5 7-6.5 7 6.5"/>'),
  rank2: icon('<path d="m5 12 7-6.5 7 6.5"/><path d="m5 19 7-6.5 7 6.5"/>'),
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
  // The squad a boarding takes: two of the crew, one behind the other.
  crew: icon('<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17 13.8a5.5 5.5 0 0 1 3.5 5.7"/>'),
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
  // What a node holds: a broken hull, a call for help, a hazard's warning,
  // and a node not made out yet (traders have the shop's tag); and a scan.
  derelict: icon('<path d="M3 13.5 7 9h6l-2 3 3 1.5L12 17H5z"/><path d="m15 8 2-2M17 11h3M15.5 14.5l2 2"/>'),
  distress: icon('<circle cx="12" cy="12" r="1.8"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>'),
  hazard: icon('<path d="M12 3.5 21 19H3z"/><path d="M12 9.5v4.5M12 16.6v.01"/>'),
  unknown: icon('<path d="M9 9.2a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.8v.7"/><path d="M12 17.4v.01"/>'),
  // A hostile ship: a raider's hull in the crosshairs.
  hostile: icon('<path d="M5 15.5 12 6l7 9.5-7-2.5z"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'),
  scan: icon('<path d="M12 12 18.5 5.5"/><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M15.5 12a3.5 3.5 0 1 1-1-2.5"/>'),
  // Heat on the run (M24): a nebula's cloud of dust, swirling; a bunk to
  // rest a day on; and a transponder, its tag swapped for another.
  nebula: icon('<path d="M7 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.7-1.4 4.5 4.5 0 0 1 .4 9.4z"/><path d="M9 14.5c1.5-1.5 3.5-1.5 5 0"/>'),
  regroup: icon('<path d="M3 19V6"/><path d="M3 14h18v5"/><path d="M21 14v-1.5a3 3 0 0 0-3-3h-7.5V14"/><circle cx="6.8" cy="11.3" r="1.7"/>'),
  transponder: icon('<rect x="3" y="7" width="11" height="10" rx="1.5"/><path d="M6 11h5M6 14h3"/><path d="M17 7.5a5 5 0 0 1 2.5 8.5"/><path d="M19.5 12.5V16H16"/>'),
  // The system past the charts (M25): a world, banded; a survey, a world
  // with an orbit round it; and settling, a flag planted in the ground.
  world: icon('<circle cx="12" cy="12" r="8"/><path d="M4.6 9.5c2.4 1 5.2 1.2 7.4.6s5-.6 7.4.4M4.4 14.2c2.6.8 5 .8 7.6 0s5.2-.8 7.6 0"/>'),
  survey: icon('<circle cx="12" cy="12" r="4.5"/><path d="M5.5 7.4C2.9 9 1.8 10.9 2.4 12.4c1 2.6 6.6 3.2 12.4 1.4S23 8.6 21.9 6c-.5-1.2-2.1-1.8-4.3-1.8"/>'),
  settle: icon('<path d="M7 21V3.5"/><path d="M7 4h11l-2.8 3.8L18 11.5H7"/><path d="M3 21h9"/>'),
  // The colony (M27): Next day, the sun on the skyline; Move, four ways.
  day: icon('<path d="M3 18.5h18"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 7v2.5M5.4 10.4l1.8 1.8M18.6 10.4l-1.8 1.8"/>'),
  move: icon('<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'),
  // Launch: a ship standing on its tail, fins out, its flame under it.
  launch: icon('<path d="M12 2.5c3 2.4 4.5 5.9 4.5 10.5v3h-9v-3C7.5 8.4 9 4.9 12 2.5z"/><path d="m7.5 12.5-2.5 3v2l2.5-1.5M16.5 12.5l2.5 3v2l-2.5-1.5"/><circle cx="12" cy="9.5" r="1.6"/><path d="M10.5 19 12 22l1.5-3"/>'),
};
