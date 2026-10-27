// Who the crew are (M58): a crew member's look changed after they sign on,
// a callsign of their own, and the scars a fight leaves on them. Pure.
//
//   member.callsign   a name the crew goes by, up to MAX_CALLSIGN letters,
//                     or absent for none
//
// A look changes as captain creation changes it (looks.js stepLook and
// rollLook), wherever the crew card opens, free. A callsign is shown in
// quotes in the full name and stands for the name on a fight's buttons.
import { isLook } from './looks.js';

export const MAX_CALLSIGN = 12;

// A callsign as the player typed it, tidied: quotes taken off, spaces
// trimmed and run together.
export function tidyCallsign(callsign) {
  return typeof callsign === 'string' ? callsign.replace(/["“”]/g, '').trim().replace(/\s+/g, ' ') : '';
}

// Why a callsign won't do, or null. An empty one is none.
export function callsignProblem(callsign) {
  const tidy = tidyCallsign(callsign);
  if (tidy.length > MAX_CALLSIGN) return `A callsign is ${MAX_CALLSIGN} letters at most.`;
  if (/[^\p{L}\p{N} '.-]/u.test(tidy)) return 'A callsign is letters, numbers, spaces and - . \' only.';
  return null;
}

// True for a readable callsign as saved: tidy, 1 to MAX_CALLSIGN letters.
export function isCallsign(value) {
  return typeof value === 'string' && value !== '' && tidyCallsign(value) === value && callsignProblem(value) === null;
}

// The crew member `id` aboard given `look` and `callsign` (empty takes it
// off): { ok: true, campaign } or { ok: false, error }.
export function setCrewLook(campaign, id, look, callsign = '') {
  const member = campaign.crew.find((m) => m.id === id);
  if (!member) return { ok: false, error: 'No one of that name is aboard.' };
  if (!isLook(look)) return { ok: false, error: 'That look is not one the game can draw.' };
  const why = callsignProblem(callsign);
  if (why) return { ok: false, error: why };
  const tidy = tidyCallsign(callsign);
  const crew = campaign.crew.map((m) => {
    if (m.id !== id) return m;
    const { callsign: _old, ...rest } = m;
    return { ...rest, look: { ...look }, ...(tidy ? { callsign: tidy } : {}) };
  });
  return { ok: true, campaign: { ...campaign, crew } };
}

// A crew member's full name: "Fen 'Rook' Lindqvist", the callsign after
// the first name; "Rook Fen" for a one-word name is "Fen 'Rook'".
export function fullName(member) {
  if (!member.callsign) return member.name;
  const [first, ...rest] = member.name.split(' ');
  return [first, `'${member.callsign}'`, ...rest].join(' ');
}

// The name a fight's buttons and log give a crew member: their callsign,
// if they have one.
export function shortName(member) {
  return member.callsign ?? member.name;
}

// The marks a fight can leave, in order: a crew member downed who lives
// takes the next one their mark is in, and keeps the last.
export const SCARS = ['none', 'scar', 'jawplate'];

// The look after going down in a fight and living: a scar where there was
// no mark, a jaw plate where the scar was; any other mark stays as it is.
export function scarredLook(look) {
  const at = SCARS.indexOf(look.mark);
  return at < 0 || at === SCARS.length - 1 ? look : { ...look, mark: SCARS[at + 1] };
}

// True for a fight's unit that went down and lived: down, stabilized or
// bled out where death isn't permanent.
export function wentDown(unit) {
  return unit?.status === 'down' || unit?.status === 'stable' || unit?.status === 'out';
}
