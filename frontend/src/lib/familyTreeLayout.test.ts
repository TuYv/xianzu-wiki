import { describe, it, expect } from 'vitest';
import { buildFamilyGraph, buildClanGraph } from './familyTreeLayout';
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

function adoptive(id: number, from_id: number, to_id: number): Relationship {
  return { id, from_id, to_id, type: 'parent', parent_role: 'adoptive', note: null };
}

const personNodes = <T extends { id: string }>(nodes: T[]) =>
  nodes.filter((n) => !n.id.startsWith('union:'));
const unionNodes = <T extends { id: string }>(nodes: T[]) =>
  nodes.filter((n) => n.id.startsWith('union:'));

describe('buildFamilyGraph', () => {
  it('整族模式收集整个血亲家族(含兄弟)+ 配偶终端节点,但不含配偶的原生家族;直系模式不含兄弟', () => {
    const chars = [1, 2, 3, 4, 5, 6].map((i) => char(i, `P${i}`));
    const rels = [
      parent(1, 1, 3),
      parent(2, 2, 3),
      parent(3, 1, 4),
      parent(4, 2, 4), // 1、2 是 3、4 的父母 → 3、4 互为兄弟
      spouse(5, 3, 5), // 3 与 5 成婚
      parent(6, 6, 5), // 6 是 5 的父(姻亲家)
    ];
    const ids = (whole: boolean) =>
      personNodes(buildFamilyGraph(chars, rels, 3, 3, whole).nodes)
        .map((n) => n.id)
        .sort();
    // 以 3 为中心的直系:不含兄弟 4、不含姻亲 6
    expect(ids(false)).not.toContain('4');
    expect(ids(false)).not.toContain('6');
    // 整族:血亲(1、2、3、4)全部收进来,配偶 5 作为终端节点显示,
    // 但不沿 5 继续扩散到姻亲家 6
    expect(ids(true)).toEqual(['1', '2', '3', '4', '5']);
  });

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

describe('buildClanGraph(李家四脉)', () => {
  // id 4/5/6/7 = 伯/仲/叔/季 四脉开创者(BRANCH_ROOTS 硬编码),5 = 世代锚点(GENERATION_ANCHOR_ID)。
  // 1=祖辈, 2=父辈, 8=伯脉之子过继给季脉(模拟 李渊蛟/李尺泾)。
  const chars = [1, 2, 4, 5, 6, 7, 8].map((i) => char(i, `P${i}`));
  const rels = [
    parent(1, 1, 2), // 根水 -> 木田
    parent(2, 2, 4), // 木田 -> 长湖(伯)
    parent(3, 2, 5), // 木田 -> 通崖(仲)
    parent(4, 2, 6), // 木田 -> 项平(叔)
    parent(5, 2, 7), // 木田 -> 尺泾(季)
    parent(6, 4, 8), // 长湖(生父) -> 8
    adoptive(7, 7, 8), // 尺泾(过继) -> 8
  ];

  it('伯仲叔季按名义父母(过继优先)归属,过继人物归养父一脉而非生父一脉', async () => {
    const { nodes } = await buildClanGraph(chars, rels, 5);
    const byId = Object.fromEntries(personNodes(nodes).map((n) => [n.id, n]));
    expect(byId['4'].data.branch?.label).toBe('伯脉');
    expect(byId['5'].data.branch?.label).toBe('仲脉');
    expect(byId['6'].data.branch?.label).toBe('叔脉');
    expect(byId['7'].data.branch?.label).toBe('季脉');
    // 8 的生父是伯脉长湖,但过继给季脉尺泾 -> 应归季脉,不归伯脉
    expect(byId['8'].data.branch?.label).toBe('季脉');
    // 木田/根水在四脉开创者之上,不归属任何一脉
    expect(byId['2'].data.branch).toBeUndefined();
    expect(byId['1'].data.branch).toBeUndefined();
  });

  it('世代编号以通崖为第一代,兄弟同代;往上是父辈/祖辈,不编号', async () => {
    const { nodes } = await buildClanGraph(chars, rels, 5);
    const byId = Object.fromEntries(personNodes(nodes).map((n) => [n.id, n]));
    const gen = (id: string) => byId[id].data.generationLabel;
    expect(gen('5')).toBe('第一代');
    expect(gen('4')).toBe('第一代');
    expect(gen('6')).toBe('第一代');
    expect(gen('7')).toBe('第一代');
    expect(gen('8')).toBe('第二代'); // 尺泾(第一代)之子(过继)
    expect(gen('2')).toBe('父辈');
    expect(gen('1')).toBe('祖辈');
  });

  it('过继覆盖生父母:主干边走养父,生父边降级为 bio-weak,不重复计入主干', async () => {
    const { edges } = await buildClanGraph(chars, rels, 5);
    const main = edges.filter((e) => e.kind !== 'bio-weak');
    const weak = edges.filter((e) => e.kind === 'bio-weak');
    // 主干:尺泾(养父)直连 8,长湖(生父)不出现在主干边里
    expect(main.some((e) => e.source === '7' && e.target === '8')).toBe(true);
    expect(main.some((e) => e.source === '4' && e.target === '8')).toBe(false);
    // 弱化虚线:长湖(生父) -> 8,仅此一条
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ source: '4', target: '8', kind: 'bio-weak' });
  });
});
