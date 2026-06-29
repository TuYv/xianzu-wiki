import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListPage, filterCharacters } from './ListPage';
import type { Character } from '../types';

vi.mock('../api/characters', () => ({ listCharacters: vi.fn() }));

import { listCharacters } from '../api/characters';

const SAMPLE: Character[] = [
  { id: 1, name: '萧寒', aliases: ['寒少'], gender: 'male', generation: '三代', realm: '金丹', affiliation: '萧家', status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '柳沉香', aliases: ['香姨'], gender: 'female', generation: '二代', realm: '元婴', affiliation: '柳家', status: 'dead', avatar_url: null, bio: null },
  { id: 3, name: '萧无极', aliases: [], gender: 'male', generation: '一代', realm: '化神', affiliation: '萧家', status: 'alive', avatar_url: null, bio: null },
];

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderPage() {
  return render(
    <MemoryRouter future={routerFuture}>
      <ListPage />
    </MemoryRouter>,
  );
}

describe('filterCharacters', () => {
  it('matches keyword against name and aliases', () => {
    expect(filterCharacters(SAMPLE, '香姨', '', '', '').map((c) => c.id)).toEqual([2]);
    expect(filterCharacters(SAMPLE, '萧', '', '', '').map((c) => c.id)).toEqual([1, 3]);
  });

  it('filters by status / affiliation / realm', () => {
    expect(filterCharacters(SAMPLE, '', '', '', 'dead').map((c) => c.id)).toEqual([2]);
    expect(filterCharacters(SAMPLE, '', '萧家', '', '').map((c) => c.id)).toEqual([1, 3]);
    expect(filterCharacters(SAMPLE, '', '', '化神', '').map((c) => c.id)).toEqual([3]);
  });
});

describe('ListPage', () => {
  beforeEach(() => {
    vi.mocked(listCharacters).mockReset();
    vi.mocked(listCharacters).mockResolvedValue(SAMPLE);
  });

  it('renders all characters after load', async () => {
    renderPage();
    expect(await screen.findByText('萧寒')).toBeInTheDocument();
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.getByText('萧无极')).toBeInTheDocument();
  });

  it('filters by keyword across name and aliases', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByPlaceholderText('搜索姓名或别名'), { target: { value: '香姨' } });
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.queryByText('萧寒')).not.toBeInTheDocument();
    expect(screen.queryByText('萧无极')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'dead' } });
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.queryByText('萧寒')).not.toBeInTheDocument();
  });

  it('filters by affiliation', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByLabelText('势力'), { target: { value: '萧家' } });
    expect(screen.getByText('萧寒')).toBeInTheDocument();
    expect(screen.getByText('萧无极')).toBeInTheDocument();
    expect(screen.queryByText('柳沉香')).not.toBeInTheDocument();
  });

  it('filters by realm', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByLabelText('境界'), { target: { value: '化神' } });
    expect(screen.getByText('萧无极')).toBeInTheDocument();
    expect(screen.queryByText('萧寒')).not.toBeInTheDocument();
    expect(screen.queryByText('柳沉香')).not.toBeInTheDocument();
  });
});
