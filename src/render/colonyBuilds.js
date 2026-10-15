// The colony's farms and mines in 3D (M27), drawn in code: a build that
// grows food is fields, rows of crops on its soil with a water tank and a
// pump shed; one that digs materials is a headframe over its pit, with an
// ore heap, a cart and a lamp on top; anything else is a shed. The look
// goes by what a build makes (data/colony.json), so a new one needs no new
// drawing. Pure: the model in cells, z up, placed and turned where the
// building stands (solid.js placeFaces). Colors are palette.js buildColors.
import { buildColors as colors } from './palette.js';
import { placeFaces, plate, solidBox, solidCylinder } from './solid.js';

// How high the headframe's lamp stands: the tallest part of a build.
export const BUILD_TALL = 1.5;

// A build's model where it stands: { faces, glows }. placement: { x, y, rot
// }. extra goes on every face (an edge color, or a ghost's alpha); lit:
// false puts the mine's lamp out.
export function buildModel(build, placement, { extra = {}, lit = true } = {}) {
  const [w, h] = build.size;
  const faces = [];
  const glows = [];
  if (build.makes === 'food') fields(faces, w, h);
  else if (build.makes === 'materials') headframe(faces, glows, w, h);
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
