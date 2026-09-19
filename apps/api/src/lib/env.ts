import { z } from 'zod';

/**
 * Env tek yerde okunur ve doğrulanır; eksik alan açılışta patlar, çalışırken değil.
 * ⚠ Bir alanı buraya eklemeden kullanmak yasak — şema/üretim boşluğu böyle doğar.
 */
const Env = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(3100),
  WEB_ORIGIN: z.string().url().default('http://localhost:5100'),
  API_ORIGIN: z.string().url().default('http://localhost:3100'),
  SESSION_SECRET: z.string().min(8),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('Evidex <no-reply@evidex.local>'),
  LLM_PROVIDER: z.enum(['anthropic', 'openai', 'fake']).default('fake'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const sonuc = Env.safeParse(source);
  if (!sonuc.success) {
    const eksik = sonuc.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Env doğrulanamadı: ${eksik}`);
  }
  return sonuc.data;
}
