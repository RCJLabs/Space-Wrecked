// The flight checklist: can this ship fly? Six lines, each passing or
// failing, and every failing line names its fix, worked out from the parts
// in data/modules.json ("Add Engine (+12 thrust)"). A ship can be saved at
// any stage; it can launch only when every line passes. Pure.
import { describeModule, layoutProblems } from './builder.js';
import { hasTag } from './modules.js';

// The parts every ship needs, by tag, in the order the checklist names them.
export const REQUIRED_TAGS = ['bridge', 'reactor', 'engine', 'airlock'];

const SUMMED = ['thrust', 'mass', 'berths', 'lifeSupport', 'cargo', 'hp'];

// Totals over the ship's parts. Power is split into what parts make and what
// they use. Unknown part types count for nothing (the layout line reports
// them).
export function shipStats(ship, defs) {
  const totals = { parts: ship.modules.length, power: 0, powerMade: 0, powerUsed: 0 };
  for (const key of SUMMED) totals[key] = 0;
  for (const module of ship.modules) {
    const stats = defs.modules.get(module.type)?.stats;
    if (!stats) continue;
    if (stats.power >= 0) totals.powerMade += stats.power;
    else totals.powerUsed -= stats.power;
    for (const key of SUMMED) totals[key] += stats[key];
  }
  totals.power = totals.powerMade - totals.powerUsed;
  return totals;
}

// The checklist for a ship that has to carry `crew`. Each line is
// { id, ok, text, fix, add }. ok is true or false, or null for a line that
// can't be checked until another one passes. fix is set on every failing
// line; add is the module type to add when that is the fix, else null.
// liftOff, where set, is the thrust for each unit of mass it takes to lift
// off a planet (act 1's, data/campaign.json), when that asks more than the
// frame does.
export function flightChecklist(ship, defs, crew, { liftOff = null } = {}) {
  return [...partLines(ship, defs, crew, { liftOff }), layoutLine(ship, defs)];
}

// The lines that only count the parts: power, thrust, berths, life support
// and the parts every ship needs. Where the parts go doesn't change them,
// so they read only each module's type: a ship generator plans its parts
// with them before it lays any out (src/sim/gen/).
export function partLines(ship, defs, crew, { liftOff = null } = {}) {
  const stats = shipStats(ship, defs);
  return [
    powerLine(stats, defs),
    thrustLine(stats, defs, defs.frames.get(ship.frame), liftOff),
    supplyLine('berths', 'Berths', 'berths', stats.berths, crew, defs),
    supplyLine('lifeSupport', 'Life support', 'crew', stats.lifeSupport, crew, defs),
    partsLine(ship, defs),
  ];
}

export function canLaunch(lines) {
  return lines.every((line) => line.ok === true);
}

function powerLine(stats, defs) {
  const text = `Power ${signed(stats.power)} (${stats.powerMade} made, ${stats.powerUsed} used)`;
  if (stats.power >= 0) return pass('power', text);
  const source = bestSource(defs, 'power');
  if (!source) return failing('power', text, 'Remove parts that use power');
  return failing('power', text, addFix(source, Math.ceil(-stats.power / source.stats.power), source.stats.power, 'power'), source.id);
}

// Thrust has to be above zero and at least the frame's minimum share of the
// mass, or lifting off's where that is more. Each engine added brings its
// own mass, so the count of engines in the fix allows for that.
function thrustLine(stats, defs, frame, liftOff) {
  const frameMin = frame?.minThrustToMass ?? 0;
  const lifting = liftOff !== null && liftOff > frameMin;
  const min = lifting ? liftOff : frameMin;
  const { thrust, mass } = stats;
  const ratio = mass > 0 ? thrust / mass : 0;
  const text = thrust > 0 ? `Thrust ${thrust} for mass ${mass}: ${ratio.toFixed(2)}, needs ${min.toFixed(2)}${lifting ? ' to lift off' : ''}` : 'No thrust';
  if (thrust > 0 && thrust >= min * mass - 1e-9) return pass('thrust', text);
  const engine = bestSource(defs, 'thrust');
  if (!engine) return failing('thrust', text, 'No part gives thrust: remove mass');
  // An engine too heavy for its own thrust can't help; shedding mass can.
  const gain = engine.stats.thrust - min * engine.stats.mass;
  if (gain <= 0) return failing('thrust', text, `Remove ${Math.ceil(mass - thrust / min)} mass`);
  const count = Math.max(1, Math.ceil((min * mass - thrust) / gain - 1e-9));
  return failing('thrust', text, addFix(engine, count, engine.stats.thrust, 'thrust'), engine.id);
}

// Berths and life support each have to cover the crew.
function supplyLine(id, label, unit, have, crew, defs) {
  const text = `${label} ${have} of ${crew} crew`;
  if (have >= crew) return pass(id, text);
  const source = bestSource(defs, id);
  if (!source) return failing(id, text, `Carry fewer than ${crew} crew`);
  return failing(id, text, addFix(source, Math.ceil((crew - have) / source.stats[id]), source.stats[id], unit), source.id);
}

function partsLine(ship, defs) {
  const aboard = new Set();
  for (const module of ship.modules) {
    for (const tag of defs.modules.get(module.type)?.tags ?? []) aboard.add(tag);
  }
  const parts = REQUIRED_TAGS.map((tag) => partForTag(defs, tag));
  const missing = parts.filter((_, i) => !aboard.has(REQUIRED_TAGS[i]));
  if (!missing.length) return pass('parts', `${capitalize(list(parts.map((p) => lower(p.name))))} on board`);
  const names = missing.map((p) => p.name);
  return failing('parts', `Missing ${list(names.map(lower))}`, `Add ${list(names)}`, missing[0].id);
}

// Every part joined to the bridge, an airlock on the hull edge, and every
// exhaust and barrel facing space (the whole-layout rules from builder.js).
// A missing bridge or airlock is the parts line's to report, so it isn't
// repeated here.
function layoutLine(ship, defs) {
  const problems = layoutProblems(ship, defs);
  if (problems.some((p) => p.rule === 'bridge')) return { id: 'layout', ok: null, text: 'Joins are checked once there is a bridge', fix: null, add: null };
  const hasAirlock = ship.modules.some((m) => {
    const def = defs.modules.get(m.type);
    return def && hasTag(def, 'airlock');
  });
  const own = problems.filter((p) => p.rule !== 'airlock' || hasAirlock);
  if (!own.length) {
    return pass('layout', hasAirlock ? 'Every part joined to the bridge, airlock on the hull edge' : 'Every part joined to the bridge');
  }
  const [first] = own;
  const more = own.length > 1 ? ` (+${own.length - 1} more)` : '';
  if (first.rule === 'connected') {
    const n = first.uids.length;
    const names = first.uids.slice(0, 2).map((uid) => describeModule(ship, defs, uid));
    if (n > 2) names.push(`${n - 2} more`);
    return failing('layout', `${n} part${n === 1 ? '' : 's'} not joined to the bridge${more}`, `Join ${list(names)} to the bridge: rooms join where they share a wall`);
  }
  if (first.rule === 'faces') {
    const module = ship.modules.find((m) => m.uid === first.uids[0]);
    const def = defs.modules.get(module.type);
    return failing('layout', `${def.name} ${def.facesSpace.what} blocked${more}`, `Move ${describeModule(ship, defs, module.uid)} so its ${def.facesSpace.what} faces space`);
  }
  if (first.rule === 'airlock') {
    return failing('layout', `No airlock on the hull edge${more}`, 'Move an airlock to the edge of the hull, with a side open to space');
  }
  // Only a damaged or hand-edited save gets these.
  const frame = defs.frames.get(ship.frame);
  const fix =
    first.rule === 'cap' ? `Remove ${ship.modules.length - frame.maxModules} parts`
    : first.rule === 'frame' ? 'Start a new ship'
    : first.rule === 'type' ? 'Remove it'
    : first.rule === 'bounds' ? 'Move it inside the build area, or remove it'
    : 'Move or remove it';
  return failing('layout', `${first.message.replace(/\.$/, '')}${more}`, fix);
}

// The part a fix asks for to give a stat: the first in data/modules.json
// that gives it, or null. The base parts come first there, so the fixes,
// act 1's goal (campaign.js partsNeeded) and the parts a generated ship is
// topped up with (gen/ship.js) name the part the shop stocks most of, not
// a variant (M23e).
function bestSource(defs, stat) {
  for (const def of defs.modules.values()) if (def.stats[stat] > 0) return def;
  return null;
}

// "Add Reactor (+8 power)", or "Add 2 × Engine (+12 thrust each)".
function addFix(def, count, amount, unit) {
  return count === 1 ? `Add ${def.name} (+${amount} ${unit})` : `Add ${count} × ${def.name} (+${amount} ${unit} each)`;
}

// The first part with a tag, as { id, name }; id is null if there is none.
function partForTag(defs, tag) {
  for (const def of defs.modules.values()) if (hasTag(def, tag)) return { id: def.id, name: def.name };
  return { id: null, name: capitalize(tag) };
}

function pass(id, text) {
  return { id, ok: true, text, fix: null, add: null };
}

function failing(id, text, fix, add = null) {
  return { id, ok: false, text, fix, add };
}

function list(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

function lower(text) {
  return text.toLowerCase();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
