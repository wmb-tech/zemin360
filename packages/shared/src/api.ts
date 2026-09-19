import { z } from 'zod';

/**
 * ### API zarfı
 * Her uç `{ ok: true, data }` ya da `{ ok: false, error: { code, message } }` döner.
 * ⚠ İstemci `ok` alanına bakmadan `data`ya dokunmaz — hata dalı okunmayan istemci
 * "kayıt yok" gibi görünen sessiz arızalar üretir.
 */
export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; error: ApiError };
export type ApiResponse<T> = ApiOk<T> | ApiFail;
