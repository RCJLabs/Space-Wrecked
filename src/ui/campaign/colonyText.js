// Text for the colony (src/sim/colony.js, M26): what act 3's home shows.
// rules are the content tables (src/sim/defs.js).
import { actOf } from '../../sim/campaign.js';
import { buildingOf, colonyStats, shipParts } from '../../sim/colony.js';
import { actTitle, crewText } from './hubText.js';
import { runRecord } from './launchText.js';
import { worldSaid } from './sectorText.js';

// What the colony screen shows:
//   act, home   "Act 3 · The colony", "Greenhaven · Ice world"
//   needs       [{ label, value, ok }]: power, then beds and air against
//               the crew and who sleeps aboard; stores and defenses once
//               the colony has any. ok is false for a need short.
//   power       how the power is made: "1 from its plants, 3 the ship's"
//   buildings   [{ uid, name, gives, powered }] in the order given: what
//               each gives, or that it is dark and what it needs
//   crew        crewText's rows (hubText.js), each with aboard: true for
//               whoever sleeps aboard the landed ship
//   parts       [{ uid, uids, type, name, count, ok, building, gives, why }]:
//               the ship's parts, those that can be given first, a row a
//               kind with its count, each with the building it would be and
//               what that gives (uid is the one a tap gives); then the rest,
//               a row a reason, naming each kind it holds back (uids: every
//               part in the row).
//   world       { title, lines }: the world's numbers and lanes, and a
//               line if it was settled without a survey
//   record      { title, lines: [[label, value]] }: how the run went (M25)
//   ahead       the act's words for what is still to come
//   text        the colony's words (data/colony.json)
export function colonyText(campaign, rules) {
  const stats = colonyStats(campaign, rules);
  const { world } = campaign.colony;
  const kind = rules.worlds?.kinds.get(world.kind)?.name ?? world.kind;
  const crew = crewText(campaign, rules);
  const aboard = new Set(stats.aboard);
  const n = crew.length;
  const needs = [
    { label: 'Power', value: `${stats.power.used} used of ${stats.power.made}`, ok: stats.buildings.every((b) => b.powered) },
    { label: 'Beds', value: `${stats.beds} for ${n}`, ok: stats.beds >= n },
    { label: 'Air', value: `${stats.air} for ${n}`, ok: stats.air >= n },
    { label: 'Aboard', value: aboard.size ? `${aboard.size} sleep${aboard.size === 1 ? 's' : ''} on the ship` : 'Nobody', ok: aboard.size === 0 },
  ];
  if (stats.storage) needs.push({ label: 'Stores', value: `${stats.storage}, empty for now`, ok: true });
  const guard = defenseText(stats.defense);
  if (guard) needs.push({ label: 'Defense', value: guard, ok: true });
  if (stats.infirmary) needs.push({ label: 'Infirmary', value: `Heals ${stats.infirmary}`, ok: true });
  return {
    act: actTitle(campaign.act, rules),
    home: `${world.name} · ${kind}`,
    needs,
    power: `${stats.power.plants} from power plants, ${stats.power.ship} spare from the landed ship`,
    buildings: stats.buildings.map((b) => ({
      uid: b.uid,
      name: b.name,
      gives: b.powered ? givesText(b.gives) : `Dark: needs ${b.need} power`,
      powered: b.powered,
    })),
    crew: crew.map((row, i) => ({ ...row, aboard: aboard.has(campaign.crew[i].id) })),
    parts: partRows(campaign, rules),
    world: { title: `${world.name} · ${kind}`, lines: [...worldSaid(world, rules, true), ...(world.surveyed ? [] : ['Settled without a survey: these are what the landing found.'])] },
    record: { title: actTitle(campaign.act - 1, rules), lines: runRecord(campaign, rules) },
    ahead: actOf(campaign, rules)?.ahead ?? '',
    text: rules.colony?.text ?? '',
  };
}

// The ship's parts, as rows: see colonyText. Those that can be given are a
// row a kind, with their count; those that can't, a row a reason, naming
// every kind it holds back.
function partRows(campaign, rules) {
  const rows = new Map();
  for (const part of shipParts(campaign, rules)) {
    const key = part.ok ? `give|${part.type}` : `keep|${part.error}`;
    const row = rows.get(key) ?? { uid: part.uid, uids: [], kinds: new Map(), ok: part.ok, building: part.ok ? part.building.name : null, gives: part.ok ? givesText(part.gives) : null, why: part.ok ? null : part.error };
    row.uids.push(part.uid);
    const name = rules.modules.get(part.type)?.name ?? part.type;
    row.kinds.set(name, (row.kinds.get(name) ?? 0) + 1);
    rows.set(key, row);
  }
  const all = [...rows.values()].map(({ kinds, ...row }) => ({
    ...row,
    type: row.ok ? campaign.ship.modules.find((m) => m.uid === row.uid).type : null,
    name: [...kinds].map(([name, n]) => (n > 1 && !row.ok ? `${name} ×${n}` : name)).join(', '),
    count: row.ok ? row.uids.length : null,
  }));
  return [...all.filter((row) => row.ok), ...all.filter((row) => !row.ok)];
}

// What a building gives, from colony.js givesOf: "Beds 4 · power −1".
export function givesText(gives) {
  const said = [];
  if (gives.power > 0) said.push(`power +${gives.power}`);
  if (gives.beds) said.push(`beds ${gives.beds}`);
  if (gives.air) said.push(`air ${gives.air}`);
  if (gives.storage) said.push(`stores ${gives.storage}`);
  if (gives.heal) said.push(`heals ${gives.heal}`);
  if (gives.damage) said.push(`guns ${gives.damage}`);
  if (gives.shield) said.push(`shield ${gives.shield}`);
  if (gives.intercept) said.push(`flak ${gives.intercept}`);
  if (gives.armory) said.push('arms the crew');
  if (gives.power < 0) said.push(`power −${-gives.power}`);
  const text = said.join(' · ') || 'nothing yet';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Guns 15 · shield 10 · 1 armory", or '' with no defenses.
function defenseText({ damage, shield, intercept, armories }) {
  const said = [];
  if (damage) said.push(`guns ${damage}`);
  if (shield) said.push(`shield ${shield}`);
  if (intercept) said.push(`flak ${intercept}`);
  if (armories) said.push(`${armories} arm${armories === 1 ? 'ory' : 'ories'}`);
  const text = said.join(' · ');
  return text && `${text.charAt(0).toUpperCase()}${text.slice(1)}, for raids to come`;
}

// What a tap on a part's row says: for one that can be given, what giving
// it does, and the second tap's ask; for the rest, why not.
//   { ok, ask, text, tone }
export function giveText(row) {
  if (!row.ok) return { ok: false, ask: null, text: `${row.name}: can't be given. ${row.why}`, tone: 'warn' };
  return { ok: true, ask: 'Give?', text: `${row.name} becomes the colony's ${row.building}: ${lowerFirst(row.gives)}. It comes off the ship. Tap again to give it.`, tone: 'info' };
}

// What giving a part came to (colony.js donate's result).
export function givenText(result, rules) {
  const name = buildingOf(result.plan.type, rules)?.name ?? result.plan.type;
  const healed = result.healed ? ` It patched the crew up: ${result.healed} hit points.` : '';
  return { text: `The ${lowerFirst(name)} stands at the colony: ${lowerFirst(givesText(result.plan.gives))}.${healed}`, tone: 'good' };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
