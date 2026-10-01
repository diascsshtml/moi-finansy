// Face ID / Touch ID / биометрия Android / Windows Hello — через WebAuthn
// (платформенные аутентификаторы). Как и PIN (см. utils/pin.ts), это НЕ
// защита перед сервером и не замена шифрования — чисто локальный гейт перед
// интерфейсом. Поэтому мы не проверяем криптографическую подпись ответа на
// сервере: успешный navigator.credentials.get() без исключения уже значит,
// что операционная система подтвердила биометрию физически присутствующего
// человека — этого достаточно для той же модели угроз, что и у PIN-кода.

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// TS 5.7+ сделал Uint8Array дженериком по типу буфера (ArrayBufferLike),
// а BufferSource в lib.dom требует именно ArrayBuffer — без явной аннотации
// возврата компилятор не может убедиться, что буфер не SharedArrayBuffer.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Есть ли на этом устройстве/браузере платформенный аутентификатор (Face ID,
 *  Touch ID, разблокировка по отпечатку/лицу на Android, Windows Hello) и
 *  настроен ли он — а не просто поддерживается ли WebAuthn в принципе. */
export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Регистрирует новый платформенный ключ (системный диалог Face ID/Touch ID
 *  появляется прямо тут) и возвращает его id в base64url — сохраняется в
 *  settings.biometricCredentialId. Бросает исключение, если пользователь
 *  отменил диалог или аутентификатор недоступен — вызывающий код сам решает,
 *  что показать (см. Settings.tsx). */
export async function registerBiometric(accountLabel: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Мои финансы' },
      user: { id: userId, name: accountLabel, displayName: accountLabel },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('Не удалось создать ключ');
  return toBase64Url(credential.rawId);
}

/** Запрашивает биометрию для уже зарегистрированного ключа (системный диалог
 *  появляется тут же). Возвращает false, а не бросает исключение, при
 *  отмене/ошибке/таймауте — вызывающий экран просто остаётся на вводе PIN. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: fromBase64Url(credentialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
