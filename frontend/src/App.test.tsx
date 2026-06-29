import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { getCharacter, listCharacters } from './api/characters';
import { listRelationships } from './api/relationships';
import type { CharacterDetail, Character } from './types';

vi.mock('./api/characters', () => ({
  getCharacter: vi.fn(),
  listCharacters: vi.fn(),
}));
vi.mock('./api/relationships', () => ({ listRelationships: vi.fn() }));

const mockGet = vi.mocked(getCharacter);
const mockList = vi.mocked(listCharacters);
const mockRels = vi.mocked(listRelationships);

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

const detail: CharacterDetail = {
  id: 1,
  name: '叶凡',
  aliases: [],
  gender: 'male',
  generation: null,
  realm: null,
  affiliation: null,
  status: 'alive',
  avatar_url: null,
  bio: null,
  relationships: [],
};

const chars: Character[] = [
  { id: 1, name: '叶凡', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppRoutes', () => {
  it('/characters/:id 解析到 DetailPage', async () => {
    mockGet.mockResolvedValue(detail);
    mockList.mockResolvedValue(chars);
    renderAt('/characters/1');

    // DetailPage 独有:人物姓名作为一级标题
    expect(await screen.findByRole('heading', { name: '叶凡' })).toBeInTheDocument();
  });

  it('/tree/:id 解析到 TreePage', async () => {
    mockList.mockResolvedValue(chars);
    mockRels.mockResolvedValue([]);
    renderAt('/tree/1');

    // TreePage 独有:整族切换按钮
    expect(await screen.findByRole('button', { name: '查看整族' })).toBeInTheDocument();
  });
});
