import { and, desc, eq, inArray } from 'drizzle-orm';
import { cardClaims, evidenceSignals, evidenceSources, type Db } from '@evidex/db';
import type { EvidenceLevel } from '@evidex/shared';

/**
 * ### Yetkinlik seti — kanıttan türetilir, yazılmaz
 * Kart iddiaları "hangi iş" sorusuna cevap verir; "hangi araçlarla" sorusu ise onaylı iddiaların
 * kaynaklarındaki sinyallerden (languages, tools) burada deterministik çıkar: repo sayısı, kişinin
 * commit'i, ilk–son tarih, en yüksek kanıt seviyesi. Ajan yazmaz, dolayısıyla uyduramaz; onaysız
 * iddianın kaynağı sayılmaz (kapı aynı). Sıra: repo sayısı → commit → yakınlık.
 */
export interface SkillSource {
  ref: string;
  level: EvidenceLevel;
  signals: Record<string, unknown>;
}
export interface Skill {
  name: string;
  repos: number;
  commits: number;
  firstAt: string | null;
  lastAt: string | null;
  level: EvidenceLevel;
}

const LEVEL_RANK: Record<EvidenceLevel, number> = {
  verified: 3,
  documented: 2,
  referenced: 1,
  declared: 0,
};
/** Yetkinlik sayılmayan dil/araç etiketleri (her repoda çıkan gürültü). */
const GURULTU = new Set([
  'Dockerfile',
  'Makefile',
  'Batchfile',
  'Procfile',
  'Shell',
  'PowerShell',
  'HCL',
  'Nix',
  'Roff',
  'npm/pnpm/yarn/bun',
  'Python paketleme',
  'Node.js',
]);
/** Aynı yetkinliğin farklı adları tek başlıkta toplanır. */
const ESANLAM: Record<string, string> = { 'Vite/Next': 'Vite / Next.js' };

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function skillsFromSources(sources: SkillSource[]): Skill[] {
  const toplam = new Map<string, Skill>();
  for (const s of sources) {
    const diller = Array.isArray(s.signals.languages) ? (s.signals.languages as unknown[]) : [];
    const araclar = Array.isArray(s.signals.tools) ? (s.signals.tools as unknown[]) : [];
    const adlar = new Set(
      [...diller, ...araclar]
        .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
        .map((a) => ESANLAM[a] ?? a)
        .filter((a) => !GURULTU.has(a)),
    );
    if (adlar.size === 0) continue;
    const commits = num(s.signals.ownCommits) || num(s.signals.commitCount);
    const ilk = str(s.signals.ownFirstCommitAt) ?? str(s.signals.firstActivityAt);
    const son = str(s.signals.ownLastCommitAt) ?? str(s.signals.lastActivityAt);
    for (const ad of adlar) {
      const k = toplam.get(ad) ?? {
        name: ad,
        repos: 0,
        commits: 0,
        firstAt: null,
        lastAt: null,
        level: s.level,
      };
      k.repos += 1;
      k.commits += commits;
      if (ilk && (!k.firstAt || ilk < k.firstAt)) k.firstAt = ilk;
      if (son && (!k.lastAt || son > k.lastAt)) k.lastAt = son;
      if (LEVEL_RANK[s.level] > LEVEL_RANK[k.level]) k.level = s.level;
      toplam.set(ad, k);
    }
  }
  return [...toplam.values()].sort(
    (a, b) =>
      b.repos - a.repos || b.commits - a.commits || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''),
  );
}

/**
 * Bir gencin yetkinlik seti: yalnız ONAYLI iddiaların kaynaklarındaki son sinyallerden.
 * İddia seviyesi kaynağın kanıt seviyesidir (github_app → verified); aynı kural burada.
 */
export async function skillsForTalent(db: Db, talentId: string): Promise<Skill[]> {
  const onayli = await db
    .select({ sourceIds: cardClaims.sourceIds, level: cardClaims.level })
    .from(cardClaims)
    .where(and(eq(cardClaims.talentId, talentId), eq(cardClaims.approved, true)));
  const seviye = new Map<string, EvidenceLevel>();
  for (const c of onayli)
    for (const id of c.sourceIds) {
      const eski = seviye.get(id);
      if (!eski || LEVEL_RANK[c.level] > LEVEL_RANK[eski]) seviye.set(id, c.level);
    }
  if (seviye.size === 0) return [];
  const satirlar = await db
    .select({
      sourceId: evidenceSignals.sourceId,
      ref: evidenceSources.ref,
      signals: evidenceSignals.signals,
    })
    .from(evidenceSignals)
    .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceSignals.sourceId))
    .where(inArray(evidenceSignals.sourceId, [...seviye.keys()]))
    .orderBy(desc(evidenceSignals.extractedAt));
  const son = new Map<string, SkillSource>();
  for (const r of satirlar)
    if (!son.has(r.sourceId))
      son.set(r.sourceId, {
        ref: r.ref,
        level: seviye.get(r.sourceId)!,
        signals: r.signals as Record<string, unknown>,
      });
  return skillsFromSources([...son.values()]);
}
