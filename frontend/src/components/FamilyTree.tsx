import { type MouseEvent, useCallback, useMemo } from 'react';
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
import { buildFamilyGraph } from '../lib/familyTreeLayout';

interface FamilyTreeProps {
  characters: Character[];
  relationships: Relationship[];
  focusId: number;
  depth: number;
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

const nodeTypes: NodeTypes = { union: UnionNode };

const defaultEdgeOptions = { type: 'smoothstep' as const };

export function FamilyTree({
  characters,
  relationships,
  focusId,
  depth,
}: FamilyTreeProps) {
  const navigate = useNavigate();

  // 布局 memoize,仅输入变化时重算(spec §4.3)
  const { nodes, edges } = useMemo(
    () => buildFamilyGraph(characters, relationships, focusId, depth),
    [characters, relationships, focusId, depth],
  );

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        data: { label: n.data.label ?? '' },
        position: n.position,
        type: n.type,
        selectable: n.type !== 'union',
        draggable: false,
      })),
    [nodes],
  );

  const rfEdges: Edge[] = useMemo(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    [edges],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (node.id.startsWith('union:')) return;
      navigate(`/characters/${node.id}`);
    },
    [navigate],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
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
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={26} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
