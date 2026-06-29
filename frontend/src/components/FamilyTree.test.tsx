import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { FamilyTree } from './FamilyTree';
import type { Character, Relationship } from '../types';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

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

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderTree(
  characters: Character[],
  relationships: Relationship[],
  focusId: number,
) {
  return render(
    <MemoryRouter initialEntries={['/tree']} future={routerFuture}>
      <div style={{ width: 800, height: 600 }}>
        <FamilyTree
          characters={characters}
          relationships={relationships}
          focusId={focusId}
          depth={3}
        />
      </div>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FamilyTree', () => {
  it('renders the React Flow canvas with a node per character', () => {
    const chars = [char(1, '父'), char(2, '母'), char(3, '子')];
    const rels: Relationship[] = [
      { id: 1, from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null },
      { id: 2, from_id: 1, to_id: 3, type: 'parent', parent_role: 'father', note: null },
      { id: 3, from_id: 2, to_id: 3, type: 'parent', parent_role: 'mother', note: null },
    ];
    const { container } = renderTree(chars, rels, 3);

    // 画布渲染成功
    expect(container.querySelector('.react-flow')).not.toBeNull();
    // 三个人物节点都在 DOM,且隐藏的 union 节点不可点击渲染
    expect(container.querySelector('[data-id="1"]')).not.toBeNull();
    expect(container.querySelector('[data-id="3"]')).not.toBeNull();
    expect(container.querySelector('[data-id="union:1-2"]')).toBeNull();
  });

  it('clicking a character node navigates to its detail page', () => {
    const chars = [char(1, '父'), char(3, '子')];
    const rels: Relationship[] = [
      { id: 1, from_id: 1, to_id: 3, type: 'parent', parent_role: 'father', note: null },
    ];
    renderTree(chars, rels, 3);

    const node = document.querySelector('[data-id="1"]');
    expect(node).not.toBeNull();
    fireEvent.click(node as Element);

    expect(screen.getByTestId('loc').textContent).toBe('/characters/1');
  });
});
