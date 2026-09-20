import { eq } from 'drizzle-orm';
import type { Db } from '@evidex/db';
import { organizationMembers, organizations } from '@evidex/db';
import { AppError } from '../lib/response';

export const ORG_PLACEHOLDER_NAME = 'Kurum (adı bekleniyor)';

/**
 * Kurum profili (tanımla 05 öncesi). Sihirli linkle gelen kurum "adı bekleniyor" ile açılır;
 * ilk işi adını yazmak — bu ad gence giden tanıştırma/takip e-postalarına giriyor.
 */
export function createOrgService(db: Db) {
  async function orgOf(userId: string) {
    const [uye] = await db
      .select({ org: organizations })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    if (!uye) throw new AppError('no_organization', 'Bu hesabın kurumu yok', 403);
    return uye.org;
  }
  return {
    async profile(userId: string) {
      const o = await orgOf(userId);
      return {
        id: o.id,
        name: o.name,
        city: o.city,
        website: o.website,
        approved: Boolean(o.approvedByOperatorAt),
        needsName: o.name === ORG_PLACEHOLDER_NAME,
      };
    },
    async update(
      userId: string,
      patch: {
        name?: string | undefined;
        city?: string | null | undefined;
        website?: string | null | undefined;
      },
    ) {
      const o = await orgOf(userId);
      await db
        .update(organizations)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.city !== undefined ? { city: patch.city } : {}),
          ...(patch.website !== undefined ? { website: patch.website } : {}),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, o.id));
      return this.profile(userId);
    },
  };
}
export type OrgService = ReturnType<typeof createOrgService>;
