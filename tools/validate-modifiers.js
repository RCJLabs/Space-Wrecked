// The run modifiers (data/modifiers.json, M64, src/sim/modifiers.js), for
// validate-data.js: each one's id, name, kind (a burden or a boon), what it
// says, its start (only the changes newCampaign's start can take, each in
// range) and, for a boon, what opens it. A burden is open from the first
// game, so it has no unlock; a boon always has one. There are at least two
// burdens, so a week's run can draw one and leave another.
import { MAX_MODIFIERS } from '../src/sim/modifiers.js';
import { isIntIn, isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const KEYS = ['id', 'name', 'kind', 'text', 'start', 'unlock'];
const KINDS = ['burden', 'boon'];
const START = { credits: [-500, 500], heat: [0, 60], standing: [-5, 5], crew: [-1, 0], parts: [0, 2] };
const MAX_NAME = 20;
const MAX_TEXT = 90;

export function checkModifiers(file, fail) {
  const modifiers = listOf(file, 'modifiers', 'modifiers.json', fail);
  uniqueIds(modifiers, 'modifiers.json', fail);
  if (modifiers.length > MAX_MODIFIERS) fail('modifiers.json', `at most ${MAX_MODIFIERS} modifiers (a campaign keeps them all)`);
  if (modifiers.filter((def) => def.kind === 'burden').length < 2) fail('modifiers.json', "at least two burdens, for the week's run to draw from");
  modifiers.forEach((def, i) => {
    const where = `modifiers.json ${def.id ?? `#${i}`}`;
    knownKeys(def, KEYS, where, fail);
    if (!isText(def.name) || def.name.length > MAX_NAME) fail(where, `name must be up to ${MAX_NAME} letters`);
    if (!isText(def.text) || def.text.length > MAX_TEXT) fail(where, `text must say what it does in up to ${MAX_TEXT} letters`);
    if (!KINDS.includes(def.kind)) fail(where, `kind must be one of ${KINDS.join(', ')}`);
    if (!isObject(def.start) || !Object.keys(def.start).length) fail(where, 'start must change something');
    else {
      for (const [key, value] of Object.entries(def.start)) {
        const range = START[key];
        if (!range) fail(where, `start can't change "${key}" (only ${Object.keys(START).join(', ')})`);
        else if (!isIntIn(value, range[0], range[1]) || value === 0) fail(where, `start.${key} must be a whole number from ${range[0]} to ${range[1]}, not 0`);
      }
    }
    if (def.kind === 'burden' && def.unlock !== undefined) fail(where, 'a burden is open from the first game: no unlock');
    if (def.kind === 'boon') {
      const { unlock } = def;
      const ok = isObject(unlock) && ((Object.keys(unlock).length === 1 && isIntIn(unlock.act, 2, 3)) || (Object.keys(unlock).length === 1 && unlock.won === true));
      if (!ok) fail(where, 'a boon must have an unlock: { act: 2 or 3 } or { won: true }');
    }
  });
}
