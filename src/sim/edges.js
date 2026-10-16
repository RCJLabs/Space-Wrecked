// What a crew's jobs bring besides a fight (ROADMAP §4.5, M32): each job's
// ship effect (`station` in data/jobs.json), while one of the job is aboard
// on the run, and its colony effect (`colony`), while one is home: or, as
// the effect says below, in the squad or anywhere in the crew. A second of
// the same job adds nothing, and of two jobs with the same effect the
// better counts. Each crew member brings their job's effects at their rank
// (ranks.js, M32b), so the best rank of a job among them counts. Pure.
import { memberJob } from './ranks.js';

// Ship effects, each what it adds and how far it goes:
//   heal        hit points a working med bay heals each of the wounded a
//               jump, on top of the bay's (medbay.js, M23)
//   gunnery     to hit, for the ship's guns in the approach (approach.js)
//   evasion     the ship's evasion in the approach
//   repair      wrecked parts fixed after each jump, the cheapest first
//               (travel.js)
//   scan        links a scan reaches past balance.scanRange (travel.js)
//   freeSurvey  1: a survey takes no day, eating no supplies and adding no
//               heat (survey.js)
//   lockers     supplies the lockers hold past balance.baseSupplies
export const STATION_EFFECTS = {
  heal: [1, 5],
  gunnery: [1, 50],
  evasion: [1, 50],
  repair: [1, 5],
  scan: [1, 3],
  freeSurvey: [1, 1],
  lockers: [1, 99],
};

// Colony effects, each what it adds, how far it goes, and who brings it:
//   heal      what a powered infirmary heals, on top of its own (days.js):
//             home
//   landing   to hit, for each defense's shots at a raid's lander
//             (raids.js): home
//   mines     materials each mine digs a day (colony.js): home
//   tripDays  days a trip's legs are shorter, each way, never under 1
//             (expeditions.js): in the squad
//   places    places within reach past data/expeditions.json's
//             (expeditions.js): anywhere in the crew
//   farms     food each farm grows a day (colony.js): home
//   stores    food and materials the stores keep past theirs (colony.js):
//             anywhere in the crew, so a trip never spoils what they keep
export const COLONY_EFFECTS = {
  heal: [1, 5],
  landing: [1, 50],
  mines: [1, 5],
  tripDays: [1, 3],
  places: [1, 3],
  farms: [1, 5],
  stores: [1, 99],
};

// The best ship effect `key` among these crew members' jobs, or 0.
export function stationEdge(members, rules, key) {
  return best(members, rules, 'station', key);
}

// The best colony effect `key` among these crew members' jobs, or 0.
export function colonyEdge(members, rules, key) {
  return best(members, rules, 'colony', key);
}

// The crew member whose job brings the best ship effect `key`, the first
// of them, or null: who to name when the screens show it at work.
export function stationBy(members, rules, key) {
  return by(members, rules, 'station', key);
}

// The same for colony effect `key`.
export function colonyBy(members, rules, key) {
  return by(members, rules, 'colony', key);
}

function best(members, rules, layer, key) {
  return Math.max(0, ...members.map((member) => edgeOf(member, rules, layer, key)));
}

function by(members, rules, layer, key) {
  const most = best(members, rules, layer, key);
  return most ? members.find((member) => edgeOf(member, rules, layer, key) === most) : null;
}

function edgeOf(member, rules, layer, key) {
  return memberJob(member, rules)?.[layer]?.[key] ?? 0;
}
