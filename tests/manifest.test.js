import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { config } from '../src/config.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read('manifest.webmanifest'));

test('the manifest id is pinned', () => {
  // Chrome identifies the installed app by this id, resolved against the
  // origin (https://spacewrecked.rcjlabs.com/?app=wt), not the game's folder.
  // Changing it turns every installed copy into a different app.
  assert.equal(manifest.id, '/?app=wt');
});

test('the game name matches in config.js and the manifest', () => {
  // A rename touches exactly these two files.
  assert.equal(manifest.name, config.title);
  assert.equal(manifest.short_name, config.shortName);
});

test('every manifest icon exists at its declared size', () => {
  for (const icon of manifest.icons) {
    const png = read(icon.src);
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width, `${icon.src} width`);
    assert.equal(png.readUInt32BE(20), height, `${icon.src} height`);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'a maskable icon');
});
