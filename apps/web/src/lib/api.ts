import type { ApiResponse } from '@evidex/shared';

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Tek istek yolu. Zarfı okur; `ok:false` ise fırlatır — çağıran yer hata dalını
 * görmezden gelip "kayıt yok" gibi davranamaz. Elle fetch yazılmaz.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body) throw new ApiRequestError('bad_response', 'Sunucu cevabı okunamadı', res.status);
  if (!body.ok) throw new ApiRequestError(body.error.code, body.error.message, res.status);
  return body.data;
}
