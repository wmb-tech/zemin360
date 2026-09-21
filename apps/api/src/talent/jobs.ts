/**
 * ### Uzun kanıt işleri (okuma + taslak) istek üstünde koşmaz
 * 60 repoluk okuma + ajan yazımı dakikalar sürer; HTTP isteği vekil sunucuda zaman aşımına uğrar
 * ve istemci JSON yerine hata sayfası alır ("Sunucu cevabı okunamadı"). Bu yüzden iş arka planda
 * koşar, istemci durumunu sorar. Durum bellekte tutulur: sonucun kendisi veritabanındadır
 * (kaynaklar, iddialar), buradaki kayıt yalnız "koşuyor / bitti / hata" ve ilerlemedir; süreç
 * yeniden başlarsa kayıt düşer, kart yine doğrudur.
 */
export type JobMode = 'sync' | 'rewrite';
export interface JobState {
  mode: JobMode;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  finishedAt?: string;
  read: number;
  total: number;
  message?: string;
  result?: {
    skippedOrgRepos?: number | undefined;
    unreadRepos?: number | undefined;
    failedRepos?: number | undefined;
    cardFull?: boolean | undefined;
  };
}

const isler = new Map<string, JobState>();

export function jobOf(talentKey: string): JobState | null {
  return isler.get(talentKey) ?? null;
}

/** Koşan iş varsa null döner (çift tetikleme yok); yoksa işi başlatır. */
export function startJob(
  talentKey: string,
  mode: JobMode,
  run: (onProgress: (read: number, total: number) => void) => Promise<JobState['result']>,
): JobState | null {
  const mevcut = isler.get(talentKey);
  if (mevcut?.status === 'running') return null;
  const state: JobState = {
    mode,
    status: 'running',
    startedAt: new Date().toISOString(),
    read: 0,
    total: 0,
  };
  isler.set(talentKey, state);
  void run((read, total) => {
    state.read = read;
    state.total = total;
  })
    .then((result) => {
      state.status = 'done';
      state.finishedAt = new Date().toISOString();
      if (result) state.result = result;
    })
    .catch((err: unknown) => {
      state.status = 'error';
      state.finishedAt = new Date().toISOString();
      state.message = err instanceof Error ? err.message : String(err);
      console.error(`[job:${mode}] ${talentKey}`, err);
    });
  return state;
}
