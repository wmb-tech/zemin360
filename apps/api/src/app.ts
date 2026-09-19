import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { AppError, fail } from './lib/response';
import { health } from './routes/health';

export function createApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use(
    '/api/*',
    cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5100', credentials: true }),
  );

  app.route('/api/health', health);

  app.notFound((c) => fail(c, new AppError('not_found', 'Kaynak bulunamadı', 404)));
  app.onError((err, c) => {
    if (err instanceof AppError) return fail(c, err);
    console.error(err);
    return fail(c, new AppError('internal', 'Beklenmeyen hata', 500));
  });

  return app;
}
