// Blueprint codes: a ship as a short line of text that players copy and
// paste between devices. A code is
//   wtb.<version>.<payload>.<checksum>
// The payload is base64url bytes: the frame's id, the hull's style, paint
// and trim, its pattern, second color and glow, the part types the ship uses, then each part in build order as
// three bytes: its type, x, and y × 4 + its quarter turns; then the same
// for its styling pieces, with y × 8 + their turn. Decoding rebuilds the ship
// through the builder's placement rules, so a code can only make a ship the
// builder could have made. Whitespace is ignored, so codes survive chat
// apps. Decoding never throws: every way a code can be wrong has a message.
//
// Versions:
//   1  M5, on the old grid
//   2  M5b's fine grid, four cells to each old one. A version 1 code still
//      opens: its parts move to the fine grid (regrid.js).
//   3  the hull's style after the frame (M23d). A version 1 or 2 code opens
//      in the default style, as older saves' ships do.
//   4  the hull's paint and trim after its style, and the styling pieces
//      after the parts (M23f). An older code opens in the yard's slate and
//      sky with none.
//   5  the paint's pattern, its second color and the engines' glow after
//      the trim (M58). An older code opens plain, with the maker's glow.
import { config } from '../config.js';
import { buildShip, DEFAULT_ACCENT, DEFAULT_GLOW, DEFAULT_HULL, DEFAULT_PAINT, DEFAULT_PATTERN, DEFAULT_TRIM, placePiece } from '../sim/builder.js';
import { regridPlacement } from '../sim/regrid.js';
import { base64UrlToBytes, bytesToBase64Url, checksum } from './codec.js';

export const BLUEPRINT_VERSION = 5;
const PREFIX = `${config.appId}b`;
const SAVE_PREFIX = `${config.appId}.`;

// The code for a ship: its frame, its hull's style, paint and trim, its
// parts in build order and its styling pieces.
export function encodeBlueprint(ship) {
  return encodePlacements(ship.frame, ship.modules, BLUEPRINT_VERSION, ship.hull, { paint: ship.paint, trim: ship.trim, pattern: ship.pattern, accent: ship.accent, glow: ship.glow, styling: ship.styling ?? [] });
}

// The code for a frame and placements [{ type, x, y, rot }], unchecked, with
// the hull's style from version 3, and its paint, trim and styling pieces
// from 4, and its pattern, second color and glow from 5. Tests use it to make codes the game would never make.
export function encodePlacements(frameId, placements, version = BLUEPRINT_VERSION, hull = DEFAULT_HULL, { paint = DEFAULT_PAINT, trim = DEFAULT_TRIM, pattern = DEFAULT_PATTERN, accent = DEFAULT_ACCENT, glow = DEFAULT_GLOW, styling = [] } = {}) {
  const bytes = [];
  const text = (value) => {
    const chars = [...value].map((c) => c.charCodeAt(0));
    if (chars.length > 255 || chars.some((c) => c > 127)) throw new RangeError(`blueprint: can't encode the id "${value}"`);
    bytes.push(chars.length, ...chars);
  };
  // Each list as its types, then each item as three bytes.
  const list = (items, noun, rows, turns) => {
    const types = [...new Set(items.map((p) => p.type))];
    if (types.length > 255 || items.length > 255) throw new RangeError(`blueprint: too many ${noun}s`);
    bytes.push(types.length);
    types.forEach(text);
    bytes.push(items.length);
    for (const { type, x, y, rot } of items) {
      if (!(x >= 0 && x <= 255 && y >= 0 && y < rows && rot >= 0 && rot < turns)) throw new RangeError(`blueprint: can't encode a ${noun} at (${x}, ${y}) turned ${rot}`);
      bytes.push(types.indexOf(type), x, y * turns + rot);
    }
  };
  text(frameId);
  if (version >= 3) text(hull);
  if (version >= 4) {
    text(paint);
    text(trim);
  }
  if (version >= 5) {
    text(pattern);
    text(accent);
    text(glow);
  }
  list(placements, 'part', 64, 4);
  if (version >= 4) list(styling, 'styling piece', 32, 8);
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
  if (version < 1) return fail(`Blueprints of version ${version} can't be read.`);

  const read = unpack(payload, version);
  if (!read) return fail("The code is damaged and can't be read.");
  if (!defs.frames.has(read.frame)) return fail(`This blueprint is for a hull this version of the game doesn't have ("${read.frame}").`);
  const unknown = [...new Set(read.placements.map((p) => p.type))].filter((type) => !defs.modules.has(type));
  if (unknown.length) return fail(`This blueprint uses parts this version of the game doesn't have: ${unknown.join(', ')}.`);
  const placements = version === 1 ? read.placements.map(regridPlacement) : read.placements;
  const built = buildShip(defs, read.frame, placements);
  if (built.rejected.length) return fail(`This blueprint doesn't fit together: ${built.rejected[0].message}`);
  // Looks this version doesn't have change only the look: a style, paint
  // or trim it doesn't know opens as the default, and a styling piece it
  // doesn't know, or that doesn't fit, is left off.
  let ship = {
    ...built.ship,
    hull: defs.hulls?.has(read.hull) ? read.hull : DEFAULT_HULL,
    paint: defs.paints?.has(read.paint) ? read.paint : DEFAULT_PAINT,
    trim: defs.trims?.has(read.trim) ? read.trim : DEFAULT_TRIM,
    pattern: defs.patterns?.has(read.pattern) ? read.pattern : DEFAULT_PATTERN,
    accent: defs.paints?.has(read.accent) ? read.accent : DEFAULT_ACCENT,
    glow: defs.glows?.has(read.glow) ? read.glow : DEFAULT_GLOW,
  };
  for (const piece of read.styling) {
    const placed = placePiece(ship, defs, piece);
    if (placed.ok) ship = placed.ship;
  }
  return { ok: true, ship };
}

// The payload's bytes as { frame, hull, paint, trim, pattern, accent, glow,
// placements, styling },
// or null if they don't follow the layout of the code's version exactly.
function unpack(payload, version) {
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
  // A list: its types, then each item as three bytes, the last y × turns
  // plus the turn. Null if it runs past the end.
  const list = (turns) => {
    const typeCount = byte();
    if (typeCount === null) return null;
    const types = [];
    for (let i = 0; i < typeCount; i++) {
      const type = text();
      if (type === null) return null;
      types.push(type);
    }
    const count = byte();
    if (count === null || at + count * 3 > bytes.length) return null;
    const items = [];
    for (let i = 0; i < count; i++) {
      const [t, x, packed] = [byte(), byte(), byte()];
      if (t >= types.length) return null;
      items.push({ type: types[t], x, y: Math.floor(packed / turns), rot: packed % turns });
    }
    return items;
  };
  const frame = text();
  const hull = version >= 3 ? text() : DEFAULT_HULL;
  const paint = version >= 4 ? text() : DEFAULT_PAINT;
  const trim = version >= 4 ? text() : DEFAULT_TRIM;
  const pattern = version >= 5 ? text() : DEFAULT_PATTERN;
  const accent = version >= 5 ? text() : DEFAULT_ACCENT;
  const glow = version >= 5 ? text() : DEFAULT_GLOW;
  if ([frame, hull, paint, trim, pattern, accent, glow].includes(null)) return null;
  const placements = list(4);
  const styling = placements && version >= 4 ? list(8) : [];
  if (!placements || !styling || at !== bytes.length) return null;
  return { frame, hull, paint, trim, pattern, accent, glow, placements, styling };
}

function fail(error) {
  return { ok: false, error };
}
