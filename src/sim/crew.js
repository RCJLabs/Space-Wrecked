// The crew aboard (ROADMAP §4.3, §4.5, M23): how many the ship has room
// for, and who goes when the ship is boarded or boards. The ship carries as
// many as its berths and its life support both cover, the flight
// checklist's two lines for the crew. A boarding takes a squad of up to
// squadSize (data/balance.json), picked by the player; the rest sit it out.
// Pure.
import { shipStats } from './constraints.js';

// How many the ship carries: its berths or its life support, the fewer.
export function crewRoom(ship, rules) {
  const stats = shipStats(ship, rules);
  return Math.min(stats.berths, stats.lifeSupport);
}

// The squad a boarding takes when the player picks none: the whole crew if
// it fits the squad, or else the healthiest, the most hit points first and
// the crew's order breaking ties. Their ids, in the crew's order.
export function defaultSquad(crew, rules) {
  const size = rules.balance.squadSize;
  if (crew.length <= size) return crew.map((member) => member.id);
  const ranked = crew.map((member, i) => ({ member, i })).sort((a, b) => b.member.hp - a.member.hp || a.i - b.i);
  const going = new Set(ranked.slice(0, size).map(({ member }) => member.id));
  return crew.filter((member) => going.has(member.id)).map((member) => member.id);
}

// Why ids can't be a squad, or null: 1 to squadSize of the crew aboard,
// none twice.
export function squadProblem(crew, ids, rules) {
  const size = rules.balance.squadSize;
  if (!Array.isArray(ids) || !ids.length) return 'Pick someone to go.';
  if (ids.length > size) return `A squad is ${size} at most.`;
  const aboard = new Set(crew.map((member) => member.id));
  if (new Set(ids).size !== ids.length || !ids.every((id) => aboard.has(id))) return 'Pick the squad from the crew aboard.';
  return null;
}

// The squad's members, in the crew's order: the order a fight lists them.
export function squadMembers(crew, ids) {
  const going = new Set(ids);
  return crew.filter((member) => going.has(member.id));
}
