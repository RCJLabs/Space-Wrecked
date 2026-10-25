// Neighbours at the colony (M54): two buildings with only the path between
// them, no more than one cell apart side or corner, are neighbours, and
// some pairings give (data/colony.json `neighbours`): a mine by a machine
// shop digs more, a farm by an air plant grows more, a storehouse by a farm
// or a mine holds more. A building is a kind: its build's id (a farm) or
// its part's base (a cargo hold of any maker). Each pairing counts once for
// a building, however many partners stand by it, and a dark partner gives
// nothing. Pure.
//
//   rule      { id, who: [kind], by: [kind], makes: { food | materials: n }
//             or storage: n }
//   gain      { rule (its id), by (the partner's uid), makes, storage }
import { buildOf, siteDef } from './colony.js';
import { baseOf } from './makers.js';
import { footprint } from './modules.js';

// A building's kind: its build's id, or its part's base id.
export function kindOf(type, rules) {
  if (buildOf(type, rules)) return type;
  const def = rules.modules.get(type);
  return def ? baseOf(def) : type;
}

// The cells a building covers: { x0, y0, x1, y1 }, x1 and y1 past its edge.
function rectOf(building, rules) {
  const [w, h] = footprint(siteDef(building.type, rules), building.rot ?? 0);
  return { x0: building.x, y0: building.y, x1: building.x + w, y1: building.y + h };
}

// Whether two buildings are neighbours: no more than one cell apart, side
// or corner.
export function nextTo(a, b, rules) {
  const [p, q] = [rectOf(a, rules), rectOf(b, rules)];
  return Math.max(p.x0 - q.x1, q.x0 - p.x1, p.y0 - q.y1, q.y0 - p.y1) <= 1;
}

// What a building gains from its neighbours: [gain], a pairing's first
// partner in the order built. others: the colony's other buildings ({ uid,
// type, x, y, rot }); lit(uid): whether one is powered.
export function gainsOf(building, others, rules, lit = () => true) {
  const kind = kindOf(building.type, rules);
  const gains = [];
  for (const rule of rules.colony?.neighbours ?? []) {
    if (!rule.who.includes(kind)) continue;
    const by = others.find((other) => other.uid !== building.uid && lit(other.uid) && rule.by.includes(kindOf(other.type, rules)) && nextTo(building, other, rules));
    if (by) gains.push({ rule: rule.id, by: by.uid, makes: rule.makes ?? null, storage: rule.storage ?? 0 });
  }
  return gains;
}

// What every building of the colony gains: Map uid → [gain]. lit(uid):
// whether one is powered (a dark partner gives nothing).
export function neighbourGains(buildings, rules, lit = () => true) {
  return new Map(buildings.map((building) => [building.uid, gainsOf(building, buildings, rules, lit)]));
}

// A ghost where it would stand (M54): what it would gain there, and what it
// would give the buildings round it: { gains: [gain], gives: [{ uid, gain
// }] }. ghost: { uid (the building being moved, or null), type, x, y, rot }.
export function ghostNeighbours(buildings, ghost, rules, lit = () => true) {
  const placed = { ...ghost, uid: ghost.uid ?? -1 };
  const others = buildings.filter((b) => b.uid !== ghost.uid);
  const gains = gainsOf(placed, others, rules, lit);
  const gives = [];
  for (const other of others) {
    const before = gainsOf(other, others, rules, lit);
    const after = gainsOf(other, [...others, placed], rules, (uid) => uid === placed.uid || lit(uid));
    for (const gain of after) if (gain.by === placed.uid && !before.some((was) => was.rule === gain.rule)) gives.push({ uid: other.uid, gain });
  }
  return { gains, gives };
}
