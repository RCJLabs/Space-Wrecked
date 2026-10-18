// The job board: the work on offer in the district (src/sim/contracts.js),
// opened from the hangar. The jobs are listed down the left; the one picked
// shows on the right in full: who wants it, where, what it takes, the
// twist, who will be there, whom it is for and against (M33) and the pay,
// with what its client's side adds. A tap picks a job, and Take the
// job sends the crew: a tap shows it, a second one commits. The board
// changes only once a job is done or lost. A quest's job (M33b,
// quests.js questJobs) heads the list, tagged with its quest, and says
// which step of it it is and what doing it adds.
// On the run (M38c) it is a station's board (stationJobs.js), opened with
// Jobs at the station: its name and side over the jobs posted this visit,
// a squad going rather than the whole crew, with Squad to change who
// (squadCard.js, as a boarding's), and Chart back to the sector map. At a
// station of the pursuer's side the hint says they log the ship.
import { loadContent } from '../../platform/content.js';
import { palette } from '../../render/palette.js';
import { squadProblem } from '../../sim/crew.js';
import { huntersFor, pursuerOf, raidDue } from '../../sim/heat.js';
import { questJobs } from '../../sim/quests.js';
import { stationSide } from '../../sim/standing.js';
import { stationBoard, stationHere } from '../../sim/stationJobs.js';
import { tradeHeat } from '../../sim/travel.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { squadText } from './crewText.js';
import { jobText } from './jobText.js';
import { questJobText } from './questText.js';
import { createSquadCard } from './squadCard.js';
import { dockSaid, sideName } from './standingText.js';

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
    const squadButton = toolButton('jobs-squad', icons.crew, 'Squad');
    squadButton.hidden = true;
    const takeButton = toolButton('jobs-take', icons.next, 'Take the job');
    takeButton.disabled = true;
    foot.append(backButton, hint, squadButton, takeButton);
    const squadCard = createSquadCard({ toggle: pickMember, done: () => openSquad(false) });
    el.append(head, list, detail, squadCard.el, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let picked = 0;
    let shown = null; // the jobs the list shows: the quests' (M33b), then the board's
    let shownKey = ''; // which they are
    let quests = 0; // how many of them are the quests'
    let detailed = null; // the job the right side shows
    let rows = [];
    let atStation = false; // the board is a station's (M38c)
    let squad = null; // at a station, the crew ids picked to go, or null for the healthiest
    let squadOpen = false; // the squad card is up
    let squadWhy = null; // why the last pick changed nothing
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: atStation ? 'sector' : 'hub' })),
      onTap(squadButton, () => openSquad(!squadOpen)),
      onTap(takeButton, take),
      game.subscribe((state) => alive && render(state.campaign)),
      () => rows.forEach((row) => row.detach()),
      () => squadCard.detach(),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        const { campaign } = game.getState();
        if (campaign && !stationHere(campaign, defs) && (!campaign.board.length || campaign.shop === null)) game.dispatch({ type: 'campaign/board', rules: defs });
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function render(campaign) {
      if (!defs || !campaign) return;
      const station = stationHere(campaign, defs);
      if (Boolean(station) !== atStation) {
        atStation = Boolean(station);
        backButton.querySelector('svg').outerHTML = atStation ? icons.map : icons.home;
        setText(backButton.querySelector('span'), atStation ? 'Chart' : 'Hangar');
      }
      const side = station ? stationSide(station, defs) : null;
      setText(where, station ? `${station.name}${side ? ` · ${sideName(side, defs)}` : ''}` : defs.districts.get(defs.backgrounds.get(campaign.background)?.district)?.name ?? '');
      const offers = station ? [] : questJobs(campaign, defs);
      const listed = station ? stationBoard(campaign, defs) : [...offers, ...campaign.board];
      const key = listed.map((job) => `${job.contract}:${job.seed}`).join(',');
      if (key !== shownKey) {
        shownKey = key;
        shown = listed;
        quests = offers.length;
        picked = Math.min(picked, Math.max(0, shown.length - 1));
        build(shown);
      }
      // Who goes from a station: the squad, as a boarding's.
      const pick = station ? squadText(campaign, defs, squad) : null;
      if (!pick?.show) squadOpen = false;
      squadButton.hidden = !pick?.show;
      if (pick?.show) setText(squadButton.querySelector('span'), pick.label);
      squadButton.setAttribute('aria-expanded', String(squadOpen));
      squadButton.setAttribute('aria-label', pick?.show ? `${pick.label}: who goes` : 'Squad');
      squadCard.show(squadOpen ? pick : null, squadWhy);
      // Under the card, the board takes no taps or focus.
      list.inert = squadOpen;
      detail.inert = squadOpen;
      if (!shown.length) {
        detail.replaceChildren(node('p', 'jobs-none', 'No work on the board.'));
        takeButton.disabled = true;
        setText(hint, station ? 'Nothing more here this visit. Come back after a jump: the board changes.' : 'Check back after the next shift.');
        hint.dataset.tone = 'info';
        return;
      }
      rows.forEach((row, i) => row.button.setAttribute('aria-pressed', String(i === picked)));
      if (shown[picked] !== detailed) showJob(shown[picked]);
      const raid = !station && raidDue(campaign, defs);
      takeButton.disabled = raid || !jobText(shown[picked], defs);
      if (station) {
        // Wounds stay on the run, and the pursuer's own stations log the ship.
        const dock = dockSaid(campaign, defs, tradeHeat(campaign, defs));
        setText(hint, `${squadOpen ? pick.text : pick.line} Wounds stay on the run: only the med bay and patching up heal.${dock}`);
        hint.dataset.tone = dock ? 'warn' : 'info';
        return;
      }
      const hunted = huntersFor(campaign, defs).length > 0;
      setText(hint, raid ? 'Not with a raid at the door: back to the hangar.' : hunted ? pursuerOf(campaign, defs).levels.hunters : 'Pick a job to read it, then take it. The crew heals up at the hangar after.');
      hint.dataset.tone = raid ? 'bad' : hunted ? 'warn' : 'info';
    }

    // The pursuer's hunters, who join every job at the hangar once heat is
    // high, and none at a station.
    function hunters() {
      const { campaign } = game.getState();
      return campaign && !atStation ? huntersFor(campaign, defs) : [];
    }

    // A button a job: its title and twist, the mission and where, and the
    // pay.
    function build(board) {
      rows.forEach((row) => row.detach());
      rows = board.map((job, i) => {
        const words = jobText(job, defs, hunters(), game.getState().campaign) ?? GONE;
        const button = node('button', 'btn jobs-pick');
        button.type = 'button';
        const top = node('span', 'jobs-top');
        top.append(node('b', null, words.title));
        const quest = questJobText(job, defs);
        if (quest) {
          button.dataset.quest = job.quest;
          top.append(node('span', 'jobs-quest', quest.tag));
        } else if (words.twist) top.append(node('span', 'jobs-twist', words.twist.name));
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
      const words = jobText(job, defs, hunters(), game.getState().campaign);
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
      const quest = questJobText(job, defs);
      if (quest) fact('Quest', quest.fact);
      if (words.twist) fact('The twist', `${words.twist.name}. ${words.twist.text}`);
      fact('Against', words.against);
      if (words.sides) fact('Sides', words.sides);
      fact('Pays', words.bonus ? `${words.pay} (${words.bonus})` : words.pay);
      fact('Heat', words.heat);
      fact('Gear', words.gear?.replace(/^Win: /, ''));
      detail.replaceChildren(node('h2', null, words.title), node('p', 'jobs-who', `${words.who} · ${words.where}`), node('p', 'jobs-pitch', words.pitch), facts);
      detail.scrollTop = 0;
    }

    function take() {
      const job = shown?.[picked];
      if (!defs || !job) return;
      if (atStation) game.dispatch({ type: 'campaign/job/station', index: picked, squad, rules: defs });
      else if (job.quest) game.dispatch({ type: 'campaign/job/quest', quest: job.quest, rules: defs });
      else game.dispatch({ type: 'campaign/job/take', index: picked - quests, rules: defs });
    }

    // The squad card up or down (at a station).
    function openSquad(open) {
      if (!defs) return;
      squadOpen = open;
      squadWhy = null;
      render(game.getState().campaign);
    }

    // A tap on someone in the squad card: takes them, or leaves them
    // aboard, unless that would leave no one going or more than a squad
    // takes.
    function pickMember(id) {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      const going = squadText(campaign, defs, squad).members.filter((member) => member.going).map((member) => member.id);
      const next = going.includes(id) ? going.filter((each) => each !== id) : [...going, id];
      squadWhy = squadProblem(campaign.crew, next, defs);
      if (!squadWhy) squad = next;
      render(campaign);
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
