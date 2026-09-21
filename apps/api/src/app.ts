import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { existsSync } from 'node:fs';
import { logger } from 'hono/logger';
import { errorLog, type Db } from '@evidex/db';
import { desc } from 'drizzle-orm';
import { authRoutes } from './auth/routes';
import { createAuthService, type GithubProfile } from './auth/service';
import { createEmailSenderFromEnv, type EmailSender } from './lib/email';
import type { Env } from './lib/env';
import { AppError, fail, ok } from './lib/response';
import { withRole } from './auth/middleware';
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
import { createScoutingService } from './scouting/service';
import { createOrgService } from './org/service';
import { orgRoutes } from './org/routes';
import { operatorChallengeRoutes, talentChallengeRoutes } from './challenges/routes';
import { createChallengeService } from './challenges/service';
import { publicCardRoutes, talentRoutes } from './talent/routes';
import { createTalentService } from './talent/service';
import {
  createDocumentEvidence,
  createGithubEvidence,
  createGithubScout,
  createLiveUrlEvidence,
  createPublicRepoEvidence,
  type DocumentEvidence,
  type GithubEvidence,
  type GithubScout,
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
  githubScout?: GithubScout;
  document?: DocumentEvidence;
  /** Web derlemesinin kökü; varsa API aynı porttan servis eder (üretimde tek süreç). */
  webDist?: string;
}

/** Bağımlılıklar dışarıdan gelir; testler sahte DB/e-posta/GitHub ile aynı uygulamayı kurar. */
export function createApp(deps: AppDeps) {
  const app = new Hono();
  const auth = createAuthService(deps.db);
  const email = deps.email ?? createEmailSenderFromEnv(deps.env);
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
  const talent = createTalentService(
    deps.db,
    llm,
    github,
    deps.liveUrl ?? createLiveUrlEvidence(),
    deps.document ?? createDocumentEvidence(),
  );

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
  const scouting = createScoutingService(
    deps.db,
    llm,
    deps.githubScout ??
      createGithubScout(
        deps.env.GITHUB_SERVER_TOKEN ? { token: deps.env.GITHUB_SERVER_TOKEN } : {},
      ),
  );
  app.route(
    '/api/operator',
    operatorRoutes(
      auth,
      createOperatorService(deps.db, email, followUp, deps.env.WEB_ORIGIN),
      matching,
      createMetricsService(deps.db),
      followUp,
      scouting,
    ),
  );
  // Hata kayıtları: yalnız operatör; son 50 kayıt, sebep + yığın (sunucu loguna erişimsiz teşhis).
  app.route(
    '/api/operator/errors',
    new Hono()
      .use('*', withRole(auth, 'operator'))
      .get('/', async (c) =>
        ok(c, await deps.db.select().from(errorLog).orderBy(desc(errorLog.createdAt)).limit(50)),
      ),
  );
  // Takip cevabı: giriş yok, e-postadaki tek kullanımlık token yetkidir.
  app.route('/api/checkin', checkinRoutes(followUp));
  const network = createNetworkService(deps.db, talent);
  app.route('/api/operator/network', networkRoutes(auth, network));
  const org = createOrgService(deps.db);
  app.route(
    '/api/auth',
    authRoutes({
      env: deps.env,
      auth,
      email,
      ...(deps.fetchGithubProfile ? { fetchGithubProfile: deps.fetchGithubProfile } : {}),
      onInstallation: (userId, installationId, token) =>
        talent.saveInstallation(userId, installationId, token),
      orgOf: async (userId) => {
        const p = await org.profile(userId).catch(() => null);
        return p ? { name: p.name, needsName: p.needsName } : null;
      },
    }),
  );
  app.route('/api/me', talentRoutes(deps.env, auth, talent));
  app.route('/api/cards', publicCardRoutes(talent));
  app.route('/api/org', orgRoutes(auth, org));

  // Üretim: web derlemesi aynı süreçten. /api/* dışındaki her yol SPA'ya düşer (derin linkler:
  // /takip/:token, /k/:slug). Geliştirmede Vite ayrı portta; bu blok devreye girmez.
  const webDist = deps.webDist;
  if (webDist && existsSync(webDist)) {
    // Önbellek: hash'li varlıklar bir yıl değişmez; kabuk (index.html) her açılışta doğrulanır.
    // Aksi hâlde tarayıcı dağıtımdan sonra eski paketi çalıştırıyor (ilk gerçek kullanıcıda oldu).
    app.use('/*', async (c, next) => {
      await next();
      if (c.req.path.startsWith('/api/')) return;
      c.header(
        'Cache-Control',
        c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    });
    app.use('/*', serveStatic({ root: webDist }));
    const indexHtml = serveStatic({ root: webDist, path: 'index.html' });
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api/'))
        return fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404));
      return (await indexHtml(c, next)) ?? c.notFound();
    });
  }

  app.notFound((c) => fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404)));
  app.onError((err, c) => {
    if (err instanceof AppError) return fail(c, err);
    console.error(err);
    // Sebep istemciye gitmez (bilgi sızıntısı); kayıt + kimlik gider, operatör kayıttan okur.
    const errorId = crypto.randomUUID();
    const kullanici = (c as unknown as { get(k: 'user'): { id?: string } | undefined }).get('user');
    void deps.db
      .insert(errorLog)
      .values({
        id: errorId,
        userId: kullanici?.id ?? null,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        message: err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000),
        stack: err instanceof Error ? (err.stack?.slice(0, 8000) ?? null) : null,
      })
      .catch((e: unknown) => console.error('[error_log] yazılamadı', e));
    return fail(
      c,
      new AppError('internal', `Beklenmeyen hata (kayıt ${errorId.slice(0, 8)})`, 500, { errorId }),
    );
  });

  return { app, followUp, network };
}
