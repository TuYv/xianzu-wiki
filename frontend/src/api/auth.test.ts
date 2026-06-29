import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login } from './auth';
import { getToken, clearToken } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('login', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('posts password and stores returned token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'jwt-token' }));
    vi.stubGlobal('fetch', fetchMock);

    await login('super-secret-password');

    expect(getToken()).toBe('jwt-token');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ password: 'super-secret-password' });
  });

  it('does not store token when login fails (401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('wrong')).rejects.toThrow();
    expect(getToken()).toBeNull();
  });
});
