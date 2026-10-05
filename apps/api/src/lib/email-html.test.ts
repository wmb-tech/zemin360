import { describe, expect, it } from 'bun:test';
import { epostaHtml, withHtml } from './email-html';
import type { EmailSender } from './email';

describe('markalı e-posta', () => {
  it('tek satırlık adres düğme olur, satır içi adres bağlantı olur, metin kaçışlanır', () => {
    const html = epostaHtml(
      'Giriş <bağlantın>',
      'Merhaba,\n\nhttps://evidex.wmbyazilim.com/api/auth/magic/abc\n\nSoru için https://x.org/y <b>yaz</b>.',
    );
    expect(html).toContain(">Evidex'e gir</a>");
    expect(html).toContain('href="https://x.org/y"');
    expect(html).toContain('&lt;b&gt;yaz&lt;/b&gt;');
    expect(html).toContain('Giriş &lt;bağlantın&gt;');
  });

  it('HTML yoksa ekler, varsa dokunmaz; metin sürümü aynen gider', async () => {
    const giden: { html?: string; text: string }[] = [];
    const inner: EmailSender = { send: async (m) => void giden.push(m) };
    await withHtml(inner).send({
      to: 'a@b.c',
      subject: 'Takip',
      text: 'Cevabını linkten bekliyoruz.\nhttps://e.dev/takip/t1',
    });
    await withHtml(inner).send({ to: 'a@b.c', subject: 'X', text: 'düz', html: '<p>hazır</p>' });
    expect(giden[0]!.html).toContain('>Cevapla</a>');
    expect(giden[0]!.html).toContain('Cevabını linkten bekliyoruz.</td>');
    expect(giden[0]!.text).toBe('Cevabını linkten bekliyoruz.\nhttps://e.dev/takip/t1');
    expect(giden[1]!.html).toBe('<p>hazır</p>');
  });
});
