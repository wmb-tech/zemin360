import { describe, expect, it } from 'bun:test';
import { skillsFromSources } from './skills';

describe('yetkinlik seti (kanıttan türetme)', () => {
  it('dil+araçları kaynaklar arasında toplar; gürültüyü atar; en yüksek seviyeyi taşır', () => {
    const skills = skillsFromSources([
      {
        ref: 'a/web',
        level: 'verified',
        signals: {
          languages: ['TypeScript', 'CSS', 'Dockerfile'],
          tools: ['TypeScript', 'Docker', 'Node.js', 'Vite/Next'],
          ownCommits: 120,
          ownFirstCommitAt: '2026-03-01T00:00:00Z',
          ownLastCommitAt: '2026-08-01T00:00:00Z',
        },
      },
      {
        ref: 'a/api',
        level: 'declared',
        signals: {
          languages: ['TypeScript', 'Shell'],
          tools: ['Docker'],
          commitCount: 30,
          firstActivityAt: '2025-11-01T00:00:00Z',
          lastActivityAt: '2026-09-01T00:00:00Z',
        },
      },
    ]);
    const ts = skills.find((s) => s.name === 'TypeScript')!;
    expect(ts.repos).toBe(2);
    expect(ts.commits).toBe(150);
    expect(ts.firstAt).toBe('2025-11-01T00:00:00Z');
    expect(ts.lastAt).toBe('2026-09-01T00:00:00Z');
    expect(ts.level).toBe('verified');
    expect(skills.map((s) => s.name)).not.toContain('Dockerfile');
    expect(skills.map((s) => s.name)).not.toContain('Shell');
    expect(skills.map((s) => s.name)).not.toContain('Node.js');
    expect(skills.map((s) => s.name)).toContain('Vite / Next.js');
    // Sıra: repo sayısı önce (TypeScript, Docker 2'şer), sonra commit
    expect(skills[0]!.name).toBe('TypeScript');
    expect(skills[1]!.name).toBe('Docker');
  });

  it('sinyalsiz kaynak yetkinlik üretmez', () => {
    expect(skillsFromSources([{ ref: 'x', level: 'documented', signals: {} }])).toEqual([]);
  });
});
