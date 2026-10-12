// The job board: the work on offer in the district (src/sim/contracts.js),
// opened from the hangar. The jobs are listed down the left; the one picked
// shows on the right in full: who wants it, where, what it takes, the
// twist, who will be there and the pay. A tap picks a job, and Take the
// job sends the crew: a tap shows it, a second one commits. The board
// changes only once a job is done or lost.
import { loadContent } from '../../platform/content.js';
import { palette } from '../../render/palette.js';
import { huntersFor, pursuerOf, raidDue } from '../../sim/heat.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { jobText } from './jobText.js';

// A job the content no longer has.
const GONE = { title: 'Gone', mission: 'No longer on offer', where: '', pay: '', heat: '', twist: null };

export const jobsScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'jobs');
    const head = node('header', 'jobs-head');
    const title = node('h1', null, 'Job board');
    const where = node('p', 'jobs-where');
    head.append(title, where);
    const list = node('div', 'jobs-list');
    const detail = node('article', 'jobs-detail');
    const foot = node('footer', 'jobs-foot');
    const backButton = toolButton('jobs-back', icons.home, 'Hangar');
    const hint = node('p', 'jobs-hint', 'Loading…');
    const takeButton = toolButton('jobs-take', icons.next, 'Take the job');
    takeButton.disabled = true;
    foot.append(backButton, hint, takeButton);
    el.append(head, list, detail, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let picked = 0;
    let shown = null; // the board the list shows
    let detailed = null; // the job the right side shows
    let rows = [];
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'hub' })),
      onTap(takeButton, take),
      game.subscribe((state) => alive && render(state.campaign)),
      () => rows.forEach((row) => row.detach()),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        const { campaign } = game.getState();
        if (campaign && !campaign.board.length) game.dispatch({ type: 'campaign/board', rules: defs });
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function render(campaign) {
      if (!defs || !campaign) return;
      setText(where, defs.districts.get(defs.backgrounds.get(campaign.background)?.district)?.name ?? '');
      if (campaign.board !== shown) {
        shown = campaign.board;
        picked = Math.min(picked, Math.max(0, shown.length - 1));
        build(shown);
      }
      if (!shown.length) {
        detail.replaceChildren(node('p', 'jobs-none', 'No work on the board.'));
        takeButton.disabled = true;
        setText(hint, 'Check back after the next shift.');
        return;
      }
      rows.forEach((row, i) => row.button.setAttribute('aria-pressed', String(i === picked)));
      if (shown[picked] !== detailed) showJob(shown[picked]);
      const raid = raidDue(campaign, defs);
      takeButton.disabled = raid || !jobText(shown[picked], defs);
      const hunted = huntersFor(campaign, defs).length > 0;
      setText(hint, raid ? 'Not with a raid at the door: back to the hangar.' : hunted ? pursuerOf(campaign, defs).levels.hunters : 'Pick a job to read it, then take it. The crew heals up at the hangar after.');
      hint.dataset.tone = raid ? 'bad' : hunted ? 'warn' : 'info';
    }

    // The pursuer's hunters, who join every job once heat is high.
    function hunters() {
      const { campaign } = game.getState();
      return campaign ? huntersFor(campaign, defs) : [];
    }

    // A button a job: its title and twist, the mission and where, and the
    // pay.
    function build(board) {
      rows.forEach((row) => row.detach());
      rows = board.map((job, i) => {
        const words = jobText(job, defs, hunters()) ?? GONE;
        const button = node('button', 'btn jobs-pick');
        button.type = 'button';
        const top = node('span', 'jobs-top');
        top.append(node('b', null, words.title));
        if (words.twist) top.append(node('span', 'jobs-twist', words.twist.name));
        button.append(top, node('span', null, [words.mission, words.where].filter(Boolean).join(' · ')), node('span', 'jobs-pay', [words.pay, words.heat].filter(Boolean).join(' · ')));
        return { button, detach: onTap(button, () => pick(i)) };
      });
      list.replaceChildren(...rows.map((row) => row.button));
    }

    function pick(i) {
      if (i === picked) return;
      picked = i;
      render(game.getState().campaign);
    }

    function showJob(job) {
      detailed = job;
      const words = jobText(job, defs, hunters());
      if (!words) {
        detail.replaceChildren(node('h2', null, GONE.title), node('p', 'jobs-who', 'The game has changed since this board went up. The next board has new work.'));
        return;
      }
      const facts = node('dl', 'jobs-facts');
      const fact = (label, value) => {
        const row = node('div');
        row.append(node('dt', null, label), node('dd', null, value));
        facts.append(row);
      };
      fact('The job', words.brief);
      if (words.twist) fact('The twist', `${words.twist.name}. ${words.twist.text}`);
      fact('Against', words.against);
      fact('Pays', words.pay);
      fact('Heat', words.heat);
      detail.replaceChildren(node('h2', null, words.title), node('p', 'jobs-who', `${words.who} · ${words.where}`), node('p', 'jobs-pitch', words.pitch), facts);
      detail.scrollTop = 0;
    }

    function take() {
      if (!defs || !shown?.[picked]) return;
      game.dispatch({ type: 'campaign/job/take', index: picked, rules: defs });
    }

    let painted = false;
    return {
      resize() {
        painted = false;
      },
      // Nothing on the canvas: the board is all panels.
      draw(ctx, view) {
        if (painted) return;
        painted = true;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
