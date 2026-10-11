// Text codecs for codes players copy and paste: save codes and blueprint
// codes. Works in browsers and in Node (TextEncoder, btoa and atob are
// globals in both).

export function toBase64Url(text) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

// Throws on anything that isn't valid base64url-encoded UTF-8.
export function fromBase64Url(code) {
  return new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(code));
}

export function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Throws on anything that isn't base64url.
export function base64UrlToBytes(code) {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) {
    throw new SyntaxError('not base64url');
  }
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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
