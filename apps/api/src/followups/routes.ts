import { Hono } from 'hono';
import { z } from 'zod';
import { CollaborationStatus } from '@evidex/shared';
import { AppError, ok } from '../lib/response';
import type { FollowUpService } from './service';

const AnswerBody = z.object({
  status: CollaborationStatus,
  feedback: z.string().max(2000).default(''),
});

/**
 * Takip cevabı uçları: `/api/checkin/:token`. Oturum yok; token e-postadan gelir, tek
 * kullanımlık ve hash'i saklanır. Bu yüzden GET bağlamı da yalnız kurum adı/ihtiyaç başlığı
 * verir — kişisel veri sızdırmaz.
 */
export function checkinRoutes(followUp: FollowUpService) {
  return new Hono()
    .get('/:token', async (c) => ok(c, await followUp.context(c.req.param('token'))))
    .post('/:token', async (c) => {
      const r = AnswerBody.safeParse(await c.req.json().catch(() => ({})));
      if (!r.success) throw new AppError('validation', 'Geçersiz istek', 422, r.error.issues);
      return ok(c, await followUp.answer(c.req.param('token'), r.data));
    });
}
