// Units and orders on a battle map in 3D, drawn with the map's own scene
// (battleScene.js): solid faces that the painter sorts with the walls, so a
// wall in front of a unit hides its legs. Pure: plain data in,
// { faces, glows } out. Units are tiles, z up.
//
// Units are figures in suits, facing where they look: the crew pale, each
// trimmed in a color of their own, and boarders in rust. Down, stable, out
// or dead, they lie on the deck. Orders are marks on the deck: the tiles the
// selected unit can move to (in one action or a dash), the path of the move
// being shown and the cover where it would stop, a ring under the selected
// unit, and rings under the enemies it can shoot.
import { coverOnSide } from '../sim/cover.js';
import { SIDES } from '../sim/grid.js';
import { palette, rgba } from './palette.js';
import { plate, solidCylinder } from './solid.js';

export const UNIT_TOP = 0.69; // the top of a standing unit's helmet
const CREW_TRIMS = ['crewA', 'crewB', 'crewC', 'crewD', 'crewE'];
const DECK = 0.01; // marks lie this far above the deck, rings and paths a little higher
const COVER_H = { half: 0.28, full: 0.5 };

// The trim of the crew member at `index` in the crew.
export function crewColor(index) {
  return palette[CREW_TRIMS[index % CREW_TRIMS.length]];
}

// units: [{ side, status, at: [x, y], facing: [fx, fy], trim, flash }],
// where `at` is the point it stands on (a tile's middle, or between two
// while it walks), facing a unit vector, trim its color, and flash true
// for the moment a shot hits it.
export function unitsScene(units) {
  const faces = [];
  for (const unit of units) {
    if (unit.status === 'active') standing(faces, unit);
    else lying(faces, unit);
  }
  return { faces, glows: [] };
}

function standing(out, { side, at: [cx, cy], facing: [fx, fy], trim, flash }) {
  const lit = flash ? { emissive: true } : {};
  const suit = flash ? palette.tracer : side === 'crew' ? palette.crewSuit : palette.enemySuit;
  solidCylinder(out, [cx, cy, 0], 0.17, 0.42, suit, { segments: 8, ...lit });
  solidCylinder(out, [cx, cy, 0.42], 0.19, 0.1, flash ? palette.tracer : trim, { segments: 8, ...lit });
  solidCylinder(out, [cx, cy, 0.52], 0.11, UNIT_TOP - 0.52, suit, { segments: 8, ...lit });
  // The visor, on the side it faces.
  const [ax, ay] = [-fy * 0.075, fx * 0.075];
  const [vx, vy] = [cx + fx * 0.113, cy + fy * 0.113];
  out.push({
    pts: [[vx - ax, vy - ay, 0.57], [vx + ax, vy + ay, 0.57], [vx + ax, vy + ay, 0.65], [vx - ax, vy - ay, 0.65]],
    normal: [fx, fy, 0],
    color: side === 'crew' ? palette.visor : palette.enemyVisor,
    emissive: true,
    bias: -0.02,
  });
  orientedBox(out, [cx + fx * 0.1, cy + fy * 0.1], [fx, fy], 0.36, 0.07, 0.29, 0.36, palette.gunmetal);
}

// On the deck: hurt (down or stable) in suit and trim, or grey once out of
// the fight or dead.
function lying(out, { side, status, at: [cx, cy], facing: [fx, fy], trim }) {
  const gone = status === 'dead' || status === 'out';
  const suit = gone ? palette.fallen : side === 'crew' ? palette.crewSuit : palette.enemySuit;
  orientedBox(out, [cx - fx * 0.3, cy - fy * 0.3], [fx, fy], 0.44, 0.26, 0, 0.12, suit);
  orientedBox(out, [cx - fx * 0.04, cy - fy * 0.04], [fx, fy], 0.09, 0.28, 0, 0.13, gone ? palette.fallen : trim);
  orientedBox(out, [cx + fx * 0.16, cy + fy * 0.16], [fx, fy], 0.15, 0.18, 0, 0.15, suit);
}

// A box lying along the deck from `start` in direction [fx, fy] (a unit
// vector) for `length`, `width` across, from z0 up to z1: its top and four
// sides.
function orientedBox(out, [sx, sy], [fx, fy], length, width, z0, z1, color) {
  const [ax, ay] = [(-fy * width) / 2, (fx * width) / 2];
  const [ex, ey] = [sx + fx * length, sy + fy * length];
  const [a, b, c, d] = [[sx + ax, sy + ay], [ex + ax, ey + ay], [ex - ax, ey - ay], [sx - ax, sy - ay]];
  const side = (p, q, normal) => out.push({ pts: [[...p, z0], [...q, z0], [...q, z1], [...p, z1]], normal, color });
  out.push({ pts: [[...a, z1], [...b, z1], [...c, z1], [...d, z1]], normal: [0, 0, 1], color });
  side(a, b, [-fy, fx, 0]);
  side(d, c, [fy, -fx, 0]);
  side(b, c, [fx, fy, 0]);
  side(a, d, [-fx, -fy, 0]);
}

// orders: {
//   reach      Map of { x, y, dash } (fight.js ordersFor), or null
//   preview    the fight's preview, or null: a move shows its path, where
//              it stops, and the cover there (from battle and rules)
//   selected   [x, y]: the tile of the unit giving orders, or null
//   targets    [[x, y]]: the enemies it can shoot
//   aimed      [x, y]: the one whose shot is shown, or null
// }
export function ordersScene({ reach = null, preview = null, battle = null, rules = null, selected = null, targets = [], aimed = null }) {
  const faces = [];
  for (const spot of reach?.values() ?? []) {
    const color = spot.dash ? palette.dash : palette.reach;
    plate(faces, [spot.x + 0.07, spot.y + 0.07], [spot.x + 0.93, spot.y + 0.93], DECK, color, { emissive: true, alpha: 0.2, edge: rgba(color, 0.6), bias: -0.03 });
  }
  if (selected) ring(faces, selected, 0.34, 0.44, palette.accent, 0.95);
  for (const at of targets) ring(faces, at, 0.36, 0.42, palette.target, 0.6);
  if (aimed) ring(faces, aimed, 0.32, 0.46, palette.target, 1);
  if (preview?.type === 'move') {
    const { path, to } = preview;
    for (let i = 1; i < path.length; i++) strip(faces, path[i - 1], path[i]);
    ring(faces, to, 0.17, 0.27, palette.path, 1);
    if (battle && rules) {
      for (const side of SIDES) {
        const cover = coverOnSide(battle, to, side, rules);
        if (cover) shield(faces, to, side, cover);
      }
    }
  }
  return { faces, glows: [] };
}

// A ring on the deck round the middle of tile [x, y].
function ring(out, [x, y], r0, r1, color, alpha, n = 16) {
  const [cx, cy] = [x + 0.5, y + 0.5];
  const pt = (r, t) => [cx + r * Math.cos(t), cy + r * Math.sin(t), DECK * 1.6];
  for (let i = 0; i < n; i++) {
    const [a, b] = [(i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2];
    out.push({ pts: [pt(r0, a), pt(r1, a), pt(r1, b), pt(r0, b)], normal: [0, 0, 1], color, emissive: true, alpha, bias: -0.04 });
  }
}

// A stretch of a path, between the middles of two tiles side by side.
function strip(out, [ax, ay], [bx, by]) {
  const w = 0.045;
  const [x0, x1] = [Math.min(ax, bx) + 0.5 - w, Math.max(ax, bx) + 0.5 + w];
  const [y0, y1] = [Math.min(ay, by) + 0.5 - w, Math.max(ay, by) + 0.5 + w];
  plate(out, [x0, y0], [x1, y1], DECK * 1.8, palette.path, { emissive: true, alpha: 0.95, bias: -0.04 });
}

// Cover on one side of a tile: a pane standing just inside that edge, low
// for half cover and higher for full. Both faces, so it shows from either
// side.
function shield(out, [x, y], side, cover) {
  const inset = 0.1;
  const along = side === 'n' || side === 's';
  const at = { n: y + inset, s: y + 1 - inset, w: x + inset, e: x + 1 - inset }[side];
  const [p, q] = along ? [[x + 0.2, at], [x + 0.8, at]] : [[at, y + 0.2], [at, y + 0.8]];
  const h = COVER_H[cover];
  const pts = [[...p, 0], [...q, 0], [...q, h], [...p, h]];
  const normal = along ? [0, 1, 0] : [1, 0, 0];
  const look = { color: palette.cover, emissive: true, alpha: cover === 'full' ? 0.55 : 0.4, edge: rgba(palette.cover, 0.9) };
  out.push({ pts, normal, ...look }, { pts: [...pts].reverse(), normal: normal.map((n) => -n), ...look });
}
