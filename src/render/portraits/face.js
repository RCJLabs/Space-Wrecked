// A portrait's face (ROADMAP §4.5, M23c): its shape from the look's face
// number, then the head, ears, neck, eyes, brows, nose and mouth as SVG,
// in a 100 x 100 box with the head's middle at x 50, lit from the upper
// left. The hair and beard (hair.js) and a mark (marks.js) go on top.
// Pure: the same look always draws the same.
import { portraitColors as C } from '../palette.js';
import { hairSvg } from './hair.js';
import { markSvg, markedEye } from './marks.js';
import { mix, mirror, num, pt, spline } from './paths.js';

// Face shapes, each 0 to 1 unless signed: the head's width, the jaw's, the
// chin's and its length; the eyes' size, how open, and the tilt of their
// outer corners; the brows' thickness, rise and frown; the nose's width and
// length; and the mouth's width, smile (-1 to 1) and fullness.
// src/sim/looks.js FACES counts them.
export const FACE_SHAPES = [
  shape([0.4, 0.2, 0.3, 0.4], [0.6, 0.55, 0.5], [0.35, 0.4, -0.2], [0.35, 0.4], [0.55, 0.35, 0.7]),
  shape([0.75, 0.9, 0.8, 0.6], [0.4, 0.35, 0.1], [0.8, 0.1, 0.6], [0.75, 0.5], [0.6, -0.2, 0.6]),
  shape([0.3, 0.15, 0.25, 0.3], [0.75, 0.7, 0.3], [0.3, 0.6, -0.3], [0.2, 0.2], [0.4, 0.5, 0.55]),
  shape([0.55, 0.35, 0.4, 0.5], [0.55, 0.5, 0.4], [0.5, 0.3, 0], [0.6, 0.35], [0.6, 0.1, 0.9]),
  shape([0.35, 0.3, 0.35, 0.9], [0.5, 0.45, 0.6], [0.25, 0.2, 0.3], [0.25, 0.6], [0.45, -0.1, 0.4]),
  shape([0.85, 0.75, 0.6, 0.4], [0.35, 0.3, -0.2], [0.7, 0.2, 0.2], [0.85, 0.8], [0.7, 0.2, 0.4]),
  shape([0.55, 0.65, 0.5, 0.5], [0.45, 0.55, 0.2], [0.55, 0.5, 0.4], [0.5, 0.7], [0.5, 0.6, 0.35]),
  shape([0.6, 0.3, 0.45, 0.3], [0.7, 0.6, 0.35], [0.45, 0.5, -0.1], [0.7, 0.3], [0.55, 0.7, 0.85]),
  shape([0.25, 0.5, 0.6, 0.8], [0.4, 0.4, 0], [0.6, 0, 0.5], [0.4, 0.9], [0.4, -0.4, 0.3]),
  shape([0.45, 0.25, 0.2, 0.2], [0.9, 0.8, 0.2], [0.3, 0.7, -0.2], [0.3, 0.1], [0.35, 0.4, 0.6]),
  shape([0.65, 0.8, 1, 0.7], [0.5, 0.4, 0.3], [0.65, 0.3, 0.3], [0.55, 0.55], [0.65, 0, 0.5]),
  shape([0.5, 0.5, 0.5, 0.5], [0.55, 0.45, 0.45], [0.4, 0.4, 0.5], [0.45, 0.45], [0.5, 0.3, 0.5]),
];

function shape([width, jaw, chin, chinLen], [size, open, tilt], [thick, raise, angle], [noseWidth, noseLength], [mouthWidth, smile, full]) {
  return { width, jaw, chin, chinLen, eyes: { size, open, tilt }, brows: { thick, raise, angle }, nose: { width: noseWidth, length: noseLength }, mouth: { width: mouthWidth, smile, full } };
}

// The face's shape in the box: { hw, jw, cw, chinY, right (the outline's
// right half, top down), head (path data), eyes, brows, nose, mouth,
// shadow, ears, neck, neckW, suit, collar }.
export function faceGeometry(look) {
  const f = FACE_SHAPES[look.face] ?? FACE_SHAPES[0];
  const hw = 16 + 4.4 * f.width;
  const jw = 10 + 6.6 * f.jaw;
  const cw = 3.2 + 3.4 * f.chin;
  const chinY = 68.6 + 2.6 * f.chinLen;
  const right = [
    [50, 16.5],
    [50 + hw * 0.56, 18.2],
    [50 + hw * 0.9, 24.4],
    [50 + hw, 34],
    [50 + hw * 0.99, 43],
    [50 + hw * 0.95, 50],
    [50 + (hw * 0.95 + jw) / 2 + 0.6, 56.5],
    [50 + jw, 62],
    [50 + (jw + cw) / 2 + 0.9, 66.6],
    [50 + cw, chinY - 0.7],
  ];
  const outline = [...right, [50, chinY + 0.4], ...right.slice(1).reverse().map(mirror)];
  const es = 7.9 + 1.3 * f.width;
  const eyes = [-1, 1].map((s) => {
    const ex = 50 + s * es;
    const ey = 47;
    const ew = 3.5 + 0.8 * f.eyes.size;
    const eh = 1.45 + 0.75 * f.eyes.open;
    const inner = [ex - s * ew, ey];
    const outer = [ex + s * ew, ey - f.eyes.tilt];
    const top = [ex - s * ew * 0.12, ey - eh * 2.15];
    const bottom = [ex + s * ew * 0.05, ey + eh * 1.55];
    const d = `M${pt(inner)}Q${pt(top)} ${pt(outer)}Q${pt(bottom)} ${pt(inner)}Z`;
    const lid = `M${pt(inner)}Q${pt(top)} ${pt(outer)}`;
    return { s, ex, ey, ew, eh, inner, outer, top, bottom, d, lid, iris: [ex + s * 0.15, ey - 0.25], r: Math.min(eh * 1.18, ew * 0.5) };
  });
  const brows = eyes.map(({ s, ex, ey, ew }) => {
    const { thick, raise, angle } = f.brows;
    const th = 0.9 + 1.5 * thick;
    const lift = 1.6 * raise;
    const inner = [ex - s * ew * 0.95, ey - 5.3 - lift + angle * 1.3];
    const peak = [ex + s * ew * 0.15, ey - 6.7 - lift];
    const outer = [ex + s * ew * 1.28, ey - 5.2 - lift - angle * 0.3];
    const d = `M${pt([inner[0], inner[1] - th * 0.55])}Q${pt([peak[0], peak[1] - th * 0.6])} ${pt(outer)}Q${pt([peak[0], peak[1] + th * 0.55])} ${pt([inner[0], inner[1] + th * 0.5])}Z`;
    return { s, d };
  });
  const tipY = 55.6 + 1.6 * f.nose.length;
  const nw = 2.5 + 1.7 * f.nose.width;
  const nose = {
    tipY,
    nw,
    shade: `M50.7,47.6Q51.7,52 ${num(50 + nw)},${num(tipY + 0.1)}Q${num(50 + nw * 0.4)},${num(tipY + 1.4)} 50.2,${num(tipY + 0.9)}Q51,53.5 49.9,48.2Z`,
    side: `M49,48.6Q48.6,53 ${num(50 - nw * 0.85)},${num(tipY - 0.2)}`,
    nostrils: [-1, 1].map((s) => [50 + s * nw * 0.58, tipY + 0.75]),
    tip: [49.5, tipY - 0.9],
  };
  const { width, smile, full } = f.mouth;
  const my = chinY - 7.1;
  const mw = 4.4 + 2.2 * width;
  const cy = my - smile * 0.95;
  const mouth = {
    my,
    mw,
    line: `M${num(50 - mw)},${num(cy)}Q${num(50 - mw * 0.45)},${num(my + 0.5)} 50,${num(my + 0.35)}Q${num(50 + mw * 0.45)},${num(my + 0.5)} ${num(50 + mw)},${num(cy)}`,
    upper: `M${num(50 - mw)},${num(cy)}Q${num(50 - mw * 0.5)},${num(my - 1.6 - full * 0.4)} 49.1,${num(my - 1.15)}Q50,${num(my - 0.75)} 50.9,${num(my - 1.15)}Q${num(50 + mw * 0.5)},${num(my - 1.6 - full * 0.4)} ${num(50 + mw)},${num(cy)}Q50,${num(my + 0.7)} ${num(50 - mw)},${num(cy)}Z`,
    lower: `M${num(50 - mw * 0.82)},${num(cy + 0.35)}Q50,${num(my + 1.6 + 1.5 * full)} ${num(50 + mw * 0.82)},${num(cy + 0.35)}Q50,${num(my + 0.7)} ${num(50 - mw * 0.82)},${num(cy + 0.35)}Z`,
    under: `M${num(50 - mw * 0.45)},${num(my + 2.9 + 1.4 * full)}Q50,${num(my + 3.7 + 1.4 * full)} ${num(50 + mw * 0.45)},${num(my + 2.9 + 1.4 * full)}`,
  };
  const shadow = `M${num(50 + hw * 0.99)},34C${num(50 + hw * 0.97)},45 ${num(50 + hw * 0.88)},52 ${num(50 + jw + 1)},61C${num(50 + jw - 1)},64.5 ${num(50 + cw + 2.5)},67.5 ${num(50 + cw * 0.4)},${num(chinY + 0.5)}L${num(50 + cw * 0.1)},${num(chinY - 1.2)}C${num(50 + jw * 0.72)},63.5 ${num(50 + hw * 0.66)},56 ${num(50 + hw * 0.7)},45C${num(50 + hw * 0.72)},40 ${num(50 + hw * 0.82)},35.5 ${num(50 + hw * 0.99)},34Z`;
  const ears = [-1, 1].map((s) => ({ s, c: [50 + s * (hw - 0.3), 47.8] }));
  const neckW = 7.6 + 2.2 * f.width + 1.5 * f.jaw;
  const neck = `M${num(50 - neckW)},56L${num(50 - neckW - 0.6)},77Q50,81.5 ${num(50 + neckW + 0.6)},77L${num(50 + neckW)},56Z`;
  const suit = `M-2,102L-2,93C3,85.5 17,80.5 ${num(50 - neckW - 7)},78.2L${num(50 + neckW + 7)},78.2C83,80.5 97,85.5 102,93L102,102Z`;
  const collar = `M${num(50 - neckW - 6.5)},78.6C${num(50 - neckW - 3)},73.6 ${num(50 + neckW + 3)},73.6 ${num(50 + neckW + 6.5)},78.6C${num(50 + neckW + 3)},81.6 ${num(50 - neckW - 3)},81.6 ${num(50 - neckW - 6.5)},78.6Z`;
  return { hw, jw, cw, chinY, right, head: spline(outline), eyes, brows, nose, mouth, shadow, ears, neck, neckW, suit, collar };
}

// The face as SVG in three parts: `under` goes behind the head (long hair),
// `face` is the head with its features, beard and mark, and `over` is the
// hair on top. `id` prefixes its clip paths. Colors are portraitColors'.
export function faceSvg(look, g, id) {
  const skin = C.skin[look.skin] ?? C.skin.tan;
  const sh = mix(skin, C.shadow, 0.2);
  const deep = mix(skin, C.shadow, 0.42);
  const hl = mix(skin, C.light, 0.28);
  const lip = mix(mix(skin, C.shadow, 0.18), C.lip, 0.32);
  const lipD = mix(lip, C.shadow, 0.3);
  const hair = hairSvg(look, g, id);
  const covered = markedEye(look.mark);
  let face = `<path d="${g.neck}" fill="${sh}"/>`;
  face += `<path d="M${num(50 - g.neckW)},62Q50,${num(g.chinY + 6.5)} ${num(50 + g.neckW)},62L${num(50 + g.neckW)},58Q50,${num(g.chinY + 2)} ${num(50 - g.neckW)},58Z" fill="${deep}" opacity="0.55"/>`;
  for (const { s, c } of g.ears) {
    face += `<ellipse cx="${num(c[0])}" cy="${num(c[1])}" rx="3.3" ry="5.6" transform="rotate(${s * 8} ${num(c[0])} ${num(c[1])})" fill="${s > 0 ? sh : skin}"/>`;
    face += `<path d="M${num(c[0] + s * 0.4)},${num(c[1] - 3)}Q${num(c[0] + s * 2.2)},${num(c[1])} ${num(c[0] + s * 0.4)},${num(c[1] + 3)}" fill="none" stroke="${deep}" stroke-width="0.9" opacity="0.7"/>`;
  }
  face += `<path d="${g.head}" fill="${skin}"/><clipPath id="${id}h"><path d="${g.head}"/></clipPath><g clip-path="url(#${id}h)">`;
  face += `<path d="${g.shadow}" fill="${sh}"/>`;
  face += `<ellipse cx="${num(50 - g.hw * 0.42)}" cy="31" rx="${num(g.hw * 0.42)}" ry="6" fill="${hl}" opacity="0.45"/>`;
  for (const s of [-1, 1]) face += `<ellipse cx="${num(50 + s * g.hw * 0.55)}" cy="55.5" rx="3.6" ry="2.4" fill="${C.blush}" opacity="${s < 0 ? 0.13 : 0.1}"/>`;
  for (const e of g.eyes) face += `<ellipse cx="${num(e.ex)}" cy="${num(e.ey - 1.1)}" rx="${num(e.ew + 1.3)}" ry="${num(e.eh + 2)}" fill="${sh}" opacity="${e.s > 0 ? 0.65 : 0.38}"/>`;
  face += `</g>`;
  face += hair.beard;
  face += `<path d="${g.nose.shade}" fill="${sh}" opacity="0.9"/><path d="${g.nose.side}" fill="none" stroke="${sh}" stroke-width="0.7" opacity="0.8"/>`;
  for (const [x, y] of g.nose.nostrils) face += `<ellipse cx="${num(x)}" cy="${num(y)}" rx="0.95" ry="0.55" fill="${deep}"/>`;
  face += `<ellipse cx="${num(g.nose.tip[0])}" cy="${num(g.nose.tip[1])}" rx="1" ry="0.7" fill="${hl}" opacity="0.7"/>`;
  face += `<path d="${g.mouth.lower}" fill="${lip}"/><path d="${g.mouth.upper}" fill="${lipD}"/>`;
  face += `<path d="${g.mouth.line}" fill="none" stroke="${mix(lipD, C.shadow, 0.45)}" stroke-width="0.7" stroke-linecap="round"/>`;
  face += `<path d="${g.mouth.under}" fill="none" stroke="${sh}" stroke-width="0.8" opacity="0.7"/>`;
  face += hair.mustache;
  const eyeColor = C.eyes[look.eyes] ?? C.eyes.brown;
  g.eyes.forEach((e, i) => {
    if (covered === e.s) return;
    face += `<path d="${e.d}" fill="${C.white}"/><clipPath id="${id}e${i}"><path d="${e.d}"/></clipPath><g clip-path="url(#${id}e${i})">`;
    face += `<circle cx="${num(e.iris[0])}" cy="${num(e.iris[1])}" r="${num(e.r)}" fill="${eyeColor}"/>`;
    face += `<circle cx="${num(e.iris[0])}" cy="${num(e.iris[1])}" r="${num(e.r * 0.48)}" fill="${C.pupil}"/>`;
    face += `<path d="${e.lid}" fill="none" stroke="${deep}" stroke-width="1.6" opacity="0.35" transform="translate(0 0.9)"/></g>`;
    face += `<circle cx="${num(e.iris[0] - 0.6)}" cy="${num(e.iris[1] - 0.7)}" r="${num(Math.max(0.42, e.r * 0.26))}" fill="${C.glare}"/>`;
    face += `<path d="${e.lid}" fill="none" stroke="${C.feature}" stroke-width="0.95" stroke-linecap="round"/>`;
    face += `<path d="M${pt(e.outer)}l${e.s * 1.1},-0.9" stroke="${C.feature}" stroke-width="0.8" stroke-linecap="round"/>`;
  });
  const brow = look.hairColor === 'platinum' ? mix(C.hair.platinum, C.shadow, 0.3) : mix(C.hair[look.hairColor] ?? C.hair.black, C.shadow, 0.12);
  for (const b of g.brows) face += `<path d="${b.d}" fill="${brow}"/>`;
  face += markSvg(look.mark, g, skin, id);
  return { under: hair.under, face, over: hair.over };
}
