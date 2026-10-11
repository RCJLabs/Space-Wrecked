// Text codecs for codes players copy and paste: save codes now, blueprint
// codes from M5. Works in browsers and in Node (TextEncoder, btoa and atob are
// globals in both).

export function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Throws on anything that isn't valid base64url-encoded UTF-8.
export function fromBase64Url(code) {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) {
    throw new SyntaxError('not base64url');
  }
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// FNV-1a over UTF-16 code units, as 8 hex digits. It catches copy and paste
// damage; it is not a security check.
export function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
