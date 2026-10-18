// The colony's voyages (M38d, src/sim/voyage.js), for the colony screen's
// right-hand panel (colony.js). Browsing, Voyage heads the build list, and
// a tap on it plans one. The plan: who goes and who stays, the healthiest
// that fit aboard picked first with one left at home (a tap on someone
// takes them or leaves them home); what the holds take and the colony
// keeps of the food, and what spoils; the jump into the next system; the
// flight checks with them aboard; and Fly out in two taps, the first
// saying what it will come to or why the ship can't go. Flown, the chart
// opens on a system past the colony's (sector.js). Its words are
// voyageText.js's. From M38e the crew's other colonies follow it, each
// with where it lies, its day, food, who is there and its raid: a tap on
// one plans a flight there, the crew picked as for Fly out, and Fly to in
// two taps flies straight there (src/sim/voyage.js flyFrom), its words
// colonyListText.js's.
//
// voyages = createVoyages(ctx), with the screen's, as colonyTrip.js has
// them:
//   game, defs()                    the store, and the content once loaded
//   rowButton, actionRow, list      colony.js's buttons for the panel
//   keep(detach)                    a button's tap to let go of with them
//   armed(), arm(what), disarm()    the screen's two-tap state
//   say(words)                      what the hint says next ({ text, tone })
//   refresh()                       draws the screen again
//   cancelTrips()                   back from planning a trip
// voyages.planning()                true while a voyage or a flight is being
//                                   planned
// voyages.section(campaign)         Voyage and the other colonies, for
//                                   browsing
// voyages.planPanel(campaign)       the panel while planning
// voyages.hint(campaign)            what the hint says while planning, or
//                                   null
// voyages.cancel()                  back from planning
import { flyFrom, voyageOut, voyagePlan } from '../../sim/voyage.js';
import { node } from '../fight/panels.js';
import { icons } from '../icons.js';
import { flightFromText, flightReport, otherColonies } from './colonyListText.js';
import { pickList } from './colonyTrip.js';
import { squadRows } from './tripText.js';
import { firstVoyagers, outText, voyageReport } from './voyageText.js';

export function createVoyages(ctx) {
  const { game, defs, rowButton, actionRow, list, armed, arm, disarm, say, refresh } = ctx;
  // The crew picked to go (ids, in the crew's order), or null; and the
  // colony a flight is for (M38e), or null for a voyage.
  let crew = null;
  let to = null;

  // The plan's words: Fly out's, or Fly to's.
  const wordsOf = (campaign, rules) => (to === null ? outText(voyagePlan(campaign, rules, crew), campaign, rules) : flightFromText(campaign, rules, to, crew));

  const voyages = {
    planning: () => crew !== null,
    cancel() {
      crew = null;
      to = null;
    },

    section(campaign) {
      const rules = defs();
      const ready = voyagePlan(campaign, rules, firstVoyagers(campaign, rules));
      const why = ready.crew ? null : ready.error;
      const sections = [node('h2', null, 'Voyage'), list([rowButton(`Past ${campaign.run.sector.name}`, why ?? 'The run goes on: systems nobody has charted, a day here for each jump', !why, () => plan(null))])];
      const others = otherColonies(campaign, rules);
      if (others.length) sections.push(node('h2', null, 'Colonies'), list(others.map((other) => rowButton(other.name, why ?? other.detail, !why, () => plan(other.id)))));
      return sections;
    },

    planPanel(campaign) {
      const rules = defs();
      const words = wordsOf(campaign, rules);
      const about = node('p', 'cln-placing', words.title);
      about.append(...words.lines.map((line, i) => {
        const small = node('small', null, line);
        if (i >= words.lines.length - words.bad) small.dataset.tone = 'bad';
        return small;
      }));
      // The buttons under the plan, so Fly out is in view on a short
      // screen; the crew below them.
      return [
        node('h2', null, to === null ? 'Voyage' : 'Flight'),
        about,
        actionRow([
          [to === null ? 'Fly out' : 'Fly to', icons.launch, () => tapFly(), armed() === 'voyage' ? 'cln-confirm cln-armed' : 'cln-confirm', words.ok],
          ['Refit', icons.build, () => game.dispatch({ type: 'screen/show', screen: 'construction' }), null, true],
          ['Back', icons.prev, () => back(), null, true],
        ]),
        node('h2', null, `Aboard · ${crew.length} of ${campaign.crew.length}`),
        pickList(squadRows(campaign, rules, crew), ctx.keep, toggle),
      ];
    },

    hint(campaign) {
      if (!crew) return null;
      const rules = defs();
      const words = wordsOf(campaign, rules);
      if (armed() === 'voyage') return { text: words.ask ?? words.why ?? '', tone: 'warn' };
      return words.ok ? { text: `Pick who goes; the rest stay here. Tap ${to === null ? 'Fly out' : 'Fly to'} to see what it comes to.`, tone: 'info' } : { text: words.why ?? '', tone: 'warn' };
    },
  };

  // A tap on Voyage, or on another colony (M38e: id): its plan, with the
  // first pick aboard.
  function plan(id) {
    const { campaign } = game.getState();
    if (!campaign) return;
    disarm();
    say(null);
    ctx.cancelTrips();
    crew = firstVoyagers(campaign, defs());
    to = id;
    refresh();
  }

  function back() {
    disarm();
    say(null);
    crew = null;
    to = null;
    refresh();
  }

  function toggle(id) {
    const { campaign } = game.getState();
    if (!campaign || !crew) return;
    disarm();
    say(null);
    const going = crew.includes(id) ? crew.filter((other) => other !== id) : [...crew, id];
    crew = campaign.crew.filter((member) => going.includes(member.id)).map((member) => member.id);
    refresh();
  }

  // Fly out, or Fly to (M38e): the first tap says what it comes to; the
  // second flies, and the chart opens, or for a flight the colony it lands
  // at, or where a lander stopped it.
  function tapFly() {
    if (!crew) return;
    if (armed() !== 'voyage') {
      say(null);
      arm('voyage');
      return;
    }
    disarm();
    const { campaign } = game.getState();
    const rules = defs();
    const picked = crew;
    const id = to;
    crew = null;
    to = null;
    if (id === null) {
      const result = voyageOut(campaign, rules, picked);
      say(result.ok ? voyageReport(result, campaign, rules) : { text: result.error, tone: 'bad' });
      game.dispatch({ type: 'campaign/voyage/out', crew: picked, rules });
    } else {
      const result = flyFrom(campaign, rules, id, picked);
      say(result.ok ? flightReport(result, campaign, rules) : { text: result.error, tone: 'bad' });
      game.dispatch({ type: 'campaign/colony/fly', id, crew: picked, rules });
    }
    refresh();
  }

  return voyages;
}
