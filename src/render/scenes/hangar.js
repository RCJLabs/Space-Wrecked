// The hangar behind the title (M34): looking down the hangar to its bay
// door, open on the night over the Tailings, with a half-built hull on the
// pad under its floodlights, its unbuilt half still a blueprint. The door's
// sky is cut out of the picture (a 'destination-out' shape), so the
// title's moving stars show through it. A FRAME-sized picture, the words
// over its middle, where the door is dark. Pure: the same seed always makes
// the same shapes.
import { sceneColors as S } from '../palette.js';
import { ellipse, glow, grain, inFrame, line, linear, poly, radial, rect, roller, vignette } from './shapes.js';
import { FRAME } from './world.js';

const C = S.hangar;
// Where the lines meet, and the back wall's corners.
const V = [800, 380];
const BACK = { x0: 470, x1: 1130, y0: 170, y1: 560 };
// The bay door in the back wall, and the sky in it.
export const DOOR = { x0: 530, x1: 1070, y0: 205, y1: 560 };

export function hangarScene(seed) {
  const [w, h] = FRAME;
  const dice = roller(`hangar ${seed}`);
  const { x0, x1, y0, y1 } = BACK;
  const shapes = [];
  // Walls, ceiling and floor, darker toward the frame's edges.
  shapes.push(rect(0, 0, w, h, C.wall));
  shapes.push(poly([[0, 0], [x0, y0], [x0, y1], [0, h]], linear(0, 0, x0, 0, [[0, S.shade, 1], [1, C.wall, 1]])));
  shapes.push(poly([[w, 0], [x1, y0], [x1, y1], [w, h]], linear(w, 0, x1, 0, [[0, S.shade, 1], [1, C.wall, 1]])));
  shapes.push(poly([[0, 0], [w, 0], [x1, y0], [x0, y0]], linear(0, 0, 0, y0, [[0, S.shade, 1], [1, C.girder, 1]])));
  shapes.push(poly([[0, h], [w, h], [x1, y1], [x0, y1]], linear(0, h, 0, y1, [[0, C.girder, 1], [1, C.floor, 1]])));
  shapes.push(rect(x0, y0, x1 - x0, y1 - y0, linear(0, y0, 0, y1, [[0, C.girder, 1], [1, C.wallLight, 1]])));
  // The deck: plates running back to the door.
  for (let i = -9; i <= 9; i++) {
    const bx = V[0] + i * 130;
    shapes.push(line([[bx, h], towardBack(bx, h)], C.floorLine, 2, { alpha: 0.7 }));
  }
  for (let i = 1; i < 8; i++) {
    const u = (i / 8) ** 1.7;
    const yy = y1 + (h - y1) * u;
    const half = (x1 - x0) / 2 + (w / 2 - (x1 - x0) / 2) * u;
    shapes.push(line([[V[0] - half, yy], [V[0] + half, yy]], C.floorLine, 1.6, { alpha: 0.55 }));
  }
  // The door: its sky cut out, the ridge and the Tailings' lights in it.
  const { x0: d0, x1: d1, y0: dy0, y1: dy1 } = DOOR;
  shapes.push(rect(d0 - 14, dy0 - 14, d1 - d0 + 28, dy1 - dy0 + 14, C.girderLight));
  shapes.push(rect(d0, dy0, d1 - d0, dy1 - dy0, S.shade, { blend: 'destination-out' }));
  const ridge = [[d0, dy1]];
  for (let x = d0; x <= d1; x += 24) ridge.push([x, dy1 - 46 - 34 * Math.sin(x / 70) ** 2 - dice.between(0, 14)]);
  ridge.push([d1, dy1]);
  shapes.push(poly(ridge, C.ridge));
  for (let i = 0; i < 26; i++) {
    const x = dice.between(d0 + 10, d1 - 10);
    shapes.push(glow(x, dy1 - dice.between(6, 40), dice.between(3, 9), C.town, 0.7, { blend: 'lighter' }));
  }
  shapes.push(rect(d0, dy0, d1 - d0, dy1 - dy0, linear(0, dy0, 0, dy1, [[0, S.shade, 0], [0.75, S.shade, 0], [1, C.town, 0.12]]), { blend: 'lighter' }));
  // The door's tracks and the frame round it.
  shapes.push(rect(d0 - 14, dy0 - 30, d1 - d0 + 28, 16, C.girder));
  for (const x of [d0 - 14, d1]) shapes.push(rect(x, dy0 - 14, 14, dy1 - dy0 + 14, C.girder));
  for (let i = 0; i < 8; i++) shapes.push(poly(stripe(d0 - 14 + i * ((d1 - d0 + 28) / 8), dy0 - 30, (d1 - d0 + 28) / 16, 16), C.hazard, { alpha: 0.8 }));
  // Girders down the side walls and trusses across the roof.
  for (let i = 0; i < 6; i++) {
    const u = i / 6;
    for (const side of [-1, 1]) {
      const xEdge = side < 0 ? 0 : w;
      const xBack = side < 0 ? x0 : x1;
      const x = xEdge + (xBack - xEdge) * u ** 0.8;
      const top = y0 * (x - xEdge) / (xBack - xEdge);
      const bottom = h - (h - y1) * (x - xEdge) / (xBack - xEdge);
      const thick = 34 * (1 - u) + 6;
      shapes.push(rect(x - thick / 2, top, thick, bottom - top, C.girder));
      shapes.push(rect(x - thick / 2 + (side < 0 ? thick - 3 : 0), top, 3, bottom - top, C.girderLight, { alpha: 0.6 }));
    }
    const ty = y0 * (1 - u ** 0.8) * 0.9;
    shapes.push(line([[x0 * u ** 0.8, ty], [w - x0 * u ** 0.8, ty]], C.girder, 18 * (1 - u) + 4));
  }
  // The floodlights, their light falling on the pad.
  for (const [lx, ly, spread] of [[330, 70, 260], [1270, 70, 260], [620, 150, 170], [980, 150, 170]]) {
    shapes.push(poly([[lx - 14, ly], [lx + 14, ly], [V[0] + (lx - V[0]) * 0.25 + spread, 780], [V[0] + (lx - V[0]) * 0.25 - spread, 780]], linear(0, ly, 0, 780, [[0, C.lamp, 0.22], [1, C.lamp, 0]]), { blend: 'lighter', blur: 10 }));
    shapes.push(rect(lx - 22, ly - 8, 44, 14, C.girder));
    shapes.push(rect(lx - 16, ly + 4, 32, 5, S.warmCore));
    shapes.push(glow(lx, ly + 6, 70, C.lamp, 0.45, { blend: 'lighter' }));
  }
  // The pad: a ring of hazard paint, lit.
  shapes.push(ellipse(800, 752, 470, 104, null, { stroke: C.hazard, width: 8, alpha: 0.55 }));
  shapes.push(ellipse(800, 752, 430, 92, radial(800, 752, 430, [[0, C.lamp, 0.16], [1, C.lamp, 0]]), { blend: 'lighter' }));
  hull(shapes, dice);
  // Haze in the light, and the painted tooth.
  for (let i = 0; i < 9; i++) shapes.push(glow(dice.between(200, 1400), dice.between(150, 700), dice.between(80, 200), C.lamp, 0.05, { blend: 'lighter' }));
  shapes.push(...grain(dice, w, h, 900, S.speck, S.shade));
  shapes.push(vignette(w, h, S.shade, 0.7));
  return { size: FRAME, shapes: inFrame(shapes, w, h) };
}

// The point on the back wall's foot that a line from (x, y) runs to.
function towardBack(x, y) {
  const u = (BACK.y1 - y) / (V[1] - y);
  return [x + (V[0] - x) * u, BACK.y1];
}

// A hazard stripe: a slanted bar w wide at (x, y), h tall.
function stripe(x, y, w, h) {
  return [[x, y + h], [x + w * 0.6, y], [x + w * 1.4, y], [x + w * 0.8, y + h]];
}

// The half-built hull on the pad, side on, nose to the right: plated from
// the stern to the middle, the rest its blueprint in light, scaffolding
// round it, a floodlight's warm edge along its back.
function hull(shapes, dice) {
  const outline = [[490, 700], [470, 660], [500, 618], [640, 600], [780, 596], [930, 600], [1060, 618], [1160, 650], [1190, 668], [1160, 686], [1040, 708], [860, 716], [640, 714]];
  const built = outline.filter(([x]) => x <= 820);
  const cut = [[820, 597], [820, 715]];
  shapes.push(ellipse(830, 742, 380, 34, S.shade, { alpha: 0.6, blur: 14 }));
  for (const x of [600, 760, 940, 1080]) shapes.push(line([[x, 712], [x - 16, 746]], C.girder, 8));
  // The built half.
  shapes.push(poly([...built, cut[0], cut[1]], linear(0, 596, 0, 716, [[0, C.hullLight, 1], [1, C.hull, 1]]), { smooth: false }));
  for (const x of [540, 600, 660, 720, 780]) shapes.push(line([[x, 604], [x, 712]], C.girder, 1.6, { alpha: 0.55 }));
  shapes.push(line([[500, 618], [640, 600], [780, 596], [820, 597]], C.lamp, 3, { alpha: 0.6, blur: 1.5 }));
  shapes.push(rect(470, 640, 22, 40, C.girder));
  for (const y of [646, 666]) shapes.push(glow(468, y, 22, S.cool, 0.35, { blend: 'lighter' }));
  // The rest, in blueprint lines.
  const plan = outline.filter(([x]) => x >= 820);
  shapes.push(line([cut[0], ...plan, cut[1]], C.blueprint, 2.4, { alpha: 0.85 }));
  shapes.push(line([cut[0], ...plan, cut[1]], C.blueprint, 9, { alpha: 0.18, blur: 4, blend: 'lighter' }));
  for (const x of [880, 940, 1000, 1060, 1120]) {
    const top = 600 + (x - 820) * 0.08 + (x > 1060 ? (x - 1060) * 0.4 : 0);
    shapes.push(line([[x, top], [x, 712 - (x > 1040 ? (x - 1040) * 0.25 : 0)]], C.blueprint, 1.2, { alpha: 0.45 }));
  }
  shapes.push(line([[820, 656], [1170, 660]], C.blueprint, 1.2, { alpha: 0.45 }));
  // Scaffolding round the unbuilt half.
  for (const x of [840, 960, 1090, 1200]) shapes.push(line([[x, 548], [x, 744]], C.girderLight, 3, { alpha: 0.8 }));
  for (const y of [560, 640, 724]) shapes.push(line([[836, y], [1204, y]], C.girderLight, 2.4, { alpha: 0.7 }));
  shapes.push(line([[840, 560], [960, 640], [1090, 560], [1200, 640]], C.girderLight, 1.6, { alpha: 0.5 }));
  for (let i = 0; i < 5; i++) shapes.push(glow(dice.between(860, 1180), dice.between(600, 700), 4, S.warmCore, 0.9, { blend: 'lighter' }));
}
