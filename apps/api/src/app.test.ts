import { describe, expect, it } from 'bun:test';
import { createApp } from './app';

describe('api zarfı', () => {
  it('sağlık ucu ok zarfı döner', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.service).toBe('evidex-api');
  });

  it('bilinmeyen uç hata zarfı döner, sessizce 200 değil', async () => {
    const res = await createApp().request('/api/yok');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('not_found');
  });
});
