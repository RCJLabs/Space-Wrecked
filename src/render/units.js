// Units and orders on a battle map in 3D, drawn with the map's own scene
// (battleScene.js), sorted with the walls by the painter, so a wall in
// front of a unit hides it. Pure: plain data in, plain data out. Units are
// tiles, z up.
//
// Units are figures in their suits (figures/figure.js), facing where they
// look: the crew pale, each trimmed in a color of their own, and boarders in
// rust. Down or stable they lie on the deck in their colors; out or dead,
// in grey; a captive held (M38) stands. Each is drawn once and kept
// (figures/sprites.js), so the scene gives them as figures, not faces.
// Orders are marks on the deck: the tiles the selected unit can move to (in
// one action or a dash), the path of the move being shown and the cover
// where it would stop, a ring under the selected unit, and rings under the
// enemies it can shoot. A job's ways out and the way in it holds (M38) are
// outlined on the deck under them (zonesScene).
import { coverOnSide } from '../sim/cover.js';
import { SIDES } from '../sim/grid.js';
import { palette, rgba } from './palette.js';
import { plate } from './solid.js';

export const UNIT_TOP = 0.8; // the top of a standing unit's helmet, near enough
export const LYING_TOP = 0.36; // and of a unit lying on the deck
const CREW_TRIMS = ['crewA', 'crewB', 'crewC', 'crewD', 'crewE'];
const DECK = 0.01; // marks lie this far above the deck, rings and paths a little higher
const COVER_H = { half: 0.28, full: 0.5 };

// The trim of the crew member at `index` in the crew.
export function crewColor(index) {
  return palette[CREW_TRIMS[index % CREW_TRIMS.length]];
}

// units: [{ id, side, status, at: [x, y], facing: [fx, fy], trim, flash,
// look, held, pose, suit? }], where `at` is the point it stands on (a tile's
// middle, or between two while it walks), facing a unit vector, trim its
// color, flash true for the moment a shot hits it, look and held its kind's
// and its weapon's (figures/looks.js), and pose { aim, stride, fall }
// (figure.js), and suit a crew member's suit color (M58, livery.js
// suitColor) in place of the standard. Returns { figures } for figures/sprites.js, each { id, at,
// facing, look, held, colors, pose, key }.
export function unitsScene(units) {
  const figures = units.map(({ id, side, status, at, facing, trim, flash, look, held, pose = {}, suit }) => {
    const colors = colorsOf(side, status, trim, flash, suit);
    const lying = status !== 'active' && status !== 'held';
    return {
      id,
      at,
      facing,
      look,
      held,
      colors,
      pose: lying ? { fall: 1 } : pose,
      key: `${JSON.stringify(look ?? null)}${JSON.stringify(held ?? null)}${Object.values(colors).join()}`,
    };
  });
  return { figures };
}

// A figure's colors (figures/figure.js) and the outline round it: its
// side's, its trim, grey once out of the fight or dead, and the tracer's
// flash for the moment a shot hits it.
export function colorsOf(side, status, trim, flash = false, suit = null) {
  const gone = status === 'dead' || status === 'out';
  if (gone) {
    const grey = palette.fallenDark;
    return { suit: palette.fallen, trim: palette.fallenTrim, dark: grey, under: grey, visor: grey, glass: grey, lamp: grey, gun: grey, outline: palette.figureEdge };
  }
  const crew = side === 'crew';
  const colors = {
    suit: crew ? suit ?? palette.crewSuit : palette.enemySuit,
    trim,
    dark: crew ? palette.gunmetal : palette.enemyDark,
    under: crew ? palette.crewUnder : palette.enemyUnder,
    visor: crew ? palette.visor : palette.enemyVisor,
    glass: crew ? palette.glass : palette.enemyGlass,
    lamp: palette.lamp,
    gun: palette.gun,
    outline: palette.figureEdge,
  };
  if (flash) Object.assign(colors, { suit: palette.tracer, trim: palette.tracer, under: palette.tracer });
  return colors;
}

// orders: {
//   reach      Map of { x, y, dash } (fight.js ordersFor), or null
//   preview    the fight's preview, or null: a move shows its path, where
//              it stops, and the cover there (from battle and rules)
//   selected   [x, y]: the tile of the unit giving orders, or null
//   targets    [[x, y]]: the enemies it can shoot
//   aimed      [x, y]: the one whose shot is shown, or null
// }
export function ordersScene({ reach = null, preview = null, battle = null, rules = null, selected = null, targets = [], aimed = null, ordered = null, welding = null }) {
  const faces = [];
  for (const spot of reach?.values() ?? []) {
    const color = spot.dash ? palette.dash : palette.reach;
    plate(faces, [spot.x + 0.07, spot.y + 0.07], [spot.x + 0.93, spot.y + 0.93], DECK, color, { emissive: true, alpha: 0.2, edge: rgba(color, 0.6), bias: -0.03 });
    // A dash is hatched as well as colored (M42: never color alone).
    if (spot.dash) for (const k of [0.3, 0.55, 0.8]) hatch(faces, [spot.x + 0.07, spot.y + 0.07], [spot.x + 0.93, spot.y + 0.93], 1, k, color, 0.55);
  }
  if (selected) ring(faces, selected, 0.34, 0.44, palette.accent, 0.95);
  for (const at of targets) ring(faces, at, 0.36, 0.42, palette.target, 0.6);
  if (aimed) ring(faces, aimed, 0.32, 0.46, palette.target, 1);
  // A job's order shown (M32): the unit it reaches, or the door beside the
  // selected unit it would weld, a pane standing in the doorway.
  if (ordered) ring(faces, ordered, 0.3, 0.46, palette.good, 1);
  if (welding && selected) shield(faces, selected, welding, 'full', palette.good);
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

// A job's tiles on the deck (M38): each tile of each zone outlined in its
// color, under the orders' marks. zones: [{ tiles: [[x, y]], tone }], tone
// 'out' (a way out, the far gate) or 'hold' (the way in a defense holds).
export function zonesScene(zones) {
  const faces = [];
  for (const { tiles, tone } of zones) {
    const color = tone === 'hold' ? palette.target : palette.accent;
    for (const [x, y] of tiles) {
      plate(faces, [x + 0.12, y + 0.12], [x + 0.88, y + 0.88], DECK, color, { emissive: true, alpha: 0.14, edge: rgba(color, 0.85), bias: -0.02 });
      // The way in held is crossed, not just colored (M42).
      if (tone === 'hold') for (const sign of [1, -1]) hatch(faces, [x + 0.12, y + 0.12], [x + 0.88, y + 0.88], sign, 0.5, color, 0.7, -0.025);
    }
  }
  return faces;
}

// A strip across the box [x0, y0]..[x1, y1] on the deck, along the line
// x + sign * y through the point k of the way across (0 to 1), clipped to
// the box: hatching (several) or a cross (one each way). bias as a face's.
function hatch(out, [x0, y0], [x1, y1], sign, k, color, alpha, bias = -0.035, w = 0.035) {
  const z = DECK * 1.3;
  // In box coordinates u, v (0..1) the line is u + sign * v = c.
  const [lo, hi] = sign > 0 ? [0, 2] : [-1, 1];
  const at = (c) => {
    const ends = [];
    for (const v of [0, 1]) {
      const u = c - sign * v;
      if (u >= 0 && u <= 1) ends.push([u, v]);
    }
    for (const u of [0, 1]) {
      const v = (c - u) * sign;
      if (v > 0 && v < 1) ends.push([u, v]);
    }
    return ends.length === 2 ? ends : null;
  };
  const c = lo + (hi - lo) * k;
  const [a, b] = [at(c - w), at(c + w)];
  if (!a || !b) return;
  const pt = ([u, v]) => [x0 + u * (x1 - x0), y0 + v * (y1 - y0), z];
  const order = (e) => [...e].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const [a0, a1] = order(a);
  const [b0, b1] = order(b);
  out.push({ pts: [pt(a0), pt(a1), pt(b1), pt(b0)], normal: [0, 0, 1], color, emissive: true, alpha, bias });
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
function shield(out, [x, y], side, cover, color = palette.cover) {
  const inset = 0.1;
  const along = side === 'n' || side === 's';
  const at = { n: y + inset, s: y + 1 - inset, w: x + inset, e: x + 1 - inset }[side];
  const [p, q] = along ? [[x + 0.2, at], [x + 0.8, at]] : [[at, y + 0.2], [at, y + 0.8]];
  const h = COVER_H[cover];
  const pts = [[...p, 0], [...q, 0], [...q, h], [...p, h]];
  const normal = along ? [0, 1, 0] : [1, 0, 0];
  const look = { color, emissive: true, alpha: cover === 'full' ? 0.55 : 0.4, edge: rgba(color, 0.9) };
  out.push({ pts, normal, ...look }, { pts: [...pts].reverse(), normal: normal.map((n) => -n), ...look });
}
