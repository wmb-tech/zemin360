import { createDb } from '@evidex/db';
import { createApp } from '../app';
import { loadEnv } from '../lib/env';
import type { EmailSender } from '../lib/email';
import type { GithubProfile } from '../auth/service';
import { createFakeProvider, type LlmProvider } from '@evidex/ai';

/** Testler gerçek (test) Postgres üzerinde koşar; e-posta ve GitHub sahte. */
export function testApp(opts: { github?: GithubProfile; llm?: LlmProvider } = {}) {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  const gonderilen: { to: string; text: string }[] = [];
  const email: EmailSender = {
    async send(msg) {
      gonderilen.push({ to: msg.to, text: msg.text });
    },
  };
  const app = createApp({
    env,
    db,
    email,
    llm: opts.llm ?? createFakeProvider(),
    fetchGithubProfile: async () =>
      opts.github ?? { id: 1, login: 'ayse', name: 'Ayşe', email: 'ayse@example.com' },
  });
  return { app, db, gonderilen };
}

/** Set-Cookie başlığından çerezi çıkarır; yoksa boş dize. */
export function cookieOf(res: Response, name: string) {
  const header = res.headers.get('set-cookie') ?? '';
  const m = header.match(new RegExp(`${name}=([^;]+)`));
  return m ? `${name}=${m[1]}` : '';
}
