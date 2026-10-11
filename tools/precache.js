#!/usr/bin/env node
// Writes the precache file list and a content hash into sw.js, between the
// <precache> markers. Browsers only update a service worker when sw.js itself
// changes, so this must run whenever any cached file changes.
//
//   node tools/precache.js            files as they are on disk
//   node tools/precache.js --staged   files as staged in git (the pre-commit hook)
//
// The hook uses --staged because Pages serves only what is committed: a file
// that exists on disk but isn't committed would 404 and fail the whole
// install, and unstaged edits would stamp a version the commit doesn't match.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// What the game needs offline: the shell, code, data and art.
const ROOT_FILES = ['index.html', 'manifest.webmanifest', 'icon.svg'];
const DIRS = [
  { dir: 'icons', ext: ['.png'] },
  { dir: 'src', ext: ['.js', '.css', '.json', '.svg'] },
  { dir: 'data', ext: ['.json'] },
  { dir: 'assets/img', ext: ['.webp'] },
];

const BLOCK = /\/\/ <precache>\r?\n[\s\S]*?\/\/ <\/precache>/;

export function isCached(path) {
  if (ROOT_FILES.includes(path)) return true;
  if (path.split('/').some((segment) => segment.startsWith('.'))) return false;
  return DIRS.some(({ dir, ext }) => path.startsWith(`${dir}/`) && ext.some((e) => path.endsWith(e)));
}

// Sorted, root-relative paths with forward slashes, from the working tree.
export function collectFiles(root) {
  const files = [...ROOT_FILES.filter((f) => existsSync(join(root, f)))];
  for (const { dir } of DIRS) files.push(...walk(join(root, dir), dir).filter(isCached));
  return checkRequired(files.sort());
}

function walk(abs, rel) {
  if (!existsSync(abs)) return [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const childAbs = join(abs, entry.name);
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(childAbs, childRel));
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

function checkRequired(files) {
  for (const file of ROOT_FILES) {
    if (!files.includes(file)) throw new Error(`precache: missing ${file}`);
  }
  return files;
}

// [path, git blob id] pairs for the working tree. The blob id is what git
// would store for those bytes, so both modes agree when the tree is clean.
export function workingEntries(root) {
  return collectFiles(root).map((file) => {
    const bytes = readFileSync(join(root, file));
    const id = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    return [file, id];
  });
}

// [path, git blob id] pairs for the files staged in git's index.
export function stagedEntries(root) {
  const out = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8' });
  const entries = [];
  for (const line of out.split('\0').filter(Boolean)) {
    const [meta, path] = line.split('\t');
    const [, id, stage] = meta.split(' ');
    if (stage !== '0') throw new Error(`precache: ${path} has an unresolved merge conflict`);
    if (isCached(path)) entries.push([path, id]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  checkRequired(entries.map(([path]) => path));
  return entries;
}

// Hashes every cached file's path and content, plus sw.js outside the
// generated block, so a change to the worker's own code also gets a new cache.
export function computeVersion(entries, swSource) {
  const hash = createHash('sha256');
  for (const [path, id] of entries) hash.update(`${path}\0${id}\n`);
  hash.update(swSource.replace(BLOCK, ''));
  return hash.digest('hex').slice(0, 12);
}

export function renderBlock({ version, prefix, files }) {
  const list = files.map((f) => `  ${JSON.stringify(f)},`).join('\n');
  return [
    '// <precache>',
    `const VERSION = ${JSON.stringify(version)};`,
    `const CACHE_PREFIX = ${JSON.stringify(`${prefix}-`)};`,
    `const FILES = [\n${list}\n];`,
    '// </precache>',
  ].join('\n');
}

export function injectBlock(swSource, block) {
  if (!BLOCK.test(swSource)) throw new Error('precache: sw.js has no // <precache> ... // </precache> block');
  return swSource.replace(BLOCK, () => block);
}

export function precache(root, prefix, { staged = false } = {}) {
  const swPath = join(root, 'sw.js');
  const before = readFileSync(swPath, 'utf8');
  const entries = staged ? stagedEntries(root) : workingEntries(root);
  const files = entries.map(([path]) => path);
  const version = computeVersion(entries, before);
  const after = injectBlock(before, renderBlock({ version, prefix, files }));
  if (after !== before) writeFileSync(swPath, after);
  return { version, files, changed: after !== before };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { config } = await import(pathToFileURL(join(root, 'src', 'config.js')).href);
  const staged = process.argv.includes('--staged');
  const { version, files, changed } = precache(root, config.appId, { staged });
  const source = staged ? 'staged' : 'on disk';
  console.log(`precache: ${files.length} files (${source}), version ${version}, sw.js ${changed ? 'updated' : 'unchanged'}`);
}
