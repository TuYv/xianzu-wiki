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
    // 全字段断言:新建必须下发完整 payload(含 notes),任一字段回归都会被这里抓住。
    expect(charactersApi.createCharacter).toHaveBeenCalledWith({
      name: '玄鉴',
      aliases: ['老祖', '剑仙'],
      gender: 'unknown',
      generation: null,
      realm: null,
      affiliation: null,
      status: 'alive',
      avatar_url: null,
      bio: null,
      notes: null,
    });
    expect(onSaved).toHaveBeenCalledWith({ id: 1 });
  });

  it('submits an update without notes (edit mode must not blank stored notes)', async () => {
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
    await waitFor(() => expect(charactersApi.updateCharacter).toHaveBeenCalled());
    const [idArg, payloadArg] = vi.mocked(charactersApi.updateCharacter).mock.calls[0];
    expect(idArg).toBe(5);
    expect(payloadArg).toMatchObject({ name: '甲' });
    // 编辑态省略 notes,后端 exclude_unset 保留库内原值,不会被空表单覆盖。
    expect(payloadArg).not.toHaveProperty('notes');
    expect(charactersApi.createCharacter).not.toHaveBeenCalled();
  });
});
