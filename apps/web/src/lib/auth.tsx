import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@evidex/shared';
import { api, ApiRequestError } from './api';

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
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setMe(await api<Me>('/api/auth/me'));
    } catch (e) {
      // 401 = oturum yok, normal. Başka hata (API kapalı) gizlenmez ama sayfayı da kilitlemez:
      // açılış sayfası oturumsuz çalışır.
      if (!(e instanceof ApiRequestError && e.status === 401)) console.error(e);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth AuthProvider dışında');
  return v;
}
