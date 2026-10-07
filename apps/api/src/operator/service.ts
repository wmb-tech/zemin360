import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  approvalQueue,
  auditLog,
  collaborations,
  matches,
  needs,
  organizationMembers,
  organizations,
  scoutInvites,
  talents,
  users,
} from '@evidex/db';
import type { ApprovalAction, CollaborationStatus } from '@evidex/shared';
import type { EmailSender } from '../lib/email';
import { AppError } from '../lib/response';
import type { FollowUpPayload, FollowUpService } from '../followups/service';

/**
 * ### Operatör servisi — onay kuyruğu ve yürütme (ADR-0004)
 * Ajanın dışa dönük her eylemi burada `proposed` bekler. Operatör onaylar/düzenler/reddeder;
 * yalnız o zaman yürütülür. Her karar denetim izine yazılır.
 * ⚠ Yürütme fonksiyonları yalnız bu servisten çağrılır; ajan doğrudan e-posta göndermez.
 */
export function createOperatorService(
  db: Db,
  email: EmailSender,
  followUp: FollowUpService,
  webOrigin: string,
) {
  async function audit(
    actorId: string,
    action: string,
    subjectType: string,
    subjectId: string,
    detail?: Record<string, unknown>,
  ) {
    await db
      .insert(auditLog)
      .values({ actorId, action, subjectType, subjectId, detail: detail ?? null });
  }

  async function execute(
    item: typeof approvalQueue.$inferSelect,
    payload: Record<string, unknown>,
  ) {
    const action = item.action as ApprovalAction;
    switch (action) {
      case 'publish_shortlist': {
        await db
          .update(needs)
          .set({ shortlistPublishedAt: new Date() })
          .where(eq(needs.id, item.subjectId));
        // Canlı tut (04): güçlü adaylar "kartın bir ihtiyaçla eşleşti" haberini alır. Kurum adı
        // ve ihtiyaç metni verilmez (KARAR-09: tanıştırmaya kadar taraflar birbirini görmez).
        const gucluler = await db
          .select({ email: users.email, name: users.name })
          .from(matches)
          .innerJoin(talents, eq(talents.id, matches.talentId))
          .innerJoin(users, eq(users.id, talents.userId))
          .where(and(eq(matches.needId, item.subjectId), eq(matches.strength, 'strong')));
        for (const g of gucluler)
          await email.send({
            to: g.email,
            subject: 'Evidex: kartın bir kurum ihtiyacıyla eşleşti',
            text: `Selam ${g.name.split(' ')[0]},\n\nKartındaki kanıtlar bir kurumun ihtiyacıyla güçlü eşleşti; kurum seni gerekçesiyle görüyor. Tanıştırma olursa e-postayla haber vereceğiz. Kartını güncel tutmak için yeni kanıt bağlayabilirsin.\n\nEvidex · GİRVAK`,
          });
        return;
      }
      case 'introduce': {
        const [m] = await db.select().from(matches).where(eq(matches.id, item.subjectId)).limit(1);
        if (!m) throw new AppError('not_found', 'Eşleşme bulunamadı', 404);
        const [need] = await db.select().from(needs).where(eq(needs.id, m.needId)).limit(1);
        const [talent] = await db
          .select({ email: users.email, name: users.name })
          .from(talents)
          .innerJoin(users, eq(users.id, talents.userId))
          .where(eq(talents.id, m.talentId))
          .limit(1);
        const kurumUyeleri = need
          ? await db
              .select({ email: users.email, name: users.name })
              .from(organizationMembers)
              .innerJoin(users, eq(users.id, organizationMembers.userId))
              .where(eq(organizationMembers.organizationId, need.organizationId))
          : [];
        const [kurum] = need
          ? await db
              .select({ name: organizations.name })
              .from(organizations)
              .where(eq(organizations.id, need.organizationId))
              .limit(1)
          : [];
        const metin = String(payload.message ?? '');
        const konu = String(
          payload.subject ??
            `Evidex tanıştırma: ${kurum?.name ?? 'Kurum'} · ${talent?.name ?? 'Genç yetenek'}`,
        );
        const alicilar = [talent?.email, ...kurumUyeleri.map((u) => u.email)].filter(
          (e): e is string => Boolean(e),
        );
        // Tanıştırmanın özü iletişim: taraflar TEK e-postada, birbirinin adresini görerek alır
        // ("tümünü yanıtla" doğrudan buluşturur). İletişim bloğu sistemindir; ajan ya da operatör
        // metni ne olursa olsun adresler doğru yazılır. (Ayrı ayrı gönderim kimseyi tanıştırmıyordu.)
        const iletisim = [
          '',
          '—',
          'İletişim',
          `${talent?.name ?? 'Genç yetenek'}: ${talent?.email ?? '—'}`,
          `${kurum?.name ?? 'Kurum'}: ${kurumUyeleri.map((u) => u.email).join(', ') || '—'}`,
          '',
          'Bu e-postayı "Tümünü yanıtla" ile cevaplayarak doğrudan görüşme ayarlayabilirsiniz.',
        ].join('\n');
        if (alicilar.length > 0)
          await email.send({ to: alicilar, subject: konu, text: `${metin}\n${iletisim}` });
        await db.update(matches).set({ introducedAt: new Date() }).where(eq(matches.id, m.id));
        await db.insert(collaborations).values({ matchId: m.id }).onConflictDoNothing();
        return;
      }
      case 'send_follow_up': {
        // Taslak ajanın; gönderim takip servisinde (tek kullanımlık linkler orada üretilir).
        await followUp.send({
          collaborationId: item.subjectId,
          subject: String(payload.subject ?? 'Evidex takip'),
          messageTalent: String(payload.messageTalent ?? ''),
          messageOrganization: String(payload.messageOrganization ?? ''),
        } satisfies FollowUpPayload);
        return;
      }
      case 'invite': {
        // Kulüp kanalı / keşif (01): davet e-postası, kişi GitHub ile girer ve kanıt bağlar.
        const emails = Array.isArray(payload.emails)
          ? payload.emails.filter((e): e is string => typeof e === 'string')
          : [];
        const metin = String(payload.message ?? '');
        // Keşif davetinde kişiye özel satır (ajanın profilde gördüğü somut şey) eklenir.
        const adaylar = Array.isArray(payload.candidates)
          ? (payload.candidates as { email: string | null; inviteLine?: string }[])
          : [];
        // Keşif davetinde login kaydı: aynı kişiye 90 gün tekrar yazılmaz (ADR-0007).
        const loginlar = adaylar
          .map((a) => (a as { login?: string }).login)
          .filter((l): l is string => typeof l === 'string');
        if (loginlar.length)
          await db
            .insert(scoutInvites)
            .values(
              loginlar.map((login) => ({
                login,
                needId: item.subjectType === 'need' ? item.subjectId : null,
                invitedAt: new Date(),
              })),
            )
            .onConflictDoUpdate({ target: scoutInvites.login, set: { invitedAt: new Date() } });
        for (const to of emails) {
          const ozel = adaylar.find((a) => a.email === to)?.inviteLine;
          await email.send({
            to,
            subject: String(payload.subject ?? 'GİRVAK ağına davet · Evidex'),
            text: `${metin}${ozel ? `\n\n${ozel}` : ''}\n\nKatılmak için: ${webOrigin}\nGitHub ile giriş yap; hangi repoları göstereceğini sen seçersin, kod saklanmaz.`,
          });
        }
        return;
      }
    }
  }

  return {
    /**
     * Bekleyen öneriler. Kısa liste önerisi sayıyla değil adaylarla gelir: operatör kimi ve neden
     * yayınladığını görmeden onaylamamalı (kör onay). Aday bilgisi yayın anındaki eşleşmelerden
     * canlı okunur; eski kayıtlar da aynı görünümü alır.
     */
    async queue() {
      const kayitlar = await db
        .select()
        .from(approvalQueue)
        .where(eq(approvalQueue.status, 'proposed'))
        .orderBy(desc(approvalQueue.createdAt));
      const matchIds = kayitlar
        .filter((k) => k.action === 'publish_shortlist')
        .flatMap((k) => ((k.payload as { matchIds?: string[] }).matchIds ?? []) as string[]);
      // Tanıştırma ve takip önerilerinde taraflar adıyla: operatör "Kime: Gence" değil kime
      // gittiğini görsün. Tanıştırmanın öznesi eşleşme, takibinki iş birliği.
      const collabIds = kayitlar
        .filter((k) => k.action === 'send_follow_up')
        .map((k) => (k.payload as { collaborationId?: string }).collaborationId)
        .filter((x): x is string => Boolean(x));
      const collabMatch = new Map(
        collabIds.length
          ? (
              await db
                .select({ id: collaborations.id, matchId: collaborations.matchId })
                .from(collaborations)
                .where(inArray(collaborations.id, collabIds))
            ).map((c) => [c.id, c.matchId])
          : [],
      );
      const eslesmeOf = (k: (typeof kayitlar)[number]) =>
        k.action === 'introduce' && k.subjectType === 'match'
          ? k.subjectId
          : k.action === 'send_follow_up'
            ? collabMatch.get((k.payload as { collaborationId?: string }).collaborationId ?? '')
            : undefined;
      const tarafIds = [...new Set(kayitlar.map(eslesmeOf).filter((x): x is string => Boolean(x)))];
      const taraflar = new Map(
        tarafIds.length
          ? (
              await db
                .select({ id: matches.id, genc: users.name, kurum: organizations.name })
                .from(matches)
                .innerJoin(talents, eq(talents.id, matches.talentId))
                .innerJoin(users, eq(users.id, talents.userId))
                .innerJoin(needs, eq(needs.id, matches.needId))
                .innerJoin(organizations, eq(organizations.id, needs.organizationId))
                .where(inArray(matches.id, tarafIds))
            ).map((t) => [t.id, { talent: t.genc, organization: t.kurum }])
          : [],
      );
      const tarafli = kayitlar.map((k) => {
        const t = taraflar.get(eslesmeOf(k) ?? '');
        return t ? { ...k, parties: t } : k;
      });
      if (matchIds.length === 0) return tarafli;
      const adaylar = await db
        .select({
          id: matches.id,
          rank: matches.rank,
          strength: matches.strength,
          reasoning: matches.reasoning,
          name: users.name,
          headline: talents.headline,
        })
        .from(matches)
        .innerJoin(talents, eq(talents.id, matches.talentId))
        .innerJoin(users, eq(users.id, talents.userId))
        .where(inArray(matches.id, matchIds));
      const byId = new Map(adaylar.map((a) => [a.id, a]));
      return tarafli.map((k) => {
        if (k.action !== 'publish_shortlist') return k;
        const ids = ((k.payload as { matchIds?: string[] }).matchIds ?? []) as string[];
        const liste = ids
          .map((id) => byId.get(id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .sort((a, b) => a.rank - b.rank)
          .map((a) => {
            const r = a.reasoning as { summaryForOrganization?: string; gaps?: string[] } | null;
            return {
              rank: a.rank,
              strength: a.strength,
              name: a.name,
              headline: a.headline,
              summary: r?.summaryForOrganization ?? null,
              gaps: r?.gaps ?? [],
            };
          });
        return { ...k, candidates: liste };
      });
    },

    async decide(
      operatorId: string,
      itemId: string,
      decision: 'approve' | 'reject' | 'edit',
      editedPayload?: Record<string, unknown>,
    ) {
      const [item] = await db
        .select()
        .from(approvalQueue)
        .where(eq(approvalQueue.id, itemId))
        .limit(1);
      if (!item) throw new AppError('not_found', 'Kuyruk kaydı bulunamadı', 404);
      // Aynı kaydı iki kez yürütmek (iki tanıştırma e-postası) olmaz.
      if (item.status !== 'proposed')
        throw new AppError('already_decided', 'Bu kayıt karara bağlanmış', 409);

      const status =
        decision === 'approve' ? 'approved' : decision === 'edit' ? 'edited' : 'rejected';
      const payload =
        decision === 'edit' ? { ...item.payload, ...(editedPayload ?? {}) } : item.payload;

      if (status !== 'rejected') await execute(item, payload);

      const [guncel] = await db
        .update(approvalQueue)
        .set({
          status,
          decidedBy: operatorId,
          decidedAt: new Date(),
          editedPayload: decision === 'edit' ? (editedPayload ?? null) : null,
          executedAt: status !== 'rejected' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(approvalQueue.id, itemId))
        .returning();
      await audit(operatorId, `approval.${status}`, item.subjectType, item.subjectId, {
        action: item.action,
      });
      return guncel!;
    },

    /** İş birliği durumu (döngü adımı 06): tanıştırıldı → görüşme → başladı → sürüyor → bitti/olmadı. */
    async setCollaborationStatus(operatorId: string, matchId: string, status: CollaborationStatus) {
      const [kayit] = await db
        .update(collaborations)
        .set({ status, lastCheckinAt: new Date(), updatedAt: new Date() })
        .where(eq(collaborations.matchId, matchId))
        .returning();
      if (!kayit)
        throw new AppError('not_found', 'İş birliği kaydı yok (tanıştırma yapılmamış)', 404);
      await audit(operatorId, 'collaboration.status', 'match', matchId, { status });
      // İzle (06): operatör durumu elle değiştirince iki taraf da haberdar olur — şeffaflık
      // tek yönlü değil. Uç durumlarda (bitti/olmadı) ve başlangıçta; ara adımlar sessiz.
      if (status === 'started' || status === 'completed' || status === 'did_not_happen') {
        const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
        const [need] = m
          ? await db.select().from(needs).where(eq(needs.id, m.needId)).limit(1)
          : [];
        const [talent] = m
          ? await db
              .select({ email: users.email, name: users.name })
              .from(talents)
              .innerJoin(users, eq(users.id, talents.userId))
              .where(eq(talents.id, m.talentId))
              .limit(1)
          : [];
        const uyeler = need
          ? await db
              .select({ email: users.email })
              .from(organizationMembers)
              .innerJoin(users, eq(users.id, organizationMembers.userId))
              .where(eq(organizationMembers.organizationId, need.organizationId))
          : [];
        const metin = {
          started:
            'GİRVAK kaydına göre iş birliğiniz başladı. Üç gün içinde kısa bir takip sorusu göndereceğiz.',
          completed:
            'GİRVAK kaydına göre iş birliğiniz tamamlandı. Kurum değerlendirmesi gencin kartına referans olarak işlenir; teşekkürler.',
          did_not_happen:
            'GİRVAK kaydına göre bu iş birliği gerçekleşmedi. Sorun değil; yeni eşleşmelerde yine haber vereceğiz.',
        }[status];
        const basliq = `Evidex: iş birliği durumu — ${(need?.card as { title?: string } | null)?.title ?? 'ihtiyaç'}`;
        for (const to of [talent?.email, ...uyeler.map((u) => u.email)].filter((e): e is string =>
          Boolean(e),
        ))
          await email.send({ to, subject: basliq, text: metin });
      }
      return kayit;
    },

    /**
     * Kulüp kanalı (keşfet 01): operatör bir listeyi (üniversite kulübü, etkinlik katılımcıları)
     * davet için kuyruğa koyar. Tek kayıt, onayla hepsine gider. Zaten üye olanlar elenir.
     */
    async proposeInvites(input: { emails: string[]; source: string; message: string }) {
      const uyeler = await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, input.emails));
      const uyeSet = new Set(uyeler.map((u) => u.email));
      const yeni = [...new Set(input.emails)].filter((e) => !uyeSet.has(e));
      if (yeni.length === 0)
        throw new AppError('nothing_to_invite', 'Listedekilerin hepsi zaten ağda', 422);
      const [kayit] = await db
        .insert(approvalQueue)
        .values({
          action: 'invite',
          subjectType: 'invite_list',
          subjectId: crypto.randomUUID(),
          payload: {
            emails: yeni,
            skipped: input.emails.length - yeni.length,
            source: input.source,
            subject: 'GİRVAK ağına davet · Evidex',
            message: input.message,
          },
        })
        .returning();
      return kayit!;
    },

    /** Operatör bir eşleşme için tanıştırma önerir; e-posta taslağı kuyruğa düşer, onayla gider. */
    async proposeIntroduction(matchId: string, draft: { subject: string; message: string }) {
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!m) throw new AppError('not_found', 'Eşleşme bulunamadı', 404);
      if (m.introducedAt) throw new AppError('already_introduced', 'Tanıştırma yapılmış', 409);
      const [kayit] = await db
        .insert(approvalQueue)
        .values({ action: 'introduce', subjectType: 'match', subjectId: matchId, payload: draft })
        .returning();
      return kayit!;
    },
  };
}

export type OperatorService = ReturnType<typeof createOperatorService>;
