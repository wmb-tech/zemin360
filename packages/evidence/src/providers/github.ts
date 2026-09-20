import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import type { ExtractedSignals } from '../provider';

/**
 * ### GitHub kanıt sağlayıcısı (ADR-0003, ADR-0005)
 * Kurulum token'ıyla yalnız kişinin seçtiği repolar okunur. Kod indirilmez: dil dağılımı,
 * commit zaman aralığı ve sahiplik oranı, katkıcı sayısı, README/test/CI varlığı, canlı URL,
 * manifest'ten araçlar. Çıktı yalnız sinyal.
 * ⚠ Hız sınırı: commit listesi en fazla COMMIT_SAMPLE ile örneklenir; büyük repoda "tam sayı"
 * değil "örneklem oranı" döner ve `authorshipSampled: true` işaretlenir.
 */
const COMMIT_SAMPLE = 300;

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
}

export interface RepoRef {
  fullName: string; // owner/name
  private: boolean;
  defaultBranch: string;
}

export function createGithubEvidence(cfg: GithubAppConfig) {
  // ⚠ @octokit/app'in varsayılan istemcisinde paginate/rest eklentileri YOK — ilk gerçek
  // senkronda "paginate is not a function" ile patladı (sahte GitHub'lı testler görmez).
  // @octokit/rest'in Octokit'i verilir; getInstallationOctokit onunla üretir.
  const app = new App({
    appId: cfg.appId,
    privateKey: cfg.privateKey,
    Octokit,
    ...(cfg.clientId && cfg.clientSecret
      ? { oauth: { clientId: cfg.clientId, clientSecret: cfg.clientSecret } }
      : {}),
  });

  async function client(installationId: string): Promise<Octokit> {
    return app.getInstallationOctokit(Number(installationId));
  }

  return {
    /**
     * Kurulumun sahibi hangi GitHub hesabı? ⚠ callback'teki installation_id kullanıcı
     * kontrolündedir; kaydetmeden önce sahibi oturumdaki GitHub kimliğiyle karşılaştırılır.
     */
    async installationOwner(
      installationId: string,
    ): Promise<{ id: string; login: string; type: 'user' | 'org' } | null> {
      const { data } = await app.octokit.request('GET /app/installations/{installation_id}', {
        installation_id: Number(installationId),
      });
      const hesap = data.account as { id?: number; login?: string; type?: string } | null;
      if (!hesap?.id) return null;
      return {
        id: String(hesap.id),
        login: hesap.login ?? '',
        type: hesap.type === 'Organization' ? 'org' : 'user',
      };
    },

    /**
     * Kişinin OAuth token'ıyla erişebildiği kurulumlar (GitHub'ın kendi listesi). Org kurulumu
     * yalnız bu listede varsa bağlanır: başkasının installation_id'sini URL'e yazmak işe yaramaz.
     */
    async userInstallationIds(userToken: string): Promise<string[]> {
      const gh = new Octokit({ auth: userToken, userAgent: 'evidex' });
      const { data } = await gh.request('GET /user/installations', { per_page: 100 });
      return data.installations.map((i) => String(i.id));
    },

    /** Kurulumdaki repolar: kişinin GitHub'da bizzat seçtikleri. */
    async listRepos(installationId: string): Promise<RepoRef[]> {
      const gh = await client(installationId);
      const repos = await gh.paginate('GET /installation/repositories', { per_page: 100 });
      return repos.map((r) => ({
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
      }));
    },

    /** Sahiplik: repo kurulumda listeleniyorsa kişi onu bilinçli bağlamıştır. */
    async verifyOwnership(installationId: string, fullName: string) {
      const repos = await this.listRepos(installationId);
      return repos.some((r) => r.fullName === fullName);
    },

    async extract(
      installationId: string,
      fullName: string,
      githubLogin: string,
    ): Promise<ExtractedSignals> {
      const gh = await client(installationId);
      const [owner, repo] = fullName.split('/') as [string, string];

      const [{ data: meta }, { data: languages }] = await Promise.all([
        gh.repos.get({ owner, repo }),
        gh.repos.listLanguages({ owner, repo }),
      ]);

      // Commit örneklemi: en yeni COMMIT_SAMPLE commit; sahiplik oranı ve zaman aralığı buradan.
      const commits = await gh.paginate(
        gh.repos.listCommits,
        { owner, repo, per_page: 100 },
        (res, done) => {
          if (res.data.length >= COMMIT_SAMPLE) done();
          return res.data;
        },
      );
      const ornek = commits.slice(0, COMMIT_SAMPLE);
      const kisininki = ornek.filter(
        (c) => c.author?.login?.toLowerCase() === githubLogin.toLowerCase(),
      ).length;
      const tarihler = ornek
        .map((c) => c.commit.author?.date ?? c.commit.committer?.date)
        .filter((d): d is string => Boolean(d))
        .sort();
      // Kişinin repodaki toplam commit'i (örneklemden bağımsız, ≤ 300 sayılır). Org reposunda
      // "kanıt" olabilmenin kapısı: 0 ise repo kaynağa girmez.
      const kendiCommitleri = await gh.paginate(
        gh.repos.listCommits,
        { owner, repo, author: githubLogin, per_page: 100 },
        (res, done) => {
          if (res.data.length >= 300) done();
          return res.data;
        },
      );
      const ownCommits = kendiCommitleri.length;
      const kendiTarihler = kendiCommitleri
        .map((c) => c.commit.author?.date ?? c.commit.committer?.date)
        .filter((d): d is string => Boolean(d))
        .sort();
      const ilkKendi = kendiTarihler[0];
      const sonKendi = kendiTarihler[kendiTarihler.length - 1];

      let contributors = 1;
      try {
        const { data } = await gh.repos.listContributors({
          owner,
          repo,
          per_page: 100,
          anon: 'false',
        });
        contributors = data.length || 1;
      } catch {
        // Boş/çok büyük repoda 204/403 gelebilir; katkıcı sayısı bilinmiyor diye akış durmaz.
      }

      // Ağaç: yalnız yol adları (içerik değil). README, test, CI, manifest varlığı.
      let paths: string[] = [];
      try {
        const { data: tree } = await gh.git.getTree({
          owner,
          repo,
          tree_sha: meta.default_branch,
          recursive: '1',
        });
        paths = tree.tree.map((t) => t.path ?? '').filter(Boolean);
      } catch {
        // Boş repo
      }
      const has = (re: RegExp) => paths.some((p) => re.test(p));

      const tools: string[] = [];
      if (has(/^package\.json$/)) tools.push('Node.js');
      if (has(/^(pnpm-lock\.yaml|yarn\.lock|package-lock\.json|bun\.lock)$/))
        tools.push('npm/pnpm/yarn/bun');
      if (has(/^(requirements\.txt|pyproject\.toml)$/)) tools.push('Python paketleme');
      if (has(/^Dockerfile$|docker-compose\.ya?ml$/)) tools.push('Docker');
      if (has(/^\.github\/workflows\//)) tools.push('GitHub Actions');
      if (has(/^app\.json$|^eas\.json$/)) tools.push('Expo');
      if (has(/^(next|vite|nuxt)\.config\./)) tools.push('Vite/Next');
      if (has(/^tsconfig\.json$/)) tools.push('TypeScript');

      return {
        languages: Object.keys(languages),
        tools,
        firstActivityAt: tarihler[0] ?? meta.created_at,
        lastActivityAt: tarihler.at(-1) ?? meta.pushed_at ?? undefined,
        authorshipRatio: ornek.length ? kisininki / ornek.length : 0,
        authorshipSampled: commits.length >= COMMIT_SAMPLE,
        commitCount: ornek.length,
        ownCommits,
        ...(ilkKendi ? { ownFirstCommitAt: ilkKendi } : {}),
        ...(sonKendi ? { ownLastCommitAt: sonKendi } : {}),
        contributors,
        deployed: Boolean(meta.homepage) || Boolean(meta.has_pages),
        homepage: meta.homepage || undefined,
        hasTests: has(/(^|\/)(tests?|__tests__|spec)\//) || has(/\.(test|spec)\.[jt]sx?$/),
        hasReadme: has(/^readme\.md$/i),
        hasCi: has(/^\.github\/workflows\//),
        isPrivate: meta.private,
        description: meta.description ?? undefined,
        topics: meta.topics ?? [],
        stars: meta.stargazers_count,
        fork: meta.fork,
      };
    },
  };
}

export type GithubEvidence = ReturnType<typeof createGithubEvidence>;
