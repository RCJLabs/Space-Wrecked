// Crew portraits on the screens (M23c): a crew member's helmet badge
// (render/portraits/badge.js) as an <img> whose source is its SVG as a
// data URL, each drawing made once and kept. An image keeps the SVG's ids
// to itself, so any number of portraits can share a page.
import { portraitSvg } from '../render/portraits/badge.js';
import { icons } from './icons.js';

// Drawings kept, oldest first; stepping through looks at captain creation
// makes many.
const kept = new Map();
const KEEP = 120;

// The data URL of `look` in a job's helmet (its look in data/jobs.json:
// { suit, helmet }) in `trim`, at a crop ('bust' or 'face').
export function portraitUrl(look, jobLook, trim, crop = 'bust') {
  const key = JSON.stringify([look, jobLook?.suit, jobLook?.helmet, trim, crop]);
  let url = kept.get(key);
  if (url) {
    kept.delete(key);
  } else {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(look, { suit: jobLook?.suit, helmet: jobLook?.helmet, trim, crop }))}`;
    if (kept.size >= KEEP) kept.delete(kept.keys().next().value);
  }
  kept.set(key, url);
  return url;
}

// An <img> of a portrait. It says nothing to a screen reader: the name is
// beside it.
export function portraitImg(className, url) {
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.src = url;
  return img;
}

// A crew member's rank (M32b) as chevrons, one for each: a <span
// class="rank-mark"> that says its rank to a screen reader, or null at rank
// 0. It sits over a portrait's corner (withRank) or beside a name.
export function rankMark(rank) {
  const icon = rank > 0 ? icons[`rank${rank}`] : null;
  if (!icon) return null;
  const mark = document.createElement('span');
  mark.className = 'rank-mark';
  mark.innerHTML = icon;
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', `rank ${rank}`);
  return mark;
}

// A portrait with its rank's chevrons over the corner, so a narrow card
// shows the rank whatever its words leave out: the <img> alone at rank 0.
export function withRank(img, rank) {
  const mark = rankMark(rank);
  if (!mark) return img;
  const pic = document.createElement('span');
  pic.className = 'ranked-face';
  pic.append(img, mark);
  return pic;
}
