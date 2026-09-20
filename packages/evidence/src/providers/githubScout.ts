import { Octokit } from '@octokit/rest';

/**
 * Ağ dışı keşif (keşfet 01): GitHub'da herkese açık profilleri arar, her biri için küçük bir
 * sinyal özeti çıkarır. Yalnız herkese açık veri; e-posta yalnız kişi profilinde açıkça
 * yayınladıysa alınır. Sonuç saklanmaz; keşif ajanına gider, seçilenler davet kuyruğuna düşer.
 * ⚠ Arama API'si token'sız 10 istek/dk; sunucu token'ı (GITHUB_SERVER_TOKEN) pratikte zorunlu.
 */
export interface ScoutCandidate {
  login: string;
  url: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  email: string | null; // yalnız herkese açık profil e-postası
  publicRepos: number;
  followers: number;
  createdAt: string;
  topLanguages: string[]; // son itilen ≤ 8 repodan
  recentRepos: { name: string; language: string | null; pushedAt: string | null; stars: number }[];
  lastPushedAt: string | null;
}

export interface ScoutQuery {
  languages: string[]; // GitHub dil adları (TypeScript, Python…)
  keywords: string[]; // bio/isim araması için (ör. "mobile", "react native")
  locations: string[]; // "Istanbul", "Turkey"…
  limit: number; // toplam aday üst sınırı
}

export interface GithubScout {
  search(q: ScoutQuery): Promise<ScoutCandidate[]>;
}

/** İhtiyaç becerilerini GitHub dil adına çevirir; eşleşmeyen anahtar kelime olarak kalır. */
const LANG: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  react: 'TypeScript',
  'react native': 'TypeScript',
  node: 'JavaScript',
  'node.js': 'JavaScript',
  python: 'Python',
  django: 'Python',
  flutter: 'Dart',
  dart: 'Dart',
  kotlin: 'Kotlin',
  swift: 'Swift',
  java: 'Java',
  'c#': 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
};

export function skillsToQuery(skills: string[], limit = 12): ScoutQuery {
  const languages = new Set<string>();
  const keywords: string[] = [];
  for (const s of skills) {
    const k = s.trim().toLowerCase();
    const dil = LANG[k];
    if (dil) languages.add(dil);
    else keywords.push(s.trim());
  }
  return {
    languages: [...languages].slice(0, 2),
    keywords: keywords.slice(0, 2),
    locations: ['Istanbul', 'Turkey', 'Türkiye'],
    limit,
  };
}

export function createGithubScout(opts: { token?: string } = {}): GithubScout {
  const gh = new Octokit(
    opts.token ? { auth: opts.token, userAgent: 'evidex' } : { userAgent: 'evidex' },
  );
  return {
    async search(q) {
      // Sorgu sırası: önce dil + anahtar kelime (bio), sonra yalnız dil; konum konum. Anahtar
      // kelimeyi zorunlu tutmak sonucu boğar ("REST API" in:bio → 4 kişi), o yüzden kademeli.
      const sorgular: string[] = [];
      for (const loc of q.locations) {
        const temel = [
          `location:"${loc}"`,
          ...q.languages.map((l) => `language:"${l}"`),
          'repos:>=3',
          'type:user',
        ];
        for (const k of q.keywords) sorgular.push([...temel, `"${k}" in:bio`].join(' '));
        sorgular.push(temel.join(' '));
      }
      const seen = new Map<string, { login: string; score: number }>();
      for (const sorgu of sorgular) {
        if (seen.size >= q.limit) break;
        const { data } = await gh.search.users({ q: sorgu, per_page: Math.min(10, q.limit) });
        for (const u of data.items) {
          if (!seen.has(u.login)) seen.set(u.login, { login: u.login, score: u.score ?? 0 });
        }
      }

      const adaylar: ScoutCandidate[] = [];
      for (const { login } of [...seen.values()].slice(0, q.limit)) {
        const { data: u } = await gh.users.getByUsername({ username: login });
        const { data: repos } = await gh.repos.listForUser({
          username: login,
          sort: 'pushed',
          per_page: 8,
        });
        const diller = new Map<string, number>();
        for (const r of repos)
          if (r.language) diller.set(r.language, (diller.get(r.language) ?? 0) + 1);
        adaylar.push({
          login: u.login,
          url: u.html_url,
          name: u.name ?? null,
          bio: u.bio ?? null,
          location: u.location ?? null,
          email: u.email ?? null,
          publicRepos: u.public_repos,
          followers: u.followers,
          createdAt: u.created_at,
          topLanguages: [...diller.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d),
          recentRepos: repos.map((r) => ({
            name: r.name,
            language: r.language ?? null,
            pushedAt: r.pushed_at ?? null,
            stars: r.stargazers_count ?? 0,
          })),
          lastPushedAt: repos[0]?.pushed_at ?? null,
        });
      }
      return adaylar;
    },
  };
}
