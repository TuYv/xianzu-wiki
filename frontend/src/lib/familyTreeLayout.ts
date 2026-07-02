import dagre from '@dagrejs/dagre';
import type { Character, Relationship } from '../types';

export type FlowNode = {
  id: string;
  data: {
    label?: string;
    character?: Character;
    branch?: { key: string; label: string };
    generationLabel?: string;
  };
  position: { x: number; y: number };
  type?: string;
  hidden?: boolean;
};

export type FlowEdge = { id: string; source: string; target: string; kind?: 'main' | 'bio-weak' };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const UNION_SIZE = 16;

const isUnion = (id: string): boolean => id.startsWith('union:');

function unionId(a: number, b: number): string {
  return `union:${Math.min(a, b)}-${Math.max(a, b)}`;
}

/**
 * 给定 visited 集合内的配偶对,归一去重出 couples 表,并生成
 * 「配偶→union」「union/单亲→子女」两类边(子女连接按 parentsOf 传入的父母集合判断)。
 * buildFamilyGraph(直系/整族)与 buildClanGraph(李家四脉)共用此逻辑,
 * 只是各自传入不同口径的 parentsOf(整族用全部血亲父母,四脉用"名义父母",即
 * 有过继时只取过继方)。
 */
function buildUnionsAndParentEdges(
  visited: Set<number>,
  spousePairs: Array<[number, number]>,
  parentsOf: Map<number, number[]>,
  addEdge: (source: string, target: string, kind?: 'main' | 'bio-weak') => void,
): Map<string, [number, number]> {
  const couples = new Map<string, [number, number]>();
  for (const [a, b] of spousePairs) {
    if (!visited.has(a) || !visited.has(b)) continue;
    couples.set(unionId(a, b), [Math.min(a, b), Math.max(a, b)]);
  }

  for (const [uid, [a, b]] of couples) {
    addEdge(String(a), uid);
    addEdge(String(b), uid);
  }

  for (const child of visited) {
    const ps = (parentsOf.get(child) ?? []).filter((p) => visited.has(p));
    if (ps.length === 0) continue;
    const handled = new Set<number>();
    for (const [uid, [a, b]] of couples) {
      if (ps.includes(a) && ps.includes(b)) {
        addEdge(uid, String(child));
        handled.add(a);
        handled.add(b);
      }
    }
    for (const p of ps) {
      if (!handled.has(p)) addEdge(String(p), String(child));
    }
  }

  return couples;
}

/**
 * 以 focusId 为中心,沿 parent 边收集人物(直系模式限 depth 代,整族模式不限代数),
 * 再把已收集者的配偶补为终端节点——配偶本人显示,但不沿配偶继续扩散到其原生家族,
 * 避免姻亲家族被一路带进整张图。为每组 spouse 生成一个可见的 union 连接节点
 * (配偶→union、union→子女、单亲直连),用 dagre rankdir=TB 计算坐标。
 * visited 去重防环死循环。
 * 注意:union 节点必须可见(type='union'),否则 React Flow 会隐藏连到它的所有边。
 */
export function buildFamilyGraph(
  characters: Character[],
  relationships: Relationship[],
  focusId: number,
  depth: number,
  whole = false,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const byId = new Map<number, Character>();
  for (const c of characters) byId.set(c.id, c);

  // parent: from_id(父/母) -> to_id(子/女)
  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  const spousePairs: Array<[number, number]> = [];
  for (const r of relationships) {
    if (r.type === 'parent') {
      (childrenOf.get(r.from_id) ?? childrenOf.set(r.from_id, []).get(r.from_id)!).push(r.to_id);
      (parentsOf.get(r.to_id) ?? parentsOf.set(r.to_id, []).get(r.to_id)!).push(r.from_id);
    } else if (r.type === 'spouse') {
      spousePairs.push([r.from_id, r.to_id]);
    }
  }

  // 收集要展示的人物集合;visited 兼防环。
  const visited = new Set<number>();
  if (byId.has(focusId)) visited.add(focusId);

  if (whole) {
    // 整族:经 parent(任意方向)相连的整个血亲家族,不限代数。
    // 只沿血缘扩散,不沿 spouse 扩散——否则姻亲的原生家族会被一路带进来,
    // 配偶本人由下方"补进配偶"步骤作为终端节点加入,不再继续从配偶扩散。
    const adj = new Map<number, number[]>();
    const link = (a: number, b: number) => {
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    };
    for (const r of relationships) {
      if (r.type === 'parent') link(r.from_id, r.to_id);
    }
    const queue = byId.has(focusId) ? [focusId] : [];
    while (queue.length) {
      const x = queue.shift()!;
      for (const y of adj.get(x) ?? []) {
        if (byId.has(y) && !visited.has(y)) {
          visited.add(y);
          queue.push(y);
        }
      }
    }
  } else {
    // 以当前人物为中心:沿 parent 边上(祖先)/下(后代)各 depth 代。
    let frontier = byId.has(focusId) ? [focusId] : [];
    for (let i = 0; i < depth && frontier.length; i++) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const p of parentsOf.get(id) ?? []) {
          if (byId.has(p) && !visited.has(p)) {
            visited.add(p);
            next.push(p);
          }
        }
      }
      frontier = next;
    }
    frontier = byId.has(focusId) ? [focusId] : [];
    for (let i = 0; i < depth && frontier.length; i++) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const c of childrenOf.get(id) ?? []) {
          if (byId.has(c) && !visited.has(c)) {
            visited.add(c);
            next.push(c);
          }
        }
      }
      frontier = next;
    }
  }

  // 把已收集者的配偶补进来(同代),保证 union 两端都渲染
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && byId.has(b)) visited.add(b);
    if (visited.has(b) && byId.has(a)) visited.add(a);
  }

  // 节点
  const nodes: FlowNode[] = [];
  for (const id of visited) {
    const c = byId.get(id)!;
    nodes.push({ id: String(id), data: { label: c.name, character: c }, position: { x: 0, y: 0 } });
  }

  // 边(去重)
  const edgeIds = new Set<string>();
  const edges: FlowEdge[] = [];
  const addEdge = (source: string, target: string): void => {
    const id = `e:${source}->${target}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, source, target });
  };

  const couples = buildUnionsAndParentEdges(visited, spousePairs, parentsOf, addEdge);
  for (const [uid] of couples) {
    nodes.push({ id: uid, data: {}, position: { x: 0, y: 0 }, type: 'union' });
  }

  // dagre 布局(union 节点占一个小尺寸的中间 rank,作为连接桩)
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, {
      width: isUnion(n.id) ? UNION_SIZE : NODE_WIDTH,
      height: isUnion(n.id) ? UNION_SIZE : NODE_HEIGHT,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  for (const n of nodes) {
    const pos = g.node(n.id);
    if (!pos) continue;
    const w = isUnion(n.id) ? UNION_SIZE : NODE_WIDTH;
    const h = isUnion(n.id) ? UNION_SIZE : NODE_HEIGHT;
    n.position = { x: pos.x - w / 2, y: pos.y - h / 2 };
  }

  return { nodes, edges };
}

/** 黎泾李家「伯仲叔季」四脉的开创者(李木田四子),玄鉴仙族专属,非通用规则。 */
const BRANCH_ROOTS: Record<number, { key: string; label: string }> = {
  4: { key: 'bo', label: '伯脉' }, // 李长湖
  5: { key: 'zhong', label: '仲脉' }, // 李通崖
  6: { key: 'shu', label: '叔脉' }, // 李项平
  7: { key: 'ji', label: '季脉' }, // 李尺泾
};
/** 世代编号锚点:李通崖记为第一代,兄弟同代;往上按 父辈/祖辈/先祖 标注,不编号。 */
const GENERATION_ANCHOR_ID = 5;

/**
 * 李家四脉整族图:与 buildFamilyGraph(whole=true) 收集同一个血亲连通集合,
 * 但额外计算「名义父母」(有过继时只认过继方,用于四脉归属/世代编号/主干布局)、
 * 「伯仲叔季」归属色、以及以李通崖为基准的世代标注;被过继覆盖掉的生父母关系
 * 仍以弱化虚线(kind='bio-weak')画出,不参与布局定位。
 * 用 ELK layered 算法(比 dagre 更强的交叉最小化)计算坐标,因此是异步函数;
 * elkjs 体积不小,动态 import 让直系视图/详情页等不用它的页面不背这份体积。
 */
export async function buildClanGraph(
  characters: Character[],
  relationships: Relationship[],
  focusId: number,
): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }> {
  const byId = new Map<number, Character>();
  for (const c of characters) byId.set(c.id, c);

  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  // 按 child 分组的原始父母关系(含 role),用于挑选"名义父母"
  const parentEdgesOf = new Map<number, Array<{ parentId: number; role: string | null }>>();
  const spousePairs: Array<[number, number]> = [];
  for (const r of relationships) {
    if (r.type === 'parent') {
      (childrenOf.get(r.from_id) ?? childrenOf.set(r.from_id, []).get(r.from_id)!).push(r.to_id);
      (parentsOf.get(r.to_id) ?? parentsOf.set(r.to_id, []).get(r.to_id)!).push(r.from_id);
      (parentEdgesOf.get(r.to_id) ?? parentEdgesOf.set(r.to_id, []).get(r.to_id)!).push({
        parentId: r.from_id,
        role: r.parent_role,
      });
    } else if (r.type === 'spouse') {
      spousePairs.push([r.from_id, r.to_id]);
    }
  }

  // 血亲连通集合(同 buildFamilyGraph whole 分支):只沿 parent 扩散,不沿 spouse 扩散。
  const visited = new Set<number>();
  if (byId.has(focusId)) visited.add(focusId);
  {
    const adj = new Map<number, number[]>();
    const link = (a: number, b: number) => {
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    };
    for (const r of relationships) {
      if (r.type === 'parent') link(r.from_id, r.to_id);
    }
    const queue = byId.has(focusId) ? [focusId] : [];
    while (queue.length) {
      const x = queue.shift()!;
      for (const y of adj.get(x) ?? []) {
        if (byId.has(y) && !visited.has(y)) {
          visited.add(y);
          queue.push(y);
        }
      }
    }
  }
  // 配偶补为终端节点(同 buildFamilyGraph:不再从配偶继续扩散)。
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && byId.has(b)) visited.add(b);
    if (visited.has(b) && byId.has(a)) visited.add(a);
  }

  // 名义父母(nominalParentsOf):有过继记录时只取过继方,否则取全部血亲父母。
  // 同时记录被过继覆盖掉的生父母,用于画弱化虚线。
  const nominalParentsOf = new Map<number, number[]>();
  const bioOnlyParentsOf = new Map<number, number[]>();
  for (const child of visited) {
    const edgesIn = (parentEdgesOf.get(child) ?? []).filter((e) => visited.has(e.parentId));
    const adoptive = edgesIn.filter((e) => e.role === 'adoptive');
    if (adoptive.length > 0) {
      nominalParentsOf.set(child, adoptive.map((e) => e.parentId));
      const adoptiveIds = new Set(adoptive.map((e) => e.parentId));
      const bio = edgesIn.filter((e) => !adoptiveIds.has(e.parentId));
      if (bio.length > 0) bioOnlyParentsOf.set(child, bio.map((e) => e.parentId));
    } else {
      nominalParentsOf.set(child, edgesIn.map((e) => e.parentId));
    }
  }

  // 伯仲叔季归属:沿"名义父母"链上溯,遇到四脉开创者即归属该脉;
  // 走到头(如木田/根水,或婚入的姻亲)则无归属。memo 防环。
  const branchMemo = new Map<number, { key: string; label: string } | undefined>();
  function resolveBranch(id: number): { key: string; label: string } | undefined {
    if (branchMemo.has(id)) return branchMemo.get(id);
    branchMemo.set(id, undefined); // 防环占位
    if (BRANCH_ROOTS[id]) {
      branchMemo.set(id, BRANCH_ROOTS[id]);
      return BRANCH_ROOTS[id];
    }
    for (const p of nominalParentsOf.get(id) ?? []) {
      const b = resolveBranch(p);
      if (b) {
        branchMemo.set(id, b);
        return b;
      }
    }
    return undefined;
  }
  for (const id of visited) resolveBranch(id);

  // 世代编号:以通崖(+其兄弟姊妹,共享父母者)为第 0 代起点,沿"名义父母/子女"传播。
  const nominalChildrenOf = new Map<number, number[]>();
  for (const [child, parents] of nominalParentsOf) {
    for (const p of parents) {
      (nominalChildrenOf.get(p) ?? nominalChildrenOf.set(p, []).get(p)!).push(child);
    }
  }
  const genOffset = new Map<number, number>();
  const genQueue: number[] = [];
  if (visited.has(GENERATION_ANCHOR_ID)) {
    const seeds = new Set<number>([GENERATION_ANCHOR_ID]);
    for (const p of nominalParentsOf.get(GENERATION_ANCHOR_ID) ?? []) {
      for (const sib of nominalChildrenOf.get(p) ?? []) seeds.add(sib);
    }
    for (const id of seeds) {
      genOffset.set(id, 0);
      genQueue.push(id);
    }
  }
  while (genQueue.length) {
    const id = genQueue.shift()!;
    const off = genOffset.get(id)!;
    for (const child of nominalChildrenOf.get(id) ?? []) {
      if (!genOffset.has(child)) {
        genOffset.set(child, off + 1);
        genQueue.push(child);
      }
    }
    for (const parent of nominalParentsOf.get(id) ?? []) {
      if (!genOffset.has(parent)) {
        genOffset.set(parent, off - 1);
        genQueue.push(parent);
      }
    }
  }
  function generationLabel(id: number): string | undefined {
    const off = genOffset.get(id);
    if (off === undefined) return undefined;
    if (off >= 0) return `第${offsetToHanNumeral(off + 1)}代`;
    if (off === -1) return '父辈';
    if (off === -2) return '祖辈';
    return '先祖';
  }

  // 节点(带四脉归属色 + 世代标注)
  const nodes: FlowNode[] = [];
  for (const id of visited) {
    const c = byId.get(id)!;
    nodes.push({
      id: String(id),
      data: { label: c.name, character: c, branch: resolveBranch(id), generationLabel: generationLabel(id) },
      position: { x: 0, y: 0 },
    });
  }

  // 主干边:配偶→union、union/名义单亲→子女(基于 nominalParentsOf)
  const edgeIds = new Set<string>();
  const edges: FlowEdge[] = [];
  const addEdge = (source: string, target: string, kind: 'main' | 'bio-weak' = 'main'): void => {
    const id = `e:${source}->${target}:${kind}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, source, target, kind });
  };
  const couples = buildUnionsAndParentEdges(visited, spousePairs, nominalParentsOf, addEdge);
  for (const [uid] of couples) {
    nodes.push({ id: uid, data: {}, position: { x: 0, y: 0 }, type: 'union' });
  }

  // 弱化虚线:被过继覆盖掉的生父母 → 子女,不参与 ELK 布局定位,仅供事后叠加。
  const bioWeakEdges: FlowEdge[] = [];
  for (const [child, bioParents] of bioOnlyParentsOf) {
    for (const p of bioParents) {
      bioWeakEdges.push({ id: `e:${p}->${child}:bio-weak`, source: String(p), target: String(child), kind: 'bio-weak' });
    }
  }

  // ELK layered 布局(仅用主干边定位;弱化虚线事后用已算好的坐标连接)
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '48',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: isUnion(n.id) ? UNION_SIZE : NODE_WIDTH,
      height: isUnion(n.id) ? UNION_SIZE : NODE_HEIGHT,
    })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const laidOut = await new ELK().layout(elkGraph);
  const posById = new Map<string, { x: number; y: number }>();
  for (const child of laidOut.children ?? []) {
    posById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  for (const n of nodes) {
    const pos = posById.get(n.id);
    if (pos) n.position = pos;
  }

  return { nodes, edges: [...edges, ...bioWeakEdges] };
}

const HAN_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function offsetToHanNumeral(n: number): string {
  if (n >= 1 && n <= 10) return HAN_NUMERALS[n];
  if (n > 10 && n < 20) return `十${HAN_NUMERALS[n - 10]}`;
  return String(n);
}
