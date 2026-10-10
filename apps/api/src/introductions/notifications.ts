import { eq } from 'drizzle-orm';
import { matches, needs, organizationMembers, talents, users, type Db } from '@evidex/db';
import type { EmailSender } from '../lib/email';

export async function notifyIntroduction(
  db: Db,
  email: EmailSender,
  webOrigin: string,
  matchId: string,
  includeOrganization = false,
) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return;
  const recipients = await db
    .select({ email: users.email })
    .from(talents)
    .innerJoin(users, eq(users.id, talents.userId))
    .where(eq(talents.id, match.talentId));
  if (includeOrganization) {
    const [need] = await db.select().from(needs).where(eq(needs.id, match.needId)).limit(1);
    if (need)
      recipients.push(
        ...(await db
          .select({ email: users.email })
          .from(organizationMembers)
          .innerJoin(users, eq(users.id, organizationMembers.userId))
          .where(eq(organizationMembers.organizationId, need.organizationId))),
      );
  }
  for (const recipient of recipients)
    await email.send({
      to: recipient.email,
      subject: 'Evidex: tanıştırma isteğine karar ver',
      text: `Bir iş birliği için tanıştırma isteğin var. Koşulları incelemek, kabul etmek veya reddetmek için hesabına giriş yap: ${webOrigin}/tanistirmalar\n\nİki tarafın kabulü ve GİRVAK onayı olmadan tam ad ve iletişim bilgileri paylaşılmaz.`,
    });
}
