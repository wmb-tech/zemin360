import { and, inArray, notInArray, or } from 'drizzle-orm';
import {
  approvalQueue,
  auditLog,
  collaborations,
  matches,
  needs,
  organizationMembers,
  organizations,
  talents,
  users,
  type Db,
} from '@evidex/db';

/**
 * Kullanıcıları ve onlara ait her şeyi siler (KVKK silme hakkı + demo kaldırma aynı yol):
 * kart, kaynak, sinyal, iddia, kurulum kaydı ve oturum zincirleme gider (FK cascade); kurum
 * yalnız başka üyesi kalmıyorsa silinir; FK'si olmayan kuyruk kayıtları elle temizlenir;
 * denetim izi silinmez, kişiyle bağı koparılır (actor → null).
 */
export async function kullanicilariSil(db: Db, kullaniciIds: string[]) {
  if (kullaniciIds.length === 0) return;
  const uyelikler = await db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(inArray(organizationMembers.userId, kullaniciIds));
  const adayOrgIds = [...new Set(uyelikler.map((x) => x.id))];
  // Başka üyesi olan kurum kalır (ekip arkadaşının hesabı kurumu götürmesin).
  const paylasilan = adayOrgIds.length
    ? new Set(
        (
          await db
            .select({ id: organizationMembers.organizationId })
            .from(organizationMembers)
            .where(
              and(
                inArray(organizationMembers.organizationId, adayOrgIds),
                notInArray(organizationMembers.userId, kullaniciIds),
              ),
            )
        ).map((x) => x.id),
      )
    : new Set<string>();
  const orgIds = adayOrgIds.filter((id) => !paylasilan.has(id));
  const talentIds = (
    await db.select({ id: talents.id }).from(talents).where(inArray(talents.userId, kullaniciIds))
  ).map((x) => x.id);
  const needIds = orgIds.length
    ? (
        await db.select({ id: needs.id }).from(needs).where(inArray(needs.organizationId, orgIds))
      ).map((x) => x.id)
    : [];
  // Silinen ihtiyaçlara ya da silinen gençlere ait eşleşmeler (gerçek genç × demo ihtiyaç dahil).
  const kosullar = [
    ...(needIds.length ? [inArray(matches.needId, needIds)] : []),
    ...(talentIds.length ? [inArray(matches.talentId, talentIds)] : []),
  ];
  const tumMatch = kosullar.length
    ? (
        await db
          .select({ id: matches.id })
          .from(matches)
          .where(or(...kosullar))
      ).map((x) => x.id)
    : [];
  const collabIds = tumMatch.length
    ? (
        await db
          .select({ id: collaborations.id })
          .from(collaborations)
          .where(inArray(collaborations.matchId, tumMatch))
      ).map((x) => x.id)
    : [];
  const konular = [...needIds, ...tumMatch, ...collabIds, ...talentIds];
  if (konular.length)
    await db.delete(approvalQueue).where(inArray(approvalQueue.subjectId, konular));
  await db.update(auditLog).set({ actorId: null }).where(inArray(auditLog.actorId, kullaniciIds));
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  await db.delete(users).where(inArray(users.id, kullaniciIds));
}
