import { describe, expect, it } from 'bun:test';
import { skillsToQuery } from './githubScout';

describe('keşif sorgusu', () => {
  it('beceriyi GitHub diline çevirir, bilinmeyeni anahtar kelime yapar, en çok 2 dil', () => {
    const q = skillsToQuery(['React Native', 'Node.js', 'Python', 'Figma', 'SEO']);
    expect(q.languages).toEqual(['TypeScript', 'JavaScript']);
    expect(q.keywords).toEqual(['Figma', 'SEO']);
    expect(q.locations[0]).toBe('Istanbul');
  });
});
