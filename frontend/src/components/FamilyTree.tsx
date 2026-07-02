import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';
import type { Character, Relationship } from '../types';
import { buildFamilyGraph, buildClanGraph, type FlowNode, type FlowEdge } from '../lib/familyTreeLayout';

interface FamilyTreeProps {
  characters: Character[];
  relationships: Relationship[];
  focusId: number;
  depth: number;
  /** true = 显示整个连通血亲家族(李家按伯仲叔季四脉分区);false = 以当前人物为中心的直系。 */
  whole?: boolean;
}

/** 婚姻连接点(玉珏):配偶连入、子女引出;不可见的连接桩让 edge 锚定。 */
function UnionNode() {
  return (
    <div className="union-node" aria-hidden="true">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

/** 整族图人物节点:按伯仲叔季染色边框 + 世代标签角标(仅整族视图使用)。 */
function PersonNode({ data }: { data: FlowNode['data'] }) {
  const branchClass = data.branch ? `person-node--${data.branch.key}` : '';
  return (
    <div className={`person-node ${branchClass}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {data.label}
      {data.generationLabel && <span className="person-node__generation">{data.generationLabel}</span>}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes: NodeTypes = { union: UnionNode, person: PersonNode };

const defaultEdgeOptions = { type: 'smoothstep' as const };

const CLAN_LEGEND_ITEMS = [
  { key: 'bo', label: '伯脉' },
  { key: 'zhong', label: '仲脉' },
  { key: 'shu', label: '叔脉' },
  { key: 'ji', label: '季脉' },
] as const;

function ClanLegend() {
  return (
    <div className="clan-legend" aria-label="四脉图例">
      {CLAN_LEGEND_ITEMS.map((b) => (
        <span className="clan-legend__item" key={b.key}>
          <span className={`clan-legend__swatch clan-legend__swatch--${b.key}`} />
          {b.label}
        </span>
      ))}
      <span className="clan-legend__item">
        <span className="clan-legend__swatch clan-legend__swatch--adopt" />
        虚线为过继前生父母
      </span>
    </div>
  );
}

export function FamilyTree({
  characters,
  relationships,
  focusId,
  depth,
  whole = false,
}: FamilyTreeProps) {
  const navigate = useNavigate();

  // 直系视图:同步 dagre 布局,输入变化时重算(spec §4.3)。
  const egoGraph = useMemo(
    () => (whole ? null : buildFamilyGraph(characters, relationships, focusId, depth, false)),
    [characters, relationships, focusId, depth, whole],
  );

  // 整族视图(四脉):ELK 布局是异步的,用 effect 计算。
  const [clanGraph, setClanGraph] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  useEffect(() => {
    if (!whole) {
      setClanGraph(null);
      return;
    }
    let cancelled = false;
    setClanGraph(null);
    buildClanGraph(characters, relationships, focusId).then((g) => {
      if (!cancelled) setClanGraph(g);
    });
    return () => {
      cancelled = true;
    };
  }, [characters, relationships, focusId, whole]);

  const graph = whole ? clanGraph : egoGraph;

  const rfNodes: Node[] = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((n) => ({
      id: n.id,
      data: { label: n.data.label ?? '', branch: n.data.branch, generationLabel: n.data.generationLabel },
      position: n.position,
      type: n.type ?? (whole ? 'person' : undefined),
      selectable: n.type !== 'union',
      draggable: false,
    }));
  }, [graph, whole]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      className: e.kind === 'bio-weak' ? 'edge-bio-weak' : undefined,
    }));
  }, [graph]);

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (node.id.startsWith('union:')) return;
      navigate(`/characters/${node.id}`);
    },
    [navigate],
  );

  if (whole && !clanGraph) {
    return (
      <div className="family-tree family-tree--loading">
        <p className="tree-page__msg">整族布局计算中…</p>
      </div>
    );
  }

  return (
    <div className="family-tree">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={26} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {whole && <ClanLegend />}
    </div>
  );
}
