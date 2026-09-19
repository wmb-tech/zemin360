import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiFail, ApiOk } from '@evidex/shared';

/** Tüm handler'lar `ok()` döner; hata için `AppError` fırlatılır (ADR-0001). */
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<ApiOk<T>>({ ok: true, data }, status);
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: ContentfulStatusCode = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function fail(c: Context, err: AppError) {
  const body: ApiFail = {
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
  return c.json(body, err.status);
}
