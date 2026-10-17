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
  // Styling pieces on the blueprint (M23f): set apart from the rooms.
  bpStyle: '#d0a8ff',
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
  // The run's sector map: the chart under the nodes, and its grid; a
  // nebula's cloud (M24); a world past the charts (M25).
  chart: 'rgba(14, 21, 48, 0.6)',
  chartGrid: 'rgba(42, 53, 82, 0.35)',
  nebula: '#b49cff',
  world: '#6fe3c5',
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

// The ground of a world settled (M26's colony), by its kind (data/worlds.json):
// the land round the colony, the ground cleared for its grid, and the slabs
// its buildings stand on. A kind without its own takes rock's.
export const grounds = {
  ocean: { land: '#1d3a40', cleared: '#2a4b50', slab: '#6c7a7c' },
  desert: { land: '#4a3823', cleared: '#5c472d', slab: '#8f8270' },
  ice: { land: '#3b4c5c', cleared: '#4d6172', slab: '#8796a5' },
  jungle: { land: '#1d321c', cleared: '#3f3a28', slab: '#77776a' },
  rock: { land: '#302d2b', cleared: '#423e3a', slab: '#7a746e' },
};

export function groundFor(kind) {
  return grounds[kind] ?? grounds.rock;
}

// Scenes (M34, src/render/scenes/): the painted backdrops. Every scene is
// lit the same way, a warm sun from the upper right and a cool bounce from
// the lower left, darkening to `shade` at its edges. Each has its own
// colors: the ground seen from above at the lift-off and the landing, which
// starts from the colony's land for its kind (grounds above), and the world
// seen whole; the hangar behind the title.
export const sceneColors = {
  warm: '#ffb347',
  warmCore: '#fff1b8',
  cool: '#8cd7ff',
  shade: '#04060c',
  speck: '#f4f1ea',
  cloud: '#eef3fb',
  air: '#8cd7ff',
  night: '#0a0d18',
  homeworld: { ground: '#34302d', light: '#5a534c', dark: '#191716', dust: '#6e655c', road: '#4f4841', roadLine: '#8a7d6c', pit: '#100e0d', terrace: '#433d38', pad: '#3f444c', padRing: '#596070', hazard: '#e3b341', roof: '#22262e', roofLine: '#3b4250', lamp: '#ffd36b', planet: '#4a4440', planetDark: '#26221f', planetLight: '#8c8178' },
  rock: { ground: grounds.rock.land, light: '#544d47', dark: '#171514', dust: '#625a53', pit: '#0f0e0d', planet: '#5a524b', planetDark: '#2a2622', planetLight: '#9a8f84' },
  desert: { ground: grounds.desert.land, light: '#c08a52', mid: '#7d5a34', dark: '#2a1f14', rock: '#5a3d28', rockTop: '#9c7149', salt: '#d9ceb4', saltLine: '#a8987a', planet: '#a9743f', planetDark: '#4d331c', planetLight: '#e2b77a' },
  ice: { ground: grounds.ice.land, light: '#d5e6f2', mid: '#8eaec6', dark: '#1d2a36', crack: '#7fe0ff', lead: '#0b1a26', planet: '#a9c4d8', planetDark: '#3c5468', planetLight: '#eef6fb' },
  jungle: { ground: grounds.jungle.land, leaves: ['#1f4a24', '#285a2b', '#163a1b', '#33682f'], light: '#7cbd63', dark: '#0a160b', river: '#163a44', glint: '#4fa3ae', mist: '#d8e8e0', scorch: '#1b130e', ember: '#ff7a2f', planet: '#2e6b3a', planetDark: '#0f2d2a', planetLight: '#7cbd63', sea: '#16485e' },
  ocean: { ground: grounds.ocean.land, light: '#2b6f8c', dark: '#061524', deep: '#0b2640', sea: '#134468', shallow: '#2f8f98', foam: '#d8f2f5', sand: '#c9b48a', land: '#3b5a37', landDark: '#273f25', planet: '#1d5f8f', planetDark: '#0a223a', planetLight: '#5fb3d6' },
  hangar: { wall: '#18202f', wallLight: '#2b3650', girder: '#0e131c', girderLight: '#3a4762', floor: '#1f2633', floorLine: '#2f394c', hazard: '#e3b341', hull: '#262e40', hullLight: '#46536f', blueprint: '#8cd7ff', lamp: '#ffd36b', ridge: '#0a0d15', town: '#ffb347' },
};

// The colony's own buildings (M27, colonyBuilds.js): a farm's soil, crops
// and water tank; a mine's gravel, pit, timbers, steel and ore, and the
// lamp on its headframe; and the shed anything else is.
export const buildColors = {
  soil: '#4b3a27',
  crop: '#79b552',
  cropDark: '#558c3c',
  tank: '#a7b3bf',
  water: '#4fa8d6',
  shed: '#8a7e6e',
  gravel: '#6b665f',
  pit: '#151311',
  timber: '#8a6a45',
  steel: '#9aa4ae',
  ore: '#b8743f',
  oreDark: '#86512c',
  lamp: '#ffd36b',
  // M28: the solar array's panels and frames, the shelter's skin, its ribs,
  // its ends and its door.
  panel: '#2f4f86',
  panelFrame: '#c8d0d8',
  hut: '#c9c2b4',
  hutRib: '#b3ab9b',
  hutEnd: '#a8a092',
  door: '#3a3530',
};

// Bastion Arms (M23g): gunmetal fittings, orange hazard chevrons, engines
// burning orange, and amber lines on the plans. Its parts take the ship's
// paint and trim like any other's (FITTINGS).
skins.bastion = {
  ...skins.yard,
  metal: '#4f5446',
  metalHi: '#727862',
  dark: '#24261f',
  darker: '#17180f',
  domeHi: '#848a74',
  domeLo: '#3d4035',
  rivet: '#a8ad94',
  hazard: '#ff8c1a',
  flame: '#ffb36b',
  mark: '#ff8c1a',
  markDark: '#1a1a14',
  plans: '#ffc45e',
};

// Kestrel Dynamics (M31): pale pearl fittings, two coral stripes, engines
// burning violet, and rose lines on the plans.
skins.kestrel = {
  ...skins.yard,
  metal: '#c3ccd9',
  metalHi: '#eef2f8',
  dark: '#5a6479',
  darker: '#3c4558',
  domeHi: '#eef2f8',
  domeLo: '#9fadc2',
  rivet: '#e3e9f2',
  hazard: '#ff7a59',
  flame: '#d9ccff',
  mark: '#ff7a59',
  markDark: '#3c4558',
  plans: '#ff9ad2',
};

// Scrapline (M31): rust-brown fittings with bare patches of unpainted
// metal, engines burning green, and lime lines on the plans.
skins.scrapline = {
  ...skins.yard,
  metal: '#7d5c41',
  metalHi: '#a87f5c',
  dark: '#3b2c21',
  darker: '#2a1e16',
  domeHi: '#a39d8f',
  domeLo: '#5c5647',
  rivet: '#d0a87e',
  hazard: '#c9b45a',
  flame: '#d8f07a',
  mark: '#8f9196',
  markDark: '#6f7177',
  plans: '#c8ee6e',
};

// The skin for a manufacturer, or the yard's for one without a skin yet.
export function skinFor(manufacturer) {
  return skins[manufacturer] ?? skins.yard;
}

// What a part takes from its maker's skin (M23g): the fittings on its roof
// and what sticks out of the hull for it, and its mark. The hull, its paint
// and its trim stay the ship's.
export const FITTINGS = ['metal', 'metalHi', 'dark', 'darker', 'domeHi', 'domeLo', 'rivet', 'hazard', 'flame', 'mark', 'markDark'];
export function fittingsOf(manufacturer) {
  const skin = skinFor(manufacturer);
  return Object.fromEntries(FITTINGS.filter((key) => key in skin).map((key) => [key, skin[key]]));
}

// A maker's line on the plans and on its parts' icons (M23g): the yard's
// is the blueprint's own.
export function planLine(manufacturer) {
  return skinFor(manufacturer).plans ?? palette.bpLine;
}

// Paint and trim (data/styling.json names them, M23f): a hull's color with
// its plates' tints and its seams, and the trim that the livery stripe and
// the lit fittings take. Slate and sky are the yard's own, every ship's
// until it is painted.
export const paints = {
  slate: { hull: '#3c4b68', plates: ['#3c4b68', '#425275', '#38465f', '#455679'], seam: '#222d45' },
  graphite: { hull: '#3d4148', plates: ['#3d4148', '#454950', '#383b42', '#4a4e57'], seam: '#202328' },
  bone: { hull: '#aaa596', plates: ['#aaa596', '#b3ae9f', '#a29d8e', '#b8b3a6'], seam: '#6f6a5e' },
  rust: { hull: '#7a432f', plates: ['#7a432f', '#844a34', '#713d2a', '#8b5139'], seam: '#45251a' },
  olive: { hull: '#55603f', plates: ['#55603f', '#5c6845', '#4e5839', '#626e4a'], seam: '#30361f' },
  navy: { hull: '#26365c', plates: ['#26365c', '#2b3c66', '#223154', '#30426d'], seam: '#131c32' },
};
export const trims = {
  sky: '#8cd7ff',
  amber: '#ffb347',
  signal: '#ff5a4a',
  lime: '#9be35a',
  violet: '#b49cff',
  white: '#eef3fb',
};

// The sides' colors (M33): data/factions.json gives each side one by name,
// for its mark beside the side's name on the panels, the job board and the
// chart.
export const sideColors = {
  yellow: '#e3b341',
  blue: '#7ea6ff',
  magenta: '#d77ad1',
  brick: '#e2735a',
};

// A skin with a ship's paint and trim over it; ones it doesn't know leave
// the skin's own.
export function paintSkin(skin, paint, trim) {
  const coat = paints[paint];
  return { ...skin, ...(coat ? { hull: coat.hull, plates: coat.plates, seam: coat.seam } : {}), ...(trims[trim] ? { livery: trims[trim] } : {}) };
}

// Portraits (src/render/portraits/): skin, hair and eye colors by the ids
// in src/sim/looks.js, then the rest of a face and the card it is on.
// Shadows and highlights are mixed toward `shadow` and `light`.
export const portraitColors = {
  skin: { porcelain: '#f6d7c3', fair: '#eec1a3', peach: '#e6b08c', sand: '#d59c78', olive: '#bd8a62', tan: '#a8704f', umber: '#8a5537', brown: '#6b3f28', deep: '#4a2b1c' },
  hair: { black: '#16110e', darkBrown: '#3b2619', brown: '#6a4228', auburn: '#8f3f22', copper: '#b8612f', blond: '#d9b46a', platinum: '#e8e1cf', grey: '#a3a7ad', teal: '#38b6c2', magenta: '#d0478f', violet: '#7d5bd0' },
  eyes: { brown: '#5a3a22', dark: '#2b1d14', hazel: '#7a6a3a', green: '#4f7a4a', blue: '#4a78a8', grey: '#7d8a96', amber: '#b07a2a' },
  shadow: '#24120b',
  light: '#fff4ea',
  white: '#f4f1ea',
  feature: '#1b120e',
  pupil: '#120c0a',
  lip: '#a8433f',
  blush: '#e0706a',
  scar: '#f3c2bd',
  tattoo: '#1f5c6a',
  steel: '#7d879b',
  steelDark: '#2a3140',
  steelLight: '#c4ccdb',
  plate: '#4a5568',
  implant: '#ff4d3d',
  implantCore: '#fff0c9',
  port: '#5fd3e8',
  gold: '#ffd36b',
  patch: '#1a1514',
  card: '#101830',
  cardLine: '#2a3552',
  behind: '#0d1424',
  edge: '#0b0f1a',
  glassTint: '#5fa8d8',
  glassDeep: '#0b1a33',
  glare: '#ffffff',
};

// A companion's bust (M34, portraits/bust.js): the painted ground behind
// them, its warm key light and cool rim, and each kind of clothes and gear
// (data/companions.json bust). Their side's patch is in sideColors.
export const bustColors = {
  ground: '#0f1830',
  groundHi: '#22355c',
  groundLo: '#050914',
  warm: sceneColors.warm,
  cool: sceneColors.cool,
  coverall: { cloth: '#34465f', light: '#556b8e', dark: '#19222f', seam: '#121a26', tape: '#c9c2ad' },
  dockcoat: { cloth: '#5b4331', light: '#83634a', dark: '#2a1d14', seam: '#21170f', knit: '#3a4140', knitLine: '#262c2b' },
  surveyjacket: { cloth: '#2d323f', light: '#4b5468', dark: '#13161d', seam: '#0d0f14' },
  medcoat: { cloth: '#c9d1db', light: '#f1f4f7', dark: '#7f8b9c', seam: '#66727f', scrubs: '#2f6166', scrubsDark: '#1b3b3f' },
  strap: '#2a1f18',
  brass: '#c79a4a',
  brassDark: '#6f5022',
  lens: '#0e1c2a',
  band: '#20252f',
  bandLight: '#566073',
  tube: '#242932',
  tubeLight: '#6a7383',
};

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
