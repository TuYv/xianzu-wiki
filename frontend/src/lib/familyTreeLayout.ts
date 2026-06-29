import dagre from '@dagrejs/dagre';
import type { Character, Relationship } from '../types';

export type FlowNode = {
  id: string;
  data: { label?: string; character?: Character };
  position: { x: number; y: number };
  type?: string;
  hidden?: boolean;
};

export type FlowEdge = { id: string; source: string; target: string };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const UNION_SIZE = 16;

const isUnion = (id: string): boolean => id.startsWith('union:');

function unionId(a: number, b: number): string {
  return `union:${Math.min(a, b)}-${Math.max(a, b)}`;
}

/**
 * 以 focusId 为中心,沿 parent 边上/下各 depth 代 BFS 收集人物,
 * 为每组 spouse 生成一个可见的 union 连接节点(配偶→union、union→子女、单亲直连),
 * 用 dagre rankdir=TB 计算坐标。visited 去重防环死循环。
 * 注意:union 节点必须可见(type='union'),否则 React Flow 会隐藏连到它的所有边。
 */
export function buildFamilyGraph(
  characters: Character[],
  relationships: Relationship[],
  focusId: number,
  depth: number,
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

  // BFS 上/下各 depth 代;visited 防环
  const visited = new Set<number>();
  if (byId.has(focusId)) visited.add(focusId);

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

  // 把已收集者的配偶补进来(同代),保证 union 两端都渲染
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && byId.has(b)) visited.add(b);
    if (visited.has(b) && byId.has(a)) visited.add(a);
  }

  // visited 内的配偶组(归一去重)
  const couples = new Map<string, [number, number]>();
  for (const [a, b] of spousePairs) {
    if (!visited.has(a) || !visited.has(b)) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    couples.set(unionId(lo, hi), [lo, hi]);
  }

  // 节点
  const nodes: FlowNode[] = [];
  for (const id of visited) {
    const c = byId.get(id)!;
    nodes.push({ id: String(id), data: { label: c.name, character: c }, position: { x: 0, y: 0 } });
  }
  for (const [uid] of couples) {
    nodes.push({ id: uid, data: {}, position: { x: 0, y: 0 }, type: 'union' });
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

  // 配偶 -> union
  for (const [uid, [a, b]] of couples) {
    addEdge(String(a), uid);
    addEdge(String(b), uid);
  }

  // union/单亲 -> 子女
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
