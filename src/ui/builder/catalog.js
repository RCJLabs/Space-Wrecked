// What the Parts tab shows (M23e): the parts of the category picked (the
// categories are data/modules.json's) or all of them, of the size picked
// and by the maker picked (M23g), and in construction mode only those on
// hand. Pure: palette.js draws what this says.
import { baseOf } from '../../sim/makers.js';

// "All" on the category picker, and any maker.
export const ALL = 'all';
// The size filter's steps, one a tap, by the cells a part covers.
export const SIZES = [
  { id: 'any', name: 'Any', fits: () => true },
  { id: 'small', name: 'Small', fits: (cells) => cells <= 2 },
  { id: 'medium', name: 'Medium', fits: (cells) => cells > 2 && cells <= 6 },
  { id: 'large', name: 'Large', fits: (cells) => cells > 6 },
];

// Every part in the order the tab shows them: by category, in the order
// the categories come, and in each in data order, the base part first, each
// with its makers' versions beside it (M23g), in the makers' order.
export function catalogOrder(defs) {
  const rank = new Map(defs.categories.map((category, i) => [category.id, i]));
  const at = new Map([...defs.modules.keys()].map((id, i) => [id, i]));
  const makers = new Map([...(defs.manufacturers?.keys() ?? [])].map((id, i) => [id, i]));
  const key = (def) => [rank.get(def.category) ?? Infinity, at.get(baseOf(def)) ?? Infinity, def.base === undefined ? -1 : (makers.get(def.manufacturer) ?? Infinity), at.get(def.id)];
  const order = (a, b) => a.key.reduce((by, value, i) => by || value - b.key[i], 0);
  return [...defs.modules.values()].map((def) => ({ id: def.id, key: key(def) })).sort(order).map(({ id }) => id);
}

// What shows for a pick: { shown: [type], counts, makers, empty }. counts
// has, for ALL and each category, how many parts it would show at this
// size and stock by the maker picked; makers, for ALL and each maker, how
// many it would show in the category picked; empty is what to say when
// nothing shows, else null. onHand(type) is how many of a part there are
// to fit, or null for endless parts.
export function catalogView(defs, { category = ALL, size = 'any', onHand = null, maker = ALL } = {}) {
  const fits = SIZES.find((step) => step.id === size)?.fits ?? SIZES[0].fits;
  const available = catalogOrder(defs).map((type) => defs.modules.get(type)).filter((def) => fits(def.size[0] * def.size[1]) && (!onHand || onHand(def.id) > 0));
  const byMaker = available.filter((def) => maker === ALL || def.manufacturer === maker);
  const counts = { [ALL]: byMaker.length };
  for (const { id } of defs.categories) counts[id] = byMaker.filter((def) => def.category === id).length;
  const inCategory = available.filter((def) => category === ALL || def.category === category);
  const makers = { [ALL]: inCategory.length };
  for (const id of defs.manufacturers?.keys() ?? []) makers[id] = inCategory.filter((def) => def.manufacturer === id).length;
  const shown = byMaker.filter((def) => category === ALL || def.category === category).map((def) => def.id);
  let empty = null;
  if (!shown.length) empty = !onHand ? 'No parts that size here.' : category === ALL && size === 'any' ? 'Nothing on hand to fit.' : 'Nothing on hand here.';
  return { shown, counts, makers, empty };
}

// The size filter's step after this one, round again after the last.
export function nextSize(size) {
  const i = SIZES.findIndex((step) => step.id === size);
  return SIZES[(i + 1) % SIZES.length].id;
}
