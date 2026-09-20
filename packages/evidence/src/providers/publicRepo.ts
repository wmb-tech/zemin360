import { Octokit } from '@octokit/rest';

/**
 * Herkese açık repo sinyalleri (meydan okuma teslimleri için). Kurulum gerekmez; isteğe
 * bağlı sunucu token'ı hız sınırını 60/sa → 5000/sa yapar. README metni yalnız değerlendirme
 * ajanına gider, saklanmaz (ADR-0003).
 */
export interface PublicRepoSignals {
  fullName: string;
  languages: string[];
  fileCount: number;
  filePaths: string[]; // ≤ 80 yol, ajan için kısaltılmış
  readme: string | null; // ≤ 4000 karakter
  hasTests: boolean;
  hasReadme: boolean;
  lastCommitAt: string | null;
  commitCount: number; // ≤ 100 örneklem
  description: string | null;
}

export function parseGithubRepoUrl(raw: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(raw);
    if (u.hostname !== 'github.com') return null;
    const [owner, repo] = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

export function createPublicRepoEvidence(opts: { token?: string } = {}) {
  const gh = new Octokit(
    opts.token ? { auth: opts.token, userAgent: 'evidex' } : { userAgent: 'evidex' },
  );
  return {
    async extract(repoUrl: string): Promise<PublicRepoSignals> {
      const ref = parseGithubRepoUrl(repoUrl);
      if (!ref) throw new Error('Teslim bir GitHub repo adresi olmalı');
      const { owner, repo } = ref;
      const { data: meta } = await gh.repos.get({ owner, repo });
      const { data: languages } = await gh.repos.listLanguages({ owner, repo });
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
        /* boş repo */
      }
      let readme: string | null = null;
      try {
        const { data } = await gh.repos.getReadme({ owner, repo });
        readme = Buffer.from(data.content, 'base64').toString('utf8').slice(0, 4000);
      } catch {
        /* README yok */
      }
      const { data: commits } = await gh.repos.listCommits({ owner, repo, per_page: 100 });
      return {
        fullName: meta.full_name,
        languages: Object.keys(languages),
        fileCount: paths.length,
        filePaths: paths.slice(0, 80),
        readme,
        hasTests: paths.some(
          (p) => /(^|\/)(tests?|__tests__|spec)\//.test(p) || /\.(test|spec)\.[jt]sx?$/.test(p),
        ),
        hasReadme: readme !== null,
        lastCommitAt: commits[0]?.commit.author?.date ?? null,
        commitCount: commits.length,
        description: meta.description,
      };
    },
  };
}

export type PublicRepoEvidence = ReturnType<typeof createPublicRepoEvidence>;
