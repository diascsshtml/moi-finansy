// PIN-код для экрана блокировки. Это НЕ шифрование данных — сами операции,
// долги и т.д. в IndexedDB остаются как есть, лежит только соль+хэш PIN-кода
// (SHA-256), чтобы хотя бы сам код не читался напрямую из базы. Экран
// блокировки защищает от случайного просмотра (кто-то взял телефон), а не от
// того, кто умеет открыть консоль разработчика.

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes.buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(digest);
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  const actual = await hashPin(pin, salt);
  return actual === expectedHash;
}

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
