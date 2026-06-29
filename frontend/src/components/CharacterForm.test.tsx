import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterForm } from './CharacterForm';
import * as charactersApi from '../api/characters';
import { useAuth } from '../state/auth';

vi.mock('../state/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../api/characters', () => ({
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
}));

const guest = { isAdmin: false, login: vi.fn(), logout: vi.fn() };
const admin = { isAdmin: true, login: vi.fn(), logout: vi.fn() };

describe('CharacterForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing for guests', () => {
    vi.mocked(useAuth).mockReturnValue(guest);
    const { container } = render(<CharacterForm />);
    expect(container.firstChild).toBeNull();
  });

  it('submits a create payload and calls onSaved', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(charactersApi.createCharacter).mockResolvedValue({ id: 1 } as never);
    const onSaved = vi.fn();
    render(<CharacterForm onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: '玄鉴' } });
    fireEvent.change(screen.getByLabelText('aliases'), { target: { value: '老祖, 剑仙' } });
    fireEvent.click(screen.getByRole('button', { name: '新建' }));
    await waitFor(() => expect(charactersApi.createCharacter).toHaveBeenCalled());
    expect(charactersApi.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name: '玄鉴', aliases: ['老祖', '剑仙'], gender: 'unknown', status: 'alive' }),
    );
    expect(onSaved).toHaveBeenCalledWith({ id: 1 });
  });

  it('submits an update when initial has an id', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(charactersApi.updateCharacter).mockResolvedValue({ id: 5 } as never);
    render(
      <CharacterForm
        initial={{
          id: 5, name: '甲', aliases: [], gender: 'male', generation: null, realm: null,
          affiliation: null, status: 'alive', avatar_url: null, bio: null,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(charactersApi.updateCharacter).toHaveBeenCalledWith(5, expect.objectContaining({ name: '甲' })),
    );
    expect(charactersApi.createCharacter).not.toHaveBeenCalled();
  });
});
