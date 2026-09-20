import { createHash } from 'node:crypto';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Belge kanıtı (doğrula 02, KARAR-02): sertifika, yarışma belgesi, staj yazısı gibi PDF'ler.
 * Dosya SAKLANMAZ (ADR-0003): metin çıkarılır, ondan küçük ve deterministik bir sinyal seti
 * üretilir; ajan kart taslağı yazarken bunu okur. Sahiplik makineyle doğrulanamaz → seviye
 * "belgeli" (documented): doğrulanmıştan zayıf, beyandan güçlü.
 * ⚠ excerptLines küçük tutulur (ilk satırlar, ≤ 400 kr): belgenin ne olduğunu anlatır,
 * içeriğini kopyalamaz.
 */
export interface DocumentSignals {
  pages: number;
  wordCount: number;
  sha256: string;
  title: string | null; // ilk anlamlı satır
  issuer: string | null; // "… Üniversitesi", "… Vakfı", "TEKNOFEST" gibi kurum adı geçen satır
  years: number[]; // metinde geçen yıllar (2000–2100), sıralı, tekil
  docType: 'certificate' | 'competition' | 'internship' | 'reference' | 'transcript' | 'other';
  excerptLines: string[]; // ≤ 8 satır, toplam ≤ 400 karakter
  language: 'tr' | 'en' | 'other';
}

export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

const ISSUER_RE =
  /(üniversite|university|vakf|foundation|derne|association|a\.ş\.|ltd|teknofest|bakanl|ministry|tübitak|akademi|academy|enstitü|institute|belediye)/i;
const TYPE_RULES: [DocumentSignals['docType'], RegExp][] = [
  ['competition', /(finalist|yarışma|hackathon|competition|ödül|award|derece|birincilik|jüri)/i],
  ['internship', /(staj|intern|internship|çalışmıştır|worked as)/i],
  [
    'certificate',
    /(sertifika|certificate|katılım belgesi|başarıyla tamamla|successfully completed)/i,
  ],
  ['reference', /(referans|reference letter|tavsiye|recommend)/i],
  ['transcript', /(transkript|transcript|not dökümü|gpa|ağırlıklı)/i],
];

/** Metinden sinyal: saf fonksiyon, test edilebilir; PDF ayrıştırmadan bağımsız. */
export function signalsFromText(text: string, pages: number, sha256: string): DocumentSignals {
  const satirlar = text
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 3);
  const kelimeler = text.split(/\s+/).filter(Boolean);
  const years = [...new Set((text.match(/\b(20\d{2}|19[89]\d)\b/g) ?? []).map(Number))].sort();
  const issuer = satirlar.find((s) => ISSUER_RE.test(s) && s.length <= 120) ?? null;
  const docType = TYPE_RULES.find(([, re]) => re.test(text))?.[0] ?? 'other';
  const excerptLines: string[] = [];
  let toplam = 0;
  for (const s of satirlar) {
    if (excerptLines.length >= 8 || toplam + s.length > 400) break;
    excerptLines.push(s.slice(0, 120));
    toplam += Math.min(s.length, 120);
  }
  // Dil: sık kelimelerin sayısıyla (diyakritik oranı kısa belgede yanıltıyor).
  const tr = (text.match(/\b(ve|bir|için|ile|olarak|bu|tarafından)\b/gi) ?? []).length;
  const en = (text.match(/\b(the|and|of|to|for|by)\b/gi) ?? []).length;
  const language: DocumentSignals['language'] =
    tr === 0 && en === 0 ? 'other' : tr >= en ? 'tr' : 'en';
  return {
    pages,
    wordCount: kelimeler.length,
    sha256,
    title: satirlar[0]?.slice(0, 120) ?? null,
    issuer,
    years,
    docType,
    excerptLines,
    language,
  };
}

export interface DocumentEvidence {
  extract(bytes: Uint8Array): Promise<DocumentSignals>;
}

export function createDocumentEvidence(): DocumentEvidence {
  return {
    async extract(bytes) {
      if (bytes.byteLength > DOCUMENT_MAX_BYTES) throw new Error('Belge 5 MB sınırını aşıyor');
      // PDF imzası; uzantıya güvenilmez.
      const bas = new TextDecoder('latin1').decode(bytes.subarray(0, 5));
      if (bas !== '%PDF-') throw new Error('Yalnız PDF kabul edilir');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const pdf = await getDocumentProxy(bytes);
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      if (totalPages > 30) throw new Error('Belge 30 sayfadan uzun; bu bir kanıt belgesi değil');
      return signalsFromText(text, totalPages, sha256);
    },
  };
}
