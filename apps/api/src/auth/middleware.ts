import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Role } from '@evidex/shared';
import { AppError } from '../lib/response';
import { SESSION_COOKIE } from './routes';
import type { AuthService } from './service';

export type AuthUser = NonNullable<Awaited<ReturnType<AuthService['resolveSession']>>>;
export type AuthVars = { Variables: { user: AuthUser } };

/**
 * `withRole('operator')` — rol uymuyorsa 403, oturum yoksa 401. Rol kontrolü handler'ın
 * içine değil kapıya konur; yarın eklenen bir uç unutulmuş bir if'e bağlı kalmasın.
 */
export function withRole(auth: AuthService, ...roles: Role[]) {
  return createMiddleware<AuthVars>(async (c, next) => {
    const user = await auth.resolveSession(getCookie(c, SESSION_COOKIE));
    if (!user) throw new AppError('unauthenticated', 'Oturum yok', 401);
    if (roles.length && !roles.includes(user.role))
      throw new AppError('forbidden', 'Bu işlem için yetkiniz yok', 403);
    c.set('user', user);
    await next();
  });
}
