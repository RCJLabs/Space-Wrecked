// What the Parts tab shows (M23e): the parts of the category picked (the
// categories are data/modules.json's) or all of them, of the size picked,
// and in construction mode only those on hand. Pure: palette.js draws what
// this says.

// "All" on the category picker.
export const ALL = 'all';
// The size filter's steps, one a tap, by the cells a part covers.
export const SIZES = [
  { id: 'any', name: 'Any', fits: () => true },
  { id: 'small', name: 'Small', fits: (cells) => cells <= 2 },
  { id: 'medium', name: 'Medium', fits: (cells) => cells > 2 && cells <= 6 },
  { id: 'large', name: 'Large', fits: (cells) => cells > 6 },
];

// Every part in the order the tab shows them: by category, in the order
// the categories come, and in each in data order, the base part first.
export function catalogOrder(defs) {
  const rank = new Map(defs.categories.map((category, i) => [category.id, i]));
  return [...defs.modules.values()].map((def, i) => ({ def, i })).sort((a, b) => (rank.get(a.def.category) ?? Infinity) - (rank.get(b.def.category) ?? Infinity) || a.i - b.i).map(({ def }) => def.id);
}

// What shows for a pick: { shown: [type], counts, empty }. counts has, for
// ALL and each category, how many parts it would show at this size and
// stock; empty is what to say when nothing shows, else null. onHand(type)
// is how many of a part there are to fit, or null for endless parts.
export function catalogView(defs, { category = ALL, size = 'any', onHand = null } = {}) {
  const fits = SIZES.find((step) => step.id === size)?.fits ?? SIZES[0].fits;
  const available = catalogOrder(defs).map((type) => defs.modules.get(type)).filter((def) => fits(def.size[0] * def.size[1]) && (!onHand || onHand(def.id) > 0));
  const counts = { [ALL]: available.length };
  for (const { id } of defs.categories) counts[id] = available.filter((def) => def.category === id).length;
  const shown = available.filter((def) => category === ALL || def.category === category).map((def) => def.id);
  let empty = null;
  if (!shown.length) empty = !onHand ? 'No parts that size here.' : category === ALL && size === 'any' ? 'Nothing on hand to fit.' : 'Nothing on hand here.';
  return { shown, counts, empty };
}

// The size filter's step after this one, round again after the last.
export function nextSize(size) {
  const i = SIZES.findIndex((step) => step.id === size);
  return SIZES[(i + 1) % SIZES.length].id;
}
