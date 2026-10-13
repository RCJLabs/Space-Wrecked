// Palette tokens: the one place colors are defined. Canvas code reads them
// from here; CSS reads them as --c-* custom properties set at boot.
// `space` is also written literally in manifest.webmanifest (theme and
// background colors) and index.html (theme-color), which can't read tokens.
export const palette = {
  space: '#070a14',
  spaceHi: '#0e1530',
  nebulaA: '#2b1f5c',
  nebulaB: '#0f3d4f',
  star: '#ffffff',
  starWarm: '#ffd9a8',
  starCool: '#a9c6ff',
  ink: '#e8ecf5',
  inkDim: '#8d97ad',
  accent: '#ff9b3d',
  panel: 'rgba(12, 17, 32, 0.95)',
  line: '#2a3552',
  good: '#5fd38d',
  bad: '#ff6b6b',
  // The builder shows the ship as a 3D blueprint: glowing lines over a
  // navy grid.
  bpPaper: '#0b1e3d',
  bpSky: '#14305c',
  bpDeep: '#081530',
  bpLine: '#8cd7ff',
  bpGlow: '#ffd36b',
  // Wrecked rooms on a battle map: fire, vacuum and rubble, each with the
  // floor color it leaves.
  fire: '#ff7a2f',
  fireCore: '#ffd36b',
  scorch: '#2b2126',
  vacuum: '#9fe3ff',
  frost: '#3d5f80',
  rubble: '#80746a',
  dust: '#3f3b3c',
  // Units on a battle map: the crew in pale suits, each trimmed in a color
  // of their own (the same as on their button), and boarders in rust.
  crewSuit: '#c9d4e6',
  crewA: '#5fd3e8',
  crewB: '#8fe36b',
  crewC: '#b99bff',
  crewD: '#ff8fc8',
  crewE: '#f2f5fa',
  enemySuit: '#a4473d',
  enemyTrim: '#ff6b4a',
  visor: '#bff0ff',
  enemyVisor: '#ffb36b',
  gunmetal: '#262f42',
  fallen: '#4a5160',
  // Figures (src/render/figures/): the slate under a skinsuit's plates, the
  // dark of joints and soles, a dark visor's glass, lamps, the gun in hand
  // and the outline round a figure, with the boarders' own where they
  // differ; and the greys of the fallen.
  crewUnder: '#4b5873',
  enemyUnder: '#4d3337',
  enemyDark: '#2a2630',
  glass: '#16253f',
  enemyGlass: '#2a1a1e',
  lamp: '#fff1b8',
  gun: '#2b3447',
  figureEdge: 'rgba(4, 8, 18, 0.95)',
  fallenTrim: '#5b6372',
  fallenDark: '#2b303b',
  // Orders on a battle map: the tiles a unit can move to in one action or
  // in a dash, the path it would take, the cover where it would stop, the
  // enemies it can shoot, and shots in flight.
  reach: '#8cd7ff',
  dash: '#ffc857',
  path: '#ffe39a',
  cover: '#bff0ff',
  target: '#ff6b6b',
  tracer: '#fff1b8',
  // The run's sector map: the chart under the nodes, and its grid.
  chart: 'rgba(14, 21, 48, 0.6)',
  chartGrid: 'rgba(42, 53, 82, 0.35)',
};

// Manufacturers are skins over the same part shapes: the colors a built ship
// is painted in outside the builder, keyed by manufacturer id.
export const skins = {
  yard: {
    space: '#071226',
    edge: '#08101f',
    hull: '#3c4b68',
    plates: ['#3c4b68', '#425275', '#38465f', '#455679'],
    seam: '#222d45',
    rivet: '#6f83a8',
    livery: '#8cd7ff',
    metal: '#5d6f94',
    metalHi: '#7488ad',
    dark: '#1d273d',
    darker: '#141b2c',
    soft: '#c3d0e4',
    glassHi: '#bff0ff',
    glassLo: '#3f8fc4',
    domeHi: '#8fa3c8',
    domeLo: '#3a4867',
    glow: '#ffd36b',
    glowCore: '#fff1b8',
    hazard: '#e3b341',
    flame: '#a8e8ff',
    shield: '#b49cff',
    medical: '#ff6b6b',
    port: '#ff5a5a',
    starboard: '#5fd38d',
    // Inside, on a battle map.
    floors: ['#28344e', '#2c3955', '#253048', '#2f3c59'],
    floorSeam: '#18202f',
    // The hangar's deck around the ship, in a raid (hangarMap.js).
    deck: '#30363f',
    wall: '#6a7da3',
    door: '#e3b341',
    doorLight: '#ffe39a',
    screen: '#7fe0ff',
  },
};

// A job's site on the ground (src/sim/gen/site.js), not a ship: the yard's
// fittings on dusty concrete, with rock where a ship has its hull and fences
// for walls.
skins.ground = {
  ...skins.yard,
  edge: '#15120f',
  hull: '#5e534a',
  dark: '#2a2622',
  floors: ['#3b3631', '#3f3a34', '#37332e', '#423c35'],
  floorSeam: '#26221e',
  wall: '#8b929b',
};

// The skin for a manufacturer, or the yard's for one without a skin yet.
export function skinFor(manufacturer) {
  return skins[manufacturer] ?? skins.yard;
}

export function applyCssVars(root = document.documentElement) {
  for (const [name, value] of Object.entries(palette)) {
    root.style.setProperty(`--c-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
}

// '#rrggbb' plus an alpha, as an rgba() string.
export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
