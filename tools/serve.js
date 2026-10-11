#!/usr/bin/env node
// Dependency-free static server for local testing.
//
//   node tools/serve.js [--port 8080] [--lan]
//
// Service workers need a secure context. http://localhost counts; a LAN
// address over plain http does not, so offline and install won't work that
// way. To test on the phone over USB instead:
//   adb reverse tcp:8080 tcp:8080   then open http://localhost:8080 on the phone.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 8080);
const lan = args.includes('--lan');
const host = lan ? '0.0.0.0' : '127.0.0.1';

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  // No dotfiles (.git, .githooks) except .well-known, and nothing outside the repo.
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.') && s !== '.well-known')) return send(res, 404, 'Not found');
  let file = resolve(ROOT, `.${pathname}`);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 404, 'Not found');

  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      // Match GitHub Pages: folders without a trailing slash redirect.
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${pathname}/` });
        return res.end();
      }
      file = join(file, 'index.html');
      info = await stat(file);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
});

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

server.listen(port, host, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`  http://localhost:${port}/  (add ?dev=1 for the dev menu)`);
  if (lan) {
    for (const nets of Object.values(networkInterfaces())) {
      for (const net of nets ?? []) {
        if (net.family === 'IPv4' && !net.internal) console.log(`  http://${net.address}:${port}/  (no service worker over plain http)`);
      }
    }
  }
});
