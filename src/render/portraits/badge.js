// A crew member's portrait (ROADMAP §4.5, M23c): the helmet badge, Evan's
// pick from five mockups. Their face (face.js) seen through the helmet
// their job's figure wears in a fight (data/jobs.json look, M23b) on an ID
// card in their trim: an EVA suit's ball of glass on its neck ring, or a
// skinsuit's close helmet with the face behind its visor. Pure: SVG text
// from plain data, the same each time.
//   portraitSvg(look, { suit, helmet, trim, crop, id })
//     look    a crew look (src/sim/looks.js)
//     suit    'eva' or 'skinsuit'; helmet one of that suit's (figures/looks.js)
//     trim    the crew member's color
//     crop    'bust' (the helmet and shoulders) or 'face' (closer, for
//             small sizes)
//     id      a prefix for the SVG's ids, for drawings put in one page
import { palette, portraitColors as C } from '../palette.js';
import { faceGeometry, faceSvg } from './face.js';
import { mix } from './paths.js';

const ZOOM = {
  bust: 'translate(50 50) scale(1.12) translate(-50 -48)',
  face: 'translate(50 50) scale(1.42) translate(-50 -47)',
};

export function portraitSvg(look, { suit = 'eva', helmet = 'bubble', trim = palette.crewA, crop = 'bust', id = 'p', shell = palette.crewSuit } = {}) {
  const g = faceGeometry(look);
  const parts = faceSvg(look, g, id);
  let defs = `<clipPath id="${id}c"><rect width="100" height="100" rx="8"/></clipPath>`;
  defs += `<radialGradient id="${id}v" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${palette.visor}" stop-opacity="0.28"/><stop offset="0.6" stop-color="${C.glassTint}" stop-opacity="0.12"/><stop offset="1" stop-color="${C.glassDeep}" stop-opacity="0.5"/></radialGradient>`;
  let body = `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${C.card}"/>`;
  body += `<path d="M0,0H30L0,30Z" fill="${trim}" opacity="0.9"/><path d="M0,100L100,58V100Z" fill="${mix(C.card, trim, 0.18)}"/>`;
  body += `<rect x="72" y="6" width="22" height="2" rx="1" fill="${C.cardLine}"/><rect x="78" y="10" width="16" height="2" rx="1" fill="${C.cardLine}"/>`;
  body += `<g transform="${ZOOM[crop] ?? ZOOM.bust}">`;
  body += `<path d="${g.suit}" fill="${shell}"/><path d="M58,86L102,96L102,102L66,102Z" fill="${mix(shell, C.shadow, 0.25)}" opacity="0.5"/>`;
  body += `<path d="M2,95L18,86.5M98,95L82,86.5" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/>`;
  body += suit === 'skinsuit' ? skinsuitHelmet(helmet, parts, shell, trim, id) : evaHelmet(helmet, g, parts, shell, trim, id);
  body += `</g></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`;
}

// A ball of glass on a neck ring, the head inside it: `bubble` plain with a
// band of trim, `lamps` with a lamp each side, `bar` with a band of light.
function evaHelmet(kind, g, parts, shell, trim, id) {
  const ring = 'M24,80C24,72 36,70 50,70C64,70 76,72 76,80C76,86 64,88 50,88C36,88 24,86 24,80Z';
  let s = `<path d="${ring}" fill="${mix(shell, C.shadow, 0.15)}" stroke="${C.edge}" stroke-width="0.9"/><path d="M26,78C30,74 70,74 74,78" fill="none" stroke="${trim}" stroke-width="1.6"/>`;
  s += `<clipPath id="${id}g"><ellipse cx="50" cy="48" rx="25.5" ry="25"/></clipPath><g clip-path="url(#${id}g)"><rect width="100" height="100" fill="${C.behind}"/>`;
  s += `<g transform="translate(50 51.5) scale(0.78) translate(-50 -46)">${parts.under}`;
  s += `<path d="${g.suit}" fill="${shell}"/><path d="M2,95L18,86.5M98,95L82,86.5" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/>`;
  s += `<path d="${g.collar}" fill="${mix(shell, C.shadow, 0.12)}"/><path d="${g.collar}" fill="none" stroke="${trim}" stroke-width="1.1" transform="translate(0 0.5)"/>`;
  s += `${parts.face}${parts.over}</g></g>`;
  s += `<ellipse cx="50" cy="48" rx="25.5" ry="25" fill="url(#${id}v)"/>`;
  if (kind === 'bar') s += `<path d="M26,38Q50,30.5 74,38L73.6,42.6Q50,35.6 26.4,42.6Z" fill="${palette.visor}" opacity="0.55"/>`;
  s += `<ellipse cx="50" cy="48" rx="26.7" ry="26.2" fill="none" stroke="${shell}" stroke-width="3"/><ellipse cx="50" cy="48.2" rx="26.7" ry="26.2" fill="none" stroke="${C.edge}" stroke-width="0.8"/>`;
  s += `<path d="M31.5,33A21.5,21 0 0 1 46.5,25" fill="none" stroke="${C.glare}" stroke-width="2" stroke-linecap="round" opacity="0.6"/><path d="M29.5,40A21.5,21 0 0 1 31,36" fill="none" stroke="${C.glare}" stroke-width="1.4" stroke-linecap="round" opacity="0.45"/>`;
  if (kind === 'lamps') {
    for (const side of [-1, 1]) {
      const x = 50 + side * 27.5;
      s += `<rect x="${x - 3.5}" y="31" width="7" height="9" rx="2" fill="${mix(shell, C.shadow, 0.2)}" stroke="${C.edge}" stroke-width="0.7"/><circle cx="${x}" cy="35.5" r="2.4" fill="${palette.lamp}"/><circle cx="${x}" cy="35.5" r="4.5" fill="${palette.lamp}" opacity="0.2"/>`;
    }
  } else {
    s += `<path d="M44,22L56,22" stroke="${trim}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return s;
}

// A close shell with the face behind its visor, the hairline showing at
// its top: `egg` plain, `fin` with a tall fin of trim, `crest` with a low
// one, `mirror` with a dark visor.
function skinsuitHelmet(kind, parts, shell, trim, id) {
  const visor = 'M27,36C27,30 34,27 50,27C66,27 73,30 73,36L73,52C73,63 64,71 50,71C36,71 27,63 27,52Z';
  let s = `<path d="M34,74L66,74L70,84L30,84Z" fill="${palette.crewUnder}"/>`;
  s += `<path d="M50,8C69,8 80,20 80,40C80,58 74,70 64,76L36,76C26,70 20,58 20,40C20,20 31,8 50,8Z" fill="${shell}" stroke="${C.edge}" stroke-width="1"/>`;
  s += `<path d="M50,8C69,8 80,20 80,40C80,52 77,62 71,70L62,74C70,62 72,50 72,40C72,22 62,12 50,10Z" fill="${mix(shell, C.shadow, 0.3)}" opacity="0.6"/>`;
  if (kind === 'fin') s += `<path d="M46,3L54,3L56,24L44,24Z" fill="${trim}" stroke="${C.edge}" stroke-width="0.8"/>`;
  if (kind === 'crest') s += `<path d="M44.5,9.5Q50,5.5 55.5,9.5L54.5,22L45.5,22Z" fill="${trim}" stroke="${C.edge}" stroke-width="0.8"/>`;
  s += `<clipPath id="${id}o"><path d="${visor}"/></clipPath><g clip-path="url(#${id}o)"><rect width="100" height="100" fill="${C.behind}"/>`;
  s += `<g transform="translate(50 49) scale(0.94) translate(-50 -48)">${parts.face}${parts.over}</g></g>`;
  s += `<path d="${visor}" fill="url(#${id}v)"/>`;
  if (kind === 'mirror') s += `<path d="${visor}" fill="${C.glassDeep}" opacity="0.42"/>`;
  s += `<path d="${visor}" fill="none" stroke="${trim}" stroke-width="1.3"/>`;
  s += `<path d="M31,35C33,31 40,30 47,30" fill="none" stroke="${C.glare}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`;
  return s;
}
