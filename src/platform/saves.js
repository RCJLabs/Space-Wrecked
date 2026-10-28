// The game's campaign slots (M63), kept in this browser's storage. The
// rules are src/core/slots.js and slotStore.js; this only hands them
// storage.js and the save's text format.
import { makeSave, parseSave } from '../core/save.js';
import { createSaves } from '../core/slotStore.js';
import { readText, writeText } from './storage.js';

export const saves = createSaves(
  { read: readText, write: writeText },
  { parse: parseSave, serialize: (data) => JSON.stringify(makeSave(data)) },
);
