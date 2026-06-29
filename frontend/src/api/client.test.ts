import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch, setToken, getToken, clearToken, ApiError } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('has token then injects Authorization Bearer header', async () => {
    setToken('abc123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/characters');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/characters');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer abc123');
  });

  it('no token then omits Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/characters');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('401 clears token and throws ApiError', async () => {
    setToken('stale');
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/characters')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });
});
