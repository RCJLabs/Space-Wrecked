// The ?dev=1 menu's cheats, for testing a campaign on the phone: God mode
// (src/sim/god.js) and the cheats of src/sim/dev.js. Each button plays its
// cheat on the campaign where it is, through the store (dev/cheat), and the
// line under them says what it did, or why not. God mode sticks on this
// device (the storage's 'god' flag) and is never in a save; while it is on,
// the DEV button reads GOD. Win the fight takes two taps, and opens the
// fight again, won, for its Continue.
import { devSwitches, loadContent } from '../../platform/content.js';
import { readFlag, writeFlag } from '../../platform/storage.js';
import { cheat } from '../../sim/dev.js';
import { rankOf } from '../../sim/ranks.js';
import { button, el, note, row, section, setNote } from './dom.js';

// How long Win the fight stays armed after its first tap.
const ARM_MS = 3000;

// toggle: the DEV button. reopen(): mounts the screen on show anew. close():
// shuts the menu. Returns the section.
export function cheatsSection({ store, toggle, reopen, close }) {
  const status = note('');
  status.classList.add('dev-cheat-status');
  const said = note('');
  said.classList.add('dev-cheat-said');
  const godButton = button('God mode', () => setGod(!devSwitches.god));
  const label = toggle.firstChild;

  function setGod(on) {
    devSwitches.god = on;
    writeFlag('god', on);
    godButton.setAttribute('aria-pressed', String(on));
    godButton.textContent = `God mode: ${on ? 'on' : 'off'}`;
    label.nodeValue = on ? 'GOD' : 'DEV';
    toggle.toggleAttribute('data-god', on);
  }

  async function play(kind, by) {
    const rules = await loadContent();
    const before = store.getState().campaign;
    if (!before) return setNote(said, 'No campaign: start or continue one first.', 'bad');
    const result = cheat(before, rules, { kind, by });
    if (!result.ok) return setNote(said, result.error, 'bad');
    store.dispatch({ type: 'dev/cheat', cheat: { kind, by }, rules });
    setNote(said, told(kind, before, store.getState().campaign, rules), 'good');
    if (kind === 'win') {
      reopen();
      close();
    }
  }

  // Win the fight: the first tap arms it, the second wins.
  let armed = null;
  const winButton = button('Win the fight', () => {
    if (armed) {
      disarm();
      play('win');
      return;
    }
    armed = setTimeout(disarm, ARM_MS);
    winButton.textContent = 'Tap again to win';
  });
  function disarm() {
    clearTimeout(armed);
    armed = null;
    winButton.textContent = 'Win the fight';
  }

  const showStatus = () => (status.textContent = statusLine(store.getState().campaign));
  store.subscribe((state, prev) => state.campaign !== prev.campaign && showStatus());
  showStatus();
  setGod(readFlag('god'));

  const tap = (text, kind, by) => button(text, () => play(kind, by));
  return section('Cheats', [
    status,
    row([godButton]),
    row([tap('+100 credits', 'credits', 100), tap('+1,000 credits', 'credits', 1000)]),
    row([tap('Heat −25', 'heat', -25), tap('Heat +25', 'heat', 25)]),
    row([tap('Heal crew', 'heal'), tap('Rank up crew', 'rank')]),
    row([tap('Parts for checks', 'parts'), tap('Fill supplies', 'fill')]),
    row([tap('Standing +5', 'standing', 5), tap('Standing −5', 'standing', -5)]),
    row([tap('Do quest step', 'quest'), winButton]),
    said,
    el('p', { className: 'dev-note', text: 'God mode: the crew takes no damage in fights, nor the ship in approaches. Fill supplies fills the holds on the run, and food and materials at the colony.' }),
  ]);
}

// Where the campaign stands, in a line.
function statusLine(campaign) {
  if (!campaign) return 'No campaign.';
  const parts = [`Act ${campaign.act}`, `${campaign.credits} credits`, `heat ${campaign.heat}`, `${campaign.crew.length} crew`];
  if (campaign.colony) parts.push(`food ${campaign.supplies}`, `materials ${campaign.colony.materials}`);
  else if (campaign.run) parts.push(`supplies ${campaign.supplies}`);
  if (campaign.fight) parts.push('in a fight');
  return `${parts.join(' · ')}.`;
}

// What a cheat did, from the campaign before it and after.
function told(kind, before, after, rules) {
  switch (kind) {
    case 'credits':
      return `Credits ${before.credits} → ${after.credits}.`;
    case 'heat':
      return `Heat ${before.heat} → ${after.heat}.`;
    case 'heal':
      return 'The crew is at full health.';
    case 'rank':
      return `Ranked up: ${after.crew.filter((member, i) => rankOf(member, rules) > rankOf(before.crew[i], rules)).map((member) => `${member.name} to ${rankOf(member, rules)}`).join(', ')}.`;
    case 'parts':
      return `On hand: ${Object.keys(after.parts).filter((type) => after.parts[type] > (before.parts[type] ?? 0)).map((type) => `${after.parts[type] - (before.parts[type] ?? 0)} ${rules.modules.get(type)?.name ?? type}`).join(', ')}.`;
    case 'fill':
      return after.colony ? `Food ${before.supplies} → ${after.supplies}, materials ${before.colony.materials} → ${after.colony.materials}.` : `Supplies ${before.supplies} → ${after.supplies}.`;
    case 'standing':
      return `Standing: ${[...rules.factions.sides.values()].map((side) => `${side.name} ${before.standing[side.id] ?? 0} → ${after.standing[side.id] ?? 0}`).join(', ')}.`;
    case 'quest':
      return `Step done: ${Object.keys(after.quests).filter((id) => after.quests[id] !== before.quests?.[id]).map((id) => rules.quests.get(id)?.name ?? id).join(', ')}.`;
    default:
      return 'Won. Tap Continue.';
  }
}
