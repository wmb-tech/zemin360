import nodemailer from 'nodemailer';

/**
 * E-posta gönderici. SMTP_URL varsa gerçek gönderim (nodemailer), yoksa konsol — geliştirmede
 * sihirli link terminalde görünür. ⚠ Konsol göndericisi her gönderimde uyarı basar; üretimde
 * SMTP_URL yoksa açılışta da uyarılır (index.ts). Gmail: `smtp://user:app-pass@smtp.gmail.com:587`
 * — 465/25 Hetzner'da kapalı, 587 STARTTLS (bkz. gise-live-ops dersi).
 */
export interface EmailSender {
  send(msg: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

export function createConsoleEmailSender(): EmailSender {
  return {
    async send(msg) {
      console.warn(`[email:console] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    },
  };
}

export function createSmtpEmailSender(smtpUrl: string, from: string): EmailSender {
  const url = new URL(smtpUrl);
  const transport = nodemailer.createTransport({
    host: url.hostname,
    port: Number(url.port || 587),
    secure: url.protocol === 'smtps:',
    auth: url.username
      ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) }
      : undefined,
    connectionTimeout: 10_000,
  });
  return {
    async send(msg) {
      // Hata yutulmaz: gönderilemeyen tanıştırma/takip "gönderildi" görünmesin (sessiz-başarı).
      await transport.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
    },
  };
}

export function createEmailSenderFromEnv(env: {
  SMTP_URL?: string | undefined;
  EMAIL_FROM: string;
}) {
  if (env.SMTP_URL) return createSmtpEmailSender(env.SMTP_URL, env.EMAIL_FROM);
  console.warn('[email] SMTP_URL yok; e-postalar konsola yazılacak');
  return createConsoleEmailSender();
}
