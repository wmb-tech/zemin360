import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ApiResponse } from '@evidex/shared';

const TOKEN_KEY = 'evidex_session';

/** API kökü app.json → extra.apiOrigin; EAS'ta ortam değişkeniyle ezilir. */
export const API_ORIGIN: string =
  (Constants.expoConfig?.extra?.apiOrigin as string | undefined) ?? 'http://localhost:3100';

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

/**
 * Web'deki `api()` ile aynı sözleşme: zarfı okur, `ok:false` ise fırlatır. Fark: oturum
 * çerez değil Bearer (SecureStore). Elle fetch yazılmaz.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenStore.get();
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body) throw new ApiRequestError('bad_response', 'Sunucu cevabı okunamadı', res.status);
  if (!body.ok) throw new ApiRequestError(body.error.code, body.error.message, res.status);
  return body.data;
}
