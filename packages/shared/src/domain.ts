import { z } from 'zod';

/**
 * ### Alan sözlüğü — ürün kimliği §1 ve ADR-0003
 * Beş nesne: kişi kartı, kurum kartı, ihtiyaç kartı, eşleşme, iş birliği kaydı.
 * Buradaki şemalar API, web ve mobilin ortak dilidir; UI kendi tipini uydurmaz.
 */

export const Role = z.enum(['talent', 'organization', 'operator']);
export type Role = z.infer<typeof Role>;

/** Kanıt seviyesi (ADR-0003). Sıra önemli: en güçlüden en zayıfa. */
export const EvidenceLevel = z.enum(['verified', 'documented', 'referenced', 'declared']);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

export const EvidenceSourceKind = z.enum([
  'github_repo',
  'live_url',
  'document',
  'network_reference',
  'challenge_submission',
]);
export type EvidenceSourceKind = z.infer<typeof EvidenceSourceKind>;

/** İş birliği türleri (KARAR-13). İstihdamla sınırlı değil. */
export const CollaborationType = z.enum([
  'internship',
  'project',
  'part_time',
  'full_time',
  'pilot_customer',
  'co_founder',
  'mentor',
]);
export type CollaborationType = z.infer<typeof CollaborationType>;

/** Eşleşme gücü (KARAR-08): sayı yok, üç seviye. */
export const MatchStrength = z.enum(['strong', 'possible', 'weak']);
export type MatchStrength = z.infer<typeof MatchStrength>;

/** İş birliği kaydının yaşam döngüsü (döngü adımı: izle). */
export const CollaborationStatus = z.enum([
  'introduced',
  'meeting',
  'started',
  'ongoing',
  'completed',
  'did_not_happen',
]);
export type CollaborationStatus = z.infer<typeof CollaborationStatus>;

/** Onay kuyruğu (ADR-0004). */
export const ApprovalStatus = z.enum(['proposed', 'approved', 'edited', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const WorkMode = z.enum(['remote', 'onsite', 'hybrid']);
export type WorkMode = z.infer<typeof WorkMode>;

/** Kartta görünen tek bir iddia. Kaynağı olmayan iddia yalnız `declared` olabilir. */
export const CardClaim = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(280),
  level: EvidenceLevel,
  sourceIds: z.array(z.string().uuid()),
  periodStart: z.string().date().nullable(),
  periodEnd: z.string().date().nullable(),
  approved: z.boolean(),
});
export type CardClaim = z.infer<typeof CardClaim>;

/** Ajanın ihtiyaç metninden çıkardığı yapılandırılmış kart (döngü adımı: tanımla). */
export const NeedCard = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(1000),
  collaborationType: CollaborationType,
  expectedOutput: z.string().min(3).max(500),
  durationWeeks: z.number().int().positive().nullable(),
  workMode: WorkMode,
  compensation: z.string().max(200).nullable(),
  requiredSkills: z.array(z.string().min(1)).max(12),
  niceToHaveSkills: z.array(z.string().min(1)).max(12),
  worksWith: z.string().max(200).nullable(),
  constraints: z.array(z.string()).max(10),
});
export type NeedCard = z.infer<typeof NeedCard>;

/** Onay anında kurumun elle düzelttiği alanlar. */
export const NeedCardEdits = NeedCard.partial();
export type NeedCardEdits = z.infer<typeof NeedCardEdits>;

/** Gerekçeli eşleşme çıktısı (döngü adımı: eşleştir). */
export const MatchReasoning = z.object({
  strength: MatchStrength,
  fits: z.array(z.object({ text: z.string(), claimIds: z.array(z.string().uuid()) })),
  gaps: z.array(z.string()),
  summaryForOrganization: z.string().max(600),
});
export type MatchReasoning = z.infer<typeof MatchReasoning>;

/** Eşleşme ajanının tek çağrıda döndürdüğü sıralı liste (ADR-0002: şemalı çıktı). */
export const MatchBatchResult = z.object({
  results: z.array(MatchReasoning.extend({ talentId: z.string().uuid() })).max(20),
});
export type MatchBatchResult = z.infer<typeof MatchBatchResult>;

/** Onay kuyruğundaki eylem türleri (ADR-0004). */
export const ApprovalAction = z.enum([
  'publish_shortlist',
  'introduce',
  'send_follow_up',
  'invite',
]);
export type ApprovalAction = z.infer<typeof ApprovalAction>;

/** Meydan okuma tasarımı (ajan çıktısı): ihtiyaçtan 24–48 saatlik görev + rubrik. */
export const ChallengeDesign = z.object({
  title: z.string().min(5).max(120),
  brief: z.string().min(80).max(4000),
  durationHours: z.union([z.literal(24), z.literal(48)]),
  rubric: z
    .array(
      z.object({
        name: z.string().min(3).max(60),
        weight: z.number().int().min(1).max(5),
        description: z.string().min(10).max(300),
      }),
    )
    .min(3)
    .max(6),
});
export type ChallengeDesign = z.infer<typeof ChallengeDesign>;

export const EvaluationBand = z.enum(['strong', 'solid', 'partial', 'incomplete']);
export type EvaluationBand = z.infer<typeof EvaluationBand>;

/** Teslim değerlendirmesi (ajan çıktısı). Puan rubrik ölçütü başına 0–5; bant özet. */
export const SubmissionEvaluation = z.object({
  band: EvaluationBand,
  scores: z.array(
    z.object({
      name: z.string(),
      score: z.number().int().min(0).max(5),
      comment: z.string().max(300),
    }),
  ),
  strengths: z.array(z.string()).max(5),
  gaps: z.array(z.string()).max(5),
  summary: z.string().max(600),
  evidenceClaim: z.string().min(10).max(240), // kişinin kartına girecek tek cümle
});
export type SubmissionEvaluation = z.infer<typeof SubmissionEvaluation>;

/** Takip sorusu (döngü adımı: izle 06). İki tarafa ayrı, kısa, tek soru — ajan taslağı. */
export const FollowUpDraft = z.object({
  subject: z.string().min(5).max(120),
  messageTalent: z.string().min(40).max(1200),
  messageOrganization: z.string().min(40).max(1200),
});
export type FollowUpDraft = z.infer<typeof FollowUpDraft>;

export const CheckinSide = z.enum(['talent', 'organization']);
export type CheckinSide = z.infer<typeof CheckinSide>;

/** Serbest metin cevabın ajan yorumu: operatörün okuması gereken şey var mı? */
export const CheckinFlag = z.enum([
  'no_contact', // taraflar hiç görüşememiş
  'schedule', // zaman/takvim sorunu
  'scope', // iş tanımı değişti/belirsiz
  'payment', // ücret/ödeme sorunu
  'communication', // iletişim kopuk
  'positive', // olumlu ilerliyor
  'ended', // bitmiş / bitmek üzere
]);
export type CheckinFlag = z.infer<typeof CheckinFlag>;

export const CheckinInsight = z.object({
  summary: z.string().min(5).max(300),
  flags: z.array(CheckinFlag).max(4),
  needsOperator: z.boolean(),
  operatorNote: z.string().max(300).nullable(),
  // Yalnız kurum "tamamlandı" dediğinde: kişinin kartına girecek tek cümle (KARAR-10)
  referenceClaim: z.string().min(20).max(300).nullable(),
});
export type CheckinInsight = z.infer<typeof CheckinInsight>;

/**
 * Döngünün zaman eşikleri (gün). Ürün kuralıdır, kod sabiti değil: web de gösterir
 * ("3 gün sonra sorarız", "90 gündür sessiz"). Değişince tek yerden.
 */
export const THRESHOLDS = {
  followUpAfterDays: 3, // tanıştırma/son hareketten sonra takip sorusu
  silentCollaborationAfterDays: 5, // soru gitti, cevap yok → sessiz iş birliği
  silentCardAfterDays: 90, // kanıtta etkinlik yok → sessiz kart
  evidenceRefreshAfterDays: 7, // GitHub kaynakları yeniden okunur
  scoutReinviteAfterDays: 90, // aynı GitHub kullanıcısına ikinci davet için bekleme
} as const;

/** Keşif ajanı çıktısı (keşfet 01): ağ dışı adaylardan davet edilmeye değer olanlar, gerekçeli. */
export const ScoutPick = z.object({
  login: z.string().min(1),
  fit: z.enum(['strong', 'possible']),
  why: z.string().min(10).max(300), // herkese açık sinyale bağlı somut gerekçe
  inviteLine: z.string().min(20).max(300), // davet e-postasına girecek kişiye özel tek cümle
});
export const ScoutBatchResult = z.object({ picks: z.array(ScoutPick).max(10) });
export type ScoutPick = z.infer<typeof ScoutPick>;
export type ScoutBatchResult = z.infer<typeof ScoutBatchResult>;

/** Tanıştırma e-postası taslağı (ajan çıktısı): iki tarafa tek mesaj, operatör düzenler/onaylar. */
export const IntroDraft = z.object({
  subject: z.string().min(5).max(120),
  message: z.string().min(80).max(1500),
});
export type IntroDraft = z.infer<typeof IntroDraft>;
