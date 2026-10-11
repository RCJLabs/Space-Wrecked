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
      rect(16, 13, W - 32, 18, { rx: 8, ...k.S }), // console bank along the front
      ...[0.25, 0.5, 0.75].map((f) => rect(W * f - 13, 18, 26, 8, { rx: 2, ...k.glass })),
      circle(W / 2 - 36, 50, 10, k.S), // crew seats
      circle(W / 2 + 36, 50, 10, k.S),
      circle(W / 2, 58, 12, k.S), // the captain's chair
      circle(W / 2, 58, 4, k.glow),
    ].join('');
  },
  reactor(k, W, H) {
    const [cx, cy] = [W / 2, H / 2];
    const struts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
      const d = Math.SQRT1_2;
      return line(cx + dx * 42 * d, cy + dy * 42 * d, cx + dx * 80 * d, cy + dy * 80 * d, k.heavy);
    });
    return [
      ...struts,
      circle(cx, cy, 58, { ...k.S, fill: palette.bpPaper }), // housing
      circle(cx, cy, 46, k.dashed), // shielding
      circle(cx, cy, 32, k.S),
      circle(cx, cy, 19, k.glow), // the core
    ].join('');
  },
  engine(k) {
    const blades = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i * Math.PI) / 3;
      return line(54 + 13 * Math.cos(a), 50 + 13 * Math.sin(a), 54 + 25 * Math.cos(a + 0.5), 50 + 25 * Math.sin(a + 0.5), k.thin);
    });
    return [
      rect(13, 14, 84, 72, { rx: 8, ...k.S }), // turbine housing
      circle(54, 50, 28, k.S),
      ...blades,
      circle(54, 50, 9, k.glow),
      ...[34, 50, 66].map((y) => line(118, y, 162, y, k.thin)), // fuel lines
      rect(170, 31, 18, 38, { rx: 4, ...k.S }), // valve block
    ].join('');
  },
  corridor(k) {
    return [26, 42, 58, 74].map((y) => line(18, y, 82, y, { ...k.thin, opacity: 0.5 })).join('');
  },
  airlock(k) {
    return [
      rect(17, 17, 66, 66, { rx: 5, ...k.dashed }), // keep-clear zone
      circle(50, 50, 23, k.S), // the hatch
      line(41, 41, 59, 59, k.S),
      line(41, 59, 59, 41, k.S),
    ].join('');
  },
  quarters(k) {
    return [
      rect(14, 15, 64, 28, { rx: 6, ...k.S }), // bunks
      rect(18, 19, 14, 20, { rx: 4, ...k.thin }),
      rect(14, 55, 64, 28, { rx: 6, ...k.S }),
      rect(18, 59, 14, 20, { rx: 4, ...k.thin }),
      circle(130, 44, 15, k.S), // table
      rect(170, 16, 18, 66, { rx: 3, ...k.S }), // lockers
      line(170, 49, 188, 49, k.thin),
    ].join('');
  },
  lifesupport(k) {
    const blades = [0, 60, 120].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return line(50 - 13 * Math.cos(a), 58 - 13 * Math.sin(a), 50 + 13 * Math.cos(a), 58 + 13 * Math.sin(a), k.thin);
    });
    return [
      circle(31, 28, 12, k.glass), // oxygen tanks
      circle(69, 28, 12, k.glass),
      circle(50, 58, 16, k.S), // scrubber fan
      ...blades,
    ].join('');
  },
  weapon(k) {
    return [
      rect(39, 9, 22, 30, { rx: 3, ...k.S }), // breech, toward the muzzle
      line(46, 13, 46, 36, k.thin),
      line(54, 13, 54, 36, k.thin),
      circle(50, 52, 22, { ...k.S, fill: palette.bpPaper }), // turret ring
      circle(50, 52, 9, k.S),
    ].join('');
  },
  cargo(k, W, H) {
    const crates = [[32, 32], [W - 32, 32], [32, H - 32], [W - 32, H - 32]].flatMap(([x, y]) => [
      rect(x - 16, y - 16, 32, 32, { rx: 3, ...k.S }),
      line(x - 16, y - 16, x + 16, y + 16, k.thin),
      line(x + 16, y - 16, x - 16, y + 16, k.thin),
    ]);
    return [
      ...crates,
      rect(64, 60, 72, 72, { rx: 4, ...k.dashed }), // cargo lift
      path('M 84 102 L 100 86 L 116 102', k.S),
      path('M 84 118 L 100 102 L 116 118', k.thin),
    ].join('');
  },
  medbay(k) {
    const cross = 'M 157 39 h 14 v 12 h 12 v 14 h -12 v 12 h -14 v -12 h -12 v -14 h 12 Z';
    return [
      rect(14, 14, 74, 32, { rx: 8, ...k.S }), // treatment bed
      rect(18, 18, 16, 24, { rx: 4, ...k.thin }),
      rect(104, 13, 40, 22, { rx: 4, ...k.S }), // console
      rect(110, 18, 28, 9, { rx: 2, ...k.glass }),
      path(cross, k.S),
      rect(14, 56, 48, 18, { rx: 3, ...k.thin }), // supply cabinet
    ].join('');
  },
  armory(k) {
    return [
      rect(14, 14, 44, 50, { rx: 3, ...k.S }), // weapon rack
      ...[25, 36, 47].flatMap((x) => [line(x, 22, x, 56, k.S), circle(x, 22, 2.5, k.S)]),
      rect(64, 36, 22, 28, { rx: 2, ...k.S }), // ammunition
      line(64, 50, 86, 50, k.thin),
    ].join('');
  },
  shield(k) {
    const arc = (r) => {
      const a0 = (-160 * Math.PI) / 180;
      const a1 = (-20 * Math.PI) / 180;
      return path(`M ${num(60 + r * Math.cos(a0))} ${num(38 + r * Math.sin(a0))} A ${r} ${r} 0 0 1 ${num(60 + r * Math.cos(a1))} ${num(38 + r * Math.sin(a1))}`, k.dashed);
    };
    return [
      arc(24),
      arc(30),
      circle(60, 38, 17, k.S), // emitter
      circle(60, 38, 8, k.field),
      rect(14, 50, 14, 20, { rx: 2, ...k.S }), // capacitors
      rect(32, 54, 14, 16, { rx: 2, ...k.S }),
      line(46, 62, 52, 52, k.thin),
    ].join('');
  },
};

// Module ids with a drawing of their own, for tests.
export const DRAWN = Object.keys(DRAWINGS);
