// The Ship tab: the flight checklist, with the fix for each failing line,
// the Launch button and the ship's totals. A fix that adds a part is a
// button that picks that part. Launch is locked while any line is open: a
// tap on it then just says what to fix. When it is ready, the first tap
// arms it and a second tap within ARM_MS launches.
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

// onLaunch() asks the session to launch; onFix(type) picks a part to add.
export function createShipPanel({ onLaunch, onFix }) {
  const el = node('div', 'bld-ship');
  const checks = node('ul', 'bld-checks');
  const launch = node('button', 'btn bld-launch');
  launch.type = 'button';
  const stats = node('dl', 'bld-stats');
  el.append(node('h3', null, 'Flight check'), checks, launch, node('h3', null, 'Ship'), stats);

  let open = 0; // lines still to pass
  let armedUntil = 0;
  let timer = 0;
  let fixTaps = [];

  const detachLaunch = onTap(launch, () => {
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
    if (line.fix && line.add) {
      const fix = node('button', 'btn bld-fix', line.fix);
      fix.type = 'button';
      fixTaps.push(onTap(fix, () => onFix(line.add)));
      body.append(fix);
    } else if (line.fix) {
      body.append(node('p', 'bld-check-fix', line.fix));
    }
    item.append(mark, body);
    return item;
  }

  return {
    el,
    // lines from flightChecklist, totals from shipStats, and { crew, maxModules }.
    update(lines, totals, context) {
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
      for (const detach of [detachLaunch, ...fixTaps]) detach();
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
