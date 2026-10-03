// Уменьшение и сжатие фото профиля прямо в браузере перед отправкой на
// сервер — исходник с телефона может весить несколько МБ, а для круглого
// аватара хватает маленького квадратного превью. Экономит и трафик, и место
// в users.avatar (TEXT), и не требует отдельного объектного хранилища
// (R2/S3) ради пары десятков КБ на пользователя.

const AVATAR_SIZE = 320;
const JPEG_QUALITY = 0.85;

/** Берёт файл изображения, обрезает по центру до квадрата и уменьшает до
 *  AVATAR_SIZE×AVATAR_SIZE, возвращает JPEG как data URL. Бросает исключение,
 *  если файл не читается как изображение. */
export async function resizeImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен');
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
