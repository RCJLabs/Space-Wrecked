// Blueprint art: each part as a line drawing on the ship's plans, which is
// how the builder shows it. One function per module type draws it in its own
// unrotated frame (art.js); the rest of the cell is left clear so the board's
// paper shows through. A type without a drawing here gets one from its
// interior template. A maker's version (M23g) has its base part's drawing,
// in its maker's line (palette.js planLine).
//
// Labels aren't drawn here: they stay upright while parts turn, so the board
// writes them. Drawings keep the lower part of a cell light for that.
import { palette, planLine, rgba } from '../palette.js';
import { circle, line, num, path, rect } from '../svg.js';
import { frameOf, INSET, partDocument, templateDrawing, weight } from './art.js';

// An SVG document for one part at scale { px, ratio } (see art.js).
export function blueprintSvg(def, scale) {
  const { W, H } = frameOf(def);
  const lw = weight(scale, 1.3);
  const k = look(lw, planLine(def.manufacturer));
  const room = rect(INSET, INSET, W - 2 * INSET, H - 2 * INSET, { rx: 4, fill: palette.bpPaper, ...k.S });
  const draw = DRAWINGS[def.base ?? def.id];
  const content = draw ? draw(k, W, H) : templateDrawing(def, { stroke: k.thin, fill: k.S, dark: k.S, screen: k.glass, hatch: k.dashed });
  return partDocument(def, scale, room + content);
}

// The part as an inline icon for the palette and the drag chip, `cell` CSS
// px per cell.
export function partIconSvg(def, cell = 26) {
  return blueprintSvg(def, { px: cell, ratio: 1 }).replace('<svg ', '<svg aria-hidden="true" ');
}

function look(lw, line) {
  const stroke = { stroke: line, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  return {
    lw,
    S: { fill: 'none', 'stroke-width': lw, ...stroke },
    thin: { fill: 'none', 'stroke-width': lw * 0.65, ...stroke },
    heavy: { fill: 'none', 'stroke-width': lw * 2.6, ...stroke },
    glass: { fill: rgba(line, 0.18), 'stroke-width': lw * 0.8, ...stroke },
    dashed: { fill: 'none', 'stroke-width': lw * 0.75, 'stroke-dasharray': `${lw * 4} ${lw * 3}`, ...stroke },
    glow: { fill: palette.bpGlow, opacity: 0.9 },
    field: { fill: rgba(line, 0.35) },
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
  // M23e's variants: each drawn to read apart from the part it varies.
  lightengine(k) {
    const blades = [0, 1, 2, 3].map((i) => {
      const a = (i * Math.PI) / 2;
      return line(62 + 10 * Math.cos(a), 50 + 10 * Math.sin(a), 62 + 22 * Math.cos(a + 0.6), 50 + 22 * Math.sin(a + 0.6), k.thin);
    });
    return [
      rect(14, 24, 98, 52, { rx: 18, ...k.S }), // the slim turbine
      circle(62, 50, 26, k.S),
      ...blades,
      circle(62, 50, 8, k.glow),
      line(112, 50, 140, 50, k.thin), // fuel line
      rect(140, 36, 22, 28, { rx: 4, ...k.S }), // valve
    ].join('');
  },
  heavyengine(k) {
    const turbine = (cy) => {
      const blades = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * Math.PI) / 4;
        return line(92 + 18 * Math.cos(a), cy + 18 * Math.sin(a), 92 + 36 * Math.cos(a + 0.45), cy + 36 * Math.sin(a + 0.45), k.thin);
      });
      return [circle(92, cy, 42, k.S), circle(92, cy, 30, k.dashed), ...blades, circle(92, cy, 12, k.glow)];
    };
    return [
      rect(14, 12, 168, 176, { rx: 16, ...k.S }), // the housing, two turbines in it
      ...turbine(56),
      ...turbine(144),
      rect(192, 36, 22, 128, { rx: 5, ...k.S }), // manifold
      ...[64, 100, 136].map((y) => line(214, y, 238, y, k.thin)), // fuel lines
      rect(238, 56, 44, 88, { rx: 6, ...k.S }), // valve block
      line(238, 100, 282, 100, k.thin),
    ].join('');
  },
  smallreactor(k) {
    const [cx, cy] = [138, 138];
    const struts = [[1, -1], [-1, 1]].map(([dx, dy]) => line(cx + dx * 38, cy + dy * 38, cx + dx * 52, cy + dy * 52, k.heavy));
    return [
      ...struts,
      circle(cx, cy, 50, { ...k.S, fill: palette.bpPaper }), // housing
      circle(cx, cy, 38, k.dashed), // shielding
      circle(cx, cy, 18, k.glow), // the core
      rect(18, 18, 62, 26, { rx: 4, ...k.S }), // its control panel
      rect(24, 24, 50, 12, { rx: 2, ...k.glass }),
    ].join('');
  },
  pointdefense(k) {
    return [
      ...[38, 50, 62].map((x) => line(x, 40, x, x === 50 ? 8 : 14, k.S)), // three barrels, toward the muzzle
      circle(50, 62, 24, { ...k.S, fill: palette.bpPaper }), // turret ring
      circle(50, 62, 12, k.glass), // the tracking eye
      circle(50, 62, 5, k.glow),
    ].join('');
  },
  cannon(k) {
    return [
      rect(14, 18, 46, 66, { rx: 4, ...k.S }), // shell hopper
      line(14, 40, 60, 40, k.thin),
      line(14, 62, 60, 62, k.thin),
      line(60, 51, 70, 58, k.thin), // the feed
      rect(88, 4, 24, 44, { rx: 4, ...k.S }), // the barrel, toward the muzzle
      line(100, 8, 100, 44, k.thin),
      circle(100, 62, 32, { ...k.S, fill: palette.bpPaper }), // turret ring
      circle(100, 62, 16, k.S),
      rect(148, 32, 38, 40, { rx: 5, ...k.S }), // the loader's console
      rect(154, 38, 26, 12, { rx: 2, ...k.glass }),
    ].join('');
  },
  shieldarray(k) {
    const [cx, cy] = [128, 122];
    const arc = (r) => {
      const a0 = (-165 * Math.PI) / 180;
      const a1 = (-15 * Math.PI) / 180;
      return path(`M ${num(cx + r * Math.cos(a0))} ${num(cy + r * Math.sin(a0))} A ${r} ${r} 0 0 1 ${num(cx + r * Math.cos(a1))} ${num(cy + r * Math.sin(a1))}`, k.dashed);
    };
    return [
      arc(58),
      arc(70),
      arc(82),
      circle(cx, cy, 42, { ...k.S, fill: palette.bpPaper }), // the emitter dish
      circle(cx, cy, 26, k.S),
      circle(cx, cy, 14, k.field),
      ...[16, 44].map((x) => rect(x, 128, 22, 58, { rx: 3, ...k.S })), // capacitor bank
      line(66, 157, 92, 140, k.thin),
    ].join('');
  },
  bunks(k) {
    const bunk = (y) => [rect(112, y, 76, 72, { rx: 8, ...k.S }), rect(158, y + 8, 22, 56, { rx: 5, ...k.thin })];
    const blades = [0, 60, 120].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return line(40 - 14 * Math.cos(a), 100 - 14 * Math.sin(a), 40 + 14 * Math.cos(a), 100 + 14 * Math.sin(a), k.thin);
    });
    return [
      ...bunk(16),
      ...bunk(112),
      rect(16, 66, 48, 68, { rx: 8, ...k.S }), // its own air: a scrubber
      circle(40, 100, 19, k.S),
      ...blades,
    ].join('');
  },
  surgery(k) {
    const cross = 'M 40 84 h 20 v 18 h 18 v 20 h -18 v 18 h -20 v -18 h -18 v -20 h 18 Z';
    return [
      rect(118, 22, 66, 58, { rx: 10, ...k.S }), // the operating table
      circle(151, 51, 30, k.dashed), // the lamp's light
      circle(151, 51, 9, k.glow),
      path('M 188 96 L 172 72 L 160 60', k.S), // the surgeon's arm
      rect(122, 126, 60, 46, { rx: 5, ...k.S }), // console
      rect(130, 134, 44, 14, { rx: 2, ...k.glass }),
      path(cross, k.S),
    ].join('');
  },
  largehold(k, W, H) {
    const crates = [[52, 52], [W - 52, 52], [52, H - 52], [W - 52, H - 52]].flatMap(([x, y]) => [
      rect(x - 32, y - 32, 64, 64, { rx: 4, ...k.S }),
      line(x - 32, y - 32, x + 32, y + 32, k.thin),
      line(x + 32, y - 32, x - 32, y + 32, k.thin),
    ]);
    return [
      ...crates,
      ...[18, H - 18].map((y) => line(100, y, W - 100, y, k.dashed)), // the gantry's rails
      rect(130, 80, 140, 140, { rx: 8, ...k.dashed }), // cargo lift
      path('M 172 166 L 200 138 L 228 166', k.S),
      path('M 172 192 L 200 164 L 228 192', k.thin),
      line(200, 18, 200, 80, k.thin), // the gantry's hook line
    ].join('');
  },
  // M39's: five doing a crew job's ship effect, five with rules of their
  // own, and nine versions of parts already there, each told apart.
  scanner(k) {
    return [
      rect(20, 12, 160, 30, { rx: 6, ...k.S }), // the sensor desk along the front
      ...[50, 150].map((x) => rect(x - 18, 18, 36, 14, { rx: 2, ...k.glass })),
      circle(100, 27, 13, k.S), // its scope
      circle(100, 27, 5, k.glow),
      line(100, 27, 110, 19, k.thin), // the sweep
      circle(100, 72, 13, k.S), // the operator's seat
    ].join('');
  },
  firecontrol(k) {
    return [
      rect(116, 14, 70, 72, { rx: 6, ...k.S }), // the director's console
      rect(124, 24, 54, 26, { rx: 2, ...k.glass }),
      line(151, 26, 151, 48, k.thin), // the crosshairs on its screen
      line(127, 37, 175, 37, k.thin),
      circle(151, 37, 7, k.thin),
      circle(70, 50, 15, k.S), // the gunnery officer's seat
    ].join('');
  },
  ecm(k) {
    return [
      rect(116, 18, 68, 64, { rx: 5, ...k.S }), // the jammer's cabinet
      ...[34, 50, 66].map((y) => line(122, y, 178, y, k.thin)),
      ...[132, 150, 168].map((x) => line(x, 18, x, 6, k.S)), // its aerial stubs
      circle(150, 6, 4, k.glow),
      rect(20, 62, 42, 24, { rx: 3, ...k.thin }), // a cable tray
    ].join('');
  },
  workshop(k) {
    return [
      rect(14, 14, 72, 72, { rx: 6, ...k.S }), // the lathe
      line(26, 50, 74, 50, k.heavy),
      circle(50, 50, 10, k.S),
      rect(218, 20, 64, 60, { rx: 4, ...k.S }), // the workbench
      ...[234, 250, 266].map((x) => line(x, 30, x, 70, k.thin)), // tools on it
      rect(18, 118, 64, 64, { rx: 5, ...k.S }), // the parts register
      rect(26, 128, 48, 18, { rx: 2, ...k.glass }),
      rect(120, 120, 160, 60, { rx: 6, ...k.dashed }), // the welding bay
    ].join('');
  },
  surveylab(k) {
    return [
      rect(16, 16, 68, 68, { rx: 6, ...k.S }), // the analyser
      rect(24, 24, 52, 22, { rx: 2, ...k.glass }),
      rect(20, 120, 60, 60, { rx: 5, ...k.S }), // the sample bench
      circle(50, 135, 9, k.glass), // specimen jars
      circle(50, 165, 9, k.glass),
      circle(140, 100, 15, k.S), // a stool
    ].join('');
  },
  torpedobay(k) {
    const torpedo = (x) => [rect(x - 13, 30, 26, 140, { rx: 13, ...k.S }), line(x, 30, x, 18, k.thin), path(`M ${x - 13} 158 L ${x - 20} 172 M ${x + 13} 158 L ${x + 20} 172`, k.thin)];
    return [
      rect(12, 14, 76, 172, { rx: 6, ...k.thin }), // the torpedo rack
      ...torpedo(32),
      ...torpedo(68),
      rect(120, 16, 64, 64, { rx: 5, ...k.S }), // the launch console
      rect(128, 24, 48, 18, { rx: 2, ...k.glass }),
      line(150, 186, 150, 112, k.dashed), // the loading track
    ].join('');
  },
  grapple(k) {
    return [
      rect(18, 24, 64, 52, { rx: 14, ...k.S }), // the cable drum
      ...[36, 50, 64].map((x) => line(x, 24, x, 76, k.thin)),
      path('M 50 24 L 50 8', k.S), // the cable out to the claw
      path('M 40 8 L 50 2 L 60 8', k.S),
      rect(114, 18, 72, 64, { rx: 5, ...k.S }), // the winch motor
      circle(150, 50, 16, k.thin),
    ].join('');
  },
  baffles(k) {
    const panel = (x0) => [rect(x0, 16, 76, 68, { rx: 5, ...k.S }), ...[22, 40, 58].map((x) => line(x0 + x, 22, x0 + x, 78, k.thin))];
    return [
      ...panel(12),
      ...panel(212),
      rect(112, 14, 76, 72, { rx: 6, ...k.dashed }), // the quiet deck
      path('M 132 50 q 9 -10 18 0 t 18 0', k.thin),
    ].join('');
  },
  turret(k) {
    return [
      rect(112, 12, 76, 76, { rx: 8, ...k.S }), // the armored mount
      rect(122, 22, 56, 56, { rx: 6, ...k.thin }),
      circle(150, 50, 14, k.S), // its sensor eye
      circle(150, 50, 6, k.glow),
      rect(14, 14, 72, 72, { rx: 6, ...k.dashed }), // where the gun stands
      circle(50, 50, 18, k.thin),
      line(50, 32, 50, 16, k.S),
    ].join('');
  },
  hydroponics(k) {
    const bed = (x0, y0) => [
      rect(x0, y0, 72, 72, { rx: 6, ...k.S }),
      ...[[20, 20], [52, 20], [20, 52], [52, 52]].map(([dx, dy]) => circle(x0 + dx, y0 + dy, 8, k.glass)),
    ];
    return [
      ...bed(14, 14),
      ...bed(14, 114),
      ...bed(214, 14),
      ...bed(214, 114),
      line(150, 20, 150, 180, k.dashed), // the walkway
      circle(150, 100, 7, k.glow), // the grow light
    ].join('');
  },
  railgun(k) {
    return [
      ...[12, 212].map((x0) => rect(x0, 16, 76, 68, { rx: 5, ...k.S })), // capacitor banks
      ...[30, 50, 70, 230, 250, 270].map((x) => line(x, 22, x, 78, k.thin)),
      rect(90, 4, 120, 16, { rx: 3, ...k.S }), // the rails' breech, toward the muzzle
      line(96, 12, 204, 12, k.thin),
      rect(118, 40, 64, 44, { rx: 5, ...k.S }), // the gunner's console
      rect(126, 48, 48, 14, { rx: 2, ...k.glass }),
      circle(150, 74, 4, k.glow),
    ].join('');
  },
  flak(k) {
    const turret = (cx) => [
      line(cx - 8, 36, cx - 8, 10, k.S), // two barrels, toward the muzzle
      line(cx + 8, 36, cx + 8, 10, k.S),
      circle(cx, 60, 24, { ...k.S, fill: palette.bpPaper }), // turret ring
      circle(cx, 60, 10, k.S),
    ];
    return [...turret(50), ...turret(150), rect(86, 66, 28, 24, { rx: 3, ...k.thin })].join(''); // and the shared magazine
  },
  largereactor(k, W, H) {
    const [cx, cy] = [W / 2, H / 2];
    const struts = [[30, 30], [W - 30, 30], [W - 30, H - 30], [30, H - 30]].map(([x, y]) => line(x, y, cx + (x - cx) * 0.6, cy + (y - cy) * 0.6, k.heavy));
    return [
      ...struts,
      rect(cx - 118, cy - 80, 236, 160, { rx: 80, ...k.S, fill: palette.bpPaper }), // the long housing
      rect(cx - 100, cy - 62, 200, 124, { rx: 62, ...k.dashed }), // shielding
      circle(cx - 50, cy, 30, k.S), // twin cores
      circle(cx - 50, cy, 18, k.glow),
      circle(cx + 50, cy, 30, k.S),
      circle(cx + 50, cy, 18, k.glow),
    ].join('');
  },
  thruster(k) {
    return [
      rect(12, 28, 56, 44, { rx: 14, ...k.S }), // the nozzle housing
      circle(30, 50, 12, k.S),
      circle(30, 50, 5, k.glow),
      line(68, 50, 74, 50, k.thin),
      rect(74, 34, 14, 32, { rx: 3, ...k.S }), // its valve
    ].join('');
  },
  cockpit(k) {
    return [
      rect(14, 12, 106, 38, { rx: 8, ...k.S }), // the flight console along the front
      rect(24, 20, 86, 16, { rx: 2, ...k.glass }),
      circle(68, 72, 16, k.S), // the pilot's seat
      circle(68, 72, 6, k.glow),
      rect(150, 66, 36, 22, { rx: 3, ...k.thin }), // a kit locker
    ].join('');
  },
  dormitory(k) {
    const bunk = (x0) => [rect(x0, 12, 76, 74, { rx: 8, ...k.S }), rect(x0 + 8, 18, 22, 60, { rx: 5, ...k.thin })];
    return [
      ...bunk(12),
      ...bunk(112),
      ...bunk(312),
      rect(218, 14, 64, 36, { rx: 4, ...k.S }), // lockers
      line(250, 14, 250, 50, k.thin),
      circle(120, 150, 24, k.S), // tables
      circle(280, 150, 24, k.S),
    ].join('');
  },
  airrecycler(k) {
    const tower = (cy) => {
      const blades = [0, 60, 120].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return line(50 - 20 * Math.cos(a), cy - 20 * Math.sin(a), 50 + 20 * Math.cos(a), cy + 20 * Math.sin(a), k.thin);
      });
      return [rect(12, cy - 38, 76, 76, { rx: 8, ...k.S }), circle(50, cy, 26, k.S), ...blades];
    };
    return [
      ...tower(50),
      ...tower(150),
      line(88, 50, 130, 50, k.thin), // ducts
      line(88, 150, 130, 150, k.thin),
      rect(130, 30, 30, 140, { rx: 5, ...k.S }), // the manifold
    ].join('');
  },
  cargopod(k) {
    return [
      rect(14, 14, 72, 72, { rx: 4, ...k.S }), // a crate
      line(14, 14, 86, 86, k.thin),
      line(86, 14, 14, 86, k.thin),
      rect(24, 24, 52, 52, { rx: 3, ...k.thin }), // another on it
      rect(114, 14, 72, 72, { rx: 6, ...k.dashed }), // the loading space
      path('M 134 58 L 150 42 L 166 58', k.thin),
    ].join('');
  },
  emitter(k) {
    const arc = (r) => {
      const a0 = (-160 * Math.PI) / 180;
      const a1 = (-20 * Math.PI) / 180;
      return path(`M ${num(50 + r * Math.cos(a0))} ${num(56 + r * Math.sin(a0))} A ${r} ${r} 0 0 1 ${num(50 + r * Math.cos(a1))} ${num(56 + r * Math.sin(a1))}`, k.dashed);
    };
    return [
      arc(30),
      arc(40),
      circle(50, 56, 22, { ...k.S, fill: palette.bpPaper }), // the emitter, toward the space it faces
      circle(50, 56, 10, k.field),
    ].join('');
  },
};

// Module ids with a drawing of their own, for tests.
export const DRAWN = Object.keys(DRAWINGS);
