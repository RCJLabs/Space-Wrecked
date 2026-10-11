// How each named style in a blueprint scene (shipScene.js) is drawn, and in
// what order. Widths are CSS px; `halo` is a wide faint stroke under the
// line that makes it glow.
import { palette, rgba } from './palette.js';

const line = palette.bpLine;
const glow = palette.bpGlow;
const { good, bad, accent, ink, inkDim } = palette;

export const BLUEPRINT_STYLES = {
  gridMinor: { stroke: rgba(line, 0.06), width: 1 },
  gridMajor: { stroke: rgba(line, 0.13), width: 1 },
  slot: { stroke: rgba(line, 0.42), width: 1.2, dash: [5, 4] },
  deck: { fill: rgba(line, 0.05) },
  roomFloor: { fill: rgba(line, 0.05) },
  roomEdge: { stroke: rgba(line, 0.5), width: 1 },
  floorMark: { stroke: rgba(line, 0.3), width: 0.8 },
  floorDash: { stroke: rgba(line, 0.45), width: 0.9, dash: [4, 4] },
  liftedEdge: { stroke: rgba(line, 0.5), width: 1.2, dash: [5, 5] },
  flagEdge: { stroke: bad, width: 2, dash: [6, 5] },
  blockFace: { fill: rgba(bad, 0.22) },
  blockEdge: { stroke: bad, width: 2.2 },
  selectFace: { fill: rgba(ink, 0.07) },
  rimFace: { fill: rgba(line, 0.08) },
  rimBase: { stroke: rgba(line, 0.55), width: 1.1 },
  noseFace: { fill: rgba(line, 0.09) },
  wallFace: { fill: rgba(line, 0.07) },
  wallPost: { stroke: rgba(line, 0.45), width: 0.9 },
  doorOpen: { fill: rgba(accent, 0.3), stroke: accent, width: 2.2 },
  doorBlocked: { fill: rgba(bad, 0.28), stroke: bad, width: 2.2 },
  doorSealed: { fill: rgba(inkDim, 0.16), stroke: rgba(inkDim, 0.75), width: 1.6 },
  propFace: { fill: rgba(line, 0.08) },
  nozzleFace: { fill: rgba(line, 0.16) },
  glass: { fill: rgba(line, 0.24) },
  coreFace: { fill: rgba(glow, 0.28) },
  propFine: { stroke: rgba(line, 0.6), width: 0.8 },
  propEdge: { stroke: rgba(line, 0.85), width: 1 },
  fieldRing: { stroke: rgba(line, 0.8), width: 1, dash: [3, 4] },
  coreEdge: { stroke: glow, width: 1.2, halo: rgba(glow, 0.25) },
  wallTop: { stroke: line, width: 1.4, halo: rgba(line, 0.16) },
  rimTop: { stroke: line, width: 1.8, halo: rgba(line, 0.2) },
  selectEdge: { stroke: ink, width: 2.4, halo: rgba(ink, 0.25) },
  glows: {},
  ghostTarget: { fill: rgba(good, 0.16), stroke: good, width: 1.6, dash: [6, 4] },
  ghostDrop: { stroke: rgba(good, 0.85), width: 1, dash: [3, 4] },
  ghostFace: { fill: rgba(good, 0.1) },
  ghostLine: { stroke: good, width: 1.3, halo: rgba(good, 0.2) },
  ghostBadTarget: { fill: rgba(bad, 0.16), stroke: bad, width: 1.6, dash: [6, 4] },
  ghostBadDrop: { stroke: rgba(bad, 0.85), width: 1, dash: [3, 4] },
  ghostBadFace: { fill: rgba(bad, 0.1) },
  ghostBadLine: { stroke: bad, width: 1.3, halo: rgba(bad, 0.2) },
};

// Drawing order: the deck first, then walls and fittings, glows, and what
// the player is doing on top.
export const BLUEPRINT_ORDER = Object.keys(BLUEPRINT_STYLES);

export const LABEL_TONES = { info: line, good, bad };
