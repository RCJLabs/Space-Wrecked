// Words for replay (M64): a run's modifiers and week on the hub, the
// modifiers and the week's run on a new game's last screen (startGame.js),
// and the record on the Campaigns screen (campaigns.js). Pure.
import { unlocked, weeklyRun } from '../sim/modifiers.js';

// "Wanted, Nest egg", with "Week 2026-W44: " first for a week's run, or
// null for a run with neither.
export function runLine(campaign, rules) {
  const names = (campaign.modifiers ?? []).map((id) => rules.modifiers.get(id)?.name ?? id);
  if (!names.length && !campaign.week) return null;
  return `${campaign.week ? `Week ${campaign.week}: ` : ''}${names.join(', ') || 'no modifiers'}`;
}

// What unlocks a boon: "Reach act 2", "Win the reckoning".
export function unlockText(def) {
  if (!def.unlock) return null;
  return def.unlock.won ? 'Win the reckoning' : `Reach act ${def.unlock.act}`;
}

// The start screen's modifier buttons: [{ id, label, pressed, disabled,
// locked }]. With the week's run on, its two are pressed and none can be
// changed.
export function modifierChoices(rules, picked, reached, week) {
  const weekly = week ? weeklyRun(rules, week).modifiers : null;
  return [...rules.modifiers.values()].map((def) => {
    const open = unlocked(def, reached);
    const pressed = weekly ? weekly.includes(def.id) : picked.includes(def.id);
    return { id: def.id, label: open ? def.name : `${def.name} (locked)`, pressed, disabled: Boolean(weekly) || !open, locked: !open, kind: def.kind };
  });
}

// The line under them: what the picked ones do, and what opens the locked.
export function modifiersLine(rules, picked, reached, week) {
  const ids = week ? weeklyRun(rules, week).modifiers : picked;
  const said = ids.map((id) => `${rules.modifiers.get(id).name}: ${rules.modifiers.get(id).text}`);
  const locked = [...rules.modifiers.values()].filter((def) => !unlocked(def, reached)).map((def) => `${def.name}: ${unlockText(def).toLowerCase()} to open it.`);
  const head = week ? "This week's run gives these." : ids.length ? '' : "None picked: the background's own start.";
  return [head, ...said, ...locked].filter(Boolean).join(' ');
}

// The week row's line.
export function weekLine(rules, week, on) {
  return on ? `Week ${week}: a seed and two modifiers made from the week alone, the same for everyone who starts it this week with this background.` : 'A run of your own: its own seed, and the modifiers you pick.';
}

// The record on the Campaigns screen: { furthest, runs: [line] }.
export function recordText(profile, rules) {
  const { reached, runs } = profile;
  const furthest = !runs.length ? 'No runs yet.' : `Furthest: act ${reached.act}${reached.won ? ', and the reckoning won' : ''}.`;
  return {
    furthest,
    runs: runs.slice(0, 5).map((run) => {
      const background = rules?.backgrounds.get(run.background)?.name ?? run.background;
      const end = run.won ? 'won' : run.over ? 'game over' : `act ${run.act}`;
      const extra = runLine(run, rules ?? { modifiers: new Map() });
      return [background, end, extra].filter(Boolean).join(' · ');
    }),
  };
}
