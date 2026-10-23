// Which moments vibrate, and how (M47). Pure: a moment in, a pattern out
// (ms on, or [on, off, on]), played by src/platform/haptics.js on the
// playback's own clock, as the sounds are (sounds.js).
//
// In a fight: a crew member hit, a pulse; downed, a long one; the crew's
// shot landing on an enemy, a light one; a crit, either way, a second
// pulse. In the approach: the ship hit, a pulse; a part of hers wrecked, a
// long one.
export const PULSE = { light: 15, hit: 40, long: 120, gap: 60 };

const twice = (ms) => [ms, PULSE.gap, ms];

// A moment of a fight's playback (render/playback.js cuesBetween): a shot as
// it lands, a unit going down. battle tells the sides apart.
export function fightBuzz({ event, lands }, battle) {
  const sideOf = (id) => battle.units.find((u) => u.id === id)?.side ?? null;
  if (event.type === 'shot' && lands && event.hit) {
    const ms = sideOf(event.target) === 'crew' ? PULSE.hit : sideOf(event.unit) === 'crew' ? PULSE.light : 0;
    if (!ms) return null;
    return event.crit ? twice(ms) : ms;
  }
  if ((event.type === 'down' || event.type === 'dead') && sideOf(event.unit) === 'crew') return PULSE.long;
  return null;
}

// The vibrations of an approach's round played from `from` to `to` ms
// (render/approachPlayback.js roundTimeline): each of the other's shots as it
// lands on the ship, a part wrecked the longer.
export function roundBuzzes(timeline, from, to) {
  return timeline.beats.filter((beat) => beat.kind === 'shot' && beat.side === 'them' && beat.hit && beat.lands > from && beat.lands <= to).map(shotBuzz);
}

// A round's vibrations all at once, with motion reduced (the round isn't
// played out): the hardest hit of it, if the ship was hit.
export function roundBuzz(last) {
  const hits = (last?.events ?? []).filter((e) => e.kind === 'volley' && e.side === 'them').flatMap((e) => e.shots.filter((s) => s.hit));
  if (!hits.length) return null;
  return hits.some((s) => s.wreck) ? PULSE.long : PULSE.hit;
}

function shotBuzz(beat) {
  return beat.wreck ? PULSE.long : PULSE.hit;
}
