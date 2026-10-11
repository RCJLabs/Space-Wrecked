// Blueprint art: each part as a line drawing on the ship's plans, which is
// how the builder shows it. One function per module type draws it in its own
// unrotated frame (art.js); the rest of the cell is left clear so the board's
// paper shows through. A type without a drawing here gets one from its
// interior template.
//
// Labels aren't drawn here: they stay upright while parts turn, so the board
// writes them. Drawings keep the lower part of a cell light for that.
import { palette, rgba } from '../palette.js';
import { circle, line, num, path, rect } from '../svg.js';
import { frameOf, INSET, partDocument, templateDrawing, weight } from './art.js';

// An SVG document for one part at scale { px, ratio } (see art.js).
export function blueprintSvg(def, scale) {
  const { W, H } = frameOf(def);
  const lw = weight(scale, 1.3);
  const k = look(lw);
  const room = rect(INSET, INSET, W - 2 * INSET, H - 2 * INSET, { rx: 4, fill: palette.bpPaper, ...k.S });
  const draw = DRAWINGS[def.id];
  const content = draw ? draw(k, W, H) : templateDrawing(def, { stroke: k.thin, fill: k.S, dark: k.S, screen: k.glass, hatch: k.dashed });
  return partDocument(def, scale, room + content);
}

// The part as an inline icon for the palette and the drag chip, `cell` CSS
// px per cell.
export function partIconSvg(def, cell = 26) {
  return blueprintSvg(def, { px: cell, ratio: 1 }).replace('<svg ', '<svg aria-hidden="true" ');
}

function look(lw) {
  const stroke = { stroke: palette.bpLine, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  return {
    lw,
    S: { fill: 'none', 'stroke-width': lw, ...stroke },
    thin: { fill: 'none', 'stroke-width': lw * 0.65, ...stroke },
    heavy: { fill: 'none', 'stroke-width': lw * 2.6, ...stroke },
    glass: { fill: rgba(palette.bpLine, 0.18), 'stroke-width': lw * 0.8, ...stroke },
    dashed: { fill: 'none', 'stroke-width': lw * 0.75, 'stroke-dasharray': `${lw * 4} ${lw * 3}`, ...stroke },
    glow: { fill: palette.bpGlow, opacity: 0.9 },
    field: { fill: rgba(palette.bpLine, 0.35) },
  };
}

// Each drawing: (look, W, H) => SVG content, in units with the origin at the
// part's top left, unrotated: the bridge's front, the gun's muzzle and the
// quarters' windows face north; the engine's exhaust faces west.
const DRAWINGS = {
  bridge(k, W) {
    return [
      rect(26, 22, W - 52, 38, { rx: 10, ...k.S }), // console bank along the front
      ...[0.25, 0.5, 0.75].map((f) => rect(W * f - 22, 34, 44, 14, { rx: 3, ...k.glass })),
      circle(W / 2 - 55, 105, 17, k.S), // crew seats
      circle(W / 2 + 55, 105, 17, k.S),
      circle(W / 2, 132, 21, k.S), // the captain's chair
      circle(W / 2, 132, 7, k.glow),
    ].join('');
  },
  reactor(k, W, H) {
    const [cx, cy] = [W / 2, H / 2];
    const struts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
      const d = Math.SQRT1_2;
      return line(cx + dx * 63 * d, cy + dy * 63 * d, cx + dx * 120 * d, cy + dy * 120 * d, k.heavy);
    });
    return [
      ...struts,
      circle(cx, cy, 87, { ...k.S, fill: palette.bpPaper }), // housing
      circle(cx, cy, 69, k.dashed), // shielding
      circle(cx, cy, 48, k.S),
      circle(cx, cy, 28, k.glow), // the core
    ].join('');
  },
  engine(k) {
    const blades = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i * Math.PI) / 3;
      return line(80 + 22 * Math.cos(a), 100 + 22 * Math.sin(a), 80 + 44 * Math.cos(a + 0.5), 100 + 44 * Math.sin(a + 0.5), k.thin);
    });
    return [
      rect(18, 30, 124, 140, { rx: 12, ...k.S }), // turbine housing
      circle(80, 100, 50, k.S),
      ...blades,
      circle(80, 100, 15, k.glow),
      ...[70, 100, 130].map((y) => line(150, y, 168, y, k.thin)), // fuel lines
      rect(170, 58, 18, 84, { rx: 4, ...k.S }), // valve block
    ].join('');
  },
  corridor(k) {
    return [32, 50, 68].map((y) => line(18, y, 82, y, { ...k.thin, opacity: 0.5 })).join('');
  },
  airlock(k) {
    return [
      rect(16, 16, 168, 68, { rx: 6, ...k.dashed }), // keep-clear zone
      circle(100, 50, 26, k.S), // the hatch
      line(89, 39, 111, 61, k.S),
      line(89, 61, 111, 39, k.S),
    ].join('');
  },
  quarters(k) {
    return [
      rect(16, 18, 104, 66, { rx: 8, ...k.S }), // bunks
      rect(22, 26, 24, 50, { rx: 5, ...k.thin }),
      rect(16, 112, 104, 66, { rx: 8, ...k.S }),
      rect(22, 120, 24, 50, { rx: 5, ...k.thin }),
      circle(190, 95, 25, k.S), // table
      rect(258, 20, 26, 160, { rx: 4, ...k.S }), // lockers
      line(258, 100, 284, 100, k.thin),
    ].join('');
  },
  lifesupport(k) {
    const blades = [0, 60, 120].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return line(134 - 18 * Math.cos(a), 50 - 18 * Math.sin(a), 134 + 18 * Math.cos(a), 50 + 18 * Math.sin(a), k.thin);
    });
    return [
      circle(38, 30, 15, k.glass), // oxygen tanks
      circle(38, 70, 15, k.glass),
      rect(88, 14, 94, 72, { rx: 8, ...k.S }), // scrubber
      circle(134, 50, 24, k.S), // its fan
      ...blades,
    ].join('');
  },
  weapon(k) {
    return [
      rect(39, 9, 22, 30, { rx: 3, ...k.S }), // breech, toward the muzzle
      line(46, 13, 46, 36, k.thin),
      line(54, 13, 54, 36, k.thin),
      circle(50, 58, 28, { ...k.S, fill: palette.bpPaper }), // turret ring
      circle(50, 58, 11, k.S),
    ].join('');
  },
  cargo(k, W, H) {
    const crates = [[45, 45], [W - 45, 45], [45, H - 45], [W - 45, H - 45]].flatMap(([x, y]) => [
      rect(x - 26, y - 26, 52, 52, { rx: 4, ...k.S }),
      line(x - 26, y - 26, x + 26, y + 26, k.thin),
      line(x + 26, y - 26, x - 26, y + 26, k.thin),
    ]);
    return [
      ...crates,
      rect(95, 95, 110, 110, { rx: 6, ...k.dashed }), // cargo lift
      path('M 124 158 L 150 132 L 176 158', k.S),
      path('M 124 182 L 150 156 L 176 182', k.thin),
    ].join('');
  },
  medbay(k) {
    const cross = 'M 230 104 h 22 v 20 h 20 v 22 h -20 v 20 h -22 v -20 h -20 v -22 h 20 Z';
    return [
      rect(18, 20, 117, 60, { rx: 10, ...k.S }), // treatment bed
      rect(24, 28, 26, 44, { rx: 5, ...k.thin }),
      rect(165, 16, 60, 34, { rx: 5, ...k.S }), // console
      rect(173, 23, 44, 12, { rx: 2, ...k.glass }),
      path(cross, k.S),
      rect(18, 120, 84, 36, { rx: 4, ...k.thin }), // supply cabinet
    ].join('');
  },
  armory(k) {
    return [
      rect(14, 14, 86, 48, { rx: 4, ...k.S }), // weapon rack
      ...[32, 50, 68, 86].flatMap((x) => [line(x, 22, x, 54, k.S), circle(x, 22, 3, k.S)]),
      rect(118, 30, 66, 50, { rx: 3, ...k.S }), // ammunition
      line(118, 55, 184, 55, k.thin),
    ].join('');
  },
  shield(k) {
    const arc = (r) => {
      const a0 = (-160 * Math.PI) / 180;
      const a1 = (-20 * Math.PI) / 180;
      return path(`M ${num(130 + r * Math.cos(a0))} ${num(54 + r * Math.sin(a0))} A ${r} ${r} 0 0 1 ${num(130 + r * Math.cos(a1))} ${num(54 + r * Math.sin(a1))}`, k.dashed);
    };
    return [
      arc(32),
      arc(40),
      circle(130, 54, 22, k.S), // emitter
      circle(130, 54, 10, k.field),
      rect(14, 18, 28, 64, { rx: 3, ...k.S }), // capacitors
      rect(52, 28, 24, 54, { rx: 3, ...k.S }),
      line(76, 55, 108, 55, k.thin),
    ].join('');
  },
};

// Module ids with a drawing of their own, for tests.
export const DRAWN = Object.keys(DRAWINGS);
