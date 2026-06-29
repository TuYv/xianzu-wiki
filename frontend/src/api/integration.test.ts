import { describe, it, expect, vi, afterEach } from 'vitest';
import { listCharacters } from './characters';

/**
 * 接缝守卫:用 REAL apiFetch（不 mock ./client）+ REAL listCharacters,只桩 global.fetch。
 * apiFetch 唯一职责是补 `/api` 前缀,api 模块传入的 path 不得自带 `/api`。
 * 若有人把 `/characters` 退回成 `/api/characters`,真实 URL 立刻变成 `/api/api/characters`,
 * 本用例失败 —— 永久封住整条读路径的 404 回归。
 */
describe('api ↔ client seam (real apiFetch, no module mocks)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listCharacters hits /api/characters exactly once (not /api/api/characters)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await listCharacters();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/characters');
  });
});
