// The campaign's flags (campaign.js): what has happened, counted. Pure.

// Flags with counts added (those above 0).
export function tally(flags, counts) {
  const next = { ...flags };
  for (const [name, count] of Object.entries(counts)) if (count > 0) next[name] = (next[name] ?? 0) + count;
  return next;
}
