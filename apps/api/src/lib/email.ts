/**
 * E-posta gönderici. SMTP yoksa konsola yazar — geliştirmede sihirli link terminalde
 * görünür. ⚠ Üretimde SMTP_URL zorunlu; konsol göndericisi sessiz başarı üretmesin diye
 * her gönderimde uyarı basar.
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
