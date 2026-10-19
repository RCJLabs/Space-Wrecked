// How each named style in a blueprint scene (shipScene.js) is drawn, and in
// what order. Widths are CSS px; `halo` is a wide faint stroke under the
// line that makes it glow.
import { palette, planLine, rgba, skins } from './palette.js';

const line = palette.bpLine;
const glow = palette.bpGlow;
const { ink } = palette;

// The styles a room is drawn in (shipScene.js room()), in a line color: the
// blueprint's own, or a maker's (M23g).
function roomStyles(color) {
  return {
    roomFloor: { fill: rgba(color, 0.05) },
    roomEdge: { stroke: rgba(color, 0.5), width: 1 },
    floorMark: { stroke: rgba(color, 0.3), width: 0.8 },
    floorDash: { stroke: rgba(color, 0.45), width: 0.9, dash: [4, 4] },
    wallFace: { fill: rgba(color, 0.07) },
    wallPost: { stroke: rgba(color, 0.45), width: 0.9 },
    propFace: { fill: rgba(color, 0.08) },
    nozzleFace: { fill: rgba(color, 0.16) },
    glass: { fill: rgba(color, 0.24) },
    propFine: { stroke: rgba(color, 0.6), width: 0.8 },
    propEdge: { stroke: rgba(color, 0.85), width: 1 },
    fieldRing: { stroke: rgba(color, 0.8), width: 1, dash: [3, 4] },
    wallTop: { stroke: color, width: 1.4, halo: rgba(color, 0.16) },
  };
}
const ROOM = roomStyles(line);

export const BLUEPRINT_STYLES = {
  gridMinor: { stroke: rgba(line, 0.09), width: 1 },
  gridMajor: { stroke: rgba(line, 0.17), width: 1 },
  yardEdge: { stroke: rgba(line, 0.4), width: 1.2, dash: [6, 5] },
  deck: { fill: rgba(line, 0.05) },
  roomFloor: ROOM.roomFloor,
  roomEdge: ROOM.roomEdge,
  floorMark: ROOM.floorMark,
  floorDash: ROOM.floorDash,
  liftedEdge: { stroke: rgba(line, 0.5), width: 1.2, dash: [5, 5] },
  // Good and bad read the palette as they are drawn: Settings' Colors can
  // swap them (M42).
  get flagEdge() {
    return { stroke: palette.bad, width: 2, dash: [6, 5] };
  },
  get blockFace() {
    return { fill: rgba(palette.bad, 0.22) };
  },
  get blockEdge() {
    return { stroke: palette.bad, width: 2.2 };
  },
  // A wrecked part (M23h), in the fire of a wrecked room on a battle map.
  wreckFace: { fill: rgba(palette.fire, 0.16) },
  wreckEdge: { stroke: palette.fire, width: 1.6, dash: [4, 3] },
  selectFace: { fill: rgba(ink, 0.07) },
  rimFace: { fill: rgba(line, 0.08) },
  rimBase: { stroke: rgba(line, 0.55), width: 1.1 },
  noseFace: { fill: rgba(line, 0.09) },
  wallFace: ROOM.wallFace,
  wallPost: ROOM.wallPost,
  propFace: ROOM.propFace,
  nozzleFace: ROOM.nozzleFace,
  glass: ROOM.glass,
  coreFace: { fill: rgba(glow, 0.28) },
  propFine: ROOM.propFine,
  propEdge: ROOM.propEdge,
  pieceFace: { fill: rgba(palette.bpStyle, 0.07) },
  pieceEdge: { stroke: rgba(palette.bpStyle, 0.85), width: 0.9 },
  fieldRing: ROOM.fieldRing,
  coreEdge: { stroke: glow, width: 1.2, halo: rgba(glow, 0.25) },
  wallTop: ROOM.wallTop,
  wreckMark: { stroke: palette.fire, width: 2, halo: rgba(palette.fire, 0.25) },
  rimTop: { stroke: line, width: 1.8, halo: rgba(line, 0.2) },
  selectEdge: { stroke: ink, width: 2.4, halo: rgba(ink, 0.25) },
  glows: {},
  get ghostTarget() {
    return { fill: rgba(palette.good, 0.16), stroke: palette.good, width: 1.6, dash: [6, 4] };
  },
  get ghostDrop() {
    return { stroke: rgba(palette.good, 0.85), width: 1, dash: [3, 4] };
  },
  get ghostFace() {
    return { fill: rgba(palette.good, 0.1) };
  },
  get ghostLine() {
    return { stroke: palette.good, width: 1.3, halo: rgba(palette.good, 0.2) };
  },
  get ghostBadTarget() {
    return { fill: rgba(palette.bad, 0.16), stroke: palette.bad, width: 1.6, dash: [6, 4] };
  },
  get ghostBadDrop() {
    return { stroke: rgba(palette.bad, 0.85), width: 1, dash: [3, 4] };
  },
  get ghostBadFace() {
    return { fill: rgba(palette.bad, 0.1) };
  },
  get ghostBadLine() {
    return { stroke: palette.bad, width: 1.3, halo: rgba(palette.bad, 0.2) };
  },
};

// Each maker with a line of its own on the plans (palette.js planLine,
// M23g): its rooms' styles again in that line, '<style>@<maker>', each drawn
// right after the style it copies.
export const MAKER_LINES = Object.fromEntries(Object.keys(skins).filter((id) => planLine(id) !== line).map((id) => [id, planLine(id)]));
const order = [];
for (const name of Object.keys(BLUEPRINT_STYLES)) {
  order.push(name);
  if (!(name in ROOM)) continue;
  for (const [maker, color] of Object.entries(MAKER_LINES)) {
    BLUEPRINT_STYLES[`${name}@${maker}`] = roomStyles(color)[name];
    order.push(`${name}@${maker}`);
  }
}

// The style a maker's part draws a room style in: its own copy where it has
// a line of its own, else the style itself.
export function makerStyle(style, maker) {
  return MAKER_LINES[maker] && style in ROOM ? `${style}@${maker}` : style;
}

// Drawing order: the deck first, then walls and fittings, glows, and what
// the player is doing on top.
export const BLUEPRINT_ORDER = order;

// A callout's tones, good and bad read as drawn (M42).
export const LABEL_TONES = {
  info: line,
  get good() {
    return palette.good;
  },
  get bad() {
    return palette.bad;
  },
};
