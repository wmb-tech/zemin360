import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * ### Şema — ürün kimliği §1, ADR-0003, ADR-0004
 * Beş çekirdek nesne (talent/organization/need/match/collaboration) + kanıt katmanları +
 * ajan/onay tabloları. Tablo ve kolon adları İngilizce; yorumlar Türkçe.
 * ⚠ Ham kanıt içeriği (kod, belge metni) hiçbir tabloda saklanmaz — yalnız sinyal ve işaretçi.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const roleEnum = pgEnum('role', ['talent', 'organization', 'operator']);
export const evidenceLevelEnum = pgEnum('evidence_level', [
  'verified',
  'documented',
  'referenced',
  'declared',
]);
export const evidenceSourceKindEnum = pgEnum('evidence_source_kind', [
  'github_repo',
  'live_url',
  'document',
  'network_reference',
  'challenge_submission',
]);
export const collaborationTypeEnum = pgEnum('collaboration_type', [
  'internship',
  'project',
  'part_time',
  'full_time',
  'pilot_customer',
  'co_founder',
  'mentor',
]);
export const matchStrengthEnum = pgEnum('match_strength', ['strong', 'possible', 'weak']);
export const collaborationStatusEnum = pgEnum('collaboration_status', [
  'introduced',
  'meeting',
  'started',
  'ongoing',
  'completed',
  'did_not_happen',
]);
export const approvalStatusEnum = pgEnum('approval_status', [
  'proposed',
  'approved',
  'edited',
  'rejected',
]);
export const workModeEnum = pgEnum('work_mode', ['remote', 'onsite', 'hybrid']);
export const cardStatusEnum = pgEnum('card_status', ['draft', 'approved']);
export const challengeStatusEnum = pgEnum('challenge_status', [
  'draft',
  'open',
  'closed',
  'evaluated',
]);

/* ---------- Kimlik ---------- */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  // Genç GitHub OAuth ile gelir (KARAR-07); kurum/operatör sihirli link.
  githubId: text('github_id').unique(),
  githubLogin: text('github_login'),
  ...timestamps,
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Sihirli link (KARAR-07): tek kullanımlık, 15 dk, hash saklanır. */
export const loginTokens = pgTable('login_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Kişi kartı ---------- */

export const talents = pgTable('talents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline'),
  story: text('story'), // kanıttan otomatik yazılan hikâye bloğu; kişi düzenler
  city: text('city'),
  birthYear: integer('birth_year'),
  cardStatus: cardStatusEnum('card_status').default('draft').notNull(),
  cardApprovedAt: timestamp('card_approved_at', { withTimezone: true }),
  publicSlug: text('public_slug').unique(), // paylaşılabilir kart (keşfet)
  githubInstallationId: text('github_installation_id'), // KİŞİSEL kurulum (eski alan; github_installations asıl)
  lastSignalAt: timestamp('last_signal_at', { withTimezone: true }), // canlı ağ: sessiz kart
  ...timestamps,
});

/**
 * GitHub App kurulumları (doğrula 02). Bir genç birden fazla hesaba kurabilir: kişisel hesabı +
 * üye olduğu org'lar (gerçek iş çoğu zaman org reposunda). Org kurulumu, kişinin GitHub'daki
 * `/user/installations` listesinde görünüyorsa kabul edilir (IDOR kapısı); sahiplik iddiada
 * commit oranıyla ölçülür.
 */
export const githubInstallations = pgTable(
  'github_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talents.id, { onDelete: 'cascade' }),
    installationId: text('installation_id').notNull().unique(),
    accountLogin: text('account_login').notNull(),
    accountType: text('account_type').notNull(), // user | org
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('github_installations_talent_idx').on(t.talentId)],
);

/* ---------- Kanıt katmanları (ADR-0003) ---------- */

export const evidenceSources = pgTable(
  'evidence_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talents.id, { onDelete: 'cascade' }),
    kind: evidenceSourceKindEnum('kind').notNull(),
    // Kaynağa işaretçi: repo tam adı, URL, belge depolama anahtarı, referans veren kurum id'si
    ref: text('ref').notNull(),
    ownershipVerified: boolean('ownership_verified').default(false).notNull(),
    ownershipMethod: text('ownership_method'), // github_app | dns_meta | upload | org_account | platform
    verifyToken: text('verify_token'), // canlı URL: meta etiketi / well-known ile kanıtlanacak token
    lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('evidence_sources_talent_idx').on(t.talentId),
    // Aynı kaynak iki kez bağlanmaz; yeniden senkron mevcut kaydı kullanır
    uniqueIndex('evidence_sources_talent_ref_uq').on(t.talentId, t.kind, t.ref),
  ],
);

export const evidenceSignals = pgTable(
  'evidence_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => evidenceSources.id, { onDelete: 'cascade' }),
    // Makine tarafından çıkarılan olgular: { languages, tools, firstActivity, lastActivity,
    // authorshipRatio, contributors, deployed, hasTests, hasReadme, ... }
    signals: jsonb('signals').$type<Record<string, unknown>>().notNull(),
    extractedAt: timestamp('extracted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('evidence_signals_source_idx').on(t.sourceId)],
);

export const cardClaims = pgTable(
  'card_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talents.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    level: evidenceLevelEnum('level').notNull(),
    sourceIds: uuid('source_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    approved: boolean('approved').default(false).notNull(),
    // Taslak vs onay farkı ölçümü için: ajanın yazdığı orijinal metin
    draftText: text('draft_text'),
    ...timestamps,
  },
  (t) => [index('card_claims_talent_idx').on(t.talentId)],
);

/* ---------- Kurum ve ihtiyaç ---------- */

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  website: text('website'),
  city: text('city'),
  // Referans verme yetkisi yalnız GİRVAK onaylı kurumda (KARAR-10)
  approvedByOperatorAt: timestamp('approved_by_operator_at', { withTimezone: true }),
  ...timestamps,
});

export const organizationMembers = pgTable('organization_members', {
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const needs = pgTable(
  'needs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    rawText: text('raw_text').notNull(), // kurumun ilk yazdığı metin (netlik ölçümü için)
    card: jsonb('card').$type<Record<string, unknown>>(), // taslak/onaylı NeedCard
    // Ajanla soru-cevap geçmişi [{question, answer}] — netlik ölçümü ve yeniden çalıştırma için
    turns: jsonb('turns').$type<{ question: string; answer: string }[]>().default([]).notNull(),
    pendingQuestion: jsonb('pending_question').$type<{ text: string; why: string } | null>(),
    missingFields: text('missing_fields')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    cardStatus: cardStatusEnum('card_status').default('draft').notNull(),
    cardApprovedAt: timestamp('card_approved_at', { withTimezone: true }),
    // Operatör kısa listeyi onaylayınca kurum adayları görür (ADR-0004)
    shortlistPublishedAt: timestamp('shortlist_published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('needs_org_idx').on(t.organizationId)],
);

/* ---------- Eşleşme ve iş birliği ---------- */

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    needId: uuid('need_id')
      .notNull()
      .references(() => needs.id, { onDelete: 'cascade' }),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talents.id, { onDelete: 'cascade' }),
    strength: matchStrengthEnum('strength').notNull(),
    reasoning: jsonb('reasoning').$type<Record<string, unknown>>().notNull(), // MatchReasoning
    rank: integer('rank').notNull(),
    introducedAt: timestamp('introduced_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('matches_need_idx').on(t.needId), index('matches_talent_idx').on(t.talentId)],
);

export const collaborations = pgTable('collaborations', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id')
    .notNull()
    .unique()
    .references(() => matches.id, { onDelete: 'cascade' }),
  status: collaborationStatusEnum('status').default('introduced').notNull(),
  lastCheckinAt: timestamp('last_checkin_at', { withTimezone: true }),
  lastFollowUpAt: timestamp('last_follow_up_at', { withTimezone: true }), // son takip sorusu
  silentSince: timestamp('silent_since', { withTimezone: true }), // soru gitti, cevap yok
  talentFeedback: text('talent_feedback'),
  organizationFeedback: text('organization_feedback'),
  ...timestamps,
});

export const checkinSideEnum = pgEnum('checkin_side', ['talent', 'organization']);

/**
 * Takip sorusu kaydı (döngü adımı: izle 06). Her tur iki satır (genç + kurum), aynı `batchId`.
 * Token e-postadaki linktir; giriş gerektirmez, tek kullanımlık. Cevap = durum + serbest metin;
 * ajan metni yorumlar (`insight`), operatör yalnız bayraklı olanı okur.
 */
export const collaborationCheckins = pgTable(
  'collaboration_checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collaborationId: uuid('collaboration_id')
      .notNull()
      .references(() => collaborations.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull(),
    side: checkinSideEnum('side').notNull(),
    tokenHash: text('token_hash').notNull().unique(), // ham token yalnız e-postada (auth/tokens ile aynı ilke)
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    status: collaborationStatusEnum('status'),
    feedback: text('feedback'),
    insight: jsonb('insight').$type<Record<string, unknown>>(), // CheckinInsight
  },
  (t) => [index('collaboration_checkins_collab_idx').on(t.collaborationId)],
);

/* ---------- Ajan ve onay (ADR-0002, ADR-0004) ---------- */

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent: text('agent').notNull(), // card_drafter | need_structurer | matcher | follow_up | ...
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  inputSummary: jsonb('input_summary').$type<Record<string, unknown>>(),
  outputSummary: jsonb('output_summary').$type<Record<string, unknown>>(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  durationMs: integer('duration_ms').notNull(),
  costUsd: text('cost_usd'), // numeric string; parasal hesap yapılmıyor, rapor için
  // Sonraki insan eylemi: approved | edited | rejected | null (ölçüm paneli)
  humanOutcome: text('human_outcome'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvalQueue = pgTable(
  'approval_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(), // introduce | send_follow_up | invite | publish_shortlist
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(), // ajanın önerdiği içerik
    status: approvalStatusEnum('status').default('proposed').notNull(),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    editedPayload: jsonb('edited_payload').$type<Record<string, unknown>>(),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('approval_queue_status_idx').on(t.status)],
);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  detail: jsonb('detail').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Meydan okuma (döngü adımı: keşfet 01) ---------- */

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    needId: uuid('need_id').references(() => needs.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    brief: text('brief').notNull(), // görev metni (markdown)
    // Rubrik: [{ name, weight, description }] — değerlendirme ajanı buna göre puanlar
    rubric: jsonb('rubric')
      .$type<{ name: string; weight: number; description: string }[]>()
      .notNull(),
    durationHours: integer('duration_hours').notNull(),
    status: challengeStatusEnum('status').default('draft').notNull(),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('challenges_status_idx').on(t.status)],
);

export const challengeSubmissions = pgTable(
  'challenge_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talents.id, { onDelete: 'cascade' }),
    repoUrl: text('repo_url').notNull(),
    note: text('note'),
    // Değerlendirme: { band, scores: [{name, score, comment}], strengths, gaps, summary } — ham kod yok
    evaluation: jsonb('evaluation').$type<Record<string, unknown>>(),
    rank: integer('rank'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('challenge_submissions_uq').on(t.challengeId, t.talentId)],
);

/**
 * Keşif davet kaydı (keşfet 01): aynı GitHub kullanıcısına kısa aralıkla ikinci davet gitmesin.
 * Yalnız login + zaman; profil verisi saklanmaz (ADR-0007).
 */
export const scoutInvites = pgTable('scout_invites', {
  login: text('login').primaryKey(),
  needId: uuid('need_id').references(() => needs.id, { onDelete: 'set null' }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
});
