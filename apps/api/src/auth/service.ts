import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import {
  loginTokens,
  organizationMembers,
  organizations,
  sessions,
  talents,
  users,
} from '@evidex/db';
import type { Role } from '@evidex/shared';
import { AppError } from '../lib/response';
import { hashToken, newRawToken } from './tokens';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  accessToken?: string; // kullanıcı OAuth token'ı; yalnız kurulum doğrulamasında, saklanmaz
}

/**
 * ### Kimlik servisi (KARAR-07)
 * Genç GitHub ile gelir → `talent` + boş kişi kartı. Kurum/operatör e-posta linkiyle gelir;
 * e-posta daha önce kayıtlı değilse kurum temsilcisi olarak açılır (operatör yalnız tohum/elle).
 * ⚠ Rol yükseltme burada yok; operatör atama ayrı, denetim izli bir iş olacak.
 */
export function createAuthService(db: Db) {
  async function createSession(userId: string) {
    const raw = newRawToken();
    await db.insert(sessions).values({
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return raw;
  }

  return {
    async requestMagicLink(email: string) {
      const raw = newRawToken();
      await db.insert(loginTokens).values({
        email: email.toLowerCase(),
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      });
      return raw;
    },

    async consumeMagicLink(raw: string) {
      const [kayit] = await db
        .select()
        .from(loginTokens)
        .where(
          and(
            eq(loginTokens.tokenHash, hashToken(raw)),
            isNull(loginTokens.usedAt),
            gt(loginTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!kayit) throw new AppError('invalid_link', 'Bağlantı geçersiz veya süresi dolmuş', 401);
      await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, kayit.id));

      let [kullanici] = await db.select().from(users).where(eq(users.email, kayit.email)).limit(1);
      if (!kullanici) {
        // İlk giriş: kurum temsilcisi olarak açılır; kurum kaydı sonraki adımda tamamlanır.
        [kullanici] = await db
          .insert(users)
          .values({
            email: kayit.email,
            name: kayit.email.split('@')[0] ?? kayit.email,
            role: 'organization',
          })
          .returning();
        if (!kullanici) throw new AppError('internal', 'Kullanıcı oluşturulamadı', 500);
        const [kurum] = await db
          .insert(organizations)
          .values({ name: 'Kurum (adı bekleniyor)' })
          .returning();
        if (kurum)
          await db
            .insert(organizationMembers)
            .values({ organizationId: kurum.id, userId: kullanici.id });
      }
      return { user: kullanici, sessionToken: await createSession(kullanici.id) };
    },

    async loginWithGithub(profile: GithubProfile) {
      const githubId = String(profile.id);
      let [kullanici] = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
      if (!kullanici) {
        const email = profile.email ?? `${profile.login}@users.noreply.github.com`;
        const [ayniEposta] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        // ⚠ Aynı e-posta başka bir rolün hesabına aitse GitHub kimliği ona BAĞLANMAZ: kurum ya da
        // operatör hesabı sessizce gence dönüşürdü (GİRVAK operatörü kendi Gmail'iyle giriş
        // yapınca yaşandı). Rol çakışması kullanıcıya söylenir; kimlik karışmaz.
        if (ayniEposta && ayniEposta.role !== 'talent')
          throw new AppError('email_in_use', 'Bu e-posta başka bir rolde kullanılıyor', 409);
        if (ayniEposta) {
          [kullanici] = await db
            .update(users)
            .set({ githubId, githubLogin: profile.login })
            .where(eq(users.id, ayniEposta.id))
            .returning();
        } else {
          [kullanici] = await db
            .insert(users)
            .values({
              email,
              name: profile.name ?? profile.login,
              role: 'talent',
              githubId,
              githubLogin: profile.login,
            })
            .returning();
        }
        if (!kullanici) throw new AppError('internal', 'Kullanıcı oluşturulamadı', 500);
        await db.insert(talents).values({ userId: kullanici.id }).onConflictDoNothing();
      }
      return { user: kullanici, sessionToken: await createSession(kullanici.id) };
    },

    async resolveSession(raw: string | undefined) {
      if (!raw) return null;
      const [satir] = await db
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, hashToken(raw)), gt(sessions.expiresAt, new Date())))
        .limit(1);
      return satir?.user ?? null;
    },

    async logout(raw: string | undefined) {
      if (raw) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(raw)));
    },

    requireRole(role: Role, actual: Role) {
      if (role !== actual) throw new AppError('forbidden', 'Bu işlem için yetkiniz yok', 403);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
