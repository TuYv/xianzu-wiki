import { describe, it, expect } from 'vitest';
import { buildFamilyGraph } from './familyTreeLayout';
import type { Character, Relationship } from '../types';

function char(id: number, name: string): Character {
  return {
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
  };
}

function parent(id: number, from_id: number, to_id: number): Relationship {
  return { id, from_id, to_id, type: 'parent', parent_role: 'father', note: null };
}

function spouse(id: number, from_id: number, to_id: number): Relationship {
  return { id, from_id, to_id, type: 'spouse', parent_role: null, note: null };
}

const personNodes = (nodes: { id: string }[]) =>
  nodes.filter((n) => !n.id.startsWith('union:'));
const unionNodes = (nodes: { id: string }[]) =>
  nodes.filter((n) => n.id.startsWith('union:'));

describe('buildFamilyGraph', () => {
  it('一对配偶生成一个可见的 union 连接节点并各连一条边', () => {
    const chars = [char(1, 'A'), char(2, 'B')];
    const rels = [spouse(1, 1, 2)];

    const { nodes, edges } = buildFamilyGraph(chars, rels, 1, 3);

    const unions = unionNodes(nodes);
    expect(unions).toHaveLength(1);
    expect(unions[0].id).toBe('union:1-2');
    // union 节点是可见的连接桩(type='union'),不再 hidden,否则连到它的边会被 React Flow 隐藏
    expect((unions[0] as { type?: string }).type).toBe('union');
    expect((unions[0] as { hidden?: boolean }).hidden).toBeUndefined();
    expect(edges.some((e) => e.source === '1' && e.target === 'union:1-2')).toBe(true);
    expect(edges.some((e) => e.source === '2' && e.target === 'union:1-2')).toBe(true);
  });

  it('夫妻的共同子女挂在 union 节点下,而非直接连父母', () => {
    const chars = [char(1, '父'), char(2, '母'), char(3, '子')];
    const rels = [spouse(1, 1, 2), parent(2, 1, 3), parent(3, 2, 3)];

    const { edges } = buildFamilyGraph(chars, rels, 3, 3);

    expect(edges.some((e) => e.source === 'union:1-2' && e.target === '3')).toBe(true);
    expect(edges.some((e) => e.source === '1' && e.target === '3')).toBe(false);
    expect(edges.some((e) => e.source === '2' && e.target === '3')).toBe(false);
  });

  it('depth 截断生效:focus depth=1 只到上一代,够不到曾祖', () => {
    const chars = [char(1, '曾祖'), char(2, '祖'), char(3, '父'), char(4, '我')];
    const rels = [parent(1, 1, 2), parent(2, 2, 3), parent(3, 3, 4)];

    const { nodes } = buildFamilyGraph(chars, rels, 4, 1);

    const ids = personNodes(nodes)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(['3', '4']);
  });

  it('parent 成环时不死循环,人物去重收敛', () => {
    const chars = [char(1, 'A'), char(2, 'B')];
    const rels = [parent(1, 1, 2), parent(2, 2, 1)];

    const { nodes } = buildFamilyGraph(chars, rels, 1, 10);

    expect(personNodes(nodes)).toHaveLength(2);
  }, 2000); // 超时即判失败:环若导致死循环,这里会挂起而非通过

  it('单亲(无配偶)直接连子女,不生成 union 节点', () => {
    const chars = [char(1, '父'), char(3, '子')];
    const rels = [parent(1, 1, 3)];

    const { nodes, edges } = buildFamilyGraph(chars, rels, 3, 3);

    expect(unionNodes(nodes)).toHaveLength(0);
    expect(edges.some((e) => e.source === '1' && e.target === '3')).toBe(true);
  });

  it('多配偶:每段婚姻各生成一个 union,子女只挂在其亲生父母那对下', () => {
    const chars = [char(1, 'A'), char(2, 'B'), char(3, 'C'), char(4, '子')];
    const rels = [spouse(1, 1, 2), spouse(2, 1, 3), parent(3, 1, 4), parent(4, 2, 4)];

    const { nodes, edges } = buildFamilyGraph(chars, rels, 1, 3);

    const unionIds = unionNodes(nodes)
      .map((n) => n.id)
      .sort();
    expect(unionIds).toEqual(['union:1-2', 'union:1-3']);
    expect(edges.some((e) => e.source === 'union:1-2' && e.target === '4')).toBe(true);
    expect(edges.some((e) => e.source === 'union:1-3' && e.target === '4')).toBe(false);
    expect(edges.some((e) => e.source === '1' && e.target === '4')).toBe(false);
  });
});
