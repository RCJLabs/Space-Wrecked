// The Ship tab: the flight checklist, with the fix for each failing line,
// the Launch button, the hull's style (M23d: a button a style, one tap,
// which undo takes back) and the ship's totals. A fix that adds a part is a
// button that picks that part, unless there is none on hand (construction
// mode). Launch is locked while any line is open: a tap on it then just
// says what to fix. When it is ready, the first tap arms it and a second
// tap within ARM_MS launches. Construction mode has no Launch: launching
// ends act 1, and the hangar has it (M17).
import { onTap } from '../gestures.js';

const ARM_MS = 3000;

const MARKS = {
  ok: '<path d="m4 8.5 3 3 5-6.5"/>',
  fail: '<path d="m4.5 4.5 7 7m0-7-7 7"/>',
  wait: '<path d="M4 8h8"/>',
};

const STAT_ROWS = [
  ['Parts', (t, c) => `${t.parts}/${c.maxModules}`],
  ['Crew', (t, c) => c.crew],
  ['Power', (t) => `${t.power > 0 ? '+' : t.power < 0 ? '−' : ''}${Math.abs(t.power)}`],
  ['Thrust', (t) => t.thrust],
  ['Mass', (t) => t.mass],
  ['Berths', (t) => t.berths],
  ['Life support', (t) => t.lifeSupport],
  ['Cargo', (t) => t.cargo],
  ['Hull points', (t) => t.hp],
];

// onLaunch() asks the session to launch (null: no Launch button); onFix(type)
// picks a part to add; styles are the hull's ([{ id, name }], from
// data/hulls.json) and onStyle(id) gives the hull one.
export function createShipPanel({ onLaunch, onFix, styles = [], onStyle }) {
  const el = node('div', 'bld-ship');
  const checks = node('ul', 'bld-checks');
  const launch = node('button', 'btn bld-launch');
  launch.type = 'button';
  launch.hidden = !onLaunch;
  const looks = node('div', 'bld-styles');
  looks.setAttribute('role', 'group');
  looks.setAttribute('aria-label', 'Hull style');
  const styleButtons = styles.map(({ id, name }) => {
    const button = node('button', 'btn bld-style', name);
    button.type = 'button';
    button.dataset.style = id;
    button.setAttribute('aria-pressed', 'false');
    return button;
  });
  looks.append(...styleButtons);
  const styleTaps = styleButtons.map((button) => onTap(button, () => onStyle?.(button.dataset.style)));
  const stats = node('dl', 'bld-stats');
  const hullTitle = node('h3', null, 'Hull');
  hullTitle.hidden = looks.hidden = !styles.length;
  el.append(node('h3', null, 'Flight check'), checks, launch, hullTitle, looks, node('h3', null, 'Ship'), stats);

  let open = 0; // lines still to pass
  let armedUntil = 0;
  let timer = 0;
  let fixTaps = [];

  let onHand = () => Infinity;

  const detachLaunch = onTap(launch, () => {
    if (!onLaunch) return;
    if (open) return onLaunch(); // locked: the session refuses and names a fix
    if (performance.now() < armedUntil) {
      disarm();
      onLaunch();
      return;
    }
    armedUntil = performance.now() + ARM_MS;
    clearTimeout(timer);
    timer = setTimeout(disarm, ARM_MS);
    setLaunchFace();
  });

  function disarm() {
    clearTimeout(timer);
    armedUntil = 0;
    setLaunchFace();
  }

  function setLaunchFace() {
    const armed = !open && performance.now() < armedUntil;
    launch.dataset.state = open ? 'locked' : armed ? 'armed' : 'ready';
    launch.setAttribute('aria-disabled', String(Boolean(open)));
    launch.replaceChildren(
      node('span', null, armed ? 'Tap again to launch' : 'Launch'),
      ...(open ? [node('small', null, `${open} check${open === 1 ? '' : 's'} to pass`)] : []),
    );
  }

  function lineItem(line) {
    const state = line.ok === true ? 'ok' : line.ok === false ? 'fail' : 'wait';
    const item = node('li');
    item.dataset.state = state;
    const mark = node('span', 'bld-mark');
    mark.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MARKS[state]}</svg>`;
    const body = node('div', 'bld-check');
    body.append(node('p', 'bld-check-text', line.text));
    if (line.fix && line.add && onHand(line.add) > 0) {
      const fix = node('button', 'btn bld-fix', line.fix);
      fix.type = 'button';
      fixTaps.push(onTap(fix, () => onFix(line.add)));
      body.append(fix);
    } else if (line.fix) {
      body.append(node('p', 'bld-check-fix', line.add ? `${line.fix}: none on hand` : line.fix));
    }
    item.append(mark, body);
    return item;
  }

  return {
    el,
    // lines from flightChecklist, totals from shipStats, and { crew,
    // maxModules, onHand(type), hull: the ship's style }.
    update(lines, totals, context) {
      onHand = context.onHand ?? (() => Infinity);
      for (const button of styleButtons) button.setAttribute('aria-pressed', String(button.dataset.style === context.hull));
      for (const detach of fixTaps) detach();
      fixTaps = [];
      checks.replaceChildren(...lines.map(lineItem));
      open = lines.filter((line) => line.ok !== true).length;
      if (open) disarm();
      else setLaunchFace();
      stats.replaceChildren(
        ...STAT_ROWS.map(([label, value]) => {
          const row = node('div');
          row.append(node('dt', null, label), node('dd', null, String(value(totals, context))));
          return row;
        }),
      );
    },
    dispose() {
      clearTimeout(timer);
      for (const detach of [detachLaunch, ...fixTaps, ...styleTaps]) detach();
      el.remove();
    },
  };
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
