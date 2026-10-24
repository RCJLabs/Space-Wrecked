// The camera following the action (M51): while a turn plays out, the board
// is panned, the zoom kept, until what moves or shoots is on it. Pure.
import { project } from './orbit.js';

// What a moment of a playback wants in view (render/playback.js
// cuesBetween): the tiles a walk goes from and to, a shot's shooter and
// target, as deck points at their middles; [] for anything else. view is
// the battle as it stands then (units by id).
export function followPoints(event, view) {
  const at = (u) => (u ? [[u.x + 0.5, u.y + 0.5]] : []);
  const unit = (id) => view.units.find((u) => u.id === id);
  if (event.type === 'move' && event.path?.length) {
    const [first, last] = [event.path[0], event.path.at(-1)];
    return [[first[0] + 0.5, first[1] + 0.5], [last[0] + 0.5, last[1] + 0.5]];
  }
  if (event.type === 'shot') return [...at(unit(event.unit)), ...at(unit(event.target))];
  return [];
}

// The pan, [dx, dy] in screen pixels (orbit.js panOrbit), that brings every
// point inside rect less inset on each side, by as little as it can; null
// when they are all there already. Points too far apart to fit are centred.
export function followShift(cam, rect, points, inset) {
  if (!points.length) return null;
  const screen = points.map(([x, y]) => project(cam, x, y, 0));
  const axis = (values, low, high) => {
    const [min, max] = [Math.min(...values), Math.max(...values)];
    if (max - min > high - low) return (low + high) / 2 - (min + max) / 2;
    if (min < low) return low - min;
    if (max > high) return high - max;
    return 0;
  };
  const dx = axis(screen.map((p) => p[0]), rect.x + inset, rect.x + rect.w - inset);
  const dy = axis(screen.map((p) => p[1]), rect.y + inset, rect.y + rect.h - inset);
  return Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 ? null : [dx, dy];
}

// The camera part of the way through a glide from `from` to `to` (t from 0
// to 1, eased in and out): its screen offset only, the zoom and turn kept.
export function glideAt(from, to, t) {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  return { ...to, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
