// A companion's bust (ROADMAP §4.5, M34): richer than a recruit's helmet
// badge, Evan's pick ("Redrawn richer in code"). Their face (face.js)
// bareheaded, in clothes and gear of their own (data/companions.json bust)
// with their side's color on them, painted on a dark navy ground: a warm
// key light from the upper left and a cool rim from the right, both laid
// round the whole figure's edge. Shown big where they offer to come aboard
// and cropped to the face on the crew and squad cards; in a fight they
// wear their job's helmet like anyone (badge.js). Pure: SVG text from
// plain data, the same each time.
//   bustSvg(look, bust, { trim, mark, crop, id })
//     look    a crew look (src/sim/looks.js)
//     bust    { wear, gear }: one of WEARS and one of GEAR
//     trim    the crew member's color
//     mark    their side's color (palette.js sideColors)
//     crop    'bust' (head and shoulders) or 'face' (closer, for small
//             sizes)
//     id      a prefix for the SVG's ids, for drawings put in one page
import { bustColors as B, palette, portraitColors as C } from '../palette.js';
import { faceGeometry, faceSvg } from './face.js';
import { mix, num, pt } from './paths.js';

// The figure is drawn in face.js's units, its shoulders broad enough to
// fill the frame: the bust sets it a fifth smaller about the neck's foot,
// head and shoulders in view; the face crop closes in on the face.
const ZOOM = {
  bust: 'translate(50 67) scale(0.8) translate(-50 -77)',
  face: 'translate(50 50) scale(1.4) translate(-50 -45)',
};

// Shoulders and arms, from the neck's foot out past the frame's edges at
// either crop.
function torso(nw) {
  return `M${num(50 - nw - 1)},75C36,77 22,80 12,84.5C2,88.5 -7,95 -8.5,108L-9,125L109,125L108.5,108C107,95 98,88.5 88,84.5C78,80 64,77 ${num(50 + nw + 1)},75Z`;
}

export function bustSvg(look, bust, { trim = palette.crewA, mark = palette.ink, crop = 'bust', id = 'b' } = {}) {
  const g = faceGeometry(look);
  const parts = faceSvg(look, g, id);
  const kind = WEARS[bust?.wear] ? bust.wear : 'coverall';
  const c = B[kind];
  const wear = WEARS[kind](g, c, mark, id);
  const gear = GEAR[bust?.gear]?.(g, mark, id) ?? {};
  let defs = `<clipPath id="${id}c"><rect width="100" height="100" rx="8"/></clipPath>`;
  defs += `<radialGradient id="${id}g" cx="0.46" cy="0.38" r="0.78"><stop offset="0" stop-color="${B.groundHi}"/><stop offset="0.5" stop-color="${B.ground}"/><stop offset="1" stop-color="${B.groundLo}"/></radialGradient>`;
  defs += glowGradient(`${id}w`, B.warm, 0.42) + glowGradient(`${id}k`, B.cool, 0.26);
  defs += `<radialGradient id="${id}n" cx="0.5" cy="0.45" r="0.72"><stop offset="0.62" stop-color="${B.groundLo}" stop-opacity="0"/><stop offset="1" stop-color="${B.groundLo}" stop-opacity="0.6"/></radialGradient>`;
  defs += `<linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.cloth}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient>`;
  defs += rimFilter(`${id}l`);
  defs += gear.defs ?? '';
  let body = `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="url(#${id}g)"/>`;
  body += `<circle cx="6" cy="4" r="54" fill="url(#${id}w)"/><ellipse cx="100" cy="60" rx="36" ry="56" fill="url(#${id}k)"/>`;
  body += BRUSH.map(([d, color, width, alpha]) => `<path d="${d}" fill="none" stroke="${B[color]}" stroke-width="${width}" stroke-linecap="round" opacity="${alpha}"/>`).join('');
  body += `<g transform="${ZOOM[crop] ?? ZOOM.bust}"><g filter="url(#${id}l)">`;
  body += parts.under + wear.back;
  body += `<path d="${torso(g.neckW)}" fill="url(#${id}t)"/>`;
  body += `<path d="M13,98Q11.6,110 13.4,125M87,98Q88.4,110 86.6,125" fill="none" stroke="${c.dark}" stroke-width="0.9" opacity="0.4"/>`;
  body += `<ellipse cx="51" cy="79.6" rx="${num(g.neckW + 6)}" ry="3" fill="${B.groundLo}" opacity="0.35"/>`;
  body += parts.face + wear.front;
  if (!gear.marks && wear.patch) body += patch(wear.patch, mark);
  body += (gear.front ?? '') + parts.over + (gear.over ?? '');
  body += `</g></g>`;
  body += `<rect width="100" height="100" fill="url(#${id}n)"/><path d="M0,0H20L0,20Z" fill="${trim}" opacity="0.9"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`;
}

// Broad strokes over the ground, so it reads painted: [path, color, width,
// opacity].
const BRUSH = [
  ['M-4,64C14,52 26,58 40,46', 'groundHi', 10, 0.2],
  ['M58,8C70,16 86,10 104,20', 'groundHi', 8, 0.16],
  ['M70,96C80,84 92,88 104,78', 'groundLo', 12, 0.35],
  ['M-4,90C8,84 16,92 30,86', 'groundLo', 10, 0.3],
];

// A soft round of light, `alpha` at its middle.
function glowGradient(id, color, alpha) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${alpha}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

// The figure with light along its edges: where its outline faces the left,
// the warm key light; where it faces right, the cool rim. Each is the
// figure less itself moved a little toward the light, softened, in that
// light's color: widest where the edge faces the light square on.
function rimFilter(id) {
  const edge = (dx, dy, color, alpha, name) =>
    `<feOffset in="SourceAlpha" dx="${dx}" dy="${dy}" result="${name}o"/><feComposite in="SourceAlpha" in2="${name}o" operator="out" result="${name}e"/>` +
    `<feGaussianBlur in="${name}e" stdDeviation="0.45" result="${name}b"/><feFlood flood-color="${color}" flood-opacity="${alpha}"/><feComposite in2="${name}b" operator="in" result="${name}"/>`;
  return `<filter id="${id}" x="-20" y="-10" width="140" height="140" filterUnits="userSpaceOnUse">${edge(1.6, 0.6, B.warm, 0.5, 'w')}${edge(-1.8, -0.2, B.cool, 0.75, 'k')}<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="w"/><feMergeNode in="k"/></feMerge></filter>`;
}

// A side's patch: a small shield in its color, a chevron on it.
function patch([x, y], mark) {
  const d = `M${num(x - 3.6)},${num(y - 3.8)}H${num(x + 3.6)}V${num(y + 0.7)}Q${num(x + 3.6)},${num(y + 3.8)} ${num(x)},${num(y + 4.9)}Q${num(x - 3.6)},${num(y + 3.8)} ${num(x - 3.6)},${num(y + 0.7)}Z`;
  return `<path d="${d}" fill="${mark}" stroke="${C.edge}" stroke-width="0.5"/><path d="M${num(x - 2)},${num(y - 0.7)}L${num(x)},${num(y + 1.3)}L${num(x + 2)},${num(y - 0.7)}" fill="none" stroke="${mix(mark, C.shadow, 0.45)}" stroke-width="0.9"/>`;
}

// A shape through points, closed.
const shape = (points, fill, more = '') => `<path d="M${points.map(pt).join('L')}Z" fill="${fill}"${more}/>`;
// Points mirrored across the face's middle.
const across = (points) => points.map(([x, y]) => [100 - x, y]);
// A pair of shapes, the lit one on the left, its mirror in the cloth.
const pair = (points, c, line = 0.5) => shape(points, c.light, ` stroke="${c.seam}" stroke-width="${line}"`) + shape(across(points), c.cloth, ` stroke="${c.seam}" stroke-width="${line}"`);

// The clothes, each (g, c, mark, id) -> { back (behind the neck), front
// (over the neck's foot), patch (where the side's patch goes) }: c is the
// clothes' colors (bustColors), mark the side's. In face.js's units: the
// neck's foot at y 77, the chest below it to the frame's foot at 118.
export const WEARS = {
  // A work coverall: a collar up round the neck, the zip, a pocket with a
  // tool in it, a name tape striped in the side's color.
  coverall(g, c, mark) {
    const nw = g.neckW;
    const back = shape([[50 - nw - 4.5, 79], [50 - nw - 2.5, 73.8], [50, 72], [50 + nw + 2.5, 73.8], [50 + nw + 4.5, 79]], c.dark);
    let front = pair([[50 - nw - 2.6, 73.6], [50 - nw - 9, 80], [45.6, 89], [49.7, 81], [50 - nw * 0.5, 79.4], [50 - nw - 0.6, 76.2]], c);
    front += `<path d="M50,81V125" stroke="${c.seam}" stroke-width="1.1"/><path d="M50.8,81.4V125" stroke="${c.light}" stroke-width="0.4" opacity="0.5"/>`;
    front += `<rect x="48.8" y="81.2" width="2.4" height="3.8" rx="0.5" fill="${C.steel}" stroke="${C.steelDark}" stroke-width="0.3"/>`;
    front += `<rect x="30.6" y="88.2" width="1.6" height="5" fill="${C.steel}"/><rect x="30.6" y="87.8" width="1.6" height="1" fill="${C.steelLight}"/>`;
    front += `<rect x="22" y="92" width="13" height="11" rx="1" fill="${mix(c.cloth, c.dark, 0.2)}" stroke="${c.seam}" stroke-width="0.5"/><path d="M22,92H35V95.4Q28.5,96.8 22,95.4Z" fill="${c.cloth}" stroke="${c.seam}" stroke-width="0.5"/>`;
    front += `<rect x="62" y="92.4" width="15" height="3.8" rx="0.6" fill="${c.tape}"/><rect x="62" y="92.4" width="3" height="3.8" fill="${mark}"/><rect x="66.6" y="93.9" width="8.4" height="0.9" fill="${c.seam}" opacity="0.6"/>`;
    front += folds(nw, c);
    return { back, front, patch: [97, 97] };
  },
  // A heavy dock coat: its tall collar up and its lapels down over a knit
  // sweater, a steward's pin on the lapel, buttoned below.
  dockcoat(g, c, mark, id) {
    const nw = g.neckW;
    const back = shape([[50 - nw - 3.4, 80], [50 - nw - 2.2, 69.8], [50, 67.8], [50 + nw + 2.2, 69.8], [50 + nw + 3.4, 80]], c.dark);
    const v = [[50 - nw - 1.2, 77], [50 + nw + 1.2, 77], [50, 99]];
    let front = `<clipPath id="${id}v"><path d="M${v.map(pt).join('L')}Z"/></clipPath>${shape(v, c.knit)}<g clip-path="url(#${id}v)">`;
    for (let y = 80.5; y < 99; y += 3) front += `<path d="M36,${y}H64" stroke="${c.knitLine}" stroke-width="0.6" opacity="0.7"/>`;
    front += `<path d="M${num(50 - nw - 0.6)},77.4Q50,82.6 ${num(50 + nw + 0.6)},77.4" fill="none" stroke="${c.knitLine}" stroke-width="2.2"/></g>`;
    front += pair([[50 - nw - 2.2, 69.8], [50 - nw - 12, 80.5], [50 - nw - 6.5, 87.5], [48.6, 100], [50 - nw - 0.6, 78]], c, 0.6);
    front += `<path d="M${num(50 - nw - 3.6)},72L${num(50 - nw - 8)},83" stroke="${c.dark}" stroke-width="0.6" opacity="0.4"/><path d="M49.4,99.6L49,125" stroke="${c.seam}" stroke-width="0.8"/>`;
    for (const y of [106, 116]) front += `<circle cx="44.6" cy="${y}" r="1.5" fill="${c.dark}" stroke="${c.seam}" stroke-width="0.4"/>`;
    front += `<circle cx="${num(50 - nw - 5)}" cy="82.6" r="1.4" fill="${C.gold}" stroke="${B.brassDark}" stroke-width="0.35"/><circle cx="${num(50 - nw - 5)}" cy="82.6" r="0.55" fill="${B.brassDark}"/>`;
    front += folds(nw, c);
    return { back, front, patch: [3, 97] };
  },
  // A Company survey jacket: a stand collar and its front closing aside,
  // piped and strapped in the side's color, the survey badge on the chest.
  surveyjacket(g, c, mark) {
    const nw = g.neckW;
    const back = shape([[50 - nw - 3, 79.5], [50 - nw - 2.4, 72.6], [50, 70.6], [50 + nw + 2.4, 72.6], [50 + nw + 3, 79.5]], c.dark);
    const collar = [[50 - nw - 2.4, 72.6], [50 - nw - 3, 79.5], [50 - nw * 0.4, 82.4], [48.8, 81.8], [48.6, 78.2], [50 - nw * 0.45, 78.4], [50 - nw - 0.6, 75.6]];
    let front = shape(collar, c.light) + shape(across(collar), c.cloth);
    for (const side of [collar, across(collar)]) front += `<path d="M${[side[4], side[5], side[6], side[0]].map(pt).join('L')}" fill="none" stroke="${mark}" stroke-width="0.7"/>`;
    front += `<path d="M51.2,81.6L57,94L61,125" fill="none" stroke="${c.seam}" stroke-width="1.1"/><path d="M52,81.4L57.8,93.8L61.8,125" fill="none" stroke="${mark}" stroke-width="0.5"/>`;
    front += pair([[50 - nw - 8, 79.4], [8, 87.6], [9, 90.2], [50 - nw - 7.4, 81.9]], c, 0.4);
    for (const [a, b] of [[[50 - nw - 7.7, 80.6], [8.5, 88.9]], [[50 + nw + 7.7, 80.6], [91.5, 88.9]]]) front += `<path d="M${pt(a)}L${pt(b)}" stroke="${mark}" stroke-width="0.5"/>`;
    front += `<path d="M64,101H80" stroke="${c.seam}" stroke-width="0.6"/>`;
    front += folds(nw, c);
    return { back, front, patch: [28, 98] };
  },
  // A medic's coat: notched lapels over scrubs, pens in its pocket, one in
  // the side's color.
  medcoat(g, c, mark) {
    const nw = g.neckW;
    const back = shape([[50 - nw - 3.6, 80], [50 - nw - 2.2, 72.4], [50, 70.6], [50 + nw + 2.2, 72.4], [50 + nw + 3.6, 80]], c.dark);
    let front = shape([[50 - nw - 1.2, 77], [50 + nw + 1.2, 77], [50, 101]], c.scrubs);
    front += `<path d="M${num(50 - nw + 1)},77.6L50,88L${num(50 + nw - 1)},77.6" fill="none" stroke="${c.scrubsDark}" stroke-width="1.1"/>`;
    front += pair([[50 - nw - 2.2, 72.4], [50 - nw - 11.5, 80.4], [50 - nw - 8.2, 84], [50 - nw - 10.4, 87.2], [48.2, 102], [50 - nw - 0.4, 78.6]], c);
    front += `<path d="M48.4,101.6L48,125" stroke="${c.seam}" stroke-width="0.7"/>`;
    front += `<rect x="64.4" y="91.4" width="1.5" height="5" rx="0.5" fill="${mark}"/><rect x="67.4" y="92.2" width="1.5" height="4.2" rx="0.5" fill="${C.steel}"/>`;
    front += `<rect x="62" y="95" width="13" height="10" rx="0.7" fill="${c.cloth}" stroke="${c.seam}" stroke-width="0.55"/>`;
    front += folds(nw, c);
    return { back, front, patch: [3.5, 97] };
  },
};

// Folds from the neck down across the chest, in the clothes' shade.
function folds(nw, c) {
  return `<path d="M${num(50 - nw - 6)},84Q32,96 22,116M${num(50 + nw + 6)},84Q68,96 78,116" fill="none" stroke="${c.dark}" stroke-width="0.8" opacity="0.35"/>`;
}

// What they carry, each (g, mark, id) -> { defs, front (over the clothes),
// over (over the hair), marks (true when it carries the side's color, so
// there is no patch) }.
export const GEAR = {
  // Goggles pushed up on the forehead, over the hair.
  goggles(g, mark, id) {
    const defs = `<radialGradient id="${id}q" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${B.cool}" stop-opacity="0.6"/><stop offset="0.45" stop-color="${B.lens}"/><stop offset="1" stop-color="${B.lens}"/></radialGradient>`;
    let over = `<path d="M${num(50 - g.hw - 1)},34.4Q50,22.4 ${num(50 + g.hw + 1)},34.4" fill="none" stroke="${B.strap}" stroke-width="2.6"/>`;
    for (const s of [-1, 1]) {
      const [x, y] = [50 + s * 6.5, 27.6];
      over += `<circle cx="${x}" cy="${y}" r="4.7" fill="${B.brass}" stroke="${B.brassDark}" stroke-width="0.5"/><circle cx="${x}" cy="${y}" r="3.5" fill="url(#${id}q)"/>`;
      over += `<path d="M${num(x - 2.2)},${num(y - 0.8)}A2.5,2.5 0 0 1 ${num(x - 0.6)},${num(y - 2.4)}" fill="none" stroke="${C.glare}" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>`;
    }
    over += `<rect x="48.3" y="26.6" width="3.4" height="2" rx="0.6" fill="${B.brassDark}"/>`;
    return { defs, over };
  },
  // A band in the side's color round the upper arm: their side's mark.
  armband(g, mark) {
    const edge = mix(mark, C.shadow, 0.4);
    const front = `<path d="M-9,101.5Q2,99 13,101.2L12.8,107.8Q2,105.6 -9,108.2Z" fill="${mark}" stroke="${edge}" stroke-width="0.5"/><path d="M-9,104.8Q2,102.3 12.9,104.5" fill="none" stroke="${edge}" stroke-width="0.8" opacity="0.7"/>`;
    return { front, marks: true };
  },
  // A headset: its band over the hair, a cup on one ear, the mic at the
  // mouth.
  headset(g) {
    const { hw } = g;
    const { mw, my } = g.mouth;
    const band = `M${num(50 - hw - 1.8)},42C${num(50 - hw - 2.6)},17 ${num(50 - hw * 0.5)},11.6 50,11.6C${num(50 + hw * 0.5)},11.6 ${num(50 + hw + 2.6)},17 ${num(50 + hw + 1.8)},42`;
    let over = `<path d="${band}" fill="none" stroke="${B.band}" stroke-width="2.4"/><path d="${band}" fill="none" stroke="${B.bandLight}" stroke-width="0.6" opacity="0.6" transform="translate(-0.5 -0.4)"/>`;
    over += `<rect x="${num(50 - hw - 3.4)}" y="38.5" width="3.4" height="7" rx="1.4" fill="${B.band}"/>`;
    const boom = `M${num(50 + hw + 0.6)},51.6Q${num(50 + hw - 1.5)},${num(my + 3.5)} ${num(50 + mw + 2.6)},${num(my + 0.8)}`;
    over += `<path d="${boom}" fill="none" stroke="${B.band}" stroke-width="1.2" stroke-linecap="round"/><path d="${boom}" fill="none" stroke="${B.bandLight}" stroke-width="0.4" opacity="0.8"/><circle cx="${num(50 + mw + 2.4)}" cy="${num(my + 0.8)}" r="1.3" fill="${B.band}" stroke="${B.bandLight}" stroke-width="0.35"/>`;
    over += `<rect x="${num(50 + hw - 1.4)}" y="42.4" width="5.4" height="10.4" rx="2.2" fill="${B.band}" stroke="${C.edge}" stroke-width="0.4"/><rect x="${num(50 + hw - 0.6)}" y="43.4" width="1.4" height="8.4" rx="0.7" fill="${B.bandLight}" opacity="0.7"/>`;
    over += `<circle cx="${num(50 + hw + 2.4)}" cy="45.2" r="0.7" fill="${B.cool}"/>`;
    return { over };
  },
  // A stethoscope round the neck, its chest piece hanging.
  stethoscope(g) {
    const nw = g.neckW;
    const left = `M${num(50 - nw - 1.8)},74.8C${num(50 - nw - 9)},79 41.5,94 40.5,125`;
    const right = `M${num(50 + nw + 1.8)},74.8C${num(50 + nw + 9)},79 60.5,88 60,97.4`;
    let front = '';
    for (const d of [left, right]) front += `<path d="${d}" fill="none" stroke="${B.tube}" stroke-width="2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${B.tubeLight}" stroke-width="0.55" opacity="0.6" transform="translate(-0.45 0)"/>`;
    front += `<rect x="59.3" y="96.6" width="1.4" height="1.6" fill="${C.steelDark}"/><circle cx="60" cy="100.6" r="3" fill="${C.steel}" stroke="${C.steelDark}" stroke-width="0.5"/><circle cx="60" cy="100.6" r="1.8" fill="${C.steelLight}"/>`;
    return { front };
  },
};
