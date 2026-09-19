import { describe, expect, it } from 'bun:test';
import { testApp } from '../test/setup';

describe('api zarfı', () => {
  it('sağlık ucu ok zarfı döner', async () => {
    const res = await testApp().app.request('/api/health');
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
  it('bilinmeyen uç hata zarfı döner, sessizce 200 değil', async () => {
    const res = await testApp().app.request('/api/yok');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });
});
