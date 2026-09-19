import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Db } from '@evidex/db';
import { authRoutes } from './auth/routes';
import { createAuthService, type GithubProfile } from './auth/service';
import { createConsoleEmailSender, type EmailSender } from './lib/email';
import type { Env } from './lib/env';
import { AppError, fail } from './lib/response';
import { health } from './routes/health';
import { needRoutes } from './needs/routes';
import { createNeedService } from './needs/service';
import { createLlmFromEnv } from './lib/llm';
import type { LlmProvider } from '@evidex/ai';

export interface AppDeps {
  env: Env;
  db: Db;
  email?: EmailSender;
  fetchGithubProfile?: (code: string) => Promise<GithubProfile>;
  llm?: LlmProvider;
}

/** Bağımlılıklar dışarıdan gelir; testler sahte DB/e-posta/GitHub ile aynı uygulamayı kurar. */
export function createApp(deps: AppDeps) {
  const app = new Hono();
  const auth = createAuthService(deps.db);
  const email = deps.email ?? createConsoleEmailSender();
  const llm = deps.llm ?? createLlmFromEnv(deps.env);

  app.use('*', logger());
  app.use('/api/*', cors({ origin: deps.env.WEB_ORIGIN, credentials: true }));

  app.route('/api/health', health);
  app.route('/api/needs', needRoutes(auth, createNeedService(deps.db, llm)));
  app.route(
    '/api/auth',
    authRoutes({
      env: deps.env,
      auth,
      email,
      ...(deps.fetchGithubProfile ? { fetchGithubProfile: deps.fetchGithubProfile } : {}),
    }),
  );

  app.notFound((c) => fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404)));
  app.onError((err, c) => {
    if (err instanceof AppError) return fail(c, err);
    console.error(err);
    return fail(c, new AppError('internal', 'Beklenmeyen hata', 500));
  });

  return app;
}
