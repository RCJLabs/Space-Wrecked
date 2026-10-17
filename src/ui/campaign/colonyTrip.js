// The colony's trips (M28, src/sim/expeditions.js), for the colony screen's
// right-hand panel (colony.js). Browsing, the places within reach head the
// build list, a row each. A tap on one plans a trip there: the place, the
// squad picked (a tap on someone takes them or leaves them home), the days
// and what they eat, the flight checks with the squad aboard, and Fly out
// in two taps, the first saying what it will come to or why it can't go.
// While the ship is away the panel is where the squad is: the place's
// event, each choice two taps (the first shows its odds), or the
// squatters' derelict with Board her in two taps; then what came of it,
// and Fly home in two taps. Each leg's days pass as it flies, and the hint
// gives their report. A raid's lander coming down on the way (M29) stops
// the leg: once those at home have faced it (Defend, in colony.js's foot),
// Fly on flies the rest, in two taps. Its words are tripText.js's.
//
// trips = createTrips(ctx), with the screen's:
//   game, defs()                    the store, and the content once loaded
//   rowButton, actionRow, list      colony.js's buttons for the panel
//   keep(detach)                    a button's tap to let go of with them
//   armed(), arm(what), disarm()    the screen's two-tap state
//   say(words)                      what the hint says next ({ text, tone })
//   refresh()                       draws the screen again
// trips.planning()                  true while a trip is being planned
// trips.placesSection(campaign)     the places within reach, for browsing
// trips.planPanel(campaign)         the panel while planning
// trips.awayPanel(campaign)         the panel while the ship is away
// trips.hint(campaign)              what an armed tap of the trips says, or
//                                   null
// trips.cancel()                    back from planning
import { defaultSquad } from '../../sim/crew.js';
import { chooseAtPlace, flyHome, flyOn, flyOut, tripPlan } from '../../sim/expeditions.js';
import { node } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { shortNames } from '../names.js';
import { faceUrl, portraitImg } from '../portrait.js';
import { awayText, legReport, placesText, planText, squadRows } from './tripText.js';

export function createTrips(ctx) {
  const { game, defs, rowButton, actionRow, list, armed, arm, disarm, say, refresh } = ctx;
  // The trip being planned: { index, squad (crew ids) }, or null.
  let pick = null;

  const trips = {
    planning: () => pick !== null,
    cancel() {
      pick = null;
    },

    placesSection(campaign) {
      const rows = placesText(campaign, defs());
      if (!rows.length) return [];
      return [node('h2', null, 'Fly out'), list(rows.map((row) => rowButton(row.name, row.line, true, () => plan(row.index))))];
    },

    planPanel(campaign) {
      const { index, squad } = pick;
      const rules = defs();
      const plan = tripPlan(campaign, rules, index, squad);
      const words = planText(plan, campaign, rules);
      const about = node('p', 'cln-placing', words.title);
      about.append(...words.lines.map((line, i) => {
        const small = node('small', null, line);
        if (i >= 2 && !plan.ok) small.dataset.tone = 'bad';
        return small;
      }));
      // The buttons under the plan, so Fly out is in view on a short
      // screen; the squad below them.
      return [
        node('h2', null, 'Fly out'),
        about,
        actionRow([
          ['Fly out', icons.launch, () => tapFly(campaign), armed() === 'fly' ? 'cln-confirm cln-armed' : 'cln-confirm', plan.ok],
          ['Refit', icons.build, () => game.dispatch({ type: 'screen/show', screen: 'construction' }), null, true],
          ['Back', icons.prev, () => back(), null, true],
        ]),
        node('h2', null, `Squad · ${squad.length} of up to ${rules.balance.squadSize}`),
        squadList(campaign, rules, squad),
      ];
    },

    awayPanel(campaign) {
      const rules = defs();
      const away = awayText(campaign, rules);
      const head = node('p', 'cln-placing', away.title);
      head.append(node('small', null, away.leg?.line ?? away.where), node('small', null, `Aboard: ${away.squad}`));
      const nodes = [node('h2', null, 'Away'), head];
      // A leg a raid stopped: nothing to do but fly on, once it is faced.
      if (away.on) {
        if (away.result) {
          const result = node('p', 'cln-placing', away.result.title);
          result.append(node('small', null, away.result.text));
          nodes.push(result);
        }
        nodes.push(actionRow([['Fly on', away.leg.dir === 'out' ? icons.launch : icons.home, () => tapOn(), armed() === 'on' ? 'cln-confirm cln-armed' : 'cln-confirm', away.on.ok]]));
        return nodes;
      }
      if (away.event) {
        const event = node('p', 'cln-placing', away.event.title);
        event.append(node('small', null, away.event.text));
        nodes.push(event, list(away.event.choices.map((choice) => choiceButton(choice))));
      }
      if (away.held) {
        const held = node('p', 'cln-placing', 'Squatters');
        held.append(...away.held.lines.map((line) => node('small', null, line)));
        nodes.push(held);
      }
      if (away.result) {
        const result = node('p', 'cln-placing', away.result.title);
        result.append(node('small', null, away.result.text));
        nodes.push(result);
      }
      const actions = [];
      if (away.held) actions.push(['Board her', icons.door, () => tapBoard(campaign), armed() === 'board' ? 'cln-confirm cln-armed' : 'cln-confirm', true]);
      actions.push(['Fly home', icons.home, () => tapHome(campaign), armed() === 'home' ? 'cln-armed' : null, away.home.ok]);
      nodes.push(actionRow(actions));
      return nodes;
    },

    hint(campaign) {
      const what = armed();
      const rules = defs();
      if (what === 'fly' && pick) return { text: planText(tripPlan(campaign, rules, pick.index, pick.squad), campaign, rules).ask, tone: 'warn' };
      if (what === 'home') return { text: awayText(campaign, rules)?.home.ask ?? '', tone: 'warn' };
      if (what === 'on') return { text: awayText(campaign, rules)?.on?.ask ?? '', tone: 'warn' };
      if (what === 'board') return { text: awayText(campaign, rules)?.held?.ask ?? '', tone: 'warn' };
      if (what?.startsWith('choice:')) {
        const choice = awayText(campaign, rules)?.event?.choices.find((entry) => `choice:${entry.id}` === what);
        return choice ? { text: choice.ask, tone: 'warn' } : null;
      }
      if (pick) {
        const words = planText(tripPlan(campaign, rules, pick.index, pick.squad), campaign, rules);
        return words.ok ? { text: `${words.title}: tap Fly out to see what it comes to, or change the squad.`, tone: 'info' } : { text: words.why ?? '', tone: 'warn' };
      }
      const away = awayText(campaign, rules);
      if (away?.on) return away.on.ok ? { text: `The raid is faced: fly on ${away.leg.dir === 'out' ? `to ${away.title}` : 'home'} when ready.`, tone: 'info' } : null;
      if (away?.event) return { text: `The squad is at ${away.title}: choose what it does there.`, tone: 'info' };
      if (away?.held) return { text: `Squatters hold ${away.title}: board her, or fly home and leave her be.`, tone: 'info' };
      if (away) return { text: `The squad is done at ${away.title}: fly home when ready.`, tone: 'info' };
      return null;
    },
  };

  // A tap on a place: its plan, with the healthiest squad the size allows.
  function plan(index) {
    const { campaign } = game.getState();
    if (!campaign) return;
    disarm();
    say(null);
    pick = { index, squad: defaultSquad(campaign.crew, defs()) };
    refresh();
  }

  function back() {
    disarm();
    say(null);
    pick = null;
    refresh();
  }

  // The crew as buttons, ticked when they go: a tap takes them or leaves
  // them home.
  function squadList(campaign, rules, squad) {
    const rows = squadRows(campaign, rules, squad);
    const short = shortNames(rows.map((row) => row.name));
    const ul = node('ul', 'cln-squad');
    for (const [i, member] of rows.entries()) {
      const item = node('li');
      const button = node('button', 'btn apr-pick');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(member.going));
      const box = node('span', 'apr-pick-box', member.going ? '✓' : '');
      box.setAttribute('aria-hidden', 'true');
      const who = node('span', 'hgr-name');
      who.append(node('span', null, short[i]));
      who.title = member.name;
      if (member.about) who.append(node('small', null, member.about));
      button.dataset.wounded = String(member.hp < member.max);
      const face = portraitImg('crew-face', faceUrl(member.face, 'face'));
      button.append(box, face, who, node('span', 'hgr-num', `${member.hp}/${member.max}`));
      button.setAttribute('aria-label', `${member.name}, ${member.hp} of ${member.max} hit points: ${member.going ? 'going' : 'staying home'}`);
      ctx.keep(onTap(button, () => toggle(member.id)));
      item.append(button);
      ul.append(item);
    }
    return ul;
  }

  function toggle(id) {
    const { campaign } = game.getState();
    if (!campaign || !pick) return;
    disarm();
    const size = defs().balance.squadSize;
    const going = pick.squad.includes(id);
    if (!going && pick.squad.length >= size) {
      say({ text: `A squad is ${size} at most: leave someone home first.`, tone: 'warn' });
      refresh();
      return;
    }
    say(null);
    const squad = going ? pick.squad.filter((other) => other !== id) : [...pick.squad, id];
    pick = { ...pick, squad: campaign.crew.filter((member) => squad.includes(member.id)).map((member) => member.id) };
    refresh();
  }

  // Fly out: the first tap says what the trip comes to; the second flies.
  function tapFly(campaign) {
    if (!pick) return;
    if (armed() !== 'fly') {
      say(null);
      arm('fly');
      return;
    }
    disarm();
    const rules = defs();
    const result = flyOut(campaign, rules, pick.index, pick.squad);
    const { index, squad } = pick;
    pick = null;
    say(result.ok ? legReport(result, 'out', campaign, rules) : { text: result.error, tone: 'bad' });
    game.dispatch({ type: 'campaign/trip/out', index, squad, rules });
    refresh();
  }

  // A choice at the place: the first tap shows its odds, the second makes it.
  function choiceButton(choice) {
    const key = `choice:${choice.id}`;
    const item = node('li');
    const button = node('button', 'btn sct-choice');
    button.type = 'button';
    button.disabled = !choice.ok;
    button.dataset.armed = String(armed() === key);
    button.append(node('span', null, armed() === key ? `${choice.label}?` : choice.label));
    // Who in the squad takes it (M36) and its odds, or why not.
    const small = choice.why ?? [choice.taker, choice.odds].filter(Boolean).join(' · ');
    if (small) button.append(node('small', null, small));
    button.setAttribute('aria-label', choice.ok ? choice.ask.replace(' Tap again to choose.', '') : `${choice.label}. ${choice.why}`);
    ctx.keep(onTap(button, () => tapChoice(choice, key)));
    item.append(button);
    return item;
  }

  function tapChoice(choice, key) {
    const { campaign } = game.getState();
    if (!campaign || !choice.ok) return;
    if (armed() !== key) {
      say(null);
      arm(key);
      return;
    }
    disarm();
    const rules = defs();
    const result = chooseAtPlace(campaign, rules, choice.id);
    // A trap (M36): the place is held now, and the squad is in it.
    const trapped = result.ok && result.result.changes.ambush;
    say(!result.ok ? { text: result.error, tone: 'bad' } : trapped ? { text: 'A trap: they were waiting. Board her, or fly home and leave her be.', tone: 'bad' } : { text: 'Done. Fly home when ready.', tone: 'good' });
    game.dispatch({ type: 'campaign/trip/choose', choice: choice.id, rules });
    refresh();
  }

  // Board her: two taps, then the fight's screen.
  function tapBoard() {
    if (armed() !== 'board') {
      say(null);
      arm('board');
      return;
    }
    disarm();
    say(null);
    game.dispatch({ type: 'campaign/trip/board', rules: defs() });
  }

  // Fly on, with the leg a raid stopped: the first tap says the days still
  // to fly and what they eat; the second flies them.
  function tapOn() {
    if (armed() !== 'on') {
      say(null);
      arm('on');
      return;
    }
    disarm();
    const { campaign } = game.getState();
    const rules = defs();
    const result = flyOn(campaign, rules);
    say(result.ok ? legReport(result, result.dir, campaign, rules) : { text: result.error, tone: 'bad' });
    game.dispatch({ type: 'campaign/trip/on', rules });
    refresh();
  }

  // Fly home: the first tap says what the days back eat; the second flies.
  function tapHome(campaign) {
    if (armed() !== 'home') {
      say(null);
      arm('home');
      return;
    }
    disarm();
    const rules = defs();
    const result = flyHome(campaign, rules);
    say(result.ok ? legReport(result, 'home', campaign, rules) : { text: result.error, tone: 'bad' });
    game.dispatch({ type: 'campaign/trip/home', rules });
    refresh();
  }

  return trips;
}
