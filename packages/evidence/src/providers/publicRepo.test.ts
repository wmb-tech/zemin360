import { describe, expect, it } from 'bun:test';
import { parseGithubRepoUrl } from './publicRepo';

describe('teslim adresi', () => {
  it('yalnız github.com/owner/repo kabul eder', () => {
    expect(parseGithubRepoUrl('https://github.com/ayse/kafe')).toEqual({
      owner: 'ayse',
      repo: 'kafe',
    });
    expect(parseGithubRepoUrl('https://github.com/ayse/kafe.git/')).toEqual({
      owner: 'ayse',
      repo: 'kafe',
    });
    expect(parseGithubRepoUrl('https://gitlab.com/ayse/kafe')).toBeNull();
    expect(parseGithubRepoUrl('https://github.com/ayse')).toBeNull();
    expect(parseGithubRepoUrl('bozuk')).toBeNull();
  });
});
