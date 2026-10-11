// Blueprint codes: a ship as a short line of text that players copy and
// paste between devices. A code is
//   wtb.<version>.<payload>.<checksum>
// The payload is base64url bytes: the frame's id, the part types the ship
// uses, then each part in build order as three bytes: its type, x, and
// y × 4 + its quarter turns. Decoding rebuilds the ship through the
// builder's placement rules, so a code can only make a ship the builder
// could have made. Whitespace is ignored, so codes survive chat apps.
// Decoding never throws: every way a code can be wrong has a message.
//
// Versions:
//   1  M5, on the old grid
//   2  M5b's fine grid, four cells to each old one. A version 1 code still
//      opens: its parts move to the fine grid (regrid.js).
import { config } from '../config.js';
import { buildShip } from '../sim/builder.js';
import { regridPlacement } from '../sim/regrid.js';
import { base64UrlToBytes, bytesToBase64Url, checksum } from './codec.js';

export const BLUEPRINT_VERSION = 2;
const PREFIX = `${config.appId}b`;
const SAVE_PREFIX = `${config.appId}.`;

// The code for a ship: its frame and its parts in build order.
export function encodeBlueprint(ship) {
  return encodePlacements(ship.frame, ship.modules);
}

// The code for a frame and placements [{ type, x, y, rot }], unchecked.
// Tests use it to make codes the game would never make.
export function encodePlacements(frameId, placements, version = BLUEPRINT_VERSION) {
  const types = [...new Set(placements.map((p) => p.type))];
  const bytes = [];
  const text = (value) => {
    const chars = [...value].map((c) => c.charCodeAt(0));
    if (chars.length > 255 || chars.some((c) => c > 127)) throw new RangeError(`blueprint: can't encode the id "${value}"`);
    bytes.push(chars.length, ...chars);
  };
  text(frameId);
  if (types.length > 255 || placements.length > 255) throw new RangeError('blueprint: too many parts');
  bytes.push(types.length);
  types.forEach(text);
  bytes.push(placements.length);
  for (const { type, x, y, rot } of placements) {
    if (!(x >= 0 && x <= 255 && y >= 0 && y <= 63 && rot >= 0 && rot <= 3)) {
      throw new RangeError(`blueprint: can't encode a part at (${x}, ${y}) turned ${rot}`);
    }
    bytes.push(types.indexOf(type), x, y * 4 + rot);
  }
  const body = `${PREFIX}.${version}.${bytesToBase64Url(Uint8Array.from(bytes))}`;
  return `${body}.${checksum(body)}`;
}

// Reads a code against the content in defs. Returns { ok: true, ship } with
// the ship rebuilt in the code's build order (uids from 1), or
// { ok: false, error } with a message for the player.
export function decodeBlueprint(text, defs) {
  const code = String(text ?? '').replace(/\s+/g, '');
  if (!code) return fail('Paste a blueprint code first.');
  if (code.startsWith(SAVE_PREFIX)) return fail("That's a save code, not a ship blueprint.");
  const parts = code.split('.');
  if (parts[0] !== PREFIX) return fail(`That isn't a ship blueprint. Blueprint codes start with "${PREFIX}.".`);
  if (parts.length !== 4) return fail('The code is incomplete or has extra text. Copy the whole code and try again.');
  const [, versionText, payload, sum] = parts;
  if (!/^\d+$/.test(versionText)) return fail('The code is damaged: its version number is unreadable.');
  if (checksum(`${PREFIX}.${versionText}.${payload}`) !== sum.toLowerCase()) {
    return fail("The code is damaged: its checksum doesn't match. Copy the whole code again.");
  }
  const version = Number(versionText);
  if (version > BLUEPRINT_VERSION) return fail('This blueprint comes from a newer version of the game. Update the game, then try again.');
  if (version !== BLUEPRINT_VERSION && version !== 1) return fail(`Blueprints of version ${version} can't be read.`);

  const read = unpack(payload);
  if (!read) return fail("The code is damaged and can't be read.");
  if (!defs.frames.has(read.frame)) return fail(`This blueprint is for a hull this version of the game doesn't have ("${read.frame}").`);
  const unknown = [...new Set(read.placements.map((p) => p.type))].filter((type) => !defs.modules.has(type));
  if (unknown.length) return fail(`This blueprint uses parts this version of the game doesn't have: ${unknown.join(', ')}.`);
  const placements = version === 1 ? read.placements.map(regridPlacement) : read.placements;
  const { ship, rejected } = buildShip(defs, read.frame, placements);
  if (rejected.length) return fail(`This blueprint doesn't fit together: ${rejected[0].message}`);
  return { ok: true, ship };
}

// The payload's bytes as { frame, placements }, or null if they don't
// follow the layout exactly.
function unpack(payload) {
  let bytes;
  try {
    bytes = base64UrlToBytes(payload);
  } catch {
    return null;
  }
  let at = 0;
  const byte = () => (at < bytes.length ? bytes[at++] : null);
  const text = () => {
    const length = byte();
    if (length === null || at + length > bytes.length) return null;
    const value = String.fromCharCode(...bytes.subarray(at, at + length));
    at += length;
    return /^[a-z][a-z0-9-]*$/.test(value) ? value : null;
  };
  const frame = text();
  const typeCount = byte();
  if (frame === null || typeCount === null) return null;
  const types = [];
  for (let i = 0; i < typeCount; i++) {
    const type = text();
    if (type === null) return null;
    types.push(type);
  }
  const count = byte();
  if (count === null || at + count * 3 !== bytes.length) return null;
  const placements = [];
  for (let i = 0; i < count; i++) {
    const [t, x, packed] = [byte(), byte(), byte()];
    if (t >= types.length) return null;
    placements.push({ type: types[t], x, y: packed >> 2, rot: packed & 3 });
  }
  return { frame, placements };
}

function fail(error) {
  return { ok: false, error };
}
