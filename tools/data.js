// Reads the content files in data/ as parsed JSON, for tools and tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const DATA_FILES = ['modules', 'frames', 'manufacturers'];

export function readData(dir = DATA_DIR) {
  const data = {};
  for (const name of DATA_FILES) {
    const file = join(dir, `${name}.json`);
    try {
      data[name] = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`${name}.json: ${err.message}`);
    }
  }
  return data;
}
