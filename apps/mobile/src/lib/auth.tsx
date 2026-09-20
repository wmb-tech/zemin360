import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Role } from '@evidex/shared';
import { API_ORIGIN, api, ApiRequestError, tokenStore } from './api';

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  githubLogin: string | null;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/**
 * Mobil giriş (KARAR-07/12): GitHub OAuth sistem tarayıcısında koşar; API `client=mobile`
 * görünce oturum token'ını `evidex://auth?token=` derin linkiyle döner; SecureStore'a yazılır.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setMe(await api<Me>('/api/auth/me'));
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 401)) console.error(e);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function tokenFromUrl(url: string | null) {
    if (!url) return false;
    const { queryParams, path } = Linking.parse(url);
    const token = queryParams?.token;
    if (path !== 'auth' || typeof token !== 'string') return false;
    await tokenStore.set(token);
    await refresh();
    return true;
  }

  useEffect(() => {
    void Linking.getInitialURL().then(async (u) => {
      if (!(await tokenFromUrl(u))) await refresh();
    });
    const sub = Linking.addEventListener('url', (e) => void tokenFromUrl(e.url));
    return () => sub.remove();
  }, []);

  async function login() {
    const redirect = Linking.createURL('auth');
    const r = await WebBrowser.openAuthSessionAsync(
      `${API_ORIGIN}/api/auth/github?client=mobile`,
      redirect,
    );
    if (r.type === 'success') await tokenFromUrl(r.url);
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      await tokenStore.clear();
      setMe(null);
    }
  }

  return <Ctx.Provider value={{ me, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider dışında useAuth');
  return v;
}
