// The companions' chains for tests (M33c): each side's chain, a campaign on
// the run at any event, and one at a chain's step in the next sector.
import { chooseEvent } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { beginRun, leaveSector } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

// Each side's chain: its start's event and choice, its step's event, the
// choice that signs the companion on, the one that does it without them,
// the one that ends it, and the companion.
export const CHAINS = {
  tender: { start: ['fleet-tender', 'help'], step: 'storespod', join: 'tagjoin', done: 'tag', cold: 'strip', companion: 'varga' },
  foodrun: { start: ['coop-barge', 'fund'], step: 'foodrun', join: 'carryjoin', done: 'carry', cold: 'take', companion: 'brandt' },
  lifepod: { start: ['survey-skiff', 'tow'], step: 'lifepod', join: 'signon', done: 'drop', cold: 'report', companion: 'osei' },
  runner: { start: ['halloran-drop', 'call'], step: 'runner', join: 'towjoin', done: 'tow', cold: 'rob', companion: 'halloran' },
};

// A fight's battle with `side` the winner.
export const winner = (campaign, side) => ({ ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, winner: side } } });

// The ship moved to node `id`, seen.
export const moveTo = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });

// On the run, the holds and the purse full enough for any choice.
export const onRun = () => ({ ...beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign, supplies: 20, credits: 100 });

// The ship at a node holding event `id`.
export function atEvent(campaign, id) {
  const node = campaign.run.sector.nodes.find((n) => !['start', 'exit', 'station'].includes(n.type) && !n.quest).id;
  const nodes = campaign.run.sector.nodes.map((n) => (n.id === node ? { ...n, type: rules.events.get(id).kind, event: id, hostile: undefined } : n));
  return moveTo({ ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes } } }, node);
}

// From the chain's start, on into the next sector, at its step's node.
export function atStep(chain) {
  const started = chooseEvent(atEvent(onRun(), CHAINS[chain].start[0]), rules, CHAINS[chain].start[1]).campaign;
  const exit = moveTo({ ...started, run: { ...started.run, sector: { ...started.run.sector, index: 1 } } }, started.run.sector.exit);
  const next = leaveSector(exit, rules).campaign;
  const node = next.run.sector.nodes.find((n) => n.quest === chain);
  return moveTo(next, node.id);
}
