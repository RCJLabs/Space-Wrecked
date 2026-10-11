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
  // The builder's hull frame.
  hull: '#0f1730',
  hullEdge: '#3b4c7d',
  hullGrid: '#1d2848',
  // Placeholder part colors, one per module tag, until M4 draws real parts.
  partBridge: '#5b95f7',
  partReactor: '#f2c14e',
  partEngine: '#f08a3c',
  partCorridor: '#8592b0',
  partAirlock: '#3ec7d9',
  partQuarters: '#62c97d',
  partLifesupport: '#45c2a6',
  partCargo: '#b98f5e',
  partMedbay: '#ef7aa8',
  partArmory: '#d9605a',
  partWeapon: '#ff7a52',
  partShield: '#a886f2',
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
