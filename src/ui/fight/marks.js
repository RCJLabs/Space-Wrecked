// A job's objective on the Fight screen's board (M38): the tags over its
// tiles (render/fightLabels.js marks) and the tiles outlined on the deck
// (render/units.js zonesScene). Pure: a battle in, plain data out.
import { objectiveDone } from '../../sim/battle.js';

// The tags: one over each crate to grab, and over the terminal, saying how
// far along it is (M14); since M38, each crate to carry out (one in hand is
// its carrier's word), the way out with the crates out, the far gate, each
// target with the charge by it, and the way in held with the rounds.
// [{ at: [x, y], text, done, tone? }].
export function objectiveMarks(battle) {
  const { objective } = battle;
  const has = (list, [x, y]) => list.some(([tx, ty]) => tx === x && ty === y);
  const done = objectiveDone(objective);
  switch (objective?.type) {
    case 'grab':
      return objective.crates.map((at) => (has(objective.taken, at) ? { at, text: 'GOT IT', done: true } : { at, text: 'GRAB', done: false }));
    case 'hack':
      return [{ at: objective.at, text: `HACK ${Math.min(objective.progress, objective.turns)}/${objective.turns}`, done }];
    case 'extract':
      return [
        ...objective.crates.filter((at) => !has(objective.taken, at)).map((at) => ({ at, text: 'CRATE', done: false })),
        { at: middleTile(objective.exits), text: `WAY OUT ${objective.out.length}/${objective.crates.length}`, done },
      ];
    case 'escort':
      return [{ at: middleTile(objective.exits), text: 'FAR GATE', done }];
    case 'rescue':
      return [{ at: middleTile(objective.exits), text: 'WAY OUT', done }];
    case 'sabotage':
      return objective.targets.map((at) => {
        if (has(objective.blown, at)) return { at, text: 'BLOWN', done: true };
        if (has(objective.charges.map((charge) => charge.at), at)) return { at, text: 'CHARGE SET', done: false, tone: 'charge' };
        return { at, text: 'TARGET', done: false };
      });
    case 'defend':
      return [{ at: middleTile(objective.line), text: `HOLD ${Math.min(battle.round, objective.rounds)}/${objective.rounds}`, done }];
    default:
      return [];
  }
}

// The tiles outlined on the deck: the way out of an extract or a rescue,
// the far gate, the way in held. [{ tiles, tone }], tone 'out' or 'hold'.
export function objectiveZones(objective) {
  switch (objective?.type) {
    case 'extract':
    case 'escort':
    case 'rescue':
      return [{ tiles: objective.exits, tone: 'out' }];
    case 'defend':
      return [{ tiles: objective.line, tone: 'hold' }];
    default:
      return [];
  }
}

// Of a zone's tiles, the one nearest their middle: where its tag goes.
export function middleTile(tiles) {
  const [mx, my] = [tiles.reduce((sum, [x]) => sum + x, 0) / tiles.length, tiles.reduce((sum, [, y]) => sum + y, 0) / tiles.length];
  return tiles.reduce((best, at) => (Math.hypot(at[0] - mx, at[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? at : best));
}
