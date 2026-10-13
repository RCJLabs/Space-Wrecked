// Crew names short enough for a button or a list row (M23c): the fight's
// crew buttons, the squad card and the homes' crew panels. A first name
// each; where two share one, the first name and the initial of the rest
// ("Fen L."); where those match too, the whole names. Recruits can share a
// first name with someone aboard. The crew card, the log and the hints keep
// the whole names.
export function shortNames(names) {
  const first = names.map((name) => name.split(' ')[0]);
  const initial = names.map((name, i) => {
    const rest = name.slice(first[i].length).trim();
    return rest ? `${first[i]} ${rest[0]}.` : first[i];
  });
  const shared = (list, i) => list.some((value, j) => j !== i && value === list[i]);
  return names.map((name, i) => (!shared(first, i) ? first[i] : !shared(initial, i) ? initial[i] : name));
}
