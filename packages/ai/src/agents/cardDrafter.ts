import { z } from 'zod';
import type { LlmMessage, LlmProvider } from '../provider';

/**
 * ### card_drafter — döngü adımı: doğrula (02)
 * Kanıt sinyallerinden (repo başına) kişi kartı taslağı yazar: başlık, hikâye bloğu ve
 * iddialar. Her iddia en az bir kaynağa (repo tam adı) bağlanır; kaynağı olmayan iddia
 * atılır. Seviye burada verilmez — kaynak türü belirler (GitHub App → verified).
 * ⚠ Ajan kartı onaylamaz; kişi her iddiayı görür, düzeltir, onaylar.
 */
export interface RepoSignalInput {
  ref: string; // owner/name
  signals: Record<string, unknown>;
}

export const DraftClaim = z.object({
  text: z.string().min(40).max(600), // 2–4 cümle: ne, hangi yığın, rol, süre, canlı/test durumu
  sourceRefs: z.array(z.string()).min(1), // birleşik iddia birden çok kaynağa bağlanır
  periodStart: z.string().nullable(), // YYYY-MM-DD
  periodEnd: z.string().nullable(),
});

export const CardDraft = z.object({
  headline: z.string().min(3).max(80),
  story: z.string().min(80).max(900),
  claims: z.array(DraftClaim).min(1).max(10),
});
export type CardDraft = z.infer<typeof CardDraft>;

const SYSTEM = `Sen GİRVAK'ın kart yazım asistanısın. Bir gencin bağladığı kaynakların (repo, belge, canlı
ürün) makine sinyallerini alırsın; ondan bir kurum temsilcisinin 1 dakikada okuyup "bu kişi ne
yapabiliyor" diyeceği bir yetkinlik kartı taslağı yazarsın. Kurallar:

İDDİA SAYISI VE BİRLEŞTİRME
- En az 4, en fazla 10 iddia. Repo başına iddia YAZMA; iş başına iddia yaz. Aynı türden birden çok
  repo (üç vitrin sitesi, iki deneme reposu, aynı ürünün web+api+mobil parçaları) TEK iddiada
  birleşir ve sourceRefs'e hepsi yazılır. Önemsiz, boş, tek commit'lik ya da fork repolar iddia
  olmaz; ancak bir birleşik iddianın parçası olabilir.
- Sıra: en çok şey söyleyen iş en üstte (uzun süre × yüksek sahiplik × yakın tarih × canlıda).

HER İDDİANIN İÇİ (2–4 cümle, 40–600 karakter)
- Ne yapıldı (ürün/iş, kime), hangi yığınla (diller + araçlar sinyalden), rol ve sahiplik
  (ownCommits ve authorshipRatio'dan: "tek başına", "iki kişilik ekipte ana geliştirici (%72)",
  "üç kişilik ekipte katkı (%28, 40 commit)"), süre ve dönem, canlıda mı (deployed/homepage),
  test/CI/Docker var mı. Sayıları sinyalden al; olmayan sayıyı uydurma.
- Kanıta dayanmayan sıfat yok ("uzman", "ileri düzey"). Abartma yok; küçük işi küçük yaz.

GİZLİLİK
- isPrivate: true olan repoların ADINI ve description'daki ürün adını iddiaya YAZMA; işi tarif et
  ("bir sözleşme yönetim platformu", "bir stok takip ürünü"). Kurumun/ekibin özel reposu kişinin
  kartından dışarı sızmamalı. Herkese açık repo adı yazılabilir ama gerekmez.

KAYNAK TÜRLERİ
- kind: "document" belgedir (docType, issuer, years, excerptLines): belgenin söylediğini aktar,
  fazlasını yazma. kind: "live_url" canlı üründür. kind: "network_reference" ve
  "challenge_submission" platform içi kayıttır; olduğu gibi aktar.

DİĞER
- Zaman aralığı: ownFirstCommitAt/ownLastCommitAt varsa onlardan, yoksa firstActivityAt/
  lastActivityAt; YYYY-MM-DD; bilinmiyorsa null. Birleşik iddiada en erken–en geç.
- headline: 3–8 kelime, kurumun anlayacağı konum ("Full-stack web ve mobil geliştirici").
- story: 3–5 cümle, kanıttan türeyen somut bir özet: kaç projede, hangi yığınlarla, ekip/tek,
  canlıda kaç iş, hangi dönem. Genel geçer cümle yok ("çeşitli projelerde yer aldım" YASAK).
- Türkçe, düz metin, markdown yok; teknoloji adları olduğu gibi.`;

export function buildCardMessages(login: string, repos: RepoSignalInput[]): LlmMessage[] {
  const govde = repos
    .map((r) => `### ${r.ref}\n${JSON.stringify(r.signals, null, 1)}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `GitHub kullanıcısı: ${login}\n\nREPOLAR VE SİNYALLER:\n${govde}\n\nKart taslağını üret.`,
    },
  ];
}

export async function runCardDrafter(llm: LlmProvider, login: string, repos: RepoSignalInput[]) {
  const { value, usage } = await llm.structured(buildCardMessages(login, repos), CardDraft, {
    schemaName: 'card_draft',
    maxTokens: 3000,
  });
  const gecerli = new Set(repos.map((r) => r.ref));
  // Uydurma kaynak referansı atılır; kaynaksız kalan iddia düşer.
  const claims = value.claims
    .map((c) => ({ ...c, sourceRefs: c.sourceRefs.filter((s) => gecerli.has(s)) }))
    .filter((c) => c.sourceRefs.length > 0);
  return { draft: { ...value, claims }, usage };
}
