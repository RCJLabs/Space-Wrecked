// An approach's round played out on the approach screen (M38b): the round's
// events (src/sim/approach.js playRound, kept as approach.last) as beats in
// time, and what the screen shows at any moment of them. Pure: plain data
// in, plain data out. render/approachView.js draws a frame; the screen
// keeps the clock and plays the cues.
//   geometry = shipGeometry({ ship, defs, hull, wrecked })   each side's
//   timeline = roundTimeline({ events, before, outcome, geometry })
//   frame = frameAt(timeline, t)
//   sounds = roundCues(timeline, from, to)
//   pose = restingPose(outcome)   the ships once it is all played
import { hasTag } from '../sim/modules.js';
import { HULL } from './exterior.js';
import { partPoint } from './hullMarks.js';

const OTHER = { you: 'them', them: 'you' };
// How long each thing takes, in ms: the pause between events, a volley's
// shots one after another, each shot's flight and the flash where it lands,
// a flight that gets away and a closing that grapples on, a try that fails,
// and a reactor going.
export const MS = { pause: 160, gap: 200, travel: 340, torpedo: 620, land: 300, flight: 950, close: 700, lurch: 450, blow: 1000, holds: 450 };
// How far a ship that gets away flies off, in widths of its own part of
// the screen, and how far a failed try lurches. Ships closing to board come
// together as far as approachView.js finds room for.
export const AWAY = 1.4;
const LURCH = 0.05;
// A gun's muzzle, out along its barrels from the cell's middle (exterior.js
// draws them so): a pair from a gun a cell across, one heavy barrel from a
// wider one.
const MUZZLE = { light: [1.16, HULL + 0.14], heavy: [1.36, HULL + 0.18] };
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// Where things are on a ship, in her own deck's cells: { guns, center,
// edge, span, partAt(uid), miss(i) }. guns: [{ uid, at, torpedo }], the
// muzzles of the guns working as the round began (wrecked: { [uid]: hazard
// }), in the order they fire (fitted order, as approach.js sideStats counts
// them), torpedo true for a torpedo bay's tube (M39).
// edge is her nose, where a shot her shields stop flashes; a miss flies by
// her, above or below in turn.
export function shipGeometry({ ship, defs, hull, wrecked = {} }) {
  const xs = hull.cells.map(([x]) => x);
  const ys = hull.cells.map(([, y]) => y);
  const [x0, x1, y0, y1] = xs.length ? [Math.min(...xs), Math.max(...xs) + 1, Math.min(...ys), Math.max(...ys) + 1] : [0, 1, 0, 1];
  const center = [(x0 + x1) / 2, (y0 + y1) / 2, HULL / 2];
  const muzzles = new Map(hull.barrels.map((barrel) => [barrel.uid, barrel]));
  const guns = [];
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def || !hasTag(def, 'weapon') || module.uid in wrecked) continue;
    const barrel = muzzles.get(module.uid);
    const torpedo = hasTag(def, 'torpedo');
    if (!barrel) {
      guns.push({ uid: module.uid, at: partPoint(ship, defs, module.uid) ?? center, torpedo });
      continue;
    }
    const [dx, dy] = STEP[barrel.side];
    const [reach, z] = MUZZLE[barrel.heavy ? 'heavy' : 'light'];
    guns.push({ uid: module.uid, at: [barrel.x + 0.5 + dx * reach, barrel.y + 0.5 + dy * reach, z], torpedo });
  }
  return {
    guns,
    center,
    edge: [x1 + 0.9, center[1], HULL * 0.6],
    span: [x1 - x0, y1 - y0],
    partAt: (uid) => partPoint(ship, defs, uid) ?? center,
    miss: (i) => [center[0] - (x1 - x0) * 0.15, i % 2 ? y1 + 1.4 : y0 - 1.4, HULL],
  };
}

// The round's beats in time: { ms, beats, ends, before, geometry, resting }.
// events: the round's (approach.last.events); before: each side's {
// damage, wrecked } as it began; outcome: the approach's once played
// (null while it goes on); geometry: each side's shipGeometry. A beat is a
// shot ({ kind: 'shot', side (who fired), at, lands, from, to, hit,
// shield, module, damage, wreck, torpedo }), a flight, a closing or a
// reactor going ({ kind: 'flee' | 'close' | 'blow', side, ok, at, ms }).
// ends: when each event's beats are over, so its line can show. A torpedo
// (M39) flies slower than a gun's shot, and in a round its bays hold fire
// the shots are the other guns', in their order.
export function roundTimeline({ events, before, outcome = null, geometry }) {
  const beats = [];
  const ends = [];
  let t = 0;
  for (const event of events) {
    if (event.kind === 'volley') {
      const shooter = geometry[event.side];
      const target = geometry[OTHER[event.side]];
      const firing = event.shots.length === shooter.guns.length ? shooter.guns : shooter.guns.filter((gun) => !gun.torpedo);
      let last = t;
      event.shots.forEach((shot, i) => {
        const at = t + i * MS.gap;
        const torpedo = shot.torpedo === true;
        const lands = at + (torpedo ? MS.torpedo : MS.travel);
        last = Math.max(last, lands);
        const to = shot.module !== null ? target.partAt(shot.module) : shot.hit ? target.edge : target.miss(i);
        beats.push({ kind: 'shot', side: event.side, at, lands, from: firing[i]?.at ?? shooter.center, to, hit: shot.hit, shield: shot.absorbed > 0, module: shot.module, damage: shot.damage, wreck: shot.wreck, torpedo });
      });
      if (event.shots.length) t = last + MS.land;
    } else {
      const ms = event.kind === 'blow' ? (event.ok ? MS.blow : MS.holds) : event.ok ? MS[event.kind === 'flee' ? 'flight' : 'close'] : MS.lurch;
      beats.push({ kind: event.kind, side: event.side ?? 'them', ok: event.ok, at: t, ms });
      t += ms;
    }
    ends.push(t);
    t += MS.pause;
  }
  // A ship disabled is boarded with no closing to play: they come in last.
  const resting = restingPose(outcome);
  if (resting.grapple && !beats.some((beat) => beat.kind === 'close' && beat.ok)) {
    beats.push({ kind: 'close', side: OTHER[resting.grapple], ok: true, at: t, ms: MS.close });
    t += MS.close;
  }
  return { ms: Math.max(t - MS.pause, 0), beats, ends, before, geometry, resting };
}

// What the screen shows t ms into the round: { done, shots, flashes,
// shimmers, moves, close, gone, marks, lines, grapple }.
//   shots     in flight: [{ side (who fired), target, from, to, progress,
//             torpedo }]
//   flashes   [{ side (whose ship), at, kind: 'hit' | 'burst' | 'blowup',
//             progress }]: a hit, a part wrecked, a ship blowing apart
//   shimmers  [{ side, progress }]: a shield taking a shot
//   moves     { you, them }: how far each ship is off its place, in widths
//             of its part of the screen (to the right is more)
//   close     how far the two have come together to board, 0 to 1
//   gone      { you, them }: true for a ship flown off or blown apart
//   marks     each side's { damage, wrecked } with the shots landed so far
//   lines     how many of the round's lines have played (approachText.js)
//   grapple   the ship boarded, once all is played, or null
export function frameAt(timeline, t) {
  const { beats, before, geometry, resting } = timeline;
  const frame = {
    done: t >= timeline.ms,
    shots: [],
    flashes: [],
    shimmers: [],
    moves: { you: 0, them: 0 },
    close: 0,
    gone: { you: false, them: false },
    marks: { you: copyMarks(before.you), them: copyMarks(before.them) },
    lines: timeline.ends.filter((end) => end <= t).length,
    grapple: null,
  };
  for (const beat of beats) {
    if (beat.at > t) break;
    if (beat.kind === 'shot') {
      const target = OTHER[beat.side];
      if (t < beat.lands) {
        frame.shots.push({ side: beat.side, target, from: beat.from, to: beat.to, progress: (t - beat.at) / (beat.lands - beat.at), torpedo: beat.torpedo === true });
        continue;
      }
      const marks = frame.marks[target];
      if (beat.module !== null) {
        marks.damage[beat.module] = (marks.damage[beat.module] ?? 0) + beat.damage;
        if (beat.wreck) marks.wrecked[beat.module] = beat.wreck;
      }
      const since = (t - beat.lands) / MS.land;
      if (since < 1) {
        if (beat.shield) frame.shimmers.push({ side: target, progress: since });
        if (beat.module !== null) frame.flashes.push({ side: target, at: beat.to, kind: beat.wreck ? 'burst' : 'hit', progress: since });
      }
      continue;
    }
    const p = Math.min(1, (t - beat.at) / beat.ms);
    if (beat.kind === 'flee') {
      // A flight that gets away, whoever's it is, takes her off the screen:
      // the player's ship stays in view.
      if (beat.ok) {
        frame.moves.them = AWAY * ease(p);
        if (p >= 1) frame.gone.them = true;
      } else {
        frame.moves[beat.side] += (beat.side === 'you' ? -LURCH : LURCH) * lurch(p);
      }
    } else if (beat.kind === 'close') {
      if (beat.ok) {
        frame.close = ease(p);
      } else {
        frame.moves[beat.side] += (beat.side === 'you' ? LURCH : -LURCH) * lurch(p);
      }
    } else if (beat.kind === 'blow' && beat.ok) {
      if (p < 1) frame.flashes.push({ side: 'them', at: geometry.them.center, kind: 'blowup', progress: p });
      if (p >= 0.35) frame.gone.them = true;
    }
  }
  if (frame.done) frame.grapple = resting.grapple;
  return frame;
}

// The sounds of the round between from and to ms (from < at <= to): each
// shot as it fires; as it lands a hit where it struck a part, a miss
// where the crew's missed or was stopped by her shields; a jump for a
// flight that gets away and a blast for a ship blowing apart. A round with
// no shot fired confirms as it starts. Ids of data/sounds.json, as
// ui/sounds.js gives the rest.
export function roundCues(timeline, from, to) {
  const sounds = [];
  const between = (at) => at > from && at <= to;
  if (between(0) && !timeline.beats.some((beat) => beat.kind === 'shot')) sounds.push('confirm');
  for (const beat of timeline.beats) {
    if (beat.kind === 'shot') {
      if (between(beat.at)) sounds.push('shotgun');
      if (between(beat.lands)) {
        if (beat.module !== null) sounds.push('hit');
        else if (beat.side === 'you') sounds.push('miss');
      }
    } else if (between(beat.at) && beat.ok) {
      if (beat.kind === 'flee') sounds.push('jump');
      if (beat.kind === 'blow') sounds.push('blast');
    }
  }
  return sounds;
}

// Where the ships rest once the round is played, by how the approach
// ended: { moves, gone, grapple, close }. A ship that got away or ran
// leaves the other behind, hers flown off; one that blew apart is gone; a
// boarding brings them together, the boarded one grappled.
export function restingPose(outcome) {
  const pose = { moves: { you: 0, them: 0 }, gone: { you: false, them: false }, grapple: null, close: 0 };
  const kind = outcome?.kind;
  if (kind === 'escaped' || kind === 'fled') {
    pose.moves.them = AWAY;
    pose.gone.them = true;
  } else if (kind === 'destroyed') {
    pose.gone.them = true;
  } else if (kind === 'boarded' || kind === 'boardedBy') {
    pose.close = 1;
    pose.grapple = kind === 'boarded' ? 'them' : 'you';
  }
  return pose;
}

function copyMarks(side) {
  return { damage: { ...(side?.damage ?? {}) }, wrecked: { ...(side?.wrecked ?? {}) } };
}

function ease(p) {
  return p * p * (3 - 2 * p);
}

// Out and back: a try that fails, back where it started at its end.
function lurch(p) {
  return p < 1 ? Math.sin(Math.PI * p) : 0;
}
