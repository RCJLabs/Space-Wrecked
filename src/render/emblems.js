// The emblems a hull can wear (M52), drawn in code: each a list of flat
// shapes in a square from -1 to 1 (x to starboard of the drawing's own
// up, y down), painted in order, a `mark` in the trim's color and a `cut`
// in the hull's paint over it (holes, eyes). data/styling.json names them;
// tools/validate-data.js checks each has a drawing here. Pure.

const TAU = Math.PI * 2;

// A circle (or an arc of one) as points: n of them, radius r, about [cx, cy].
function circle(cx, cy, r, n = 20, from = 0, to = TAU) {
  const whole = to - from >= TAU - 1e-9;
  const count = whole ? n : n + 1;
  return Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const mark = (pts) => ({ tone: 'mark', pts });
const cut = (pts) => ({ tone: 'cut', pts });

function star(points, outer, inner) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / points;
    const r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

function gear(teeth, outer, inner) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (TAU * i) / teeth;
    const w = (TAU / teeth) * 0.25;
    for (const [da, r] of [[-w * 1.4, inner], [-w, outer], [w, outer], [w * 1.4, inner]]) pts.push([Math.cos(a + da) * r, Math.sin(a + da) * r]);
  }
  return pts;
}

export const EMBLEMS = {
  star: [mark(star(5, 1, 0.42))],
  wing: [
    mark([[0, -0.35], [1, -0.75], [0.75, -0.2], [1, 0.05], [0.55, 0.3], [0.2, 0.55], [0, 0.8], [-0.2, 0.55], [-0.55, 0.3], [-1, 0.05], [-0.75, -0.2], [-1, -0.75]]),
  ],
  comet: [mark(circle(-0.45, 0.45, 0.45)), mark([[-0.75, 0.15], [0.95, -0.95], [-0.15, 0.75]])],
  eye: [
    mark([...circle(0, 0.7, 1.1, 12, -Math.PI * 0.79, -Math.PI * 0.21), ...circle(0, -0.7, 1.1, 12, Math.PI * 0.21, Math.PI * 0.79)]),
    cut(circle(0, 0, 0.38)),
    mark(circle(0, 0, 0.18)),
  ],
  ring: [mark(circle(0, 0, 1, 24)), cut(circle(0, 0, 0.62, 24)), mark(circle(0, 0, 0.22, 12))],
  shield: [mark([[-0.85, -0.9], [0.85, -0.9], [0.85, 0.05], [0.5, 0.6], [0, 1], [-0.5, 0.6], [-0.85, 0.05]]), cut([[-0.12, -0.7], [0.12, -0.7], [0.12, 0.65], [-0.12, 0.65]])],
  pick: [
    mark(rect(-0.1, -0.55, 0.1, 1)),
    mark([...circle(0, 0.25, 1.05, 10, -Math.PI * 0.82, -Math.PI * 0.18), ...circle(0, 0.25, 0.8, 10, -Math.PI * 0.18, -Math.PI * 0.82)]),
  ],
  anchor: [
    mark(rect(-0.09, -0.6, 0.09, 0.85)),
    mark(rect(-0.5, -0.45, 0.5, -0.3)),
    mark(circle(0, -0.78, 0.22, 12)),
    cut(circle(0, -0.78, 0.1, 10)),
    mark([...circle(0, 0.15, 0.85, 12, Math.PI * 0.05, Math.PI * 0.95), ...circle(0, 0.15, 0.65, 12, Math.PI * 0.95, Math.PI * 0.05)]),
  ],
  blade: [mark([[0, -1], [0.2, -0.75], [0.14, 0.45], [-0.14, 0.45], [-0.2, -0.75]]), mark(rect(-0.55, 0.42, 0.55, 0.56)), mark(rect(-0.08, 0.56, 0.08, 1))],
  gear: [mark(gear(8, 1, 0.78)), cut(circle(0, 0, 0.36, 16))],
};

// An emblem as a little SVG for a tile (the Look tab, M52), px square, in
// the current color with its cuts in the tile's own background.
export function emblemSvg(id, px) {
  const drawing = EMBLEMS[id];
  if (!drawing) return '';
  const shapes = drawing.map(({ tone, pts }) => `<path d="M${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}Z" fill="${tone === 'cut' ? 'var(--c-panel, #000)' : 'currentColor'}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="-1.1 -1.1 2.2 2.2" width="${px}" height="${px}">${shapes}</svg>`;
}
