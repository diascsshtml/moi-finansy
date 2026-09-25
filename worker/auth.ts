/**
 * Пароли и сессии, только через WebCrypto (никаких npm-пакетов, тот же
 * подход, что и в webpush.ts). PBKDF2 для паролей, HMAC-подписанный токен
 * (компактный JWT-подобный формат) для сессии — хранится в httpOnly-куке,
 * так что клиентский JS его не видит и не может прочитать напрямую.
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

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { hash: base64urlEncode(hash), salt: base64urlEncode(salt) };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const salt = base64urlDecode(storedSalt);
  const hash = await derivePasswordHash(password, salt);
  const expected = base64urlDecode(storedHash);
  if (hash.length !== expected.length) return false;
  // Побайтовое сравнение за постоянное время — не даём измерять по времени ответа,
  // совпадает ли хэш, байт за байтом.
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
  return diff === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

interface SessionPayload {
  userId: string;
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', textEncoder.encode(secret) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const payload: SessionPayload = { userId, exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60 };
  const body = base64urlEncode(textEncoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(body));
  return `${body}.${base64urlEncode(signature)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(sig) as BufferSource, textEncoder.encode(body) as BufferSource);
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

const SESSION_COOKIE = 'mf_session';

export function sessionCookieHeader(token: string): string {
  const maxAge = 90 * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6 && password.length <= 200;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 200 && EMAIL_RE.test(email);
}

/** Код восстановления пароля — шлётся на почту при запросе сброса (см.
 *  worker/email.ts), живёт недолго (см. RESET_CODE_TTL_MS в accounts-api.ts).
 *  На сервере хранится только его хэш (см. hashPassword), как у пароля. */
export function generateResetCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  const code = bytes[0] % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function normalizeResetCode(code: string): string {
  return code.trim().replace(/\s+/g, '');
}

/** Побайтовое сравнение за постоянное время — для сверки секретных ключей
 *  (например, админ-ключа), чтобы не давать угадывать его по времени ответа. */
export function constantTimeEqual(a: string, b: string): boolean {
  const bytesA = textEncoder.encode(a);
  const bytesB = textEncoder.encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}
