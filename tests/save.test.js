import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../src/config.js';
import { checksum, toBase64Url } from '../src/core/codec.js';
import {
  exportSave,
  importSave,
  makeSave,
  migrate,
  MIGRATIONS,
  parseSave,
  SAVE_VERSION,
  SaveError,
  validate,
} from '../src/core/save.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { emptyBuilds, MAX_SLOTS } from '../src/sim/builds.js';
import { defaultSettings } from '../src/sim/settings.js';
import { indexDefs } from '../src/sim/defs.js';
import { logFor, logMatches } from '../src/sim/replay.js';
import { readData } from '../tools/data.js';

const PREFIX = config.appId;
const sample = () => makeSave(saveData(initialState(123456)));

// A code with a correct checksum around any version text and payload.
function craft(versionText, payload) {
  const body = `${PREFIX}.${versionText}.${payload}`;
  return `${body}.${checksum(body)}`;
}
const craftSave = (save) => craft(String(save.version), toBase64Url(JSON.stringify(save)));

test('export then import round-trips the save', () => {
  const save = sample();
  const result = importSave(exportSave(save));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, save);
});

test('a code is prefix, version, base64url JSON and checksum', () => {
  const code = exportSave(sample());
  assert.match(code, new RegExp(`^${PREFIX}\\.${SAVE_VERSION}\\.[A-Za-z0-9_-]+\\.[0-9a-f]{8}$`));
});

test('import ignores whitespace and line breaks added by chat apps', () => {
  const code = exportSave(sample());
  const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 41)} \r\n${code.slice(41)}\n`;
  assert.equal(importSave(mangled).ok, true);
});

test('non-ASCII text survives the code', () => {
  const save = { version: SAVE_VERSION, data: { name: 'Zoë 船 🚀' } };
  const result = importSave(exportSave(save), { validate: () => [] });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, save);
});

test('a stored JSON save loads through parseSave', () => {
  const save = sample();
  const result = parseSave(JSON.stringify(save));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, save);
});

test('bad import text fails with a clear message and never throws', () => {
  const code = exportSave(sample());
  const payload = code.split('.')[2];
  const flipped = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
  const cases = [
    ['empty', '', /Paste a save code/],
    ['only whitespace', ' \n\t ', /Paste a save code/],
    ['random text', 'hello there', /isn't a save code for this game/],
    ['another prefix', 'xx.0.abc.12345678', /isn't a save code for this game/],
    ['truncated', code.slice(0, -12), /incomplete/],
    ['extra text', `${code}.more`, /incomplete or has extra text/],
    ['one character changed', flipped, /checksum/],
    ['checksum replaced', `${code.slice(0, -8)}zzzzzzzz`, /checksum/],
    ['unreadable version', craft('x', payload), /version number/],
    ['payload not base64url', craft('0', 'a@b'), /can't be read/],
    ['payload not JSON', craft('0', toBase64Url('not json')), /can't be read/],
    ['payload is null', craft('0', toBase64Url('null')), /version doesn't match/],
    ['version mismatch', craft('0', toBase64Url(JSON.stringify({ version: 1, data: {} }))), /version doesn't match/],
    ['newer than the game', craftSave({ version: 99, data: {} }), /newer version/],
    ['invalid data', craftSave({ version: 0, data: { settings: { fpsCap: 60 }, rng: -5 } }), /damaged.*RNG/],
    ['missing data', craftSave({ version: 0 }), /damaged.*no data/],
    [null, null, /Paste a save code/],
  ];
  for (const [name, text, expected] of cases) {
    let result;
    assert.doesNotThrow(() => (result = importSave(text)), `case: ${name}`);
    assert.equal(result.ok, false, `case: ${name} should fail`);
    assert.match(result.error, expected, `case: ${name}`);
  }
});

test('a broken stored save fails cleanly', () => {
  for (const text of ['', '{', 'null', '[]', '{"version":"0"}']) {
    const result = parseSave(text);
    assert.equal(result.ok, false, `input ${JSON.stringify(text)}`);
    assert.equal(typeof result.error, 'string');
  }
});

// Listed out of order on purpose: steps run by version, not by list position.
const steps = [
  { from: 2, up: (d) => ({ ...d, trail: `${d.trail}c` }) },
  { from: 0, up: (d) => ({ ...d, trail: `${d.trail}a` }) },
  { from: 1, up: (d) => ({ ...d, trail: `${d.trail}b` }) },
];

test('migrations run in version order, starting from the save version', () => {
  const options = { migrations: steps, target: 3 };
  assert.deepEqual(migrate({ version: 0, data: { trail: '' } }, options), { version: 3, data: { trail: 'abc' } });
  assert.deepEqual(migrate({ version: 1, data: { trail: '' } }, options), { version: 3, data: { trail: 'bc' } });
  assert.deepEqual(migrate({ version: 3, data: { trail: 'x' } }, options), { version: 3, data: { trail: 'x' } });
});

test('migrate leaves its input alone', () => {
  const save = { version: 0, data: { trail: '', nested: { n: 1 } } };
  const before = structuredClone(save);
  migrate(save, { migrations: [{ from: 0, up: (d) => ((d.nested.n = 2), d) }], target: 1 });
  assert.deepEqual(save, before);
});

test('a missing migration step fails with a clear error', () => {
  assert.throws(
    () => migrate({ version: 0, data: {} }, { migrations: [steps[1]], target: 2 }),
    (err) => err instanceof SaveError && /No migration from save v1 to v2/.test(err.message),
  );
});

test('a save newer than the game is refused, not downgraded', () => {
  assert.throws(() => migrate({ version: 4, data: {} }, { migrations: steps, target: 3 }), SaveError);
});

test('loading runs parse, then migrate, then validate', () => {
  const old = craftSave({ version: 0, data: { trail: '' } });
  const options = {
    migrations: steps,
    target: 3,
    validate: (save) => (save.data.trail === 'abc' ? [] : [`not migrated: ${save.data.trail}`]),
  };
  const result = importSave(old, options);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, { version: 3, data: { trail: 'abc' } });

  const failing = importSave(old, { ...options, validate: () => ['Bad field.'] });
  assert.equal(failing.ok, false);
  assert.match(failing.error, /Bad field/);
});

test('a migration that throws becomes an error message', () => {
  const boom = [{ from: 0, up: () => { throw new Error('boom'); } }];
  const result = parseSave(JSON.stringify({ version: 0, data: {} }), { migrations: boom, target: 1, validate: () => [] });
  assert.equal(result.ok, false);
  assert.match(result.error, /boom/);
});

test('the shipped migrations line up with SAVE_VERSION', () => {
  for (let v = 0; v < SAVE_VERSION; v++) {
    assert.equal(MIGRATIONS.filter((m) => m.from === v).length, 1, `exactly one migration from v${v}`);
  }
  assert.equal(MIGRATIONS.filter((m) => m.from >= SAVE_VERSION).length, 0);
});

test('validate accepts a fresh save and names what is wrong with a bad one', () => {
  assert.deepEqual(validate(sample()), []);
  const problems = validate({ version: SAVE_VERSION, data: { settings: { ...defaultSettings(), fpsCap: 45 }, rng: 1, builds: emptyBuilds(), campaign: null } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /frame cap/);
});

const ship = {
  frame: 'starter',
  modules: [
    { uid: 1, type: 'bridge', x: 5, y: 1, rot: 0 },
    { uid: 3, type: 'corridor', x: 4, y: 1, rot: 0 },
  ],
  nextUid: 4,
};
const tidy = {
  frame: 'starter',
  modules: [
    { uid: 1, type: 'bridge', x: 5, y: 1, rot: 0 },
    { uid: 2, type: 'corridor', x: 4, y: 1, rot: 0 },
  ],
  nextUid: 3,
};
const log = [
  { op: 'place', uid: 1, type: 'bridge', x: 5, y: 1, rot: 0 },
  { op: 'place', uid: 2, type: 'corridor', x: 4, y: 1, rot: 0 },
];
const withBuilds = (builds) => makeSave({ ...saveData(initialState(9)), builds });

test('a save from before M3 (v0) loads with no ships', () => {
  const old = { version: 0, data: { settings: { fpsCap: 30 }, rng: 77 } };
  const result = parseSave(JSON.stringify(old));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, { version: SAVE_VERSION, data: { settings: { ...defaultSettings(), fpsCap: 30 }, rng: 77, builds: emptyBuilds(), campaign: null } });
  assert.equal(importSave(craftSave(old)).ok, true, 'an old export code imports too');
});

// tidy and its log after M5b's move to the fine grid: twice the
// coordinates, 5 right and 3 down.
const fine = {
  ...tidy,
  modules: [
    { uid: 1, type: 'bridge', x: 15, y: 5, rot: 0 },
    { uid: 2, type: 'corridor', x: 13, y: 5, rot: 0 },
  ],
};
const fineLog = [
  { op: 'place', uid: 1, type: 'bridge', x: 15, y: 5, rot: 0 },
  { op: 'place', uid: 2, type: 'corridor', x: 13, y: 5, rot: 0 },
];
// ...and from save version 16 (M23d), with the default hull style, and
// from 17 (M23f) with the yard's paint and trim and no styling pieces.
const fineStyled = { ...fine, hull: 'rounded', paint: 'slate', trim: 'sky', styling: [] };

test("an M3 save's ship (v1) becomes slot 1, numbered in build order, with a log that builds it", () => {
  const v1 = { version: 1, data: { settings: { fpsCap: 60 }, rng: 5, ship } };
  const result = parseSave(JSON.stringify(v1));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save.data, { settings: defaultSettings(), rng: 5, builds: { active: 0, slots: [{ name: 'Ship 1', ship: fineStyled, log: fineLog }] }, campaign: null });
  const none = parseSave(JSON.stringify({ version: 1, data: { settings: { fpsCap: 60 }, rng: 5, ship: null } }));
  assert.deepEqual(none.save.data.builds, emptyBuilds(), 'no ship yet: no slots');
  assert.equal(importSave(craftSave(v1)).ok, true, 'an M3 export code imports too');
});

test("an M5 save (v2) moves every slot's ship and log to the fine grid", () => {
  const slots = [
    { name: 'Ship 1', ship: tidy, log },
    { name: 'Rebuilt', ship: tidy, log: [...log, { op: 'move', uid: 2, x: 4, y: 2, rot: 1 }, { op: 'move', uid: 2, x: 4, y: 1, rot: 0 }, { op: 'remove', uid: 2 }] },
  ];
  const v2 = { version: 2, data: { settings: { fpsCap: 60 }, rng: 5, builds: { active: 1, slots } } };
  const result = parseSave(JSON.stringify(v2));
  assert.equal(result.ok, true, result.error);
  const [first, second] = result.save.data.builds.slots;
  assert.deepEqual(first, { name: 'Ship 1', ship: fineStyled, log: fineLog });
  assert.deepEqual(second.log.slice(2), [{ op: 'move', uid: 2, x: 13, y: 7, rot: 1 }, { op: 'move', uid: 2, x: 13, y: 5, rot: 0 }, { op: 'remove', uid: 2 }]);
  assert.equal(result.save.data.builds.active, 1);
  assert.equal(importSave(craftSave(v2)).ok, true, 'an M5 export code imports too');
});

test("an M5 ship's build log still replays to it on the fine grid", () => {
  const defs = indexDefs(readData());
  // M5's example ship on the old grid, built part by part.
  const parts = [
    ['bridge', 6, 1, 1], ['corridor', 5, 1, 0], ['corridor', 5, 2, 0], ['corridor', 4, 2, 0], ['corridor', 3, 2, 0],
    ['corridor', 2, 2, 0], ['corridor', 2, 1, 0], ['reactor', 3, 0, 0], ['quarters', 1, 0, 0], ['engine', 0, 1, 0],
    ['engine', 0, 2, 0], ['lifesupport', 2, 3, 0], ['airlock', 3, 3, 0], ['weapon', 4, 3, 2],
  ];
  const old = { frame: 'starter', nextUid: 15, modules: parts.map(([type, x, y, rot], i) => ({ uid: i + 1, type, x, y, rot })) };
  const v2 = { version: 2, data: { settings: { fpsCap: 60 }, rng: 5, builds: { active: 0, slots: [{ name: 'Ship 1', ship: old, log: logFor(old) }] } } };
  const result = parseSave(JSON.stringify(v2));
  assert.equal(result.ok, true, result.error);
  const [slot] = result.save.data.builds.slots;
  assert.ok(logMatches(slot.log, slot.ship, defs), 'the log builds the moved ship');
  assert.equal(slot.ship.modules.length, 14, 'every part kept');
});

test('saved ships round-trip, even one that fails its flight checks', () => {
  // Two parts, no engine: it can't launch, but it saves.
  const save = withBuilds({ active: 1, slots: [{ name: 'Ship 1', ship: tidy, log }, { name: 'Ship 2', ship: tidy, log: [] }] });
  const result = importSave(exportSave(save));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save.data.builds, save.data.builds);
});

test("validate refuses saved ships it can't read", () => {
  const slot = { name: 'Ship 1', ship: tidy, log };
  assert.deepEqual(validate(withBuilds({ active: 0, slots: [slot] })), []);
  assert.deepEqual(validate(withBuilds(emptyBuilds())), []);
  const broken = [
    undefined,
    { slots: [slot] },
    { active: 1, slots: [slot] },
    { active: 1, slots: [] },
    { active: 0, slots: Array.from({ length: MAX_SLOTS + 1 }, () => slot) },
    { active: 0, slots: [{ ...slot, name: '' }] },
    { active: 0, slots: [{ ...slot, name: 'x'.repeat(25) }] },
    { active: 0, slots: [{ ...slot, log: undefined }] },
    { active: 0, slots: [{ ...slot, log: [{ op: 'teleport' }] }] },
    { active: 0, slots: [{ ...slot, ship: { ...tidy, frame: '' } }] },
    { active: 0, slots: [{ ...slot, ship: { ...tidy, hull: '' } }] },
    { active: 0, slots: [{ ...slot, ship: { ...tidy, hull: 7 } }] },
    { active: 0, slots: [{ ...slot, ship: { ...tidy, nextUid: 2 } }] },
    { active: 0, slots: [{ ...slot, ship: { ...tidy, modules: [{ uid: 1, type: 'bridge', x: 0.5, y: 0, rot: 0 }] } }] },
  ];
  for (const builds of broken) assert.match(validate(withBuilds(builds)).join(' '), /saved ships are missing or unreadable/, JSON.stringify(builds));
});

test('an M5b save (v3) loads with its ships and no campaign yet', () => {
  const builds = { active: 0, slots: [{ name: 'Ship 1', ship: fine, log: fineLog }] };
  const v3 = { version: 3, data: { settings: { fpsCap: 60 }, rng: 5, builds } };
  const result = parseSave(JSON.stringify(v3));
  assert.equal(result.ok, true, result.error);
  const styled = { active: 0, slots: [{ name: 'Ship 1', ship: fineStyled, log: fineLog }] };
  assert.deepEqual(result.save, { version: SAVE_VERSION, data: { settings: defaultSettings(), rng: 5, builds: styled, campaign: null } });
  assert.equal(importSave(craftSave(v3)).ok, true, 'an M5b export code imports too');
});

test('a campaign in the middle of a fight round-trips, and a damaged one is named', () => {
  const rules = indexDefs(readData());
  const atHub = reduce(initialState(8), { type: 'campaign/new', rules });
  const fighting = reduce(atHub, { type: 'campaign/fight/begin', rules });
  const save = makeSave(saveData(fighting));
  assert.deepEqual(validate(save), []);
  const result = importSave(exportSave(save));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, save);

  const damaged = makeSave({ ...saveData(atHub), campaign: { ...atHub.campaign, heat: 500 } });
  assert.deepEqual(validate(damaged), ["The campaign's heat is invalid."]);
  const loaded = parseSave(JSON.stringify(damaged));
  assert.equal(loaded.ok, false);
  assert.match(loaded.error, /^The save is damaged\. The campaign's heat is invalid\./);
  const { campaign, ...missing } = saveData(atHub);
  assert.deepEqual(validate(makeSave(missing)), ['The campaign is missing.']);
});

test('an M12 or M13 save (v4) gains the miner background, an empty job board, and fights at home with no job', () => {
  const rules = indexDefs(readData());
  const atHub = reduce(initialState(8), { type: 'campaign/new', rules });
  const fighting = reduce(atHub, { type: 'campaign/fight/begin', rules });
  for (const state of [atHub, fighting]) {
    // The campaign as v4 saved it: no background or board, and a fight
    // with no job, its battle with no objective.
    const { background, board, shop, spent, ...old } = state.campaign;
    if (old.fight) {
      const { job, ...fight } = old.fight;
      const { objective, ...battle } = fight.battle;
      old.fight = { ...fight, battle };
    }
    const v4 = { version: 4, data: { ...saveData(state), campaign: old } };
    const result = parseSave(JSON.stringify(v4));
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(result.save.data.campaign, { ...state.campaign, board: [], shop: null });
    assert.equal(importSave(craftSave(v4)).ok, true, 'a v4 export code imports too');
    // The hub rolls the board it has no jobs on, and the shop's stock.
    const opened = reduce({ ...initialState(1), campaign: result.save.data.campaign }, { type: 'campaign/board', rules });
    assert.equal(opened.campaign.board.length, state.campaign.fight ? 0 : rules.contracts.boardSize, 'not during a fight');
    const { size, armsSize = 0 } = rules.districts.get('tailings').shop;
    assert.equal(opened.campaign.shop?.length ?? null, state.campaign.fight ? null : size + armsSize, 'its parts and, since M37, its weapons');
  }
  const none = { version: 4, data: saveData(initialState(3)) };
  assert.equal(parseSave(JSON.stringify(none)).save.data.campaign, null, 'no campaign yet: still none');
});
