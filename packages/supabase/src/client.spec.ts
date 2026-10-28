import { describe, expect, it } from 'vitest';
import { assertBrowserSafeKey, createSupabaseBrowserClient } from './client';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('createSupabaseBrowserClient', () => {
  it('accepts an anon key', () => {
    const client = createSupabaseBrowserClient({
      url: 'https://example.supabase.co',
      anonKey: fakeJwt({ role: 'anon' }),
      appName: 'test',
    });
    expect(client).toBeDefined();
  });

  it('rejects a service_role key', () => {
    expect(() => assertBrowserSafeKey(fakeJwt({ role: 'service_role' }))).toThrow(/service_role/);
  });

  it('tolerates non-JWT publishable keys', () => {
    expect(() => assertBrowserSafeKey('sb_publishable_abc123')).not.toThrow();
  });
});
