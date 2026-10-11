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
  },
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
