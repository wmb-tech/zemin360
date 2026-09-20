import { createDb } from '@evidex/db';
import { createApp } from '../app';
import { loadEnv } from '../lib/env';
import type { EmailSender } from '../lib/email';
import type { GithubProfile } from '../auth/service';
import { createFakeProvider, type LlmProvider } from '@evidex/ai';
import type { GithubEvidence, LiveUrlEvidence, PublicRepoEvidence } from '@evidex/evidence';

/** Testler gerçek (test) Postgres üzerinde koşar; e-posta ve GitHub sahte. */
export function testApp(
  opts: {
    github?: GithubEvidence | null;
    githubProfile?: GithubProfile;
    llm?: LlmProvider;
    liveUrl?: LiveUrlEvidence;
    publicRepo?: PublicRepoEvidence;
  } = {},
) {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  const gonderilen: { to: string; text: string }[] = [];
  const email: EmailSender = {
    async send(msg) {
      gonderilen.push({ to: msg.to, text: msg.text });
    },
  };
  const { app, followUp, network } = createApp({
    env,
    db,
    email,
    llm: opts.llm ?? createFakeProvider(),
    github: opts.github ?? null,
    ...(opts.liveUrl ? { liveUrl: opts.liveUrl } : {}),
    ...(opts.publicRepo ? { publicRepo: opts.publicRepo } : {}),
    fetchGithubProfile: async () =>
      opts.githubProfile ?? { id: 1, login: 'ayse', name: 'Ayşe', email: 'ayse@example.com' },
  });
  return { app, db, gonderilen, followUp, network };
}

/** Set-Cookie başlığından çerezi çıkarır; yoksa boş dize. */
export function cookieOf(res: Response, name: string) {
  const header = res.headers.get('set-cookie') ?? '';
  const m = header.match(new RegExp(`${name}=([^;]+)`));
  return m ? `${name}=${m[1]}` : '';
}
