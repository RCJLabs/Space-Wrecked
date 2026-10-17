// The weapons the crew carry (ROADMAP §4.3, M37). Each crew member carries
// one: `weapon` on them, or with none set, their job's own (data/jobs.json),
// as everyone did before M37. Spares are on hand in campaign.arms,
// { [weapon id]: count }. A job carries some kinds of weapon (`arms`), and
// a weapon is one kind (weapons.js). Between fights a crew member can take
// a spare of a kind their job carries, and the one they had goes on hand.
// Pure.

// The weapon a crew member carries: its id.
export function weaponOf(member, rules) {
  return member.weapon ?? rules.jobs.get(member.job)?.weapon ?? null;
}

// True if a crew member of `job` (its data) can carry `weapon` (its data).
export function carries(job, weapon) {
  return Boolean(job?.arms?.includes(weapon?.kind));
}

// What the kinds are called, one and many.
export const KIND_NAMES = { sidearm: ['sidearm', 'sidearms'], long: ['long gun', 'long guns'], heavy: ['heavy weapon', 'heavy weapons'] };

// The spares on hand with one more (by > 0) or fewer of weapon `id`; none
// left drops it.
export function withArms(arms, id, by = 1) {
  const next = { ...arms, [id]: (arms[id] ?? 0) + by };
  if (next[id] <= 0) delete next[id];
  return next;
}

// The spares on hand a crew member can carry: [{ id, weapon, count }], in
// the order of data/weapons.json.
export function sparesFor(campaign, rules, member) {
  const job = rules.jobs.get(member.job);
  return [...rules.weapons.values()]
    .filter((weapon) => (campaign.arms?.[weapon.id] ?? 0) > 0 && carries(job, weapon))
    .map((weapon) => ({ id: weapon.id, weapon, count: campaign.arms[weapon.id] }));
}

// Why crew member `memberId` can't take weapon `id` from the spares now, in
// words, or null.
export function swapProblem(campaign, rules, memberId, id) {
  if (campaign.fight) return 'Not in the middle of a fight.';
  const member = campaign.crew.find((m) => m.id === memberId);
  if (!member) return "There's no one like that aboard.";
  const weapon = rules.weapons.get(id);
  if (!weapon) return "There's no weapon like that.";
  const job = rules.jobs.get(member.job);
  if (!carries(job, weapon)) return `${member.name} is a ${job.name.toLowerCase()}, who carries ${carriedWords(job)}: the ${weapon.name.toLowerCase()} is a ${KIND_NAMES[weapon.kind][0]}.`;
  if (weaponOf(member, rules) === id) return `${member.name} carries the ${weapon.name.toLowerCase()} already.`;
  if (!(campaign.arms?.[id] > 0)) return `There's no ${weapon.name.toLowerCase()} on hand.`;
  return null;
}

// Crew member `memberId` takes weapon `id` from the spares, and the one
// they carried goes on hand. Returns { ok: true, campaign } or
// { ok: false, error }.
export function swapWeapon(campaign, rules, memberId, id) {
  const error = swapProblem(campaign, rules, memberId, id);
  if (error) return { ok: false, error };
  const member = campaign.crew.find((m) => m.id === memberId);
  const arms = withArms(withArms(campaign.arms, id, -1), weaponOf(member, rules));
  const crew = campaign.crew.map((m) => (m.id === memberId ? { ...m, weapon: id } : m));
  return { ok: true, campaign: { ...campaign, crew, arms } };
}

// The spares once a crew member let go hands in what they carry.
export function handedIn(campaign, member, rules) {
  const id = weaponOf(member, rules);
  return id ? withArms(campaign.arms ?? {}, id) : campaign.arms;
}

// The kinds a job carries, in words: "sidearms", "sidearms and heavy
// weapons", "sidearms, long guns and heavy weapons".
export function carriedWords(job) {
  const names = (job?.arms ?? []).map((kind) => KIND_NAMES[kind][1]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] ?? 'nothing';
}
