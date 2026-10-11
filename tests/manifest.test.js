import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read('manifest.webmanifest'));

test('the manifest id is pinned', () => {
  // Chrome identifies the installed app by this id, resolved against the
  // origin (https://rcjlabs.github.io/?app=wt), not the game's folder.
  // Changing it turns every installed copy into a different app.
  assert.equal(manifest.id, '/?app=wt');
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
