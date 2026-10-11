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
import { initialState, saveData } from '../src/sim/root.js';

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
  const problems = validate({ version: SAVE_VERSION, data: { settings: { fpsCap: 45 }, rng: 1, ship: null } });
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

test('a save from before M3 (v0) loads with no ship', () => {
  const old = { version: 0, data: { settings: { fpsCap: 30 }, rng: 77 } };
  const result = parseSave(JSON.stringify(old));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save, { version: SAVE_VERSION, data: { settings: { fpsCap: 30 }, rng: 77, ship: null } });
  assert.equal(importSave(craftSave(old)).ok, true, 'an old export code imports too');
});

test('a save with a ship round-trips, even a ship that fails its flight checks', () => {
  // Two parts, no engine: it can't launch, but it saves.
  const save = makeSave({ ...saveData(initialState(9)), ship });
  const result = importSave(exportSave(save));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.save.data.ship, ship);
});

test('validate refuses a ship it can\'t read', () => {
  const withShip = (s) => validate(makeSave({ ...saveData(initialState(9)), ship: s }));
  assert.deepEqual(withShip(ship), []);
  const broken = [
    undefined,
    'a ship',
    { ...ship, frame: '' },
    { ...ship, modules: {} },
    { ...ship, nextUid: 3 }, // uid 3 must be below nextUid
    { ...ship, modules: [...ship.modules, { ...ship.modules[0] }] }, // uid used twice
    { ...ship, modules: [{ uid: 1, type: 'bridge', x: 0.5, y: 0, rot: 0 }] },
    { ...ship, modules: [{ uid: 1, type: 'bridge', x: 0, y: 0, rot: 4 }] },
    { ...ship, modules: [{ uid: 1, type: '', x: 0, y: 0, rot: 0 }] },
  ];
  for (const s of broken) assert.match(withShip(s).join(' '), /ship is missing or unreadable/, JSON.stringify(s));
});
