import { describe, expect, it } from 'bun:test';
import { readmeOzeti } from './github';

describe('README özeti (ürün bağlamı)', () => {
  it('rozet, HTML, kod bloğu ve tablo satırlarını atar; başlık işaretlerini soyar; 600 karakterde keser', () => {
    const raw = `# Gisè Studio
[![CI](https://x/badge.svg)](https://x)
<p align="center"><img src="logo.png"></p>

Mimarlık stüdyosu için e-ticaret ve içerik paneli. [Canlı](https://gisestudio.com)

\`\`\`bash
bun install
\`\`\`
| a | b |
|---|---|
${'x'.repeat(700)}`;
    const ozet = readmeOzeti(raw)!;
    expect(
      ozet.startsWith('Gisè Studio Mimarlık stüdyosu için e-ticaret ve içerik paneli. Canlı'),
    ).toBe(true);
    expect(ozet).not.toContain('badge');
    expect(ozet).not.toContain('<p');
    expect(ozet).not.toContain('bun install');
    expect(ozet).not.toContain('|');
    expect(ozet.length).toBe(600);
  });

  it('içeriksiz README undefined döner', () => {
    expect(readmeOzeti('![only](badge.svg)\n\n')).toBeUndefined();
  });
});
