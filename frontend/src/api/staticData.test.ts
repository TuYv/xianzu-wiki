import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildDetail, loadSiteData, _resetSiteDataCache, type SiteData } from './staticData';
import type { Character } from '../types';

const char = (id: number, name: string): Character => ({
  id,
  name,
  aliases: [],
  gender: 'unknown',
  generation: null,
  realm: null,
  affiliation: null,
  status: 'alive',
  avatar_url: null,
  bio: null,
});

const DATA: SiteData = {
  characters: [char(1, '甲'), char(2, '乙'), char(3, '丙')],
  relationships: [
    { id: 1, from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null },
    { id: 2, from_id: 1, to_id: 3, type: 'parent', parent_role: 'father', note: null },
  ],
};

afterEach(() => {
  _resetSiteDataCache();
  vi.unstubAllGlobals();
});

describe('buildDetail', () => {
  it('派生人物详情并附带双向关系', () => {
    const d = buildDetail(DATA, 1);
    expect(d.name).toBe('甲');
    expect(d.relationships.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it('只取与该人物相关的关系', () => {
    expect(buildDetail(DATA, 3).relationships.map((r) => r.id)).toEqual([2]);
  });

  it('找不到人物时抛错', () => {
    expect(() => buildDetail(DATA, 99)).toThrow('未找到该人物');
  });
});

describe('loadSiteData', () => {
  it('fetch data.json 一次并缓存', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => DATA });
    vi.stubGlobal('fetch', fetchMock);
    const a = await loadSiteData();
    const b = await loadSiteData();
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('data.json');
  });

  it('响应非 ok 时抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadSiteData()).rejects.toThrow('data.json');
  });
});
