import type { Character, CharacterDetail, Relationship } from '../types';

/**
 * 数据源模式。
 * - 生产构建(部署的静态站):唯一数据源是仓库里的 `public/data.json`,无后端。
 * - 本地开发(`npm run dev`):读后端 API,便于用管理员编辑器实时增删改。
 * 切换依据 Vite 的 `import.meta.env.PROD`(test 与 dev 下为 false → 走 API)。
 */
export const STATIC_DATA = import.meta.env.PROD;

export interface SiteData {
  characters: Character[];
  relationships: Relationship[];
}

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
