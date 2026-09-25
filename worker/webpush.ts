/**
 * Zero-dependency Web Push sender: RFC 8291 (payload encryption over ECDH+HKDF),
 * RFC 8188 (aes128gcm content-encoding) and RFC 8292 (VAPID auth via a signed
 * ES256 JWT). Uses only the WebCrypto API, native to the Workers runtime —
 * no npm package needed, no Node-only crypto/http.
 *
 * Verified against a hand-written encrypt→decrypt round trip (decryption
 * re-derives the exact same keys a receiving browser would) — see the note
 * in README/commit history for how it was checked before wiring it up.
 */

const textEncoder = new TextEncoder();

function base64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, lengthBytes * 8);
  return new Uint8Array(bits);
}

// @cloudflare/workers-types' SubtleCrypto typings are a bit off from the real
// (spec-matching) runtime behaviour in a couple of spots — generateKey's
// overloads don't narrow to CryptoKeyPair, exportKey's don't narrow away from
// JsonWebKey, and EcdhKeyDeriveParams is typed with a `$public` field instead
// of the real `public` one. These small wrappers isolate the casts/workarounds
// so the RFC logic above stays readable and type-safe everywhere else.
async function generateEcKeyPair(algorithm: SubtleCryptoGenerateKeyAlgorithm, usages: string[]): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(algorithm, true, usages)) as CryptoKeyPair;
}
async function exportRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer);
}
async function exportPkcs8(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array((await crypto.subtle.exportKey('pkcs8', key)) as ArrayBuffer);
}
async function deriveEcdhBits(publicKey: CryptoKey, privateKey: CryptoKey, lengthBits: number): Promise<Uint8Array> {
  const algorithm = { name: 'ECDH', public: publicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  return new Uint8Array(await crypto.subtle.deriveBits(algorithm, privateKey, lengthBits));
}

export interface VapidKeys {
  publicKey: string; // base64url raw EC point (65 bytes) — safe to expose to clients
  privateKey: string; // base64url PKCS8 — server secret only
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const keyPair = await generateEcKeyPair({ name: 'ECDSA', namedCurve: 'P-256' }, ['sign', 'verify']);
  const publicKey = await exportRaw(keyPair.publicKey);
  const privateKey = await exportPkcs8(keyPair.privateKey);
  return { publicKey: base64urlEncode(publicKey), privateKey: base64urlEncode(privateKey) };
}

async function importVapidPrivateKey(privateKeyB64url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', base64urlDecode(privateKeyB64url) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function createVapidJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 3600, iat: now, sub: subject };
  const signingInput = `${base64urlEncode(textEncoder.encode(JSON.stringify(header)))}.${base64urlEncode(textEncoder.encode(JSON.stringify(payload)))}`;
  // WebCrypto's ECDSA signature is the raw (r||s) IEEE-P1363 format, which is
  // exactly what a JWS ES256 signature needs — no DER conversion required.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, textEncoder.encode(signingInput));
  return `${signingInput}.${base64urlEncode(signature)}`;
}

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function encryptPayload(payload: Uint8Array, clientPublicKeyB64: string, authSecretB64: string): Promise<Uint8Array> {
  const clientPublicKeyBytes = base64urlDecode(clientPublicKeyB64);
  const authSecret = base64urlDecode(authSecretB64);

  const clientPublicKey = await crypto.subtle.importKey('raw', clientPublicKeyBytes as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeralKeyPair = await generateEcKeyPair({ name: 'ECDH', namedCurve: 'P-256' }, ['deriveBits']);
  const ephemeralPublicRaw = await exportRaw(ephemeralKeyPair.publicKey);

  const sharedSecret = await deriveEcdhBits(clientPublicKey, ephemeralKeyPair.privateKey, 256);

  const keyInfo = concatBytes(textEncoder.encode('WebPush: info\0'), clientPublicKeyBytes, ephemeralPublicRaw);
  const inputKeyingMaterial = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentEncryptionKeyBytes = await hkdf(salt, inputKeyingMaterial, textEncoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, inputKeyingMaterial, textEncoder.encode('Content-Encoding: nonce\0'), 12);

  const contentEncryptionKey = await crypto.subtle.importKey('raw', contentEncryptionKeyBytes as BufferSource, 'AES-GCM', false, ['encrypt']);
  // Single-record message: plaintext followed by the RFC 8188 "last record" delimiter (0x02).
  const recordPlaintext = concatBytes(payload, new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, contentEncryptionKey, recordPlaintext as BufferSource),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concatBytes(salt, recordSize, new Uint8Array([ephemeralPublicRaw.length]), ephemeralPublicRaw);
  return concatBytes(header, ciphertext);
}

/** Sends one Web Push message. Returns the raw fetch Response from the push
 *  service so the caller can react to 404/410 (subscription gone → clean up)
 *  vs. other errors. */
export async function sendWebPush(
  subscription: PushSubscriptionInfo,
  payload: unknown,
  vapid: VapidKeys,
  adminContact: string,
): Promise<Response> {
  const body = await encryptPayload(textEncoder.encode(JSON.stringify(payload)), subscription.keys.p256dh, subscription.keys.auth);
  const endpointOrigin = new URL(subscription.endpoint).origin;
  const privateKey = await importVapidPrivateKey(vapid.privateKey);
  const jwt = await createVapidJwt(privateKey, endpointOrigin, adminContact);

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '3600',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body: body as BodyInit,
  });
}
