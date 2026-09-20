import { describe, expect, it } from 'bun:test';
import { signalsFromText } from './document';

describe('belge sinyali', () => {
  it('tür, kurum, yıllar ve kısa alıntı; içerik kopyalanmaz', () => {
    const metin = `TEKNOFEST 2025
Finalist Belgesi
Ayşe Yılmaz
İstinye Üniversitesi ekibi olarak Eğitim Teknolojileri kategorisinde finale kalmıştır.
Eylül 2025, İstanbul
${'Uzun bir paragraf. '.repeat(80)}`;
    const s = signalsFromText(metin, 1, 'abc');
    expect(s.docType).toBe('competition');
    expect(s.issuer).toBe('TEKNOFEST 2025'); // ilk kurum satırı
    expect(s.years).toEqual([2025]);
    expect(s.title).toBe('TEKNOFEST 2025');
    expect(s.language).toBe('tr');
    expect(s.excerptLines.length).toBeLessThanOrEqual(8);
    expect(s.excerptLines.join('').length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(s)).not.toContain(
      'Uzun bir paragraf. Uzun bir paragraf. Uzun bir paragraf. Uzun',
    );
  });
  it('boş metin: other, alıntı yok', () => {
    const s = signalsFromText('', 3, 'x');
    expect(s.docType).toBe('other');
    expect(s.excerptLines).toEqual([]);
    expect(s.language).toBe('other');
  });
});
