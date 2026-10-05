import type { EmailSender } from './email';

const kacis = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tek başına satırdaki adres düğme olur; etiket adresin ne açtığını söyler. */
function dugmeEtiketi(url: string) {
  if (url.includes('/api/auth/magic/')) return "Evidex'e gir";
  if (url.includes('/takip/')) return 'Cevapla';
  if (url.includes('/k/')) return 'Kartı aç';
  return 'Aç';
}

const satirIci = (v: string) =>
  kacis(v).replace(
    /https?:\/\/[^\s<]+/g,
    (u) => `<a href="${u}" style="color:#4a43d4;font-weight:600">${u}</a>`,
  );

/**
 * Düz metin e-postadan markalı HTML: logo yazısı, başlık, paragraflar, düğme, alt bilgi.
 * Metin sürümü olduğu gibi gider (HTML göstermeyen istemci ve spam filtresi için). Tablo tabanlı
 * ve satır içi stil: e-posta istemcileri harici CSS ve modern yerleşimi desteklemez.
 */
export function epostaHtml(konu: string, metin: string) {
  const bloklar = metin
    .replace(/\r/g, '')
    .trim()
    .split(/\n{2,}/);
  const dugme = (u: string) =>
    `<tr><td style="padding:8px 0 16px"><a href="${kacis(u)}" style="display:inline-block;background:#4a43d4;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">${dugmeEtiketi(u)}</a></td></tr>`;
  const paragraf = (satirlar: string[]) =>
    `<tr><td style="padding:0 0 14px;font-size:15px;line-height:1.6;color:#20253d">${satirlar.map(satirIci).join('<br>')}</td></tr>`;
  // Tek başına satırdaki adres (paragrafın sonunda bile) düğme olur; kalan satırlar paragraf.
  const govde = bloklar
    .map((b) => {
      const parcalar: string[] = [];
      let birikim: string[] = [];
      for (const satir of b.split('\n')) {
        if (/^https?:\/\/\S+$/.test(satir.trim())) {
          if (birikim.length) parcalar.push(paragraf(birikim));
          birikim = [];
          parcalar.push(dugme(satir.trim()));
        } else birikim.push(satir);
      }
      if (birikim.length) parcalar.push(paragraf(birikim));
      return parcalar.join('');
    })
    .join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kacis(konu)}</title></head>
<body style="margin:0;background:#f6f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Manrope,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7ff;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px;font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:22px;letter-spacing:-0.5px;color:#20253d">Evidex.</td></tr>
<tr><td style="background:#ffffff;border:1px solid #dee1f0;border-radius:16px;padding:26px 28px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 16px;font-size:19px;font-weight:800;line-height:1.3;color:#20253d">${kacis(konu)}</td></tr>
${govde}
</table></td></tr>
<tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#8b90a3">Evidex · GİRVAK gençlik ağı için kanıta dayalı yetkinlik kartı ve gerekçeli eşleşme. Bu e-postayı Evidex'teki bir işlem nedeniyle aldınız. <a href="https://evidex.wmbyazilim.com/gizlilik" style="color:#8b90a3">Aydınlatma metni</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Gönderilen her e-postaya (HTML'i yoksa) markalı HTML sürümünü ekler. */
export function withHtml(inner: EmailSender): EmailSender {
  return {
    send: (msg) => inner.send(msg.html ? msg : { ...msg, html: epostaHtml(msg.subject, msg.text) }),
  };
}
