import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TreePage } from './TreePage';
import { listCharacters } from '../api/characters';
import { listRelationships } from '../api/relationships';
import type { Character } from '../types';

vi.mock('../api/characters', () => ({ listCharacters: vi.fn() }));
vi.mock('../api/relationships', () => ({ listRelationships: vi.fn() }));

// 隔离页面逻辑:把 FamilyTree 桩成只回显收到的 focusId / depth / whole
vi.mock('../components/FamilyTree', () => ({
  FamilyTree: ({ focusId, depth, whole }: { focusId: number; depth: number; whole?: boolean }) => (
    <div data-testid="tree">
      focus={focusId} depth={depth} whole={String(whole)}
    </div>
  ),
}));

const mockList = vi.mocked(listCharacters);
const mockRels = vi.mocked(listRelationships);

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

const chars: Character[] = [
  { id: 1, name: '叶凡', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
];

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/tree/${id}`]} future={routerFuture}>
      <Routes>
        <Route path="/tree/:id" element={<TreePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TreePage', () => {
  it('加载完成后以默认 depth=3 渲染 FamilyTree,focus 取自路由参数', async () => {
    mockList.mockResolvedValue(chars);
    mockRels.mockResolvedValue([]);
    renderAt('1');

    const tree = await screen.findByTestId('tree');
    expect(tree.textContent).toContain('focus=1');
    expect(tree.textContent).toContain('depth=3');
  });

  it('“查看整族”切换 whole 标志,再次点击回到中心视图', async () => {
    mockList.mockResolvedValue(chars);
    mockRels.mockResolvedValue([]);
    renderAt('1');

    await screen.findByTestId('tree');
    expect(screen.getByTestId('tree').textContent).toContain('whole=false');
    const btn = screen.getByRole('button', { name: '查看整族' });
    await userEvent.click(btn);

    expect(screen.getByTestId('tree').textContent).toContain('whole=true');
    // 按钮文案翻转,可切回
    const back = screen.getByRole('button', { name: '回到以当前人物为中心' });
    await userEvent.click(back);
    expect(screen.getByTestId('tree').textContent).toContain('whole=false');
  });

  it('路由 id 不在人物列表中时显示未找到', async () => {
    mockList.mockResolvedValue(chars);
    mockRels.mockResolvedValue([]);
    renderAt('999');

    expect(await screen.findByText('未找到该人物')).toBeInTheDocument();
  });

  it('接口失败时显示错误', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    mockRels.mockResolvedValue([]);
    renderAt('1');

    expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
  });
});
