// What a fight's actions look like as they happen: units walk their paths a
// step at a time, shots fly and land, doors slide open, words rise over the
// units hit. Pure: the screen asks what the board shows `t` ms into a
// playback, so the same events always play the same way.
//
//   timeline = makeTimeline(before, played)
//     before   the battle before (battle.js)
//     played   [{ events, battle }]: actions in order (fight.js), each with
//              its events and the battle after it
//   frameAt(timeline, t) -> {
//     view     the battle as it stands at t: each event applied in turn,
//              and exactly the rules' own battle at the end of each action
//     event    the event playing at t (or null), and progress, 0 to 1
//     moving   { id, at: [x, y], facing } for a unit walking, at a point
//              between tile middles
//     shot     { shooter, target, from, to, hit, progress, weapon, seed }
//              for a shot: weapon the shooter's (M59), seed the ms its
//              beat starts, for shotFx.js to scatter its sparks by
//     hit      the id of a unit a shot has just hit, or null
//     blast    { at: [x, y], progress } for a charge blowing (M38), or null
//     floats   [{ at: [x, y], text, tone, age, stack }]: words over tiles;
//              tone is 'hit' (an enemy hit), 'hurt' (one of the crew),
//              'miss', 'good' or 'info'; stack, how many rose with them on
//              the same tile before (drawn that many lines higher)
//     done     true once t is past the last event
//   }
//   timeline.length is the ms the events take; timeline.tail, the ms until
//   the last words have faded.
import { edgeKey } from '../sim/mapFromShip.js';

export const STEP_MS = 150; // each step of a walk
export const FLOAT_MS = 1100; // words over a unit, rising and fading
const MS = {
  door: 260,
  shot: 650,
  overwatch: 450,
  reload: 450,
  stabilize: 500,
  down: 450,
  dead: 450,
  bleed: 400,
  'bled out': 500,
  air: 400,
  hazard: 500,
  // A job's objective (M38): a crate picked up or carried out, the captive
  // freed, a charge set, pulled or blowing, the way in broken through.
  grab: 400,
  out: 600,
  free: 500,
  plant: 500,
  pull: 500,
  blast: 800,
  through: 600,
  turn: 900,
  end: 0,
  over: 700,
};
export const FLIGHT = 0.3; // a shot flies for this part of its time, then lands

export function durationOf(event) {
  return event.type === 'move' ? STEP_MS * (event.path.length - 1) : MS[event.type] ?? 0;
}

// still (M42, reduced motion): every event takes no time, so the end shows
// at once with all the words rising together, stacked where they share a
// tile.
export function makeTimeline(before, played, { still = false } = {}) {
  const beats = [];
  let at = 0;
  for (const step of played) {
    for (const event of step.events) {
      const ms = still ? 0 : durationOf(event);
      beats.push({ at, ms, event });
      at += ms;
    }
    beats.push({ at, ms: 0, snap: step.battle });
  }
  return { before, beats, length: at, tail: at + FLOAT_MS };
}

export function frameAt(timeline, t) {
  let view = timeline.before;
  const floats = [];
  let playing = null;
  for (const beat of timeline.beats) {
    if (beat.at > t) break;
    if (beat.snap) {
      view = beat.snap;
      continue;
    }
    for (const words of wordsFor(beat.event, view)) {
      const shown = t - beat.at - words.delay * beat.ms;
      if (shown >= 0 && shown < FLOAT_MS) {
        // Words rising together over one tile stack, one above another.
        const stack = floats.filter((f) => f.at[0] === words.at[0] && f.at[1] === words.at[1] && Math.abs(f.age - shown) < 1).length;
        floats.push({ at: words.at, text: words.text, tone: words.tone, age: shown, stack });
      }
    }
    if (t < beat.at + beat.ms) {
      playing = { event: beat.event, progress: (t - beat.at) / beat.ms, at: beat.at };
      break;
    }
    view = applyEvent(view, beat.event);
  }
  const frame = { view, event: playing?.event ?? null, progress: playing?.progress ?? 1, moving: null, shot: null, hit: null, blast: null, floats, done: t >= timeline.length };
  const event = frame.event;
  if (event?.type === 'move') frame.moving = { id: event.unit, ...along(event.path, frame.progress) };
  if (event?.type === 'blast') frame.blast = { at: event.at, progress: frame.progress };
  if (event?.type === 'shot') {
    const [shooter, target] = [unitOf(view, event.unit), unitOf(view, event.target)];
    frame.shot = { shooter: shooter.id, target: target.id, from: [shooter.x, shooter.y], to: [target.x, target.y], hit: event.hit, progress: frame.progress, weapon: shooter.weapon ?? null, seed: playing.at };
    if (event.hit && frame.progress >= FLIGHT && frame.progress < FLIGHT + 0.2) frame.hit = target.id;
  }
  return frame;
}

// The moments of a playback in (from, to] ms that a sound belongs to, in
// order (M35, ui/sounds.js cueSound): { event, lands }, each event as it
// starts, and a shot again as it lands, FLIGHT of the way through.
export function cuesBetween(timeline, from, to) {
  const cues = [];
  for (const beat of timeline.beats) {
    if (beat.at > to) break;
    if (beat.snap) continue;
    if (beat.at > from) cues.push({ event: beat.event, lands: false });
    const lands = beat.at + FLIGHT * beat.ms;
    if (beat.event.type === 'shot' && lands > from && lands <= to) cues.push({ event: beat.event, lands: true });
  }
  return cues;
}

// How a unit stands at a frame: { aim, stride, fall } (figures/figure.js).
// It aims while it shoots, and from the moment it goes on overwatch until
// its watch ends; strides through a walk, a stride to every two tiles; and
// falls as it goes down or dies, quicker as it goes.
export function poseAt(unit, frame) {
  const pose = { aim: unit.overwatch ? 1 : 0, stride: null, fall: 0 };
  const event = frame?.event;
  if (!event || event.unit !== unit.id) return pose;
  if (event.type === 'move') pose.stride = ((frame.progress * (event.path.length - 1)) / 2) % 1;
  if (event.type === 'shot' || event.type === 'overwatch') pose.aim = 1;
  if (event.type === 'down' || event.type === 'dead') pose.fall = frame.progress ** 2;
  return pose;
}

// Where a walk is, `progress` of the way along its path: a point between
// tile middles, and the way it faces.
function along(path, progress) {
  const steps = path.length - 1;
  const s = Math.min(progress * steps, steps - 1e-9);
  const i = Math.floor(s);
  const f = s - i;
  const [[ax, ay], [bx, by]] = [path[i], path[i + 1]];
  return { at: [ax + 0.5 + (bx - ax) * f, ay + 0.5 + (by - ay) * f], facing: [bx - ax, by - ay] };
}

// A battle with one event applied, near enough to draw until the action's
// end puts the rules' own battle back.
export function applyEvent(view, event) {
  const touched = new Set([event.unit, event.target, event.from, ...(event.units ?? [])]);
  const units = view.units.map((u) => (touched.has(u.id) ? { ...u } : u));
  const next = { ...view, units };
  const unit = units.find((u) => u.id === event.unit);
  const target = units.find((u) => u.id === event.target);
  switch (event.type) {
    case 'move':
      [unit.x, unit.y] = event.path.at(-1);
      break;
    case 'door':
      next.doors = [...view.doors, edgeKey(event.at[0], event.at[1], event.side)].sort();
      break;
    // Doors as tactics (M45, locks.js).
    case 'close':
    case 'lock': {
      const key = edgeKey(event.at[0], event.at[1], event.side);
      next.doors = view.doors.filter((k) => k !== key);
      if (event.type === 'lock') next.locks = [...(view.locks ?? []), { key, side: unit.side }];
      break;
    }
    case 'unlock':
    case 'force': {
      const key = edgeKey(event.at[0], event.at[1], event.side);
      next.doors = [...view.doors, key].sort();
      next.locks = (view.locks ?? []).filter((lock) => lock.key !== key);
      if (event.type === 'force') next.broken = [...(view.broken ?? []), key].sort();
      break;
    }
    case 'shot':
      unit.ammo -= 1;
      if (event.overwatch) unit.overwatch = false;
      if (event.hit) target.hp = Math.max(0, target.hp - event.damage);
      break;
    case 'down':
      Object.assign(unit, { status: 'down', bleed: event.bleed, ap: 0, overwatch: false });
      break;
    case 'dead':
      Object.assign(unit, { status: 'dead', ap: 0, overwatch: false });
      break;
    case 'bleed':
      unit.bleed = event.bleed;
      break;
    case 'bled out':
      Object.assign(unit, { status: event.dead ? 'dead' : 'out', bleed: 0 });
      break;
    case 'stabilize':
      Object.assign(target, { status: 'stable', bleed: 0 });
      break;
    case 'overwatch':
      Object.assign(unit, { overwatch: true, ap: 0 });
      break;
    case 'reload':
      unit.ammo = event.ammo;
      break;
    case 'air':
      unit.air = event.air;
      break;
    case 'hazard':
      unit.hp = Math.max(0, unit.hp - event.damage);
      break;
    // A job's objective (M38): on an extract, a crate picked up is in hand,
    // or taken from a fallen carrier's, until it is carried out; a captive
    // freed stands; a blast hurts everyone beside it.
    case 'grab':
      if (view.objective?.type !== 'extract') break;
      if (event.from) {
        const fallen = units.find((u) => u.id === event.from);
        unit.carrying = fallen.carrying;
        delete fallen.carrying;
      } else {
        unit.carrying = event.at;
      }
      break;
    case 'out':
      if (event.crate) delete unit.carrying;
      break;
    case 'free':
      target.status = 'active';
      break;
    case 'blast':
      for (const u of units) if (event.units.includes(u.id)) u.hp = Math.max(0, u.hp - event.damage);
      break;
    case 'turn':
      next.side = event.side;
      next.round = event.round;
      next.units = units.map((u) => (u.side === event.side && u.overwatch ? { ...u, overwatch: false } : u));
      break;
    case 'over':
      next.winner = event.winner;
      break;
  }
  return next;
}

// The words an event puts over units or tiles: [{ at, text, tone, delay }],
// where delay is how far into the event (0 to 1) they appear. Empty for
// none.
function wordsFor(event, view) {
  const over = (id, text, tone, delay = 0) => {
    const unit = unitOf(view, id);
    return unit ? [{ at: [unit.x, unit.y], text, tone, delay }] : [];
  };
  const on = (at, text, tone) => [{ at, text, tone, delay: 0 }];
  switch (event.type) {
    case 'shot': {
      const target = unitOf(view, event.target);
      if (!event.hit) return over(event.target, 'MISS', 'miss', FLIGHT);
      // A hurt to the crew says so in words, not only in its color (M42).
      return over(event.target, `${target.side === 'crew' ? 'HURT ' : ''}${event.crit ? 'CRIT ' : ''}−${event.damage}`, target.side === 'crew' ? 'hurt' : 'hit', FLIGHT);
    }
    case 'down':
      return over(event.unit, 'DOWN', 'hurt');
    case 'dead':
      return over(event.unit, 'DEAD', 'hit');
    case 'bleed':
      return over(event.unit, `BLEEDING · ${event.bleed}`, 'hurt');
    case 'bled out':
      return over(event.unit, event.dead ? 'DIED' : 'OUT', 'hurt');
    case 'stabilize':
      return over(event.target, 'STABLE', 'good');
    case 'overwatch':
      return over(event.unit, 'OVERWATCH', 'info');
    case 'reload':
      return over(event.unit, 'RELOADED', 'info');
    case 'air':
      return over(event.unit, `AIR · ${event.air}`, 'info');
    case 'hazard':
      return over(event.unit, `−${event.damage} ${event.hazard === 'fire' ? 'BURN' : 'NO AIR'}`, 'hurt');
    // A job's objective (M38).
    case 'grab':
      return over(event.unit, event.from ? 'TAKEN' : view.objective?.type === 'extract' ? 'PICKED UP' : 'GRABBED', 'good');
    case 'out':
      return over(event.unit, event.crate ? 'CRATE OUT' : 'SAFE', 'good');
    case 'free':
      return over(event.target, 'FREED', 'good');
    case 'plant':
      return on(event.at, 'CHARGE SET', 'info');
    case 'pull':
      return on(event.at, 'PULLED', 'hurt');
    case 'blast':
      // On the tile, and the damage over each unit beside it.
      return [...on(event.at, 'BLAST', 'hit'), ...event.units.flatMap((id) => over(id, `${unitOf(view, id)?.side === 'crew' ? 'HURT ' : ''}−${event.damage}`, unitOf(view, id)?.side === 'crew' ? 'hurt' : 'hit', 0.2))];
    case 'through':
      return over(event.unit, 'THROUGH', 'hurt');
    default:
      return [];
  }
}

function unitOf(view, id) {
  return view.units.find((u) => u.id === id);
}
