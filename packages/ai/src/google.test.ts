import { describe, expect, test } from 'bun:test';
import { adDuzelt } from './google';

describe('adDuzelt', () => {
  test('noktasız I ile yazılan kurum adını düzeltir, doğrusuna dokunmaz', () => {
    expect(adDuzelt('{"subject":"GIRVAK İş Birliği Takip"}')).toBe(
      '{"subject":"GİRVAK İş Birliği Takip"}',
    );
    expect(adDuzelt("GıRVAK'ın ve GİRVAK'ın")).toBe("GİRVAK'ın ve GİRVAK'ın");
  });
});
