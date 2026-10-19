// Color vision for the palette's tests (M42): a color as someone with
// protanopia, deuteranopia or tritanopia sees it (Machado, Oliveira and
// Fernandes 2009, severity 1.0, on linear sRGB), CIEDE2000 between two
// colors, and WCAG contrast. Pure.
export const VISIONS = [null, 'protan', 'deutan', 'tritan'];
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp = (x) => Math.min(1, Math.max(0, x));
function seen(rgb, vision) {
  const l = rgb.map(lin);
  return vision ? M[vision].map((row) => clamp(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])) : l;
}
function lab([r, g, b]) {
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de00([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hue = (b, a) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2) : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cpb;
  const SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad) * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  return Math.sqrt(((L2 - L1) / SL) ** 2 + ((Cp2 - Cp1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((Cp2 - Cp1) / SC) * (dH / SH));
}

// How far apart two '#rrggbb' colors look (CIEDE2000) to the eye named.
export function apart(a, b, vision = null) {
  return de00(lab(seen(rgbOf(a), vision)), lab(seen(rgbOf(b), vision)));
}

// The least of apart() over normal vision and the three kinds.
export const leastApart = (a, b) => Math.min(...VISIONS.map((vision) => apart(a, b, vision)));

// WCAG contrast of two [r, g, b].
export function contrast(a, b) {
  const lum = (rgb) => {
    const [r, g, b2] = rgb.map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
