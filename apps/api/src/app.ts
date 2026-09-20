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
import { createMatchingService } from './matching/service';
import { operatorRoutes } from './operator/routes';
import { createOperatorService } from './operator/service';
import { createMetricsService } from './metrics/service';
import { createFollowUpService } from './followups/service';
import { checkinRoutes } from './followups/routes';
import { createNetworkService } from './network/service';
import { networkRoutes } from './network/routes';
import { operatorChallengeRoutes, talentChallengeRoutes } from './challenges/routes';
import { createChallengeService } from './challenges/service';
import { talentRoutes } from './talent/routes';
import { createTalentService } from './talent/service';
import {
  createGithubEvidence,
  createLiveUrlEvidence,
  createPublicRepoEvidence,
  type GithubEvidence,
  type LiveUrlEvidence,
  type PublicRepoEvidence,
} from '@evidex/evidence';
import type { LlmProvider } from '@evidex/ai';

export interface AppDeps {
  env: Env;
  db: Db;
  email?: EmailSender;
  fetchGithubProfile?: (code: string) => Promise<GithubProfile>;
  llm?: LlmProvider;
  github?: GithubEvidence | null;
  liveUrl?: LiveUrlEvidence;
  publicRepo?: PublicRepoEvidence;
}

/** Bağımlılıklar dışarıdan gelir; testler sahte DB/e-posta/GitHub ile aynı uygulamayı kurar. */
export function createApp(deps: AppDeps) {
  const app = new Hono();
  const auth = createAuthService(deps.db);
  const email = deps.email ?? createConsoleEmailSender();
  const llm = deps.llm ?? createLlmFromEnv(deps.env);
  const github =
    deps.github !== undefined
      ? deps.github
      : deps.env.GITHUB_APP_ID && deps.env.GITHUB_APP_PRIVATE_KEY
        ? createGithubEvidence({
            appId: deps.env.GITHUB_APP_ID,
            privateKey: deps.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ...(deps.env.GITHUB_CLIENT_ID ? { clientId: deps.env.GITHUB_CLIENT_ID } : {}),
            ...(deps.env.GITHUB_CLIENT_SECRET
              ? { clientSecret: deps.env.GITHUB_CLIENT_SECRET }
              : {}),
          })
        : null;
  const talent = createTalentService(deps.db, llm, github, deps.liveUrl ?? createLiveUrlEvidence());

  app.use('*', logger());
  app.use('/api/*', cors({ origin: deps.env.WEB_ORIGIN, credentials: true }));

  app.route('/api/health', health);
  const matching = createMatchingService(deps.db, llm);
  const challenge = createChallengeService(
    deps.db,
    llm,
    deps.publicRepo ??
      createPublicRepoEvidence(
        deps.env.GITHUB_SERVER_TOKEN ? { token: deps.env.GITHUB_SERVER_TOKEN } : {},
      ),
  );
  app.route('/api/operator/challenges', operatorChallengeRoutes(auth, challenge));
  app.route('/api/me/challenges', talentChallengeRoutes(auth, challenge));
  app.route(
    '/api/needs',
    needRoutes(auth, createNeedService(deps.db, llm, matching), matching, challenge),
  );
  const followUp = createFollowUpService(deps.db, llm, email, deps.env.WEB_ORIGIN);
  app.route(
    '/api/operator',
    operatorRoutes(
      auth,
      createOperatorService(deps.db, email, followUp),
      matching,
      createMetricsService(deps.db),
      followUp,
    ),
  );
  // Takip cevabı: giriş yok, e-postadaki tek kullanımlık token yetkidir.
  app.route('/api/checkin', checkinRoutes(followUp));
  const network = createNetworkService(deps.db, talent);
  app.route('/api/operator/network', networkRoutes(auth, network));
  app.route(
    '/api/auth',
    authRoutes({
      env: deps.env,
      auth,
      email,
      ...(deps.fetchGithubProfile ? { fetchGithubProfile: deps.fetchGithubProfile } : {}),
      onInstallation: (userId, installationId) => talent.saveInstallation(userId, installationId),
    }),
  );
  app.route('/api/me', talentRoutes(deps.env, auth, talent));

  app.notFound((c) => fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404)));
  app.onError((err, c) => {
    if (err instanceof AppError) return fail(c, err);
    console.error(err);
    return fail(c, new AppError('internal', 'Beklenmeyen hata', 500));
  });

  return { app, followUp, network };
}
