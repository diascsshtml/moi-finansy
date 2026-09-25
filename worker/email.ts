// Отправка писем через Brevo (https://www.brevo.com) — простой HTTP API,
// без npm-зависимостей (тот же подход, что и с Web Push). Используется
// только для кода восстановления пароля: почта клиента нужна ровно для
// этого, само приложение больше ничего на неё не шлёт.

export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export async function sendEmail(config: BrevoConfig, to: string, subject: string, htmlContent: string): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Brevo: ${res.status} ${text}`);
  }
}

export function resetCodeEmailHtml(code: string, name: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Мои финансы</h2>
      <p>Здравствуйте, ${escapeHtml(name)}!</p>
      <p>Код для восстановления пароля:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background: #f4f3f0; padding: 16px; text-align: center; border-radius: 8px;">${code}</p>
      <p>Код действует 15 минут. Если вы не запрашивали восстановление пароля — просто проигнорируйте это письмо.</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
