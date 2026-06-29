import { type MouseEvent, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
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
        hidden: n.hidden,
        type: n.type,
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
        onNodeClick={onNodeClick}
        fitView
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
