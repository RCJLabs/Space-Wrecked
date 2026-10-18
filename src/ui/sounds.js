// Which sounds a moment of the game makes (M35): ids of data/sounds.json,
// worked out from what changed, for src/platform/audio.js to play. Pure.
// The fights and the campaign's moments are gritty, the menus and the
// builder soft (Evan's picks, ROADMAP M35); the sounds are data, and which
// moment plays which is here.
import { raidDue } from '../sim/heat.js';

// The sounds the game plays at its moments. A shot is its weapon's
// (data/weapons.json sound). The validator checks every one is in
// data/sounds.json.
export const MOMENT_SOUNDS = ['tap', 'confirm', 'refuse', 'place', 'turn', 'remove', 'hit', 'miss', 'down', 'order', 'door', 'reload', 'blast', 'jump', 'alarm', 'liftoff', 'landing'];

// The campaign's actions a player takes that spend or settle something.
// The rest make no sound of their own: a button's tap is enough, and the
// screens dispatch some as they open or follow the builder (campaign/board,
// campaign/ship, builds/save). An action the rules turn down changes
// nothing, so it makes none.
const SETTLED = new Set([
  'campaign/new', 'campaign/buy', 'campaign/sell', 'campaign/hire', 'campaign/dismiss', 'campaign/pay', 'campaign/job/take', 'campaign/job/quest',
  'campaign/patch', 'campaign/repair', 'campaign/supplies', 'campaign/swap', 'campaign/scan', 'campaign/survey', 'campaign/regroup',
  'campaign/event/choose', 'campaign/donate', 'campaign/day', 'campaign/fight/begin', 'campaign/raid/begin', 'campaign/raid/face',
  'campaign/boarding/begin', 'campaign/trip/choose', 'campaign/trip/board',
]);
// The ones that fly the ship somewhere, and the colony's building by hand.
const FLOWN = new Set(['campaign/jump', 'campaign/sector/leave', 'campaign/trip/out', 'campaign/trip/on', 'campaign/trip/home']);
const BUILT = { 'campaign/build': 'place', 'campaign/move': 'place', 'campaign/takedown': 'remove' };

// The sounds a change to the game's store makes, in order: (state, prev,
// action) as its listeners hear them. The lift-off and the landing are their
// screens' (launch.js, landing.js), in step with what they show, and so is
// an approach's round since M38b: the approach screen plays its sounds with
// its shots (render/approachPlayback.js roundCues), or roundSounds at once
// with reduced motion.
export function gameSounds(state, prev, action) {
  const sounds = [];
  const { type } = action;
  if (FLOWN.has(type)) sounds.push('jump');
  else if (BUILT[type]) sounds.push(BUILT[type]);
  else if (SETTLED.has(type)) sounds.push('confirm');
  if (alarmed(state.campaign, prev.campaign, action.rules)) sounds.push('alarm');
  return sounds;
}

// A round of an approach (src/sim/approach.js) all at once, as the approach
// screen plays it with reduced motion: the ships' guns, then whether the
// crew's volley hit; a flight that got away flies off.
export function roundSounds(last) {
  if (!last) return [];
  const volleys = last.events.filter((e) => e.kind === 'volley' && e.shots.length);
  const ours = volleys.find((e) => e.side === 'you');
  const sounds = volleys.length ? ['shotgun'] : [];
  if (ours) sounds.push(ours.shots.some((s) => s.hit) ? 'hit' : 'miss');
  if (last.events.some((e) => e.kind === 'flee' && e.side === 'you' && e.ok)) sounds.push('jump');
  return sounds.length ? sounds : ['confirm'];
}

// Whether trouble has just come: a raid due at the hangar (act 1), the
// hunters waiting where the ship has come to (act 2), or a raid coming at
// the colony (act 3).
function alarmed(campaign, before, rules) {
  if (!campaign) return false;
  if (campaign.colony?.raid && !before?.colony?.raid) return true;
  const approach = campaign.run?.approach;
  if (approach?.hunt && approach.node !== before?.run?.approach?.node) return true;
  return Boolean(rules?.balance && raidDue(campaign, rules) && !(before && raidDue(before, rules)));
}

// The sounds a change to the builder's session makes (src/sim/session.js):
// a part placed, moved, turned or taken off as the command that did it, a
// new look a confirm; a ghost turned; a refusal where the session says no;
// a tap where a tap only showed or picked something. Undo and redo are
// their buttons' taps.
export function builderSounds(session, prev) {
  const entry = session.past.at(-1);
  if (entry && !prev.past.includes(entry) && !prev.future.includes(entry)) return [commandSound(entry)];
  if (session.notice && session.notice !== prev.notice && session.notice.tone === 'bad') return ['refuse'];
  const [ghost, was] = [session.ghost, prev.ghost];
  if (ghost && was && ghost.uid === was.uid && ghost.x === was.x && ghost.y === was.y && ghost.rot !== was.rot) return ['turn'];
  if (ghost !== was || session.selected !== prev.selected || session.armed !== prev.armed) return ['tap'];
  return [];
}

function commandSound({ command, before }) {
  switch (command.op) {
    case 'place':
      return 'place';
    case 'remove':
      return 'remove';
    case 'move': {
      const item = [...before.modules, ...(before.styling ?? [])].find((m) => m.uid === command.uid);
      return item && item.x === command.x && item.y === command.y ? 'turn' : 'place';
    }
    default:
      return 'confirm'; // the hull's style, its paint or trim
  }
}

// The sounds a change to a fight's session makes (src/sim/fight.js): a
// refusal where a tap did nothing and the session says why, a tap where a
// tap on the board showed or did something. What an order sets off sounds
// as it plays out (cueSound).
export function fightSounds(fight, prev, action) {
  if (fight.notice && fight.notice !== prev.notice) return ['refuse'];
  return action.type === 'fight/tap' ? ['tap'] : [];
}

// The sound a moment of a fight's playback makes (render/playback.js
// cuesBetween): each shot its weapon's as it fires, then a hit or a miss as
// it lands; a unit down or dead; an order, a door, a reload; a job's
// captive freed or a charge set (M38), as an order, and a charge blowing.
// battle names each unit's weapon; rules.weapons each weapon's sound.
export function cueSound({ event, lands }, battle, rules) {
  switch (event.type) {
    case 'shot': {
      if (lands) return event.hit ? 'hit' : 'miss';
      const unit = battle.units.find((u) => u.id === event.unit);
      return rules.weapons.get(unit?.weapon)?.sound ?? null;
    }
    case 'down':
    case 'dead':
      return 'down';
    case 'order':
    case 'free':
    case 'plant':
      return 'order';
    case 'blast':
      return 'blast';
    case 'door':
      return 'door';
    case 'reload':
      return 'reload';
    default:
      return null;
  }
}
