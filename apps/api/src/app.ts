import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from 'hono/bun';
import { existsSync } from 'node:fs';
import { logger } from 'hono/logger';
import { errorLog, type Db } from '@evidex/db';
import { desc, gt } from 'drizzle-orm';
import { authRoutes, SESSION_COOKIE } from './auth/routes';
import { createAuthService, type GithubProfile } from './auth/service';
import { createEmailSenderFromEnv, type EmailSender } from './lib/email';
import type { Env } from './lib/env';
import { AppError, fail, ok } from './lib/response';
import { withRole, type AuthVars } from './auth/middleware';
import { deleteCookie, getCookie } from 'hono/cookie';
import { kullanicilariSil } from './account/silme';
import { withHtml } from './lib/email-html';
import { ipOf, sinir, sinirAsildi, sinirlayici } from './lib/rate-limit';
import {
  demoInbox,
  demoLoginEmail,
  demoStatus,
  removeDemoNetwork,
  seedDemoNetwork,
  withDemoInbox,
} from './demo/network';
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
  /**
   * İhtiyaç onayından sonra eşleştirme: üretimde arka planda (kurum 30 sn beklemez), testlerde
   * satır içi (sonuç hemen doğrulanabilsin). Varsayılan arka plan.
   */
  inlineMatching?: boolean;
  /** İstek sınırları (varsayılan açık); testler kapatır, sınır testi ayrıca açar. */
  rateLimit?: boolean;
}

/** Bağımlılıklar dışarıdan gelir; testler sahte DB/e-posta/GitHub ile aynı uygulamayı kurar. */
export function createApp(deps: AppDeps) {
  const app = new Hono();
  const auth = createAuthService(deps.db);
  const email = withDemoInbox(deps.db, withHtml(deps.email ?? createEmailSenderFromEnv(deps.env)));
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

  // Kötüye kullanım sınırları (bkz. lib/rate-limit). Anahtar: oturum varsa oturum, yoksa IP.
  const sn = deps.rateLimit === false ? null : sinirlayici();
  const oturumVeyaIp = (c: Context) => getCookie(c, SESSION_COOKIE) ?? ipOf(c);
  const yalnizPost =
    (mw: ReturnType<typeof sinir>): MiddlewareHandler =>
    async (c, next) =>
      c.req.method === 'POST' ? mw(c, next) : next();
  app.use('/api/*', sinir(sn, 'genel', 600, 60_000));
  // Gövde sınırı okunmadan önce: belge 5 MB (+ form payı), gerisi 1 MB. Aksi hâlde dev bir istek
  // boyut kontrolüne varmadan belleğe alınıyordu.
  const asiriBuyuk = () => {
    throw new AppError('too_large', 'İstek çok büyük', 413);
  };
  app.use(
    '/api/me/evidence/document',
    bodyLimit({ maxSize: 6 * 1024 * 1024, onError: asiriBuyuk }),
  );
  app.use('/api/*', async (c, next) =>
    c.req.path === '/api/me/evidence/document'
      ? next()
      : bodyLimit({ maxSize: 1024 * 1024, onError: asiriBuyuk })(c, next),
  );
  app.use('/api/auth/magic-link', yalnizPost(sinir(sn, 'giris-ip', 8, 10 * 60_000)));
  app.use('/api/auth/magic-link', async (c, next) => {
    // Aynı adrese art arda bağlantı: e-posta bombardımanını adres başına keser.
    const govde = (await c.req.json().catch(() => ({}))) as { email?: unknown };
    const adres = typeof govde.email === 'string' ? govde.email.trim().toLowerCase() : '';
    if (sn && adres && !sn.izin(`giris-adres:${adres}`, 3, 15 * 60_000)) throw sinirAsildi();
    await next();
  });
  app.use('/api/needs', yalnizPost(sinir(sn, 'ihtiyac', 40, 3_600_000, oturumVeyaIp)));
  app.use('/api/needs/*', yalnizPost(sinir(sn, 'ihtiyac', 40, 3_600_000, oturumVeyaIp)));
  for (const yol of ['/api/me/card/rewrite', '/api/me/evidence/github/sync'])
    app.use(yol, yalnizPost(sinir(sn, 'kart-okuma', 8, 3_600_000, oturumVeyaIp)));
  app.use('/api/me/evidence/*', yalnizPost(sinir(sn, 'kanit', 30, 3_600_000, oturumVeyaIp)));
  app.use('/api/checkin/*', yalnizPost(sinir(sn, 'takip', 20, 10 * 60_000)));

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
    needRoutes(
      auth,
      createNeedService(deps.db, llm, matching, { inlineMatching: deps.inlineMatching ?? false }),
      matching,
      challenge,
    ),
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
    new Hono().use('*', withRole(auth, 'operator')).get('/', async (c) =>
      ok(
        c,
        // Son 7 gün: düzeltilmiş eski hatalar panelde kalabalık etmesin; kayıt tabloda durur.
        await deps.db
          .select()
          .from(errorLog)
          .where(gt(errorLog.createdAt, new Date(Date.now() - 7 * 24 * 3600 * 1000)))
          .orderBy(desc(errorLog.createdAt))
          .limit(50),
      ),
    ),
  );
  // Hesabını sil (KVKK): genç ve kurum kendi hesabını ve ona bağlı her şeyi siler. Operatör
  // hesabı buradan silinmez (karar kayıtlarının sahibi). Oturum çerezi de düşer.
  app.route(
    '/api/me/account',
    new Hono<AuthVars>()
      .use('*', withRole(auth, 'talent', 'organization'))
      .delete('/', async (c) => {
        await kullanicilariSil(deps.db, [c.get('user').id]);
        deleteCookie(c, SESSION_COOKIE, { path: '/' });
        return ok(c, { deleted: true });
      }),
  );
  // Demo ağı: yalnız operatör; yükle (idempotent) / kaldır (yalnız @demo.evidex.dev).
  app.route(
    '/api/operator/demo',
    new Hono()
      .use('*', withRole(auth, 'operator'))
      .get('/', async (c) => ok(c, await demoStatus(deps.db)))
      .post('/', async (c) => ok(c, await seedDemoNetwork(deps.db)))
      .delete('/', async (c) => ok(c, await removeDemoNetwork(deps.db)))
      .get('/mail', async (c) => ok(c, await demoInbox(deps.db)))
      .post('/login/:slug', async (c) => {
        const email = await demoLoginEmail(deps.db, c.req.param('slug'));
        if (!email) throw new AppError('not_found', 'Demo hesabı bulunamadı', 404);
        const raw = await auth.requestMagicLink(email);
        return ok(c, { url: `${deps.env.API_ORIGIN}/api/auth/magic/${raw}` });
      }),
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
    // Ön kapı: oturumu olmayan ziyaretçi kök adreste ve "Nasıl çalışır"da tanıtım sayfasını
    // görür (film, döngü, kanıt seviyeleri); oturumu olan doğrudan paneline (SPA) gider.
    // Çerez geçersizse SPA girişe yönlendirir — döngü yok.
    const tanitim = serveStatic({ root: webDist, path: 'tanitim/index.html' });
    for (const yol of ['/', '/nasil-calisir'])
      app.get(yol, async (c, next) => {
        if (getCookie(c, SESSION_COOKIE)) return next();
        return (await tanitim(c, next)) ?? next();
      });
    app.use('/*', serveStatic({ root: webDist }));
    const indexHtml = serveStatic({ root: webDist, path: 'index.html' });
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api/'))
        return fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404));
      // Paylaşılan kart (/k/:slug): önizleme etiketleri kartın sahibine göre doldurulur ki Slack /
      // WhatsApp / LinkedIn linki "Evidex" değil "Ad · başlık" diye açsın. Kapalı kart genel kalır.
      const kart = /^\/k\/([^/]+)\/?$/.exec(c.req.path);
      if (kart) {
        const html = await kartOnizleme(webDist, decodeURIComponent(kart[1]!));
        if (html) return c.html(html);
      }
      return (await indexHtml(c, next)) ?? c.notFound();
    });
  }

  async function kartOnizleme(dist: string, slug: string) {
    let k: Awaited<ReturnType<typeof talent.publicCard>>;
    try {
      k = await talent.publicCard(slug);
    } catch {
      return null;
    }
    const kac = k.claims.length;
    const dogrulanmis = k.claims.filter((x) => x.level === 'verified').length;
    const baslik = `${k.name}${k.headline ? ` · ${k.headline}` : ''}`;
    const aciklama = `Kanıta dayalı yetkinlik kartı: ${kac} iddia${dogrulanmis ? `, ${dogrulanmis} tanesi sahipliği doğrulanmış kaynaktan` : ''}. Evidex · GİRVAK gençlik ağı.`;
    const kacis = (v: string) =>
      v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return (await Bun.file(`${dist}/index.html`).text())
      .replace(/<title>[^<]*<\/title>/, `<title>${kacis(baslik)} · Evidex</title>`)
      .replace(/(property="og:title" content=")[^"]*/, `$1${kacis(baslik)}`)
      .replace(/(property="og:description" content=")[^"]*/, `$1${kacis(aciklama)}`)
      .replace(/(property="og:type" content=")[^"]*/, '$1profile');
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
