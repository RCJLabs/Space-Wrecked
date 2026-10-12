// What a saved run (travel.js) must look like, for the save's checks
// (campaign.js campaignProblems). Shape only: whether its node kinds are
// the content's is the rules' business. Pure; imports nothing.

// A sector's nodes, and the names of places in it: sector names and node
// names both fit this (validate-sectors.js holds the data to it).
export const MAX_NODES = 40;
export const MAX_PLACE_NAME = 24;
const MAX_LINKS = 120;
const MAX_PAST = 20;
// More than any outcome moves: a guard on what a save can hold.
const MAX_CHANGE = 9999;
const ID = /^[a-z][a-z0-9-]*$/;

// Why a run is unreadable, as words to follow "The campaign's run ", or
// null if it reads.
export function runProblem(run) {
  if (!isRecord(run)) return 'is unreadable';
  const { sector, at, seen, past, done, scans, result } = run;
  if (!isRecord(sector) || !isInt(sector.index, 1, 99) || !isName(sector.name)) return 'has an unreadable sector';
  const { nodes, links } = sector;
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > MAX_NODES) return 'has an unreadable map';
  const readable = nodes.every(
    (node, i) =>
      isRecord(node) &&
      node.id === i &&
      isInt(node.col, 0, 99) &&
      isInt(node.row, 0, 9) &&
      isShare(node.x) &&
      isShare(node.y) &&
      isId(node.type) &&
      isName(node.name) &&
      (node.event === undefined || isId(node.event)),
  );
  if (!readable) return 'has an unreadable map';
  const isNode = (id) => isInt(id, 0, nodes.length - 1);
  if (!Array.isArray(links) || links.length > MAX_LINKS || !links.every((link) => Array.isArray(link) && link.length === 2 && isNode(link[0]) && isNode(link[1]) && link[0] < link[1])) {
    return 'has unreadable links';
  }
  if (new Set(links.map((link) => link.join('-'))).size !== links.length) return 'has a link twice';
  if (!isNode(sector.start) || !isNode(sector.exit) || sector.start === sector.exit) return 'has no way in or no jump point';
  if (!isNode(at)) return 'is nowhere on its map';
  if (!Array.isArray(seen) || !seen.every(isNode) || new Set(seen).size !== seen.length || !seen.includes(at)) return 'has an unreadable route';
  if (!Array.isArray(past) || past.length > MAX_PAST || !past.every(isName)) return 'has unreadable past sectors';
  const isNodeList = (list) => Array.isArray(list) && list.every(isNode) && new Set(list).size === list.length;
  if (!isNodeList(done) || !done.every((id) => seen.includes(id) && nodes[id].event)) return 'has unreadable events done';
  if (!isNodeList(scans) || !scans.every((id) => seen.includes(id))) return 'has unreadable scans';
  if (result !== null && !isResult(result, nodes, done)) return 'has an unreadable last event';
  return null;
}

// The last event settled (events.js chooseEvent): at a node whose event is
// done, with what it came to.
function isResult(result, nodes, done) {
  if (!isRecord(result) || !done.includes(result.node) || result.event !== nodes[result.node].event || !isId(result.choice)) return false;
  if (!isInt(result.outcome, 0, 9) || !(result.roll === null || isInt(result.roll, 0, 99))) return false;
  const { changes } = result;
  return (
    isRecord(changes) &&
    ['credits', 'supplies', 'heat'].every((key) => isInt(changes[key], -MAX_CHANGE, MAX_CHANGE)) &&
    Array.isArray(changes.wounds) &&
    changes.wounds.every((wound) => isRecord(wound) && isInt(wound.id, 0, MAX_CHANGE) && isInt(wound.hp, 0, 99)) &&
    Array.isArray(changes.parts) &&
    changes.parts.every(isId) &&
    Array.isArray(changes.sold) &&
    changes.sold.every((sale) => isRecord(sale) && isId(sale.part) && isInt(sale.credits, 0, MAX_CHANGE))
  );
}

function isId(value) {
  return typeof value === 'string' && ID.test(value);
}

function isName(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_PLACE_NAME;
}

function isShare(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
