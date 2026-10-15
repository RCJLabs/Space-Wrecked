// The colony's builds in 3D (M27, M28), drawn in code: a build that grows
// food is fields, rows of crops on its soil with a water tank and a pump
// shed; one that digs materials is a headframe over its pit, with an ore
// heap, a cart and a lamp on top; one that makes power is a solar array,
// rows of panels tilted at the star, with its inverter's light; one that
// beds the crew is a shelter, a half-round hut with a door and a lit
// window; anything else is a shed. The look goes by what a build makes or
// gives (data/colony.json), so a new one needs no new drawing. Pure: the
// model in cells, z up, placed and turned where the building stands
// (solid.js placeFaces). Colors are palette.js buildColors.
import { buildColors as colors } from './palette.js';
import { placeFaces, plate, solidBox, solidCylinder } from './solid.js';

// How high the headframe's lamp stands: the tallest part of a build.
export const BUILD_TALL = 1.5;

// A build's model where it stands: { faces, glows }. placement: { x, y, rot
// }. extra goes on every face (an edge color, or a ghost's alpha); lit:
// false puts the mine's lamp, the inverter's light and the shelter's window
// out.
export function buildModel(build, placement, { extra = {}, lit = true } = {}) {
  const [w, h] = build.size;
  const faces = [];
  const glows = [];
  if (build.makes === 'food') fields(faces, w, h);
  else if (build.makes === 'materials') headframe(faces, glows, w, h);
  else if ((build.gives?.power ?? 0) > 0) solarArray(faces, glows, w, h);
  else if (build.gives?.beds || build.gives?.air) shelter(faces, glows, w, h);
  else solidBox(faces, [0.2, 0.2, 0], [w - 0.2, h - 0.2, 0.6], colors.shed);
  const def = { size: build.size };
  const placed = placeFaces(faces, def, placement).map((face) => ({ ...face, ...extra }));
  const lamps = lit ? glows.map((glow) => ({ ...glow, at: placeFaces([{ pts: [glow.at], normal: [0, 0, 1] }], def, placement)[0].pts[0] })) : [];
  return { faces: placed, glows: lamps };
}

// Rows of crops across the soil, the east end left for the tank and the
// shed.
function fields(faces, w, h) {
  plate(faces, [0.1, 0.1], [w - 0.1, h - 0.1], 0.02, colors.soil);
  const rows = Math.max(2, Math.round(h * 2));
  const step = (h - 0.4) / rows;
  for (let i = 0; i < rows; i++) {
    const y = 0.2 + i * step + step * 0.2;
    solidBox(faces, [0.2, y, 0.02], [w - 0.8, y + step * 0.6, i % 2 ? 0.16 : 0.2], i % 2 ? colors.cropDark : colors.crop);
  }
  solidCylinder(faces, [w - 0.4, 0.45, 0.02], 0.24, 0.55, colors.tank, { top: colors.water, segments: 12 });
  solidBox(faces, [w - 0.65, h - 0.75, 0.02], [w - 0.15, h - 0.2, 0.38], colors.shed);
}

// The pit under a four-post headframe with its wheel house, the lamp on
// top; the ore heap and its cart beside.
function headframe(faces, glows, w, h) {
  plate(faces, [0.1, 0.1], [w - 0.1, h - 0.1], 0.02, colors.gravel);
  const [p0, p1] = [0.3, 1.2];
  plate(faces, [p0, p0], [p1, p1], 0.03, colors.pit);
  const post = 0.08;
  for (const x of [p0, p1 - post]) {
    for (const y of [p0, p1 - post]) solidBox(faces, [x, y, 0.03], [x + post, y + post, 1.1], colors.timber);
  }
  solidBox(faces, [p0 - 0.04, p0 - 0.04, 1.1], [p1 + 0.04, p1 + 0.04, 1.18], colors.steel);
  solidBox(faces, [0.58, 0.58, 1.18], [0.92, 0.92, 1.4], colors.steel);
  glows.push({ at: [0.75, 0.75, BUILD_TALL], r: 0.5, color: colors.lamp });
  // The heap, in steps, and the cart.
  const [hx, hy] = [w - 0.7, h - 0.7];
  solidBox(faces, [hx, hy, 0.03], [hx + 0.55, hy + 0.55, 0.2], colors.ore);
  solidBox(faces, [hx + 0.1, hy + 0.1, 0.2], [hx + 0.45, hy + 0.45, 0.34], colors.oreDark);
  solidBox(faces, [hx + 0.2, hy + 0.2, 0.34], [hx + 0.35, hy + 0.35, 0.42], colors.ore);
  solidBox(faces, [w - 0.65, 0.3, 0.03], [w - 0.25, 0.62, 0.24], colors.steel);
}

// Rows of panels across the plot, each leaning back from a low front edge
// to a high back one, and the inverter's box with its light.
function solarArray(faces, glows, w, h) {
  plate(faces, [0.1, 0.1], [w - 0.1, h - 0.1], 0.02, colors.gravel);
  const rows = Math.max(2, Math.round(h));
  const depth = (h - 0.5) / rows;
  const [x0, x1] = [0.2, w - 0.55];
  for (let i = 0; i < rows; i++) {
    const y0 = 0.25 + i * depth;
    lean(faces, x0, x1, y0 + 0.05, y0 + depth * 0.8, 0.12, 0.5, colors.panel, colors.panelFrame);
  }
  solidBox(faces, [w - 0.42, 0.3, 0.02], [w - 0.15, 0.62, 0.36], colors.steel);
  glows.push({ at: [w - 0.28, 0.46, 0.44], r: 0.3, color: colors.lamp });
}

// A lean-to slab from x0 to x1: its top from y0 at low to y1 at high, the
// front lip, the back and both sides closed.
function lean(faces, x0, x1, y0, y1, low, high, top, side) {
  const [run, rise] = [y1 - y0, high - low];
  const n = Math.hypot(run, rise);
  faces.push({ pts: [[x0, y0, low], [x1, y0, low], [x1, y1, high], [x0, y1, high]], normal: [0, -rise / n, run / n], color: top });
  faces.push({ pts: [[x0, y0, 0.02], [x1, y0, 0.02], [x1, y0, low], [x0, y0, low]], normal: [0, -1, 0], color: side });
  faces.push({ pts: [[x1, y1, 0.02], [x0, y1, 0.02], [x0, y1, high], [x1, y1, high]], normal: [0, 1, 0], color: side });
  faces.push({ pts: [[x0, y1, 0.02], [x0, y0, 0.02], [x0, y0, low], [x0, y1, high]], normal: [-1, 0, 0], color: side });
  faces.push({ pts: [[x1, y0, 0.02], [x1, y1, 0.02], [x1, y1, high], [x1, y0, low]], normal: [1, 0, 0], color: side });
}

// A half-round hut lying along the plot, its ends closed, a door in the
// east end and a window in the west.
function shelter(faces, glows, w, h) {
  plate(faces, [0.1, 0.1], [w - 0.1, h - 0.1], 0.02, colors.gravel);
  const [x0, x1] = [0.25, w - 0.25];
  const cy = h / 2;
  const r = Math.min(h / 2 - 0.2, 0.75);
  const segments = 10;
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI;
    ring.push([Math.cos(t), Math.sin(t)]);
  }
  for (let i = 0; i < segments; i++) {
    const [a, b] = [ring[i], ring[i + 1]];
    const [nu, nv] = [a[0] + b[0], a[1] + b[1]];
    const n = Math.hypot(nu, nv);
    faces.push({
      pts: [[x0, cy + a[0] * r, 0.02 + a[1] * r], [x1, cy + a[0] * r, 0.02 + a[1] * r], [x1, cy + b[0] * r, 0.02 + b[1] * r], [x0, cy + b[0] * r, 0.02 + b[1] * r]],
      normal: [0, nu / n, nv / n],
      color: i % 2 ? colors.hut : colors.hutRib,
    });
  }
  const cap = (x, arc) => arc.map(([u, v]) => [x, cy + u * r, 0.02 + v * r]);
  faces.push({ pts: cap(x1, ring), normal: [1, 0, 0], color: colors.hutEnd });
  faces.push({ pts: cap(x0, [...ring].reverse()), normal: [-1, 0, 0], color: colors.hutEnd });
  faces.push({ pts: [[x1 + 0.01, cy - 0.18, 0.02], [x1 + 0.01, cy + 0.18, 0.02], [x1 + 0.01, cy + 0.18, 0.5], [x1 + 0.01, cy - 0.18, 0.5]], normal: [1, 0, 0], color: colors.door });
  glows.push({ at: [x0 - 0.05, cy, 0.4], r: 0.35, color: colors.lamp });
}
