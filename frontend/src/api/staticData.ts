import type { CharacterDetail, ExportPayload } from '../types';

// data.json 的形状即导出的形状(characters + relationships)。
export type SiteData = ExportPayload;

let cache: Promise<SiteData> | null = null;

/** 加载并缓存 data.json(只取一次)。BASE_URL 适配 GitHub Pages 子路径。 */
export function loadSiteData(): Promise<SiteData> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}data.json`).then((res) => {
      if (!res.ok) throw new Error(`无法加载 data.json (${res.status})`);
      return res.json() as Promise<SiteData>;
    });
  }
  return cache;
}

/** 仅供测试重置缓存。 */
export function _resetSiteDataCache(): void {
  cache = null;
}

/** 从整份数据派生单个人物详情(含其双向关系),对应后端 CharacterDetail。 */
export function buildDetail(data: SiteData, id: number): CharacterDetail {
  const character = data.characters.find((c) => c.id === id);
  if (!character) throw new Error('未找到该人物');
  const relationships = data.relationships.filter(
    (r) => r.from_id === id || r.to_id === id,
  );
  return { ...character, relationships };
}

/** 静态站只读:写操作不可用(编辑请在本地用后端编辑器,导出后提交 data.json)。 */
export function staticReadOnly(): never {
  throw new Error('本站为只读的静态站点;编辑请在本地运行编辑器并导出 data.json 提交。');
}
