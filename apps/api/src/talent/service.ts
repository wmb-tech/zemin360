import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  cardClaims,
  challenges,
  collaborations,
  evidenceSignals,
  evidenceSources,
  githubInstallations,
  matches,
  needs,
  organizations,
  talents,
  users,
} from '@evidex/db';
import { runCardDrafter, type LlmProvider } from '@evidex/ai';
import type { DocumentEvidence, GithubEvidence, LiveUrlEvidence } from '@evidex/evidence';
import { newRawToken } from '../auth/tokens';
import { assertPublicUrl } from '@evidex/evidence';
import { MatchReasoning } from '@evidex/shared';
import { recordAgentRun } from '../agents/runs';
import { AppError } from '../lib/response';
import { skillsForTalent } from './skills';
import { isSilentCard } from '../network/service';

// Okuma üst sınırı: tüm kurulumlar birleşik, en son itilen önce. 20 yetmedi (ilk gerçek kullanıcı:
// kişisel hesap 20'yi doldurdu, org repoları hiç okunmadı).
const MAX_REPOS = 40;

/**
 * ### Genç servisi — döngü adımı: doğrula (02)
 * GitHub App kurulumu → repolar kaynak olur → sinyal çıkarılır → ajan taslak iddialar yazar →
 * kişi iddiaları tek tek onaylar/düzeltir/siler → kartı onaylar. Onaylı iddialar yeniden
 * senkronda korunur; yalnız onaysız taslaklar yenilenir.
 * ⚠ Ham kod hiçbir yerde tutulmaz; evidence_signals yalnız makine sinyali (ADR-0003).
 */
/** Kaynak sinyallerindeki en yeni etkinlik tarihi (GitHub lastActivityAt, teslim lastCommitAt). Canlı URL tarih taşımaz. */
function sonEtkinlik(inputs: { signals: Record<string, unknown> }[]): Date | null {
  let en: Date | null = null;
  for (const i of inputs) {
    for (const k of ['lastActivityAt', 'lastCommitAt']) {
      const v = i.signals[k];
      if (typeof v !== 'string') continue;
      const d = new Date(v);
      if (!Number.isNaN(d.getTime()) && (!en || d > en)) en = d;
    }
  }
  return en;
}

export function createTalentService(
  db: Db,
  llm: LlmProvider,
  github: GithubEvidence | null,
  liveUrl: LiveUrlEvidence,
  document: DocumentEvidence,
) {
  async function talentOf(userId: string) {
    const [satir] = await db
      .select({ talent: talents, user: users })
      .from(talents)
      .innerJoin(users, eq(users.id, talents.userId))
      .where(eq(talents.userId, userId))
      .limit(1);
    if (!satir) throw new AppError('no_talent', 'Bu hesabın kişi kartı yok', 403);
    return satir;
  }

  /**
   * Tüm doğrulanmış kaynakların son sinyallerinden kartı yeniden taslakla. Onaylı iddialar
   * korunur; yalnız onaysız taslaklar yenilenir. İddia seviyesi: tüm kaynakları doğrulanmışsa
   * verified, değilse declared.
   */
  async function redraft(talentId: string, login: string) {
    const kaynaklar = await db
      .select()
      .from(evidenceSources)
      .where(eq(evidenceSources.talentId, talentId));
    const inputs: { ref: string; signals: Record<string, unknown> }[] = [];
    for (const k of kaynaklar) {
      const [son] = await db
        .select({ signals: evidenceSignals.signals })
        .from(evidenceSignals)
        .where(eq(evidenceSignals.sourceId, k.id))
        .orderBy(desc(evidenceSignals.extractedAt))
        .limit(1);
      if (son)
        inputs.push({
          ref: k.ref,
          signals: { kind: k.kind, ownershipVerified: k.ownershipVerified, ...son.signals },
        });
    }
    // Onaylı bir iddianın kapsadığı kaynak ajana yeniden verilmez: "yeniden oku" aynı repo için
    // ikinci bir taslak üretmesin (ilk gerçek kullanıcıda görüldü). Yeni kaynak yoksa çağrı da yok.
    const onayliKaynaklar = new Set(
      (
        await db
          .select({ sourceIds: cardClaims.sourceIds })
          .from(cardClaims)
          .where(and(eq(cardClaims.talentId, talentId), eq(cardClaims.approved, true)))
      ).flatMap((c) => c.sourceIds),
    );
    const idOf = new Map(kaynaklar.map((k) => [k.ref, k.id]));
    const yeniInputs = inputs.filter((i) => !onayliKaynaklar.has(idOf.get(i.ref) ?? ''));
    await db
      .delete(cardClaims)
      .where(and(eq(cardClaims.talentId, talentId), eq(cardClaims.approved, false)));
    if (yeniInputs.length === 0) return;
    let draft: Awaited<ReturnType<typeof runCardDrafter>>['draft'];
    let usage: Awaited<ReturnType<typeof runCardDrafter>>['usage'];
    try {
      ({ draft, usage } = await runCardDrafter(llm, login, yeniInputs));
    } catch (err) {
      // Ajan/model hatası kişinin kendi kartıyla ilgilidir ve gizli bir şey taşımaz; sebebi
      // göster ki "Beklenmeyen hata" ile kör kalınmasın (kaynaklar okunmuş kalır, tekrar denenir).
      console.error('[card_drafter] taslak yazılamadı', err);
      throw new AppError(
        'draft_failed',
        `Kaynaklar okundu ama taslak yazılamadı: ${err instanceof Error ? err.message : String(err)}. Tekrar dene; sürerse GİRVAK'a yaz.`,
        502,
      );
    }
    await recordAgentRun(db, {
      agent: 'card_drafter',
      subjectType: 'talent',
      subjectId: talentId,
      inputSummary: { sources: inputs.length },
      outputSummary: { claims: draft.claims.length },
      usage,
    });
    // Model tarih alanını bazen "2026-09" ya da "2026" yazar; Postgres date bunu reddeder ve
    // bütün taslak 500 olur. Ay/yıl → ilk gün, geçersiz → null.
    const tarih = (v: string | null): string | null => {
      if (!v) return null;
      const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(v.trim());
      if (!m) return null;
      const iso = `${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}`;
      return Number.isNaN(Date.parse(iso)) ? null : iso;
    };
    const refToSource = new Map(kaynaklar.map((k) => [k.ref, k]));
    if (draft.claims.length) {
      await db.insert(cardClaims).values(
        draft.claims.map((c) => {
          const srcs = c.sourceRefs
            .map((r) => refToSource.get(r))
            .filter((x): x is NonNullable<typeof x> => Boolean(x));
          return {
            talentId,
            text: c.text,
            draftText: c.text,
            // Seviye kaynaktan (ADR-0003): hepsi sahiplik-doğrulanmış → verified; belge varsa
            // documented; aksi hâlde declared. Ajan seviye vermez.
            level: srcs.every((x) => x.ownershipVerified)
              ? ('verified' as const)
              : srcs.some((x) => x.kind === 'document')
                ? ('documented' as const)
                : ('declared' as const),
            sourceIds: srcs.map((x) => x.id),
            periodStart: tarih(c.periodStart),
            periodEnd: tarih(c.periodEnd),
            approved: false,
          };
        }),
      );
    }
    const [t] = await db.select().from(talents).where(eq(talents.id, talentId)).limit(1);
    await db
      .update(talents)
      .set({
        headline: t?.headline ?? draft.headline,
        story: t?.story ?? draft.story,
        // Sessiz kart ölçütü (canlı tut 04): taslağın yazıldığı an değil, kanıttaki son etkinlik.
        lastSignalAt: sonEtkinlik(inputs) ?? t?.lastSignalAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(talents.id, talentId));
  }

  /**
   * Onaylı kartın onaylı iddiası kalmadıysa taslağa döner: "ağda ama boş kart" olmaz (kapı
   * approveCard'daki kuralın aynası). Yeni taslağı onaylayınca aynı akışla tekrar ağa girer.
   */
  async function kartiKontrolEt(talentId: string) {
    const [t] = await db.select().from(talents).where(eq(talents.id, talentId)).limit(1);
    if (!t || t.cardStatus !== 'approved') return;
    const [n] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cardClaims)
      .where(and(eq(cardClaims.talentId, talentId), eq(cardClaims.approved, true)));
    if ((n?.n ?? 0) === 0)
      await db
        .update(talents)
        .set({ cardStatus: 'draft', updatedAt: new Date() })
        .where(eq(talents.id, talentId));
  }

  return {
    async card(userId: string) {
      const { talent, user } = await talentOf(userId);
      const installations = await db
        .select({
          id: githubInstallations.id,
          accountLogin: githubInstallations.accountLogin,
          accountType: githubInstallations.accountType,
          lastSyncedAt: githubInstallations.lastSyncedAt,
        })
        .from(githubInstallations)
        .where(eq(githubInstallations.talentId, talent.id))
        .orderBy(githubInstallations.createdAt);
      const sources = await db
        .select()
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, talent.id));
      const claims = await db
        .select()
        .from(cardClaims)
        .where(eq(cardClaims.talentId, talent.id))
        .orderBy(cardClaims.createdAt);
      return {
        talent: {
          id: talent.id,
          headline: talent.headline,
          story: talent.story,
          city: talent.city,
          cardStatus: talent.cardStatus,
          githubConnected: installations.length > 0,
          installations,
          lastSignalAt: talent.lastSignalAt,
          // Canlı tut (04): kaynak var ama uzun süredir etkinlik yok → genç uyarı görür
          silent: sources.length > 0 && isSilentCard(talent.lastSignalAt),
          publicSlug: talent.publicSlug,
        },
        user: { name: user.name, githubLogin: user.githubLogin },
        sources,
        claims,
        skills: await skillsForTalent(db, talent.id),
      };
    },

    /**
     * Kurulumu kaydetmeden önce sahibini doğrular: installation_id callback'te kullanıcı
     * kontrolündedir; başkasının kurulumunu kendi kartına bağlamak (IDOR) 403 ile düşer.
     */
    /**
     * Gencin ana sayfası (canlı tut 04): "şimdi ne olacak". Eşleşmeler kısa liste yayınlandıktan
     * sonra görünür; kurum adı tanıştırmaya kadar gizli (KARAR-09'un simetriği), ihtiyaç başlığı
     * ve güç görünür. İş birlikleri durumuyla; açık meydan okuma sayısı.
     */
    async overview(userId: string) {
      const { talent } = await talentOf(userId);
      const [kaynakSayisi] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, talent.id));
      const [iddia] = await db
        .select({
          n: sql<number>`count(*)::int`,
          onayli: sql<number>`count(*) filter (where ${cardClaims.approved})::int`,
        })
        .from(cardClaims)
        .where(eq(cardClaims.talentId, talent.id));
      const eslesmeler = await db
        .select({
          matchId: matches.id,
          strength: matches.strength,
          reasoning: matches.reasoning,
          introducedAt: matches.introducedAt,
          needTitle: sql<string | null>`${needs.card}->>'title'`,
          collaborationType: sql<string | null>`${needs.card}->>'collaborationType'`,
          orgName: organizations.name,
          orgCity: organizations.city,
          status: collaborations.status,
          shortlistPublishedAt: needs.shortlistPublishedAt,
        })
        .from(matches)
        .innerJoin(needs, eq(needs.id, matches.needId))
        .innerJoin(organizations, eq(organizations.id, needs.organizationId))
        .leftJoin(collaborations, eq(collaborations.matchId, matches.id))
        .where(eq(matches.talentId, talent.id))
        .orderBy(desc(matches.createdAt));
      const [acik] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(challenges)
        .where(eq(challenges.status, 'open'));
      return {
        card: {
          status: talent.cardStatus,
          silent: (kaynakSayisi?.n ?? 0) > 0 && isSilentCard(talent.lastSignalAt),
          sources: kaynakSayisi?.n ?? 0,
          claims: iddia?.n ?? 0,
          approvedClaims: iddia?.onayli ?? 0,
          publicSlug: talent.publicSlug,
          lastSignalAt: talent.lastSignalAt,
        },
        matches: eslesmeler
          .filter((m) => m.shortlistPublishedAt)
          .map((m) => {
            // Gerekçe ajanın kaydettiği MatchReasoning'den; ilk "uyuyor" ve ilk "eksik" — uydurma yok.
            const r = MatchReasoning.safeParse(m.reasoning);
            return {
              matchId: m.matchId,
              strength: m.strength,
              needTitle: m.needTitle,
              collaborationType: m.collaborationType,
              // Tanıştırma öncesi kurum adı yok: "İstanbul'da bir kurum"
              organization: m.introducedAt ? m.orgName : null,
              city: m.orgCity,
              introduced: Boolean(m.introducedAt),
              collaborationStatus: m.status ?? null,
              fit: r.success ? (r.data.fits[0]?.text ?? null) : null,
              gap: r.success ? (r.data.gaps[0] ?? null) : null,
            };
          }),
        openChallenges: acik?.n ?? 0,
        // Son kaynaklar: gerçek zaman damgaları (bağlanma / son okuma) — sahte etkinlik akışı değil.
        recentSources: await db
          .select({
            id: evidenceSources.id,
            kind: evidenceSources.kind,
            ref: evidenceSources.ref,
            verified: evidenceSources.ownershipVerified,
            createdAt: evidenceSources.createdAt,
            lastScannedAt: evidenceSources.lastScannedAt,
          })
          .from(evidenceSources)
          .where(eq(evidenceSources.talentId, talent.id))
          .orderBy(desc(evidenceSources.createdAt))
          .limit(5),
        pendingClaims: (iddia?.n ?? 0) - (iddia?.onayli ?? 0),
      };
    },

    /**
     * Kurulumu kaydetmeden önce sahibini doğrular. Kişisel hesap: sahip id == kullanıcının
     * GitHub id'si. Org: kurulum, kullanıcının OAuth token'ıyla GitHub'dan çekilen
     * `/user/installations` listesinde olmalı (başkasının installation_id'si → 403, IDOR).
     * Org reposunda "sahiplik" repo sahipliği değil commit sahipliğidir; iddiada oran yazılır.
     */
    async saveInstallation(userId: string, installationId: string, userToken?: string) {
      if (!github) throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
      const { talent, user } = await talentOf(userId);
      const sahip = await github.installationOwner(installationId);
      if (!sahip || !user.githubId)
        throw new AppError('installation_owner_mismatch', 'Kurulum bulunamadı', 403);
      const kisisel = sahip.type === 'user' && sahip.id === user.githubId;
      if (!kisisel) {
        const erisilebilir = userToken ? await github.userInstallationIds(userToken) : [];
        if (sahip.type !== 'org' || !erisilebilir.includes(installationId))
          throw new AppError(
            'installation_owner_mismatch',
            'Bu kurulum bu GitHub hesabına ait değil',
            403,
          );
      }
      await db
        .insert(githubInstallations)
        .values({
          talentId: talent.id,
          installationId,
          accountLogin: sahip.login,
          accountType: sahip.type,
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: { talentId: talent.id, accountLogin: sahip.login, accountType: sahip.type },
        });
      if (kisisel)
        await db
          .update(talents)
          .set({ githubInstallationId: installationId, updatedAt: new Date() })
          .where(eq(talents.id, talent.id));
    },

    /** Kurulumdaki repoları oku, sinyal çıkar, taslak iddiaları yenile. */
    async syncGithub(userId: string, opts: { all?: boolean } = {}) {
      if (!github) throw new AppError('not_configured', 'GitHub App yapılandırılmamış', 503);
      const { talent, user } = await talentOf(userId);
      const kurulumlar = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.talentId, talent.id));
      if (kurulumlar.length === 0)
        throw new AppError('github_not_connected', 'Önce GitHub bağlantısı kur', 409);
      if (!user.githubLogin)
        throw new AppError('github_login_missing', 'GitHub kullanıcı adı yok', 409);

      // Kurulum başına repo listesi; toplam üst sınır MAX_REPOS (en son itilenler önce gelir).
      const repos: { installationId: string; fullName: string; org: boolean; pushedAt: string }[] =
        [];
      for (const k of kurulumlar) {
        for (const r of await github.listRepos(k.installationId))
          repos.push({
            installationId: k.installationId,
            fullName: r.fullName,
            org: k.accountType === 'org',
            pushedAt: r.pushedAt ?? '',
          });
      }
      // Sıra: hiç okunmamış repolar önce (en son itilen başta), sonra en eski taranandan yeniye.
      // Böylece kişinin "yeniden oku"su sıradaki yeni repoları getirir, haftalık yenileme (04)
      // en bayat kaynakları tazeler; ikisi aynı fonksiyon. `all` ile üst sınır kalkar (kartı
      // sıfırdan yazarken tüm kaynakların güncel bağlamı — README özeti — gerekir).
      const taramalar = new Map(
        (
          await db
            .select({ ref: evidenceSources.ref, at: evidenceSources.lastScannedAt })
            .from(evidenceSources)
            .where(
              and(eq(evidenceSources.talentId, talent.id), eq(evidenceSources.kind, 'github_repo')),
            )
        ).map((k) => [k.ref, k.at?.getTime() ?? 0]),
      );
      const okunmus = new Set([...taramalar.keys()]);
      repos.sort((a, b) => {
        const at = taramalar.get(a.fullName) ?? -1;
        const bt = taramalar.get(b.fullName) ?? -1;
        if (at !== bt) return at - bt;
        return a.pushedAt < b.pushedAt ? 1 : a.pushedAt > b.pushedAt ? -1 : 0;
      });
      const secilen = opts.all ? repos : repos.slice(0, MAX_REPOS);
      const okunmayan =
        repos.filter((r) => !okunmus.has(r.fullName)).length -
        secilen.filter((r) => !okunmus.has(r.fullName)).length;
      const repoInputs: { ref: string; signals: Record<string, unknown> }[] = [];
      let atlanan = 0;

      let okunamayan = 0;
      for (const r of secilen) {
        let signals: Awaited<ReturnType<typeof github.extract>>;
        try {
          signals = await github.extract(r.installationId, r.fullName, user.githubLogin);
        } catch (err) {
          // Tek bozuk repo (boş, arşivli, izin) 60 reponun okumasını düşürmesin; sayılır, geçilir.
          okunamayan++;
          console.error(`[sync] repo okunamadı ${r.fullName}`, err);
          continue;
        }
        // Org reposu yalnız kişinin commit'i varsa kanıttır: üyelik tek başına bir şey kanıtlamaz.
        // Daha önce girmişse (eski kural) kaynak da silinir; bağlı taslak iddia redraft'ta düşer.
        if (r.org && !(signals.ownCommits && signals.ownCommits > 0)) {
          atlanan++;
          await db
            .delete(evidenceSources)
            .where(
              and(eq(evidenceSources.talentId, talent.id), eq(evidenceSources.ref, r.fullName)),
            );
          continue;
        }
        const [kaynak] = await db
          .insert(evidenceSources)
          .values({
            talentId: talent.id,
            kind: 'github_repo',
            ref: r.fullName,
            ownershipVerified: true,
            ownershipMethod: 'github_app',
            lastScannedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();
        const sourceId =
          kaynak?.id ??
          (
            await db
              .select({ id: evidenceSources.id })
              .from(evidenceSources)
              .where(
                and(eq(evidenceSources.talentId, talent.id), eq(evidenceSources.ref, r.fullName)),
              )
              .limit(1)
          )[0]!.id;

        await db
          .insert(evidenceSignals)
          .values({ sourceId, signals: signals as Record<string, unknown> });
        await db
          .update(evidenceSources)
          .set({ lastScannedAt: new Date() })
          .where(eq(evidenceSources.id, sourceId));
        repoInputs.push({ ref: r.fullName, signals: signals as Record<string, unknown> });
      }

      await redraft(talent.id, user.githubLogin);
      await db
        .update(githubInstallations)
        .set({ lastSyncedAt: new Date() })
        .where(eq(githubInstallations.talentId, talent.id));
      return {
        ...(await this.card(userId)),
        skippedOrgRepos: atlanan,
        unreadRepos: okunmayan,
        failedRepos: okunamayan,
      };
    },

    /** Kurulumu kaldır: o hesabın repolarından gelen kaynaklar ve onaysız iddiaları düşer. */
    async removeInstallation(userId: string, id: string) {
      const { talent, user } = await talentOf(userId);
      const [k] = await db
        .delete(githubInstallations)
        .where(and(eq(githubInstallations.id, id), eq(githubInstallations.talentId, talent.id)))
        .returning();
      if (!k) throw new AppError('not_found', 'Kurulum bulunamadı', 404);
      await db
        .delete(evidenceSources)
        .where(
          and(
            eq(evidenceSources.talentId, talent.id),
            eq(evidenceSources.kind, 'github_repo'),
            sql`${evidenceSources.ref} like ${k.accountLogin + '/%'}`,
          ),
        );
      if (talent.githubInstallationId === k.installationId)
        await db
          .update(talents)
          .set({ githubInstallationId: null, updatedAt: new Date() })
          .where(eq(talents.id, talent.id));
      await redraft(talent.id, user.githubLogin ?? user.name);
      return this.card(userId);
    },

    async updateClaim(
      userId: string,
      claimId: string,
      patch: { text?: string | undefined; approved?: boolean | undefined },
    ) {
      const { talent } = await talentOf(userId);
      const [guncel] = await db
        .update(cardClaims)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(cardClaims.id, claimId), eq(cardClaims.talentId, talent.id)))
        .returning();
      if (!guncel) throw new AppError('not_found', 'İddia bulunamadı', 404);
      if (patch.approved === false) await kartiKontrolEt(talent.id);
      return guncel;
    },

    /** Toplu işlem: seçili iddiaları onayla / onayı kaldır / sil. Yalnız kişinin kendi iddiaları. */
    async bulkClaims(userId: string, ids: string[], action: 'approve' | 'unapprove' | 'delete') {
      const { talent } = await talentOf(userId);
      const kosul = and(eq(cardClaims.talentId, talent.id), inArray(cardClaims.id, ids));
      const etkilenen =
        action === 'delete'
          ? await db.delete(cardClaims).where(kosul).returning({ id: cardClaims.id })
          : await db
              .update(cardClaims)
              .set({ approved: action === 'approve', updatedAt: new Date() })
              .where(kosul)
              .returning({ id: cardClaims.id });
      if (action !== 'approve') await kartiKontrolEt(talent.id);
      return { ...(await this.card(userId)), affected: etkilenen.length };
    },

    async deleteClaim(userId: string, claimId: string) {
      const { talent } = await talentOf(userId);
      const silinen = await db
        .delete(cardClaims)
        .where(and(eq(cardClaims.id, claimId), eq(cardClaims.talentId, talent.id)))
        .returning({ id: cardClaims.id });
      if (!silinen.length) throw new AppError('not_found', 'İddia bulunamadı', 404);
      await kartiKontrolEt(talent.id);
    },

    async updateProfile(
      userId: string,
      patch: {
        headline?: string | undefined;
        story?: string | undefined;
        city?: string | undefined;
      },
    ) {
      const { talent } = await talentOf(userId);
      await db
        .update(talents)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return this.card(userId);
    },

    /**
     * Kartı sıfırdan yaz: tüm iddialar (onaylılar dahil) silinir, tüm kaynaklardan yeni taslak
     * çıkar. Kart onaylıysa taslağa DÖNER — onaysız iddiayla ağda kalmak gate'i deler. Kişi
     * yeni taslağı onaylayınca aynı akışla tekrar ağa girer; eşleşmeler silinmez.
     */
    async rewriteCard(userId: string) {
      const { talent, user } = await talentOf(userId);
      await db.delete(cardClaims).where(eq(cardClaims.talentId, talent.id));
      if (talent.cardStatus === 'approved')
        await db
          .update(talents)
          .set({ cardStatus: 'draft', updatedAt: new Date() })
          .where(eq(talents.id, talent.id));
      const kurulum = await db
        .select({ id: githubInstallations.id })
        .from(githubInstallations)
        .where(eq(githubInstallations.talentId, talent.id))
        .limit(1);
      // GitHub bağlıysa tüm repolar güncel sinyalle (README özeti dahil) yeniden okunur; sync
      // sonunda redraft zaten koşar. Bağlı değilse mevcut sinyallerden yazılır.
      if (kurulum.length > 0) return this.syncGithub(userId, { all: true });
      await redraft(talent.id, user.githubLogin ?? user.name);
      return this.card(userId);
    },

    /** Kart onayı: en az bir onaylı iddia şart; onaysız kart ağa girmez. */
    async approveCard(userId: string) {
      const { talent } = await talentOf(userId);
      const onayli = await db
        .select({ id: cardClaims.id })
        .from(cardClaims)
        .where(and(eq(cardClaims.talentId, talent.id), eq(cardClaims.approved, true)));
      if (onayli.length === 0)
        throw new AppError('no_approved_claims', 'Onaylı en az bir iddia gerekli', 422);
      await db
        .update(talents)
        .set({ cardStatus: 'approved', cardApprovedAt: new Date(), updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return this.card(userId);
    },

    /**
     * Paylaşılabilir kart (keşfet 01): genç açar/kapatır. Slug rastgele, tahmin edilemez; kapatınca
     * eski link ölür (slug silinir), tekrar açınca yeni slug. Yalnız onaylı kart paylaşılır.
     */
    async setShare(userId: string, enabled: boolean) {
      const { talent } = await talentOf(userId);
      if (enabled && talent.cardStatus !== 'approved')
        throw new AppError('card_not_approved', 'Önce kartını onayla', 409);
      const publicSlug = enabled ? (talent.publicSlug ?? newRawToken(9)) : null;
      await db
        .update(talents)
        .set({ publicSlug, updatedAt: new Date() })
        .where(eq(talents.id, talent.id));
      return { publicSlug };
    },

    /** Herkese açık kart: oturum yok. Yalnız onaylı iddialar, e-posta/GitHub kimliği yok. */
    async publicCard(slug: string) {
      const [satir] = await db
        .select({ talent: talents, user: users })
        .from(talents)
        .innerJoin(users, eq(users.id, talents.userId))
        .where(and(eq(talents.publicSlug, slug), eq(talents.cardStatus, 'approved')))
        .limit(1);
      if (!satir) throw new AppError('not_found', 'Kart bulunamadı', 404);
      const claims = await db
        .select({
          id: cardClaims.id,
          text: cardClaims.text,
          level: cardClaims.level,
          periodStart: cardClaims.periodStart,
          periodEnd: cardClaims.periodEnd,
          sourceCount: sql<number>`cardinality(${cardClaims.sourceIds})`,
        })
        .from(cardClaims)
        .where(and(eq(cardClaims.talentId, satir.talent.id), eq(cardClaims.approved, true)))
        .orderBy(cardClaims.createdAt);
      const sources = await db
        .select({ kind: evidenceSources.kind, verified: evidenceSources.ownershipVerified })
        .from(evidenceSources)
        .where(eq(evidenceSources.talentId, satir.talent.id));
      return {
        name: satir.user.name,
        headline: satir.talent.headline,
        story: satir.talent.story,
        city: satir.talent.city,
        cardApprovedAt: satir.talent.cardApprovedAt,
        lastSignalAt: satir.talent.lastSignalAt,
        silent: isSilentCard(satir.talent.lastSignalAt),
        claims,
        sources,
        skills: await skillsForTalent(db, satir.talent.id),
      };
    },

    /** Canlı URL ekle: kaynak taslak olarak açılır, sahiplik token'ı döner; doğrulanana kadar beyan. */
    async addLiveUrl(userId: string, rawUrl: string) {
      const { talent } = await talentOf(userId);
      let url: string;
      try {
        url = assertPublicUrl(rawUrl).toString();
      } catch (e) {
        throw new AppError('invalid_url', e instanceof Error ? e.message : 'Geçersiz URL', 422);
      }
      const token = `evidex-${newRawToken(9)}`;
      const [kaynak] = await db
        .insert(evidenceSources)
        .values({
          talentId: talent.id,
          kind: 'live_url',
          ref: url,
          ownershipVerified: false,
          verifyToken: token,
        })
        .onConflictDoNothing()
        .returning();
      if (!kaynak) throw new AppError('already_added', 'Bu adres zaten ekli', 409);
      return kaynak;
    },

    async verifyLiveUrl(userId: string, sourceId: string) {
      const { talent, user } = await talentOf(userId);
      const [kaynak] = await db
        .select()
        .from(evidenceSources)
        .where(
          and(
            eq(evidenceSources.id, sourceId),
            eq(evidenceSources.talentId, talent.id),
            eq(evidenceSources.kind, 'live_url'),
          ),
        )
        .limit(1);
      if (!kaynak || !kaynak.verifyToken) throw new AppError('not_found', 'Kaynak bulunamadı', 404);
      const sonuc = await liveUrl.verifyOwnership(kaynak.ref, kaynak.verifyToken);
      if (!sonuc.verified) {
        throw new AppError(
          'not_verified',
          'Sahiplik doğrulanamadı: meta etiketi ya da well-known dosyası bulunamadı',
          422,
          sonuc,
        );
      }
      const signals = await liveUrl.extract(kaynak.ref);
      await db
        .insert(evidenceSignals)
        .values({ sourceId: kaynak.id, signals: signals as Record<string, unknown> });
      await db
        .update(evidenceSources)
        .set({
          ownershipVerified: true,
          ownershipMethod: sonuc.method,
          lastScannedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(evidenceSources.id, kaynak.id));
      await redraft(talent.id, user.githubLogin ?? user.name);
      return this.card(userId);
    },

    /**
     * Belge yükle (KARAR-02): PDF okunur, sinyal saklanır, dosya ATILIR (ADR-0003). Aynı belge
     * (sha256) iki kez eklenmez. Kart yeniden taslaklanır; iddia "belgeli" seviyesinde gelir.
     */
    async addDocument(userId: string, fileName: string, bytes: Uint8Array) {
      const { talent, user } = await talentOf(userId);
      let signals;
      try {
        signals = await document.extract(bytes);
      } catch (e) {
        throw new AppError(
          'invalid_document',
          e instanceof Error ? e.message : 'Belge okunamadı',
          422,
        );
      }
      const ref = `${fileName.replace(/[^\w.\-ğüşöçıİĞÜŞÖÇ ]/g, '').slice(0, 80)}#${signals.sha256.slice(0, 12)}`;
      const [kaynak] = await db
        .insert(evidenceSources)
        .values({
          talentId: talent.id,
          kind: 'document',
          ref,
          ownershipVerified: false,
          ownershipMethod: 'upload',
          lastScannedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();
      if (!kaynak) throw new AppError('already_added', 'Bu belge zaten ekli', 409);
      await db
        .insert(evidenceSignals)
        .values({ sourceId: kaynak.id, signals: signals as unknown as Record<string, unknown> });
      await redraft(talent.id, user.githubLogin ?? user.name);
      return this.card(userId);
    },

    async removeSource(userId: string, sourceId: string) {
      const { talent } = await talentOf(userId);
      const silinen = await db
        .delete(evidenceSources)
        .where(and(eq(evidenceSources.id, sourceId), eq(evidenceSources.talentId, talent.id)))
        .returning({ id: evidenceSources.id });
      if (!silinen.length) throw new AppError('not_found', 'Kaynak bulunamadı', 404);
    },

    async sourceSignals(userId: string, sourceIds: string[]) {
      const { talent } = await talentOf(userId);
      if (!sourceIds.length) return [];
      return db
        .select({
          sourceId: evidenceSignals.sourceId,
          signals: evidenceSignals.signals,
          extractedAt: evidenceSignals.extractedAt,
        })
        .from(evidenceSignals)
        .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceSignals.sourceId))
        .where(
          and(
            eq(evidenceSources.talentId, talent.id),
            inArray(evidenceSignals.sourceId, sourceIds),
          ),
        );
    },
  };
}

export type TalentService = ReturnType<typeof createTalentService>;
