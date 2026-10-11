import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { collectFiles, injectBlock, precache } from '../tools/precache.js';

const SW = "// head\n// <precache>\nconst VERSION = '';\n// </precache>\nconst rest = 1;\n";

function write(root, file, text) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function git(root, ...args) {
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'precache-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(root, 'index.html', '<!doctype html>');
  write(root, 'manifest.webmanifest', '{}');
  write(root, 'icon.svg', '<svg/>');
  write(root, 'icons/icon-192.png', 'png');
  write(root, 'src/main.js', 'main');
  write(root, 'src/ui/style.css', 'css');
  write(root, 'src/.scratch.js', 'hidden');
  write(root, 'tools/precache.js', 'tool');
  write(root, 'tests/a.test.js', 'test');
  write(root, 'notes.md', 'notes');
  write(root, 'sw.js', SW);
  return root;
}

test('collects the files the game needs, sorted, and nothing else', (t) => {
  const root = fixture(t);
  assert.deepEqual(collectFiles(root), [
    'icon.svg',
    'icons/icon-192.png',
    'index.html',
    'manifest.webmanifest',
    'src/main.js',
    'src/ui/style.css',
  ]);
});

test('writes the block into sw.js, keeps the rest, and is stable', (t) => {
  const root = fixture(t);
  const first = precache(root, 'wt');
  assert.equal(first.changed, true);
  assert.match(first.version, /^[0-9a-f]{12}$/);
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.ok(sw.startsWith('// head\n// <precache>\n'));
  assert.ok(sw.endsWith('// </precache>\nconst rest = 1;\n'));
  assert.ok(sw.includes(`const VERSION = "${first.version}";`));
  assert.ok(sw.includes('const CACHE_PREFIX = "wt-";'));
  assert.ok(sw.includes('  "src/main.js",'));

  const second = precache(root, 'wt');
  assert.equal(second.changed, false);
  assert.equal(second.version, first.version);
});

test('changing a cached file changes the version', (t) => {
  const root = fixture(t);
  const before = precache(root, 'wt').version;
  write(root, 'src/main.js', 'main v2');
  assert.notEqual(precache(root, 'wt').version, before);
});

test("changing the worker's own code changes the version", (t) => {
  const root = fixture(t);
  const before = precache(root, 'wt').version;
  write(root, 'sw.js', readFileSync(join(root, 'sw.js'), 'utf8').replace('rest = 1', 'rest = 2'));
  assert.notEqual(precache(root, 'wt').version, before);
});

test('changing a file the game does not use leaves the version alone', (t) => {
  const root = fixture(t);
  const before = precache(root, 'wt').version;
  write(root, 'notes.md', 'more notes');
  write(root, 'tools/precache.js', 'tool v2');
  assert.equal(precache(root, 'wt').version, before);
});

test('staged mode lists only what git will commit, at its staged content', (t) => {
  const root = fixture(t);
  git(root, 'init', '-q');
  git(root, 'add', 'index.html', 'manifest.webmanifest', 'icon.svg', 'src/main.js', 'sw.js');
  // icons/icon-192.png and src/ui/style.css stay untracked: Pages would 404 them.
  const staged = precache(root, 'wt', { staged: true });
  assert.deepEqual(staged.files, ['icon.svg', 'index.html', 'manifest.webmanifest', 'src/main.js']);

  write(root, 'src/main.js', 'main v2, not staged yet');
  assert.equal(precache(root, 'wt', { staged: true }).version, staged.version);
  git(root, 'add', 'src/main.js');
  assert.notEqual(precache(root, 'wt', { staged: true }).version, staged.version);
});

test('both modes give the same version when everything is staged', (t) => {
  const root = fixture(t);
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  const staged = precache(root, 'wt', { staged: true });
  const onDisk = precache(root, 'wt');
  assert.equal(onDisk.version, staged.version);
  assert.deepEqual(onDisk.files, staged.files);
  assert.equal(onDisk.changed, false);
});

test('fails loudly without markers or without index.html', (t) => {
  assert.throws(() => injectBlock('no markers here', '// <precache>\n// </precache>'), /no \/\/ <precache>/);
  const root = fixture(t);
  rmSync(join(root, 'index.html'));
  assert.throws(() => collectFiles(root), /missing index.html/);
});
