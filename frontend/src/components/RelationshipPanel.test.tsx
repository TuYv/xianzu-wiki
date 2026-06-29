import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RelationshipPanel } from './RelationshipPanel';
import * as relApi from '../api/relationships';
import { useAuth } from '../state/auth';
import type { Character } from '../types';

vi.mock('../state/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../api/relationships', () => ({
  createRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
}));

const guest = { isAdmin: false, login: vi.fn(), logout: vi.fn() };
const admin = { isAdmin: true, login: vi.fn(), logout: vi.fn() };

const chars: Character[] = [
  { id: 1, name: '甲', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '乙', aliases: [], gender: 'female', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
];

describe('RelationshipPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing for guests', () => {
    vi.mocked(useAuth).mockReturnValue(guest);
    const { container } = render(
      <RelationshipPanel characterId={1} characters={chars} relationships={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows parent_role only when type is parent', () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} />);
    expect(screen.queryByLabelText('parent_role')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'spouse' } });
    expect(screen.queryByLabelText('parent_role')).toBeNull();
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'parent' } });
    expect(screen.queryByLabelText('parent_role')).not.toBeNull();
  });

  it('creates a relationship with the exact payload', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.createRelationship).mockResolvedValue({} as never);
    const onChanged = vi.fn();
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('to_id'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'parent' } });
    fireEvent.change(screen.getByLabelText('parent_role'), { target: { value: 'mother' } });
    fireEvent.click(screen.getByRole('button', { name: '添加关系' }));
    await waitFor(() =>
      expect(relApi.createRelationship).toHaveBeenCalledWith({
        from_id: 1, to_id: 2, type: 'parent', parent_role: 'mother', note: null,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('sends parent_role null for non-parent types', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.createRelationship).mockResolvedValue({} as never);
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} />);
    fireEvent.change(screen.getByLabelText('to_id'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'spouse' } });
    fireEvent.click(screen.getByRole('button', { name: '添加关系' }));
    await waitFor(() =>
      expect(relApi.createRelationship).toHaveBeenCalledWith({
        from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null,
      }),
    );
  });

  it('deletes a listed relationship', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.deleteRelationship).mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(
      <RelationshipPanel
        characterId={1}
        characters={chars}
        relationships={[{ id: 9, from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null }]}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByLabelText('delete-9'));
    await waitFor(() => expect(relApi.deleteRelationship).toHaveBeenCalledWith(9));
    expect(onChanged).toHaveBeenCalled();
  });
});
